import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const senderEmail = Deno.env.get("RESEND_SENDER_EMAIL") || "onboarding@resend.dev";

// Helper function to email diagnostic reports
async function reportErrorEmail(message: string, stack: string, payload: string) {
  if (!resendApiKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: senderEmail,
        to: "kenjamayorof@gmail.com",
        subject: "SmartFarm Edge Function Error Report",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #f87171; border-radius: 8px;">
            <h3 style="color: #dc2626;">SmartFarm Edge Function Error</h3>
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>Location/Stack:</strong></p>
            <pre style="background: #f1f5f9; padding: 10px; border-radius: 4px;">${stack}</pre>
            <p><strong>Incoming Payload:</strong></p>
            <pre style="background: #f1f5f9; padding: 10px; border-radius: 4px; overflow-x: auto;">${payload}</pre>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error("Failed to send error report email:", e);
  }
}

// Helper function to return a formatted error payload to Supabase Auth Hooks
async function returnHookError(message: string, status: number, payload: string = "") {
  console.error(`Hook Error [${status}]:`, message);
  await reportErrorEmail(message, new Error().stack || "", payload);
  return new Response(
    JSON.stringify({
      error: {
        http_code: status,
        message: message,
      },
    }),
    {
      status: status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

Deno.serve(async (req) => {
  console.log("Send email hook triggered");

  if (req.method !== "POST") {
    return await returnHookError("Method not allowed", 405);
  }

  if (!resendApiKey) {
    return await returnHookError("Server misconfiguration: RESEND_API_KEY is not set", 500);
  }

  const payloadText = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  console.log("Payload received:", payloadText);

  // Verify signature if the hook secret is configured
  if (hookSecret) {
    console.log("Verifying signature...");
    const wh = new Webhook(hookSecret);
    try {
      wh.verify(payloadText, headers);
      console.log("Signature verified successfully.");
    } catch (err: any) {
      return await returnHookError(`Signature verification failed: ${err.message}`, 400, payloadText);
    }
  } else {
    console.log("Signature verification skipped (SEND_EMAIL_HOOK_SECRET not set).");
  }

  try {
    const evt = JSON.parse(payloadText);

    // Resolve email address from the user object
    const email = evt.user?.email || evt.email;
    if (!email) {
      return await returnHookError("No recipient email address found in user metadata", 400, payloadText);
    }

    // Extract email_data object
    const emailData = evt.email_data || {};

    // Resolve action type
    const actionType = emailData.email_action_type || evt.email_action_type || evt.type || "recovery";

    // Resolve token, tokenHash, and redirects
    const token = emailData.token;
    const tokenHash = emailData.token_hash;
    const redirectTo = emailData.redirect_to || evt.redirect_to || "";
    const siteUrl = emailData.site_url || "https://iwbxmjysivjudhmgbrsc.supabase.co/auth/v1";

    // Build link if not directly provided in event
    let link = evt.link;
    if (!link && tokenHash) {
      // Build standard verify URL using siteUrl (GoTrue base path)
      link = `${siteUrl}/verify?token=${tokenHash}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`;
    }

    if (!link) {
      return await returnHookError("Could not resolve verification link from hook payload", 400, payloadText);
    }

    // Build template based on type
    let subject = "SmartFarm Raktárkezelő";
    let htmlBody = "";
    let textBody = "";

    if (actionType.includes("recovery")) {
      subject = "SmartFarm - Jelszó visszaállítása";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #006837; margin-bottom: 20px;">SmartFarm Raktárkezelő</h2>
          <p>Üdvözöljük!</p>
          <p>A jelszó-visszaállítás kezdeményezéséhez kérjük, kattintson az alábbi gombra:</p>
          <p style="margin: 30px 0;">
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #006837; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">Jelszó visszaállítása</a>
          </p>
          <p style="color: #64748b; font-size: 13px;">Ha a gomb nem működik, másolja be az alábbi linket a böngészőjébe:</p>
          <p style="word-break: break-all; color: #006837; font-size: 13px;">${link}</p>
          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Ha nem Ön kezdeményezte ezt a visszaállítást, nyugodtan törölheti ezt a levelet.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">Üdvözlettel,<br><strong>SmartFarm Csapat</strong></p>
        </div>
      `;
      textBody = `SmartFarm Raktárkezelő\n\nJelszó visszaállításához kattintson az alábbi linkre:\n${link}\n\nHa nem Ön kezdeményezte, kérjük hagyja figyelmen kívül.`;
    } else if (actionType.includes("signup")) {
      subject = "SmartFarm - Fiók megerősítése";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #006837; margin-bottom: 20px;">SmartFarm Raktárkezelő</h2>
          <p>Köszönjük, hogy regisztrált a SmartFarm rendszerébe!</p>
          <p>A regisztrációja megerősítéséhez és a fiókja aktiválásához kérjük, kattintson az alábbi gombra:</p>
          <p style="margin: 30px 0;">
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #006837; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">Regisztráció megerősítése</a>
          </p>
          <p style="color: #64748b; font-size: 13px;">Ha a gomb nem működik, másolja be az alábbi linket a böngészőjébe:</p>
          <p style="word-break: break-all; color: #006837; font-size: 13px;">${link}</p>
          <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;" />
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">Üdvözlettel,<br><strong>SmartFarm Csapat</strong></p>
        </div>
      `;
      textBody = `SmartFarm Raktárkezelő\n\nKöszönjük a regisztrációt. A fiók megerősítéséhez kattintson ide:\n${link}`;
    } else {
      subject = "SmartFarm - Megerősítés";
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #006837; margin-bottom: 20px;">SmartFarm Raktárkezelő</h2>
          <p>Kérjük, kattintson az alábbi linkre a művelet megerősítéséhez:</p>
          <p style="margin: 30px 0; word-break: break-all;">
            <a href="${link}" style="color: #006837; font-weight: bold;">${link}</a>
          </p>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">Üdvözlettel,<br><strong>SmartFarm Csapat</strong></p>
        </div>
      `;
      textBody = `SmartFarm Raktárkezelő\n\nMegerősítéshez kattintson ide:\n${link}`;
    }

    console.log(`Sending email to: ${email}, Sender: ${senderEmail}, Subject: ${subject}`);

    // Call Resend REST API natively
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: senderEmail,
        to: email,
        subject: subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    // Safeguard res.json() call to prevent JSON parsing crashes
    let resData: any = {};
    try {
      resData = await res.json();
    } catch (_) {
      resData = { message: await res.text() };
    }

    if (!res.ok) {
      const errMsg = resData.message || "Failed to send email via Resend API";
      return await returnHookError(`Resend API Error: ${errMsg}`, 500, payloadText);
    }

    console.log("Email sent successfully through Resend:", resData);

    // Return empty JSON with Content-Type header to signal success to Supabase Auth Hook
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return await returnHookError(`Unexpected server error: ${err.message}`, 500, payloadText);
  }
});
