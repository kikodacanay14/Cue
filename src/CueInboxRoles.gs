/* Team inbox: role chats and decision routing (CanvasWorkspace docs/specs/team-inbox-design.md section 14, decisions D3 to D5;
 * Kiko 11 Nov 2026: the roles are chats, not people. Tech Lead = "BSE Apps & Systems", Account Manager = "ChatGPT Account
 * Manager", PO = Cue PO, Charter PO, Canvas PO, Chase PO, and QA. claude.ai chats cannot be reached from Cue, so Kiko chose
 * (answer A) to run the Claude roles inside Cue on the Claude API, each with written role instructions he approves.)
 * - A Confirm goes to the Tech Lead: Approve or Reject is final (D5). Escalate passes it to the Account Manager; its Escalate
 *   makes the message Contested, and Kiko decides.
 * - Request access: Google Drive goes to the Tech Lead (Kiko: "google drive. then let me approve others"); its Escalate makes it
 *   Contested. Any other tool waits for Kiko.
 * - Nothing runs on a decision (scope Q3 B): it is recorded in Inbox Decisions with who decided and why (D6).
 * - One AI call per step, at most two per message. No Canvas call. */

const CUE_INBOX_ROLE_COMMON_ = 'You are a role chat in Kiko\'s team inbox at Blank Space Events (BSE), an events company in the Philippines. '
  + 'Kiko owns BSE. Cue is his personal command center; Canvas is BSE\'s company app. Answer in plain English, short, with no preamble. '
  + 'Never invent facts: when the message does not tell you enough, say what you would need to know. '
  + 'Nothing you approve runs by itself: your decision is recorded and Kiko can review every decision.';
const CUE_INBOX_ROLE_TEXT_ = {
  'Tech Lead': 'Your role: Tech Lead (BSE Apps & Systems). You review every Confirm. Approve when the change is clear, in scope and safe for '
    + 'Cue, Canvas and BSE\'s data. Reject when it is unsafe, out of scope, or breaks a rule the message states. Escalate when you cannot '
    + 'judge it from the message, or when it touches money, client data, people\'s personal data, or anything sent outside BSE. '
    + 'For access requests you may approve Google Drive access only; escalate anything that gives access to people\'s mail, accounts or personal data.',
  'Account Manager': 'Your role: Account Manager. You review a Confirm only after the Tech Lead escalated it. Weigh the client, the cost and '
    + 'the timing. Approve or reject when you can decide; escalate to Kiko when you cannot.',
  'PO': 'Your role: Product Owner for the product named in your chat name. You answer questions about what that product should do, '
    + 'for whom, and in what order, and you keep answers inside that product\'s scope.',
  'QA': 'Your role: QA. You answer questions about how to test a change, what could break, and whether a described result meets what was asked.'
};
const CUE_INBOX_ROLE_CHATS_ = [
  ['BSE Apps & Systems', 'Tech Lead', 'Claude API'], ['ChatGPT Account Manager', 'Account Manager', 'ChatGPT API'],
  ['Cue PO', 'PO', 'Claude API'], ['Charter PO', 'PO', 'Claude API'], ['Canvas PO', 'PO', 'Claude API'], ['Chase PO', 'PO', 'Claude API'],
  ['QA', 'QA', 'Claude API']];
const CUE_INBOX_DECISION_SCHEMA_ = { type: 'object', properties: { decision: { type: 'string', enum: ['Approve', 'Reject', 'Escalate'] },
  reason: { type: 'string' } }, required: ['decision', 'reason'], additionalProperties: false };

/** The system text for a role chat. label: the chat's name, so each PO knows its product (Codex review on Cue PR #366). */
function cueInboxRoleSystem_(role, label) {
  return CUE_INBOX_ROLE_COMMON_ + (label ? ' Your chat name: ' + label + '.' : '') + (CUE_INBOX_ROLE_TEXT_[role] ? ' ' + CUE_INBOX_ROLE_TEXT_[role] : '');
}

/** Makes the role chats that are missing (matched by name and role). Sheet only, no AI. */
function cueInboxSetupRoles_() {
  cueOwner_();
  const have = {}, now = new Date(cueNow_()).toISOString();
  cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).forEach(c => { have[c.v[2] + '|' + c.v[8]] = 1; });
  let added = 0;
  CUE_INBOX_ROLE_CHATS_.forEach(r => {
    if (have[r[0] + '|' + r[1]]) return;
    cueSheet_('Inbox Chats').appendRow([cueInboxId_('CH'), r[2], r[0], 'Active', '', '', now, '', r[1]]);
    added++;
  });
  return { added };
}

/** The Active chat holding a role, or null. */
function cueInboxRoleChat_(role) {
  return cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(c => c.v[8] === role && c.v[3] === 'Active')[0] || null;
}

