/* CUE-ROUTE-2026-10-21 (Kiko 17:00Z picked Teach Cue items 2 and 3; specs/teach-cue.md "Add-on").
 *   Learning from corrections: "Wrong command?" on a waiting task. Kiko picks the right command; Cue closes the wrong task, starts the
 *   right one from the same message, and asks once whether to remember it. Yes saves phrase and command to the hidden tab
 *   "Routing examples" (Saved | Phrase | Command). The chat call then gets the 5 closest examples (picked in code, no extra call).
 *   Asking when unsure: when the chat call is not sure, or two commands fit about equally, Cue starts nothing and shows the top 2 as
 *   buttons plus "Just chat". A button starts that command from the details the same chat call already filled.
 * An open question waits in Script Property CUE_ASK_<id>; its chat line carries "?<id>:<choices>" and the answer "!<id>". */

const CUE_ROUTE_TAB_ = 'Routing examples', CUE_ROUTE_HEAD_ = ['Saved', 'Phrase', 'Command'];
const CUE_ROUTE_CMDS_ = { intake: 'Project intake', readiness: 'Readiness check', pipeline: 'Pipeline review', ar: 'ARs', vendor: 'Supplier search',
  workflow: 'Workflow map', email: 'Email', money: 'Money question', chat: 'Just chat' };
const CUE_ROUTE_TALK_ = ['intake', 'readiness', 'pipeline', 'ar', 'vendor', 'workflow', 'email'];   // the commands the chat call fills in
const CUE_ROUTE_KIND_ = { intake: 'intake', change: 'intake', readiness: 'readiness', pipeline: 'pipeline', ar: 'ar', vendor: 'vendor', workflow: 'workflow', email: 'email', finance: 'money' };
const CUE_ROUTE_MAX_ = { examples: 5, phrase: 300, rows: 300 };

/* ---------- remembered examples ---------- */
function cueRouteRows_() {
  try {
    if (!cueProp_('CUE_SHEET_ID', '')) return [];
    const sh = SpreadsheetApp.openById(cueProp_('CUE_SHEET_ID', '')).getSheetByName(CUE_ROUTE_TAB_), n = sh ? sh.getLastRow() - 1 : 0;
    return n > 0 ? sh.getRange(Math.max(2, n + 2 - CUE_ROUTE_MAX_.rows), 1, Math.min(n, CUE_ROUTE_MAX_.rows), 3).getValues()
      .map(r => ({ phrase: String(r[1] || '').trim(), cmd: String(r[2] || '').trim() })).filter(x => x.phrase && CUE_ROUTE_CMDS_[x.cmd]) : [];
  } catch (e) { console.warn('Routing examples: ' + e); return []; }
}
/** The examples closest to Kiko's message, newest first on a tie, as lines for the chat call. Empty when none share a word. */
function cueRouteExamples_(t) {
  const want = cueTeachWords_(t), rows = cueRouteRows_();
  return rows.map((x, i) => ({ x, i, s: cueTeachWords_(x.phrase).filter(w => want.indexOf(w) >= 0).length })).filter(y => y.s > 0)
    .sort((a, b) => b.s - a.s || b.i - a.i).slice(0, CUE_ROUTE_MAX_.examples)
    .map(y => '"' + y.x.phrase.slice(0, 200) + '" means ' + (y.x.cmd === 'chat' ? 'just chat, start nothing' : CUE_ROUTE_CMDS_[y.x.cmd]));
}
/** A saved phrase that is Kiko's message word for word. */
function cueRouteExact_(t) {
  const key = cueName_(t); if (!key) return '';
  const hit = cueRouteRows_().filter(x => cueName_(x.phrase) === key).pop();
  return hit ? hit.cmd : '';
}
function cueRouteSave_(phrase, cmd) {
  const ss = SpreadsheetApp.openById(cueKey_('CUE_SHEET_ID'));
  let sh = ss.getSheetByName(CUE_ROUTE_TAB_);
  if (!sh) { sh = ss.insertSheet(CUE_ROUTE_TAB_); sh.appendRow(CUE_ROUTE_HEAD_); sh.setFrozenRows(1); if (sh.hideSheet) sh.hideSheet(); }   // out of Kiko's way
  sh.appendRow([new Date(cueNow_()), cueStr_(phrase, CUE_ROUTE_MAX_.phrase), cmd]);
}

/* ---------- questions with buttons ---------- */
/** A question with buttons. where = the thread it shows in ('' = main chat). Its chat line is "?<id>:<choices>[@<thread>]". */
function cueAskOpen_(o, question, choices, where) {
  const id = 'ask-' + cueNow_().toString(36) + Math.floor(Math.random() * 4096).toString(36);
  o.where = where || '';
  PropertiesService.getScriptProperties().setProperty('CUE_ASK_' + id, JSON.stringify(o));
  cueChat_('Cue', question, '?' + id + ':' + choices.join(',') + (where ? '@' + where : ''));
  return id;
}

/** The talk result for one command, from what the chat call filled in (cands), so a button needs no new AI call. */
function cueRouteTalk_(cmd, cand, found) {
  const t = { chat: true, reply: '', task: '', sweep: '', pipeline: null, suggest_intake: false, start_intake: '', readiness: '', start_ar: '', vendor: null, workflow: null, email: null, lookup: '' };
  if (!cand) return null;
  if (cmd === 'readiness') t.readiness = String(cand); else if (cmd === 'ar') t.start_ar = String(cand); else if (cmd === 'pipeline') t.pipeline = cand;
  else if (cmd === 'vendor') t.vendor = cand; else if (cmd === 'workflow') t.workflow = cand; else if (cmd === 'email') { t.email = cand; t.lookup = found || ''; }
  else return null;
  return t;
}

