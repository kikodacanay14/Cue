// Part of test/cue.test.js. Feature: team inbox project chats, Request access kind and the decisions log
// (src/CueInboxProjects.gs, src/CueInbox.gs, src/Inbox.html). Spec: CanvasWorkspace docs/specs/team-inbox-design.md
// section 14 (D4, D6) and section 15 (Project chats), Kiko 11 Nov 2026. The bridge is the harness mock; only get_project_board is read.
const projBox = (o = {}) => inboxBox(o);
const BOARD_P = [
  { id: 'S-10000001AA', name: 'Acme Gala', status: 'For CE Creation', phase: 'Planning' },
  { id: 'S-10000002BB', name: 'Beta Expo', status: 'For Event Execution', phase: 'Execution' },
  { id: 'S-10000003CC', name: 'Old Launch', status: 'Completed', phase: 'Complete' },
  { id: 'S-10000004DD', name: 'Lost Pitch', status: 'Not Awarded', phase: 'Other Status' },
  { id: '', name: 'blank row' }
];

test('P1 project chats: one ChatGPT API chat per open Canvas project, none for complete, lost or blank rows', () => {
  const t = projBox({ projects: BOARD_P });
  const r = inboxJson(t.ctx.cueInboxSyncProjects(true));
  deq(r, { added: 2, renamed: 0, retired: 0 });
  const rows = inboxRows(t, 'Inbox Chats');
  deq(rows.map(x => [x[1], x[2], x[3], x[7]]), [['ChatGPT API', 'Acme Gala', 'Active', 'S-10000001AA'], ['ChatGPT API', 'Beta Expo', 'Active', 'S-10000002BB']]);
  const list = inboxJson(t.ctx.cueInboxList());
  deq(list.chats.map(c => c.project_id), ['S-10000001AA', 'S-10000002BB']);
});

test('P2 a second sync makes no duplicate, follows a rename, and retires a chat whose project closed (messages stay)', () => {
  const t = projBox({ projects: BOARD_P });
  t.ctx.cueInboxSyncProjects(true);
  const acme = inboxRows(t, 'Inbox Chats')[0][0];
  t.ctx.cueInboxSend(acme, 'Confirm', 'Book the venue?');
  const t2 = BOARD_P.map(p => Object.assign({}, p));
  t2[0].phase = 'Complete'; t2[0].status = 'Completed'; t2[1].name = 'Beta Expo 2027';
  t.opts.projects = t2;
  const r = inboxJson(t.ctx.cueInboxSyncProjects(true));
  deq(r, { added: 0, renamed: 1, retired: 1 });
  const rows = inboxRows(t, 'Inbox Chats');
  deq(rows.map(x => [x[2], x[3]]), [['Acme Gala', 'Retired'], ['Beta Expo 2027', 'Active']]);
  deq(inboxRows(t, 'Inbox Messages').length, 1);
});

test('P3 the sync reads at most once every 10 minutes unless forced, and a failed read changes nothing and says why', () => {
  const t = projBox({ projects: BOARD_P });
  t.ctx.cueInboxSyncProjects(false);
  const n = t.log.board;
  deq(inboxJson(t.ctx.cueInboxSyncProjects(false)), { skipped: true });
  deq(t.log.board, n);
  const f = projBox({ boardFail: true });
  const r = inboxJson(f.ctx.cueInboxSyncProjects(true));
  assert.ok(/Canvas projects could not be read/.test(r.error), r.error);
  deq(inboxRows(f, 'Inbox Chats').length, 0);
});

test('P4 the project sync only reads: get_project_board is its one bridge action, and no AI is called', () => {
  const t = projBox({ projects: BOARD_P });
  t.ctx.cueInboxSyncProjects(true);
  deq([...new Set(t.log.bridge.map(b => b.action))], ['get_project_board']);
  deq(t.log.gpt.length, 0);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'CueInboxProjects.gs'), 'utf8');
  deq([...src.matchAll(/cueBridge_\(s, '([a-z_]+)'/g)].map(m => m[1]), ['get_project_board']);
});

test('P5 Request access is a third kind: saved New, no AI call, Approve or Reject recorded, nothing runs', () => {
  const t = projBox({ gpt: { inbox_reply: { reply: 'x' } } });
  const c = inboxChat(t, 'ChatGPT API', 'Tools');
  const r = inboxJson(t.ctx.cueInboxSend(c, 'Request access', 'Give Ana the project board.', 'Other tool'));
  deq(r.status, 'New');
  deq(t.log.gpt.length, 0);
  deq(inboxJson(t.ctx.cueInboxDecide(r.message_id, 'Reject', '')).decision, 'Rejected');
  const d = inboxRows(t, 'Inbox Decisions')[0];
  deq([d[1], d[2], d[6]], [r.message_id, 'Rejected', 'Request access']);
});

test('P6 the decisions log lists every decision newest first with chat, kind, who and the message start; owner only', () => {
  const t = projBox();
  const c = inboxChat(t, 'claude.ai', 'Canvas PO');
  const a = inboxJson(t.ctx.cueInboxSend(c, 'Confirm', 'Ship V526?'));
  const b = inboxJson(t.ctx.cueInboxSend(c, 'Request access', 'Board access for Jo', 'Other tool'));
  t.ctx.cueInboxDecide(a.message_id, 'Approve', '');
  t.ctx.cueInboxDecide(b.message_id, 'Reject', '');
  const log = inboxJson(t.ctx.cueInboxDecisions());
  deq(log.map(d => [d.chat, d.kind, d.decision, d.body]), [['Canvas PO', 'Request access', 'Rejected', 'Board access for Jo'], ['Canvas PO', 'Confirm', 'Approved', 'Ship V526?']]);
  assert.ok(log.every(d => typeof d.by === 'string'));
  const o = projBox({ viewer: 'other@example.com' });
  assert.throws(() => o.ctx.cueInboxDecisions(), /private to its owner/);
  assert.throws(() => o.ctx.cueInboxSyncProjects(true), /private to its owner/);
});

