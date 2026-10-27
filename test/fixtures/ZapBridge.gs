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
 *   One exception (CUE-EXPENSE-2026-10-21): record_expense, for one expense Kiko approved on Cue's card, may add its supplier
 *   entry, award it when the scope has no award yet, and record the payment Kiko already made. It never moves an award.
  },
 *   CUE-SUPPLIER-2026-10-21: register_supplier adds one NEW supplier Kiko approved on Cue's card (row, contacts, accreditation
 *   row); it never edits or deletes an existing supplier and never sets Accreditation Status or a verification column.
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
// Supplier Database columns Cue may fill on a new supplier (AIS_FIELDS_ in canvas-ai/AiSupplier.gs) and the accreditation documents (ACCR_DOC_ labels).
const ZB_SUP_FIELDS_ = ['Supplier', 'Common / Display Name', 'Address', 'City', 'Province', 'Owner/Manager', 'Website/Social Media', 'Main Service',
  'Secondary Service', 'Supplier Type', 'Business Type', 'TIN', 'TIN Status', 'Company Email', 'Bank', 'Account Name', 'AccountNumber']
  .reduce((o, h) => { o[h] = { type: 'string', max: h === 'Address' ? 500 : 200 }; return o; }, {});
ZB_SUP_FIELDS_['Supplier'] = { type: 'string', required: true, nonBlank: true, max: 200 };
const ZB_SUP_DOCS_ = ['DTI permit', 'SEC certificate', 'Business Permit', 'Sample invoice', 'Government ID 1', 'Government ID 2'];
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
  /* CUE-PHASED-2026-10-21 (Kiko 14:57Z "build", specs/phased-intake.md): the phased intake. Each phase writes only what Kiko
   * approved on that phase's card. The AI Queue row is the ledger (canvas-ai/AiIntake.gs aiIntakePhase*_), so phases 1 and 2
   * write once and a repeat returns the stored outcome; phase 3 overwrites; phase 4 only records RFQs Kiko's Gmail sent. */
  intake_add_project: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      project: { type: 'object', required: true, fields: {
        client: { type: 'object', required: true, fields: { company: { type: 'string', max: 200 }, contact: { type: 'string', max: 200 },
          email: { type: 'string', max: 200 }, phone: { type: 'string', max: 60 },
          contacts: { type: 'array', maxItems: 10, items: { name: { type: 'string', max: 200 }, role: { type: 'string', max: 100 },
            email: { type: 'string', max: 200 }, phone: { type: 'string', max: 60 } } }, industry: { type: 'string', max: 100 } } },
        event: { type: 'object', required: true, fields: { name: { type: 'string', max: 200 }, type: { type: 'string', max: 100 },
          date: { type: 'string', max: 10, re: /^\d{4}-\d{2}-\d{2}$/ }, deadline: { type: 'string', max: 10, re: /^\d{4}-\d{2}-\d{2}$/ },
          schedule: { type: 'object', fields: { ingress: { type: 'string', max: 100 }, hours: { type: 'string', max: 100 }, egress: { type: 'string', max: 100 } } },
          venue: { type: 'string', max: 200 }, city: { type: 'string', max: 100 },
          pax: { type: 'number', min: 0 }, budget: { type: 'string', max: 100 }, date_tbc: { type: 'boolean' } } } } } },
    run: (r) => aiIntakePhaseProject_(r.args.request_id, r.args.project, 'zap_' + r.command_id)
  },
  /* CUE-CLIENT-REG-2026-10-24 (Kiko 13:36Z, specs/bid-contacts-reminder.md part B): what phase 1 Approve will do in Client Desk, shown on
   * Cue's phase 1 card before the tap. Read only: is the company in P0, and how many of the contacts P0 Contacts does not list yet. */
  client_check: {
    kind: 'read', needsProject: false,
    schema: { company: { type: 'string', required: true, nonBlank: true, max: 200 },
      contacts: { type: 'array', maxItems: 10, items: { name: { type: 'string', max: 200 }, email: { type: 'string', max: 200 } } } },
    run: (r) => { if (!aiIntakeClientDeskOn_()) return { ok: false, error: 'Client Desk registration is off (Script Property CLIENT_DESK)' };
      return aiIntakeClientDesk_(aiIntakeClient_({ company: r.args.company, contacts: r.args.contacts || [] }), '', true); }
  },
  intake_add_lines: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      lines: { type: 'array', required: true, minItems: 1, maxItems: 40, items: {
        key: { type: 'string', required: true, re: /^R\d{1,3}$/ }, category: { type: 'string', max: 200 },
        description: { type: 'string', required: true, nonBlank: true, max: 2000 }, search_terms: { type: 'string', max: 80 },
        quantity: { type: 'number', required: true, positive: true }, occurrence: { type: 'number', positive: true },
        status: { type: 'string', oneOf: ['included', 'optional'] } } } },
    run: (r) => aiIntakePhaseLines_(r.args.request_id, r.args.lines)
  },
  intake_save_costs: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      lines: { type: 'array', required: true, minItems: 1, maxItems: 40, items: {
        key: { type: 'string', required: true, re: /^R\d{1,3}$/ },
        execution: { type: 'string', required: true, oneOf: ['In House', 'Outsourced'] }, why: { type: 'string', max: 600 },
        unit_cost: { type: 'number', min: 0 }, cost_basis: { type: 'string', required: true, oneOf: ['past quotes', 'owned stock', 'none', 'set by Kiko', 'market research'] },
        price_source: { type: 'string', max: 60 }, unit_price: { type: 'number', min: 0 },
        price_basis: { type: 'string', oneOf: ['BSE package', 'BSE price list', 'past CE prices', 'market research', 'set by Kiko', 'none'] },
        price_sources: { type: 'array', maxItems: 8 }, sources: { type: 'array', maxItems: 8 }, note: { type: 'string', max: 600 } } },
      totals: { type: 'object', required: true, fields: { known_cost: { type: 'number', min: 0 }, known_price: { type: 'number', min: 0 } } } },
    run: (r) => aiIntakePhaseCosts_(r.args.request_id, { lines: r.args.lines, totals: r.args.totals })
  },
  intake_log_rfqs: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      rfqs: { type: 'array', required: true, minItems: 1, maxItems: 40, items: {
        supplier: { type: 'string', required: true, nonBlank: true, max: 200 }, email: { type: 'string', max: 200 },
        keys: { type: 'array', maxItems: 40 }, subject: { type: 'string', max: 200 },
        state: { type: 'string', required: true, oneOf: ['sent', 'draft', 'cancelled'] }, gmail_id: { type: 'string', max: 100 } } } },
    run: (r) => aiIntakePhaseRfqs_(r.args.request_id, r.args.rfqs)
  },
  /* CUE-UNDO-2026-10-21 (Kiko 16:53Z): a cancelled intake takes back what it wrote (AiIntake.gs aiIntakeRemove_). Cue asks Kiko first. */
  intake_remove: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', re: /^[A-Za-z0-9:_-]{8,80}$/ }, project_id: { type: 'string', re: /^S-\d{3,12}[A-Z0-9]{2}$/ } },
    run: (r) => aiIntakeRemove_(r.args.request_id, r.args.project_id)
  },
  find_similar_projects: {
    kind: 'read', needsProject: false,
    schema: { client: { type: 'string', max: 200 }, date: { type: 'string', max: 10 }, name: { type: 'string', max: 200 } },
    run: (r) => aiIntakeSimilar_(r.args)
  },
  /* CUE-LINKS-2026-10-21 (Kiko "Go" 19:46Z, specs/open-in-canvas.md). canvas_link: Canvas's own web address, so Cue needs no setup.
   * handoff_put: bank details for one Add supplier / edit supplier page, kept in the script cache for 10 minutes under a
   * one-time code. The link Cue opens carries only the code (&h=); SupportDesk swaps it once (cueHandoffTake). A read: nothing
   * goes in the command ledger, so the details are never written to a sheet. */
  canvas_link: {
    kind: 'read', needsProject: false, schema: {},
    run: () => ({ url: zbCanvasUrl_() })
  },
  handoff_put: {
    kind: 'read', needsProject: false,
    schema: { bank: { type: 'string', max: 200 }, acctName: { type: 'string', max: 200 }, acctNo: { type: 'string', max: 60 } },
    run: (r) => cueHandoffPut_(r.args)
  },
  search_projects: {
    kind: 'read', needsProject: false,
    schema: { query: { type: 'string', required: true, nonBlank: true, max: 200 }, limit: { type: 'number', min: 1, max: 10 } },
    run: (r) => aiProjectSearch_(r.args)
  },
  submit_intake: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      proposal: { type: 'object', required: true, fields: {
        // C1 (Kiko approved the intake spec 07:46Z): every contact (G2), the proposal deadline and schedule (G1, G3), and an
        // empty date for a Date TBC project (G4). Canvas cleans and re-checks all of it in aiIntakeSubmit_.
        client: { type: 'object', required: true, fields: { company: { type: 'string', max: 200 }, contact: { type: 'string', max: 200 },
          email: { type: 'string', max: 200 }, phone: { type: 'string', max: 60 },
          contacts: { type: 'array', maxItems: 10, items: { name: { type: 'string', max: 200 }, role: { type: 'string', max: 100 },
            email: { type: 'string', max: 200 }, phone: { type: 'string', max: 60 } } } } },
        event: { type: 'object', required: true, fields: { name: { type: 'string', max: 200 }, type: { type: 'string', max: 100 },
          date: { type: 'string', max: 10, re: /^\d{4}-\d{2}-\d{2}$/ }, deadline: { type: 'string', max: 10, re: /^\d{4}-\d{2}-\d{2}$/ },
          schedule: { type: 'object', fields: { ingress: { type: 'string', max: 100 }, hours: { type: 'string', max: 100 }, egress: { type: 'string', max: 100 } } },
          venue: { type: 'string', max: 200 }, city: { type: 'string', max: 100 },
          pax: { type: 'number', min: 0 }, budget: { type: 'string', max: 100 }, date_tbc: { type: 'boolean' } } },
        lines: { type: 'array', required: true, minItems: 1, maxItems: 40, items: {
          key: { type: 'string', required: true, re: /^R\d{1,3}$/ }, category: { type: 'string', max: 200 },
          description: { type: 'string', required: true, nonBlank: true, max: 2000 }, search_terms: { type: 'string', max: 80 },
          quantity: { type: 'number', required: true, positive: true }, occurrence: { type: 'number', positive: true },
          execution: { type: 'string', required: true, oneOf: ['In House', 'Outsourced'] }, why: { type: 'string', max: 600 },
          unit_cost: { type: 'number', min: 0 }, cost_basis: { type: 'string', required: true, oneOf: ['past quotes', 'owned stock', 'none', 'set by Kiko', 'market research'] },
          price_source: { type: 'string', max: 60 }, status: { type: 'string', oneOf: ['included', 'optional', 'excluded'] },
          unit_price: { type: 'number', min: 0 }, price_basis: { type: 'string', oneOf: ['BSE package', 'BSE price list', 'past CE prices', 'market research', 'set by Kiko', 'none'] },
          price_sources: { type: 'array', maxItems: 8 },
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
  make_project_folders: {
    // C1 G6 "Make folders again": Canvas's own pfEnsure_ (the folders Add New Project makes) for a project whose folders are
    // missing, then every folder link read back. It only adds missing folders and fills empty link cells; nothing is moved.
    kind: 'queue', needsProject: true, schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ } },
    run: (r) => { const x = zbProject_(r); return x.error ? { ok: false, error: x.error } : aiIntakeMakeFolders_(r.project_id); }
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
  /* CUE-CECOST-2026-10-22 (Kiko 02:37Z "it should be able to update CE with my approval"). Cue's "update CE costs for <project>
   * from <person>'s email": ce_lines reads the project's CE lines (Requirements rows) for Cue's old-to-new card; ce_update_costs
   * writes only the unit costs Kiko approved on that card, through updateCeRequirementLines (CE Desk's own save, with its audit
   * log and project-done lock). A line whose cost changed since the card was read is refused, not overwritten. Nothing else on
   * the CE changes: no price, quantity, line, filed CE version or active CE. */
  ce_lines: {
    kind: 'read', needsProject: true, schema: {},
    run: (r) => zbCeLines_(r.project_id)
  },
  ce_update_costs: {
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      lines: { type: 'array', required: true, minItems: 1, maxItems: 100, items: {
        req_id: { type: 'string', required: true, re: /^[A-Za-z0-9._-]{1,60}$/ },
        unit_cost: { type: 'number', required: true, min: 0 }, was: { type: 'number', min: 0 } } } },
    run: (r) => { const x = zbProject_(r); return x.error ? { ok: false, error: x.error } : zbCeUpdateCosts_(r.project_id, r.args.lines); }
  },
  status_digest: {
    // CUE-STATUS-2026-10-22 (Kiko 15:56Z approved specs/status-reports.md). Cue's Monday digest and client updates: per active
    // project (For Production Start or later, event no more than past_days ago; or the project_ids asked for), its open tasks,
    // issues and risks (TRI Tracker), scope completion, CE vs payment requests, billings past due, the main client contact, and
    // the project's supplier names (so Cue keeps them out of client emails). Read only.
    kind: 'read', needsProject: false,
    schema: { project_ids: { type: 'array', maxItems: 10 }, past_days: { type: 'number', min: 0 } },
    run: (r) => {
      const ids = r.args.project_ids || [];
      if (ids.some(x => typeof x !== 'string' || !ZB_PID_RE_.test(x))) throw new Error('project_ids must be Canvas project IDs');
      return zbStatusDigest_(ids, r.args.past_days == null ? 7 : Math.min(r.args.past_days, 60));
    }
  },
  add_tri_items: {
    // CUE-STATUS-2026-10-22: the tasks, issues and risks Kiko approved on Cue's status cards, added to TRI Tracker › TRI the
    // way the Canvas page adds one (saveProjectRow), then read back. A row with the same description already in the project
    // is left as it is and reported, so a retry adds nothing twice. Never edits or deletes an existing row.
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      items: { type: 'array', required: true, minItems: 1, maxItems: 20, items: {
        key: { type: 'string', required: true, re: /^[A-Za-z0-9_-]{1,20}$/ },
        type: { type: 'string', required: true, oneOf: ['Task', 'Issue', 'Risk'] },
        description: { type: 'string', required: true, nonBlank: true, max: 1000 },
        assigned_to: { type: 'string', max: 200 }, deadline: { type: 'string', re: /^\d{4}-\d{2}-\d{2}$/ },
        likelihood: { type: 'string', max: 40 }, impact: { type: 'string', max: 40 },
        mitigation: { type: 'string', max: 1000 }, action_items: { type: 'string', max: 1000 } } } },
    run: (r) => { const x = zbProject_(r); return x.error ? { ok: false, error: x.error } : zbAddTri_(r.project_id, r.args.items); }
  },
  get_readiness: {
    // CUE-2026-10-21 (Kiko 07:32Z approved specs/project-readiness.md). The project's readiness checklist exactly as the
    // Checklist tab computes it (getChecklist: Canvas's own rules, counts and auto checks), for Cue's readiness card.
    // Read only: no item, review, exception or gate approval is written. gate 'auto' (default) = Closeout once the event
    // date has passed or the project is in Closure; Pre-Event Readiness before that.
    kind: 'read', needsProject: true, schema: { gate: { type: 'string', oneOf: ['auto', 'pre', 'close'] },
      max_age_minutes: { type: 'number', min: 1, max: 360 } },
    run: (r) => zbRdCached_(r.project_id, r.args.gate || 'auto', r.args.max_age_minutes)   // GPT-READINESS-CACHE-2026-10-23
  },
  supplier_lookup: {
    // CUE-VENDOR-2026-10-21 (Kiko 07:54Z approved specs/vendor-management.md). Cue's "Find, compare or assess suppliers":
    // Supplier Database matches (Preferred first), past quotes for the item, named suppliers' history and a project's quotes
    // (canvas-ai/AiVendor.gs). Read only; no bank details or TINs.
    kind: 'read', needsProject: false,
    schema: { item: { type: 'string', max: 120 }, city: { type: 'string', max: 100 }, names: { type: 'array', maxItems: 5 },
      project_id: { type: 'string', re: ZB_PID_RE_ } },
    run: (r) => {
      const names = r.args.names || [];
      if (names.some(x => typeof x !== 'string' || !x.trim() || x.length > 120)) throw new Error('names must be supplier names (120 characters at most)');
      return aiVendorLookup_({ item: r.args.item || '', city: r.args.city || '', names: names, project_id: r.args.project_id || '' });
    }
  },
  /* CUE-HUBSPOT-2026-10-21 (Kiko 07:50Z approved specs/hubspot-cleanup.md). hubspot_scan reads HubSpot, the HubSpot Links tab and
   * Client Desk contacts and returns findings (canvas-ai/AiHubspot.gs, fixed rules, no AI). hubspot_fix applies the fixes Kiko
   * ticked on Cue's card, at most 50 record changes, each re-checked and read back. It never deletes for good (archive goes to
   * HubSpot's recycle bin), never touches a Canvas deal, and edits Canvas fields only in Client Desk (P0 Contacts). */
  hubspot_scan: {
    kind: 'read', needsProject: false, schema: { old_days: { type: 'number', min: 90 } },
    run: (r) => aiHsScan_(r.args)
  },
  hubspot_fix: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      fixes: { type: 'array', required: true, minItems: 1, maxItems: 50, items: {
        key: { type: 'string', required: true, re: /^H\d{1,4}$/ },
        op: { type: 'string', required: true, oneOf: ['set', 'link', 'owner', 'archive', 'merge', 'canvas_contact'] },
        type: { type: 'string', oneOf: ['companies', 'contacts', 'deals'] }, id: { type: 'string', re: /^\d{1,20}$/ },
        keep: { type: 'string', re: /^\d{1,20}$/ }, merge: { type: 'array', maxItems: 5 },
        company: { type: 'string', max: 200 }, owner: { type: 'string', re: /^\d{1,20}$/ }, ids: { type: 'array', maxItems: 50 },
        props: { type: 'object', fields: { domain: { type: 'string', max: 200 }, industry: { type: 'string', max: 100 }, city: { type: 'string', max: 100 },
          country: { type: 'string', max: 100 }, hubspot_owner_id: { type: 'string', re: /^\d{1,20}$/ }, name: { type: 'string', max: 200 },
          firstname: { type: 'string', max: 100 }, lastname: { type: 'string', max: 100 }, jobtitle: { type: 'string', max: 200 }, phone: { type: 'string', max: 60 } } },
        email: { type: 'string', max: 200 }, field: { type: 'string', oneOf: ['name', 'title', 'phone'] }, from: { type: 'string', max: 300 }, to: { type: 'string', max: 300 } } } },
    run: (r) => { const f = r.args.fixes, idRe = /^\d{1,20}$/;
      for (const x of f) {
        if (x.op === 'canvas_contact' ? !(x.email && x.company && x.field) : !x.type) return { ok: false, error: x.key + ': the fix is missing its record' };
        if ((x.op === 'set' || x.op === 'link' || x.op === 'archive') && !x.id) return { ok: false, error: x.key + ': the fix is missing its record' };
        if (x.op === 'link' && !idRe.test(String(x.company || ''))) return { ok: false, error: x.key + ': link needs a company ID' };
        if (x.op === 'merge' && !(x.keep && (x.merge || []).length && x.merge.every(m => typeof m === 'string' && idRe.test(m)))) return { ok: false, error: x.key + ': merge needs the record to keep and the ones to merge' };
        if (x.op === 'owner' && !(x.owner && (x.ids || []).length && x.ids.every(m => typeof m === 'string' && idRe.test(m)))) return { ok: false, error: x.key + ': owner needs the owner and the records' };
        if (x.op === 'set' && !(x.props && Object.keys(x.props).length)) return { ok: false, error: x.key + ': nothing to set' };
      }
      return aiHsApply_(f); }
  },
  accreditation_gaps: {
    // CUE-2026-10-21 (Kiko approved specs/accreditation-chasers.md 08:22Z). Supplier Accreditation rows that still miss
    // something (awarded or newly registered), for Cue's morning chaser. Read only (AiAccr.gs accrGaps_).
    kind: 'read', needsProject: false, schema: {},
    run: () => accrGaps_()
  },
  log_accreditation_reminder: {
    // CUE-2026-10-21 (same spec; Kiko 07:31Z: "Accreditation emails should be sent from my email"). Cue sends from Kiko's
    // Gmail after Kiko approves; 'check' first (still missing anything?), then 'sent' records it on the supplier's row.
    // Writes only the Supplier Accreditation tab and the activity log. Never sends email, never touches supplier records.
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      supplier: { type: 'string', required: true, nonBlank: true, max: 200 }, stage: { type: 'string', required: true, oneOf: ['check', 'sent'] },
      to: { type: 'string', max: 500 }, thread_id: { type: 'string', max: 100, re: /^[A-Za-z0-9_-]{1,100}$/ } },
    run: (r) => accrLogReminder_(r.args)
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
  /* CUE-AR-2026-10-21 (Kiko 07:42Z approved specs/supplier-ars.md): Cue's "Prepare ARs" command. Canvas's own AR generator
   * (arPeople, arMake, arEmail_) does all the work; these only expose it to Cue, one receipt per call, after Kiko ticks it. */
  ar_list: {
    // The Generate window's list: who can get a receipt, the current one if made, and why the rest can't. No bank details.
    kind: 'read', needsProject: true, schema: {},
    run: (r) => zbArList_(r.project_id)
  },
  ar_make: {
    // One receipt. A repeat returns the receipt already there, so a retry never makes a second PDF. remake (Kiko's tick
    // only) makes a new one and keeps a signed copy, like the page's Remake; a remake retried within 10 minutes is a repeat.
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      key: { type: 'string', required: true, nonBlank: true, max: 300, re: /^[RQ]\|[^\u0000-\u001f]+$/ }, remake: { type: 'boolean' } },
    run: (r) => zbArMake_(r)
  },
  ar_email: {
    // Emails a supplier or talent their current receipt through arEmail_: from AccountsPayables@ only, Event Specialist and
    // Kiko in CC. Sent once: a receipt already marked "Sent to" is not sent again. Freelancer receipts are never emailed.
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      key: { type: 'string', required: true, nonBlank: true, max: 300, re: /^[RQ]\|[^\u0000-\u001f]+$/ } },
    run: (r) => zbArEmail_(r)
  },
  /* CREW-DOCS-2026-10-26 (Kiko 13:22Z-13:25Z): Cue's "Generate FSAs / ARs for <project>". Canvas Client has no Docs scope, so
   * crew_docs_make only writes a job; main's documents run makes the files (AutoDocs.gs adJobsRun_). Nothing is emailed until
   * Kiko taps Send in Cue, then one crew_docs_send per person, sent once. No bank details in any reply. */
  crew_docs: {
    // Who can get an FSA (kind fsa) or AR (kind ar), the current document, and whether a sign email can go to them.
    kind: 'read', needsProject: true, schema: { kind: { type: 'string', required: true, oneOf: ['fsa', 'ar'] } },
    run: (r) => zbCrewDocs_(r.project_id, r.args.kind)
  },
  crew_docs_make: {
    // The ticked people, made one at a time by main. A repeat of the same request_id returns the job already there.
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ }, kind: { type: 'string', required: true, oneOf: ['fsa', 'ar'] },
      keys: { type: 'array', required: true, minItems: 1, maxItems: 60 } },
    run: (r) => zbCrewMake_(r)
  },
  crew_docs_job: {
    // How far the job is: per person waiting, made (with the document ID) or failed (with why).
    kind: 'read', needsProject: false, schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ } },
    run: (r) => { const j = adJobGet_(r.args.request_id); return j || { missing: true }; }
  },
  crew_docs_send: {
    // One person's sign email (crew: registered with a crew sign-in only), or a supplier's or talent's receipt. Sent once.
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ }, kind: { type: 'string', required: true, oneOf: ['fsa', 'ar'] },
      key: { type: 'string', required: true, nonBlank: true, max: 300, re: /^[^\u0000-\u001f]+$/ }, intro: { type: 'string', max: 2000 } },
    run: (r) => adCrewSend_(r.project_id, r.args.kind, r.args.key, String(r.args.intro || '').trim())
  },
  finance_snapshot: {
    // CUE-FINANCE-2026-10-21 (Kiko 07:41Z approved specs/cfo-advisor.md). Cue's CFO Advisor: CE, billings, collections and
    // payment requests per project (canvas-ai/AiFinance.gs). Read only; no bank details, payees' accounts or personal expenses.
    kind: 'read', needsProject: false,
    schema: { project_ids: { type: 'array', maxItems: 50 }, account: { type: 'string', max: 200 },
      from: { type: 'string', re: /^\d{4}-\d{2}-\d{2}$/ }, to: { type: 'string', re: /^\d{4}-\d{2}-\d{2}$/ } },
    run: (r) => {
      const ids = r.args.project_ids || [];
      if (ids.some(x => typeof x !== 'string' || !ZB_PID_RE_.test(x))) throw new Error('project_ids must be Canvas project IDs');
      return aiFinanceSnapshot_({ project_ids: ids, account: r.args.account || '', from: r.args.from || '', to: r.args.to || '' });
    }
  },
  /* CUE-EXPENSE-2026-10-21 (Kiko 07:34Z approved specs/c3-project-expense.md). expense_evidence reads; record_expense writes one
   * expense Kiko approved on Cue's card, through Canvas's own functions (canvas-ai/AiExpense.gs). save_entry, award and pay stay
   * forbidden as actions of their own: record_expense adds an entry, awards it or records a payment only for that one card. */
  expense_evidence: {
    kind: 'read', needsProject: false,
    schema: { project_id: { type: 'string', re: ZB_PID_RE_ }, project_hint: { type: 'string', max: 200 },
      fields: { type: 'object', required: true, fields: { kind: { type: 'string', max: 40 }, amount: { type: 'number', min: 0 }, date: { type: 'string', max: 10 },
        ref: { type: 'string', max: 120 }, payee: { type: 'string', max: 200 }, supplier: { type: 'string', max: 200 }, item: { type: 'string', max: 300 },
        category: { type: 'string', max: 200 }, text: { type: 'string', max: 4000 } } } },
    run: (r) => aiExpenseEvidence_(r.args)
  },
  record_expense: {
    kind: 'queue', needsProject: true,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      plan: { type: 'object', required: true, fields: {
        kind: { type: 'string', required: true, oneOf: ['Proof of transfer', 'Payment confirmation', 'Receipt'] }, amount: { type: 'number', required: true, positive: true },
        date: { type: 'string', re: /^\d{4}-\d{2}-\d{2}$/ }, ref: { type: 'string', max: 120 }, payee: { type: 'string', max: 200 },
        paid: { type: 'string', required: true, oneOf: ['proof', 'cash', 'no'] },
        request_id: { type: 'string', re: /^AP-[A-Za-z0-9-]{3,40}$/ }, scope_id: { type: 'string', re: /^SCP\d{2}-\d{3,}-\d{2,}$/ },
        entry_id: { type: 'string', re: /^ENT-\d{2,}-\d{2,}-\d{1,4}$/ }, award: { type: 'boolean' },
        new_scope: { type: 'object', fields: { requirement_id: { type: 'string', required: true, nonBlank: true, max: 60 },
          category: { type: 'string', required: true, nonBlank: true, max: 200 }, description: { type: 'string', required: true, nonBlank: true, max: 500 },
          quantity: { type: 'number', positive: true }, occurrence: { type: 'number', positive: true }, expense_type: { type: 'string', max: 100 } } },
        new_entry: { type: 'object', fields: { supplier: { type: 'string', required: true, nonBlank: true, max: 200 },
          description: { type: 'string', max: 500 }, amount: { type: 'number', positive: true } } },
        cost_type: { type: 'string', max: 40 }, expense_type: { type: 'string', max: 100 }, item: { type: 'string', max: 300 },
        stage: { type: 'string', oneOf: ['Initial Deposit', 'Progress Payment', 'Final Balance', 'Full Payment'] } } },
      files: { type: 'array', maxItems: 4, items: { name: { type: 'string', required: true, nonBlank: true, max: 150 },
        mime: { type: 'string', required: true, oneOf: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'] },
        role: { type: 'string', required: true, oneOf: ['proof', 'receipt'] },
        data: { type: 'string', required: true, nonBlank: true, max: 14000000, re: /^[A-Za-z0-9+/=]+$/ } } } },
    run: (r) => { const p = r.args.plan, f = r.args.files || [];
      if (f.filter(x => x.role === 'proof').length > 1 || f.filter(x => x.role === 'receipt').length > 1) return { ok: false, error: 'one proof and one receipt at most' };
      if (!p.request_id && !p.scope_id && !p.new_scope) return { ok: false, error: 'plan needs request_id, scope_id or new_scope' };
      if (p.request_id && (p.scope_id || p.new_scope || p.entry_id || p.new_entry)) return { ok: false, error: 'an existing request takes evidence only' };
      if ((p.scope_id && p.new_scope) || (p.entry_id && p.new_entry)) return { ok: false, error: 'pick an existing record or a new one, not both' };
      const x = zbProject_(r); if (x.error) return { ok: false, error: x.error };
      return aiExpenseRecord_(r.args.request_id, r.project_id, p, f); }
  },
  /* CUE-SUPPLIER-2026-10-21 (Kiko 07:55Z approved specs/supplier-registration.md). supplier_check reads; register_supplier adds
   * one new supplier through saveRecord_ (canvas-ai/AiSupplier.gs); save_supplier_file puts one document, or a shortcut to a
   * shared-drive file, into that supplier's folder. Values are text only, and AiSupplier.gs keeps them from becoming formulas. */
  supplier_check: {
    kind: 'read', needsProject: false,
    schema: { name: { type: 'string', required: true, nonBlank: true, max: 200 }, display_name: { type: 'string', max: 200 },
      tin: { type: 'string', max: 40 }, emails: { type: 'array', maxItems: 10, items: { email: { type: 'string', required: true, max: 200 } } },
      business_type: { type: 'string', max: 100 } },
    run: (r) => aiSupplierCheck_(Object.assign({}, r.args, { emails: (r.args.emails || []).map(e => e.email) }))
  },
  register_supplier: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      record: { type: 'object', required: true, fields: ZB_SUP_FIELDS_ },
      contacts: { type: 'array', maxItems: 10, items: { person: { type: 'string', required: true, nonBlank: true, max: 200 },
        number: { type: 'string', max: 60 }, email: { type: 'string', max: 200 }, position: { type: 'string', max: 120 } } },
      docs: { type: 'array', maxItems: 10, items: { label: { type: 'string', required: true, oneOf: ZB_SUP_DOCS_ } } } },
    run: (r) => aiSupplierRegister_(r.args.request_id, r.args.record, r.args.contacts || [], r.args.docs || [])
  },
  save_supplier_file: {
    kind: 'queue', needsProject: false,
    schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ },
      supplier_id: { type: 'string', required: true, nonBlank: true, max: 40, re: /^[A-Za-z0-9#._-]+$/ },
      name: { type: 'string', max: 150 }, mime: { type: 'string', oneOf: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] },
      data: { type: 'string', nonBlank: true, max: 14000000, re: /^[A-Za-z0-9+/=]+$/ },
      drive_id: { type: 'string', re: /^[A-Za-z0-9_-]{15,80}$/ } },
    run: (r) => { const a = r.args;
      if (a.drive_id ? (a.data || a.name || a.mime) : !(a.data && a.name && a.mime)) return { ok: false, error: 'send a file (name, mime, data) or a drive_id, not both' };
      return aiSupplierFile_(a.supplier_id, a.drive_id ? { drive_id: a.drive_id } : { name: a.name, mime: a.mime, data: a.data, request_id: a.request_id }); }
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
  mail_waiting: {
    // CUE-REPLY-DRAFTS-2026-10-26 (Kiko 04:49Z "if its an Emails waiting... shouldnt there be a draft already that we need to
    // review and send?"; 05:58Z "Draft every waiting email"; 06:04Z "just me"; 06:09Z "Yes, Cue drafts them"; spec
    // specs/email-reply-drafts.md). Kiko's client and supplier emails still waiting for his reply: the same list as his
    // Emails waiting cards (cueMail_: his email-check file, known senders only, emails he marked Done left out). Headers only:
    // no email text passes here. Cue reads the thread in Kiko's own Gmail and drafts the reply there. Read only.
    kind: 'read', needsProject: false, schema: {},
    run: () => zbMailWaiting_()
  },
  get_project_board: {
    // CUE-2026-10-21 CE award chasers (Kiko approved 08:11Z): projects in For Client Awarding also carry `awaiting`.
    kind: 'read', needsProject: false, schema: {},
    run: () => zbBoardAwaiting_(getProjectBoard())
  },
  list_unsigned_docs: {
    // CUE-SIGNATURES-2026-10-21 (Kiko 08:16Z "build", spec 06-freelancer-signatures.md): every freelancer FSA and AR still
    // "Waiting for signature", with the project's event dates, for Cue's signature chaser. Read only. Supplier ARs are left out.
    kind: 'read', needsProject: false, schema: {},
    run: () => zbUnsignedDocs_()
  },
  send_doc_reminder: {
    // CUE-SIGNATURES-2026-10-21: one reminder Kiko approved in Cue, to one freelancer, from freelancers@ (Kiko 08:09Z).
    // Sends only for docs still unsigned under that email; never changes a doc's status. reminder_id is the ledger key
    // (Doc Reminders tab), so a retry never sends twice.
    kind: 'queue', needsProject: false,
    schema: { reminder_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_.-]{8,120}$/ },
      email: { type: 'string', required: true, max: 200, re: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ },
      docs: { type: 'array', required: true, minItems: 1, maxItems: 20, items: {
        doc: { type: 'string', required: true, oneOf: ['FSA', 'AR'] }, id: { type: 'string', required: true, re: /^[A-Za-z0-9._-]{1,60}$/ } } },
      subject: { type: 'string', required: true, nonBlank: true, max: 200 },
      body: { type: 'string', required: true, nonBlank: true, max: 4000 } },
    run: (r) => zbDocReminder_(r.args)
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
  const s = String(sig || '');   // GPT-DOOR-2026-10-23: no signature = a ChatGPT call, checked by its key instead
  return JSON.stringify(s ? zbHandle_(String(raw || ''), s, Date.now(), false) : zbGptDoor_(String(raw || ''), Date.now()));
}

