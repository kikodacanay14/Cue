/* CUE-MT-2026-11-03: Cue Admin › Templates (spec message-templates-from-doc.md, CanvasWorkspace #391, approved by Kiko 1 Nov 2026,
 * "yeah i made it": the page is his design; mockup docs/mockups/message-templates/ and https://claude.ai/artifact/192L3b8mU1iHqBMsnxw3YN).
 * Kiko 1 Nov: "we want it there so we can be sure that its actually being used. we want it there so that if we want to edit them we can
 * easily do so"; "Filter who receives it and theres a list of communications on the right. once clicked on the type of comms - theres a
 * template viewer on the right that allows editing. would also show there inbox that sends it and files attached to the email. Note that
 * we have placed Codes in those templates based on the stakeholder experience journey".
 *
 * The doc "BSE Message Templates Revised" is the only source of the words. Canvas reads it (one reader, one renderer) and Cue gets it
 * through the signed bridge: message_templates (every template, the doc version, each one's last send), message_render (one template
 * built, banner included) and message_template_save (Save writes the edited subject and words back into the doc; Kiko 3 Nov 2026,
 * decision card: "Give info@ Editor on the doc"). Cue keeps no copy of any wording. The sending inbox, CC and attachments are shown,
 * not edited: Canvas keeps them with Canvas Admin › Mailboxes, which is not built yet.
 *
 * CUE_MT_MAP_ holds what the doc does not: each message's journey step, who sends it, the sending inbox and CC, its fixed attachments
 * and its status, exactly as Kiko's approved mockup lists them (1 Nov 2026; "Cue 1.27.92" shows as In use now that it is live, and the
 * team drafts carry the T codes Kiko gave them: T1 Approval needed to T6 Announcement). Where Canvas returns a value for one of these
 * (Canvas Admin › Mailboxes owns the sending inbox per template), Canvas's value wins. A template with a send in Canvas's Template
 * Sends log shows In use: the log is the proof the template is used (spec item 6).
 * Rows: [code, channel, name, journey step, sent by, status, sends from, CC, attachments]. */
