/* STRUCTURE-PHASE-2 (Kiko 28 Oct 2026 04:21Z "okay lets do that" to phase 2 of specs/cue-structure-review.md; items 2.1 and 2.2,
 * stories Cue #138 and #139): the command list. Before this, a command was written by hand in at least six places (the word checks
 * in cueSendWith_, the run and "stopped" maps in cueRunLeased_, the cueApprove chain, the Wrong command? names). Now each command
 * is one line here, and cueSendWith_, cueRunLeased_ and cueApprove read these lists. Same behaviour and same order as before:
 * test/features/49-command-list.js replays the order the old chain checked things in.
 *
 * Both lists are built when called, not when the file loads, so the order Apps Script loads files in does not matter.
 * Keep one entry per line: tools/map.mjs reads these lines to write FEATURE-MAP.md. */

/** Every task kind: what it is called, what runs it, what its Approve does, and its "stopped" line. cmd links the kind to its name in
 * the Wrong command? list (CUE_ROUTE_CMDS_ in CueRoute.gs). A kind with no run uses the intake run; with no approve, cueApprove
 * goes on to the phased or one-card intake approve; with no stopped line, the intake's. */
function cueCommands_() {
  return {
    intake: { name: 'Project intake', cmd: 'intake', run: cueIntakeRun_, approve: null, stopped: 'The intake stopped: ' },
    change: { name: 'Change request', cmd: 'intake', run: cueIntakeRun_, approve: cueChangeApprove_, stopped: 'The intake stopped: ' },
    sweep: { name: 'Morning sweep', cmd: '', run: cueSweepRun_, approve: cueSweepApprove_, stopped: 'The morning sweep stopped: ' },
    readiness: { name: 'Readiness check', cmd: 'readiness', run: cueReadyRun_, approve: cueReadyApprove_, stopped: 'The readiness check stopped: ' },
    pipeline: { name: 'Pipeline review', cmd: 'pipeline', run: cuePipeRun_, approve: cuePipeApprove_, stopped: 'The pipeline review stopped: ' },
    funnel: { name: 'Sales funnel', cmd: '', run: cueFunnelRun_, approve: null, stopped: 'The sales funnel stopped: ' },
    ar: { name: 'ARs', cmd: 'ar', run: cueArRun_, approve: cueArApprove_, stopped: 'The receipts stopped: ' },
    hubspot: { name: 'HubSpot clean-up', cmd: '', run: cueHsRun_, approve: cueHsApprove_, stopped: 'The HubSpot clean-up stopped: ' },
    bids: { name: 'Bid check', cmd: '', run: cueBidsRun_, approve: null, stopped: 'The bid check stopped: ' },
    gtask: { name: 'ChatGPT task', cmd: '', run: cueGtRun_, approve: null, stopped: 'The ChatGPT task stopped: ' },
    vendor: { name: 'Supplier search', cmd: 'vendor', run: cueVendorRun_, approve: cueVendorApprove_, stopped: 'The supplier search stopped: ' },
    workflow: { name: 'Workflow map', cmd: 'workflow', run: cueWorkflowRun_, approve: id => cueWorkflowApprove_(id), stopped: 'The workflow map stopped: ' },
    tri: { name: 'Task, issue or risk', cmd: '', run: null, approve: cueTriApprove_, stopped: '' },
    supplier: { name: 'Supplier registration', cmd: '', run: cueSupplierRun_, approve: cueSupplierApprove_, stopped: 'The supplier registration stopped: ' },
    personal: { name: 'Personal expense', cmd: '', run: cuePersonalRun_, approve: cuePersonalApprove_, stopped: 'The personal expense stopped: ' },
    expense: { name: 'Project expense', cmd: '', run: null, approve: cueExpenseApprove_, stopped: '' },
    cecost: { name: 'CE cost update', cmd: '', run: cueCecRun_, approve: cueCecApprove_, stopped: 'The CE cost update stopped: ' },
    style: { name: 'Learning your style', cmd: '', run: cueStyleRun_, approve: cueStyleApprove_, stopped: 'Learning your style stopped: ' },
    memory: { name: 'Learning your memory', cmd: '', run: cueTeachRun_, approve: cueTeachApprove_, stopped: 'Learning your memory stopped: ' },
    process: { name: 'Learning your process', cmd: '', run: cueTeachRun_, approve: cueTeachApprove_, stopped: 'Learning your process stopped: ' },
    email: { name: 'Email', cmd: 'email', run: cueMailRun_, approve: cueMailApprove_, stopped: 'Drafting the email stopped: ' },
    finance: { name: 'Money question', cmd: 'money', run: null, approve: null, stopped: '' },
  };
}
/** One kind's entry, or {} for a kind not in the list. */
function cueCommand_(kind) { const k = cueCommands_(); return Object.prototype.hasOwnProperty.call(k, kind) ? k[kind] : {}; }

