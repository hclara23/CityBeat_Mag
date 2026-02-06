import { Env } from '../index'
import { emailTemplates, sendEmail } from './emails'

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return new Response('Signature missing', { status: 400 })
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET)
    if (!isValid) {
      return new Response('Signature invalid', { status: 401 })
    }

    const event = JSON.parse(body)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        await handleCheckoutCompleted(session, env)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object
        await handleChargeRefunded(charge, env)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        await handleInvoicePaymentSucceeded(invoice, env)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        await handleInvoicePaymentFailed(invoice, env)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await handleSubscriptionCancelled(subscription, env)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object
        await handleSubscriptionCreated(subscription, env)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook error', { status: 500 })
  }
}

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const [timestamp, hash] = signature.split(',').reduce((acc: any, part) => {
      const [key, value] = part.split('=')
      acc[key === 't' ? 0 : 1] = value
      return acc
    }, [])

    if (!timestamp || !hash) {
      return false
    }

    // Create signed content
    const signedContent = `${timestamp}.${body}`

    // Encode secret
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

    // Sign
    const signature_bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent))
    const computed_hash = Array.from(new Uint8Array(signature_bytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return computed_hash === hash
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

async function handleCheckoutCompleted(session: any, env: Env): Promise<void> {
  console.log('Checkout completed:', session.id)

  try {
    // Extract advertiser email and details
    const advertiserEmail = session.customer_email || session.customer_details?.email
    if (!advertiserEmail) {
      console.warn('No advertiser email found in session')
      return
    }

    // Extract metadata
    const metadata = session.metadata || {}
    const companyName = metadata.companyName || 'Valued Customer'
    const contactName = metadata.contactName || ''
    const phone = metadata.phone || ''
    const website = metadata.website || ''
    const adType = metadata.adType || 'advertisement'

    // Build ad data for email template and database
    const adData = {
      companyName,
      adType,
      amount: session.amount_total || 0,
      sessionId: session.id,
    }

    // Send confirmation email
    const template = emailTemplates.adPurchaseConfirmation(adData)
    const emailResponse = await sendEmail(advertiserEmail, template, env)

    if (!emailResponse.ok) {
      console.warn('Ad purchase confirmation email failed:', emailResponse.statusText)
    } else {
      console.log('Ad purchase confirmation email sent to:', advertiserEmail)
    }

    // Record payment in Supabase
    try {
      const supabaseUrl = env.SUPABASE_URL
      const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

      if (supabaseUrl && supabaseServiceKey) {
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/ad_purchases`, {
          method: 'POST',
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            session_id: session.id,
            advertiser_email: advertiserEmail,
            company_name: companyName,
            contact_name: contactName,
            phone,
            website,
            ad_type: adType,
            amount_total: session.amount_total,
            currency: session.currency || 'usd',
            payment_status: 'completed',
            created_at: new Date().toISOString(),
          }),
        })

        if (!supabaseResponse.ok) {
          console.warn('Supabase payment record failed:', supabaseResponse.statusText)
        } else {
          console.log('Payment recorded in Supabase for session:', session.id)
        }
      }
    } catch (dbError) {
      console.error('Error recording payment in Supabase:', dbError)
    }
  } catch (error) {
    console.error('Error handling checkout completion:', error)
  }
}

async function handleChargeRefunded(charge: any, env: Env): Promise<void> {
  console.log('Charge refunded:', charge.id)

  try {
    // Find the ad purchase by charge ID
    const supabaseUrl = env.SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return
    }

    // Get the invoice associated with the charge to find the session
    const chargeInvoiceId = charge.invoice
    if (!chargeInvoiceId) {
      console.warn('No invoice associated with charge')
      return
    }

    // Query ad_purchases by metadata or amount
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/ad_purchases?amount_total=eq.${charge.amount}&payment_status=eq.completed`,
      {
        method: 'GET',
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    )

    if (!getResponse.ok) {
      console.warn('Failed to fetch ad purchase for refund')
      return
    }

    const purchases = (await getResponse.json()) as any[]
    if (purchases.length === 0) {
      console.warn('No matching ad purchase found for refund')
      return
    }

    const purchase = purchases[0]

    // Update payment status to refunded
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/ad_purchases?id=eq.${purchase.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_status: 'refunded',
          updated_at: new Date().toISOString(),
        }),
      }
    )

    if (!updateResponse.ok) {
      console.warn('Failed to update payment status to refunded')
      return
    }

    // Send refund notification email
    const template = emailTemplates.refundProcessed({
      companyName: purchase.company_name,
      adType: purchase.ad_type,
      amount: purchase.amount_total,
    })

    await sendEmail(purchase.advertiser_email, template, env)
    console.log('Refund notification sent to:', purchase.advertiser_email)
  } catch (error) {
    console.error('Error handling charge refund:', error)
  }
}

async function handleInvoicePaymentSucceeded(invoice: any, env: Env): Promise<void> {
  console.log('Invoice payment succeeded:', invoice.id)

  try {
    const supabaseUrl = env.SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return
    }

    // Get invoice details
    const amount = invoice.amount_paid
    const customerId = invoice.customer
    const customerEmail = invoice.customer_email

    // Update the ad purchase payment status if this is a subscription renewal
    if (customerId && customerEmail) {
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/ad_purchases?stripe_customer_id=eq.${customerId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            payment_status: 'completed',
            updated_at: new Date().toISOString(),
          }),
        }
      )

      if (!updateResponse.ok) {
        console.warn('Failed to update subscription payment status')
      } else {
        console.log('Subscription payment recorded')
      }

      // Send receipt email
      const template = emailTemplates.paymentReceipt({
        amount: amount,
        invoiceId: invoice.id,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toLocaleDateString() : '',
      })

      await sendEmail(customerEmail, template, env)
      console.log('Payment receipt sent to:', customerEmail)
    }
  } catch (error) {
    console.error('Error handling invoice payment success:', error)
  }
}

