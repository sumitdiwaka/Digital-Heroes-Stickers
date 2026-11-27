const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;
function getTransport() {
  if (transporter) return transporter;
  transporter = env.smtp.host
    ? nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465, auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined })
    : nodemailer.createTransport({ jsonTransport: true }); // dev: no SMTP -> log only
  return transporter;
}

/** Emails recorded in memory (last 50) so the test-suite can verify notifications fired. */
const outbox = [];

async function send({ to, subject, text }) {
  const mail = { from: env.smtp.from, to, subject, text };
  try {
    const info = await getTransport().sendMail(mail);
    outbox.unshift({ to, subject, at: new Date().toISOString() });
    outbox.length = Math.min(outbox.length, 50);
    if (!env.smtp.host && env.nodeEnv !== 'test') console.log(`[email:dev] to=${to} subject="${subject}"`);
    return info;
  } catch (e) {
    console.error('[email] failed (non-fatal):', e.message); // never break the request because of email
  }
}

const orderPaid = (u, o) => send({ to: u.email, subject: `Order ${o.orderNumber} confirmed`, text: `Hi ${u.name},\n\nThanks - we received your payment for order ${o.orderNumber}. We'll prepare your proof shortly.\n\nDigital Heroes` });
const proofReady = (u, o, v) => send({ to: u.email, subject: `Proof v${v} ready for order ${o.orderNumber}`, text: `Hi ${u.name},\n\nProof v${v} for order ${o.orderNumber} is ready. Please approve it or request changes from your dashboard.\n\nDigital Heroes` });
const proofApproved = (u, o, v) => send({ to: u.email, subject: `Proof v${v} approved - ${o.orderNumber}`, text: `Hi ${u.name},\n\nYou approved proof v${v}. Your order is now heading to production.\n\nDigital Heroes` });
const statusChanged = (u, o) => send({ to: u.email, subject: `Order ${o.orderNumber} is now: ${o.status}`, text: `Hi ${u.name},\n\nYour order ${o.orderNumber} moved to "${o.status}".\n\nDigital Heroes` });
const completed = (u, o) => send({ to: u.email, subject: `Order ${o.orderNumber} completed`, text: `Hi ${u.name},\n\nYour order ${o.orderNumber} is complete. Reorder any time in one click from your dashboard.\n\nDigital Heroes` });
const changesRequested = (admins, o, v, note) => Promise.all(admins.map((a) => send({ to: a.email, subject: `Changes requested on ${o.orderNumber} (v${v})`, text: `Customer note: ${note}` })));
const passwordReset = (u, link) => send({ to: u.email, subject: 'Reset your password', text: `Hi ${u.name},\n\nReset link (valid 1 hour): ${link}\n` });

module.exports = { send, outbox, orderPaid, proofReady, proofApproved, statusChanged, completed, changesRequested, passwordReset };