const CUE_MT_MAP_ = [
  ["C1A","Email","Bid clarification","1 Find","Cue","Not built","Kiko's Gmail (kikodacanay@)","",[]],
  ["C1B","Email","Reconnect after a past RFP","1 Find","Cue (draft only)","Not built","Kiko's Gmail (kikodacanay@)","",[]],
  ["C1B","Email","Optional reconnection follow-up","1 Find","Cue (draft only)","Not built","Kiko's Gmail (kikodacanay@)","",[]],
  ["C2","Email","Introduction","2 Win","Kiko, by hand","Sent by hand","Kiko's Gmail (kikodacanay@)","",["BSE Portfolio.pdf"]],
  ["C2","Email","First follow-up","2 Win","Cue","In use","Kiko's Gmail (kikodacanay@)","",["BSE Portfolio.pdf (first email only)"]],
  ["C2","Email","Final follow-up","2 Win","Cue","In use","Kiko's Gmail (kikodacanay@)","",["BSE Portfolio.pdf (first email only)"]],
  ["C3","Email","Reply follow-through","2 Win","Cue","In use","Kiko's Gmail (kikodacanay@)","",[]],
  ["C4","Email","Accreditation submission","2 Win","Kiko, by hand","Sent by hand","Kiko's Gmail (kikodacanay@)","",["{{attached_document_list}}"]],
  ["C4","Email","Accreditation status follow-up","2 Win","Cue","Not built","Kiko's Gmail (kikodacanay@)","",[]],
  ["C5","Email","Introduction within an accredited company","2 Win","Cue","Not built","Kiko's Gmail (kikodacanay@)","",[]],
  ["C6","Email","Cost estimate ready","3 Propose","Cue","Old wording","Kiko's Gmail (kikodacanay@)","",["Cost estimate PDF"]],
  ["C6","Email","Cost estimate follow-up","3 Propose","Cue","In use","Kiko's Gmail (kikodacanay@)","",[]],
  ["C6","Email","Urgent cost estimate follow-up","3 Propose","Cue","In use","Kiko's Gmail (kikodacanay@)","",[]],
  ["C7","Email","Client payment follow-up","4 Collect","Canvas, from Cue","In use","info@blankspaceevent.com","Kiko",[]],
  ["C8","Email","Friday event update","5 Deliver","Cue","Old wording","Kiko's Gmail (kikodacanay@)","",[]],
  ["S1","Email","Supplier accreditation request","1 Onboard","Canvas","Old wording","info@blankspaceevent.com (Supplier Coordination)","",[]],
  ["S1","Email","Accreditation follow-up","1 Onboard","Cue","In use","Kiko's Gmail (kikodacanay@)","suppliers@",[]],
  ["S2","Email","Request for proposal","2 Quote","Cue","In use","Kiko's Gmail (kikodacanay@)","AccountsPayables@",["Scope files picked in Send RFP"]],
  ["S2","Email","Quotation follow-up","2 Quote","Cue","In use","Kiko's Gmail (kikodacanay@)","AccountsPayables@",["Scope files picked in Send RFP"]],
  ["S3","Email","Notice of award","3 Award","Not sent today","Not built","Kiko's Gmail (kikodacanay@)","",[]],
  ["S4","Email","Installment payment notice","4 Pay","Canvas","Old wording","AccountsPayables@blankspaceevent.com (Accounts Payable)","",["Acknowledgement Receipt PDF (when ready)"]],
  ["S4","Email","Final installment payment notice","4 Pay","Canvas","Old wording","AccountsPayables@blankspaceevent.com (Accounts Payable)","",["Acknowledgement Receipt PDF (when ready)"]],
  ["S4","Email","Aggregated payment notice","4 Pay","Canvas","Old wording","AccountsPayables@blankspaceevent.com (Accounts Payable)","",["Acknowledgement Receipt PDF (when ready)"]],
  ["S4","Email","Single payment notice","4 Pay","Canvas","Old wording","AccountsPayables@blankspaceevent.com (Accounts Payable)","",["Acknowledgement Receipt PDF (when ready)"]],
  ["S5","Email","Supplier final event reminder","5 Event day","Canvas","Old wording","info@blankspaceevent.com","",["Program flow","Ingress schedule","Gate passes, permits, maps or briefs you pick"]],
  ["S6","Email","Supplier invoice request","6 Close out","Canvas","Old wording","AccountsPayables@blankspaceevent.com","",[]],
  ["S6","Email","Invoice follow-up","6 Close out","Canvas","Not built","AccountsPayables@blankspaceevent.com","",[]],
  ["S7","Email","Supplier acknowledgement receipt","6 Close out","Canvas","Old wording","AccountsPayables@blankspaceevent.com","",["Acknowledgement Receipt PDF"]],
  ["S7","Email","Supplier receipt follow-up","6 Close out","Canvas","Not built","AccountsPayables@blankspaceevent.com","",[]],
  ["R1","Email","Welcome to Canvas","1 Join","Canvas","Old wording","Canvas no-reply (Blank Space Events · Canvas)","",[]],
  ["R2","Email","Crew role assignment","2 Assign","Canvas","Old wording","Canvas no-reply (Canvas)","",[]],
  ["R3","Email","Item assigned","2 Assign","Canvas","Old wording","Canvas no-reply (Canvas)","",[]],
  ["R5","Email","Freelancer service agreement","3 Sign","Canvas","Old wording","info@blankspaceevent.com (Freelancer Coordination)","",["Freelancer Service Agreement PDF"]],
  ["R5","Email","Service agreement follow-up","3 Sign","Cue, through Canvas","Old wording","info@blankspaceevent.com","",[]],
  ["R6","Email","Crew acknowledgement receipt","3 Sign","Canvas","Old wording","info@blankspaceevent.com (Freelancer Coordination)","",["Acknowledgement Receipt PDF"]],
  ["R6","Email","Crew receipt follow-up","3 Sign","Cue, through Canvas","Old wording","info@blankspaceevent.com","",[]],
  ["R7","Email","Liquidation request","4 Liquidate","Canvas","Not built","AccountsPayables@blankspaceevent.com","",[]],
  ["R7","Email","Liquidation follow-up","4 Liquidate","Canvas","Not built","AccountsPayables@blankspaceevent.com","",[]],
  ["R8","Email","Crew final event reminder","5 Event day","Canvas","Old wording","info@blankspaceevent.com","",["Event documents you pick (listed in the email)"]],
  ["C1C","Social","LinkedIn connection note","1 Find","Kiko, by hand","Sent by hand","LinkedIn / Facebook","",[]],
  ["C1C","Social","After a connection is accepted","1 Find","Kiko, by hand","Sent by hand","LinkedIn / Facebook","",[]],
  ["C1D","Social","Facebook introduction","1 Find","Kiko, by hand","Sent by hand","LinkedIn / Facebook","",[]],
  ["R1","SMS","SMS","1 Join","Canvas (Semaphore text)","Old wording","BSE sender name","",[]],
  ["R2","SMS","SMS","2 Assign","Canvas (Semaphore text)","Old wording","BSE sender name","",[]],
  ["R5","SMS","SMS","3 Sign","Canvas (Semaphore text)","Old wording","BSE sender name","",[]],
  ["R6","SMS","SMS","3 Sign","Canvas (Semaphore text)","Old wording","BSE sender name","",[]],
  ["R7","SMS","SMS","4 Liquidate","Canvas (Semaphore text)","Not built","BSE sender name","",[]],
  ["R8","SMS","SMS","5 Event day","Canvas (Semaphore text)","Not built","BSE sender name","",[]],
  ["T1","Email","Approval needed","Team","Canvas","New draft","Canvas no-reply (Canvas)","",[]],
  ["T2","Email","Approved or rejected","Team","Canvas","New draft","Canvas no-reply (Canvas)","",[]],
  ["T3","Email","Status changed","Team","Canvas","New draft","Canvas no-reply (Canvas)","",[]],
  ["T4","Email","Supplier awarded","Team","Canvas","New draft","Canvas no-reply (Canvas)","",[]],
  ["T5","Email","Your day","Team","Canvas","New draft","Canvas no-reply (Canvas)","",[]],
  ["T6","Email","Announcement","Team","Canvas","New draft","Canvas no-reply (Canvas)","",[]]
];
const CUE_MT_DOC_URL_ = 'https://docs.google.com/document/d/1ozxVZHjKM1WOzAZh-Sr6Qq5nySmsbb7XENz-MU0ySAY/edit';
const CUE_MT_WHO_ = { C: 'Clients', S: 'Suppliers', R: 'Crew', T: 'Team' };
const CUE_MT_STATUS_ = ['In use', 'Old wording', 'Not built', 'New draft', 'Sent by hand'];
const CUE_MT_VAR_RE_ = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** A template's key as Canvas names it: "<code> <name>", or "<code> SMS" for a text. */
const cueMtKey_ = (code, channel, name) => code + ' ' + (channel === 'SMS' ? 'SMS' : name);
/** The fill-ins a template uses, in order of first use. */
function cueMtVars_(t) {
  const out = [], add = s => String(s || '').replace(CUE_MT_VAR_RE_, (m, n) => { if (out.indexOf(n) < 0) out.push(n); return m; });
  add(t.subject); (t.blocks || []).forEach(b => { add(b.text); add(b.url); });
  return out;
}

