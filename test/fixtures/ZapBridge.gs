/* ---------- ZAP-BRIDGE-DRAFT-2026-10-20 (Claude, for Kiko's review; not in src/, not released, not deployed) ----------
 * The one way Zapier reaches Canvas. Same shape as acctBridge: a library entry the main app exposes to a small web app
 * (doPost) that holds no logic of its own. Checked against live V178 src/Code.gs.
 *
 * - Every request is signed: HMAC-SHA256(ZAD_SECRET, ts + "." + body). Secret in this project's Script Properties only.
 * - Refuses when a Google user is signed in, so it only answers the library path, never the Workspace page.
 * - Runs as the identity in Script Property ZAD_ACT_AS, the way acctBridge runs as the Accountant. So the app's own checks
 *   (hasFullAccess_, requireOwner_, project-done locks) still apply to every call. Reviewed recommendation (05:13Z; not yet approved): a dedicated identity
 *   (zapier-bridge@blankspaceevent.com), never Kiko. It must be a Users-tab Manager row: Manager is the lowest Canvas role
 *   that addProject, addRequirementLines and updateCeSaveSteps accept. A Manager row opens every page and can change roles,
 *   so the restriction to the actions below comes from this bridge (signature + ZB_ACTIONS_), not from the role. Keep
 *   the address a sheet row with no Google account behind it, so nobody can sign in as it.
 * - Only the actions in ZB_ACTIONS_ run, with strict arguments. Nothing sets project status, files a CE, changes the
 *   active CE, awards, books, pays, or deletes. Status stays a person's decision in Canvas (it drives HubSpot stages).
 * - A durable ledger (sheet in ZAD_LEDGER_ID, tab "_Zap Commands") keyed by command_id. Replays return the stored
 *   answer. add_project is also keyed by intake_key, so one inquiry arriving by Gmail and by HubSpot makes one project.
 * - A write whose outcome is unknown is recorded Uncertain. Retries reconcile first; non-idempotent writes
 *   (addRequirementLines) never auto-retry and go to manual review.
 *
 * Request:  { command_id, task_id, action, project_id?, expected_project_number?, args:{}, ts }
 * Answer:   { ok, action_ok, completes_intake: false, status, command_id, action, result?, steps?, evidence?, error?,
 *             original_status?, original_at? }
 *   status: Completed | Replayed | Partial | Blocked | Rejected | Uncertain
 *   ok and action_ok mean only that this one action succeeded. completes_intake is always false: the bridge never decides
 *   that an intake is finished. Zapier's completion gates do (REVIEW.md §6).
 *   Writes need a claimed plan first (claim_plan, review 05:36Z): one plan per task, taken under the app's lock; only its
 *   commands, with their exact payloads, can run.
 *   Replayed (review 05:14Z): a repeat of a command that already finished. It carries the stored original outcome
 *   (original_status, result, steps, evidence, error, original_at). action_ok is true only when the original was Completed.
 * Review 07:57Z:
 *   - The ledger never cuts JSON. An outcome too large for one cell is stored as valid JSON that keeps status, time, error
 *     and steps; the large parts become {omitted, chars, sha256} markers (result_bounded on a replay).
 *   - Arguments are checked recursively, keys as own properties only, against the Canvas contracts (updateCeSaveSteps
 *     and the three steps it runs, CE Desk's own payloads). Empty writes are refused.
 *   - One recovery procedure (REVIEW.md §3): a Partial save_ce_requirements may be retried with the same command, which
 *     re-sends only its failed steps. Anything else, including a changed payload, needs a recovery task
 *     (<task>-recovery-<n>) whose claim_plan names recovers: <task>. That claim supersedes the original plan, so nothing
 *     of the original task can write afterwards. Plans stay immutable.
 */

const ZB_VERSION_ = 'zap-bridge-2026-10-20-draft';
const ZB_SKEW_MS_ = 5 * 60 * 1000;
const ZB_STALE_MS_ = 10 * 60 * 1000;
const ZB_TAB_ = '_Zap Commands';
const ZB_HEAD_ = ['command_id', 'action', 'project_id', 'intake_key', 'body_hash', 'status', 'result', 'task_id', 'created', 'updated'];
const ZB_PID_RE_ = /^S-\d{3,12}[A-Z0-9]{2}$/;   // addProject's ID rule (Code.gs 12298): 'S-' + digits + 2 letters
const ZB_PNO_RE_ = /^\d{3}$/;                   // Project Number Registry: 3 digits, e.g. 047

const ZB_FORBIDDEN_ = {
  file_ce: 'Filing a CE needs Kiko\'s separate approval.', set_active_ce: 'Changing the active CE needs Kiko\'s separate approval.',
  set_project_status: 'Project status is set by a person in Canvas; it drives HubSpot award stages.',
  delete_ce_lines: 'Deleting CE lines is not exposed.', save_entry: 'Supplier entries are not exposed yet.',
  award: 'Award needs approval.', book: 'Booking needs approval.', pay: 'Payment needs approval.'
};

