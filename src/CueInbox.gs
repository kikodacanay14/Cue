/* Team inbox (team-inbox, spec in CanvasWorkspace docs/specs/team-inbox*.md, design approved 11 Nov 2026 Manila).
 * One inbox lists every chat Kiko's team talks to. A Question to a ChatGPT API chat is sent to the OpenAI Responses API and
 * the answer is stored as the reply. A Question to a claude.ai chat is saved and waits (the claude.ai pull endpoint is HELD:
 * no route here reads or writes messages from outside Cue). A Confirm message is only recorded as a decision; nothing runs
 * (scope Q3 B). No Canvas bridge call and no Canvas write happens in this file. Every server function is owner only.
 * Tabs: Inbox Chats, Inbox Messages, Inbox Decisions (CUE_TABS_ in Cue.gs). */

const CUE_INBOX_BODY_MAX_ = 4000;          // design 3.2: longer text is refused, never cut
const CUE_INBOX_EXPIRE_MS_ = 7 * 24 * 60 * 60 * 1000;   // design 3.2: unanswered after 7 days becomes Expired
const CUE_INBOX_PROVIDERS_ = ['ChatGPT API', 'claude.ai'];
const CUE_INBOX_KINDS_ = ['Question', 'Confirm'];
const CUE_INBOX_MSG_COLS_ = 12, CUE_INBOX_CHAT_COLS_ = 7, CUE_INBOX_DEC_COLS_ = 5, CUE_INBOX_QUEUE_COLS_ = 3;
const CUE_INBOX_COUNTDOWN_MS_ = 2 * 60 * 1000;   // D2 (Kiko 11 Nov 2026): a Question sends 2 minutes after its fields are filled; Cancel stops it


/** Reads a tab as objects: { row (1-based sheet row), v (values) }. Header row skipped. */
function cueInboxRows_(tab, cols) {
  const sh = cueSheet_(tab), n = sh.getLastRow();
  if (n < 2) return [];
  const vals = sh.getRange(2, 1, n - 1, cols).getValues();
  return vals.map((v, i) => ({ row: i + 2, v })).filter(x => String(x.v[0] || '') !== '');
}
function cueInboxId_(prefix) { return prefix + '-' + Math.floor(cueNow_() / 1000).toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36); }
function cueInboxSetRow_(tab, row, cols, vals) { cueSheet_(tab).getRange(row, 1, 1, cols).setValues([vals]); }

/** The inbox page's list: chats and the newest 200 messages per chat. Marks old open messages Expired (design 3.2). */
function cueInboxList_() {
  cueOwner_();
  const chats = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).map(x => ({ chat_id: x.v[0], provider: x.v[1], label: x.v[2], status: x.v[3], created_at: x.v[6] }));
  const msgs = cueInboxRows_('Inbox Messages', CUE_INBOX_MSG_COLS_);
  const now = cueNow_();
  msgs.forEach(m => {
    const open = m.v[6] === 'New' || m.v[6] === 'Waiting';
    const made = new Date(m.v[2]).getTime();
    if (open && made && now - made > CUE_INBOX_EXPIRE_MS_) { m.v[6] = 'Expired'; cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v); }
  });
  const per = {}, out = [];
  msgs.slice().reverse().forEach(m => {   // newest first
    per[m.v[1]] = (per[m.v[1]] || 0) + 1;
    if (per[m.v[1]] <= 200) out.push(cueInboxMsgObj_(m.v));
  });
  return { chats, messages: out, now: new Date(now).toISOString() };
}
function cueInboxMsgObj_(v) {
  return { message_id: v[0], chat_id: v[1], created_at: v[2], from: v[3], kind: v[4], body: v[5], status: v[6], reply: v[7], replied_at: v[8], reply_source: v[9], decision: v[10], decided_at: v[11] };
}

/** Adds a chat to the registry (add-chat form). provider: 'ChatGPT API' or 'claude.ai'. The claude.ai read token is HELD (design 6). */
function cueInboxAddChat_(form) {
  cueOwner_();
  const provider = String((form || {}).provider || ''), label = String((form || {}).label || '').trim();
  if (CUE_INBOX_PROVIDERS_.indexOf(provider) < 0) throw new Error('Pick ChatGPT API or claude.ai.');
  if (!label || label.length > 80) throw new Error('Give the chat a name of 1 to 80 characters.');
  const id = cueInboxId_('CH');
  cueSheet_('Inbox Chats').appendRow([id, provider, label, 'Active', '', '', new Date(cueNow_()).toISOString()]);
  return { chat_id: id };
}

