/* CUE-LOOKUP-2026-10-27 (Kiko 09:20Z "give cue edit rights and look up rights"; specs/transfer-lookup-invoice-edit.md).
 * Two chat commands that need no AI call. Before them the chat said it "can't search the Transfers sheet" and "can't edit an
 * invoice", although Cue already reads BSE Scopes and Transfers (CuePersonal.gs) and Canvas can edit a billing invoice.
 *
 * Transfer lookup (read only): "is there a gcash transfer for Cups that day", "any transfer of 1,200 on 12 Oct",
 *   "find transfer 7046033873147". Cue finds the payment request (by request ID, or by the words in the message against
 *   Category, Supplier, Payee and Cost Item), then looks in Transfers for the same amount from 3 days before to 3 days after.
 *   An amount alone is never a match (Kiko's expense skill): a same-amount row for another payee is said to be one.
 *   Account numbers are never shown.
 * Invoice line edit (a Canvas write after Approve): "add REC-10307792 to the Telus trick or treat invoice so it prints".
 *   Canvas's bi_list finds the project's billing invoices and POs. The line goes at the start of the open BI's Description,
 *   or, when the project has no BI yet, at the start of its unbilled PO's Full Description, which New invoice copies. Both
 *   print under "Purchase Order #". The write is Canvas's invoice_line, as the one command of a claimed plan, after Approve. */

const CUE_TX_RE_ = /\b(transfers?|gcash|g-?xchange|instapay|pesonet|bank\s+transfer|fund\s+transfer)\b/i;
const CUE_TX_ASK_RE_ = /\?|\b(is there|was there|are there|any|find|look\s*up|lookup|check|search|match|matching|same amount|did i|do we have)\b/i;
const CUE_TX_DAYS_ = 3, CUE_TX_SHOW_ = 5;
const CUE_TX_REQ_RE_ = /\bAP-[A-Z0-9•]{2,6}-[A-Z0-9]{2,6}-\d{1,3}\b/i;
const CUE_TX_REF_RE_ = /\b(BN-\d{8}-\d{5,}|PC-[A-Z0-9-]{10,}|\d{9,15})\b/;
const CUE_TX_MON_ = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CUE_TX_STOP_ = ['is', 'there', 'was', 'were', 'are', 'any', 'a', 'an', 'the', 'for', 'of', 'on', 'that', 'this', 'day', 'with', 'same', 'amount', 'transfer',
  'transfers', 'gcash', 'bank', 'find', 'look', 'up', 'lookup', 'check', 'search', 'match', 'matching', 'did', 'i', 'we', 'do', 'have', 'pay', 'paid', 'cash',
  'payment', 'php', 'p', 'to', 'from', 'in', 'it', 'and', 'or', 'my', 'me', 'please', 'pls', 'can', 'you', 'there\'s', 'today', 'yesterday', 'via', 'by'];

/** The chat route: null when the message is not a transfer lookup. */
function cueTxSaid_(text, ref) {
  const t = String(text || '').trim();
  if (!t || !CUE_TX_RE_.test(t) || !CUE_TX_ASK_RE_.test(t) || /\bpersonal\b/i.test(t)) return null;
  cueChat_('Kiko', t, ref || '');
  let out;
  try { out = cueTxAnswer_(t, cueTxData_()); }
  catch (e) { out = 'I could not open BSE Scopes and Transfers (' + cueStr_((e && e.message) || e, 160) + '). Nothing was changed.'; }
  cueChat_('Cue', out, ref || '');
  return { chat: true, task: ref || '' };
}

/** The Transfers and Payment Request tabs, read only, as plain objects keyed by lower-case header. */
function cueTxData_() {
  const ss = SpreadsheetApp.openById(cueProp_('CUE_PERSONAL_BSE_SHEET', CUE_PE_BSE_));
  const rows = name => { const T = cuePeTab_(ss, name), h = T.head.map(x => x.toLowerCase());
    return T.rows.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => { if (k && !(k in o)) o[k] = r[j]; }); return o; }); };
  return { tr: rows('Transfers'), pr: rows('Payment Request') };
}

