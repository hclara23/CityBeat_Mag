import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import {
  authorizePaidSalesOrder,
  publicSalesOrder,
  SalesOrderAccessError,
} from '@/lib/sales-order-server'
import {
  getSalesIntakeSchema,
  initialSalesIntakeValues,
  intakeCompletion,
  missingSalesIntakeFields,
  sanitizeSalesIntakeValues,
} from '@/lib/sales-intake'
import { provisionSalesOrder } from '@/lib/sales-fulfillment-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character))
}

function accessError(error: unknown) {
  if (error instanceof SalesOrderAccessError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error('sales intake error:', error)
  return NextResponse.json({ error: 'Could not open this order.' }, { status: 500 })
}

async function authorized(request: NextRequest, orderId: string) {
  return authorizePaidSalesOrder({
    orderId,
    accessToken: request.nextUrl.searchParams.get('access') || '',
    sessionId: request.nextUrl.searchParams.get('session_id') || undefined,
  })
}

async function sendResumeLinkOnce(input: {
  request: NextRequest
  order: Record<string, any>
  ref: FirebaseFirestore.DocumentReference
}) {
  if (input.order.resume_email_sent_at || !input.order.contact_email) return
  const resumeUrl = new URL(input.request.url)
  resumeUrl.searchParams.delete('session_id')
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h1 style="font-size:24px;margin-bottom:8px">Finish your CityBeat order</h1>
    <p>Your payment for <strong>${escapeHtml(input.order.product_name || 'your CityBeat order')}</strong> is complete.</p>
    <p>We saved your progress. Use this private link any time in the next 30 days to finish the information and assets our team needs.</p>
    <p style="margin:24px 0"><a href="${escapeHtml(resumeUrl.toString())}" style="display:inline-block;background:#00e0d1;color:#04121a;padding:13px 20px;text-decoration:none;font-weight:800">Continue my order</a></p>
    <p style="font-size:12px;color:#666">Do not forward this link. It opens your private order brief.</p>
  </div>`
  const result = await sendEmail(
    input.order.contact_email,
    `Finish your CityBeat ${input.order.product_name || 'order'}`,
    html
  ).catch(() => ({ sent: false }))
  await input.ref.set(
    {
      resume_email_sent_at: (result as any).sent ? new Date().toISOString() : null,
      resume_email_error: (result as any).sent ? null : (result as any).error || 'send_failed',
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )
}

export async function GET(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const result = await authorized(request, params.orderId)
    const schema = getSalesIntakeSchema(result.order.intake_kind)
    if (!schema) return NextResponse.json({ error: 'This product does not have an intake brief.' }, { status: 409 })
    const initial = initialSalesIntakeValues(result.order.intake_kind, result.order)
    const values = { ...initial, ...(result.order.intake_data || {}) }
    await sendResumeLinkOnce({ request, order: result.order, ref: result.ref })
    return NextResponse.json({
      order: { ...publicSalesOrder(result.order), intake_data: values },
      schema,
      completion: intakeCompletion(schema, values),
    })
  } catch (error) {
    return accessError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const result = await authorized(request, params.orderId)
    if (result.order.intake_status === 'submitted') {
      return NextResponse.json({ error: 'This brief has already been submitted.' }, { status: 409 })
    }
    const schema = getSalesIntakeSchema(result.order.intake_kind)
    if (!schema) return NextResponse.json({ error: 'This product does not have an intake brief.' }, { status: 409 })
    const body = await request.json().catch(() => ({}))
    const patch = sanitizeSalesIntakeValues(schema, body.values)
    const values = { ...(result.order.intake_data || {}), ...patch }
    const currentStep = Math.min(
      schema.sections.length - 1,
      Math.max(0, Number.isFinite(Number(body.currentStep)) ? Math.floor(Number(body.currentStep)) : 0)
    )
    const completion = intakeCompletion(schema, values)
    await result.ref.set(
      {
        intake_data: values,
        intake_status: 'in_progress',
        intake_current_step: currentStep,
        intake_completion: completion,
        intake_last_saved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
    return NextResponse.json({ ok: true, completion, savedAt: new Date().toISOString() })
  } catch (error) {
    return accessError(error)
  }
}

export async function POST(request: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const result = await authorized(request, params.orderId)
    const schema = getSalesIntakeSchema(result.order.intake_kind)
    if (!schema) return NextResponse.json({ error: 'This product does not have an intake brief.' }, { status: 409 })
    if (
      result.order.intake_status === 'submitted' &&
      ['in_review', 'fulfilled'].includes(result.order.fulfillment_status)
    ) {
      return NextResponse.json({ ok: true, alreadySubmitted: true })
    }
    const body = await request.json().catch(() => ({}))
    const patch = sanitizeSalesIntakeValues(schema, body.values)
    const values = { ...(result.order.intake_data || {}), ...patch }
    const missing = missingSalesIntakeFields(schema, values)
    if (missing.length) {
      return NextResponse.json({ error: 'Complete the required fields before submitting.', missing }, { status: 400 })
    }
    await result.ref.set(
      {
        intake_data: values,
        intake_status: 'submitted',
        intake_completion: 100,
        intake_submitted_at: new Date().toISOString(),
        fulfillment_status: 'provisioning',
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
    try {
      const target = await provisionSalesOrder({ orderId: params.orderId, order: result.order, values })
      await result.ref.set(
        {
          fulfillment_status: target.status,
          fulfillment_target: { collection: target.collection, id: target.id },
          fulfillment_created_at: new Date().toISOString(),
          fulfillment_error: null,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )
      return NextResponse.json({ ok: true, fulfillmentStatus: target.status })
    } catch (fulfillmentError: any) {
      await result.ref.set(
        {
          fulfillment_status: 'needs_attention',
          fulfillment_error: String(fulfillmentError?.message || 'Provisioning failed').slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )
      throw fulfillmentError
    }
  } catch (error) {
    return accessError(error)
  }
}