/** The word checks a message meets before the AI chat call, in order; the first that answers wins. c is the message:
 * { text, files, has (files attached), mode ('' | 'chat' | 'intake'), ref (the thread, or ''), inThread, forced }.
 * said: Cue's own reply, or nothing when the words are not for it. when + go: go runs, and its result is the answer, when when is true. */
/* Where each check came from (the notes that sat on each line of cueSendWith_ before, kept word for word):
 * learn: Kiko 17:03Z "expedite how he learns": "remember: …" / "from now on …" anywhere is saved as a rule at once (no AI call).
 * ticktick: TickTick (Kiko 17:26Z, specs/cue-skills-connectors.md): "connect ticktick" gives the sign-in link, no AI call.
 * schedule: Task scheduler (Kiko 19:13Z, CueSchedule.gs): "Schedule <when> <command>" shows a Save card; "show my schedules" lists them. No AI call.
 * transfer, invoice: Transfer lookup and invoice line edit (Kiko 09:20Z 27 Oct, CueLookup.gs): Transfers read only, no AI call; an invoice line waits Approve.
 * allow: Generic Canvas edits (Kiko 10:10Z 27 Oct, CueEdit.gs): "allow cue to read|edit ..." asks for an allow-list row on an Approve card, no AI call.
 * contact-scan: old-email contact scan (CueContactScan.gs).
 * canvas: Open in Canvas (Kiko 18:59Z, specs/open-in-canvas.md): "open <project>", "request payment for <project>", "add scope … to …",
 *   "close task … in …", "price watch …", "open supplier …", "open finance": Canvas's own page, filled, with no AI call.
 * cecost, cecost-reply: CE costs (Kiko 02:37Z 22 Oct, CueCeCost.gs): "update CE cost for <project> from <person>'s email" is its own task, never an intake
 *   or a change request, and needs no tutor plan card (nothing is written before Approve). A reply to its question carries on.
 * bids-redo: PC recheck 22 Oct 05:00Z (see cueBidsRedoSaid_ below).
 * tri: Kiko 06:47Z 24 Oct (specs/cue-add-tasks.md): "add task|issue|risk … to <project>" shows an Approve card; no AI call.
 * add-project: Same spec: "add project …" / "new project …" is a project intake in Kiko's own words, so no chat call routes it.
   It answers nothing itself: it turns the message into an intake (c.text, c.mode) for the checks after it and for cueSendWith_.
 * phased-reply: CUE-PHASED (Kiko 14:53Z): a reply while a phased intake's card waits changes that task in place, never a new run or card.
 * style: Kiko 08:21Z (specs/write-like-me.md): "learn my style" starts the style guide in its own thread. Plain words, so no AI call routes it.
 * memory, process, memory-paste: Teach Cue (Kiko 16:26Z, specs/teach-cue.md): "learn my memory" / "learn my process" + pasted text, each in its own thread, no chat call.
 * money-taught: Teach Cue add-on (Kiko 17:00Z): a phrase Kiko taught Cue word for word is a money question with no AI call routing it.
 * gtask: ChatGPT scheduled tasks (CueGptTasks.gs, Kiko "Go" 22 Oct 00:55Z): "run daily plan", "prospect follow-ups"... start one in its own thread, no chat call.
 * personal: Kiko's own words say it is personal (CuePersonal.gs): its own task, never an intake or a project expense.
 * money: CFO Advisor (Kiko 07:41Z), see cueMoneyAsked_ below.
 * workflow-reply, workflow-files: Kiko 08:07Z (specs/process-mapper.md), see cueWorkflowWaiting_ below.
 * hubspot: command C12, its own thread.
 * funnel: Kiko 24 Oct 13:50Z (CueFunnel.gs): "show the funnel", "my HubSpot tasks" read HubSpot in their own thread, no AI call.
 * bids-intake, bids: Kiko 19:04Z-19:10Z (specs/bid-opportunities.md): "do intake for <reference>" of a found bid starts its intake; any bid-opportunity ask starts a bid check.
 *   PC check 22 Oct 04:45Z: "redo bid check" in a Bid check thread became a Project intake plan. A bid ask there (or "again", "redo",
 *   "re-run") runs a fresh bid check in its own thread, with no AI call. (Its thread check runs first, near the top.)
 * recost: Kiko 08:55Z: "can you cost them by item?" restarted the whole intake. Costing starts mid-way when the thread already has the read. */
