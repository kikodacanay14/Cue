/* CUE-ADMIN-MOVE-2026-10-29 (Kiko 29 Oct 03:43Z: "nobody else has access to Admin page but me. Its also confusing that there are 2
 * different settings page just because its done by 2 different systems. We should be developing for the users not because of how
 * the system is. so lets move the AR, Incoice, Payment sent, Final Reminder Admin configs to Cue Admin."). Epic Cue #193.
 *
 * Canvas Admin's Run now (Chasers) and Send a notice screens move to Cue Admin. Canvas keeps doing the sending, exactly as before:
 * Cue only reads the lists over the bridge (run_now_list, sn_board, sn_items, sn_prepare) and passes Kiko's press on
 * (run_now_send, sn_send; Canvas CanvasWorkspace PR #278). Kiko's press is the approval for those emails, as it was on Canvas's page.
 * Neither send has a ledger on Canvas's side, so Cue sends each press once and never retries it.
 * "Send a test to me" is not a Canvas send any more (Canvas would send it to the bridge account): Cue sends the test to Kiko from his
 * own Gmail, as plain text. */

const cueAdminS_ = () => ({ id: 'admin-' + cueNow_().toString(36) });

/** Canvas chasers: { ar, invoice, paid, final }, each a list of { kind, item, pid, project, supplier, reqs, amount, last, on }. */
function cueAdminCanvasChasers() {
  cueOwner_();
  return cueBridge_(cueAdminS_(), 'run_now_list', {});
}

/** Sends the lines Kiko ticked (one Send a notice send each, on Canvas). The bridge takes 50 lines a call, so more go in turns.
 * Returns { results: [{ kind, pid, item, ok, to?, error? }], list }. */
function cueAdminCanvasChaseSend(lines) {
  cueOwner_();
  const L = (Array.isArray(lines) ? lines : []).map(x => Object.assign({ kind: String((x && x.kind) || ''), pid: String((x && x.pid) || '').trim() },
    x && x.item ? { item: String(x.item).trim() } : {}));
  if (!L.length) throw new Error('Tick at least one line.');
  const results = [];
  let list = null;
  for (let i = 0; i < L.length; i += 50) {
    const part = L.slice(i, i + 50);
    try { const r = cueBridge_(cueAdminS_(), 'run_now_send', { lines: part }) || {}; (r.results || []).forEach(x => results.push(x)); list = r.list || list; }
    catch (e) { const err = cueStr_((e && e.message) || e, 300); part.forEach(x => results.push(Object.assign({ item: '', ok: false, error: err }, x))); }
  }
  return { results, list };
}

/** Send a notice: what can be sent and the projects. { kinds: [{ k, label, who, item?, noProject?, typeIn?, page? }], projects }. */
function cueAdminSnBoard() {
  cueOwner_();
  const b = cueBridge_(cueAdminS_(), 'sn_board', {}) || {};
  return { kinds: b.kinds || [], projects: b.projects || [], canvas: (() => { try { return cueCanvasBase_(); } catch (e) { return ''; } })() };
}

/** The payments, receipts, suppliers or people of one notice and project to pick from: [{ id, label }]. */
function cueAdminSnItems(kind, pid) {
  cueOwner_();
  return cueBridge_(cueAdminS_(), 'sn_items', Object.assign({ kind: String(kind || '') }, pid ? { pid: String(pid) } : {})) || [];
}

/** What the send would be: { people, subject, text, sms, from, note, typeIn? }. Reads only. */
function cueAdminSnPrepare(kind, pid, item) {
  cueOwner_();
  return cueBridge_(cueAdminS_(), 'sn_prepare', Object.assign({ kind: String(kind || '') }, pid ? { pid: String(pid) } : {}, item ? { item: String(item) } : {}));
}

const CUE_SN_PERSON_KEYS_ = ['name', 'kind', 'part', 'contact', 'email', 'mobile', 'key', 'on', 'last'];
/** Kiko's Send. p = { kind, pid, item, people, email, text, subject, body, sms, edited, test }.
 * test: the email (and the text's words under it) go to Kiko from his own Gmail; nothing goes through Canvas.
 * Otherwise Canvas sends it (sn_send): { sent: [names], failed: [{ name, error }], texted }. */
function cueAdminSnSend(p) {
  cueOwner_();
  p = p || {};
  if (p.test) {
    const me = String(Session.getEffectiveUser().getEmail() || '');
    const body = (p.email === false ? '' : String(p.body || '')) + (p.text && p.sms ? '\n\n---\nText message:\n' + String(p.sms) : '');
    cueGmailSend_(cueGmailDraft_(me, 'Test: ' + String(p.subject || 'Notice'), body));
    return { test: true, sent: [me], failed: [], texted: 0 };
  }
  const people = (Array.isArray(p.people) ? p.people : []).map(x => { const o = {};
    CUE_SN_PERSON_KEYS_.forEach(k => { if (x && x[k] !== undefined && x[k] !== null && x[k] !== '') o[k] = k === 'on' ? !!x[k] : String(x[k]); }); return o; });
  const a = { kind: String(p.kind || ''), people };
  if (p.pid) a.pid = String(p.pid);
  if (p.item) a.item = String(p.item);
  ['email', 'text', 'edited'].forEach(k => { if (p[k] !== undefined) a[k] = !!p[k]; });
  ['subject', 'body', 'sms'].forEach(k => { if (p[k] !== undefined && p[k] !== null) a[k] = String(p[k]); });
  return cueBridge_(cueAdminS_(), 'sn_send', a);
}
