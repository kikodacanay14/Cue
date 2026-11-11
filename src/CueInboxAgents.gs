/* Team inbox for agents (Kiko 11 Nov 2026: "the goal is for things to run without me", then "now are you gonna do what i want?").
 * Cue's web app opens only for Kiko's Google account, so an outside agent cannot call it, and this file opens no new door.
 * Instead an agent (a Claude Code session with Kiko's Google Sheets connector) appends one row to the Cue sheet's
 * "Team Requests" tab:  Request ID | Chat (name or Chat ID) | Kind | Tool | Message | From   (leave Created, State, Message ID, Note blank)
 * Every 5 minutes cueResume (running as the script owner) sends each new row exactly as the Inbox page would: same checks,
 * same 3-minute pause per chat, same routing to the role chats. The row then gets State Sent and the Message ID; the agent reads
 * the reply or decision from that row of "Inbox Messages" (Status, Reply, Decision, Decided by, Reason). Nothing runs on a
 * decision. A row the inbox refuses gets State Refused and the reason in Note. At most 5 rows per run (each can make two AI calls). */

const CUE_INBOX_REQ_COLS_ = 12, CUE_INBOX_REQ_MAX_ = 5;

function cueInboxIntake_() {
  const now = new Date(cueNow_()).toISOString();
  // Claim one row at a time, under the lock, right before it is sent (Codex on Cue PR #375 and #376): the row is marked Sending
  // and written before any AI call, so an overlapping run cannot pick it, and a run that dies strands only the row in flight.
  // A row left at Sending is never sent again.
  const tried = {};   // rows this run already handled (a paused Question goes straight back to New, so it must not be retaken now)
  const claimNext = () => cueLocked_(() => {
    const r = cueInboxRows_('Team Requests', CUE_INBOX_REQ_COLS_).filter(x => !tried[x.row] && (!String(x.v[7] || '').trim() || x.v[7] === 'New'))[0];
    if (r) tried[r.row] = 1;
    if (r) { r.v[6] = r.v[6] || now; r.v[7] = 'Sending'; cueInboxSetRow_('Team Requests', r.row, CUE_INBOX_REQ_COLS_, r.v); }
    return r || null;
  });
  const chats = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_).filter(c => c.v[3] === 'Active');
  let sent = 0;
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
      cueInboxSetRow_('Team Requests', r.row, CUE_INBOX_REQ_COLS_, v); continue;
    }
    try {
      const out = cueInboxSendCore_(hits[0].v[0], String(v[2] || '').trim(), v[4], String(v[3] || '').trim(), 'agent: ' + cueStr_(String(v[5] || 'unnamed'), 80));
      v[7] = 'Sent'; v[8] = out.message_id; v[9] = cueStr_(out.status + (out.error ? ': ' + out.error : ''), 300);
      // The answer goes on the same row, so agents read only this spreadsheet.
      const m = cueInboxFind_(out.message_id).v;
      v[10] = cueStr_(m[7] || (m[10] ? m[10] + (m[14] ? ': ' + m[14] : '') : ''), 4000); v[11] = m[13] || (m[7] ? cueInboxChatLabel_(m[1]) : '');
      sent++;
    } catch (e) {
      const why = cueStr_((e && e.message) || e, 300);
      if (/can take another Question in/.test(why)) { v[7] = 'New'; v[9] = 'Waiting for the 3-minute pause; sends on a later run.'; }   // New at once (Codex on PR #376): a run that dies later never strands it
      else { v[7] = 'Refused'; v[9] = why; }
    }
    cueInboxSetRow_('Team Requests', r.row, CUE_INBOX_REQ_COLS_, v);
  }
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
  // The whole sync runs under the lock (Codex on Cue PR #376): two overlapping runs can never add the same item twice, and
  // the Inbox page's Approve and Reject (same lock) never interleave with an answer from the sheet.
  return cueLocked_(() => cueForKikoSyncLocked_());
}
/** Writes only the script-owned State and Note cells, so an answer Kiko is typing in the row is never overwritten. */
function cueForKikoMark_(row, state, note) { cueSheet_('For Kiko').getRange(row, 9, 1, 2).setValues([[state, cueStr_(note, 300)]]); }
function cueForKikoSyncLocked_() {
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
    cueSheet_(tab).appendRow([cueInboxId_('K'), v[0], chats[v[1]] || '', v[4], cueStr_(v[5], 45000), cueStr_(why, 500), v[2], '', 'Open', 'Type Approve or Reject in Your answer.', String(v[3] || '')]);
    have[v[0]] = 1;
  });
  // 2. Kiko's answers, and items settled elsewhere. The answer is read fresh from its cell right before it is used.
  cueInboxRows_(tab, CUE_FORKIKO_COLS_).forEach(x => {
    const v = x.v; if (v[8] !== 'Open') return;
    const m = v[1] ? cueInboxFind_(v[1]) : null;
    if (m && m.v[10]) return cueForKikoMark_(x.row, 'Done', m.v[10] + ' by ' + (m.v[13] || 'Kiko'));
    const cell = cueSheet_(tab).getRange(x.row, 8, 1, 1).getValues()[0][0];   // 0 is an answer (Codex on PR #376)
    const ans = String(cell === null || cell === undefined ? '' : cell).trim();
    if (!ans) return;
    if (!v[1]) return cueForKikoMark_(x.row, 'Answered', 'Answered ' + new Date(now).toISOString());
    // The whole answer must be the word (Codex on PR #376): "Approve? not yet" is not a decision; Reject and Rejected both are.
    const d = /^approve(d)?\.?$/i.test(ans) ? 'Approve' : /^reject(ed)?\.?$/i.test(ans) ? 'Reject' : '';
    if (!d) return cueForKikoMark_(x.row, 'Open', 'Type Approve or Reject in Your answer.');
    cueInboxRecord_(m, d, 'From the For Kiko tab', 'Kiko (For Kiko tab)');
    cueForKikoMark_(x.row, 'Done', (d === 'Approve' ? 'Approved' : 'Rejected') + ' ' + new Date(now).toISOString());
  });
}

