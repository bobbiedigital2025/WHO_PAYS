const nodemailer = require("nodemailer");

const targetUrl = process.env.HEALTHCHECK_URL || "http://app:4173/health";
const recipient = process.env.ALERT_EMAIL_TO || "admin@bodigicom.com";
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.ALERT_FROM || "who-pays-alerts@localhost";

async function sendAlert(errorMessage) {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP configuration missing: set SMTP_HOST/SMTP_USER/SMTP_PASS");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: fromEmail,
    to: recipient,
    subject: "[WHO_PAYS] Health Alert",
    text: `Health check failed for ${targetUrl}\n\nError: ${errorMessage}\nTime: ${new Date().toISOString()}`,
  });
}

async function run() {
  try {
    const response = await fetch(targetUrl, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`Non-OK status: ${response.status}`);
    }
    const payload = await response.json();
    if (payload.status !== "ok") {
      throw new Error("Unexpected health payload");
    }
    // eslint-disable-next-line no-console
    console.log("Health check passed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`Health check failed: ${message}`);
    await sendAlert(message);
    process.exitCode = 1;
  }
}

run();
