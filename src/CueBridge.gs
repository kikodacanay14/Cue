/* CUE-2026-10-21. DRAFT. Cue's only way into Canvas: the signed Canvas bridge (integrations/zapier/ZapBridge.gs), reached
 * through the Client app's doPost at CUE_BRIDGE_URL. Each request is signed HMAC-SHA256(ZAD_SECRET, ts + "." + body), the
 * same as every other bridge caller. Cue uses find_similar_projects, search_projects (chat lookup), intake_evidence, list_project_files and get_project_board (read),
 * submit_intake (Canvas re-checks and stores the proposal "Waiting for Kiko"), apply_intake (Canvas writes it once) and save_project_file.
 * RFQs are never made in info@ (Kiko 07:45Z), so make_rfq_drafts is not used.
 * The expense pair: expense_evidence (read) and record_expense (one expense Kiko approved; CueExpense.gs).
 * Supplier registration (CueSupplier.gs) adds supplier_check (read), register_supplier and save_supplier_file.
 * The signature chaser adds list_unsigned_docs (read) and send_doc_reminder (one approved reminder from freelancers@).
 * Payment chasers add overdue_billings (read) and send_payment_chasers (from info@, CC Kiko, only after Kiko approves the line). */

function cueBridgeReq_(s, action, args, pid, cid) {   // cid: a fixed command_id, for a write named in a claimed plan
  const url = cueKey_('CUE_BRIDGE_URL'), secret = cueKey_('ZAD_SECRET');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error('CUE_BRIDGE_URL must be the Client app\'s /exec address.');
  const ts = cueNow_();
  const body = Object.assign({ command_id: cid || 'cue:' + s.id + ':' + action + ':' + ts.toString(36), task_id: s.id, action }, pid ? { project_id: pid } : {}, { args, ts });
  const raw = JSON.stringify(body);
  const sig = Utilities.computeHmacSha256Signature(String(ts) + '.' + raw, secret).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
  return { url: url + '?sig=' + sig, method: 'post', contentType: 'application/json', payload: raw, muteHttpExceptions: true, followRedirects: true };
}
function cueBridgeParse_(action, res) {
  const code = res.getResponseCode();
  let o = null; try { o = JSON.parse(res.getContentText()); } catch (e) { o = null; }
  if (!o) throw new Error('Canvas did not answer ' + action + ' (HTTP ' + code + ')');
  if (!o.ok) throw new Error('Canvas refused ' + action + ' (' + (o.status || 'error') + '): ' + String(o.error || '').slice(0, 300));
  return o.result;
}
/** Several bridge calls in parallel: [[action, args, project_id?], ...] -> results in order. Throws on the first refusal. */
function cueBridgeAll_(s, calls) {
  const res = UrlFetchApp.fetchAll(calls.map(c => cueBridgeReq_(s, c[0], c[1], c[2])));
  return calls.map((c, i) => cueBridgeParse_(c[0], res[i]));
}
function cueBridge_(s, action, args, pid) { return cueBridgeAll_(s, [[action, args, pid]])[0]; }
/* LEAD-RETRY-2026-11-06: Canvas runs one save at a time (locked_ waits 20 s), so writes sent all at once failed with "Another save is in
 * progress" once a dozen queued (15 bid leads lost, 4 to 6 Nov). Commands of a claimed plan now go CUE_WAVES_.size at a time; a busy
 * answer is sent again with the same command_id after a pause (Canvas reruns a Rejected or never-claimed command and replays a finished
 * one, so a repeat never writes twice). Returns one { r } (the parsed result) or { err } per command, in order. */
const CUE_WAVES_ = { size: 3, tries: 3, pause: 5000 };
const cueBridgeBusy_ = m => /Another save is in progress|busy, retry later|\(Blocked\): in progress|did not answer|timed out|Address unavailable/i.test(String(m || ''));
function cueBridgeWaves_(t, cmds) {
  const out = cmds.map(() => null);
  let todo = cmds.map((c, n) => n);
  for (let k = 0; k < CUE_WAVES_.tries && todo.length; k++) {
    if (k) Utilities.sleep(CUE_WAVES_.pause);
    const again = [];
    for (let i = 0; i < todo.length; i += CUE_WAVES_.size) {
      const wave = todo.slice(i, i + CUE_WAVES_.size);
      let res = null, err = '';
      try { res = UrlFetchApp.fetchAll(wave.map(n => cueBridgeReq_(t, cmds[n].action, cmds[n].args, cmds[n].pid || '', cmds[n].command_id))); }
      catch (e) { err = String((e && e.message) || e); }
      wave.forEach((n, j) => {
        try { if (err) throw new Error(err);
          const r = cueBridgeParse_(cmds[n].action, res[j]) || {};
          if (r.refused) throw new Error('Canvas refused ' + cmds[n].action + ': ' + r.refused);   // the CRM door answers a refusal instead of throwing
          out[n] = { r }; }
        catch (e) { const m = String((e && e.message) || e); out[n] = { err: m }; if (cueBridgeBusy_(m)) again.push(n); }
      });
    }
    todo = again;
  }
  return out;
}
/* CUE-CRMLOG-PLAN-2026-10-27: Canvas runs a bridge "write" only as a command of its task's claimed plan (claim_plan: command_id
 * plan:<task_id>, at most 20 commands, each {command_id, payload_hash}; the first plan for a task wins). payload_hash is Canvas's
 * zbPayloadHash_: SHA-256 hex of JSON [action, project_id, expected_project_number, args]. Claims the plan for s.id. */
const cueSha_ = t => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t)).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
function cueBridgePlan_(s, cmds, recovers) {   // cmds: [{ command_id, action, args, pid }]; recovers: a recovery task's original task (s.id is <recovers>-recovery-<n>)
  const commands = cmds.map(c => ({ command_id: c.command_id, payload_hash: cueSha_(JSON.stringify([c.action, c.pid || '', '', c.args])) }));
  const planHash = cueSha_(JSON.stringify(commands));
  if (globalThis.CUE_CHECK_ON_) cueCheckPlan_(cmds, planHash);   // cloud check: every command must name the test project (CueCheck.gs)
  const res = UrlFetchApp.fetchAll([cueBridgeReq_(s, 'claim_plan', Object.assign({ plan_hash: planHash, commands }, recovers ? { recovers } : {}), '', 'plan:' + s.id)])[0];
  return cueBridgeParse_('claim_plan', res);
}