/** One decision call to a role chat. Returns { ok, decision, reason } or { ok: false, error }. */
function cueInboxAskDecision_(chat, m) {
  const user = 'Kind: ' + m.v[4] + (m.v[12] ? '\nTool: ' + m.v[12] : '') + '\nChat it came from: ' + (cueInboxChatLabel_(m.v[1]) || 'unknown')
    + '\nMessage:\n' + m.v[5] + '\n\nDecide: Approve, Reject or Escalate, with a one-sentence reason.';
  const o = { step: 'Team inbox decision', system: cueInboxRoleSystem_(chat.v[8], chat.v[2]), user, schema: CUE_INBOX_DECISION_SCHEMA_, name: 'inbox_decision',
    maxTokens: 1500, memory: false };
  const call = chat.v[1] === 'ChatGPT API' ? cueGpt_(o) : cueClaude_(Object.assign(o, { effort: 'low' }));
  const s = { id: 'INBOX-' + m.v[0], metrics: { ai_calls: 0, calls: [] } };
  const r = cueAiAll_(s, [call])[0];
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, decision: r.data.decision, reason: cueStr_(r.data.reason, 500) };
}
function cueInboxChatLabel_(chatId) {
  const c = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(x => x.v[0] === chatId)[0];
  return c ? c.v[2] : '';
}

/** Routes one Confirm or Request access message (D3 to D5). Returns the message's status after routing. */
function cueInboxRoute_(msgId) {
  let m = cueInboxFind_(msgId);
  const access = m.v[4] === 'Request access';
  if (access && m.v[12] !== 'Google Drive') return { message_id: msgId, status: 'New', routed_to: 'Kiko' };   // other tools: Kiko decides
  const steps = access ? ['Tech Lead'] : ['Tech Lead', 'Account Manager'];
  const trail = [];
  for (let i = 0; i < steps.length; i++) {
    const chat = cueInboxRoleChat_(steps[i]);
    if (!chat && i === 0) return { message_id: msgId, status: 'New', routed_to: 'Kiko' };   // no Tech Lead chat: Kiko decides, as before
    if (!chat) { trail.push(steps[i] + ': no active chat'); break; }
    const r = cueInboxAskDecision_(chat, m);
    m = cueInboxFind_(msgId);
    if (m.v[10]) return { message_id: msgId, status: m.v[6], decision: m.v[10], by: m.v[13] || 'Kiko' };   // Kiko decided while the call ran: keep his
    if (!r.ok) {
      m.v[6] = 'Waiting'; m.v[14] = cueStr_(chat.v[2] + ' did not answer: ' + r.error, 500);
      cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v);
      return { message_id: msgId, status: 'Waiting', error: r.error };
    }
    if (r.decision !== 'Escalate') {
      cueInboxRecord_(m, r.decision, r.reason, chat.v[2] + ' (' + steps[i] + ')');
      return { message_id: msgId, status: 'Recorded', decision: r.decision === 'Approve' ? 'Approved' : 'Rejected', by: chat.v[2] };
    }
    trail.push(chat.v[2] + ' escalated: ' + r.reason);
  }
  m = cueInboxFind_(msgId);
  m.v[6] = 'Contested'; m.v[14] = cueStr_(trail.join(' | '), 500);
  cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v);
  return { message_id: msgId, status: 'Contested', routed_to: 'Kiko' };
}

/** Answers a Question in a Claude API chat: one Claude call, the chat's last 6 answered messages as context. */
function cueInboxAskClaude_(msgId, chat, text) {
  const past = cueInboxRows_('Inbox Messages', CUE_INBOX_MSG_COLS_).filter(x => x.v[1] === chat.v[0] && x.v[6] === 'Replied').slice(-6)
    .map(x => 'Q: ' + x.v[5] + '\nA: ' + x.v[7]).join('\n\n');
  const call = cueClaude_({ step: 'Team inbox', system: cueInboxRoleSystem_(chat.v[8], chat.v[2]), memory: false, maxTokens: 2000, effort: 'low',
    user: (past ? 'Earlier in this chat:\n' + past + '\n\n' : '') + 'Message:\n' + text,
    schema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'], additionalProperties: false } });
  const res = cueAiAll_({ id: 'INBOX-' + msgId, metrics: { ai_calls: 0, calls: [] } }, [call])[0];
  const m = cueInboxFind_(msgId);
  if (!res.ok) { m.v[6] = 'Waiting'; cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v); return { message_id: msgId, status: 'Waiting', error: res.error }; }
  m.v[6] = 'Replied'; m.v[7] = res.data.reply; m.v[8] = new Date(cueNow_()).toISOString(); m.v[9] = 'Claude API';
  cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v);
  return { message_id: msgId, status: 'Replied', reply: res.data.reply };
}

/* Public entry point for Inbox.html. Owner check is inside. */
function cueInboxSetupRoles() { return cueInboxSetupRoles_(); }