// Files Cue may put in a project folder: what Cue accepts as attachments, into a Files-tab type folder.
const ZB_FILE_MIMES_ = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'message/rfc822'];
const ZB_FILE_TYPES_ = ['Brief & Planning', 'Client Documents', 'Designs & Visuals', 'Visual Materials', 'Other Documents'];
const ZB_ACTIONS_ = {
  claim_plan: {
    // Review 05:36Z: an atomic claim of one task's plan, under the app's lock. The first plan for a task wins; a second,
    // different plan for the same task is refused, so two concurrent Zap runs can't mint and run different plans.
    // command_id must be 'plan:' + task_id. Every later write must be one of the claimed commands, with the claimed payload.
    kind: 'write', needsProject: false, retrySafe: true, plan: true,
    schema: {
      plan_hash: { type: 'string', required: true, re: /^[0-9a-f]{64}$/ },
      commands: { type: 'array', required: true, minItems: 1, maxItems: 20 },
      recovers: { type: 'string', re: /^[A-Za-z0-9:_-]{1,100}$/ }   // a recovery task's original task (review 07:57Z)
    },
    run: (r) => ({ plan_hash: r.args.plan_hash, commands: r.args.commands, recovers: r.args.recovers || undefined }),
    check: (r, res) => ({ ok: true, evidence: { plan_hash: res.plan_hash, commands: res.commands.length } })
  },
  /* CANVAS-AI-2026-10-20 (Kiko 16:57Z: the Intake Zap, Zapier as the stand-in until Cue Builder). Three AI Queue actions.
   * They touch only the AI Queue (canvas-ai/AiQueue.gs); apply_intake writes the project only for a request already
   * "Waiting for Kiko", from the proposal Canvas stored, and only once (the queue row is its ledger, so no claim_plan). */
  queue_request: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      kind: { type: 'string', required: true, oneOf: ['task', 'issue', 'risk', 'analysis', 'intake', 'other'] },
      project_id: { type: 'string', re: /^S-\d{3,12}[A-Z0-9]{2}$/ }, text: { type: 'string', required: true, nonBlank: true, max: 4000 } },
    run: (r) => aiQueueAdd_({ request_id: r.args.request_id, kind: r.args.kind, project_id: r.args.project_id || '', text: r.args.text }, 'zapier')
  },
  queue_status: {
    kind: 'read', needsProject: false, schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ } },
    run: (r) => aiQueueGet_(r.args.request_id) || { request_id: r.args.request_id, status: 'Unknown' }
  },
  apply_intake: {
    kind: 'queue', needsProject: false, schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ } },
    run: (r) => aiIntakeApply_(r.args.request_id, 'zap_' + r.command_id)
  },
  /* CUE-2026-10-21 (Kiko 02:29Z: start in Cue, GPT reads, Claude studies, Canvas writes after Kiko approves in Cue).
   * intake_evidence: read-only Canvas evidence for Claude's study. submit_intake: Canvas re-checks Cue's proposal and
   * stores it "Waiting for Kiko"; apply_intake (above) then writes it once. */
  intake_evidence: {
    kind: 'read', needsProject: false,
    schema: { requirements: { type: 'array', required: true, minItems: 1, maxItems: 40, items: {
      key: { type: 'string', required: true, re: /^R\d{1,3}$/ }, search_terms: { type: 'string', max: 80 }, category: { type: 'string', max: 200 },
      description: { type: 'string', required: true, nonBlank: true, max: 2000 } } } },
    run: (r) => aiIntakeEvidenceFor_(r.args.requirements, { suppliers: true })
  },
  find_similar_projects: {
    kind: 'read', needsProject: false,
    schema: { client: { type: 'string', max: 200 }, date: { type: 'string', max: 10 }, name: { type: 'string', max: 200 } },
    run: (r) => aiIntakeSimilar_(r.args)
  },
  submit_intake: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      proposal: { type: 'object', required: true, fields: {
        client: { type: 'object', required: true, fields: { company: { type: 'string', max: 200 }, contact: { type: 'string', max: 200 },
          email: { type: 'string', max: 200 }, phone: { type: 'string', max: 60 } } },
        event: { type: 'object', required: true, fields: { name: { type: 'string', max: 200 }, type: { type: 'string', max: 100 },
          date: { type: 'string', max: 10, re: /^\d{4}-\d{2}-\d{2}$/ }, venue: { type: 'string', max: 200 }, city: { type: 'string', max: 100 },
          pax: { type: 'number', min: 0 }, budget: { type: 'string', max: 100 } } },
        lines: { type: 'array', required: true, minItems: 1, maxItems: 40, items: {
          key: { type: 'string', required: true, re: /^R\d{1,3}$/ }, category: { type: 'string', max: 200 },
          description: { type: 'string', required: true, nonBlank: true, max: 2000 }, search_terms: { type: 'string', max: 80 },
          quantity: { type: 'number', required: true, positive: true }, occurrence: { type: 'number', positive: true },
          execution: { type: 'string', required: true, oneOf: ['In House', 'Outsourced'] }, why: { type: 'string', max: 600 },
          unit_cost: { type: 'number', min: 0 }, cost_basis: { type: 'string', required: true, oneOf: ['past quotes', 'owned stock', 'none', 'set by Kiko', 'market research'] },
          price_source: { type: 'string', max: 60 },
          sources: { type: 'array', maxItems: 8 }, note: { type: 'string', max: 600 } } },
        rfqs: { type: 'array', maxItems: 20, items: { category: { type: 'string', max: 200 }, keys: { type: 'array', required: true, maxItems: 40 },
          subject: { type: 'string', max: 200 }, body: { type: 'string', required: true, max: 5000 }, suppliers: { type: 'array', maxItems: 10 } } },
        study: { type: 'string', max: 12000 }, risks: { type: 'array', maxItems: 15 }, questions: { type: 'array', maxItems: 15 } } } },
    run: (r) => aiIntakeSubmit_(r.args.request_id, r.args.proposal)
  },
  make_rfq_drafts: {
    // RFQ drafts in info@ for an Applied intake (canvas-ai/AiIntake.gs aiIntakeDrafts_). Drafts only, never sent.
    kind: 'queue', needsProject: false, schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ } },
    run: (r) => aiIntakeDrafts_(r.args.request_id)
  },
  get_project: {
    kind: 'read', needsProject: true, schema: { parts: { type: 'array', maxItems: 10 } },
    run: (r) => getProject(r.project_id, r.args.parts || ['admin'])
  },
  list_project_files: {
    // CUE-2026-10-21 (Kiko 04:48Z: "i want to see the files in the project folders"). The matched project's folder and its
    // first level of subfolders, newest first, for Cue's change card. Read only; names and links, never file contents.
    kind: 'read', needsProject: true, schema: {},
    run: (r) => { const o = listProjectFiles(r.project_id); return { folder_url: o.folderUrl || '', own: !!o.own, more: !!o.more || (o.files || []).length > 60,
      files: (o.files || []).slice(0, 60).map(f => ({ name: f.name, url: f.url, mime: f.mime, size: f.size, modified: f.modified, folder: f.folder })) }; }
  },
  get_readiness: {
    // CUE-2026-10-21 (Kiko 07:32Z approved specs/project-readiness.md). The project's readiness checklist exactly as the
    // Checklist tab computes it (getChecklist: Canvas's own rules, counts and auto checks), for Cue's readiness card.
    // Read only: no item, review, exception or gate approval is written. gate 'auto' (default) = Closeout once the event
    // date has passed or the project is in Closure; Pre-Event Readiness before that.
    kind: 'read', needsProject: true, schema: { gate: { type: 'string', oneOf: ['auto', 'pre', 'close'] } },
    run: (r) => zbReadiness_(r.project_id, r.args.gate || 'auto')
  },
  save_project_file: {
    // CUE-2026-10-21 (Kiko 06:45Z: "the files should be in the Project Folder - that's a critical part of the intake").
    // One file Kiko attached in Cue, into <project folder>/<type> through saveProjectFile_ (the Files tab's own save).
    // A repeat with the same name and size returns the file already there, so a retry never makes a second copy.
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      name: { type: 'string', required: true, nonBlank: true, max: 150 },
      mime: { type: 'string', required: true, oneOf: ZB_FILE_MIMES_ }, type: { type: 'string', required: true, oneOf: ZB_FILE_TYPES_ },
      data: { type: 'string', required: true, nonBlank: true, max: 14000000, re: /^[A-Za-z0-9+/=]+$/ } },
    run: (r) => zbSaveFile_(r)
  },
  overdue_billings: {
    // CUE-2026-10-21 (Kiko 08:16Z approved specs/payment-chasers.md). Client billing invoices past due and not fully
    // collected, worked out the way Finance Desk does (BI and PA tabs of the 2026 Project Tracker), with the contact to
    // chase (billing contact first, then the invoice's contact) and the info@ thread that sent the BI. Read only.
    kind: 'read', needsProject: false, schema: { min_days_late: { type: 'number', min: 0 } },
    run: (r) => zbOverdueBillings_(r.args.min_days_late == null ? 7 : r.args.min_days_late)
  },
  send_payment_chasers: {
    // CUE-2026-10-21 (Kiko 08:08-08:09Z): payment chasers go FROM info@ with Kiko on CC, one email per approved line, only
    // after Kiko approves it in Cue (Cue holds it until 09:00 PH). Canvas re-checks that every BI is still open and that the
    // balance is the one the email states, then sends (or saves an info@ draft) as a reply in the BI's own thread.
    // The key makes it once-only: a repeat returns the first outcome, and a try whose outcome is unknown is never resent.
    // Never changes a BI, a collection or any other finance record.
    kind: 'queue', needsProject: false,
    schema: { key: { type: 'string', required: true, re: /^[A-Za-z0-9:_.-]{6,160}$/ }, mode: { type: 'string', required: true, oneOf: ['send', 'draft'] },
      bis: { type: 'array', required: true, minItems: 1, maxItems: 10 }, balance: { type: 'number', required: true, positive: true },
      to: { type: 'string', required: true, max: 200, re: /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,190}\.[a-z]{2,}$/i },
      subject: { type: 'string', required: true, nonBlank: true, max: 200 }, body: { type: 'string', required: true, nonBlank: true, max: 6000 },
      thread_id: { type: 'string', re: /^[A-Za-z0-9]{6,40}$/ } },
    run: (r) => zbPaySend_(r.args)
  },
  get_project_board: {
    kind: 'read', needsProject: false, schema: {},
    run: () => getProjectBoard()
  },
  add_project: {
    // addProject (12289): Business Lead/Manager only; refuses a second project with the same name and date; makes folders
    // after its lock and reports folderError. It does not issue a project number (that happens on first requirement write).
    kind: 'write', needsProject: false, retrySafe: true,
    schema: {
      intake_key: { type: 'string', required: true, max: 200 },     // 'gmail:<threadId>' or 'hubspot:<dealId>'
      'project name': { type: 'string', required: true, max: 200 },
      'event date': { type: 'string', required: true, max: 10, re: /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/ },
      account: { type: 'string', max: 200 }, contact: { type: 'string', max: 200 }, 'account owner': { type: 'string', max: 200 },
      'event specialist': { type: 'string', max: 200 }, 'event type': { type: 'string', max: 100 }, scale: { type: 'string', max: 50 },
      'client project id': { type: 'string', max: 100 }
    },
    find: (r) => zbFindProject_(r.args['project name'], r.args['event date']),
    run: (r) => {
      const v = Object.assign({}, r.args); delete v.intake_key;          // never 'project status' or 'admin status'
      const res = addProject(v, { opKey: 'zap_' + r.command_id });
      return { project_id: res.created || '', folderError: res.folderError || '', skipped: res.skipped || [] };
    },
    check: (r, res) => {
      if (!res.project_id) return { ok: false, error: 'addProject returned no project id' };
      const p = getProject(res.project_id, ['admin']).project || {};
      if (res.folderError) return { ok: false, partial: true, error: 'project made, folders failed: ' + res.folderError, evidence: { project: p } };
      return { ok: true, evidence: { project_id: p.id, project_number: p.number || '(issued on first requirement write)', name: p.name } };
    }
  },
  add_requirement_lines: {
    // addRequirementLines (5406): appends to Requirements and the Requirement ID Registry. Not idempotent, so an
    // Uncertain outcome is never retried automatically.
    kind: 'write', needsProject: true, retrySafe: false,
    schema: { lines: { type: 'array', required: true, minItems: 1, maxItems: 100, items: {
      item: { type: 'string', required: true, nonBlank: true, max: 200 }, description: { type: 'string', max: 2000 },
      unit_cost: { type: 'number', min: 0 }, discounted: { type: 'number', min: 0 }, qty: { type: 'number', required: true, positive: true },
      occurrence: { type: 'number', positive: true }, price: { type: 'number', min: 0 }, section: { type: 'string', max: 100 }
    } } },
    run: (r, proj) => {
      const t = proj.title || proj.name || '';
      const rows = r.args.lines.map(l => [r.project_id, t, '', l.item, l.description || '', zbNum_(l.unit_cost), zbNum_(l.discounted),
        l.qty, zbNum_(l.occurrence, 1), zbNum_(l.price), l.section || '']);
      return addRequirementLines(rows, rows.map(() => null), rows.map(() => []));
    },
    check: (r, res) => (res && res.reqIds && res.reqIds.length === r.args.lines.length)
      ? { ok: true, evidence: { reqIds: res.reqIds, firstRow: res.firstRow } }
      : { ok: false, error: 'line count did not match: asked ' + r.args.lines.length + ', got ' + ((res && res.reqIds) || []).length }
  },
  save_ce_requirements: {
    // updateCeSaveSteps (5343) runs lines / subs / links in order and answers each step {ok} or {err}; earlier steps stay
    // written when a later one fails. Each of these three steps is safe to repeat (overwrite, or matched by key), so a
    // retry re-sends only the failed steps. Filed CE versions are separate copies (fileCe) and are not touched.
    kind: 'write', needsProject: true, retrySafe: true, resumable: true,
    // Nested shapes are the ones CE Desk sends (CEDesk.html 1650-1760) and the step functions read (Code.gs 2288, 5465,
    // 13382). Narrower on purpose: no new keys, no editing an existing scope (scopeId), no clearing a link (link: null).
    schema: {
      lines: { type: 'array', minItems: 1, maxItems: 200, items: {      // updateCeRequirementLines: [{reqId, set}]
        reqId: { type: 'string', required: true, re: /^[A-Za-z0-9._-]{1,60}$/ },
        set: { type: 'object', required: true, minKeys: 1, fields: {
          category: { type: 'string', nonBlank: true, max: 200 }, description: { type: 'string', max: 2000 },
          quantity: { type: 'number', min: 0 }, occurence: { type: 'number', min: 0 },   // 'occurence' is the sheet's spelling
          'ce section': { type: 'string', max: 50 }, 'unit cost': { type: 'number', min: 0, clearable: true },
          'discounted cost': { type: 'number', min: 0, clearable: true }, 'unit price': { type: 'number', min: 0 } } } } },
      subs: { type: 'array', minItems: 1, maxItems: 200, items: {       // addCeSubScopes items: new sub-items only
        key: { type: 'string', required: true, re: /^[A-Za-z0-9_.-]{1,60}$/ },   // its idempotency key (cesub_<key>)
        reqId: { type: 'string', required: true, re: /^[A-Za-z0-9._-]{1,60}$/ },
        category: { type: 'string', required: true, nonBlank: true, max: 200 }, description: { type: 'string', max: 2000 },
        quantity: { type: 'number', min: 0 }, occurrence: { type: 'number', min: 0 }, cost: { type: 'number', min: 0 },
        link: { type: 'string', re: /^((pkg|inv):)?[A-Za-z0-9._-]{1,60}$/i } } },
      links: { type: 'array', minItems: 1, maxItems: 500, items: {      // ceSetRequirementLinks: [{reqId, link: {kind, id}}]
        reqId: { type: 'string', required: true, re: /^[A-Za-z0-9._-]{1,60}$/ },
        link: { type: 'object', required: true, fields: {
          kind: { type: 'string', required: true, oneOf: ['pkg', 'inv'] }, id: { type: 'string', required: true, re: /^[A-Za-z0-9._-]{1,60}$/ } } } } }
    },
    needsOne: ['lines', 'subs', 'links'],
    run: (r, proj, prior) => {
      const q = {};
      ['lines', 'subs', 'links'].forEach(k => { if (r.args[k] && !(prior && prior[k] && prior[k].ok)) q[k] = k === 'subs' ? [r.args.subs, []] : r.args[k]; });
      return Object.keys(q).length ? updateCeSaveSteps(r.project_id, q) : {};
    },
    check: (r, res, prior) => {
      const steps = Object.assign({}, prior || {});
      ['lines', 'subs', 'links'].forEach(k => { if (res && res[k]) steps[k] = res[k].err ? { ok: false, err: String(res[k].err).slice(0, 500) } : { ok: true }; });
      if (res && res.subs && res.subs.ok && res.subs.ok.problems && res.subs.ok.problems.length) steps.subs = { ok: false, err: 'problems: ' + JSON.stringify(res.subs.ok.problems).slice(0, 300) };
      const want = ['lines', 'subs', 'links'].filter(k => r.args[k]);
      const bad = want.filter(k => !(steps[k] && steps[k].ok));
      return bad.length ? { ok: false, partial: true, steps, error: 'steps not done: ' + bad.join(', ') } : { ok: true, steps };
    }
  }
};