/** Canvas's message_templates answer joined with CUE_MT_MAP_: one row per message, doc templates first in the doc's order, then the
 *  mapped messages the doc does not hold yet (indoc false). Pure: no service calls. */
function cueMtJoin_(res) {
  const R = res || {}, map = {}, used = {};
  CUE_MT_MAP_.forEach(r => { map[cueMtKey_(r[0], r[1], r[2])] = r; });
  const row = (t, m, indoc) => {
    const code = String(t.code || (m && m[0]) || ''), who = String(t.who || code.charAt(0) || ''), last = t.last && t.last.at ? { at: String(t.last.at), to: String(t.last.to || ''), rev: String(t.last.rev || '') } : null;
    const att = Array.isArray(t.attachments) ? t.attachments.map(a => typeof a === 'string' ? { name: a } : { name: String(a.name || a.id || ''), id: String(a.id || ''), url: String(a.url || '') }) : (m ? m[8] : []).map(a => ({ name: a }));
    const blocks = (t.blocks || []).map(b => b.t === 'btn' ? { t: 'btn', text: String(b.text || ''), url: String(b.url || '') } : { t: 'p', text: String(b.text || '') });
    const status = last ? 'In use' : String(t.status || (m ? m[5] : '') || 'Not built');
    const x = { key: String(t.key || cueMtKey_(code, t.channel || (m && m[1]), t.name || (m && m[2]))), code, who, whoName: CUE_MT_WHO_[who] || who,
      channel: String(t.channel || (m && m[1]) || 'Email'), name: String(t.name || (m && m[2]) || ''), use: String(t.use || ''), subject: String(t.subject || ''), blocks,
      stage: m ? m[3] : '', sentBy: String(t.app || (m ? m[4] : '') || ''), from: String(t.from || (m ? m[6] : '') || ''), cc: String(t.cc != null ? t.cc : (m ? m[7] : '') || ''),
      attachments: att, button: (blocks.filter(b => b.t === 'btn')[0] || {}).url || '', last, status, indoc };
    x.vars = cueMtVars_(x);
    return x;
  };
  const list = (R.templates || []).map(t => { const k = String(t.key || ''), m = map[k] || null; if (m) used[k] = 1; return row(t, m, true); });
  CUE_MT_MAP_.forEach(m => { const k = cueMtKey_(m[0], m[1], m[2]); if (!used[k]) list.push(row({ code: m[0], channel: m[1], name: m[2] }, m, false)); });
  return { rev: String(R.rev || ''), doc: String(R.doc || CUE_MT_DOC_URL_), list, statuses: CUE_MT_STATUS_.slice() };
}