/* Closed tab (Kiko 11 Nov 2026: "add another tab - automatically moves items that are Closed to that tab"). Every cueResume run
 * moves finished rows out of Team Requests (State Sent or Refused) and For Kiko (State Done or Answered) into Closed, so those
 * two tabs show only open work. A moved row keeps its ID, answer, note and Message ID. Runs under the lock, bottom row first.
 * Team Requests is left alone while a row is Sending (a run is writing it by row number); a Sending row older than 30 minutes
 * is stranded and no longer holds it. */
const CUE_CLOSED_STATES_ = { 'Team Requests': ['Sent', 'Refused'], 'For Kiko': ['Done', 'Answered'] };
function cueTeamClose_() { return cueLocked_(() => cueTeamCloseLocked_()); }
function cueTeamCloseLocked_() {
  const now = cueNow_(), at = new Date(now).toISOString(), out = [];
  const reqs = cueInboxRows_('Team Requests', CUE_INBOX_REQ_COLS_);
  const busy = reqs.some(x => x.v[7] === 'Sending' && now - new Date(x.v[6]).getTime() < 30 * 60 * 1000);
  const moves = [];
  if (!busy) reqs.filter(x => CUE_CLOSED_STATES_['Team Requests'].indexOf(x.v[7]) >= 0).forEach(x => {
    const v = x.v;
    // A Sent row closes only once its message is settled. A decision that came later (For Kiko, or a role chat after a retry)
    // is copied onto the row first (Codex on PR #376), so the answer is never lost.
    if (v[7] === 'Sent' && cueTeamBlank_(v[10])) {
      let f = null; try { f = v[8] ? cueInboxFind_(v[8]) : null; } catch (e) { f = null; }   // a message gone from the tab closes the row as it is
      const m = f && f.v;
      if (m && !(m[7] || m[10] || m[6] === 'Expired')) return;
      if (m) { v[10] = cueStr_(m[7] || (m[10] ? m[10] + (m[14] ? ': ' + m[14] : '') : m[6]), 4000); v[11] = m[13] || (m[7] ? cueInboxChatLabel_(m[1]) : ''); }
    }
    moves.push({ tab: 'Team Requests', row: x.row,
      vals: [at, 'Team Requests', v[0], v[1], v[2], v[4], (cueTeamBlank_(v[10]) ? '' : String(v[10])) + (v[11] ? ' (' + v[11] + ')' : ''), v[7], v[9], v[5], v[8]] });
  });
  cueInboxRows_('For Kiko', CUE_FORKIKO_COLS_).filter(x => CUE_CLOSED_STATES_['For Kiko'].indexOf(x.v[8]) >= 0).forEach(x => {
    const v = x.v; moves.push({ tab: 'For Kiko', row: x.row, vals: [at, 'For Kiko', v[0], v[2], v[3], v[4], v[7], v[8], v[9], v[10], v[1]] });
  });
  if (!moves.length) return { moved: 0 };
  moves.forEach(m => cueSheet_('Closed').appendRow(m.vals));   // copy first: a run that dies here leaves a duplicate, never a loss
  moves.slice().sort((a, b) => a.tab === b.tab ? b.row - a.row : 0).forEach(m => cueSheet_(m.tab).deleteRow(m.row));
  return { moved: moves.length };
}
function cueTeamBlank_(x) { return x === null || x === undefined || String(x).trim() === ''; }
