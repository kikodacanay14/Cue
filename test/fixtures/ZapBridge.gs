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
  get_readiness: {
    // CUE-2026-10-21 (Kiko 07:32Z approved specs/project-readiness.md). The project's readiness checklist exactly as the
    // Checklist tab computes it (getChecklist: Canvas's own rules, counts and auto checks), for Cue's readiness card.
    // Read only: no item, review, exception or gate approval is written. gate 'auto' (default) = Closeout once the event
    // date has passed or the project is in Closure; Pre-Event Readiness before that.
    kind: 'read', needsProject: true, schema: { gate: { type: 'string', oneOf: ['auto', 'pre', 'close'] } },
    run: (r) => zbReadiness_(r.project_id, r.args.gate || 'auto')
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
