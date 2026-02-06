var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-899U39/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../../node_modules/itty-router/index.mjs
var t = /* @__PURE__ */ __name(({ base: e = "", routes: t2 = [], ...r2 } = {}) => ({ __proto__: new Proxy({}, { get: (r3, o2, a, s) => (r4, ...c) => t2.push([o2.toUpperCase?.(), RegExp(`^${(s = (e + r4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), c, s]) && a }), routes: t2, ...r2, async fetch(e2, ...o2) {
  let a, s, c = new URL(e2.url), n = e2.query = { __proto__: null };
  for (let [e3, t3] of c.searchParams)
    n[e3] = n[e3] ? [].concat(n[e3], t3) : t3;
  e:
    try {
      for (let t3 of r2.before || [])
        if (null != (a = await t3(e2.proxy ?? e2, ...o2)))
          break e;
      t:
        for (let [r3, n2, l, i] of t2)
          if ((r3 == e2.method || "ALL" == r3) && (s = c.pathname.match(n2))) {
            e2.params = s.groups || {}, e2.route = i;
            for (let t3 of l)
              if (null != (a = await t3(e2.proxy ?? e2, ...o2)))
                break t;
          }
    } catch (t3) {
      if (!r2.catch)
        throw t3;
      a = await r2.catch(t3, e2.proxy ?? e2, ...o2);
    }
  try {
    for (let t3 of r2.finally || [])
      a = await t3(a, e2.proxy ?? e2, ...o2) ?? a;
  } catch (t3) {
    if (!r2.catch)
      throw t3;
    a = await r2.catch(t3, e2.proxy ?? e2, ...o2);
  }
  return a;
} }), "t");
var r = /* @__PURE__ */ __name((e = "text/plain; charset=utf-8", t2) => (r2, o2 = {}) => {
  if (void 0 === r2 || r2 instanceof Response)
    return r2;
  const a = new Response(t2?.(r2) ?? r2, o2.url ? void 0 : o2);
  return a.headers.set("content-type", e), a;
}, "r");
var o = r("application/json; charset=utf-8", JSON.stringify);
var p = r("text/plain; charset=utf-8", String);
var f = r("text/html");
var u = r("image/jpeg");
var h = r("image/png");
var g = r("image/webp");

// src/handlers/emails.ts
var emailTemplates = {
  editorNotification: (briefData) => ({
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
      <p>Review and publish this brief in Sanity Studio: <a href="https://studio.citybeatmag.co">studio.citybeatmag.co</a></p>
    `
  }),
  adPurchaseConfirmation: (adData) => ({
    subject: `Ad Purchase Confirmation - ${adData.adType}`,
    html: `
      <h2>Thank You for Your Purchase!</h2>
      <p>Dear ${adData.companyName},</p>
      <p>Your advertising purchase has been successfully processed.</p>
      <p><strong>Advertisement Type:</strong> ${adData.adType}</p>
      <p><strong>Amount Paid:</strong> $${(adData.amount / 100).toFixed(2)}</p>
      <p><strong>Session ID:</strong> ${adData.sessionId}</p>
      <hr />
      <p>You can view your ad details and track performance at: <a href="https://ads.citybeatmag.co/success?session_id=${adData.sessionId}">ads.citybeatmag.co</a></p>
      <p>If you have any questions, please contact our sales team.</p>
    `
  }),
  weeklyReport: (stats) => ({
    subject: "Weekly CityBeat Analytics Report",
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
    `
  }),
  refundProcessed: (data) => ({
    subject: "Refund Processed - CityBeat Magazine",
    html: `
      <h2>Refund Processed</h2>
      <p>Dear ${data.companyName},</p>
      <p>Your refund has been successfully processed.</p>
      <p><strong>Advertisement Type:</strong> ${data.adType}</p>
      <p><strong>Refund Amount:</strong> $${(data.amount / 100).toFixed(2)}</p>
      <p>The refund will appear in your bank account within 5-10 business days.</p>
      <hr />
      <p>If you have any questions, please contact our support team.</p>
    `
  }),
  paymentReceipt: (data) => ({
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
          <td style="padding: 8px;">${(/* @__PURE__ */ new Date()).toLocaleDateString()}</td>
        </tr>
      </table>
      <p>Your subscription will continue to be active. You can manage your subscription at any time in your account settings.</p>
    `
  }),
  subscriptionCancelled: (data) => ({
    subject: "Subscription Cancelled - CityBeat Magazine",
    html: `
      <h2>Subscription Cancelled</h2>
      <p>Dear ${data.companyName},</p>
      <p>Your ${data.planName} subscription has been successfully cancelled.</p>
      <p>You will have access to your account until the end of your current billing period.</p>
      <hr />
      <p>We'd love to have you back anytime. If you have any feedback about your experience, please let us know.</p>
    `
  }),
  paymentFailed: (data) => ({
    subject: "Payment Failed - Action Required",
    html: `
      <h2>Payment Failed</h2>
      <p>Dear ${data.companyName},</p>
      <p>We were unable to process your payment. Your subscription may be at risk if payment is not received.</p>
      <p><strong>Next Retry Date:</strong> ${data.nextRetryDate}</p>
      <p>Please update your payment method in your account settings to avoid service interruption.</p>
      <p><a href="https://ads.citybeatmag.co/billing" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Update Payment Method</a></p>
    `
  })
};
async function sendEmail(recipient, template, env) {
  const resendApiKey = env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Email service not configured" }), {
      status: 500
    });
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "noreply@citybeatmag.co",
        to: recipient,
        subject: template.subject,
        html: template.html
      })
    });
    if (!response.ok) {
      const error = await response.json();
      console.error("Resend API error:", error);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500
      });
    }
    return response;
  } catch (error) {
    console.error("Email sending error:", error);
    return new Response(JSON.stringify({ error: "Email service error" }), {
      status: 500
    });
  }
}
__name(sendEmail, "sendEmail");