const cueTxNum_ = v => { if (typeof v === 'number') return v; const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return String(v || '').trim() && isFinite(n) ? n : null; };
/** A sheet date (Date, "10/12/2026", "2026-10-12") as a Manila day number (ms at 00:00 UTC of that calendar day), or null. */
function cueTxDay_(v) {
  if (v instanceof Date && !isNaN(v)) { const s = Utilities.formatDate(v, 'Asia/Manila', 'yyyy-MM-dd').split('-'); return Date.UTC(+s[0], +s[1] - 1, +s[2]); }
  const s = String(v || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return Date.UTC(+m[3], +m[1] - 1, +m[2]);
  return null;
}
const cueTxShow_ = d => d == null ? 'no date' : new Date(d).getUTCDate() + ' ' + CUE_TX_MON_[new Date(d).getUTCMonth()].replace(/^./, c => c.toUpperCase());
const cueTxPeso_ = n => '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What the message names: request ID, reference, amount, day, bank and the other words. */
function cueTxParse_(t) {
  const s = String(t || ''), today = cueTxDay_(new Date(cueNow_()));
  const req = (CUE_TX_REQ_RE_.exec(s) || [])[0] || '', ref = (CUE_TX_REF_RE_.exec(s.replace(CUE_TX_REQ_RE_, ' ')) || [])[1] || '';
  let rest = s.replace(CUE_TX_REQ_RE_, ' ').replace(CUE_TX_REF_RE_, ' '), day = null, m;
  const yr = new Date(today).getUTCFullYear();
  if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/.exec(rest))) { day = Date.UTC(+(m[3] || yr), +m[1] - 1, +m[2]); rest = rest.replace(m[0], ' '); }
  else if ((m = new RegExp('\\b(\\d{1,2})\\s*(' + CUE_TX_MON_.join('|') + ')[a-z]*\\.?\\b', 'i').exec(rest))) { day = Date.UTC(yr, CUE_TX_MON_.indexOf(m[2].toLowerCase()), +m[1]); rest = rest.replace(m[0], ' '); }
  else if ((m = new RegExp('\\b(' + CUE_TX_MON_.join('|') + ')[a-z]*\\.?\\s*(\\d{1,2})\\b', 'i').exec(rest))) { day = Date.UTC(yr, CUE_TX_MON_.indexOf(m[1].toLowerCase()), +m[2]); rest = rest.replace(m[0], ' '); }
  else if (/\byesterday\b/i.test(rest)) day = today - 86400000;
  else if (/\btoday\b/i.test(rest)) day = today;
  let amount = null;
  if ((m = /(?:₱|\bphp\s*|\bp\s?)(\d[\d,]*(?:\.\d{1,2})?)/i.exec(rest)) || (m = /\b(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{2,7}\.\d{1,2}|\d{3,7})\b/.exec(rest))) {
    amount = Number(m[1].replace(/,/g, '')); rest = rest.replace(m[0], ' ');
  }
  const bank = /\bgcash|g-?xchange\b/i.test(s) ? 'gcash' : /\bbdo\b/i.test(s) ? 'bdo' : /\bmaya\b/i.test(s) ? 'maya' : '';
  const words = rest.toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter(w => w.length >= 3 && CUE_TX_STOP_.indexOf(w) < 0 && !/^\d+$/.test(w));
  return { req, ref, day, amount, bank, words };
}
const cueTxBankOk_ = (row, bank) => !bank || (bank === 'gcash' ? /gcash|g-?xchange/i : new RegExp(bank, 'i')).test(String(row.bank || ''));