/* GPT-DOOR-2026-10-23 (Kiko 05:26Z "Let chatgpt access and edit the backend"). A custom GPT Action can't compute the HMAC or a
 * plan's payload hashes, so it sends the ChatGPT key (Admin > System Config > API keys, GPT_DOOR_KEY) in the body instead.
 * Only ZB_GPT_ACTIONS_ are open. Everything after the key check is the same bridge path as Cue's: strict arguments, the
 * bridge identity's role checks, the ledger, replays. Each write gets a one-command plan the door claims itself, keyed by
 * its command_id, so a repeat with the same payload replays and a changed payload under the same command_id is refused. */
const ZB_GPT_ACTIONS_ = ['search_projects', 'get_project', 'find_similar_projects', 'canvas_link', 'list_project_files',
  'ce_lines', 'ce_update_costs', 'add_requirement_lines', 'save_ce_requirements',
  'make_project_folders', 'intake_add_project', 'intake_add_lines', 'intake_save_costs', 'intake_remove',
  'expense_evidence', 'expense_add', 'expense_edit', 'save_project_file'];   // GPT-EXPENSES-2026-10-23
ZB_GPT_ACTIONS_.push('get_readiness', 'status_digest', 'gpt_guide');   // GPT-READINESS-2026-10-23 (Kiko 06:55Z): Cue's read-only readiness + digest
/* GPT-GUIDE-2026-10-23 (Kiko 07:33Z "Build": stop re-pasting the GPT's instructions). The GPT's skills are text files in Drive
 * folder "_ChatGPT Guide" (Accounts): 00-index.md plus one <part>.md per skill (instructions + reference). gpt_guide returns one
 * of them; when two files share a name the newest wins, so a skill is updated by uploading a new file. Read only. Script
 * Property GPT_GUIDE_FOLDER_ID overrides the folder. The pasted GPT prompt keeps the hard rules; the guide never loosens them. */
