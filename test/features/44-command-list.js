// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: command-list.
/* ---------- STRUCTURE-PHASE-2 items 2.1 and 2.2 (Kiko 28 Oct 2026 04:21Z; stories Cue #138, #139): the command list ----------
 * cueSendWith_, cueRunLeased_ and cueApprove read the lists in CueCommands.gs instead of hand-written chains. CMD1 replays the order
 * the old chain called its checks in (recorded from live Cue 1.27.47 plus phase 1, before the change, commit d91b2fe) for each kind of message. */
const CL_CHECKS = ['cueLearnSaid_', 'cueTtConnectSaid_', 'cueSchedSaid_', 'cueTxSaid_', 'cueInvSaid_', 'cueAllowSaid_', 'cueCsSaid_',
  'cueBidsThread_', 'cueBidsFor_', 'cueBidsRedo_', 'cueCecReply_', 'cueCecAsked_', 'cueTriSaid_', 'cueCanvasSaid_', 'cuePhReply_', 'cueMemPaste_', 'cueRouteExact_', 'cueGtAsked_',
  'cueIsPersonal_', 'cueFinAsk_', 'cueWorkflowReply_', 'cueWorkflowAsked_', 'cueHsAsked_', 'cueFunnelAsked_', 'cueBidsAsked_', 'cueRecostStart_', 'cueIsSupplier_', 'cueTalk_'];
const CL_REF = 'cue-20261028000000-abcd', CL_FILE = [{ name: 'a.pdf', mimeType: 'application/pdf', data: 'eA==' }], CL_HI = 'hello there, how is it going today';
const CL_CASES = { plain: [CL_HI, [], '', ''], chat: [CL_HI, [], 'chat', ''], intake: [CL_HI, [], 'intake', ''], thread: [CL_HI, [], '', CL_REF],
  threadChat: ['hello there', [], 'chat', CL_REF], files: ['see attached', CL_FILE, '', ''], forced: [CL_HI, [], '', '', { reply: 'x' }],
  bidsHome: ['what about the second bid', [], '', CL_REF], wfThread: ['change step two', [], '', CL_REF], finThread: ['and last month?', [], '', CL_REF],
  filesChat: ['see attached', CL_FILE, 'chat', ''], addProject: ['add project: launch party for Mats Co in Makati, 200 guests', [], '', ''] };
const CL_KIND = { wfThread: { kind: 'workflow', status: 'Needs you' }, finThread: { kind: 'finance', status: 'Done' } };
const CL_OLD = {
  plain: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cueMemPaste_","cueRouteExact_","cueGtAsked_","cueIsPersonal_","cueFinAsk_","cueHsAsked_","cueFunnelAsked_","cueBidsFor_","cueBidsAsked_","cueRecostStart_","cueIsSupplier_","cueTalk_"],
  chat: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cueMemPaste_","cueRouteExact_","cueGtAsked_","cueFinAsk_","cueHsAsked_","cueFunnelAsked_","cueBidsAsked_","cueTalk_"],
  intake: ["cueRecostStart_"],
  thread: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cuePhReply_","cueMemPaste_","cueIsPersonal_","cueBidsFor_","cueRecostStart_","cueIsSupplier_","cueTalk_"],
  threadChat: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cueMemPaste_","cueTalk_"],
  files: ["cueIsPersonal_","cueWorkflowAsked_","cueIsSupplier_"],
  forced: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cueMemPaste_","cueGtAsked_","cueIsPersonal_","cueFinAsk_","cueHsAsked_","cueFunnelAsked_","cueBidsFor_","cueBidsAsked_","cueRecostStart_","cueIsSupplier_"],
  bidsHome: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueBidsFor_","cueBidsRedo_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cuePhReply_","cueMemPaste_","cueIsPersonal_","cueBidsFor_","cueRecostStart_","cueIsSupplier_","cueTalk_"],
  wfThread: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cuePhReply_","cueMemPaste_","cueIsPersonal_","START cueWorkflowReply_"],
  finThread: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cuePhReply_","cueMemPaste_","cueIsPersonal_","START cueFinance_"],
  filesChat: ["cueWorkflowAsked_","cueTalk_"],
  addProject: ["cueLearnSaid_","cueTtConnectSaid_","cueSchedSaid_","cueTxSaid_","cueInvSaid_","cueAllowSaid_","cueCsSaid_","cueBidsThread_","cueCecReply_","cueCecAsked_","cueTriSaid_","cueCanvasSaid_","cueRecostStart_"],
};
function clReplay(k) {
  const t = sandbox(), seq = [], a = CL_CASES[k];
  CL_CHECKS.forEach(n => { t.ctx[n] = () => { seq.push(n); return n === 'cueTalk_' ? { reply: 'ok', chat: true } : null; }; });
  const load = t.ctx.cueLoad_; t.ctx.cueLoad_ = id => id === CL_REF ? { s: Object.assign({ id: CL_REF, kind: 'vendor', status: 'Done' }, CL_KIND[k] || {}), sh: null, row: 0 } : load(id);
  if (k === 'bidsHome') { const f = t.ctx.cueBidsThread_; t.ctx.cueBidsThread_ = (...x) => { f(...x); return CL_REF; }; }
  ['cueWorkflowReply_', 'cueFinance_', 'cueBidsStart_'].forEach(n => { t.ctx[n] = () => { seq.push('START ' + n); return { started: n }; }; });
  t.ctx.cueFilesSave_ = () => [];
  try { t.ctx.cueSendWith_(a[0], a[1], a[2], a[3], a[4]); } catch (e) { seq.push('THROW ' + String(e.message).slice(0, 40)); }
  return seq;
}

