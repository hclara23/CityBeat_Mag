export const emailTemplates = {
  editorNotification: (briefData: {
    title: string
    source: string
    category: string
    content: string
    contentES: string
  }) => ({
    subject: `New Brief Pending Review: ${briefData.title}`,
    html: `
      <h2>New Brief Submitted for Review</h2>
      <p><strong>Title:</strong> ${briefData.title}</p>
      <p><strong>Source:</strong> ${briefData.source}</p>
      <p><strong>Category:</strong> ${briefData.category}</p>
      <hr />
      <h3>English Version</h3>
      <p>${briefData.content}</p>
      <hr />
      <h3>Spanish Version (Translated)</h3>
      <p>${briefData.contentES}</p>
      <hr />
      <p>Review and publish this brief in Sanity Studio: <a href="https://citybeatmag.co/studio">citybeatmag.co/studio</a></p>
    `,
  }),

  adPurchaseConfirmation: (adData: {
    companyName: string
    adType: string
    amount: number
    sessionId: string
  }) => ({
    subject: `Ad Purchase Confirmation - ${adData.adType}`,
    html: `
      <h2>Thank You for Your Purchase!</h2>
      <p>Dear ${adData.companyName},</p>
      <p>Your advertising purchase has been successfully processed.</p>
      <p><strong>Advertisement Type:</strong> ${adData.adType}</p>
      <p><strong>Amount Paid:</strong> $${(adData.amount / 100).toFixed(2)}</p>
      <p><strong>Session ID:</strong> ${adData.sessionId}</p>
      <hr />
      <p>You can view your ad details and track performance at: <a href="https://citybeatmag.co/ads/success?session_id=${adData.sessionId}">citybeatmag.co/ads</a></p>
      <p>If you have any questions, please contact our sales team.</p>
    `,
  }),

  weeklyReport: (stats: {
    totalBriefs: number
    totalReads: number
    topCategory: string
    newSubscribers: number
  }) => ({
    subject: 'Weekly CityBeat Analytics Report',
    html: `
      <h2>Weekly Analytics Report</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Total Briefs Published</strong></td>
          <td style="padding: 8px;">${stats.totalBriefs}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Total Reads</strong></td>
          <td style="padding: 8px;">${stats.totalReads}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Top Category</strong></td>
          <td style="padding: 8px;">${stats.topCategory}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>New Subscribers</strong></td>
          <td style="padding: 8px;">${stats.newSubscribers}</td>
        </tr>
      </table>
    `,
  }),

  refundProcessed: (data: {
    companyName: string
    adType: string
    amount: number
  }) => ({
    subject: 'Refund Processed - CityBeat Magazine',
    html: `
      <h2>Refund Processed</h2>
      <p>Dear ${data.companyName},</p>
      <p>Your refund has been successfully processed.</p>
      <p><strong>Advertisement Type:</strong> ${data.adType}</p>
      <p><strong>Refund Amount:</strong> $${(data.amount / 100).toFixed(2)}</p>
      <p>The refund will appear in your bank account within 5-10 business days.</p>
      <hr />
      <p>If you have any questions, please contact our support team.</p>
    `,
  }),

  paymentReceipt: (data: {
    amount: number
    invoiceId: string
    dueDate: string
  }) => ({
    subject: `Payment Receipt - Invoice ${data.invoiceId}`,
    html: `
      <h2>Payment Receipt</h2>
      <p>Thank you for your payment!</p>
      <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Invoice ID</strong></td>
          <td style="padding: 8px;">${data.invoiceId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Amount Paid</strong></td>
          <td style="padding: 8px;">$${(data.amount / 100).toFixed(2)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;"><strong>Date Paid</strong></td>
          <td style="padding: 8px;">${new Date().toLocaleDateString()}</td>
        </tr>
      </table>
      <p>Your subscription will continue to be active. You can manage your subscription at any time in your account settings.</p>
    `,
  }),

  subscriptionCancelled: (data: {
    companyName: string
    planName: string
  }) => ({
    subject: 'Subscription Cancelled - CityBeat Magazine',
    html: `
      <h2>Subscription Cancelled</h2>
      <p>Dear ${data.companyName},</p>
      <p>Your ${data.planName} subscription has been successfully cancelled.</p>
      <p>You will have access to your account until the end of your current billing period.</p>
      <hr />
      <p>We'd love to have you back anytime. If you have any feedback about your experience, please let us know.</p>
    `,
  }),

  paymentFailed: (data: {
    companyName: string
    nextRetryDate: string
  }) => ({
    subject: 'Payment Failed - Action Required',
    html: `
      <h2>Payment Failed</h2>
      <p>Dear ${data.companyName},</p>
      <p>We were unable to process your payment. Your subscription may be at risk if payment is not received.</p>
      <p><strong>Next Retry Date:</strong> ${data.nextRetryDate}</p>
      <p>Please update your payment method in your account settings to avoid service interruption.</p>
      <p><a href="https://citybeatmag.co/ads/orders" style="background-color: #00f0ff; color: black; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Update Payment Method</a></p>
    `,
  }),
}

export async function sendEmail(
  recipient: string,
  template: { subject: string; html: string },
  env: any
): Promise<Response> {
  const resendApiKey = env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
    })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@citybeatmag.co',
        to: recipient,
        subject: template.subject,
        html: template.html,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Resend API error:', error)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
      })
    }

    return response
  } catch (error) {
    console.error('Email sending error:', error)
    return new Response(JSON.stringify({ error: 'Email service error' }), {
      status: 500,
    })
  }
}