const ZB_GPT_GUIDE_FOLDER_ = '1TtvYNx6zoxWEK1WuAbIIOavBTzceImwj', ZB_GPT_GUIDE_MAX_ = 60000;
ZB_ACTIONS_.gpt_guide = {
  kind: 'read', needsProject: false, schema: { part: { type: 'string', re: /^[a-z0-9-]{1,40}$/ } },
  run: (r) => zbGptGuide_(r.args.part || 'index')
};
function zbGptGuide_(part) {
  const id = String(PropertiesService.getScriptProperties().getProperty('GPT_GUIDE_FOLDER_ID') || ZB_GPT_GUIDE_FOLDER_);
  const it = DriveApp.getFolderById(id).getFiles(), best = {};
  while (it.hasNext()) {
    const f = it.next(), m = String(f.getName()).match(/^(?:\d+-)?([a-z0-9-]+)\.(?:md|txt)$/i);
    if (!m || f.isTrashed()) continue;
    const k = m[1].toLowerCase(), t = f.getLastUpdated().getTime();
    if (!best[k] || t > best[k].t) best[k] = { f, t };
  }
  const parts = Object.keys(best).filter(k => k !== 'index').sort(), b = best[part];
  if (!b) throw new Error('no guide part "' + part + '"; parts: ' + (parts.join(', ') || 'none'));
  const text = b.f.getBlob().getDataAsString('UTF-8');
  return { part, parts, updated: new Date(b.t).toISOString(), text: text.slice(0, ZB_GPT_GUIDE_MAX_), cut: text.length > ZB_GPT_GUIDE_MAX_ };
}
const ZB_GPT_KEYS_ = ['key', 'command_id', 'task_id', 'action', 'project_id', 'expected_project_number', 'args', 'openaiFileIdRefs'];
const ZB_GPT_LOG_TAB_ = '_ChatGPT Door Log';
const ZB_GPT_LOG_HEAD_ = ['Time', 'Action', 'Project ID', 'Command ID', 'Status', 'OK', 'Record IDs', 'Drive links', 'Error'];
function zbGptDoor_(raw, now) {   // every call is logged, refusals too (a bad key is logged without the key)
  const seen = {}, out = zbGptDoorRun_(raw, now, seen);
  zbGptLog_(seen.q || { action: String(seen.action || '').slice(0, 60), command_id: '' }, out, seen.task);
  return out;
}
function zbGptDoorRun_(raw, now, seen) {
  let r; try { r = JSON.parse(raw); } catch (e) { return zbOut_('Rejected', {}, { error: 'body is not JSON' }); }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return zbOut_('Rejected', {}, { error: 'body must be a JSON object' });
  seen.action = r.action;
  const secret = String(PropertiesService.getScriptProperties().getProperty('GPT_DOOR_KEY') || '');
  if (secret.length < 24) return zbOut_('Rejected', {}, { error: 'The ChatGPT door is off. Kiko saves a ChatGPT key in Admin > System Config > API keys.' });
  if (typeof r.key !== 'string' || !zbSafeEq_(zbHash_(r.key), zbHash_(secret))) return zbOut_('Rejected', {}, { error: 'bad key' });
  const extra = Object.keys(r).filter(k => ZB_GPT_KEYS_.indexOf(k) < 0);
  if (extra.length) return zbOut_('Rejected', r, { error: 'unexpected field: ' + extra[0].slice(0, 40) });
  if (ZB_GPT_ACTIONS_.indexOf(String(r.action)) < 0) return zbOut_('Rejected', r, { error: 'this action is not open to ChatGPT' });
  const fbad = zbGptFiles_(r); if (fbad) return zbOut_('Rejected', r, { error: fbad });
  const cid = r.command_id == null || r.command_id === '' ? 'gpt-' + Utilities.getUuid() : String(r.command_id);
  // task_id is ChatGPT's own grouping and only labels the log row; each write gets its own plan under 'gpt:' + command_id.
  const q = { command_id: cid, task_id: 'gpt:' + cid, action: r.action, args: r.args == null ? {} : r.args };
  if (r.project_id) q.project_id = r.project_id;
  if (r.expected_project_number) q.expected_project_number = r.expected_project_number;
  seen.q = q; seen.task = r.task_id;
  return zbHandle_(JSON.stringify(q), '', now, true);
}
// One row per ChatGPT call in the ledger book (tab _ChatGPT Door Log), for the read-only write check. Never blocks the answer.
function zbGptLog_(q, out, task) {
  try {
    const id = PropertiesService.getScriptProperties().getProperty('ZAD_LEDGER_ID'); if (!id) return;
    const ss = SpreadsheetApp.openById(id), sh = ss.getSheetByName(ZB_GPT_LOG_TAB_) || ss.insertSheet(ZB_GPT_LOG_TAB_);
    if (sh.getLastRow() === 0) sh.appendRow(ZB_GPT_LOG_HEAD_);
    const t = JSON.stringify([out.result, out.steps, out.evidence]) || '', uniq = a => a.filter((x, i) => a.indexOf(x) === i);
    const ids = uniq(t.match(/\b(REQ\d{2}-[\w-]+|SCP\d{2}-[\w-]+|S-\d{3,12}[A-Z0-9]{2}|AP-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-\d{1,4}|ENT-\d{2,}-\d{2,}-\d{1,4})\b/g) || []);
    const links = uniq(t.match(/https:\/\/(drive|docs)\.google\.com\/[^"\s\\]+/g) || []);
    const cell = v => { const s = String(v == null ? '' : v).slice(0, 5000); return /^[=+\-@]/.test(s) ? "'" + s : s; };   // never a formula
    sh.appendRow([new Date(), q.action, q.project_id || '', q.command_id + (task ? ' (' + task + ')' : ''), out.status, out.ok ? 'yes' : 'no',
      ids.join(', '), links.join(' '), out.error || ''].map((v, i) => i === 0 ? v : cell(v)));
  } catch (e) { /* the log never fails the call */ }
}
// The one-command plan for a ChatGPT write, claimed through the normal claim_plan path. null = claimed (or already claimed).
function zbGptPlan_(r, now) {
  const body = zbPayloadHash_(r);
  const out = zbWrite_({ command_id: 'plan:' + r.task_id, task_id: r.task_id, action: 'claim_plan', args: { plan_hash: zbHash_(body),
    commands: [{ command_id: r.command_id, payload_hash: body }] } }, ZB_ACTIONS_.claim_plan, now);
  if (out.status === 'Completed' || (out.status === 'Replayed' && out.original_status === 'Completed')) return null;
  return zbOut_(out.status === 'Rejected' ? 'Rejected' : 'Blocked', r, { error: 'plan: ' + (out.error || out.status) });
}

/* GPT-EXPENSES-2026-10-23 (Kiko 05:47Z: "allow chatgpt to add, modify project expenses thru the backend and attach screenshots
 * of images - proof of transfer, receipt, and other files"). Files: in args, {file: "<name of a file Kiko attached in the chat>"}
 * or {drive_url: "<Drive link>"} stands for one file. The door fetches it (openaiFileIdRefs' download_link, or the Drive file as
 * this script's owner) and puts {name, mime, data} in its place, so the action gets the file the way Cue sends it. */
const ZB_GPT_MAX_FILE_ = 10 * 1024 * 1024;   // saveProjectFile_'s limit (QUOTE_MAX_BYTES_)
function zbGptFiles_(r) {
  const a = r.args, refs = r.openaiFileIdRefs == null ? [] : r.openaiFileIdRefs;
  if (!Array.isArray(refs)) return 'openaiFileIdRefs must be a list';
  if (!a || typeof a !== 'object' || Array.isArray(a)) return '';
  const slots = [a].concat(Array.isArray(a.files) ? a.files.filter(f => f && typeof f === 'object' && !Array.isArray(f)) : []);
  for (const o of slots) {
    if (!zbOwn_(o, 'file') && !zbOwn_(o, 'drive_url')) continue;
    let got;
    try { got = zbOwn_(o, 'file') ? zbGptFetchRef_(String(o.file || ''), refs) : zbGptFetchDrive_(String(o.drive_url || '')); }
    catch (e) { return zbErr_(e); }
    if (got.bytes.length > ZB_GPT_MAX_FILE_) return '"' + got.name.slice(0, 80) + '" is over 10 MB. Save it to Drive and send its link instead.';
    delete o.file; delete o.drive_url;
    o.name = String(o.name || got.name).slice(0, 150); o.mime = got.mime; o.data = Utilities.base64Encode(got.bytes);
  }
  return '';
}
const zbGptMime_ = m => { m = String(m || '').toLowerCase().split(';')[0].trim(); return m === 'image/jpg' ? 'image/jpeg' : m; };
function zbGptFetchRef_(name, refs) {
  const hit = refs.filter(x => x && typeof x === 'object' && (String(x.name || '') === name || String(x.id || '') === name));
  if (!name || !hit.length) throw new Error('No attached file named "' + name.slice(0, 80) + '". Attach it in the chat and send its exact name.');
  const ref = hit[0], url = String(ref.download_link || '');
  if (!/^https:\/\//i.test(url)) throw new Error('"' + name.slice(0, 80) + '" came with no download link. Attach it again.');
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not download "' + name.slice(0, 80) + '" (' + res.getResponseCode() + '). Attach it again.');
  const blob = res.getBlob();
  return { name: String(ref.name || name), mime: zbGptMime_(ref.mime_type || blob.getContentType()), bytes: blob.getBytes() };
}
function zbGptFetchDrive_(url) {
  const m = url.match(/\/d\/([\w-]{20,})/) || url.match(/[?&]id=([\w-]{20,})/) || url.match(/^([\w-]{20,})$/);
  if (!m) throw new Error('That is not a Drive file link.');
  let f; try { f = DriveApp.getFileById(m[1]); f.getName(); } catch (e) { throw new Error('Canvas can\'t open that Drive file. Share it with info@blankspaceevent.com.'); }
  const blob = f.getBlob();
  return { name: f.getName(), mime: zbGptMime_(f.getMimeType()), bytes: blob.getBytes() };
}
// A Canvas refusal ("... Nothing was saved.") saved nothing, so the door reports it Rejected; anything else stays an error.
function zbGptRefusal_(e) { const m = zbErr_(e); if (/Nothing was saved\.?\s*$/.test(m)) return { refused: m }; throw e; }

// expense_add: Cue's record_expense under the ledger. request_id is the command's own, so AiExpense.gs's step memory and the
// ledger agree. A retry of a Partial save puts the steps that landed back into that memory first, so it never redoes them.
ZB_ACTIONS_.expense_add = {
  kind: 'write', needsProject: true, resumable: true,
  schema: { plan: ZB_ACTIONS_.record_expense.schema.plan, files: ZB_ACTIONS_.record_expense.schema.files },
  run: (r, proj, prior) => {
    const rid = 'gpt-' + String(r.command_id).replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 70);
    const steps = prior && typeof prior === 'object' && !Array.isArray(prior) ? prior : null;
    if (steps) { const key = 'cx_' + rid.replace(/[^\w-]/g, '').slice(0, 60), cache = CacheService.getScriptCache();
      if (!cache.get(key)) { const ok = {}; Object.keys(steps).forEach(k => { if (steps[k] && steps[k].ok) ok[k] = steps[k]; });
        cache.put(key, JSON.stringify({ steps: ok }), 21600); } }
    return ZB_ACTIONS_.record_expense.run(Object.assign({}, r, { args: { request_id: rid, plan: r.args.plan, files: r.args.files || [] } }));
  },
  check: (r, res) => {
    if (!res || res.ok === false) return { ok: false, rejected: true, error: String((res && res.error) || 'refused') };
    if (res.recorded) return { ok: true };
    const wrote = Object.keys(res.steps || {}).some(k => k !== 'check' && res.steps[k] && res.steps[k].ok);
    return wrote ? { ok: false, partial: true, steps: res.steps, error: 'stopped at ' + res.stopped_at + ': ' + (res.error || '') }
      : { ok: false, rejected: true, error: String(res.error || 'refused') };
  }
};
// expense_edit: Canvas's Edit request (editPaymentRequest): unpaid requests only, and each change carries the value it replaces.
const ZB_GPT_EDIT_ = { amount: 'amount', cost_type: 'cost type', expense_type: 'expense type', payee: 'payee', payment_stage: 'payment stage',
  payment_date_required: 'payment date required', supplier_quotation: 'supplier quotation' };
const zbFromTo_ = (t) => ({ type: 'object', fields: { from: { type: t, max: 500 }, to: { type: t, required: true, max: 500 } } });
ZB_ACTIONS_.expense_edit = {
  kind: 'write', needsProject: true,
  schema: { request_id: { type: 'string', required: true, re: /^AP-[A-Za-z0-9-]{3,40}$/ }, scope_id: { type: 'string', required: true, re: /^SCP\d{2}-\d{3,}-\d{2,}$/ },
    changes: { type: 'object', required: true, minKeys: 1, fields: { amount: { type: 'object', fields: { from: { type: 'number' }, to: { type: 'number', required: true, positive: true } } },
      cost_type: zbFromTo_('string'), expense_type: zbFromTo_('string'), payee: zbFromTo_('string'), payment_stage: zbFromTo_('string'),
      payment_date_required: zbFromTo_('string'), supplier_quotation: zbFromTo_('string') } } },
  run: (r) => {
    const ch = {}, a = r.args, cols = Object.keys(ZB_GPT_EDIT_).map(k => ZB_GPT_EDIT_[k]);
    const row = () => { const P = table_(SRC.SCOPES, 'Payment Request');
      return objects_(P, ['request id', 'scope id'].concat(cols), x => norm_(x[col_(P, 'request id')]) === norm_(a.request_id) && String(x[col_(P, 'scope id')]).trim() === a.scope_id)[0] || {}; };
    // A change sent without its was-value takes the value Canvas holds now (the page does the same from what it loaded).
    const was = row();
    Object.keys(a.changes).forEach(k => { const c = a.changes[k], h = ZB_GPT_EDIT_[k];
      ch[h] = { from: c.from != null ? c.from : String(was[h] == null ? '' : was[h]), to: c.to }; });
    if (!Object.keys(ch).length) return { refused: 'Nothing to change. Nothing was saved.' };
    let out; try { out = editPaymentRequest(r.project_id, a.scope_id, a.request_id, ch); } catch (e) { return zbGptRefusal_(e); }
    const now = row();
    return { saved: true, request_id: a.request_id, scope_id: a.scope_id, skipped: (out && out.skipped) || [],
      was: Object.keys(a.changes).reduce((o, k) => { o[k] = ch[ZB_GPT_EDIT_[k]].from; return o; }, {}),
      now: { amount: num_(now.amount), cost_type: now['cost type'] || '', expense_type: now['expense type'] || '', payee: now.payee || '', payment_stage: now['payment stage'] || '' } };
  },
  check: (r, res) => {
    if (res && res.refused) return { ok: false, rejected: true, error: res.refused };
    const c = r.args.changes, n = (res && res.now) || {}, off = [];
    if (c.amount && Math.abs(Number(n.amount) - c.amount.to) > 0.005) off.push('amount reads ' + n.amount);
    ['cost_type', 'expense_type', 'payee', 'payment_stage'].forEach(k => { if (c[k] && String(n[k]).trim() !== String(c[k].to).trim() && (res.skipped || []).indexOf(ZB_GPT_EDIT_[k]) < 0) off.push(k + ' reads ' + n[k]); });
    return off.length ? { ok: false, error: 'read back differs: ' + off.join('; ') } : { ok: true };
  }
};

function zbHandle_(raw, sig, now, gpt) {
  let r; try { r = JSON.parse(raw); } catch (e) { return zbOut_('Rejected', {}, { error: 'body is not JSON' }); }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return zbOut_('Rejected', {}, { error: 'body must be a JSON object' });
  const props = PropertiesService.getScriptProperties();
  const auth = gpt ? '' : zbAuth_(raw, sig, r, now, props.getProperty('ZAD_SECRET'));   // a ChatGPT call was checked by its key
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
    if (gpt && a.kind === 'write' && !a.plan) { const pl = zbGptPlan_(r, now); if (pl) return pl; }
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

/**
 * Cue's CE award chasers: each project in For Client Awarding gets awaiting = { since, ce_total, ce_no }. since (YYYY-MM-DD,
 * Manila) is the latest Changes-tab entry that set PROJECT STATUS to For Client Awarding, the same log the Timeline reads
 * (tsEnter_); '' when the log has none (Cue then uses the CE email date). ce_total and ce_no come from the active CE
 * (ceActiveTotals_). Read only; any failure leaves the board as it was.
 */
/* ---------- CUE-CECOST-2026-10-22: CE line costs ---------- */
const ZB_CE_COLS_ = { req_id: 'requirement id', category: 'category', description: 'description', qty: 'quantity', occurrence: 'occurence',
  unit_cost: 'unit cost', discounted: 'discounted cost', unit_price: 'unit price', section: 'ce section' };
function zbCeNum_(v) { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[,\u20b1\s]/g, '')); return isFinite(n) ? Math.round(n * 100) / 100 : null; }
/** The project's Requirements rows (its CE lines), one per Requirement ID, and its active CE number. Read only. */
function zbCeLines_(pid) {
  const R = table_(SRC.SCOPES, 'Requirements'), mine = by_(R, 'project id', pid), c = {};
  Object.keys(ZB_CE_COLS_).forEach(k => { c[k] = col_(R, ZB_CE_COLS_[k]); });
  if (c.req_id < 0 || c.unit_cost < 0) throw new Error('The Requirements tab has no Requirement ID or Unit Cost column.');
  const seen = {}, lines = [];
  R.rows.forEach(r => {
    if (!mine(r)) return;
    const id = String(r[c.req_id] || '').trim(); if (!id || seen[id]) return; seen[id] = 1;
    const v = k => c[k] >= 0 ? r[c[k]] : '';
    lines.push({ req_id: id, category: String(v('category') || '').trim().slice(0, 200), description: String(v('description') || '').trim().slice(0, 600),
      qty: zbCeNum_(v('qty')), occurrence: zbCeNum_(v('occurrence')), unit_cost: zbCeNum_(v('unit_cost')), discounted: zbCeNum_(v('discounted')),
      unit_price: zbCeNum_(v('unit_price')), section: String(v('section') || '').trim().slice(0, 50) });
  });
  const ce = getCheckCe(pid) || {};
  return { project_id: pid, ce_no: ce.ceNo || '', ce_url: ce.url || '', lines: lines.slice(0, 200), more: lines.length > 200 };
}
/** Writes the approved unit costs. Each line's cost must still be what Cue showed Kiko (was), else that line is refused.
 * Every line is read back after the save. Returns { ok, saved, lines: [{req_id, before, after, ok, why}] }. */
function zbCeUpdateCosts_(pid, list) {
  const now = zbCeLines_(pid), by = {}; now.lines.forEach(l => { by[l.req_id] = l; });
  const out = [], set = [];
  list.forEach(o => {
    const l = by[o.req_id], want = Math.round(Number(o.unit_cost) * 100) / 100;
    if (!l) { out.push({ req_id: o.req_id, ok: false, why: 'not a CE line of this project' }); return; }
    const was = l.unit_cost == null ? 0 : l.unit_cost;
    if (Math.abs(was - want) < 0.005) { out.push({ req_id: o.req_id, before: was, after: was, ok: true, why: 'already this cost' }); return; }   // a retry after a save
    if (o.was != null && Math.abs(was - o.was) >= 0.005) { out.push({ req_id: o.req_id, before: was, after: was, ok: false, why: 'its cost changed in Canvas to ' + was + ' since Cue read it' }); return; }
    set.push({ reqId: o.req_id, set: { 'unit cost': want } });
    out.push({ req_id: o.req_id, before: was, want, ok: false });
  });
  const res = set.length ? updateCeRequirementLines(pid, set) : { skipped: [] };
  const back = {}; if (set.length) zbCeLines_(pid).lines.forEach(l => { back[l.req_id] = l; });
  out.forEach(x => { if (x.want == null) return;
    const after = back[x.req_id] && back[x.req_id].unit_cost != null ? back[x.req_id].unit_cost : 0;
    x.after = after; x.ok = Math.abs(after - x.want) < 0.005;
    if (!x.ok) x.why = ((res.skipped || []).find(s => s.indexOf(x.req_id) === 0)) || 'Canvas did not take it (the Unit Cost cell may be a formula)';
    delete x.want; });
  return { ok: true, saved: out.filter(x => x.ok && x.before !== x.after).length, lines: out, ce_no: now.ce_no };
}

/* ---------- CUE-STATUS-2026-10-22: status digest and approved TRI items ---------- */
const ZB_ST_MAX_ = { projects: 25, items: 15 };
const ZB_ST_PHASES_ = ['Execution', 'Closure'];                     // For Production Start or later, not Completed
const ZB_ST_SCOPE_OFF_ = /cancel|not awarded|dropped|removed|void/i, ZB_ST_SCOPE_DONE_ = /done|complete|closed|liquidat/i;
const ZB_ST_MAIN_RE_ = /main|primary|point|poc|project|event|lead|owner|head|manager/i;
function zbStatusDigest_(ids, past) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const from = Utilities.formatDate(new Date(Date.parse(today + 'T12:00:00Z') - past * 864e5), 'UTC', 'yyyy-MM-dd');
  const want = {}; ids.forEach(x => { want[x] = 1; });
  let own = []; try { own = sysOwnKeys_(); } catch (e) { own = []; }
  const ownKey = a => String(a || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const seen = {}, list = [];
  getProjectsAll_().forEach(p => {
    const id = String(p.id || '').trim(); if (!id || /^#/.test(id) || seen[id]) return; seen[id] = 1;
    const date = aifIso_(p.date);
    if (ids.length) { if (!want[id]) return; }
    else if (ZB_ST_PHASES_.indexOf(phaseOfStatus_(p.status)) < 0 || own.indexOf(ownKey(p.account)) >= 0 || (date && date < from)) return;
    list.push({ id, name: String(p.name || '').slice(0, 200), account: String(p.account || '').slice(0, 200), status: String(p.status || ''), date,
      contact: null, tri: { open: 0, closed: 0, overdue: [], risks: [], issues: [], tasks: [] }, scope: { done: 0, total: 0 }, money: null, suppliers: [], overdue_bills: [] });
  });
  list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const keep = list.slice(0, ZB_ST_MAX_.projects), by = {}, missing = [];
  keep.forEach(p => { by[p.id] = p; });
  if (!keep.length) return { today, from, projects: [], more: 0, missing };
  const txt = (v, n) => zbPayTxt_(v).slice(0, n || 300);
  // TRI Tracker › TRI: open and closed counts; open items with their deadline (late ones first).
  try {
    objects_(table_(SRC.TRI, 'TRI'), ['project id', 'id', 'type', 'description', 'assigned to', 'deadline', 'status', 'likelihood', 'impact']).forEach(t => {
      const p = by[String(t['project id'] || '').trim()]; if (!p || !String(t.description || '').trim()) return;
      if (CKC_OPEN_RE_.test(String(t.status || ''))) { p.tri.closed++; return; }
      p.tri.open++;
      const type = /risk/i.test(t.type) ? 'Risk' : /issue/i.test(t.type) ? 'Issue' : 'Task', due = aifIso_(t.deadline);
      const it = { id: txt(t.id, 20), type, description: txt(t.description, 300), assigned_to: txt(t['assigned to'], 120), deadline: due,
        status: txt(t.status, 40) || 'Open', likelihood: txt(t.likelihood, 40), impact: txt(t.impact, 40), late: !!due && due < today };
      if (it.late) p.tri.overdue.push(it);
      (type === 'Risk' ? p.tri.risks : type === 'Issue' ? p.tri.issues : p.tri.tasks).push(it);
    });
    keep.forEach(p => { ['overdue', 'risks', 'issues', 'tasks'].forEach(k => {
      p.tri[k].sort((a, b) => (b.late - a.late) || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
      p.tri[k + '_n'] = p.tri[k].length; p.tri[k] = p.tri[k].slice(0, ZB_ST_MAX_.items); }); });
  } catch (e) { missing.push('TRI Tracker: ' + zbErr_(e)); }
  // Scope completion (Scope Categories): cancelled scopes do not count.
  try {
    objects_(table_(SRC.SCOPES, 'Scope Categories'), ['event id', 'status']).forEach(x => {
      const p = by[String(x['event id'] || '').trim()]; if (!p || ZB_ST_SCOPE_OFF_.test(String(x.status || ''))) return;
      p.scope.total++; if (ZB_ST_SCOPE_DONE_.test(String(x.status || ''))) p.scope.done++;
    });
  } catch (e) { missing.push('Scope Categories: ' + zbErr_(e)); }
  // CE vs payment requests, billed and collected (the CFO Advisor's own read).
  try {
    const f = aiFinanceSnapshot_({ project_ids: keep.map(p => p.id) });
    (f.missing || []).forEach(m => missing.push(String(m).slice(0, 200)));
    (f.projects || []).forEach(x => { const p = by[x.id]; if (!p) return;
      const sum = (a, k) => Math.round((a || []).reduce((s, o) => s + (Number(o[k]) || 0), 0) * 100) / 100;
      p.money = { ce_no: x.ce ? x.ce.ce_no : '', ce_cost: x.ce ? x.ce.cost : null, ce_total: x.ce ? x.ce.total : null,
        requested: sum(x.costs, 'amount'), paid: sum(x.costs, 'paid'), billed: sum(x.billed, 'amount'), collected: sum(x.collected, 'net') };
      { const cm = x.cost_management || {}; // BRIDGE-COST-FIGURES-2026-10-26: the Cost Management box's EAC, ETC and Variance
        Object.assign(p.money, { etc: cm.etc, eac: cm.eac, budget: cm.budget, budget_ce: cm.budget_ce, variance: cm.variance, variance_basis: cm.variance_basis }); }
      // Supplier names, so Cue can keep them out of client emails.
      p.suppliers = (x.costs || []).map(c => String(c.supplier || '').trim()).filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 30); });
  } catch (e) { missing.push('money: ' + zbErr_(e)); }
  // Client billings past due and not fully collected (Finance Desk's rule, as in overdue_billings).
  try {
    zbPayBills_(today).forEach(b => { const p = by[b.pid];
      if (p && b.days_late != null && b.days_late > 0 && b.balance != null && b.balance > 0.005)
        p.overdue_bills.push({ no: b.no, balance: b.balance, due: b.due, days_late: b.days_late }); });
  } catch (e) { missing.push('billings: ' + zbErr_(e)); }
  // The main client contact: a project contact (main or primary first), else the account's Client Desk contact.
  try {
    const P = table_(SRC.ADMIN, 'PROJ Contacts'), K = table_(CD.sheetId, CD.contactsTab);
    const g = (T, r, n) => { const i = col_(T, n); return i < 0 ? '' : zbPayTxt_(r[i]); };
    const ok = e => ZB_PAY_EMAIL_RE_.test(e) && !ZB_PAY_OWN_RE_.test(e);
    const proj = (P.missing ? [] : P.rows).map(r => ({ pid: g(P, r, 'project id'), name: g(P, r, 'contact name'), role: g(P, r, 'role / title'), email: g(P, r, 'email').toLowerCase() })).filter(c => ok(c.email));
    const co = (K.missing ? [] : K.rows).map(r => ({ company: norm_(g(K, r, 'company')), name: g(K, r, 'contact name'), email: g(K, r, 'email address').toLowerCase(),
      role: [g(K, r, 'position / title'), g(K, r, 'relationship'), g(K, r, 'role group')].join(' '), gone: !!g(K, r, 'exception date') || g(K, r, 'email / contact status') === CD.bounced }))
      .filter(c => !c.gone && ok(c.email));
    const best = a => a.filter(c => ZB_ST_MAIN_RE_.test(c.role))[0] || a[0] || null;
    keep.forEach(p => {
      const pc = best(proj.filter(c => c.pid === p.id)), cc = pc ? null : best(co.filter(c => c.company && c.company === norm_(p.account)));
      const c = pc || cc;
      p.contact = c ? { name: c.name.slice(0, 120), email: c.email, role: c.role.slice(0, 120), source: pc ? 'project contacts' : 'Client Desk' } : null;
    });
  } catch (e) { missing.push('contacts: ' + zbErr_(e)); }
  return { today, from, projects: keep, more: list.length - keep.length, missing: missing.slice(0, 10) };
}

/** Adds the approved TRI items (type, description, assignee, deadline...) and reads them back. One saveProjectRow per item. */
function zbAddTri_(pid, items) {
  const iso2mdy = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (+m[2]) + '/' + (+m[3]) + '/' + m[1] : ''; };
  const rows = () => objects_(table_(SRC.TRI, 'TRI'), ['project id', 'id', 'type', 'description'], by_(table_(SRC.TRI, 'TRI'), 'project id', pid));
  const have = {}; rows().forEach(t => { have[norm_(t.description)] = String(t.id || ''); });
  const out = [];
  items.forEach(o => {
    const k = norm_(o.description);
    if (have[k] != null) { out.push({ key: o.key, ok: true, id: have[k], why: 'already in Canvas' }); return; }
    const v = { type: o.type, description: String(o.description).trim() };
    if (o.assigned_to) v['assigned to'] = o.assigned_to;
    if (o.deadline) v.deadline = iso2mdy(o.deadline);
    if (o.likelihood) v.likelihood = o.likelihood;
    if (o.impact) v.impact = o.impact;
    if (o.mitigation) v.mitigation = o.mitigation;
    if (o.action_items) v['action items'] = o.action_items;
    try { saveProjectRow('tri', pid, { values: v }); out.push({ key: o.key, ok: false, want: k }); have[k] = ''; }
    catch (e) { out.push({ key: o.key, ok: false, why: zbErr_(e) }); }
  });
  const back = {}; rows().forEach(t => { back[norm_(t.description)] = String(t.id || ''); });
  out.forEach(x => { if (x.want == null) return;
    x.id = back[x.want] || ''; x.ok = !!x.id; if (!x.ok) x.why = 'Canvas did not keep the row'; delete x.want; });
  return { ok: true, added: out.filter(x => x.ok && !x.why).length, items: out };
}

/* CUE-REPLY-DRAFTS-2026-10-26: Kiko's waiting emails for Cue's reply drafts (bridge action mail_waiting). Kiko only. */
function zbMailWaiting_() {
  const me = String(OWNER_EMAILS[0] || '').toLowerCase(), r = cueMail_(me) || {};
  return { on: !!r.on, stale: !!r.stale, checked: Number(r.checked) || 0,
    items: (r.items || []).map(i => ({ id: i.id, from: i.from, email: i.email, subject: i.subject, at: i.at, unread: !!i.unread,
      who: i.who, name: i.name || '', pid: i.pid || '', project: i.project || '' })) };
}
function zbBoardAwaiting_(b) {
  const list = ((b && b.projects) || []).filter(p => p && /^for client awarding$/i.test(String(p.status || '').trim()));
  if (!list.length) return b;
  const key = v => String(v == null ? '' : v).trim().toLowerCase(), want = {}, since = {};
  list.forEach(p => { want[key(p.id)] = 1; });
  try {
    const sh = logSheet_().getParent().getSheetByName(CHANGES_TAB_);
    if (sh && sh.getLastRow() > 1) {
      const last = sh.getLastRow(), n = Math.min(last - 1, 20000), v = sh.getRange(last - n + 1, 1, n, CHANGES_HEAD_.length).getValues();
      v.forEach(r => {
        const id = key(r[9]);
        if (!want[id] || key(r[11]) !== 'project status' || key(String(r[13]).replace(/^'/, '')) !== 'for client awarding') return;
        const t = String(r[0]).trim(), m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        const d = Object.prototype.toString.call(r[0]) === '[object Date]' ? Utilities.formatDate(r[0], 'Asia/Manila', 'yyyy-MM-dd')
          : m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : (t.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
        if (d && (!since[id] || d > since[id])) since[id] = d;
      });
    }
  } catch (e) { /* the log is optional */ }
  let ce = {};
  try { ce = ceActiveTotals_(book_(TRACKER_ID)) || {}; } catch (e) { ce = {}; }
  list.forEach(p => {
    const c = ce[String(p.id).trim()] || {};
    p.awaiting = { since: since[key(p.id)] || '', ce_total: typeof c.total === 'number' ? c.total : null, ce_no: String(c.ceNo || '') };
  });
  return b;
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

/* GPT-READINESS-CACHE-2026-10-23. A full readiness run takes minutes and ChatGPT stops waiting after about one, but the call
 * still finishes here. Each finished result is kept 6 hours (script cache, per project and gate); a result under 15 minutes
 * old (or under max_age_minutes) is returned at once with as_of. Read only: no trigger, schedule or sheet write. */
const ZB_RD_FRESH_MIN_ = 15, ZB_RD_TTL_ = 21600;
const zbRdKey_ = (pid, gate) => 'gptrd:' + pid + ':' + gate;
function zbRdCached_(pid, gate, maxAge) {
  const lim = (maxAge || ZB_RD_FRESH_MIN_) * 60000;
  let c = null; try { const s = CacheService.getScriptCache().get(zbRdKey_(pid, gate)); c = s ? JSON.parse(s) : null; } catch (e) { c = null; }
  if (c && Date.now() - Date.parse(c.as_of) < lim)
    return Object.assign(c, { cached: true, stale: Date.now() - Date.parse(c.as_of) >= ZB_RD_FRESH_MIN_ * 60000 });
  const out = Object.assign(zbReadiness_(pid, gate), { as_of: new Date().toISOString(), cached: false });
  try {
    let s = JSON.stringify(out);
    if (s.length > 95000) { const k = Object.assign({}, out, { items: (out.items || []).slice(0, 40), items_cut: true }); s = JSON.stringify(k); }
    CacheService.getScriptCache().put(zbRdKey_(pid, gate), s, ZB_RD_TTL_);
  } catch (e) { /* the cache never fails the answer */ }
  return out;
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

/* ---------- CUE-AR-2026-10-21: acknowledgement receipts ---------- */
const zbArView_ = a => a ? { ar_id: a.id, status: a.status, url: a.url, generated: a.generated, emailed: a.emailed, signed_at: a.signedAt || '', signed_url: a.signedUrl || '' } : null;
// CREW-DOCS-2026-10-26: Cue's Generate FSAs / ARs list. Crew rows carry has_email, registered, can_sign and send_why (AutoDocs adSendTo_).
function zbCrewDocs_(pid, kind) {
  // CREW-DOCS-SPEED-2026-10-27 (Cue PC check 02:07Z: the AR list took 272 s for 59 rows): one arItems_ pass instead of two
  // (arPeople, then again for the emails), with each tab it reads read once. Same rows and fields as arPeople gave.
  if (kind === 'ar') return tmemo_(ZB_AR_TABS_(), () => {
    const all = zbArFlags_(arItems_(pid)), items = all.slice(0, 200), cur = {};
    arStatus_(pid).forEach(a => { cur[a.key] = a; });
    return { draft: adDraft_('ar', ntfProject_(pid).name), more: all.length > 200, items: items.map(p => { const ar = arCovers_(arCur_(cur, p), p) ? arCur_(cur, p) : null;
      return Object.assign({ key: p.key, kind: p.kind, name: p.name, role: p.role, amount: p.amount, paid_on: p.paidOn || '', why: p.why || '', doc: zbArView_(ar) },
        p.kind === 'Resource' ? zbSendView_(adSendTo_(p.name, null, p.email || ''))
        : { has_email: !!p.email, registered: true, can_sign: false, send_why: p.email ? '' : 'No email on file.' }); }) };
  });
  const cur = {}, sent = {}; fsaStatus_(pid).forEach(f => { cur[f.key] = f; });
  fsaRows_(fsaTab_(false)).forEach(o => { if (norm_(o.r[FSA_C_['Project ID']]) !== norm_(pid) || /replaced/i.test(o.r[FSA_C_['Status']])) return;
    const fp = adFpOf_(o.r[FSA_C_['Fingerprint']]); sent[fsaKey_(o.r[FSA_C_['Name']], o.r[FSA_C_['Role']])] = fp.sent ? 'Sent ' + (fp.at || '') : ''; });
  const all = fsaPeople_(pid);
  return { draft: adDraft_('fsa', ntfProject_(pid).name), more: all.length > 200, items: all.slice(0, 200).map(p => { const f = cur[p.key];
    return Object.assign({ key: p.key, kind: 'Resource', name: p.name, role: p.role, why: p.why || (p.person && p.person.unlisted ? 'Not in the Freelancers database yet.' : ''),
      doc: f ? { id: f.id, status: f.status, url: f.url, generated: f.generated, signed_at: f.signedAt || '', sent: sent[p.key] || '' } : null },
      zbSendView_(adSendTo_(p.name, p.person, p.person && p.person.email))); }) };
}
/* CREW-DOCS-AR-FLAGS-2026-10-27 (Cue PC check 02:13Z on Hiraya): Cue's AR list keeps two kinds of payment out of Make, with the
 * reason on the row. Canvas's own Generate window is unchanged.
 *  - A rounding fix (Cost Item says rounding, e.g. "Combined-transfer rounding variance", ₱4): not a payment for work.
 *    AR-FLAGS-NARROW-2026-10-27 (Cue PC recheck 03:06Z): only the Cost Item is read. "Do not pay again" is the standard note
 *    on every historical paid row (Maxicom, Jollibee/McDonald's, Lalamove, Transportify), not a no-AR mark, and a real payment
 *    can mention a rounding in its Service Provided note (Mariana's ₱4,936 food row), so neither blocks Make any more.
 *  - A group payment whose request names crew who also have their own Resources row on this project (e.g. "Jerry Palo and
 *    Batangas Crew", listing each person's share): making it and their crew ARs would receipt the same money twice. Their
 *    crew ARs stay tickable; the group one can still be made from Canvas's Generate window if that is the one Kiko wants. */
const ZB_AR_ODD_ = /\brounding\b/i;
function zbArFlags_(all) {
  const crew = all.filter(p => p.kind === 'Resource').map(p => ({ name: p.name, w: normName_(p.name).split(' ').filter(x => x.length > 1 && !/^(jr|sr|ii|iii|iv)$/.test(x)) })).filter(c => c.w.length >= 2);
  return all.map(p => {
    if (p.kind === 'Resource' || p.why || !p.req) return p;
    const q = p.req;
    if (ZB_AR_ODD_.test(normName_(q.item))) return Object.assign({}, p, { why: 'A rounding fix, not a payment for work, so no AR.' });
    // AR-GROUP-NARROW-2026-10-27 (Cue PC recheck 03:25Z): a group payment is a breakdown that lists at least two crew, each
    // name followed by an amount ("Jerry Mercado Palo ₱2,500; Cesar Marasigan Jr ₱1,500"), in Cost Item or Service Provided.
    // The payee and supplier names are not read: Maxicom and the dancer meals were paid through Mariana, who is crew here.
    // A merged installment item (arMergeInstallments_) carries its requests in members; each one's breakdown is read.
    const listed = ' ' + normName_((p.members || [p]).map(m => [m.req.item, m.req.service].join(' ; ')).join(' ; ')) + ' ', esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const named = crew.filter(c => new RegExp('\\s' + esc(c.w[0]) + '(\\s\\S+){0,3}?\\s' + esc(c.w[c.w.length - 1])
      + '(\\s(jr|sr|ii|iii|iv))?\\s*[:\\-\u2013\u2014]?\\s*(\u20b1|php|p)?\\s*\\d').test(listed)).map(c => c.name);
    return named.length >= 2 ? Object.assign({}, p, { why: 'Group payment that names crew with their own rows here (' + named.slice(0, 4).join(', ') + (named.length > 4 ? ' and ' + (named.length - 4) + ' more' : '')
      + '). Make their crew ARs, or make this one in Canvas if that is the receipt you want.' }) : p;
  });
}
// The tabs one AR list reads (arItems_, arRequests_, arPerson_ and the roles table), each read once inside tmemo_.
const ZB_AR_TABS_ = () => [[SRC.TRI, 'Resource'], [SRC.SCOPES, 'Payment Request'], [SRC.SCOPES, 'Transfers'], [SRC.SCOPES, 'Supplier Entries'],
  [SRC.SCOPES, 'Scope Categories'], [SRC.SUPPLIERS, 'Main'], [SRC.ROCKETEERS, 'QRY'], [AR_.rolesBook, AR_.rolesTab]];
const zbSendView_ = t => ({ has_email: t.has_email, registered: t.registered, can_sign: t.can_sign, send_why: t.send_why });
function zbCrewMake_(r) {
  const x = zbProject_(r); if (x.error) return { ok: false, error: x.error };
  const keys = r.args.keys.map(String).filter((v, i, l) => v.trim() && v.length <= 300 && l.indexOf(v) === i);
  try { return Object.assign({ ok: true }, adJobAdd_(r.args.request_id, r.project_id, r.args.kind, keys)); } catch (e) { return { ok: false, error: zbErr_(e) }; }
}
function zbArList_(pid) {
  const o = arPeople(pid), items = (o.items || []).slice(0, 200);
  return { more: (o.items || []).length > 200, items: items.map(p => ({ key: p.key, kind: p.kind, name: p.name, role: p.role, amount: p.amount,
    paid_on: p.paidOn || '', request_id: p.requestId || '', has_email: !!p.hasEmail, why: p.why || '', ar: zbArView_(p.ar) })) };
}
// A receipt made in the last 10 minutes (the AR Receipts tab's "Generated", script time zone).
function zbArFresh_(generated, now) {
  let d = null; try { d = Utilities.parseDate(String(generated || ''), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); } catch (e) { return false; }
  return !!d && (now || Date.now()) - d.getTime() < 10 * 60 * 1000;
}
function zbArItem_(r) {
  const x = zbProject_(r); if (x.error) return { error: x.error };
  const p = arFind_(arItems_(r.project_id), r.args.key);
  if (!p) return { error: 'That person or payment is no longer on this project. Refresh the list.' };
  return { p };
}
function zbArMake_(r) {
  const it = zbArItem_(r); if (it.error) return { ok: false, error: it.error };
  const p = it.p, pid = r.project_id;
  if (p.why) return { ok: false, error: p.name + ': ' + p.why };
  const cur = arStatus_(pid).filter(a => arMine_(p, a.key))[0];
  if (cur && arCovers_(cur, p) && (!r.args.remake || zbArFresh_(cur.generated))) return { ok: true, existed: true, name: p.name, kind: p.kind, ar: zbArView_(cur) };
  const res = arMake(pid, p.key, { redo: !!r.args.remake });
  // Read back: the new row must be on the AR Receipts tab as the current receipt.
  const made = (res.ar || []).filter(a => a.id === res.made.id)[0];
  if (!made) return { ok: false, error: 'Canvas made ' + res.made.file + ' but it is not on the AR Receipts tab. Check the project in Canvas.' };
  return { ok: true, existed: false, name: p.name, kind: p.kind, ar: zbArView_(made), folder_url: res.folderUrl || '' };
}
function zbArEmail_(r) {
  const it = zbArItem_(r); if (it.error) return { ok: false, error: it.error };
  const p = it.p, pid = r.project_id;
  if (p.kind === 'Resource') return { ok: false, error: 'Freelancer receipts are signed in Canvas Client, not emailed.' };
  let out = null;
  locked_(() => {   // under the app's lock, so two taps can't both send
    const sh = arTab_(false), o = arRows_(sh).filter(v => norm_(v.r[AR_C_['Project ID']]) === norm_(pid) && arMine_(p, v.r[AR_C_['Key']])
      && !/replaced/i.test(v.r[AR_C_['Status']]))[0];
    if (!o) { out = { ok: false, error: 'No receipt for ' + p.name + ' yet. Make it first.' }; return; }
    const g = h => o.r[AR_C_[h]];
    if (!arCovers_({ reqs: g('Request ID') }, p)) { out = { ok: false, error: p.name + ' was paid again since this receipt was made. Make it again first.' }; return; }
    if (/^Sent to /.test(g('Emailed'))) { out = { ok: true, existed: true, name: p.name, ar_id: g('AR ID'), emailed: g('Emailed') }; return; }
    if (!g('PDF ID')) { out = { ok: false, error: 'This receipt has no PDF. Make it again.' }; return; }
    const sent = arEmail_(p, arEvent_(pid), DriveApp.getFileById(g('PDF ID')));
    sh.getRange(o.row, AR_C_['Emailed'] + 1).setValue(safe_(sent));
    out = /^Sent to /.test(sent) ? { ok: true, existed: false, name: p.name, ar_id: g('AR ID'), emailed: sent } : { ok: false, error: sent };
  });
  if (out.ok && !out.existed) try { logEvent('Emailed AR', 'Projects', pid + ': ' + p.name + ' (from Cue)'); } catch (e) { /* logging never blocks */ }
  return out;
}

/* CUE-SIGNATURES-2026-10-21: unsigned freelancer documents and their reminders.
 * Chasing starts the day after the event's last day (Kiko 08:08Z); Cue decides that from event_end. The last day is the
 * Directory event date plus the highest "Day N" anyone on the project's Resources rows worked, less one. */
const ZB_SIGN_URL_ = 'https:' + '/' + '/' + 'canvas.blankspaceevent.com/crew';   // where freelancers sign (Canvas Client)
const ZB_REMIND_TAB_ = 'Doc Reminders';
const ZB_REMIND_HEAD_ = ['Reminder ID', 'Sent at', 'To', 'Docs', 'Subject', 'From', 'By'];
const ZB_WAITING_RE_ = /^waiting for signature$/i;
function zbUnsignedDocs_() {
  const docs = [];
  fsaRows_(fsaTab_(false)).forEach(o => { const x = o.r, g = h => String(x[FSA_C_[h]] || '').trim();
    if (ZB_WAITING_RE_.test(g('Status'))) docs.push({ doc: 'FSA', id: g('FSA ID'), project_id: g('Project ID'), project: g('Project'), name: g('Name'),
      email: g('Email').toLowerCase(), role: g('Role'), generated: g('Generated') }); });
  arRows_(arTab_(false)).forEach(o => { const x = o.r, g = h => String(x[AR_C_[h]] || '').trim();
    if (g('Kind') === 'Resource' && ZB_WAITING_RE_.test(g('Status'))) docs.push({ doc: 'AR', id: g('AR ID'), project_id: g('Project ID'), project: g('Project'),
      name: g('Name'), email: g('Email').toLowerCase(), role: g('Role or Scope'), generated: g('Generated') }); });
  if (!docs.length) return { sign_url: ZB_SIGN_URL_, docs: [] };
  const P = {}; getProjectsAll_().forEach(p => { P[norm_(p.id)] = p; });
  const res = table_(SRC.TRI, 'Resource'), pc = col_(res, 'project id'), last = {};
  const days = dayCols_(res).filter(d => d !== PROD_DAY_).map(d => ({ c: col_(res, d), n: Number(d.replace(/\D/g, '')) }));
  res.rows.forEach(r => { const k = norm_(r[pc]); days.forEach(d => { if (num_(r[d.c]) > 0 && d.n > (last[k] || 0)) last[k] = d.n; }); });
  const tz = Session.getScriptTimeZone(), iso = d => d ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
  return { sign_url: ZB_SIGN_URL_, docs: docs.map(d => {
    const k = norm_(d.project_id), p = P[k] || {}, start = toDate_(p.date), n = last[k] || 1;
    const end = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + n - 1) : null;
    return Object.assign(d, { event_date: iso(start), event_days: n, event_end: iso(end), project_status: p.status || '', admin_status: p.adminStatus || '' });
  }) };
}
function zbRemindTab_() {
  const ss = logSheet_().getParent();
  let sh = ss.getSheetByName(ZB_REMIND_TAB_);
  if (!sh) { sh = ss.insertSheet(ZB_REMIND_TAB_); sh.getRange(1, 1, 1, ZB_REMIND_HEAD_.length).setValues([ZB_REMIND_HEAD_]); sh.setFrozenRows(1); }
  return sh;
}
function zbDocReminder_(a) {
  const to = a.email.toLowerCase();
  const open = {}; zbUnsignedDocs_().docs.forEach(d => { open[d.doc + '|' + d.id] = d; });
  const want = a.docs.map(x => open[x.doc + '|' + x.id]);
  const wrong = a.docs.filter((x, i) => want[i] && want[i].email !== to);
  if (wrong.length) return { ok: false, error: wrong.map(x => x.doc + ' ' + x.id).join(', ') + ' is not for ' + to + '. Nothing was sent.' };
  const live = want.filter(Boolean);
  if (!live.length) return { ok: true, sent: false, reason: 'already signed or replaced', docs: [] };
  const from = String(mbx_('docs', 'from', 'freelancers@blankspaceevent.com')).toLowerCase();
  let can = from === deployer_(); try { can = can || GmailApp.getAliases().map(x => String(x).toLowerCase()).indexOf(from) >= 0; } catch (e) { /* no Gmail access */ }
  if (!can) return { ok: false, error: from + ' is not set up to send from yet. Nothing was sent.' };
  const ids = live.map(d => d.doc + ' ' + d.id).join(', '), me = me_() || 'cue';
  return locked_(() => {
    const sh = zbRemindTab_(), n = sh.getLastRow();
    const seen = n > 1 ? sh.getRange(2, 1, n - 1, ZB_REMIND_HEAD_.length).getDisplayValues().filter(x => x[0] === a.reminder_id)[0] : null;
    if (seen) return { ok: true, sent: true, existed: true, sent_at: seen[1], to: seen[2], docs: seen[3].split(', ') };
    const opts = { from, name: mbx_('docs', 'name', 'Blank Space Events – Freelancers') }, bcc = mbx_('docs', 'bcc', '');
    if (bcc) opts.bcc = bcc;
    mailSendLabeled_(['Signature Reminder Sent'], to, a.subject, a.body, opts);
    const at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    sh.getRange(n + 1, 1, 1, ZB_REMIND_HEAD_.length).setValues([[a.reminder_id, at, to, ids, a.subject, from, me].map(safe_)]);
    try { logEvent('Signature reminder sent', 'Projects', to + ': ' + ids + ' (from Cue)'); } catch (e) { /* logging never blocks */ }
    return { ok: true, sent: true, existed: false, sent_at: at, to, from, docs: live.map(d => d.doc + ' ' + d.id) };
  });
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
  return done(c.rejected ? 'Rejected' : c.partial ? 'Partial' : 'Uncertain', { result: c.steps ? { steps: c.steps } : res, steps: c.steps, error: c.error, evidence: c.evidence });
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

/* ---------- CUE-LINKS-2026-10-21: Canvas address and the one-time bank-details handoff ---------- */
const ZB_CANVAS_URL_ = 'https://script.google.com/a/macros/blankspaceevent.com/s/AKfycbxZuZDGY0AkT87oYsTR3Yj151O2fa1x0BuALO7z1kQFpxi11SRceNKpIA_AWT9Z6mW6Rw/exec';
const CUE_HANDOFF_SECS_ = 600;
function zbCanvasUrl_() {
  let u = ''; try { u = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/AKfycbxZuZ[A-Za-z0-9_-]+\/exec$/.test(u) ? u : ZB_CANVAS_URL_;
}
function cueHandoffPut_(a) {
  const v = { bank: String(a.bank || '').trim(), acctName: String(a.acctName || '').trim(), acctNo: String(a.acctNo || '').trim() };
  if (!v.bank && !v.acctName && !v.acctNo) throw new Error('nothing to hand off');
  const code = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  CacheService.getScriptCache().put('cuehand:' + code, JSON.stringify(v), CUE_HANDOFF_SECS_);
  return { code: code, expires_in: CUE_HANDOFF_SECS_ };
}
/** Support Desk swaps a handoff code for the bank details, once. Same access as editing a supplier. */
function cueHandoffTake(code) { guestGate_('cueHandoffTake', arguments);
  assertAdmin_();
  code = String(code || '');
  if (!/^[0-9a-f]{40}$/.test(code)) throw new Error('That bank-details code is not valid.');
  const c = CacheService.getScriptCache(), k = 'cuehand:' + code, raw = c.get(k);
  if (!raw) throw new Error('The bank details expired (10 minutes) or were already used. Copy them from Cue\'s card.');
  c.remove(k);
  return JSON.parse(raw);
}

/* GPT-CE-VERSION-2026-10-23 (Kiko 07:33Z: the CE as Canvas's own PDF in the BSE template, "already saved in Canvas as a version";
 * 07:59Z "Fully in ChatGPT"). ce_save_version runs CE Desk's Save on the server (GptCe.gs): the CE is saved as a version in CE
 * Desk, filed in "CE <client>" and the central CE tab, and its PDF (CE Desk's own layout and libraries) is saved to the project's
 * Admin folder; the answer carries the PDF link. Kiko asked for the filing himself, so ZB_FORBIDDEN_.file_ce stays for Cue's
 * signed calls only. The Active CE is never changed (a project's first version becomes Active, as in CE Desk). One call per
 * Kiko "go"; not retried by itself, since each run makes a version. ce_versions lists the saved versions and their PDFs. */
ZB_ACTIONS_.ce_save_version = {
  kind: 'write', needsProject: true, retrySafe: false,
  schema: { new_version: { type: 'boolean' }, ce_key: { type: 'string', re: /^[A-Za-z0-9_-]{1,60}$/ } },
  run: (r) => { try {
    if (String(r.task_id || '').indexOf('gpt:') !== 0) throw new Error('ce_save_version is only open to the ChatGPT door. Nothing was saved.');
    return gceSaveVersion_(r.project_id, r.args); } catch (e) { return zbGptRefusal_(e); } },
  check: (r, res) => res && res.refused ? { ok: false, rejected: true, error: res.refused }
    : res && res.ok ? { ok: true, evidence: { ce_no: res.ce_no, version: res.version, pdf_url: res.pdf ? res.pdf.url : '', filed_url: res.filed ? res.filed.url : '' } }
    : { ok: false, error: 'the version save gave no answer' }
};
ZB_ACTIONS_.ce_versions = {
  kind: 'read', needsProject: true, schema: {},
  run: (r) => gceVersions_(r.project_id)
};
ZB_GPT_ACTIONS_.push('ce_save_version', 'ce_versions');
// Sub-items ChatGPT adds become Scopes right away; the door also notes them so the next version save puts them on the CE.
(function () {
  const a = ZB_ACTIONS_.save_ce_requirements, run0 = a.run;
  a.run = (r, proj, prior) => { const res = run0(r, proj, prior);
    if (String(r.task_id || '').indexOf('gpt:') === 0 && r.args.subs) { try { gceNoteSubs_(r.project_id, r.args.subs, res); } catch (e) { /* never fails the save */ } }
    return res; };
})();

/* GPT-GATE-PASS-2026-10-23 (Kiko 10:29Z: "Teach the skill to CanvasGPT - i intend to copy and paste details from suppliers - their
 * names and equipment should be copied and pasted in the gate pass document"). Reads and saves the Gate Pass supplier rows that
 * Project documents > Gate Pass > Generate edits (Code.gs GATE-PASS: Activity sheet > Gate Pass Suppliers). gate_pass_save
 * changes only the suppliers it names (matched by name, any case and spacing) and keeps every other row. Same clean-up as
 * Generate (gpText_ / gpList_: peso amounts taken out). A blank field keeps what is there. mode "add" keeps the lines already
 * there and adds the new ones; "replace" (default) puts the sent text in place. It never makes the PDF: Generate in Canvas does,
 * with these rows filled in. Completed projects are locked, as in Generate (projectDoneLock_). */
const zbGpKey_ = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
// The project's awarded suppliers and their scopes, as the Generate window's dropdown and Scope prefill (gpAwarded / gpScopeOf).
function zbGpAwarded_(pid) {
  const E = table_(SRC.SCOPES, 'Supplier Entries'), S = table_(SRC.SCOPES, 'Scope Categories'), by = {}, sc = {};
  const yes = v => ['true', 'yes', 'y', '1', '✓'].indexOf(norm_(v)) >= 0;
  objects_(S, ['scope id', 'category', 'description'], by_(S, 'event id', pid))
    .forEach(s => { sc[String(s['scope id'] || '').trim()] = String(s.category || s.description || '').trim(); });
  objects_(E, ['supplier', 'scope id', 'awarded'], by_(E, 'event id', pid)).forEach(e => {
    const n = String(e.supplier || '').trim().replace(/\s+/g, ' '); if (!n || !yes(e.awarded)) return;
    const x = by[zbGpKey_(n)] || (by[zbGpKey_(n)] = { supplier: n, scopes: [] }), c = sc[String(e['scope id'] || '').trim()];
    if (c && x.scopes.indexOf(c) < 0) x.scopes.push(c);
  });
  return Object.keys(by).map(k => ({ supplier: by[k].supplier, scope: by[k].scopes.join(', ') })).sort((a, b) => a.supplier.localeCompare(b.supplier));
}
function zbGpPdf_(pid) {
  try { const D = table_(SRC.ADMIN, 'Directory'), row = D.rows.find(by_(D, 'project id', pid)), c = col_(D, 'gate pass');
    const u = row && c >= 0 ? String(row[c] || '').trim() : ''; return /^https:\/\//.test(u) ? u : ''; } catch (e) { return ''; }
}
const ZB_GP_NOTE_ = 'The PDF is made in Canvas: Projects > the project > Project documents > Gate Pass > Generate. These supplier rows are already filled in there.';
function zbGpRead_(pid) {
  const rows = gpRows_(gpTab_(false)).filter(r => norm_(r[0]) === norm_(pid))
    .map(r => ({ supplier: r[1], scope: r[2], names: r[3], equipment: r[4], updated: r[5], updated_by: r[6] }));
  return { project_id: pid, suppliers: rows, awarded: zbGpAwarded_(pid), gate_pass_pdf: zbGpPdf_(pid), note: ZB_GP_NOTE_ };
}
function zbGpSave_(pid, lines) {
  projectDoneLock_(pid);
  const merge = (old, add) => { const have = old.split('\n').map(zbGpKey_);
    return old.split('\n').concat(add.split('\n').filter(x => have.indexOf(zbGpKey_(x)) < 0)).filter(Boolean).join('\n'); };
  let aw = null; const awScope = n => { aw = aw || zbGpAwarded_(pid); const h = aw.filter(a => zbGpKey_(a.supplier) === zbGpKey_(n))[0]; return h ? h.scope : ''; };
  const saved = locked_(() => {
    const sh = gpTab_(true), all = gpRows_(sh), n0 = all.length, touched = {}, out = [];
    const who = me_() || 'chatgpt', at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    lines.forEach(l => {
      const name = gpText_(l.supplier, 120), add = l.mode === 'add';
      if (!name) { out.push({ supplier: String(l.supplier).slice(0, 120), result: 'skipped', why: 'no supplier name left after taking out amounts' }); return; }
      const sc = gpText_(l.scope, 300), nm = gpList_(l.names), eq = gpList_(l.equipment);
      let i = all.findIndex(x => norm_(x[0]) === norm_(pid) && zbGpKey_(x[1]) === zbGpKey_(name));
      const was = i >= 0 ? { scope: all[i][2], names: all[i][3], equipment: all[i][4] } : null;
      if (i < 0) {
        if (!nm && !eq) { out.push({ supplier: name, result: 'skipped', why: 'no names or equipment to save' }); return; }
        all.push([pid, name, sc || awScope(name), '', '', '', '']); i = all.length - 1;
      }
      const r = all[i], before = r.slice(2, 5).join('\u0001');
      if (sc) r[2] = sc;
      if (nm) r[3] = add ? merge(r[3], nm).slice(0, 3000) : nm;
      if (eq) r[4] = add ? merge(r[4], eq).slice(0, 3000) : eq;
      const changed = !was || r.slice(2, 5).join('\u0001') !== before;
      if (changed) { r[5] = at; r[6] = who; touched[i] = 1; }
      out.push({ supplier: r[1], result: !was ? 'added' : changed ? 'updated' : 'unchanged', was, now: { scope: r[2], names: r[3], equipment: r[4] } });
    });
    Object.keys(touched).map(Number).forEach(i => sh.getRange(i + 2, 1, 1, GP_HEAD_.length).setValues([all[i].map(safe_)]));
    return { out, n0 };
  });
  // Read back what the tab now holds for each supplier.
  const now = gpRows_(gpTab_(false)).filter(r => norm_(r[0]) === norm_(pid));
  saved.out.forEach(x => { if (!x.now) return;
    const h = now.filter(r => zbGpKey_(r[1]) === zbGpKey_(x.supplier))[0];
    x.readback = !!h && h[2] === x.now.scope && h[3] === x.now.names && h[4] === x.now.equipment; });
  const done = saved.out.filter(x => x.result === 'added' || x.result === 'updated').map(x => x.supplier);
  if (done.length) try { logEvent('Gate pass suppliers saved', 'Projects', pid + ': ' + done.join(', ') + ' (from ChatGPT)'); } catch (e) { /* logging never blocks */ }
  return { project_id: pid, saved: saved.out, suppliers_on_gate_pass: now.length, gate_pass_pdf: zbGpPdf_(pid), note: ZB_GP_NOTE_ };
}
ZB_ACTIONS_.gate_pass = {
  kind: 'read', needsProject: true, schema: {},
  run: (r) => zbGpRead_(r.project_id)
};
ZB_ACTIONS_.gate_pass_save = {
  // Safe to repeat: "replace" writes the same text again and "add" skips lines already there.
  kind: 'write', needsProject: true, retrySafe: true,
  schema: { lines: { type: 'array', required: true, minItems: 1, maxItems: 60, items: {
    supplier: { type: 'string', required: true, nonBlank: true, max: 200 }, scope: { type: 'string', max: 300 },
    names: { type: 'string', max: 3000 }, equipment: { type: 'string', max: 3000 }, mode: { type: 'string', oneOf: ['replace', 'add'] } } } },
  run: (r) => { try { return zbGpSave_(r.project_id, r.args.lines); } catch (e) { return zbGptRefusal_(e); } },
  check: (r, res) => {
    if (res && res.refused) return { ok: false, rejected: true, error: res.refused };
    const off = ((res && res.saved) || []).filter(x => x.now && x.readback === false).map(x => x.supplier);
    return off.length ? { ok: false, error: 'read back differs for: ' + off.join(', ') }
      : { ok: true, evidence: { saved: ((res && res.saved) || []).map(x => x.supplier + ': ' + x.result) } };
  }
};
ZB_GPT_ACTIONS_.push('gate_pass', 'gate_pass_save');

/* CRM-IN-CANVAS-2026-10-25 (Kiko "Build it all"): ChatGPT can log a call or note, add a follow-up and add an inquiry as a deal
 * in Accounts. Same saves as the page (crmLog_, crmFollow0_, crmLead_ in Code.gs). request_id keeps a repeat from adding twice. */
const ZB_CRM_RID_ = { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ }, ZB_CRM_DAY_ = { type: 'string', re: /^\d{4}-\d{2}-\d{2}$/ };
const zbCrmCheck_ = (r, res) => res && res.refused ? { ok: false, rejected: true, error: res.refused } : { ok: true, evidence: { id: res && (res.ID || (res.act && res.act.ID)) } };
ZB_ACTIONS_.crm_log = {
  kind: 'write', needsProject: false, retrySafe: true,
  schema: { request_id: ZB_CRM_RID_, kind: { type: 'string', oneOf: ['Call', 'Meeting', 'Note', 'Email'] }, company: { type: 'string', max: 120 },
    contact: { type: 'string', max: 120 }, email: { type: 'string', max: 200 }, summary: { type: 'string', required: true, nonBlank: true, max: 1000 },
    date: ZB_CRM_DAY_, follow_up_date: ZB_CRM_DAY_, follow_up: { type: 'string', max: 500 } },
  run: (r) => crmDoor_(() => crmLog_({ kind: r.args.kind, company: r.args.company, contact: r.args.contact, email: r.args.email, summary: r.args.summary,
    when: r.args.date, follow: r.args.follow_up_date ? { due: r.args.follow_up_date, what: r.args.follow_up || r.args.summary } : null }, crmDoorBy_(), 'gpt:' + r.args.request_id)),
  check: zbCrmCheck_
};
ZB_ACTIONS_.crm_followup = {
  kind: 'write', needsProject: false, retrySafe: true,
  schema: { request_id: ZB_CRM_RID_, due: { type: 'string', required: true, re: /^\d{4}-\d{2}-\d{2}$/ }, what: { type: 'string', required: true, nonBlank: true, max: 500 },
    company: { type: 'string', max: 120 }, contact: { type: 'string', max: 120 }, email: { type: 'string', max: 200 }, owner: { type: 'string', max: 200 } },
  run: (r) => crmDoor_(() => locked_(() => crmPlain_(crmFollow0_({ due: r.args.due, what: r.args.what, company: r.args.company, contact: r.args.contact, email: r.args.email,
    owner: r.args.owner }, crmDoorBy_(), 'gpt:' + r.args.request_id)))),
  check: zbCrmCheck_
};
ZB_ACTIONS_.crm_lead = {
  kind: 'write', needsProject: false, retrySafe: true,
  schema: { request_id: ZB_CRM_RID_, name: { type: 'string', required: true, nonBlank: true, max: 160 }, company: { type: 'string', max: 120 },
    contact: { type: 'string', max: 120 }, email: { type: 'string', max: 200 }, event_date: ZB_CRM_DAY_, source: { type: 'string', max: 60 }, notes: { type: 'string', max: 800 } },
  run: (r) => crmDoor_(() => crmLead_(r.args, r.args.request_id)),
  check: zbCrmCheck_
};
ZB_GPT_ACTIONS_.push('crm_log', 'crm_followup', 'crm_lead');

/* PROJECT-LOG-2026-10-27 (Kiko 10:34Z: everything about a project done in other threads is also written in the project's thread;
 * "include the mails that i receive"). Cue sends log lines: emails in and out (headers only), Ask Cue task summaries and
 * chasers sent. Canvas files each under its project (project_id, else the sender's contact project or a project named in the
 * subject) and skips the rest. A line's key makes a repeat a no-op. A log line changes no Canvas record. Cue only. */
ZB_ACTIONS_.project_log = {
  kind: 'queue', needsProject: false,
  schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ }, lines: { type: 'array', required: true, minItems: 1, maxItems: 50, items: {
    key: { type: 'string', required: true, re: /^[A-Za-z0-9:_.@-]{6,120}$/ }, kind: { type: 'string', required: true, oneOf: ['Email in', 'Email out', 'Ask Cue', 'Chaser', 'Canvas change', 'Note'] },   // PLOG_KINDS_ (ProjectLog.gs may load after this file)
    title: { type: 'string', required: true, nonBlank: true, max: 300 }, details: { type: 'string', max: 500 }, project_id: { type: 'string', re: ZB_PID_RE_ },
    email: { type: 'string', max: 200 }, subject: { type: 'string', max: 300 }, at: { type: 'string', max: 40 }, link: { type: 'string', max: 500 }, from: { type: 'string', max: 60 } } } },
  run: (r) => plogAdd_(r.args.lines, 'Cue')
};

/* RELEASE-NOTES-2026-10-27 (spec daily-release-notes.md, Kiko 02:34Z "ok"): Cue posts the day's release notes as one Canvas
 * announcement after Kiko taps Post on Cue's card. Staff groups only, from Kiko, never emailed; annBridgePost_ in Code.gs.
 * A repeat of the same request_id (relnotes:<day>) returns the first post. Cue only, not open to ChatGPT. */
ZB_ACTIONS_.ann_post = {
  kind: 'queue', needsProject: false,
  schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ }, title: { type: 'string', required: true, nonBlank: true, max: 150 },
    message: { type: 'string', required: true, nonBlank: true, max: 5000 }, groups: { type: 'array', maxItems: 3 }, track: { type: 'boolean' } },
  run: (r) => annBridgePost_(r.args)
};

/* HELP-QA-2026-10-27 (Kiko 01:48Z "Can you store How to questions? and What is questions?", 02:00Z "Yes, Canvas tab", 02:34Z
 * "Yes, build it"; spec specs/help-qa-bank.md). The "Help Q&A" tab in the activity book holds How to and What is answers for
 * crew, clients and suppliers. help_qa reads the Live rows (Cue matches a pasted question against them, in code). help_qa_add
 * adds one question nobody has answered yet as a Draft row, for Kiko to answer in the tab. Draft rows are never read out. */
const HQ_TAB_ = 'Help Q&A';
const HQ_HEAD_ = ['ID', 'Audience', 'Type', 'Question', 'Answer', 'Opens (Canvas page)', 'Also asked as', 'Status', 'Updated'];
const HQ_AUD_ = ['Crew', 'Client', 'Supplier', 'All'], HQ_PRE_ = { Crew: 'CRW', Client: 'CLI', Supplier: 'SUP', All: 'ALL' };
const hqNorm_ = s => String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function hqSheet_() { return logSheet_().getParent().getSheetByName(HQ_TAB_); }
/** Every row of the tab as objects. The header row names the columns, so a column moved by hand still reads right. */
function hqRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), HQ_HEAD_.length)).getDisplayValues(), h = v[0].map(x => String(x).trim());
  const col = k => h.indexOf(k);
  return v.slice(1).map(r => { const o = {}; HQ_HEAD_.forEach(k => { o[k] = col(k) >= 0 ? String(r[col(k)] || '').trim() : ''; }); return o; }).filter(o => o.ID || o.Question);
}
/** help_qa: the Live rows for one audience (and the All rows), or every Live row. Nothing else leaves the tab. */
function zbHelpQa_(aud) {
  return hqRows_(hqSheet_()).filter(o => o.Status === 'Live' && o.Question && o.Answer && (!aud || aud === 'All' || o.Audience === aud || o.Audience === 'All'))
    .map(o => ({ id: o.ID, audience: o.Audience, type: o.Type, question: o.Question, answer: o.Answer, opens: o['Opens (Canvas page)'],
      also: o['Also asked as'].split(';').map(x => x.trim()).filter(Boolean).slice(0, 20) }));
}
/** help_qa_add: one Draft row (no answer) for a question the bank does not answer yet. The same question twice adds nothing. */
function zbHelpQaAdd_(a) {
  const q = String(a.question).replace(/\s+/g, ' ').trim(), aud = a.audience || 'All';
  return locked_(() => {
    const sh = hqSheet_();
    if (!sh) return { ok: false, error: 'The Help Q&A tab is missing in Canvas.' };
    const rows = hqRows_(sh), same = rows.find(o => hqNorm_(o.Question) === hqNorm_(q) || o['Also asked as'].split(';').some(x => hqNorm_(x) === hqNorm_(q)));
    if (same) return { ok: true, existed: true, id: same.ID, status: same.Status };
    const pre = HQ_PRE_[aud] + '-Q-', n = rows.reduce((m, o) => o.ID.indexOf(pre) === 0 ? Math.max(m, parseInt(o.ID.slice(pre.length), 10) || 0) : m, 0);
    const id = pre + ('0' + (n + 1)).slice(-2), safe = v => /^[=+\-@]/.test(v) ? "'" + v : v;   // text is never read as a formula
    sh.appendRow([id, aud, '', safe(q), '', '', '', 'Draft', Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd')]);
    return { ok: true, existed: false, id, status: 'Draft' };
  });
}
ZB_ACTIONS_.help_qa = {
  kind: 'read', needsProject: false, schema: { audience: { type: 'string', oneOf: HQ_AUD_ } },
  run: (r) => zbHelpQa_(r.args.audience || '')
};
ZB_ACTIONS_.help_qa_add = {
  kind: 'queue', needsProject: false,
  schema: { request_id: { type: 'string', required: true, re: /^[A-Za-z0-9:_-]{8,80}$/ }, audience: { type: 'string', oneOf: HQ_AUD_ },
    question: { type: 'string', required: true, nonBlank: true, max: 300 } },
  run: (r) => zbHelpQaAdd_(r.args)
};

/* CUE-INVOICE-LINE-2026-10-27 (Kiko 09:20Z "give cue edit rights and look up rights"; specs/transfer-lookup-invoice-edit.md).
 * bi_list (read): the billing invoices and POs of the projects in the BI and PO tabs that best match a name, ID or account.
 * invoice_line (write, a claimed plan's command, so it runs once after Kiko's Approve in Cue): puts one line, such as a Telus REC
 * number, at the start of a BI's DESCRIPTION, under the same lock as Finance Desk's Edit invoice (not Paid, no payment advice).
 * When the project has no BI yet, it goes at the start of the unbilled PO's Full Description, which New invoice copies into the
 * invoice's Description. Either way the line prints under "Purchase Order #" on the With PO layout. Nothing else changes. */
const ZB_INV_MAX_ = { line: 200, desc: 2000, projects: 3 };
function zbInvTab_(name) {
  const sh = book_(TRACKER_ID).getSheetByName(name);
  if (!sh) throw new Error('the ' + name + ' tab was not found in 2026 Project Tracker');
  const v = sh.getLastRow() > 1 ? sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues() : [sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]];
  const head = v[0].map(h => String(h).trim().toUpperCase());
  return { sh, head, rows: v.slice(1).map((r, i) => ({ r: i + 2, at: h => { const c = head.indexOf(h); return c < 0 ? '' : String(r[c]).trim(); } })) };
}
function zbBiList_(query) {
  const B = zbInvTab_('BI'), O = zbInvTab_('PO'), ids = {};
  B.rows.forEach(x => { const id = x.at('PROJECT ID'); if (id && x.at('BI NUMBER')) ids[id] = true; });
  O.rows.forEach(x => { const id = x.at('PROJECT ID'); if (id && x.at('PO NO')) ids[id] = true; });
  const raw = String(query || '').trim().toLowerCase(), want = aiToks_(raw).filter(t => t && AI_GENERIC_TOKS_.indexOf(t) < 0);
  const projects = getProjectsAll_().filter(p => p.id && ids[p.id]).map(p => {
    const hay = aiToks_([p.id, p.name, p.account].join(' '));
    const score = String(p.id).toLowerCase() === raw ? 100 : want.filter(w => hay.indexOf(w) >= 0 || (w.length >= 4 && hay.some(h => h.indexOf(w) === 0))).length;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, ZB_INV_MAX_.projects);
  return { projects: projects.map(({ p, score }) => {
    const billedPo = {};
    const bis = B.rows.filter(x => x.at('PROJECT ID') === p.id && x.at('BI NUMBER')).map(x => {
      const no = x.at('BI NUMBER'); if (x.at('PO NO')) billedPo[x.at('PO NO')] = true;
      return { no, status: x.at('STATUS'), sent: x.at('SENT TO CLIENT'), po_no: x.at('PO NO'), description: x.at('DESCRIPTION'), pdf: x.at('BI PDF LINK'),
        locked: biEditWhy_(x, no) };
    });
    const pos = O.rows.filter(x => x.at('PROJECT ID') === p.id && x.at('PO NO')).map(x => ({ no: x.at('PO NO'), description: x.at('FULL DESCRIPTION'),
      line_item: x.at('LINE ITEM DESCRIPTION'), billed: !!billedPo[x.at('PO NO')] }));
    return { project_id: String(p.id), name: String(p.name || ''), account: String(p.account || ''), score, bis, pos };
  }) };
}
/** The new description: the line first (so the printed form, three description lines at most, never cuts it), then the old text. */
function zbInvJoin_(line, old) {
  const l = String(line || '').replace(/\s+/g, ' ').trim(), o = String(old || '').trim();
  if (o.indexOf(l) >= 0) return o;
  return (o ? l.replace(/[.;,:\s]+$/, '') + '. ' + o : l).slice(0, ZB_INV_MAX_.desc);
}
function zbInvoiceLine_(pid, a) {
  const line = String(a.line || '').replace(/\s+/g, ' ').trim();
  if (!!a.bi_no === !!a.po_no) return { refused: 'Name either the BI number or the PO number. Nothing was saved.' };
  return withLock_(function () {
    if (a.bi_no) {
      const T = zbInvTab_('BI'), want = String(a.bi_no).trim(), x = T.rows.filter(y => y.at('BI NUMBER') === want)[0];
      if (!x) return { refused: 'BI ' + want + ' is not in the BI tab. Nothing was saved.' };
      if (x.at('PROJECT ID') !== pid) return { refused: 'BI ' + want + ' belongs to ' + (x.at('PROJECT ID') || 'no project') + ', not ' + pid + '. Nothing was saved.' };
      const why = biEditWhy_(x, want); if (why) return { refused: why + ' Nothing was saved.' };
      const c = T.head.indexOf('DESCRIPTION'); if (c < 0) return { refused: 'the BI tab has no DESCRIPTION column. Nothing was saved.' };
      if (T.sh.getRange(x.r, c + 1).getFormula()) return { refused: 'DESCRIPTION on BI ' + want + ' is a formula, so it can\'t be changed here. Nothing was saved.' };
      const was = x.at('DESCRIPTION'), to = zbInvJoin_(line, was);
      if (to === was) return { saved: true, already: true, where: 'bi', bi_no: want, row: x.r, was, now: was };
      auditEdit_(T.sh, x.r, { headRow: 1 });
      T.sh.getRange(x.r, c + 1).setValue(safe_(to));
      const now = String(T.sh.getRange(x.r, c + 1).getDisplayValue()).trim();
      try { logEvent('Edited billing invoice', 'Cue', 'BI ' + want + ': Description (' + line + ')'); } catch (e) { /* logging never blocks a save */ }
      return { saved: true, where: 'bi', bi_no: want, row: x.r, was, now, pdf: x.at('BI PDF LINK') };
    }
    const T = zbInvTab_('PO'), want = String(a.po_no).trim(), x = T.rows.filter(y => y.at('PROJECT ID') === pid && y.at('PO NO') === want)[0];
    if (!x) return { refused: 'PO ' + want + ' is not listed for ' + pid + ' in the PO tab. Nothing was saved.' };
    const billed = zbInvTab_('BI').rows.filter(y => y.at('PROJECT ID') === pid && y.at('PO NO') === want)[0];
    if (billed) return { refused: 'PO ' + want + ' is already on BI ' + billed.at('BI NUMBER') + '. Put the line on that BI instead. Nothing was saved.' };
    const c = T.head.indexOf('FULL DESCRIPTION'); if (c < 0) return { refused: 'the PO tab has no Full Description column. Nothing was saved.' };
    if (T.sh.getRange(x.r, c + 1).getFormula()) return { refused: 'Full Description on PO ' + want + ' is a formula, so it can\'t be changed here. Nothing was saved.' };
    const was = x.at('FULL DESCRIPTION'), to = zbInvJoin_(line, was);
    if (to === was) return { saved: true, already: true, where: 'po', po_no: want, row: x.r, was, now: was };
    auditEdit_(T.sh, x.r, { headRow: 1 });
    T.sh.getRange(x.r, c + 1).setValue(safe_(to));
    const now = String(T.sh.getRange(x.r, c + 1).getDisplayValue()).trim();
    try { logEvent('Edited PO description', 'Cue', 'PO ' + want + ': ' + line); } catch (e) { /* logging never blocks a save */ }
    return { saved: true, where: 'po', po_no: want, row: x.r, was, now };
  });
}
ZB_ACTIONS_.bi_list = {
  kind: 'read', needsProject: false, schema: { query: { type: 'string', required: true, nonBlank: true, max: 200 } },
  run: (r) => zbBiList_(r.args.query)
};
ZB_ACTIONS_.invoice_line = {
  kind: 'write', needsProject: true, retrySafe: true,
  schema: { line: { type: 'string', required: true, nonBlank: true, max: 200 }, bi_no: { type: 'string', re: /^\d{1,6}$/ },
    po_no: { type: 'string', re: /^[A-Za-z0-9-]{3,40}$/ } },
  run: (r) => zbInvoiceLine_(r.project_id, r.args),
  check: (r, res) => {
    if (res && res.refused) return { ok: false, rejected: true, error: res.refused };
    const l = String(r.args.line || '').replace(/\s+/g, ' ').trim().replace(/[.;,:\s]+$/, '');
    return res && res.saved && String(res.now || '').indexOf(l) >= 0 ? { ok: true } : { ok: false, error: 'read back differs: ' + String((res && res.now) || '').slice(0, 200) };
  }
};