/** The answer, as chat text. d = { tr, pr } from cueTxData_. */
function cueTxAnswer_(t, d) {
  const q = cueTxParse_(t), hay = r => [r['request id'], r['category'], r['supplier\'s name'], r['payee'], r['cost item'], r['service provided'], r['event name']].join(' ').toLowerCase();
  // 1. the payment request the message is about
  let req = null;
  if (q.req) req = d.pr.filter(r => String(r['request id'] || '').toUpperCase() === q.req.toUpperCase()).pop() || null;
  if (!req && q.words.length && !q.ref) {
    const scored = d.pr.map(r => ({ r, s: q.words.filter(w => hay(r).indexOf(w) >= 0).length })).filter(x => x.s > 0)
      .filter(x => q.amount == null || Math.abs(cueTxNum_(x.r.amount) - q.amount) < 0.005).sort((a, b) => b.s - a.s || b.r._row - a.r._row);
    if (scored.length) req = scored[0].r;
  }
  const reqId = req ? String(req['request id'] || '') : q.req;
  const own = reqId ? d.tr.filter(r => String(r['request id'] || '').toUpperCase() === reqId.toUpperCase()).pop() : null;
  // 2. by reference: the transfer itself
  if (q.ref) {
    const hits = d.tr.filter(r => String(r['confirmation number'] || '').replace(/\s+/g, '').indexOf(q.ref) >= 0 || String(r['merchant reference'] || '').indexOf(q.ref) >= 0);
    return hits.length ? 'Found ' + hits.length + ' transfer' + (hits.length > 1 ? 's' : '') + ' with reference ' + q.ref + ':\n' + hits.slice(0, CUE_TX_SHOW_).map(cueTxLine_).join('\n')
      : 'No transfer in the Transfers tab has reference ' + q.ref + '.';
  }
  const amount = q.amount != null ? q.amount : req ? cueTxNum_(req.amount) : own ? cueTxNum_(own['paid amount']) : null;
  const day = q.day != null ? q.day : own && cueTxDay_(own['payment date']) != null ? cueTxDay_(own['payment date']) : req ? cueTxDay_(req['payment date required']) : null;
  if (amount == null) return 'Which payment? Give the request ID (like AP-CUP-TRI-1), the amount, or the reference number. I could not tell from "' + cueStr_(t, 80) + '".';
  const via = q.bank === 'gcash' ? 'GCash ' : q.bank ? q.bank.toUpperCase() + ' ' : '';
  const span = day == null ? 'in the Transfers tab' : 'from ' + cueTxShow_(day - CUE_TX_DAYS_ * 86400000) + ' to ' + cueTxShow_(day + CUE_TX_DAYS_ * 86400000);
  const inWin = r => { const x = cueTxDay_(r['payment date']); return day == null || (x != null && Math.abs(x - day) <= CUE_TX_DAYS_ * 86400000); };
  const others = d.tr.filter(r => r !== own && String(r['request id'] || '').toUpperCase() !== String(reqId || '').toUpperCase() && cueTxBankOk_(r, q.bank));
  const same = others.filter(r => inWin(r) && Math.abs(cueTxNum_(r['paid amount']) - amount) < 0.005);
  const head = req ? reqId + ' · ' + [req.category, req['event name']].filter(Boolean).join(' · ') + ' · ' + cueTxPeso_(cueTxNum_(req.amount))
    + (day != null ? ' · ' + cueTxShow_(day) : '') + (own && own.bank ? ' · ' + own.bank : '') : '';
  const lines = [];
  if (same.length) {
    lines.push('Found ' + same.length + ' ' + via + 'transfer' + (same.length > 1 ? 's' : '') + ' of ' + cueTxPeso_(amount) + ' ' + span + '. Same amount only: check the payee before you count it as this payment.');
    if (head) lines.push(head);
    same.slice(0, CUE_TX_SHOW_).forEach(r => lines.push(cueTxLine_(r)));
  } else {
    lines.push('No ' + via + 'transfer of ' + cueTxPeso_(amount) + ' ' + span + '.' + (own && /cash/i.test(String(own.bank || '')) ? ' Cash stands.' : ''));
    if (head) lines.push(head);
    const elsewhere = others.filter(r => !inWin(r) && Math.abs(cueTxNum_(r['paid amount']) - amount) < 0.005 && cueTxDay_(r['payment date']) != null && day != null
      && Math.abs(cueTxDay_(r['payment date']) - day) <= 30 * 86400000);
    elsewhere.slice(0, 2).forEach(r => lines.push(cueTxLine_(r) + ' (same amount, other day and payee)'));
    if (day != null) { const near = others.filter(r => cueTxDay_(r['payment date']) === day).slice(0, CUE_TX_SHOW_);
      if (near.length) { lines.push(via + 'transfers that day:'); near.forEach(r => lines.push(cueTxLine_(r))); } }
  }
  lines.push('Read only. Nothing was changed.');
  return lines.join('\n');
}
/** One Transfers row as a chat line: request ID, bank, payee as the sheet shows it, date, reference, amount. Never an account number. */
function cueTxLine_(r) {
  return '- ' + [String(r['request id'] || 'no request ID'), [r.bank, r['account name']].filter(x => String(x || '').trim()).join(' '), cueTxShow_(cueTxDay_(r['payment date'])),
    String(r['confirmation number'] || '').trim(), cueTxPeso_(cueTxNum_(r['paid amount']))].filter(Boolean).join(' · ');
}