test('CMD1 the command list checks a message in exactly the order the old hand-written chain did, for every kind of message', () => {
  for (const k of Object.keys(CL_CASES)) deq(clReplay(k), CL_OLD[k], k);
});

test('CMD2 each kind runs, approves and says "stopped" with the same function and words as the old maps', () => {
  const t = sandbox(), K = t.ctx.cueCommands_(), fn = f => (f ? f.name : null);
  const RUN = { sweep: 'cueSweepRun_', readiness: 'cueReadyRun_', pipeline: 'cuePipeRun_', funnel: 'cueFunnelRun_', ar: 'cueArRun_', hubspot: 'cueHsRun_', status: 'cueStRun_', relnotes: 'cueRnRun_', bids: 'cueBidsRun_', gtask: 'cueGtRun_', vendor: 'cueVendorRun_', workflow: 'cueWorkflowRun_', supplier: 'cueSupplierRun_', personal: 'cuePersonalRun_', cecost: 'cueCecRun_', style: 'cueStyleRun_', email: 'cueMailRun_', memory: 'cueTeachRun_', process: 'cueTeachRun_', help: 'cueHelpRun_' };   // help: Cue 1.27.54 Help answers
  const APPROVE = { relnotes: 'cueRnApprove_', status: 'cueStApprove_', change: 'cueChangeApprove_', sweep: 'cueSweepApprove_', readiness: 'cueReadyApprove_', style: 'cueStyleApprove_', email: 'cueMailApprove_', pipeline: 'cuePipeApprove_', ar: 'cueArApprove_', expense: 'cueExpenseApprove_', cecost: 'cueCecApprove_', hubspot: 'cueHsApprove_', vendor: 'cueVendorApprove_', workflow: 'cueWorkflowApprove_', tri: 'cueTriApprove_', supplier: 'cueSupplierApprove_', personal: 'cuePersonalApprove_', memory: 'cueTeachApprove_', process: 'cueTeachApprove_' };
  const STOP = { relnotes: 'The release notes stopped: ', sweep: 'The morning sweep stopped: ', readiness: 'The readiness check stopped: ', pipeline: 'The pipeline review stopped: ', funnel: 'The sales funnel stopped: ', ar: 'The receipts stopped: ', hubspot: 'The HubSpot clean-up stopped: ', status: 'The status updates stopped: ', bids: 'The bid check stopped: ', gtask: 'The ChatGPT task stopped: ', vendor: 'The supplier search stopped: ', workflow: 'The workflow map stopped: ', supplier: 'The supplier registration stopped: ', personal: 'The personal expense stopped: ', cecost: 'The CE cost update stopped: ', style: 'Learning your style stopped: ', memory: 'Learning your memory stopped: ', process: 'Learning your process stopped: ', email: 'Drafting the email stopped: ', help: 'Reading the Help Q&A list from Canvas stopped: ' };
  for (const k of Object.keys(K)) {
    deq(fn(K[k].run) || 'cueIntakeRun_', RUN[k] || 'cueIntakeRun_', k + ' run');
    deq(K[k].stopped || 'The intake stopped: ', STOP[k] || 'The intake stopped: ', k + ' stopped line');
    if (k !== 'workflow') deq(fn(K[k].approve), APPROVE[k] || null, k + ' approve');
  }
  Object.keys(RUN).concat(Object.keys(APPROVE)).forEach(k => assert.ok(K[k], k + ' is in the list'));
  // workflow's Approve takes the id only, as cueApprove called it before
  let got; t.ctx.cueWorkflowApprove_ = (...a) => { got = a; return {}; }; K.workflow.approve('cue-1', { x: 1 }); deq(got.length, 1);
  deq([t.ctx.cueCommand_('nope'), t.ctx.cueCommand_('constructor')], [{}, {}]);
});

test('CMD3 Wrong command? reads the same list: each kind\'s command is a name in CUE_ROUTE_CMDS_, and a kind outside it is never offered', () => {
  const t = sandbox(), K = t.ctx.cueCommands_(), CMDS = vm.runInContext('CUE_ROUTE_CMDS_', t.ctx);
  const was = { intake: 'intake', change: 'intake', readiness: 'readiness', pipeline: 'pipeline', ar: 'ar', vendor: 'vendor', workflow: 'workflow', email: 'email', finance: 'money' };   // CUE_ROUTE_KIND_ before
  deq(Object.fromEntries(Object.keys(K).filter(k => K[k].cmd).map(k => [k, K[k].cmd])), was);
  Object.keys(was).forEach(k => assert.ok(CMDS[K[k].cmd], k));
  Object.keys(K).filter(k => K[k].cmd && k !== 'change').forEach(k => deq(K[k].name, CMDS[K[k].cmd], k + ' has the same name in both'));
  deq([t.ctx.cueRouteCan_({ kind: 'sweep', status: 'Needs you', files: [], text: 'LED wall suppliers' }), t.ctx.cueRouteCan_({ kind: 'vendor', status: 'Needs you', files: [], text: 'LED wall suppliers' })], [false, true]);
});

test('CMD4 no top-level function or const is defined in two server files (Apps Script would quietly keep only one)', () => {
  const dir = path.join(__dirname, '..', 'src'), seen = {}, twice = [];
  for (const f of fs.readdirSync(dir).filter(f => /\.gs$/.test(f))) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=)/gm)) {
    const n = m[1] || m[2]; if (seen[n]) twice.push(n + ' in ' + seen[n] + ' and ' + f); else seen[n] = f;
  }
  deq(twice, []);
});
