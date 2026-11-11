/* Team inbox for agents (Kiko 11 Nov 2026: "the goal is for things to run without me", then "now are you gonna do what i want?").
 * Cue's web app opens only for Kiko's Google account, so an outside agent cannot call it, and this file opens no new door.
 * Instead an agent (a Claude Code session with Kiko's Google Sheets connector) appends one row to the Cue sheet's
 * "Inbox Requests" tab:  Request ID | Chat | Kind | Tool | Message | From   (leave Created, State, Message ID, Note blank)
 * Every 5 minutes cueResume (running as the script owner) sends each new row exactly as the Inbox page would: same checks,
 * same 3-minute pause per chat, same routing to the role chats. The row then gets State Sent and the Message ID; the agent reads
 * the reply or decision from that row of "Inbox Messages" (Status, Reply, Decision, Decided by, Reason). Nothing runs on a
 * decision. A row the inbox refuses gets State Refused and the reason in Note. At most 5 rows per run (each can make two AI calls). */

const CUE_INBOX_REQ_COLS_ = 10, CUE_INBOX_REQ_MAX_ = 5;

function cueInboxIntake_() {
  const rows = cueInboxRows_('Inbox Requests', CUE_INBOX_REQ_COLS_).filter(r => !String(r.v[7] || '').trim() || r.v[7] === 'New');
  if (!rows.length) return { sent: 0 };
  const chats = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_);
  let sent = 0;
  rows.slice(0, CUE_INBOX_REQ_MAX_).forEach(r => {
    const v = r.v, label = String(v[1] || '').trim().toLowerCase();
    const chat = chats.filter(c => String(c.v[2]).trim().toLowerCase() === label && c.v[3] === 'Active')[0];
    v[6] = v[6] || new Date(cueNow_()).toISOString();
    if (!chat) { v[7] = 'Refused'; v[9] = 'No active inbox chat named "' + String(v[1] || '') + '".'; cueInboxSetRow_('Inbox Requests', r.row, CUE_INBOX_REQ_COLS_, v); return; }
    try {
      const out = cueInboxSendCore_(chat.v[0], String(v[2] || '').trim(), v[4], String(v[3] || '').trim(), 'agent: ' + cueStr_(String(v[5] || 'unnamed'), 80));
      v[7] = 'Sent'; v[8] = out.message_id; v[9] = cueStr_(out.status + (out.decision ? ' ' + out.decision : '') + (out.error ? ': ' + out.error : ''), 300);
      sent++;
    } catch (e) {
      const why = cueStr_((e && e.message) || e, 300);
      if (/can take another Question in/.test(why)) { v[7] = 'New'; v[9] = 'Waiting for the 3-minute pause; sends on a later run.'; }
      else { v[7] = 'Refused'; v[9] = why; }
    }
    cueInboxSetRow_('Inbox Requests', r.row, CUE_INBOX_REQ_COLS_, v);
  });
  return { sent };
}
