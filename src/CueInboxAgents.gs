/* Team inbox for agents (Kiko 11 Nov 2026: "the goal is for things to run without me", then "now are you gonna do what i want?").
 * Cue's web app opens only for Kiko's Google account, so an outside agent cannot call it, and this file opens no new door.
 * Instead an agent (a Claude Code session with Kiko's Google Sheets connector) appends one row to the Cue sheet's
 * "Inbox Requests" tab:  Request ID | Chat (name or Chat ID) | Kind | Tool | Message | From   (leave Created, State, Message ID, Note blank)
 * Every 5 minutes cueResume (running as the script owner) sends each new row exactly as the Inbox page would: same checks,
 * same 3-minute pause per chat, same routing to the role chats. The row then gets State Sent and the Message ID; the agent reads
 * the reply or decision from that row of "Inbox Messages" (Status, Reply, Decision, Decided by, Reason). Nothing runs on a
 * decision. A row the inbox refuses gets State Refused and the reason in Note. At most 5 rows per run (each can make two AI calls). */

const CUE_INBOX_REQ_COLS_ = 10, CUE_INBOX_REQ_MAX_ = 5;

function cueInboxIntake_() {
  const now = new Date(cueNow_()).toISOString();
  // Claim one row at a time, under the lock, right before it is sent (Codex on Cue PR #375 and #376): the row is marked Sending
  // and written before any AI call, so an overlapping run cannot pick it, and a run that dies strands only the row in flight.
  // A row left at Sending is never sent again.
  const claimNext = () => cueLocked_(() => {
    const r = cueInboxRows_('Inbox Requests', CUE_INBOX_REQ_COLS_).filter(x => !String(x.v[7] || '').trim() || x.v[7] === 'New')[0];
    if (r) { r.v[6] = r.v[6] || now; r.v[7] = 'Sending'; cueInboxSetRow_('Inbox Requests', r.row, CUE_INBOX_REQ_COLS_, r.v); }
    return r || null;
  });
  const chats = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(c => c.v[3] === 'Active');
  let sent = 0, waits = [];
  for (let i = 0; i < CUE_INBOX_REQ_MAX_; i++) {
    const r = claimNext(); if (!r) break;
    const v = r.v, want = String(v[1] || '').trim();
    // A Chat ID matches exactly; otherwise the name, ignoring case. Two chats with the same name are refused, never guessed.
    let hits = chats.filter(c => c.v[0] === want);
    if (!hits.length) hits = chats.filter(c => String(c.v[2]).trim().toLowerCase() === want.toLowerCase());
    if (hits.length !== 1) {
      v[7] = 'Refused';
      v[9] = hits.length ? 'More than one inbox chat is named "' + want + '". Use its Chat ID (' + hits.map(c => c.v[0]).join(', ') + ').'
        : 'No active inbox chat named "' + want + '".';
      cueInboxSetRow_('Inbox Requests', r.row, CUE_INBOX_REQ_COLS_, v); continue;
    }
    try {
      const out = cueInboxSendCore_(hits[0].v[0], String(v[2] || '').trim(), v[4], String(v[3] || '').trim(), 'agent: ' + cueStr_(String(v[5] || 'unnamed'), 80));
      v[7] = 'Sent'; v[8] = out.message_id; v[9] = cueStr_(out.status + (out.decision ? ' ' + out.decision : '') + (out.error ? ': ' + out.error : ''), 300);
      sent++;
    } catch (e) {
      const why = cueStr_((e && e.message) || e, 300);
      if (/can take another Question in/.test(why)) { v[7] = 'Paused'; v[9] = 'Waiting for the 3-minute pause; sends on a later run.'; waits.push(r); }
      else { v[7] = 'Refused'; v[9] = why; }
    }
    cueInboxSetRow_('Inbox Requests', r.row, CUE_INBOX_REQ_COLS_, v);
  }
  // Rows held by the pause go back to New only now, so this run does not claim them again.
  waits.forEach(r => { r.v[7] = 'New'; cueInboxSetRow_('Inbox Requests', r.row, CUE_INBOX_REQ_COLS_, r.v); });
  return { sent };
}

