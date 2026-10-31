/* CUE-TEMPLATES-2026-10-31: the chaser emails in Kiko's revised templates (Google Doc "BSE Message Templates", IDs from the message
 * map; spec cue-message-redesign-spec.md part 2, approved by Kiko 31 Oct 2026). Cue fills only the blanks; no AI writes these.
 * Kiko 31 Oct (question card): "Full design, in the same thread": each email goes as HTML with the audience banner (cyan for clients,
 * orange for suppliers, magenta for crew) and its plain text beside it, as a reply in the original thread.
 * The banner is a solid colour band with the wordmark and tagline. The designed banner image (diamond and orbit pattern) comes with the
 * Canvas release (part 3), which owns the shared email images. */

const CUE_TPL_LOOK_ = { client: '#559FEF', supplier: '#CD5023', crew: '#B3107C' };
const CUE_TPL_FONT_ = "'Quicksand','DM Sans',Arial,Helvetica,sans-serif";
const CUE_TPL_SIGN_ = { kiko: 'Kiko Dacanay\nBlank Space Events', ar: 'Blank Space Events\nAccounts Receivable', sc: 'Blank Space Events\nSupplier Coordination' };

const cueTplFirst_ = v => { const w = String(v || '').trim().split(/[\s@]+/)[0] || ''; return /^[A-Za-z][A-Za-z'.-]*$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : 'there'; };
const cueTplName_ = v => String(v || '').trim().replace(/@.*$/, '') || 'there';   // suppliers: the name as Canvas or the email has it (often a company)
const cueTplEsc_ = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** "2026-11-03" as "3 November 2026"; any other text unchanged. */
function cueTplDay_(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Number(m[3]) + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m[2]) - 1] + ' ' + m[1] : String(d || '');
}

/** One templated email: { subject, body, html }. paras = the body between "Hi <name>," and the sign-off; blank entries are left out
 * (the template doc's "suppress empty fields"). button = { label, url } or null. */
function cueTplMail_(aud, subject, first, paras, sign, button) {
  const ps = paras.filter(p => String(p || '').trim());
  const body = 'Hi ' + first + ',\n\n' + ps.join('\n\n') + '\n\nThanks!\n' + sign + (button && button.url ? '\n\n' + button.label + ': ' + button.url : '');
  const col = CUE_TPL_LOOK_[aud] || CUE_TPL_LOOK_.client, p = t => '<p style="margin:0 0 14px;font-size:15px;line-height:1.5">' + cueTplEsc_(t).replace(/\n/g, '<br>') + '</p>';
  const html = '<div style="font-family:' + CUE_TPL_FONT_ + ';max-width:560px;margin:0 auto;color:#16151B">'
    + '<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td bgcolor="' + col + '" style="background:' + col + ';padding:18px 24px;border-radius:10px 10px 0 0">'
    + '<span style="font-size:18px;font-weight:bold;letter-spacing:.04em;color:#FFFFFF">BLANK SPACE EVENTS</span>'
    + '<span style="float:right;font-size:11px;color:#FFFFFF;padding-top:5px">Experiences people enjoy together</span></td></tr></table>'
    + '<div style="background:#FFFFFF;border:1px solid #E3DDD0;border-top:0;border-radius:0 0 10px 10px;padding:22px 24px">'
    + p('Hi ' + first + ',') + ps.map(p).join('') + p('Thanks!')
    + (button && button.url ? '<p style="margin:0 0 16px"><a href="' + cueTplEsc_(button.url) + '" style="background:' + col + ';color:#FFFFFF;text-decoration:none;font-weight:bold;padding:11px 22px;border-radius:999px;display:inline-block">' + cueTplEsc_(button.label) + '</a></p>' : '')
    + '<p style="margin:0;font-size:14px;line-height:1.4"><b>' + cueTplEsc_(sign.split('\n')[0]) + '</b><br>' + cueTplEsc_(sign.split('\n').slice(1).join(' ')) + '</p></div></div>';
  return { subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 200), body, html };
}
const cueTplRe_ = (subj, dflt) => { const s = String(subj || dflt || '').trim(); return /^re:/i.test(s) ? s : 'Re: ' + s; };