/** Sends one message to a chat. Question to ChatGPT API: one OpenAI call, the answer becomes the reply. Other kinds wait. */
function cueInboxSend_(chatId, kind, body) {
  cueOwner_();
  const text = String(body || '').trim();
  if (CUE_INBOX_KINDS_.indexOf(kind) < 0) throw new Error('Kind must be Question or Confirm.');
  if (!text) throw new Error('Write a message first.');
  if (text.length > CUE_INBOX_BODY_MAX_) throw new Error('Message is over ' + CUE_INBOX_BODY_MAX_ + ' characters. Shorten it and send again.');
  const chat = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(x => x.v[0] === chatId)[0];
  if (!chat) throw new Error('That chat is not in the inbox.');
  if (chat.v[3] !== 'Active') throw new Error('That chat is retired. Pick another chat.');
  const msgId = cueInboxId_('M'), now = new Date(cueNow_()).toISOString();
  const row = [msgId, chatId, now, String(Session.getActiveUser().getEmail() || ''), kind, text, 'New', '', '', '', '', ''];
  cueSheet_('Inbox Messages').appendRow(row);
  if (kind === 'Confirm') return { message_id: msgId, status: 'New' };   // design 4.3: recorded on Approve or Reject, nothing runs
  if (chat.v[1] !== 'ChatGPT API') return { message_id: msgId, status: 'New' };   // design 4.2: claude.ai pull is held
  const r = cueInboxAsk_(msgId, chat.v[4], text);
  return r;
}

/** One OpenAI Responses call (design 4.1). previous_response_id keeps the chat's thread. Failure leaves the message Waiting. */
function cueInboxAsk_(msgId, prevId, text) {
  const model = cueProp_('OPENAI_MODEL', 'gpt-5-mini');
  const body = { model, instructions: 'You answer one message from Kiko\'s team inbox. Reply in plain English, short, with no preamble.',
    input: text, store: true, max_output_tokens: 2000,
    text: { format: { type: 'json_schema', name: 'inbox_reply', strict: true, schema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'], additionalProperties: false } } } };
  if (prevId) body.previous_response_id = prevId;
  const call = { step: 'Team inbox', provider: 'GPT', model, parse: cueInboxParse_,
    req: { url: CUE_OPENAI_URL_, method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + cueKey_('OPENAI_API_KEY') } } };
  const s = { id: 'INBOX-' + msgId, metrics: { ai_calls: 0, calls: [] } };
  const res = cueAiAll_(s, [call])[0];
  const found = cueInboxFind_(msgId);
  if (!res.ok) {
    found.v[6] = 'Waiting'; cueInboxSetRow_('Inbox Messages', found.row, CUE_INBOX_MSG_COLS_, found.v);
    return { message_id: msgId, status: 'Waiting', error: res.error };
  }
  found.v[6] = 'Replied'; found.v[7] = res.data.reply; found.v[8] = new Date(cueNow_()).toISOString(); found.v[9] = 'OpenAI API';
  cueInboxSetRow_('Inbox Messages', found.row, CUE_INBOX_MSG_COLS_, found.v);
  if (res.data.id) cueInboxSetChatResponse_(found.v[1], res.data.id);
  return { message_id: msgId, status: 'Replied', reply: res.data.reply };
}
function cueInboxParse_(code, msg) {
  const d = cueGptParse_(code, msg);
  if (!d.data || typeof d.data.reply !== 'string') throw new Error('GPT answer had no reply');
  return { data: { reply: d.data.reply, id: msg && msg.id ? String(msg.id) : '' }, model: d.model, input: d.input, output: d.output, web: 0 };
}
function cueInboxFind_(msgId) {
  const f = cueInboxRows_('Inbox Messages', CUE_INBOX_MSG_COLS_).filter(x => x.v[0] === msgId)[0];
  if (!f) throw new Error('Message not found: ' + msgId);
  return f;
}
function cueInboxSetChatResponse_(chatId, respId) {
  const c = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(x => x.v[0] === chatId)[0];
  if (!c) return;
  c.v[4] = respId; cueInboxSetRow_('Inbox Chats', c.row, CUE_INBOX_CHAT_COLS_, c.v);
}

/** Approve or Reject a Confirm message. Records only (scope Q3 B): nothing runs. */
function cueInboxDecide_(msgId, decision, note) {
  cueOwner_();
  if (['Approve', 'Reject'].indexOf(decision) < 0) throw new Error('Decision must be Approve or Reject.');
  const m = cueInboxFind_(msgId);
  if (m.v[4] !== 'Confirm') throw new Error('Only Confirm messages take a decision.');
  const now = new Date(cueNow_()).toISOString();
  m.v[6] = 'Recorded'; m.v[10] = decision === 'Approve' ? 'Approved' : 'Rejected'; m.v[11] = now;
  cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v);
  cueSheet_('Inbox Decisions').appendRow([cueInboxId_('D'), msgId, m.v[10], now, String(note || '').slice(0, 300)]);
  return { message_id: msgId, decision: m.v[10] };
}

/** Retire a chat: keeps its messages, stops new sends. */
function cueInboxRetire_(chatId) {
  cueOwner_();
  const c = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(x => x.v[0] === chatId)[0];
  if (!c) throw new Error('That chat is not in the inbox.');
  c.v[3] = 'Retired'; cueInboxSetRow_('Inbox Chats', c.row, CUE_INBOX_CHAT_COLS_, c.v);
  return { chat_id: chatId, status: 'Retired' };
}

/** D1/D2: a Question is queued with a 2-minute countdown. The sweep sends it when the countdown ends. Cancel stops it. */
function cueInboxQueue_(chatId, body) {
  cueOwner_();
  const text = String(body || '').trim();
  if (!text) throw new Error('Write a message first.');
  if (text.length > CUE_INBOX_BODY_MAX_) throw new Error('Message is over ' + CUE_INBOX_BODY_MAX_ + ' characters. Shorten it and send again.');
  const chat = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(x => x.v[0] === chatId)[0];
  if (!chat) throw new Error('That chat is not in the inbox.');
  if (chat.v[3] !== 'Active') throw new Error('That chat is retired. Pick another chat.');
  const msgId = cueInboxId_('M'), now = cueNow_();
  const sendAt = new Date(now + CUE_INBOX_COUNTDOWN_MS_).toISOString();
  cueSheet_('Inbox Messages').appendRow([msgId, chatId, new Date(now).toISOString(), String(Session.getActiveUser().getEmail() || ''), 'Question', text, 'Queued', '', '', '', '', '']);
  cueSheet_('Inbox Queue').appendRow([msgId, sendAt, 'Queued']);
  return { message_id: msgId, send_at: sendAt, status: 'Queued' };
}

/** Cancel a queued Question before its countdown ends. */
function cueInboxCancel_(msgId) {
  cueOwner_();
  const q = cueInboxRows_('Inbox Queue', CUE_INBOX_QUEUE_COLS_).filter(x => x.v[0] === msgId)[0];
  if (!q || q.v[2] !== 'Queued') throw new Error('That message is already sent or was cancelled.');
  q.v[2] = 'Cancelled'; cueInboxSetRow_('Inbox Queue', q.row, CUE_INBOX_QUEUE_COLS_, q.v);
  const m = cueInboxFind_(msgId); m.v[6] = 'Cancelled'; cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v);
  return { message_id: msgId, status: 'Cancelled' };
}