async function handleInvoicePaymentFailed(invoice: any, env: Env): Promise<void> {
  console.log('Invoice payment failed:', invoice.id)

  try {
    const customerEmail = invoice.customer_email

    if (!customerEmail) {
      console.warn('No customer email found for failed payment')
      return
    }

    // Calculate next retry date (typically 4 days after failure)
    const nextRetryDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString()

    // Send payment failed notification
    const template = emailTemplates.paymentFailed({
      companyName: 'Valued Customer',
      nextRetryDate: nextRetryDate,
    })

    await sendEmail(customerEmail, template, env)
    console.log('Payment failed notification sent to:', customerEmail)
  } catch (error) {
    console.error('Error handling invoice payment failure:', error)
  }
}

async function handleSubscriptionCancelled(subscription: any, env: Env): Promise<void> {
  console.log('Subscription cancelled:', subscription.id)

  try {
    const supabaseUrl = env.SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return
    }

    const customerId = subscription.customer
    const customerEmail = subscription.customer_email || ''

    // Update ad purchases associated with this subscription
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/ad_purchases?stripe_subscription_id=eq.${subscription.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          payment_status: 'cancelled',
          updated_at: new Date().toISOString(),
        }),
      }
    )

    if (!updateResponse.ok) {
      console.warn('Failed to update subscription status')
    }

    // Send cancellation email
    const template = emailTemplates.subscriptionCancelled({
      companyName: 'Valued Customer',
      planName: 'Advertising',
    })

    if (customerEmail) {
      await sendEmail(customerEmail, template, env)
      console.log('Subscription cancellation notification sent to:', customerEmail)
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error)
  }
}

async function handleSubscriptionCreated(subscription: any, env: Env): Promise<void> {
  console.log('Subscription created:', subscription.id)

  try {
    const supabaseUrl = env.SUPABASE_URL
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return
    }

    const customerId = subscription.customer
    const status = subscription.status

    // Update ad purchases with subscription information
    if (customerId) {
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/ad_purchases?stripe_customer_id=eq.${customerId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            stripe_subscription_id: subscription.id,
            payment_status: status === 'active' ? 'completed' : 'pending',
            updated_at: new Date().toISOString(),
          }),
        }
      )

      if (!updateResponse.ok) {
        console.warn('Failed to update ad purchase with subscription')
      } else {
        console.log('Subscription linked to ad purchase')
      }
    }
  } catch (error) {
    console.error('Error handling subscription creation:', error)
  }
}