/** C6 Cost estimate follow-up, and C6 Urgent cost estimate follow-up (event within 7 days). */
function cueTplC6_(it) {
  const f = it.facts || {}, first = cueTplFirst_(it.who), ev = it.project || 'your event', subj = cueTplRe_(it.thread_subject, 'Cost estimate for ' + ev);
  if (f.urgent) return cueTplMail_('client', subj, first, [ev + ' is coming up on ' + cueTplDay_(f.event_date) + '. Could you review the cost estimate and let us know your decision as soon as you can? That will help us line up the next production steps.',
    'If there’s something you’d like to talk through first, reply here—we’re ready to help.'], CUE_TPL_SIGN_.kiko, null);
  return cueTplMail_('client', subj, first, ['Checking in on the cost estimate for ' + ev + (f.ce_sent ? ' we sent on ' + cueTplDay_(f.ce_sent) : '') + '. Your next step is waiting in Canvas—take a look and sign when you’re ready.',
    'Need a change, a clarification or a little more time? Just let us know.'], CUE_TPL_SIGN_.kiko, null);
}
/** S2 Quotation follow-up (one RFP chaser sequence for RFQs and Canvas RFPs). */
function cueTplS2_(it) {
  const f = it.facts || {}, scope = cueStr_(String(f.rfq_subject || '').replace(/^(re|fw|fwd):\s*/i, '').replace(/^(quotation request|rfq|request for (quotation|quote))\s*[|:·-]?\s*/i, '').split('|')[0].trim(), 120) || 'your quotation';
  const ev = it.project && scope.toLowerCase().indexOf(String(it.project).toLowerCase()) < 0 ? ' for ' + it.project : '';
  return cueTplMail_('supplier', cueTplRe_(it.thread_subject, 'Quotation request'), cueTplName_(it.who && it.who !== it.to ? it.who : ''),
    ['Checking in on our request for ' + scope + ev + '. Could you send your itemized quote by ' + (f.reply_by || 'the end of the week') + '? If you’re unable to take this one on, just let us know so we can plan ahead.'],
    CUE_TPL_SIGN_.kiko, null);
}
/** S1 Accreditation follow-up. The first request (S1) moves to Canvas in part 3; until then Cue keeps its own first wording. */
function cueTplS1_(it) {
  const f = it.facts || {};
  return cueTplMail_('supplier', cueTplRe_(it.thread_subject, 'Complete your supplier accreditation | Blank Space Events'), cueTplName_(f.contact_name || f.supplier || it.who),
    ['A quick nudge to complete your supplier accreditation' + (f.project ? ' for ' + f.project : '') + '. We’ll need those details before we can process your payment.',
      'Already sent it? Thanks! Let us know and we’ll check it on our side.'], CUE_TPL_SIGN_.sc, f.form_url ? { label: 'Complete accreditation', url: f.form_url } : null);
}
/** C7 Client payment follow-up. Every BI number and the balance stay in the text (cuePaySays_ checks them). */
function cueTplC7_(it) {
  const f = it.facts || {}, bis = f.bis || [], one = bis.length === 1 ? bis[0] : null;
  const what = one ? 'billing invoice ' + one.no + (one.project ? ' for ' + one.project : '') : 'billing invoices ' + bis.map(b => b.no).join(', ') + (it.project ? ' for ' + it.project : '');
  const lines = one ? 'Amount due: ' + one.balance_text + '\nDue date: ' + one.due : bis.map(b => 'BI ' + b.no + (b.project ? ', ' + b.project : '') + ': ' + b.balance_text + ', due ' + b.due).join('\n') + '\nTotal due: ' + f.total_balance_text;
  return cueTplMail_('client', 'Payment follow-up | ' + bis.map(b => 'BI ' + b.no).join(', ') + (it.project ? ' | ' + it.project : ''), cueTplFirst_(f.contact),
    ['A quick check-in on ' + what + '.', lines, 'Could you share the expected payment date? If you’ve already paid, thank you—please reply with the proof so we can match it to the invoice.'],
    CUE_TPL_SIGN_.ar, null);
}
/** C2 First follow-up (times 0) and C2 Final follow-up (after that): every 3 business days, at most 2, then park. */
function cueTplC2_(it) {
  const f = it.facts || {}, first = cueTplFirst_(f.contact || it.who), co = f.client || it.project || 'your team', subj = it.thread_id ? cueTplRe_(it.thread_subject, f.inquiry || 'Your event') : (f.inquiry || 'Your event') + ' | Blank Space Events';
  if ((it.times || 0) >= 1) return cueTplMail_('client', subj, first, ['I’ll leave the door open for now. When the next event idea comes along at ' + co + ', we’d love to help bring it to life.',
    'Thank you for your time.'], CUE_TPL_SIGN_.kiko, null);
  return cueTplMail_('client', subj, first, ['Picking up my note' + (f.date_sent ? ' from ' + cueTplDay_(f.date_sent) : '') + '—I’d love to hear what ' + co + ' is planning. Would you like a look at our portfolio, or a quick chat to swap ideas?'],
    CUE_TPL_SIGN_.kiko, null);
}
/** C3 Reply follow-through: the AI writes only the middle (the direct answer and the next step); the frame is fixed. */
function cueTplC3_(it, middle) {
  return cueTplMail_('client', cueTplRe_(it.subject, ''), cueTplFirst_(it.who), ['Great to hear from you! ' + String(middle || '').trim(), 'Anything else you’d like us to work into the plan? Just reply here.'], CUE_TPL_SIGN_.kiko, null);
}