/** Cue Admin › Templates: every message, from the doc through Canvas. When Canvas or the doc cannot be read, the page says why and lists
 *  nothing from memory (Kiko 1 Nov: "No. fix why its not sending it": no copy of old wording). Read only. */
function cueAdminTemplates() {
  cueOwner_();
  try { return cueMtJoin_(cueBridge_(cueAdminS_(), 'message_templates', {}) || {}); }
  catch (e) { return { rev: '', doc: CUE_MT_DOC_URL_, list: [], statuses: CUE_MT_STATUS_.slice(), error: cueStr_((e && e.message) || e, 400) }; }
}

/** One template built by Canvas with its fill-ins left as {{name}} (draft mode), for the preview: { subject, html, text, missing, rev }.
 *  The banner travels as base64 and is put into the html as a data URL here, so the page shows the doc's own banner. */
function cueAdminTemplatePreview(key) {
  cueOwner_();
  const m = cueBridge_(cueAdminS_(), 'message_render', { key: cueStr_(key, 120), data: {}, mode: 'draft' }) || {};
  const html = String(m.html || '').replace(/cid:mtbanner/g, m.banner ? 'data:image/png;base64,' + String(m.banner) : '');
  return { key: String(m.key || key), subject: String(m.subject || ''), html, text: String(m.text || ''), missing: (m.missing || []).map(String), rev: String(m.rev || '') };
}

/** The editor's message box as the doc's blocks: paragraphs split on a blank line; a paragraph written "[Button words](link)" is the
 *  yellow button. The inverse of cueMtText_. */
function cueMtBlocks_(text) {
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(s => s.trim()).filter(Boolean).map(s => {
    const b = /^\[([^\]\n]+)\]\(([^)\s]*)\)$/.exec(s);
    return b ? { t: 'btn', text: b[1].trim(), url: b[2].trim() } : { t: 'p', text: s };
  });
}
/** A template's blocks as the editor's message box. */
function cueMtText_(blocks) { return (blocks || []).map(b => b.t === 'btn' ? '[' + b.text + '](' + b.url + ')' : b.text).join('\n\n'); }

/** Save on the Templates page: Canvas writes the subject and message back into the doc (only that template's Subject, message and
 *  button paragraphs) and reads it back. Kiko's tap on Save is the approval; nothing is sent. ed = { subject, body }.
 *  Returns the page's list after the save. */