// src/handlers/automation.ts
async function handleBriefAutomation(env) {
  console.log("Starting brief automation...");
  try {
    const briefs = await fetchBriefs(env);
    for (const brief of briefs) {
      const translated = await translateBrief(brief, env);
      await saveBriefToSanity(translated, env);
      await notifyEditor(translated, env);
    }
    console.log(`Processed ${briefs.length} briefs`);
  } catch (error) {
    console.error("Brief automation failed:", error);
  }
}
__name(handleBriefAutomation, "handleBriefAutomation");
async function fetchBriefs(env) {
  const briefs = [];
  try {
    console.log("Fetching briefs from configured sources...");
    const newsApiKey = env.NEWS_API_KEY;
    if (newsApiKey) {
      const keywords = [
        "El Paso",
        "Ciudad Ju\xE1rez",
        "border news",
        "New Mexico",
        "Las Cruces"
      ];
      for (const keyword of keywords) {
        try {
          const response = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&sortBy=publishedAt&language=en&pageSize=5`,
            {
              headers: {
                "X-API-Key": newsApiKey
              }
            }
          );
          if (!response.ok) {
            console.warn(`NewsAPI error for keyword "${keyword}": ${response.statusText}`);
            continue;
          }
          const data = await response.json();
          if (data.articles) {
            for (const article of data.articles) {
              briefs.push({
                title: article.title,
                content: article.description || article.content || "",
                source: article.source.name,
                category: categorizeArticle(article.title, article.description)
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching from NewsAPI for keyword "${keyword}":`, error);
        }
      }
    }
    const rssSources = [
      { url: "https://www.elpasotimes.com/feed/", name: "El Paso Times" },
      { url: "https://www.abc-7.com/rss", name: "ABC 7 News" },
      { url: "https://www.kvia.com/rss", name: "KVIA News" }
    ];
    for (const source of rssSources) {
      try {
        console.log(`Fetching from RSS: ${source.name}`);
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
      }
    }
    console.log(`Fetched ${briefs.length} briefs from sources`);
  } catch (error) {
    console.error("Failed to fetch briefs:", error);
  }
  return briefs;
}
__name(fetchBriefs, "fetchBriefs");
function categorizeArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("business") || text.includes("company") || text.includes("economy") || text.includes("job") || text.includes("employment")) {
    return "business";
  }
  if (text.includes("event") || text.includes("concert") || text.includes("festival") || text.includes("conference")) {
    return "events";
  }
  if (text.includes("culture") || text.includes("art") || text.includes("museum") || text.includes("performance") || text.includes("artist")) {
    return "culture";
  }
  return "news";
}
__name(categorizeArticle, "categorizeArticle");
async function translateBrief(brief, env) {
  try {
    const response = await fetch("https://api-free.deepl.com/v1/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: brief.content,
        source_lang: "EN",
        target_lang: "ES"
      })
    });
    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.statusText}`);
    }
    const result = await response.json();
    const translatedContent = result.translations[0]?.text || "";
    return {
      ...brief,
      contentEN: brief.content,
      contentES: translatedContent
    };
  } catch (error) {
    console.error("Translation failed:", error);
    return brief;
  }
}
__name(translateBrief, "translateBrief");
async function saveBriefToSanity(brief, env) {
  try {
    const sanityUrl = `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2021-06-07/data/mutate/${env.SANITY_DATASET}`;
    const mutation = {
      mutations: [
        {
          create: {
            _type: "brief",
            title: brief.title,
            content: brief.content,
            contentEN: brief.contentEN,
            contentES: brief.contentES,
            category: brief.category,
            status: "draft",
            source: brief.source,
            publishedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      ]
    };
    const response = await fetch(sanityUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SANITY_WRITE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(mutation)
    });
    if (!response.ok) {
      throw new Error(`Sanity API error: ${response.statusText}`);
    }
    const result = await response.json();
    const sanityId = result.results?.[0]?.id;
    if (sanityId && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      await saveBriefToSupabase(
        {
          ...brief,
          sanity_id: sanityId
        },
        env
      );
    }
    console.log("Brief saved to Sanity:", sanityId);
  } catch (error) {
    console.error("Failed to save brief to Sanity:", error);
  }
}
__name(saveBriefToSanity, "saveBriefToSanity");
async function saveBriefToSupabase(brief, env) {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/briefs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        sanity_id: brief.sanity_id,
        title: brief.title,
        content_en: brief.contentEN,
        content_es: brief.contentES,
        category: brief.category,
        source: brief.source,
        published_at: (/* @__PURE__ */ new Date()).toISOString(),
        status: "draft"
      })
    });
    if (!response.ok && response.status !== 201) {
      console.warn(`Supabase insert warning: ${response.statusText}`);
    } else {
      console.log("Brief saved to Supabase");
    }
  } catch (error) {
    console.error("Failed to save brief to Supabase:", error);
  }
}
__name(saveBriefToSupabase, "saveBriefToSupabase");
async function notifyEditor(brief, env) {
  try {
    const briefData = {
      title: brief.title,
      source: brief.source,
      category: brief.category,
      content: brief.contentEN || brief.content || "",
      contentES: brief.contentES || ""
    };
    const template = emailTemplates.editorNotification(briefData);
    const response = await sendEmail("editors@citybeatmag.co", template, env);
    if (!response.ok) {
      console.warn("Editor notification email failed:", response.statusText);
    } else {
      console.log("Editor notification email sent successfully");
    }
  } catch (error) {
    console.error("Failed to notify editor:", error);
  }
}
__name(notifyEditor, "notifyEditor");

// src/handlers/stripe.ts
async function handleStripeWebhook(request, env) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Signature missing", { status: 400 });
    }
    const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!isValid) {
      return new Response("Signature invalid", { status: 401 });
    }
    const event = JSON.parse(body);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await handleCheckoutCompleted(session, env);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        await handleChargeRefunded(charge, env);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        await handleInvoicePaymentSucceeded(invoice, env);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await handleInvoicePaymentFailed(invoice, env);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await handleSubscriptionCancelled(subscription, env);
        break;
      }
      case "customer.subscription.created": {
        const subscription = event.data.object;
        await handleSubscriptionCreated(subscription, env);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook error", { status: 500 });
  }
}
__name(handleStripeWebhook, "handleStripeWebhook");
async function verifyStripeSignature(body, signature, secret) {
  try {
    const [timestamp, hash] = signature.split(",").reduce((acc, part) => {
      const [key2, value] = part.split("=");
      acc[key2 === "t" ? 0 : 1] = value;
      return acc;
    }, []);
    if (!timestamp || !hash) {
      return false;
    }
    const signedContent = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature_bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
    const computed_hash = Array.from(new Uint8Array(signature_bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return computed_hash === hash;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
__name(verifyStripeSignature, "verifyStripeSignature");
async function handleCheckoutCompleted(session, env) {
  console.log("Checkout completed:", session.id);
  try {
    const advertiserEmail = session.customer_email || session.customer_details?.email;
    if (!advertiserEmail) {
      console.warn("No advertiser email found in session");
      return;
    }
    const metadata = session.metadata || {};
    const companyName = metadata.companyName || "Valued Customer";
    const contactName = metadata.contactName || "";
    const phone = metadata.phone || "";
    const website = metadata.website || "";
    const adType = metadata.adType || "advertisement";
    const adData = {
      companyName,
      adType,
      amount: session.amount_total || 0,
      sessionId: session.id
    };
    const template = emailTemplates.adPurchaseConfirmation(adData);
    const emailResponse = await sendEmail(advertiserEmail, template, env);
    if (!emailResponse.ok) {
      console.warn("Ad purchase confirmation email failed:", emailResponse.statusText);
    } else {
      console.log("Ad purchase confirmation email sent to:", advertiserEmail);
    }
    try {
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/ad_purchases`, {
          method: "POST",
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
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
            currency: session.currency || "usd",
            payment_status: "completed",
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          })
        });
        if (!supabaseResponse.ok) {
          console.warn("Supabase payment record failed:", supabaseResponse.statusText);
        } else {
          console.log("Payment recorded in Supabase for session:", session.id);
        }
      }
    } catch (dbError) {
      console.error("Error recording payment in Supabase:", dbError);
    }
  } catch (error) {
    console.error("Error handling checkout completion:", error);
  }
}
__name(handleCheckoutCompleted, "handleCheckoutCompleted");
async function handleChargeRefunded(charge, env) {
  console.log("Charge refunded:", charge.id);
  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase configuration missing");
      return;
    }
    const chargeInvoiceId = charge.invoice;
    if (!chargeInvoiceId) {
      console.warn("No invoice associated with charge");
      return;
    }
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/ad_purchases?amount_total=eq.${charge.amount}&payment_status=eq.completed`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`
        }
      }
    );
    if (!getResponse.ok) {
      console.warn("Failed to fetch ad purchase for refund");
      return;
    }
    const purchases = await getResponse.json();
    if (purchases.length === 0) {
      console.warn("No matching ad purchase found for refund");
      return;
    }
    const purchase = purchases[0];
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/ad_purchases?id=eq.${purchase.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          payment_status: "refunded",
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        })
      }
    );
    if (!updateResponse.ok) {
      console.warn("Failed to update payment status to refunded");
      return;
    }
    const template = emailTemplates.refundProcessed({
      companyName: purchase.company_name,
      adType: purchase.ad_type,
      amount: purchase.amount_total
    });
    await sendEmail(purchase.advertiser_email, template, env);
    console.log("Refund notification sent to:", purchase.advertiser_email);
  } catch (error) {
    console.error("Error handling charge refund:", error);
  }
}
__name(handleChargeRefunded, "handleChargeRefunded");
async function handleInvoicePaymentSucceeded(invoice, env) {
  console.log("Invoice payment succeeded:", invoice.id);
  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase configuration missing");
      return;
    }
    const amount = invoice.amount_paid;
    const customerId = invoice.customer;
    const customerEmail = invoice.customer_email;
    if (customerId && customerEmail) {
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/ad_purchases?stripe_customer_id=eq.${customerId}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            payment_status: "completed",
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          })
        }
      );
      if (!updateResponse.ok) {
        console.warn("Failed to update subscription payment status");
      } else {
        console.log("Subscription payment recorded");
      }
      const template = emailTemplates.paymentReceipt({
        amount,
        invoiceId: invoice.id,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1e3).toLocaleDateString() : ""
      });
      await sendEmail(customerEmail, template, env);
      console.log("Payment receipt sent to:", customerEmail);
    }
  } catch (error) {
    console.error("Error handling invoice payment success:", error);
  }
}
__name(handleInvoicePaymentSucceeded, "handleInvoicePaymentSucceeded");
async function handleInvoicePaymentFailed(invoice, env) {
  console.log("Invoice payment failed:", invoice.id);
  try {
    const customerEmail = invoice.customer_email;
    if (!customerEmail) {
      console.warn("No customer email found for failed payment");
      return;
    }
    const nextRetryDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1e3).toLocaleDateString();
    const template = emailTemplates.paymentFailed({
      companyName: "Valued Customer",
      nextRetryDate
    });
    await sendEmail(customerEmail, template, env);
    console.log("Payment failed notification sent to:", customerEmail);
  } catch (error) {
    console.error("Error handling invoice payment failure:", error);
  }
}
__name(handleInvoicePaymentFailed, "handleInvoicePaymentFailed");
async function handleSubscriptionCancelled(subscription, env) {
  console.log("Subscription cancelled:", subscription.id);
  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase configuration missing");
      return;
    }
    const customerId = subscription.customer;
    const customerEmail = subscription.customer_email || "";
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/ad_purchases?stripe_subscription_id=eq.${subscription.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          payment_status: "cancelled",
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        })
      }
    );
    if (!updateResponse.ok) {
      console.warn("Failed to update subscription status");
    }
    const template = emailTemplates.subscriptionCancelled({
      companyName: "Valued Customer",
      planName: "Advertising"
    });
    if (customerEmail) {
      await sendEmail(customerEmail, template, env);
      console.log("Subscription cancellation notification sent to:", customerEmail);
    }
  } catch (error) {
    console.error("Error handling subscription cancellation:", error);
  }
}
__name(handleSubscriptionCancelled, "handleSubscriptionCancelled");
async function handleSubscriptionCreated(subscription, env) {
  console.log("Subscription created:", subscription.id);
  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase configuration missing");
      return;
    }
    const customerId = subscription.customer;
    const status = subscription.status;
    if (customerId) {
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/ad_purchases?stripe_customer_id=eq.${customerId}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            stripe_subscription_id: subscription.id,
            payment_status: status === "active" ? "completed" : "pending",
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          })
        }
      );
      if (!updateResponse.ok) {
        console.warn("Failed to update ad purchase with subscription");
      } else {
        console.log("Subscription linked to ad purchase");
      }
    }
  } catch (error) {
    console.error("Error handling subscription creation:", error);
  }
}
__name(handleSubscriptionCreated, "handleSubscriptionCreated");

// src/handlers/tracking.ts
async function handleTracking(request, env) {
  try {
    const event = await request.json();
    await logEvent(event, env);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Tracking error:", error);
    return new Response(JSON.stringify({ error: "Tracking failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleTracking, "handleTracking");
async function logEvent(event, env) {
  console.log("Event tracked:", event.event, event.properties);
}
__name(logEvent, "logEvent");

// src/index.ts
var router = t();
router.get("/health", () => new Response("OK"));
router.post("/webhooks/stripe", async (request, env) => {
  return handleStripeWebhook(request, env);
});
router.post("/api/tracking", async (request, env) => {
  return handleTracking(request, env);
});
router.post("/api/test-automation", async (request, env) => {
  try {
    console.log("Manual automation test triggered");
    await handleBriefAutomation(env);
    return new Response(JSON.stringify({ status: "ok", message: "Automation completed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Automation test failed:", error);
    return new Response(JSON.stringify({ status: "error", message: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
var src_default = {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleBriefAutomation(env));
  }
};

// ../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-899U39/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-899U39/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