/* ---------- library entry (called by the adapter web app's doPost) ---------- */
// Unlike other public functions, guestGate_ runs only after the signature is checked (in zbHandle_), so an unsigned
// caller reaches no Canvas code at all: not even the save stopwatch or the open-cache bump guestGate_ does.
function zapBridge(raw, sig) {
  if (String(Session.getActiveUser().getEmail() || '')) throw new Error('This is only for the Zapier adapter.');
  return JSON.stringify(zbHandle_(String(raw || ''), String(sig || ''), Date.now()));
}

function zbHandle_(raw, sig, now) {
  let r; try { r = JSON.parse(raw); } catch (e) { return zbOut_('Rejected', {}, { error: 'body is not JSON' }); }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return zbOut_('Rejected', {}, { error: 'body must be a JSON object' });
  const props = PropertiesService.getScriptProperties();
  const auth = zbAuth_(raw, sig, r, now, props.getProperty('ZAD_SECRET'));
  if (auth) return zbOut_('Rejected', r, { error: auth });
  try { guestGate_('zapBridge', []); } catch (e) { return zbOut_('Blocked', r, { error: zbErr_(e) }); }
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);   // no 'constructor', '__proto__'
  if (own(ZB_FORBIDDEN_, r.action)) return zbOut_('Rejected', r, { error: ZB_FORBIDDEN_[r.action] });
  const a = own(ZB_ACTIONS_, r.action) ? ZB_ACTIONS_[r.action] : null;
  if (!a) return zbOut_('Rejected', r, { error: 'unknown action' });
  r.args = r.args == null ? {} : r.args;
  const bad = zbEnvelope_(r, a) || zbValidate_(r.args, a.schema, '')
    || (a.needsOne && !a.needsOne.some(k => zbOwn_(r.args, k) && Array.isArray(r.args[k]) && r.args[k].length) ? 'nothing to write: send at least one of ' + a.needsOne.join(', ') : '');
  if (bad) return zbOut_('Rejected', r, { error: bad });
  const actAs = String(props.getProperty('ZAD_ACT_AS') || '').trim().toLowerCase();
  if (!actAs) return zbOut_('Blocked', r, { error: 'adapter identity not configured' });
  if (isKiko_(actAs)) return zbOut_('Blocked', r, { error: 'adapter identity must be the dedicated bridge account, not an owner' });
  ACCT_AS_ = actAs; ACCT_ROLE_ = null; GUEST_ROLE_ = null; GUEST_OK_ = false;   // run as that user, like acctBridge
  try {
    // Exactly Manager: not Business Lead (more than the bridge needs) and not Accountant (acctRole_ maps it to Business Lead).
    if (roleOf_(actAs) !== 'Manager' || !hasFullAccess_()) return zbOut_('Blocked', r, { error: 'adapter identity must be a Manager row in Settings > Users' });
    return a.kind === 'read' ? zbRead_(r, a) : a.kind === 'queue' ? zbQueue_(r, a) : zbWrite_(r, a, now);
  } catch (e) {
    return zbOut_('Blocked', r, { error: zbErr_(e) });
  } finally { ACCT_AS_ = ''; ACCT_ROLE_ = null; GUEST_ROLE_ = null; GUEST_OK_ = false; }
}