function cueAdminTemplateSave(key, ed) {
  cueOwner_();
  const e = ed || {}, k = cueStr_(key, 120);
  if (!k) throw new Error('Pick a template first.');
  const blocks = cueMtBlocks_(e.body);
  if (!blocks.length) throw new Error('The message is empty; nothing was saved.');
  if (blocks.length > 60) throw new Error('The message has more than 60 paragraphs; nothing was saved.');
  if (blocks.some(b => b.text.length > 5000)) throw new Error('One paragraph is over 5,000 characters; nothing was saved.');
  const args = { key: k, subject: cueStr_(String(e.subject || '').replace(/[\r\n]+/g, ' ').trim(), 300),
    blocks: blocks.map(b => b.t === 'btn' ? { t: 'btn', text: cueStr_(b.text, 5000), url: cueStr_(b.url, 500) } : { t: 'p', text: cueStr_(b.text, 5000) }) };
  const s = cueAdminS_(), cmd = { command_id: 'cue:' + s.id + ':message_template_save:0', action: 'message_template_save', args, pid: '' };
  cueBridgePlan_(s, [cmd]);
  const r = cueBridgeParse_('message_template_save', UrlFetchApp.fetchAll([cueBridgeReq_(s, 'message_template_save', args, '', cmd.command_id)])[0]) || {};
  if (r.ok === false) throw new Error('The doc now reads differently from what you saved: ' + cueStr_(r.readBack || 'no detail', 300));
  return cueAdminTemplates();
}

/** Send me a test: the template built by Canvas (fill-ins left as {{name}}) goes from Kiko's Gmail to Kiko only, subject "[Test] ...",
 *  with the doc's banner inline. Not logged as a send (it is not one). Returns { to, subject }. */
function cueAdminTemplateTest(key) {
  cueOwner_();
  const m = cueBridge_(cueAdminS_(), 'message_render', { key: cueStr_(key, 120), data: {}, mode: 'draft' }) || {};
  if (String(m.channel || 'Email') !== 'Email') throw new Error('Only emails can be sent as a test.');
  const me = String(Session.getEffectiveUser().getEmail() || '');
  if (!cueEmail_(me)) throw new Error('Cue could not tell your email address.');
  const subject = '[Test] ' + String(m.subject || key);
  cueGmailSend_(cueMtDraft_(me, subject, String(m.text || ''), String(m.html || ''), String(m.banner || '')));
  return { to: me, subject };
}

/** One Gmail draft with text, html and the banner as an inline image (cid:mtbanner). Returns the draft id. */
function cueMtDraft_(to, subject, text, html, banner) {
  const b64 = t => Utilities.base64Encode(Utilities.newBlob(String(t)).getBytes()), wrap = t => t.replace(/.{1,76}/g, '$&\r\n');
  const id = cueNow_().toString(36), alt = 'cue_alt_' + id, rel = 'cue_rel_' + id;
  const alts = '--' + alt + '\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap(b64(text)) + '\r\n'
    + '--' + alt + '\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + wrap(b64(html)) + '\r\n--' + alt + '--\r\n';
  let mime = 'To: ' + to + '\r\nSubject: =?UTF-8?B?' + b64(String(subject).replace(/[\r\n]+/g, ' ')) + '?=\r\nMIME-Version: 1.0\r\n';
  mime += banner && html.indexOf('cid:mtbanner') >= 0
    ? 'Content-Type: multipart/related; boundary="' + rel + '"\r\n\r\n--' + rel + '\r\nContent-Type: multipart/alternative; boundary="' + alt + '"\r\n\r\n' + alts
      + '--' + rel + '\r\nContent-Type: image/png; name="banner.png"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <mtbanner>\r\nContent-Disposition: inline; filename="banner.png"\r\n\r\n' + wrap(banner) + '\r\n--' + rel + '--\r\n'
    : 'Content-Type: multipart/alternative; boundary="' + alt + '"\r\n\r\n' + alts;
  const res = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, payload: JSON.stringify({ message: { raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()) } }) });
  let o = null; try { o = JSON.parse(res.getContentText()); } catch (e) { o = null; }
  if (res.getResponseCode() !== 200 || !o || !o.id) throw new Error('Gmail did not make the test email (HTTP ' + res.getResponseCode() + ')' + cueGoogleWhy_(res));
  return o.id;
}
