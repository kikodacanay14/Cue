/* CUE-CRM-FUNNEL-2026-10-28 (spec canvas-crm-funnel.md F6, approved by Kiko 26 Oct 16:08Z; Kiko 28 Oct 07:39Z "stop dillydallying").
 * The morning batch's sales lines: what to do today from Canvas's Sales funnel (bridge read crm_funnel, one call per batch).
 *   - CRM follow-ups due today or tomorrow (overdue ones are urgent),
 *   - Inquiries gone quiet longer than Canvas's limit (reply or send the CE),
 *   - Delivered projects gone quiet longer than the limit (send the billing).
 * CE sent is left out on purpose: the CE award chasers already chase those. No email and no AI: each line says what to do.
 * Apps Script loads files alphabetically, so this registration lives in a file that sorts after CueSweep.gs (where cueKind_ is defined). */
const CUE_FUNNEL_DO_ = { Inquiry: 'reply or send the CE', Delivered: 'send the billing' };

function cueFunnelFind_(ctx) {
  const f = cueBridge_(ctx.s, 'crm_funnel', {}) || {}, out = [], tomorrow = cueAddDays_(ctx.today, 1);
  (f.due || []).forEach(x => {
    if (!x || !x.id || !x.due || x.due > tomorrow) return;
    const when = x.due < ctx.today ? 'Overdue since ' + x.due : x.due === ctx.today ? 'Due today' : 'Due tomorrow';
    out.push({ key: 'crmfu:' + x.id, project: String(x.client || x.what || 'Follow-up').slice(0, 120), who: '',
      priority: x.due < ctx.today ? 'urgent' : 'normal', due_since: x.due,
      why: (when + ': ' + String(x.what || '') + (x.owner ? ' (' + String(x.owner).split('@')[0] + ')' : '')).slice(0, 300) });
  });
  (f.stuck || []).forEach(x => {
    if (!x || !x.id || !CUE_FUNNEL_DO_[x.step]) return;
    out.push({ key: 'funnel:' + x.id, project: String(x.name || x.id).slice(0, 120), who: String(x.client || '').slice(0, 120), project_id: x.kind === 'project' ? x.id : '',
      priority: 'normal', why: x.step + ', quiet ' + x.quiet + ' days (limit ' + x.limit + '): ' + CUE_FUNNEL_DO_[x.step] });
  });
  return out;
}

if (typeof cueKind_ === 'function') {
  try {
    cueKind_({ kind: 'funnel', label: 'Sales: do these today', every: 1, max: 0, sendAllowed: false, noEmail: true, find: cueFunnelFind_ });
  } catch (e) { console.warn('Sales funnel sweep lines: ' + e); }
}

/** Cloud check only (CueCheck.gs): the lines today's batch would list, from the real crm_funnel read. Reads only; writes nothing. */
function cueFunnelCheck() {
  if (!globalThis.CUE_CHECK_ON_) throw new Error('Only a cloud check runs this.');
  return cueFunnelFind_({ today: cuePh_(cueNow_()).day, s: { id: 'funnel-check-' + cuePh_(cueNow_()).day } });
}