/* ---------- Invoice line edit ---------- */
const CUE_INV_RE_ = /\b(invoice|billing invoice|BI\s*#?\s*\d{1,6})\b/i;
const CUE_INV_DO_RE_ = /\b(add|put|include|insert|write|place|show)\b/i;
const CUE_INV_REC_RE_ = /\bREC-\d{4,12}\b/i;
const CUE_INV_STOP_ = ['add', 'put', 'include', 'insert', 'write', 'place', 'show', 'the', 'a', 'an', 'to', 'on', 'in', 'into', 'for', 'of', 'invoice', 'invoices',
  'billing', 'number', 'no', 'rec', 'it', 'so', 'that', 'has', 'have', 'must', 'should', 'when', 'printed', 'prints', 'print', 'generated', 'gets', 'get', 'appears',
  'appear', 'there', 'fields', 'field', 'and', 'can', 'you', 'please', 'pls', 'update', 'line', 'description', 'with', 'this', 'be'];

/** The chat route: null when the message is not an invoice line edit. */
function cueInvSaid_(text, ref) {
  const t = String(text || '').trim();
  if (!t || !CUE_INV_RE_.test(t) || !(CUE_INV_REC_RE_.test(t) || (CUE_INV_DO_RE_.test(t) && /["“][^"”]{2,200}["”]/.test(t)))) return null;
  // Cloud check 27 Oct 11:03Z: 'put "Cloud check" at the start of the description of BI 0014' came here and looked for a project
  // called "at start". A quoted line for a named BI is a general Canvas edit (CueEdit.gs), so it goes to the chat call.
  if (!CUE_INV_REC_RE_.test(t) && /\bBI\s*#?\s*\d{1,6}\b/i.test(t)) return null;
  cueChat_('Kiko', t, ref || '');
  const say = m => { cueChat_('Cue', m, ref || ''); return { chat: true, task: ref || '' }; };
  const rec = (CUE_INV_REC_RE_.exec(t) || [])[0], quoted = (/["“]([^"”]{2,200})["”]/.exec(t) || [])[1];
  const biNo = (/\bBI\s*#?\s*(\d{1,6})\b/i.exec(t) || [])[1] || '';
  const query = t.replace(CUE_INV_REC_RE_, ' ').replace(/["“][^"”]*["”]/g, ' ').replace(/\bBI\s*#?\s*\d{1,6}\b/gi, ' ').toLowerCase().replace(/[^a-z0-9ñ-]+/g, ' ')
    .split(' ').filter(w => w && CUE_INV_STOP_.indexOf(w) < 0).join(' ').trim();
  if (!query) return say('Which project\'s invoice? Name the project or its ID, like "add REC-10307792 to the Trick or Treat Manila invoice".');
  const s = { id: 'cue-inv-' + cueNow_().toString(36) };
  let list;
  try { list = cueBridge_(s, 'bi_list', { query: cueStr_(query, 200) }) || {}; }
  catch (e) { return say('Canvas did not answer the invoice lookup (' + cueStr_((e && e.message) || e, 200) + '). Nothing was changed.'); }
  const ps = list.projects || [];
  if (!ps.length) return say('No project with a billing invoice or PO matches "' + cueStr_(query, 80) + '". Name the project or its ID.');
  if (ps.length > 1 && ps[1].score === ps[0].score) return say('Which one? ' + ps.slice(0, 3).map(p => p.name + ' (' + p.project_id + ')').join(', ') + '. Say it again with the project ID.');
  const p = ps[0];
  let target = null;
  if (biNo) { const b = (p.bis || []).filter(x => String(x.no).replace(/^0+/, '') === biNo.replace(/^0+/, ''))[0];
    if (!b) return say('BI ' + biNo + ' is not one of ' + p.name + '\'s invoices.'); target = { kind: 'bi', b }; }
  else {
    const open = (p.bis || []).filter(x => !x.locked);
    if (open.length > 1) return say(p.name + ' has ' + open.length + ' open invoices (BI ' + open.map(x => x.no).join(', BI ') + '). Say which one, like "add ' + (rec || 'it') + ' to BI ' + open[0].no + '".');
    if (open.length === 1) target = { kind: 'bi', b: open[0] };
    else if ((p.bis || []).length) return say('Every invoice of ' + p.name + ' is locked (' + p.bis.map(x => 'BI ' + x.no + ': ' + x.locked).join('; ') + ') Nothing was changed.');
    else { const po = (p.pos || []).filter(x => !x.billed);
      if (!po.length) return say(p.name + ' has no invoice and no PO yet, so there is no line to put it on. Nothing was changed.');
      if (po.length > 1) return say(p.name + ' has ' + po.length + ' unbilled POs (' + po.map(x => x.no).join(', ') + '). Say which, like "add ' + (rec || 'it') + ' for ' + po[0].no + '".');
      target = { kind: 'po', po: po[0] }; }
  }
  if (target.kind === 'bi' && target.b.locked) return say(target.b.locked + ' Nothing was changed.');
  const poNo = target.kind === 'bi' ? target.b.po_no : target.po.no;
  const line = cueStr_(rec ? rec.toUpperCase() + (poNo && t.indexOf(poNo) < 0 ? ' for ' + poNo : '') : quoted.trim(), 200);
  const old = target.kind === 'bi' ? String(target.b.description || '') : String(target.po.description || '');
  if (old.indexOf(line) >= 0) return say('Already there: ' + (target.kind === 'bi' ? 'BI ' + target.b.no : 'PO ' + poNo) + '\'s description has "' + line + '". Nothing was changed.');
  const now = old ? line.replace(/[.;,:\s]+$/, '') + '. ' + old : line;
  const where = target.kind === 'bi' ? 'BI ' + target.b.no + ' (' + (target.b.status || 'no status') + ')' : 'no invoice yet, so on PO ' + poNo + ', which New invoice copies';
  const q = 'Put this line on ' + p.name + '\'s invoice?\n' + line + '\nWhere: ' + where + '\nDescription becomes: ' + cueStr_(now, 160)
    + '\nPrints under "Purchase Order #' + (poNo ? ' ' + poNo : '') + '", line first, so the form never cuts it.'
    + (target.kind === 'bi' && target.b.pdf ? '\nThe saved PDF keeps the old text until Finance Desk makes a new one.' : '');
  cueAskOpen_({ type: 'invline', project_id: p.project_id, name: p.name, line, bi_no: target.kind === 'bi' ? String(target.b.no) : '', po_no: target.kind === 'po' ? poNo : '' },
    q, ['approve', 'not'], ref || '');
  return { chat: true, task: ref || '' };
}

/** Approve or Not that on the invoice line card (CueRoute.gs cueAskPick). Approve writes once, as the one command of a claimed plan. */
function cueInvPick_(o, pick, done) {
  cueChat_('Kiko', pick === 'approve' ? 'Approve' : 'Not that', done);
  if (pick !== 'approve') { cueChat_('Cue', 'OK, not added. Nothing was changed.', done); return { chat: true }; }
  const s = { id: 'cue-inv-' + cueNow_().toString(36) + Math.floor(Math.random() * 4096).toString(36) };
  const args = Object.assign({ line: o.line }, o.bi_no ? { bi_no: o.bi_no } : { po_no: o.po_no });
  const cmd = { command_id: 'cue:' + s.id + ':invoice_line:0', action: 'invoice_line', args, pid: o.project_id };
  let r;
  try { cueBridgePlan_(s, [cmd]); r = cueBridgeParse_('invoice_line', UrlFetchApp.fetchAll([cueBridgeReq_(s, 'invoice_line', args, o.project_id, cmd.command_id)])[0]) || {}; }
  catch (e) { cueChat_('Cue', 'Canvas did not save it: ' + cueStr_((e && e.message) || e, 300) + ' Nothing was changed.', done); return { chat: true }; }
  if (r.refused) { cueChat_('Cue', 'Canvas refused: ' + cueStr_(r.refused, 300), done); return { chat: true }; }
  cueChat_('Cue', r.where === 'bi'
    ? 'Saved. BI ' + r.bi_no + '\'s Description now starts with "' + o.line + '".' + (r.pdf ? ' Its saved PDF still has the old text until Finance Desk makes a new one.' : '')
    : 'Saved on PO ' + r.po_no + '. ' + o.name + '\'s invoice will print "' + o.line + '" under "Purchase Order #" when it is made.', done);
  return { chat: true };
}