/* For Kiko (Kiko 11 Nov 2026: "why cant they just also send a message for me in the google sheet? add another tab and those are
 * all the things that require Kiko"). One tab in the Cue sheet holds everything that needs him:
 *   - Cue adds a row for each Confirm or Request access the role chats did not settle (Contested, Waiting after a failed call,
 *     or any tool other than Google Drive), at most once per message, once the message is a minute old.
 *   - An agent may append its own row (leave Message ID blank) for anything only Kiko can answer; it reads Your answer back.
 * Kiko types in Your answer. For a row with a Message ID: "Approve" or "Reject" (any case) is recorded as his decision, the same
 * as the Inbox page, and the row turns Done; any other text gets a Note asking for Approve or Reject. A row whose message was
 * decided elsewhere turns Done. A row without a Message ID turns Answered when he writes anything. Runs from cueResume. */
const CUE_FORKIKO_COLS_ = 11;
function cueForKikoSync_() {
  const tab = 'For Kiko', now = cueNow_();
  const items = cueInboxRows_(tab, CUE_FORKIKO_COLS_);
  const msgs = cueInboxRows_('Inbox Messages', CUE_INBOX_MSG_COLS_), byId = {};
  msgs.forEach(m => { byId[m.v[0]] = m; });
  const chats = {}; cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).forEach(c => { chats[c.v[0]] = c.v[2]; });
  const have = {}; items.forEach(x => { if (x.v[1]) have[x.v[1]] = 1; });
  // 1. New items: undecided Confirm or Request access that are waiting for Kiko.
  msgs.forEach(m => {
    const v = m.v, kindOk = CUE_INBOX_DECIDED_KINDS_.indexOf(v[4]) >= 0, open = !v[10] && ['New', 'Contested', 'Waiting'].indexOf(v[6]) >= 0;
    if (!kindOk || !open || have[v[0]] || now - new Date(v[2]).getTime() < 60 * 1000) return;
    const why = v[6] === 'Contested' ? 'The Tech Lead and Account Manager could not decide: ' + String(v[14] || '')
      : v[6] === 'Waiting' ? 'A role chat did not answer: ' + String(v[14] || '')
      : v[4] === 'Request access' ? 'Access to ' + (v[12] || 'a tool') + ' needs your yes (only Google Drive goes to the Tech Lead).'
      : 'No role chat decided it.';
    cueSheet_(tab).appendRow([cueInboxId_('K'), v[0], chats[v[1]] || '', v[4], cueStr_(v[5], 2000), cueStr_(why, 500), v[2], '', 'Open', 'Type Approve or Reject in Your answer.', String(v[3] || '')]);
    have[v[0]] = 1;
  });
  // 2. Kiko's answers, and items settled elsewhere.
  cueInboxRows_(tab, CUE_FORKIKO_COLS_).forEach(x => {
    const v = x.v; if (v[8] !== 'Open') return;
    const ans = String(v[7] || '').trim(), m = v[1] ? byId[v[1]] : null;
    if (m && m.v[10]) { v[8] = 'Done'; v[9] = m.v[10] + ' by ' + (m.v[13] || 'Kiko'); cueInboxSetRow_(tab, x.row, CUE_FORKIKO_COLS_, v); return; }
    if (!ans) return;
    if (!v[1]) { v[8] = 'Answered'; v[9] = 'Answered ' + new Date(now).toISOString(); cueInboxSetRow_(tab, x.row, CUE_FORKIKO_COLS_, v); return; }
    if (!m) { v[8] = 'Done'; v[9] = 'Message not found.'; cueInboxSetRow_(tab, x.row, CUE_FORKIKO_COLS_, v); return; }
    const d = /^approve/i.test(ans) ? 'Approve' : /^reject/i.test(ans) ? 'Reject' : '';
    if (!d) { v[9] = 'Type Approve or Reject in Your answer.'; cueInboxSetRow_(tab, x.row, CUE_FORKIKO_COLS_, v); return; }
    cueInboxRecord_(m, d, 'From the For Kiko tab', 'Kiko (For Kiko tab)');
    v[8] = 'Done'; v[9] = (d === 'Approve' ? 'Approved' : 'Rejected') + ' ' + new Date(now).toISOString();
    cueInboxSetRow_(tab, x.row, CUE_FORKIKO_COLS_, v);
  });
}
