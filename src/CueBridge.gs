/* CUE-2026-10-21. DRAFT. Cue's only way into Canvas: the signed Canvas bridge (integrations/zapier/ZapBridge.gs), reached
 * through the Client app's doPost at CUE_BRIDGE_URL. Each request is signed HMAC-SHA256(ZAD_SECRET, ts + "." + body), the
 * same as every other bridge caller. Cue uses six actions only: find_similar_projects, intake_evidence and list_project_files (read),
 * submit_intake (Canvas re-checks and stores the proposal "Waiting for Kiko"), apply_intake (Canvas writes it once) and
 * make_rfq_drafts (only when CUE_DRAFTS_IN=canvas: Canvas makes the RFQ drafts in info@, never sent).
 * Supplier registration (CueSupplier.gs) adds supplier_check (read), register_supplier and save_supplier_file. */

function cueBridgeReq_(s, action, args, pid) {
  const url = cueKey_('CUE_BRIDGE_URL'), secret = cueKey_('ZAD_SECRET');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error('CUE_BRIDGE_URL must be the Client app\'s /exec address.');
  const ts = cueNow_();
  const body = Object.assign({ command_id: 'cue:' + s.id + ':' + action + ':' + ts.toString(36), task_id: s.id, action }, pid ? { project_id: pid } : {}, { args, ts });
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