/* ---------- checks ---------- */
function zbAuth_(raw, sig, r, now, secret) {
  if (!secret) return 'adapter not configured';
  const ts = Number(r.ts);
  if (!ts || Math.abs(now - ts) > ZB_SKEW_MS_) return 'stale or missing ts';
  const want = zbHex_(Utilities.computeHmacSha256Signature(String(r.ts) + '.' + raw, secret));
  return zbSafeEq_(want, sig.toLowerCase()) ? '' : 'bad signature';
}

function zbEnvelope_(r, a) {
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(String(r.command_id || ''))) return 'command_id missing or malformed';
  if (!String(r.task_id || '')) return 'task_id missing';
  if (a.needsProject && !ZB_PID_RE_.test(String(r.project_id || ''))) return 'project_id missing or malformed';
  if (!a.needsProject && r.project_id) return 'project_id not allowed for this action';
  if (r.expected_project_number && !ZB_PNO_RE_.test(String(r.expected_project_number))) return 'expected_project_number malformed';
  if (typeof r.args !== 'object' || Array.isArray(r.args)) return 'args must be an object';
  if (a.plan) {
    if (r.command_id !== 'plan:' + r.task_id) return 'a plan claim must use command_id plan:<task_id>';
    const cs = Array.isArray(r.args.commands) ? r.args.commands : [];
    if (!cs.length) return 'a plan needs at least one command';
    const ids = {};
    for (const c of cs) {
      if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).sort().join(',') !== 'command_id,payload_hash') return 'each plan command is exactly {command_id, payload_hash}';
      if (!/^[A-Za-z0-9:_-]{8,120}$/.test(String(c.command_id)) || /^plan:/.test(String(c.command_id))) return 'plan command_id malformed';
      if (!/^[0-9a-f]{64}$/.test(String(c.payload_hash))) return 'plan payload_hash malformed';
      if (ids[c.command_id]) return 'duplicate command_id in plan'; ids[c.command_id] = 1;
    }
    if (r.args.recovers != null && !new RegExp('^' + String(r.args.recovers).replace(/[^A-Za-z0-9:_-]/g, '') + '-recovery-[1-9]$').test(String(r.task_id)))
      return 'a recovery task must be named <recovered task>-recovery-<1..9>';
  }
  return '';
}

// Strict, recursive argument check (review 07:57Z). Schema keys are matched as own properties only, so 'constructor',
// 'toString' or '__proto__' is an unexpected argument, never a schema hit.
const zbOwn_ = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function zbValidate_(args, schema, at) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return (at ? at.slice(0, -1) : 'args') + ' must be an object';
  for (const k of Object.keys(args)) if (!zbOwn_(schema, k)) return 'unexpected argument: ' + at + k;
  for (const k of Object.keys(schema)) { const bad = zbCheck_(zbOwn_(args, k) ? args[k] : undefined, schema[k], at + k); if (bad) return bad; }
  return '';
}
function zbCheck_(v, s, name) {
  // Review 08:08Z: an explicit null is never a value, so {lines: null} or set: {category: null} can't pass as "absent".
  // '' is a value only for a plain text field, or a number field marked clearable (CE Desk sends '' to clear a cost).
  if (v === undefined) return s.required ? 'missing argument: ' + name : '';
  if (v === null) return s.required ? 'missing argument: ' + name : name + ' must not be null';
  if (v === '') {
    if (s.required) return 'missing argument: ' + name;
    if (s.nonBlank) return name + ' is blank';
    return s.type === 'string' || s.clearable ? '' : name + ' must be ' + s.type;
  }
  const t = Array.isArray(v) ? 'array' : typeof v;
  if (t !== s.type) return name + ' must be ' + s.type;
  if (t === 'string') {
    if (s.max && v.length > s.max) return name + ' is too long';
    if (s.nonBlank && !v.trim()) return name + ' is blank';
    if (s.re && !s.re.test(v)) return name + ' is not in the expected format';
    if (s.oneOf && s.oneOf.indexOf(v) < 0) return name + ' must be one of ' + s.oneOf.join(', ');
  } else if (t === 'number') {
    if (!isFinite(v)) return name + ' must be a finite number';
    if (s.min != null && v < s.min) return name + ' must be at least ' + s.min;
    if (s.positive && !(v > 0)) return name + ' must be more than 0';
  } else if (t === 'array') {
    if (s.minItems && v.length < s.minItems) return name + ' is empty';
    if (s.maxItems && v.length > s.maxItems) return name + ' has too many items';
    if (s.items) for (let i = 0; i < v.length; i++) { const bad = zbValidate_(v[i], s.items, name + '[' + i + '].'); if (bad) return bad; }
  } else if (t === 'object') {
    if (s.fields) { const bad = zbValidate_(v, s.fields, name + '.'); if (bad) return bad; }
    if (s.minKeys && Object.keys(v).length < s.minKeys) return name + ' has nothing to write';
  }
  return '';
}

// Closure statuses (PROJECT_PHASES_ in Code.gs) and Completed get the Closeout gate.
const ZB_CLOSE_RE_ = /invoic|project review|billing|payment advice|^complete/i;
function zbReadiness_(pid, want) {
  const p = ckProject_(pid), m = String(p.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const iso = m ? m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : '';
  const gate = want === 'pre' || want === 'close' ? want : (iso && iso < today) || ZB_CLOSE_RE_.test(String(p.status || '').trim()) ? 'close' : 'pre';
  const st = getChecklist(pid, gate), ev = st.eval || {}, t = (v, n) => String(v == null ? '' : v).slice(0, n);
  const live = (st.items || []).filter(it => !it.auto);
  const check = c => !c ? 'manual' : c.manual ? 'manual' : c.skip ? 'skipped' : c.err ? 'unknown' : c.met === true ? (c.reviewed ? 'met' : 'met, waiting for review') : 'not met';
  const open = live.filter(it => !it.clear).slice(0, 120).map(it => ({ id: t(it.id, 20), section: t(it.cat, 80), requirement: t(it.req, 300),
    criticality: t(it.crit, 10), applicability: t(it.eappl || it.appl, 12), status: t(it.status, 30), owner: t(it.owner, 80), due: t(it.due, 10),
    follow_up: t(it.fu, 10), next_action: t(it.next, 300), evidence: /^https:\/\//i.test(String(it.ev || '')) ? t(it.ev, 500) : '',
    check: check(it.chk), why: t(it.chk && (it.chk.err || it.chk.why), 300) }));
  return { gate, gate_name: t(st.name, 60), target_status: t(st.target, 60), today,
    project: { id: pid, name: t(p.name, 200), event_date: iso, status: t(p.status, 60) },
    counts: { blockers_open: ev.blockers || 0, blockers_total: ev.blockersTotal || 0, warnings_open: ev.warnings || 0, warnings_total: ev.warningsTotal || 0,
      waiting_on_others: ev.waiting || 0, needs_kiko: ev.needsKiko || 0, to_review: ev.toReview || 0, unchecked: ev.unchecked || 0, clear: live.length - live.filter(it => !it.clear).length },
    ready: !!ev.ready, unchecked_items: (ev.uncheckedItems || []).slice(0, 20).map(x => t(x, 300)),
    auto: (ev.auto || []).map(a => ({ key: t(a.key, 30), label: t(a.label, 120), open: (a.ids || []).length, items: (a.ids || []).slice(0, 10).map(x => t(x, 80)), error: t(a.error, 300) })),
    items: open };
}

/* ---------- payment chasers (CUE-2026-10-21, specs/payment-chasers.md) ---------- */
// Same rules as Finance Desk (Playbook.html derive): a PA row counts against the BI whose number is its Invoice reference
// (same project first; a project with one BI takes its unmatched PA rows); collected = received + WHT; the due date is
// Date filed + terms, else the BI tab's TARGET PAYMENT DATE. A BI whose Status starts with Paid, or says Cancelled/Void, is closed.
const ZB_PAY_CC_ = 'kikodacanay@blankspaceevent.com';      // Kiko 08:08Z: "copy me". Script Property PAY_CHASER_CC overrides it.
const ZB_PAY_OWN_RE_ = /@blankspaceevent\.com$/i;
const ZB_PAY_BILL_RE_ = /bill|financ|accounts? payable|\bap\b|accounting|treasur|disburs|payable|collection/i;
const ZB_PAY_TAB_ = '_Payment Chasers';
const ZB_PAY_MAX_ = 20;                                    // most BIs per read (the most overdue first; each one is a Gmail search); Cue shows 15 a day
const ZB_PAY_EMAIL_RE_ = /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,190}\.[a-z]{2,}$/i;