function cueRoutes_() {
  const words = c => !c.has && c.mode !== 'intake';   // typed words, not an intake form
  return [
    { key: 'learn', name: '"remember: …" saves a rule', said: c => words(c) ? cueLearnSaid_(c.text, c.ref) : null },
    { key: 'ticktick', name: '"connect ticktick"', said: c => words(c) ? cueTtConnectSaid_(c.text, c.ref) : null },
    { key: 'schedule', name: '"schedule …" and "show my schedules"', said: c => words(c) ? cueSchedSaid_(c.text, c.ref) : null },
    { key: 'transfer', name: 'Transfer lookup', said: c => words(c) ? cueTxSaid_(c.text, c.ref) : null },
    { key: 'invoice', name: 'Invoice line edit', said: c => words(c) ? cueInvSaid_(c.text, c.ref) : null },
    { key: 'allow', name: '"allow cue to read|edit …"', said: c => words(c) ? cueAllowSaid_(c.text, c.ref) : null },
    { key: 'contact-scan', name: 'Old-email contact scan', said: c => words(c) ? cueCsSaid_(c.text, c.ref) : null },
    { key: 'bids-redo', name: '"redo" in a Bid check thread', said: c => cueBidsRedoSaid_(c) },
    { key: 'cecost-reply', name: 'Reply to a CE cost question', said: c => words(c) ? cueCecReply_(c.ref, c.text) : null },
    { key: 'cecost', name: '"update CE cost for …"', when: c => words(c) && cueCecAsked_(c.text), go: c => cueCecStart_(c.text, c.ref) },
    { key: 'tri', name: '"add task|issue|risk … to <project>"', said: c => words(c) ? cueTriSaid_(c.text, c.ref) : null },
    { key: 'canvas', name: 'Open in Canvas', said: c => words(c) ? cueCanvasSaid_(c.text, c.ref) : null },
    { key: 'add-project', name: '"add project …" becomes a project intake', said: c => cueAddProjectSaid_(c) },
    { key: 'phased-reply', name: 'Reply while a phased intake card waits', said: c => c.inThread && c.mode !== 'chat' ? cuePhReply_(c.ref, c.text, c.files) : null },
    { key: 'style', name: '"learn my style"', when: c => words(c) && CUE_STYLE_RE_.test(String(c.text || '')), go: c => cueStyleStart_(c.text) },
    { key: 'memory', name: '"learn my memory"', when: c => words(c) && CUE_MEM_RE_.test(String(c.text || '')), go: c => cueTeachStart_('memory', c.text) },
    { key: 'process', name: '"learn my process"', when: c => words(c) && CUE_PROC_RE_.test(String(c.text || '')), go: c => cueTeachStart_('process', c.text) },
    { key: 'memory-paste', name: 'Pasted memory text', when: c => words(c) && cueMemPaste_(c.text), go: c => cueTeachStart_('memory', c.text) },
    { key: 'money-taught', name: 'A money phrase Kiko taught word for word', when: c => !c.forced && words(c) && !c.inThread && cueRouteExact_(c.text) === 'money', go: c => cueFinance_(String(c.text).trim(), '') },
    { key: 'gtask', name: '"run daily plan" and other ChatGPT tasks', when: c => words(c) && !c.ref && cueGtAsked_(c.text), go: c => cueGtStart_(cueGtAsked_(c.text), String(c.text || '').trim(), 'chat') },
    { key: 'personal', name: 'Personal expense (Kiko\'s own words)', when: c => c.mode !== 'chat' && c.mode !== 'intake' && cueIsPersonal_(c.text), go: c => cuePersonalStart_(String(c.text || '').trim(), c.files, c.ref) },
    { key: 'money', name: 'Money question', when: c => cueMoneyAsked_(c), go: c => cueFinance_(String(c.text).trim(), c.ref) },
    { key: 'workflow-reply', name: 'Reply in a waiting workflow map', when: c => cueWorkflowWaiting_(c), go: c => cueWorkflowReply_(c.ref, c.text) },
    { key: 'workflow-files', name: 'Files with a map word', when: c => c.has && c.mode !== 'intake' && cueWorkflowAsked_(c.text), go: c => cueWorkflowFiles_(c) },
    { key: 'hubspot', name: 'HubSpot clean-up', when: c => words(c) && !c.ref && cueHsAsked_(c.text), go: c => cueHsStart_(String(c.text || '').trim(), 'chat') },
    { key: 'funnel', name: '"show the funnel", "my HubSpot tasks"', when: c => words(c) && !c.ref && cueFunnelAsked_(c.text), go: c => cueFunnelStart_(String(c.text || '').trim(), 'chat') },
    { key: 'bids-intake', name: '"do intake for <bid>"', when: c => c.mode !== 'chat' && words(c) && cueBidsFor_(c.text), go: c => cueBidsIntake_(String(c.text).trim(), c.ref) },
    { key: 'bids', name: 'Bid check', when: c => words(c) && !c.ref && cueBidsAsked_(c.text), go: c => cueBidsStart_(String(c.text || '').trim(), 'chat', '') },
    { key: 'recost', name: '"cost them", "re-cost" in a thread with a read', said: c => !c.has && c.mode !== 'chat' ? cueRecostStart_(String(c.text || '').trim(), c.ref) : null },
  ];
}