/** Time trigger (every minute, installed by cueTriggers_). Sends every Question whose countdown has ended. Owner-only by
 * construction: no public entry point calls it, and it runs as the script owner. */
function cueInboxSweep_() {
  const now = cueNow_();
  cueInboxRows_('Inbox Queue', CUE_INBOX_QUEUE_COLS_).filter(x => x.v[2] === 'Queued' && new Date(x.v[1]).getTime() <= now).forEach(q => {
    q.v[2] = 'Sent'; cueInboxSetRow_('Inbox Queue', q.row, CUE_INBOX_QUEUE_COLS_, q.v);   // mark first: a second sweep never sends twice
    const m = cueInboxFind_(q.v[0]);
    m.v[6] = 'New'; cueInboxSetRow_('Inbox Messages', m.row, CUE_INBOX_MSG_COLS_, m.v);
    const chat = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(x => x.v[0] === m.v[1])[0];
    if (chat && chat.v[1] === 'ChatGPT API') cueInboxAsk_(m.v[0], chat.v[4], m.v[5]);   // claude.ai stays New (pull held)
  });
}

/* Public entry points for Inbox.html (google.script.run). Each one only passes on to the owner-checked function above. */
function cueInboxList() { return cueInboxList_(); }
function cueInboxAddChat(form) { return cueInboxAddChat_(form); }
function cueInboxSend(chatId, kind, body) { return cueInboxSend_(chatId, kind, body); }
function cueInboxDecide(msgId, decision, note) { return cueInboxDecide_(msgId, decision, note); }
function cueInboxRetire(chatId) { return cueInboxRetire_(chatId); }
function cueInboxQueue(chatId, body) { return cueInboxQueue_(chatId, body); }
function cueInboxCancel(msgId) { return cueInboxCancel_(msgId); }
/* Trigger entry point (cueTriggers_ installs it every minute). Owner check still applies. */
function cueInboxSweep() { cueOwner_(); cueInboxSweep_(); }