function zbPayTxt_(v) { const s = String(v == null ? '' : v).trim(); return /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|ERROR!|NUM!|NULL!)/.test(s) ? '' : s; }
function zbPayNum_(v) { const m = zbPayTxt_(v).replace(/[,₱\s]|PHP/gi, '').match(/^-?\d+(\.\d+)?$/); return m ? Number(m[0]) : null; }
function zbPayDay_(v) {
  if (v instanceof Date) return isNaN(v) ? '' : Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const s = zbPayTxt_(v); if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return y + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2); }
  const d = new Date(s); return isNaN(d) ? '' : d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
const zbPayPlus_ = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const zbPayDiff_ = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
const zbPayRef_ = v => { const s = zbPayTxt_(v); return /^\d+$/.test(s) ? String(Number(s)) : s.toUpperCase(); };
const zbPayTerm_ = t => { const s = String(t || ''), m = s.match(/\d+/); return m ? +m[0] : /receipt|immediate|\bcod\b|cash/i.test(s) ? 0 : null; };
const zbPayMoney_ = n => 'PHP ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Every open BI with what is still owed: [{ no, pid, project, company, ..., total, collected, balance, due, days_late }]. */
function zbPayBills_(today) {
  const B = table_(TRACKER_ID, 'BI'), A = table_(TRACKER_ID, 'PA');
  if (B.missing || !B.head.length) throw new Error('The BI tab was not found in the 2026 Project Tracker.');
  const g = (T, r, n) => { const i = col_(T, n); return i < 0 ? '' : zbPayTxt_(r[i]); };
  const bis = B.rows.filter(r => g(B, r, 'bi number')).map((r, i) => ({ row: B.rowNums ? B.rowNums[i] : 0, no: g(B, r, 'bi number'), pid: g(B, r, 'project id'),
    project: g(B, r, 'project name'), company: g(B, r, 'billed legal name') || g(B, r, 'company name'), account: g(B, r, 'account'), client: g(B, r, 'client'),
    total: zbPayNum_(g(B, r, 'total bi')), term: g(B, r, 'term'), submitted: zbPayDay_(g(B, r, 'date submitted')), filed: zbPayDay_(g(B, r, 'date filed')),
    sheet_due: zbPayDay_(g(B, r, 'target payment date')), status: g(B, r, 'status'), sent: g(B, r, 'sent to client'), pas: [] }));
  const byNo = {}; bis.forEach(b => { (byNo[zbPayRef_(b.no)] = byNo[zbPayRef_(b.no)] || []).push(b); });
  (A.missing ? [] : A.rows).forEach(r => {
    const pid = g(A, r, 'project id'), ref = g(A, r, 'invoice reference'); if (!pid && !ref) return;
    const gross = zbPayNum_(g(A, r, 'gross amount')), net = zbPayNum_(g(A, r, 'net amount paid')), wht = zbPayNum_(g(A, r, 'wht')) || 0;
    const got = (gross != null && net != null ? Math.min(gross, net) : (net != null ? net : (gross || 0))) + wht;
    const noBi = /^(no\s*(bi|invoice)|soa\b.*)$/i.test(ref), c = noBi ? [] : byNo[zbPayRef_(ref)] || [];
    let bi = c.filter(b => b.pid === pid)[0] || (c.length === 1 ? c[0] : null);
    if (!bi && !noBi) { const same = bis.filter(b => b.pid === pid); if (same.length === 1) bi = same[0]; }
    if (bi) bi.pas.push(got);
  });
  return bis.filter(b => !/^paid/i.test(b.status) && !/cancel|void/i.test(b.status)).map(b => {
    const collected = Math.round(b.pas.reduce((s, x) => s + x, 0) * 100) / 100, n = zbPayTerm_(b.term);
    const due = b.filed && n != null ? zbPayPlus_(b.filed, n) : b.sheet_due;
    const balance = b.total == null ? null : Math.max(Math.round((b.total - collected) * 100) / 100, 0);
    return Object.assign(b, { collected, balance, due, days_late: due ? zbPayDiff_(today, due) : null });
  });
}

/** The people to chase per BI: billing contact first (Client Desk P0 Contacts, then project contacts), then the invoice's own contact. */
function zbPayContacts_() {
  const P = table_(SRC.ADMIN, 'PROJ Contacts'), K = table_(CD.sheetId, CD.contactsTab);
  const g = (T, r, n) => { const i = col_(T, n); return i < 0 ? '' : zbPayTxt_(r[i]); };
  const proj = (P.missing ? [] : P.rows).map(r => ({ pid: g(P, r, 'project id'), name: g(P, r, 'contact name'), role: g(P, r, 'role / title'), email: g(P, r, 'email').toLowerCase() }));
  const co = (K.missing ? [] : K.rows).map(r => ({ company: norm_(g(K, r, 'company')), name: g(K, r, 'contact name'), email: g(K, r, 'email address').toLowerCase(),
    role: [g(K, r, 'position / title'), g(K, r, 'department / function'), g(K, r, 'relationship'), g(K, r, 'role group')].join(' '),
    gone: !!g(K, r, 'exception date') || g(K, r, 'email / contact status') === CD.bounced }))
    .filter(c => !c.gone);
  const ok = c => ZB_PAY_EMAIL_RE_.test(c.email) && !ZB_PAY_OWN_RE_.test(c.email);
  return b => {
    const names = [b.company, b.account].filter(String).map(norm_), mine = co.filter(c => names.indexOf(c.company) >= 0 && ok(c)), pc = proj.filter(c => c.pid === b.pid && ok(c));
    const pick = (c, how) => ({ to: c.email, to_name: c.name, to_source: how });
    const bill = mine.filter(c => ZB_PAY_BILL_RE_.test(c.role))[0]; if (bill) return pick(bill, 'billing contact (Client Desk)');
    const pbill = pc.filter(c => ZB_PAY_BILL_RE_.test(c.role))[0]; if (pbill) return pick(pbill, 'billing contact (project contacts)');
    const who = norm_(String(b.client || '').split(/\r?\n/)[0]);
    const inv = who && (pc.concat(mine).filter(c => norm_(c.name) === who)[0]); if (inv) return pick(inv, 'invoice contact');
    return { to: '', to_name: String(b.client || '').split(/\r?\n/)[0].slice(0, 120), to_source: '' };
  };
}