/** What the chat call can start, in the order cueSendWith_ checks its answer. go gets the chat call's answer, the message and its text. */
/* Where each came from (kept word for word):
 * readiness: Kiko 07:32Z (specs/project-readiness.md): "is X ready?" starts a readiness check in its own thread (or the thread Kiko is in).
 * pipeline: command C11, its own thread.
 * start_ar: CUE-AR: "prepare ARs for <project>" (GPT picked it in the same chat call).
 * vendor: Kiko 07:54Z (specs/vendor-management.md): "find / compare / assess suppliers" starts a supplier search in its own thread.
 * email: Kiko 08:21Z (specs/write-like-me.md step 2): "email X about Y" / "reply to X" drafts one email in Kiko's style in its own thread.
 * canvas_edit: Kiko 10:06Z 27 Oct: "Cue received it - should passed to Claude - Claude should have updated the file". A change to a Canvas
 *   record goes to Claude, then an Approve card (CueEdit.gs); the chat call's own reply is not shown. */
function cueTalkRoutes_() {
  return [
    { key: 'workflow', name: 'Workflow map', go: (talk, c, t) => { const out = cueWorkflowStart_(talk.workflow, c.ref || talk.task || '', t, []); cueOnIt_(c.ref, talk.task, 'Started a thread to map it.', out.request_id, talk.pointed); return out; } },
    { key: 'readiness', name: 'Readiness check', go: (talk, c) => { const home = c.ref || talk.task || cueReadyHome_(talk.readiness); const out = cueReadyStart_(talk.readiness, home, null, false); cueOnIt_(c.ref, home, 'Started a thread for it.', out.request_id, talk.pointed); return out; } },
    { key: 'pipeline', name: 'Pipeline review', go: (talk, c, t) => cuePipeStart_(t, talk.pipeline.client) },
    { key: 'start_ar', name: 'ARs', go: (talk, c, t) => { const home = c.ref || talk.task || '', id = cueArStart_(talk.start_ar, t, home); if (!home) cueChat_('Cue', 'Started a thread for it.', '>' + id); return { request_id: id, task: home }; } },
    { key: 'email', name: 'Email', go: (talk, c, t) => { const out = cueMailStart_(talk.email, c.ref || talk.task || '', t, talk.lookup); cueOnIt_(c.ref, talk.task, 'Started a thread for it.', out.request_id, talk.pointed); return out; } },
    { key: 'vendor', name: 'Supplier search', go: (talk, c, t) => { const out = cueVendorStart_(talk.vendor, c.ref || talk.task || '', t); cueOnIt_(c.ref, talk.task, 'Started a thread for it.', out.request_id, talk.pointed); return out; } },
    { key: 'canvas_edit', name: 'Canvas edit', go: (talk, c, t) => cueEditStart_(talk.canvas_edit, c.ref || talk.task || '', t, true) },
  ];
}