/** Starts cmd from Kiko's message. forced = a talk result already filled in; without one the chat call runs once, told which command. */
function cueRouteStart_(text, cmd, forced) {
  if (cmd === 'chat') return { chat: true };
  if (cmd === 'money') return cueFinance_(text, '');
  if (cmd === 'intake') return cueSendWith_(text, [], 'intake', '', null);
  const talk = forced || cueTalk_(text, '', cmd);
  if (!cueRouteFilled_(talk, cmd)) { cueChat_('Cue', 'I could not start a ' + CUE_ROUTE_CMDS_[cmd].toLowerCase() + ' from that message. Say what you need and I will.', ''); return { chat: true }; }
  return cueSendWith_(text, [], '', '', talk);
}
const cueRouteFilled_ = (t, cmd) => !!t && !!({ readiness: t.readiness, ar: t.start_ar, pipeline: t.pipeline, vendor: t.vendor, workflow: t.workflow, email: t.email })[cmd];

/** Kiko taps a button under a question. pick is a command, or yes / no for "remember?". */
function cueAskPick(id, pick) {
  cueOwner_();
  id = String(id || ''); pick = String(pick || '');
  if (!/^ask-[0-9a-z]{4,20}$/.test(id)) throw new Error('No such question.');
  const P = PropertiesService.getScriptProperties(), raw = cueLocked_(() => {
    const v = P.getProperty('CUE_ASK_' + id);
    if (v) P.setProperty('CUE_ASK_' + id, '');   // one answer per question
    return v;
  });
  if (!raw) throw new Error('That question was already answered.');
  const o = JSON.parse(raw), done = '!' + id + (o.where ? '@' + o.where : '');
  if (o.type === 'learned') {
    if (pick === 'undo') cueLocked_(() => { const sh = cueTeachTab_(); if (o.row >= 2 && cueName_(sh.getRange(o.row, 3).getValues()[0][0]) === cueName_(o.text)) sh.getRange(o.row, 1).setValues([[false]]); });
    cueTeachReset_();
    cueChat_('Kiko', pick === 'undo' ? 'Undo' : 'Keep', done);
    cueChat_('Cue', pick === 'undo' ? 'Undone. That rule is switched off.' : 'Kept. Change it any time under My rules in the Threads pane.', done);
    return { chat: true };
  }
  if (o.type === 'remember') {
    if (pick === 'yes') cueRouteSave_(o.phrase, o.cmd);
    cueChat_('Kiko', pick === 'yes' ? 'Yes, remember it' : 'No', done);
    cueChat_('Cue', pick === 'yes' ? 'Saved. Next time "' + o.phrase.slice(0, 80) + '" means ' + CUE_ROUTE_CMDS_[o.cmd] + '.' : 'OK, not saved.', done);
    return { chat: true };
  }
  if ((o.choices || []).indexOf(pick) < 0) throw new Error('That is not one of the choices.');
  cueChat_('Kiko', CUE_ROUTE_CMDS_[pick], done);
  if (pick === 'chat') { cueChat_('Cue', 'OK, just chatting. Nothing was started.', done); return { chat: true }; }
  return cueRouteStart_(o.text, pick, pick === 'intake' ? null : cueRouteTalk_(pick, (o.cands || {})[pick], o.found));
}

/* ---------- wrong command ---------- */
/** Whether "Wrong command?" shows on a task: it waits for Kiko, came from a message (no files), and nothing is saved in Canvas yet. */
function cueRouteCan_(s) {
  return !!CUE_ROUTE_KIND_[s.kind] && (s.status === 'Needs you' || s.status === 'Failed') && !(s.files || []).length
    && !(s.canvas && (s.canvas.project_id || s.canvas.submitted)) && !s.approved_at && String(s.text || '').trim().length >= 3;
}

/** Kiko says Cue picked the wrong command. The task is closed (nothing was written or sent), the right one starts from the same
 * message, and Cue asks once whether to remember it. */
function cueWrongCommand(id, cmd) {
  cueOwner_();
  cmd = String(cmd || '');
  if (!CUE_ROUTE_CMDS_[cmd]) throw new Error('Pick a command from the list.');
  let text = '';
  cueLocked_(() => {
    const L = cueLoad_(id);
    if (!L) throw new Error('No such request.');
    if (!cueRouteCan_(L.s)) throw new Error('This task can no longer be redone as another command.');
    if (CUE_ROUTE_KIND_[L.s.kind] === cmd) throw new Error('That is the command it already is.');
    text = String(L.s.said || L.s.text).trim();
    cueCloseAny_(L); L.s.wrong_command = cmd; cueSave_(L.sh, L.row, L.s);
  });
  cueChat_('Cue', 'Closed: this was the wrong command. Nothing was written or sent. Starting ' + CUE_ROUTE_CMDS_[cmd].toLowerCase() + ' instead.', id);
  const out = cueRouteStart_(text, cmd, null) || {};
  const phrase = text.slice(0, CUE_ROUTE_MAX_.phrase);
  out.ask = cueAskOpen_({ type: 'remember', phrase, cmd }, 'Remember that "' + (phrase.length > 120 ? phrase.slice(0, 120) + '…' : phrase) + '" means '
    + (cmd === 'chat' ? 'just chat' : CUE_ROUTE_CMDS_[cmd]) + '?', ['yes', 'no']);
  return out;
}