/** The info@ thread that sent this BI to the client, and whether the client wrote back after BSE's last message. */
function zbPayThread_(b) {
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(), own = a => a === me || ZB_PAY_OWN_RE_.test(a);
  const addrs = s => (String(s || '').match(/[^\s<>,;"']+@[^\s<>,;"']+/g) || []).map(x => x.toLowerCase());
  const word = new RegExp('(^|[^0-9A-Za-z])' + b.no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9A-Za-z]|$)');
  const threads = GmailApp.search('in:sent "' + b.no.replace(/"/g, '') + '" newer_than:400d', 0, 10);
  for (const t of threads) {
    const msgs = t.getMessages();
    const first = msgs.filter(m => own(addrs(m.getFrom())[0] || '') && addrs(m.getTo() + ',' + m.getCc()).some(a => !own(a))
      && word.test(m.getSubject() + '\n' + m.getPlainBody().slice(0, 20000)) && /\b(BI|billing|invoice|SOA|statement)\b/i.test(m.getSubject() + ' ' + m.getPlainBody().slice(0, 4000)))[0];
    if (!first) continue;
    const i = msgs.indexOf(first), later = msgs.slice(i), lastOwn = later.filter(m => own(addrs(m.getFrom())[0] || '')).pop();
    const reply = later.filter(m => m.getDate() > lastOwn.getDate() && !own(addrs(m.getFrom())[0] || '')).pop();
    return { thread_id: t.getId(), message_id: String(first.getHeader('Message-ID') || ''), subject: String(first.getSubject() || '').slice(0, 200),
      sent_on: zbPayDay_(first.getDate()), to: addrs(first.getTo()).filter(a => !own(a)), cc: addrs(first.getCc()).filter(a => !own(a)),
      last_from_bse: zbPayDay_(lastOwn.getDate()),
      client_replied: reply ? { on: zbPayDay_(reply.getDate()), from: addrs(reply.getFrom())[0] || '', snippet: String(reply.getPlainBody() || '').replace(/\s+/g, ' ').slice(0, 240) } : null };
  }
  return null;
}

function zbOverdueBillings_(minLate) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const open = zbPayBills_(today), skipped = [];
  const late = open.filter(b => b.days_late != null && b.days_late >= minLate && (b.balance == null || b.balance > 0.005));
  late.forEach(b => { if (b.balance == null) skipped.push({ no: b.no, project: b.project, why: 'The BI has no total, so the amount owed is unknown.' }); });
  const list = late.filter(b => b.balance != null).sort((a, b) => b.days_late - a.days_late), use = list.slice(0, ZB_PAY_MAX_);
  let who = null; try { who = zbPayContacts_(); } catch (e) { who = null; skipped.push({ no: '', project: '', why: 'Contacts could not be read: ' + zbErr_(e) }); }
  return { today, min_days_late: minLate, more: list.length - use.length, skipped: skipped.slice(0, 20), bis: use.map(b => {
    let th = null, thErr = ''; try { th = zbPayThread_(b); } catch (e) { thErr = zbErr_(e); }
    const c = who ? who(b) : { to: '', to_name: '', to_source: '' };
    if (!c.to && th && th.to.length) Object.assign(c, { to: th.to[0], to_source: 'original BI email' });
    return { no: b.no, project_id: b.pid, project: b.project.slice(0, 200), company: (b.company || b.account).slice(0, 200), client: String(b.client || '').split(/\r?\n/)[0].slice(0, 120),
      total: b.total, collected: b.collected, balance: b.balance, total_text: zbPayMoney_(b.total), balance_text: zbPayMoney_(b.balance),
      submitted: b.submitted, filed: b.filed, terms: b.term.slice(0, 60), due: b.due, days_late: b.days_late, sent_to_client: b.sent.slice(0, 60),
      to: c.to, to_name: c.to_name, to_source: c.to_source, thread: th, thread_error: thErr };
  }) };
}

/** Sends (or drafts) one approved payment chaser from info@, CC Kiko. Once only per key. */
function zbPaySend_(a) {
  const bis = a.bis.map(String), bad = bis.filter(x => !/^[A-Za-z0-9-]{1,30}$/.test(x));
  if (bad.length) return { ok: false, error: 'BI number not in the expected format: ' + bad[0] };
  if (ZB_PAY_OWN_RE_.test(a.to)) return { ok: false, error: 'A payment chaser goes to the client, not to a BSE address.' };
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const open = zbPayBills_(today), by = {}; open.forEach(b => { by[zbPayRef_(b.no)] = b; });
  let owed = 0;
  for (const no of bis) {
    const b = by[zbPayRef_(no)];
    if (!b || b.balance == null || b.balance <= 0.005) return { ok: false, error: 'BI ' + no + ' is no longer open (paid, cancelled or fully collected). Nothing was sent.' };
    owed += b.balance;
  }
  owed = Math.round(owed * 100) / 100;
  if (Math.abs(owed - a.balance) > 0.005) return { ok: false, error: 'The balance changed from ' + zbPayMoney_(a.balance) + ' to ' + zbPayMoney_(owed) + ' since the batch was built. Nothing was sent; run the sweep again.' };
  // Code, not ChatGPT, guarantees the figures: the email must name every BI and state the balance (in total, or per BI).
  const flat = String(a.body).replace(/,/g, '');
  const says = n => flat.indexOf(Number(n).toFixed(2)) >= 0 || (Math.round(n) === n && new RegExp('(^|[^0-9.])' + n + '([^0-9]|$)').test(flat));
  const missing = bis.filter(no => !new RegExp('(^|[^0-9A-Za-z])' + no + '([^0-9A-Za-z]|$)').test(a.body));
  if (missing.length) return { ok: false, error: 'The email does not mention BI ' + missing.join(', ') + '. Nothing was sent.' };
  if (!says(owed) && !bis.every(no => says(by[zbPayRef_(no)].balance))) return { ok: false, error: 'The email must state the balance (' + zbPayMoney_(owed) + '). Nothing was sent.' };
  const cc = String(PropertiesService.getScriptProperties().getProperty('PAY_CHASER_CC') || ZB_PAY_CC_).trim();
  // Once only: the key's row is claimed under the lock before anything goes out.
  const L = zbPayLedger_();
  const was = locked_(() => { const row = L.get(a.key, a.mode); if (!row) L.put(a, 'Sending', '', ''); return row; });
  if (was && (was.status === 'Sent' || was.status === 'Drafted')) return { ok: true, replayed: true, id: was.id, mode: a.mode, to: a.to, cc };
  if (was && was.status === 'Sending') return { ok: false, error: 'An earlier try of this chaser may have gone out. Check info@\'s Sent mail; nothing was sent now.' };
  let th = null;
  if (a.thread_id) {
    try { th = GmailApp.getThreadById(a.thread_id); } catch (e) { th = null; }
    // Only a thread that is about one of these BIs: Cue can't point Canvas at any other info@ thread.
    if (th && !th.getMessages().some(m => bis.some(no => new RegExp('(^|[^0-9A-Za-z])' + no + '([^0-9A-Za-z]|$)').test(m.getSubject() + '\n' + m.getPlainBody().slice(0, 20000))))) th = null;
  }
  try {
    const out = zbPayMail_(a, cc, th);
    L.put(a, a.mode === 'send' ? 'Sent' : 'Drafted', out.id, '');
    try { logEvent(a.mode === 'send' ? 'Sent payment chaser' : 'Drafted payment chaser', 'Cue', 'BI ' + bis.join(', ') + ' to ' + a.to + ' (' + zbPayMoney_(owed) + ')'); } catch (e) { /* logging never blocks */ }
    return { ok: true, id: out.id, threaded: out.threaded, mode: a.mode, to: a.to, cc, balance: owed };
  } catch (e) {
    // Gmail answered with an error, so nothing went out: the key may be tried again.
    L.put(a, 'Failed', '', zbErr_(e));
    return { ok: false, error: 'Gmail did not ' + (a.mode === 'send' ? 'send' : 'save') + ' it: ' + zbErr_(e) };
  }
}

/** A reply in the BI's own thread when there is one (Gmail advanced service keeps it threaded for the client too). */
function zbPayMail_(a, cc, th) {
  const last = th ? th.getMessages().pop() : null, ref = last ? String(last.getHeader('Message-ID') || '') : '';
  const subj = th ? (/^re:/i.test(th.getFirstMessageSubject()) ? '' : 'Re: ') + th.getFirstMessageSubject() : String(a.subject).replace(/[\r\n]+/g, ' ');
  if (typeof Gmail !== 'undefined' && Gmail.Users) {
    const enc = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Utilities.base64Encode(s, Utilities.Charset.UTF_8) + '?=';
    const head = ['To: ' + a.to, 'Cc: ' + cc, 'Subject: ' + enc(subj.slice(0, 250)), 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64']
      .concat(ref ? ['In-Reply-To: ' + ref, 'References: ' + ref] : []);
    const raw = Utilities.base64EncodeWebSafe(head.join('\r\n') + '\r\n\r\n' + Utilities.base64Encode(String(a.body), Utilities.Charset.UTF_8), Utilities.Charset.UTF_8);
    const msg = th ? { raw, threadId: th.getId() } : { raw };
    if (a.mode === 'send') return { id: Gmail.Users.Messages.send(msg, 'me').id, threaded: !!th };
    return { id: Gmail.Users.Drafts.create({ message: msg }, 'me').id, threaded: !!th };
  }
  // No advanced service: same subject, so it threads in info@ and usually for the client.
  if (a.mode === 'send') { GmailApp.sendEmail(a.to, subj, String(a.body), { cc }); return { id: 'sent', threaded: false }; }
  return { id: GmailApp.createDraft(a.to, subj, String(a.body), { cc }).getId(), threaded: false };
}

function zbPayLedger_() {
  const id = PropertiesService.getScriptProperties().getProperty('ZAD_LEDGER_ID');
  if (!id) throw new Error('ledger not configured');
  const ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName(ZB_PAY_TAB_) || ss.insertSheet(ZB_PAY_TAB_);
  const HEAD = ['key', 'mode', 'bis', 'to', 'balance', 'status', 'id', 'error', 'updated'];
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  const all = () => sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, HEAD.length).getValues();
  return {
    get: (key, mode) => { const v = all().filter(x => String(x[0]) === key && String(x[1]) === mode && String(x[5]) !== 'Failed')[0]; return v ? { status: String(v[5]), id: String(v[6]) } : null; },
    put: (a, status, mid, err) => {
      const rows = all(), i = rows.findIndex(x => String(x[0]) === a.key && String(x[1]) === a.mode);
      const vals = [a.key, a.mode, a.bis.join(', '), a.to, a.balance, status, mid, String(err || '').slice(0, 300), new Date().toISOString()];
      if (i >= 0) sh.getRange(i + 2, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
    }
  };
}

function zbSaveFile_(r) {
  const x = zbProject_(r); if (x.error) return { ok: false, error: x.error };
  const a = r.args, bytes = Utilities.base64Decode(a.data);
  // own = the project's real Drive folder; otherwise paRoot_ falls back to Canvas Files/<id> (a project with no folder yet, e.g. no event date).
  const root = paRoot_(r.project_id, true), dest = childFolder_(root.folder, a.type), own = !!root.own;
  const want = r.project_id + ' · ' + String(a.name).trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 150);
  for (const it = dest.getFilesByName(want); it.hasNext();) {
    const f = it.next(); if (!f.isTrashed() && f.getSize() === bytes.length) return { ok: true, url: f.getUrl(), name: f.getName(), type: a.type, existed: true, in_project_folder: own };
  }
  const up = saveProjectFile_(r.project_id, a.type, a.name, a.mime, a.data, dest.getUrl());
  try { up.file.setDescription('Linked to: Project · Added by: Cue (' + a.request_id + ')'); } catch (e) { /* the note is optional */ }
  try { logEvent('Uploaded document', 'Projects', r.project_id + ': ' + up.name + ' (' + a.type + ', from Cue)'); } catch (e) { /* logging never blocks */ }
  return { ok: true, url: up.url, name: up.name, type: a.type, existed: false, in_project_folder: own };
}

// The project must exist in the Admin Directory and, when the caller names a number, carry it.
function zbProject_(r) {
  let p; try { p = getProject(r.project_id, ['admin']).project; } catch (e) { return { error: zbErr_(e) }; }
  if (!p || p.id !== r.project_id) return { error: 'project not found' };
  if (r.expected_project_number && String(p.number || '') !== String(r.expected_project_number)) return { error: 'project number mismatch' };
  return { p };
}

/* ---------- read / write ---------- */
function zbRead_(r, a) {
  if (a.needsProject) { const x = zbProject_(r); if (x.error) return zbOut_('Blocked', r, { error: x.error }); }
  return zbOut_('Completed', r, { result: a.run(r), evidence: { read_at: new Date().toISOString() } });
}

// AI Queue actions: no command ledger (request_id is the key). A refused request is Rejected; a Canvas error is Blocked.
function zbQueue_(r, a) {
  let res; try { res = a.run(r); } catch (e) { return zbOut_('Blocked', r, { error: zbErr_(e) }); }
  if (res && res.ok === false) return zbOut_('Rejected', r, { error: String(res.error || 'refused') });
  return zbOut_('Completed', r, { result: res });
}

function zbWrite_(r, a, now) {
  const body = zbPayloadHash_(r);
  const ik = r.action === 'add_project' ? String(r.args.intake_key) : '';
  // 1. Claim under the app's lock, so two claims can't both start.
  const claim = locked_(() => {
    const led = zbLedger_(), row = led.get(r.command_id);
    if (row && row.body_hash !== body && a.plan) return { out: zbOut_('Rejected', r, { error: 'this task already has a different plan', original_status: row.status, result: row.result && row.result.result }) };
    if (row && row.body_hash !== body) return { out: zbOut_('Rejected', r, { error: 'command_id reused with different content' }) };
    if (row && row.status === 'Completed') return { out: zbReplay_(r, row) };   // a replay writes nothing, so it needs no live plan
    if (row && row.status === 'Superseded') return { out: zbOut_('Rejected', r, { error: 'this plan was superseded by recovery task ' + ((row.result || {}).superseded_by || '?'), original_status: 'Superseded' }) };
    if (a.plan && r.args.recovers && !row) { const bad = zbSupersede_(led, r, now); if (bad) return { out: bad }; }
    if (!a.plan) {   // every write must be a command of this task's claimed plan, with exactly the claimed payload
      const pl = led.get('plan:' + r.task_id), cmds = pl && pl.status === 'Completed' && pl.result && pl.result.result ? pl.result.result.commands || [] : null;
      if (pl && pl.status === 'Superseded') return { out: zbOut_('Rejected', r, { error: 'this task\'s plan was superseded by recovery task ' + ((pl.result || {}).superseded_by || '?') + '; nothing of it can write now' }) };
      if (!cmds) return { out: zbOut_('Rejected', r, { error: 'no claimed plan for this task' }) };
      const c = cmds.find(x => x.command_id === r.command_id);
      if (!c) return { out: zbOut_('Rejected', r, { error: 'command is not in the claimed plan for this task' }) };
      if (c.payload_hash !== body) return { out: zbOut_('Rejected', r, { error: 'command payload differs from the claimed plan' }) };
    }
    if (row && row.status === 'Claimed' && now - row.updated < ZB_STALE_MS_) return { out: zbOut_('Blocked', r, { error: 'in progress' }) };
    // A repeat that may not run again says what the first attempt left behind (original_status and its stored outcome).
    const was = (error) => ({ out: zbOut_('Blocked', r, { error, original_status: row.status, original_at: row.result && row.result.at,
      result: row.result && row.result.result, steps: row.result && row.result.steps, evidence: row.result && row.result.evidence }) });
    if (row && row.status === 'Claimed' && !a.retrySafe) return was('earlier attempt never reported back; needs manual review');
    if (row && row.status === 'Partial' && !a.resumable) return was('earlier attempt partly succeeded; needs manual review');
    if (row && row.status === 'Partial' && !(row.result && row.result.steps && !row.result.steps.omitted)) return was('earlier steps are not readable; needs manual review');
    if (row && row.status === 'Uncertain' && !a.retrySafe) return was('earlier attempt is uncertain; needs manual review');
    if (ik) {
      const twin = led.byIntake(ik, r.command_id);
      if (twin) return { out: twin.status === 'Completed' ? zbReplay_(r, twin, twin.command_id)
        : zbOut_('Blocked', r, { error: 'same inquiry is ' + twin.status + ' under ' + twin.command_id, original_status: twin.status, result: twin.result && twin.result.result }) };
    }
    led.put(r, ik, body, 'Claimed', row && row.result, now);
    return { had: !!row, prior: row && row.result ? (row.result.steps ? { steps: row.result.steps } : row.result.result) : null };
  });
  if (claim.out) return claim.out;
  const led = zbLedger_();
  // The whole outcome is stored, so a replay can return exactly what happened the first time.
  const done = (status, extra) => { const at = Date.now();
    locked_(() => led.put(r, ik, body, status, { status, result: extra.result, steps: extra.steps, evidence: extra.evidence, error: extra.error, at: new Date(at).toISOString() }, at));
    return zbOut_(status, r, extra); };

  // 2. Identity check for writes on an existing project.
  let proj = null;
  if (a.needsProject) { const x = zbProject_(r); if (x.error) return done('Rejected', { error: x.error }); proj = x.p; }

  // 3. Reconcile: an earlier claim with no recorded outcome may have landed.
  if (claim.had && a.find) { const f = a.find(r); if (f) return done('Completed', { result: f, evidence: { reconciled: true } }); }
  // A first attempt: a matching project that already exists is someone else's, not ours to claim.
  if (!claim.had && a.find) { const f = a.find(r); if (f) return done('Blocked', { result: f, error: 'a project with this name and date already exists; link it or send an amendment' }); }

  // 4. Run, then read back.
  let res;
  try { res = a.run(r, proj, claim.prior && claim.prior.steps ? claim.prior.steps : claim.prior); }
  catch (e) {
    const msg = zbErr_(e);
    if (/Another save is in progress/.test(msg)) return done('Blocked', { error: 'busy, retry later' });   // locked_ refused: nothing written
    if (a.find) { const f = a.find(r); if (f) return done('Completed', { result: f, evidence: { reconciled: true } }); }
    return done('Uncertain', { error: msg });
  }
  const c = a.check(r, res, claim.prior && claim.prior.steps);
  if (c.ok) return done('Completed', { result: c.steps ? { steps: c.steps } : res, steps: c.steps, evidence: c.evidence });
  return done(c.partial ? 'Partial' : 'Uncertain', { result: c.steps ? { steps: c.steps } : res, steps: c.steps, error: c.error, evidence: c.evidence });
}

// A repeat of a finished command: the stored original, never a fresh "Completed".
function zbReplay_(r, row, under) {
  const o = row.result || {};
  return zbOut_('Replayed', r, { original_status: row.status, original_at: o.at, result: o.result, steps: o.steps, evidence: o.evidence,
    error: o.error, replay_of: under, result_bounded: o.bounded || o.unreadable || undefined });
}

// Recovery (review 07:57Z). Runs under the lock, inside the recovery task's first claim_plan. The original plan must be
// claimed, have at least one command that didn't complete, and have nothing in progress. It is then marked Superseded,
// so no command of the original task can write again (replays of finished ones still answer).
function zbSupersede_(led, r, now) {
  const rec = String(r.args.recovers), orig = led.get('plan:' + rec);
  if (!orig || orig.status !== 'Completed') return zbOut_('Rejected', r, { error: 'the task being recovered has no claimed plan' });
  const cmds = (orig.result && orig.result.result && orig.result.result.commands) || [], rows = led.byTask(rec);
  if (rows.some(x => x.status === 'Claimed' && now - x.updated < ZB_STALE_MS_)) return zbOut_('Blocked', r, { error: 'a command of ' + rec + ' is in progress' });
  const open = cmds.filter(c => { const x = rows.find(y => y.command_id === c.command_id); return !x || x.status !== 'Completed'; });
  if (!open.length) return zbOut_('Rejected', r, { error: 'every command of ' + rec + ' completed; nothing to recover' });
  led.put({ command_id: 'plan:' + rec, action: 'claim_plan', project_id: '', task_id: rec }, '', orig.body_hash, 'Superseded',
    Object.assign({}, orig.result, { superseded_by: r.task_id, superseded_at: new Date(now).toISOString(), open: open.map(c => c.command_id) }), now);
  return null;
}

// add_project reconcile: the Directory already has a project with this name and date (addProject refuses a second one).
function zbFindProject_(name, date) {
  const want = (s) => String(s || '').trim().toLowerCase(), d = zbDate_(date);
  const hit = (getProjectBoard().projects || []).filter(p => want(p.name) === want(name) && zbDate_(p.date) === d);
  return hit.length === 1 ? { project_id: hit[0].id, reconciled: true } : null;
}

/* ---------- ledger ---------- */
function zbLedger_() {
  const id = PropertiesService.getScriptProperties().getProperty('ZAD_LEDGER_ID');
  if (!id) throw new Error('ledger not configured');
  const ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName(ZB_TAB_) || ss.insertSheet(ZB_TAB_);
  if (sh.getLastRow() === 0) sh.appendRow(ZB_HEAD_);
  const all = () => sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, ZB_HEAD_.length).getValues();
  const parse = (t) => { try { return JSON.parse(t || 'null'); } catch (e) { return { unreadable: true }; } };   // rows cut by older drafts
  const rowOf = (v) => ({ command_id: String(v[0]), body_hash: v[4], status: v[5], result: parse(v[6]), task_id: String(v[7]), updated: new Date(v[9]).getTime() });
  return {
    get: (cid) => { const v = all().find(x => String(x[0]) === cid); return v ? rowOf(v) : null; },
    byTask: (task) => all().filter(x => String(x[7]) === task).map(rowOf),
    byIntake: (ik, cid) => { const v = all().find(x => String(x[3]) === ik && String(x[0]) !== cid && String(x[5]) !== 'Rejected'); return v ? rowOf(v) : null; },
    put: (r, ik, body, status, result, now) => {
      const rows = all(), i = rows.findIndex(x => String(x[0]) === r.command_id), iso = new Date(now).toISOString();
      const vals = [r.command_id, r.action, r.project_id || '', ik, body, status, zbCell_(result),
        r.task_id, i >= 0 ? rows[i][8] : iso, iso];
      if (i >= 0) sh.getRange(i + 2, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
    }
  };
}

// Review 07:57Z: never cut JSON. Sheets holds at most 50,000 characters in a cell. An outcome over ZB_CELL_MAX_ keeps
// status, time, error, steps and the plan's commands, and its large parts become {omitted, chars, sha256} markers.
const ZB_CELL_MAX_ = 45000;
function zbCell_(o) {
  const s = JSON.stringify(o == null ? null : o);
  if (s.length <= ZB_CELL_MAX_) return s;
  const fit = (v, n) => { if (v === undefined) return undefined; const t = JSON.stringify(v); return t.length <= n ? v : { omitted: true, chars: t.length, sha256: zbHash_(t) }; };
  const keep = o.result && o.result.commands ? { plan_hash: o.result.plan_hash, commands: o.result.commands, recovers: o.result.recovers } : null;
  const b = Object.assign({}, o, { bounded: true, error: o.error == null ? undefined : String(o.error).slice(0, 1000),
    steps: fit(o.steps, 8000), evidence: fit(o.evidence, 8000), result: keep || fit(o.result, 20000) });
  const t = JSON.stringify(b);
  return t.length <= ZB_CELL_MAX_ ? t : JSON.stringify({ status: o.status, at: o.at, bounded: true, result: { omitted: true, chars: s.length, sha256: zbHash_(s) } });
}

/* ---------- helpers ---------- */
function zbOut_(status, r, extra) {
  const okNow = status === 'Completed' || (status === 'Replayed' && (extra || {}).original_status === 'Completed');
  const o = Object.assign({ ok: okNow, action_ok: okNow, completes_intake: false, status, adapter: ZB_VERSION_,
    command_id: String((r && r.command_id) || '').slice(0, 120), action: String((r && r.action) || '').slice(0, 60) }, extra || {});
  Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
  return o;
}
function zbNum_(v, dflt) { return typeof v === 'number' && isFinite(v) ? v : (dflt == null ? '' : dflt); }
function zbDate_(s) {
  const t = String(s || '').trim(); let m;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return +m[1] + '-' + +m[2] + '-' + +m[3];
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return +m[3] + '-' + +m[1] + '-' + +m[2];
  return t;
}
function zbErr_(e) { return String((e && e.message) || e).slice(0, 300); }
function zbHex_(b) { return b.map(x => ('0' + (x & 255).toString(16)).slice(-2)).join(''); }
// The payload a command is bound to. zap-steps.js computes the same hash before the plan is claimed.
function zbPayloadHash_(r) { return zbHash_(JSON.stringify([r.action, r.project_id || '', r.expected_project_number || '', r.args])); }
function zbHash_(s) { return zbHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))); }
function zbSafeEq_(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