/* ---------- the longer checks, kept whole (same code as in cueSendWith_ before) ---------- */

// CE costs (Kiko 02:37Z 22 Oct, CueCeCost.gs) and bids: PC recheck 22 Oct 05:00Z. In a Bid check thread that an earlier build had
// turned into an intake card, "redo bid check" re-ran that card. Bid words in any thread whose root is a Bid check run a fresh check
// before any waiting card sees them, and the stray intake card there (nothing approved, nothing in Canvas) is closed.
function cueBidsRedoSaid_(c) {
  const bidsHome = !c.has && c.mode !== 'intake' ? cueBidsThread_(c.ref) : '';
  if (!(bidsHome && !cueBidsFor_(c.text) && cueBidsRedo_(c.text))) return null;   // 1.27.3: only an explicit redo; questions are answered in the thread
  const out = cueBidsStart_(String(c.text || '').trim(), 'chat', c.ref);
  cueCloseSuperseded_((x, root) => root === bidsHome && x.kind === 'intake' && !(x.canvas && x.canvas.project_id) && !x.approved_at && (!x.phased || (x.phase || 1) === 1),
    'Closed. This thread is a bid check, not a project intake. Nothing was written to Canvas.', true);   // PC recheck 05:13Z: that card had failed
  return out;
}
// CFO Advisor (Kiko 07:41Z): a money question is answered from Canvas numbers with one Claude call, instead of the chat call.
// A reply in a money thread stays a money question; a reply in any other task's thread never becomes one.
function cueMoneyAsked_(c) {
  return !c.has && c.mode !== 'intake' && String(c.text || '').trim() && !/^\s*new project intake/i.test(String(c.text || ''))
    && (c.ref ? (cueLoad_(c.ref) || { s: {} }).s.kind === 'finance' : cueFinAsk_(c.text));
}
// Kiko 08:07Z (specs/process-mapper.md): a reply in a workflow map's thread revises the map; files with a map word start a map.
function cueWorkflowWaiting_(c) {
  const wf = c.ref && c.mode !== 'intake' ? cueLoad_(c.ref) : null;
  return !!(wf && wf.s.kind === 'workflow' && wf.s.status === 'Needs you');
}
function cueWorkflowFiles_(c) {
  const out = cueWorkflowStart_({ name: '' }, c.ref, String(c.text || '').trim(), c.files);
  if (!c.ref) cueChat_('Cue', 'Started a thread to map it.', '>' + out.request_id);
  return out;
}
// Same spec as tri (specs/cue-add-tasks.md): "add project …" / "new project …" becomes "New project intake: …" in intake mode. It never
// answers by itself; the checks after it and cueSendWith_ read the changed c.text and c.mode, as the hand-written chain did.
function cueAddProjectSaid_(c) {
  if (c.mode !== 'chat' && c.mode !== 'intake' && CUE_ADD_PROJECT_RE_.test(String(c.text || '').trim())) {
    c.text = 'New project intake: ' + String(c.text).trim().replace(CUE_ADD_PROJECT_RE_, '').trim(); c.mode = 'intake';
  }
  return null;
}
