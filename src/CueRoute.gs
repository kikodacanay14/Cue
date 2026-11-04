/* CUE-ROUTE-2026-10-21 (Kiko 17:00Z picked Teach Cue items 2 and 3; specs/teach-cue.md "Add-on").
 *   Learning from corrections: "Wrong command?" on a waiting task. Kiko picks the right command; Cue closes the wrong task, starts the
 *   right one from the same message, and asks once whether to remember it. Yes saves phrase and command to the hidden tab
 *   "Routing examples" (Saved | Phrase | Command). The chat call then gets the 5 closest examples (picked in code, no extra call).
 *   Asking when unsure: when the chat call is not sure, or two commands fit about equally, Cue starts nothing and shows the top 2 as
 *   buttons plus "Just chat". A button starts that command from the details the same chat call already filled.
 * An open question waits in Script Property CUE_ASK_<id>; its chat line carries "?<id>:<choices>" and the answer "!<id>".
 * Answering deletes the property. cueAskTidy_ removes blank ones left by Cue before 1.26.6 and questions unanswered for 30 days. */

const CUE_ROUTE_TAB_ = 'Routing examples', CUE_ROUTE_HEAD_ = ['Saved', 'Phrase', 'Command'];
const CUE_ROUTE_CMDS_ = { intake: 'Project intake', readiness: 'Readiness check', ar: 'ARs', vendor: 'Supplier search',
  workflow: 'Workflow map', email: 'Email', money: 'Money question', chat: 'Just chat' };
const CUE_ROUTE_TALK_ = ['intake', 'readiness', 'ar', 'vendor', 'workflow', 'email'];   // the commands the chat call fills in
// The command each task kind is (STRUCTURE-PHASE-2 item 2.2): the cmd field of its line in cueCommands_ (CueCommands.gs), not a second list here.
const CUE_ROUTE_MAX_ = { examples: 5, phrase: 300, rows: 300 };

/* ---------- short, vague messages (PC test 17:30Z) ---------- */
// No verb, question or command word: "LED wall", "LED wall for AMI Group". Could be a client's ask (intake) or a supplier search.
const CUE_ROUTE_CLEAR_RE_ = /\?|\b(find|search|look|source|sourcing|compare|quote|quotation|rfq|rfqs|supplier|suppliers|vendor|vendors|intake|inquiry|email|reply|send|draft|ready|readiness|pipeline|ar|ars|receipt|receipts|map|workflow|remember|cost|costing|price|prices|how|what|why|when|who|where|is|are|can|could|would|please|pls|start|run|redo|check|show|status|update|hi|hello|thanks|thank|ok|okay|yes|no|good|morning|night|add|remind|todo|to-do|ticktick|task|tasks|my|me|i|connect|learn)\b/i;
function cueRouteVague_(t) {
  const s = String(t || '').trim(), words = s.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 6 && /\p{L}/u.test(s) && !CUE_ROUTE_CLEAR_RE_.test(s);
}

/* ---------- remembered examples ---------- */
/** PC check 22 Oct 04:45Z: learned patterns read "Project intake: update CE cost..." and "Project intake: redo bid check". Those asks
 * now have their own code routes (CE costs, bid check), so an old intake row or example for them is ignored and not shown. */
function cueRouteStale_(cmd, text) { return cmd === 'intake' && (cueCecAsked_(text) || cueBidsAsked_(text)); }
function cueRouteRows_() {
  try {
    if (!cueProp_('CUE_SHEET_ID', '')) return [];
    const sh = SpreadsheetApp.openById(cueProp_('CUE_SHEET_ID', '')).getSheetByName(CUE_ROUTE_TAB_), n = sh ? sh.getLastRow() - 1 : 0;
    return n > 0 ? sh.getRange(Math.max(2, n + 2 - CUE_ROUTE_MAX_.rows), 1, Math.min(n, CUE_ROUTE_MAX_.rows), 3).getValues()
      .map(r => ({ phrase: String(r[1] || '').trim(), cmd: String(r[2] || '').trim() })).filter(x => x.phrase && CUE_ROUTE_CMDS_[x.cmd] && !cueRouteStale_(x.cmd, x.phrase)) : [];
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
  try { cueAskTidy_(); } catch (e) { console.warn('cueAskTidy_: ' + e); }
  PropertiesService.getScriptProperties().setProperty('CUE_ASK_' + id, JSON.stringify(o));
  cueChat_('Cue', question, '?' + id + ':' + choices.join(',') + (where ? '@' + where : ''));
  return id;
}

/** Removes CUE_ASK_ properties that are blank (answered before 1.26.6) or whose question is over 30 days old. Script Properties cap at 500 KB.
 *  The id's first 8 characters are the time it was asked, in base 36. Returns how many it removed. */
const CUE_ASK_KEEP_MS_ = 30 * 86400000;
function cueAskTidy_() {
  const P = PropertiesService.getScriptProperties(), all = P.getProperties(), now = cueNow_();
  const old = Object.keys(all).filter(k => {
    if (k.indexOf('CUE_ASK_') !== 0) return false;
    if (!String(all[k] || '').trim()) return true;
    const m = /^CUE_ASK_ask-([0-9a-z]{8})/.exec(k), at = m ? parseInt(m[1], 36) : 0;
    return at > 0 && now - at > CUE_ASK_KEEP_MS_;
  });
  old.forEach(k => P.deleteProperty(k));
  return old.length;
}

/** The talk result for one command, from what the chat call filled in (cands), so a button needs no new AI call. */
function cueRouteTalk_(cmd, cand, found) {
  const t = { chat: true, reply: '', task: '', sweep: '', suggest_intake: false, start_intake: '', readiness: '', start_ar: '', vendor: null, workflow: null, email: null, lookup: '' };
  if (!cand) return null;
  if (cmd === 'readiness') t.readiness = String(cand); else if (cmd === 'ar') t.start_ar = String(cand);
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
const cueRouteFilled_ = (t, cmd) => !!t && !!({ readiness: t.readiness, ar: t.start_ar, vendor: t.vendor, workflow: t.workflow, email: t.email })[cmd];

/** Kiko taps a button under a question. pick is a command, or yes / no for "remember?". note = what Kiko typed for Change on a plan card. */
function cueAskPick(id, pick, note) {
  cueOwner_();
  id = String(id || ''); pick = String(pick || '');
  if (!/^ask-[0-9a-z]{4,20}$/.test(id)) throw new Error('No such question.');
  const P = PropertiesService.getScriptProperties(), raw = cueLocked_(() => {
    const v = P.getProperty('CUE_ASK_' + id);
    if (v) P.deleteProperty('CUE_ASK_' + id);   // one answer per question; a blank value would stay in Script Properties for good
    return v;
  });
  if (!raw) throw new Error('That question was already answered, or is over 30 days old.');
  const o = JSON.parse(raw), done = '!' + id + (o.where ? '@' + o.where : '');
  const bad = o.type === 'schedule' ? ['save', 'not'].indexOf(pick) < 0 : o.type === 'invline' || o.type === 'canvasedit' || o.type === 'allowset' || o.type === 'contactfill' ? ['approve', 'not'].indexOf(pick) < 0 : o.type === 'contactnew' ? ['approve', 'skippage'].indexOf(pick) < 0 : o.type === 'unsched' ? ['ok', 'mute'].indexOf(pick) < 0 : o.type === 'mailreply' ? ['usereply', 'skip'].indexOf(pick) < 0 : o.type === 'plan' ? ['go', 'change', 'not'].indexOf(pick) < 0 || (pick === 'change' && !String(note || '').trim()) : o.type === 'demote' ? pick !== 'again' : o.type === 'route' && (o.choices || []).indexOf(pick) < 0;
  if (bad) { P.setProperty('CUE_ASK_' + id, raw); throw new Error(pick === 'change' ? 'Say what I should do instead.' : 'That is not one of the choices.'); }   // the question stays open
  if (o.type === 'plan' || o.type === 'demote') return cueTutorPick_(o, pick, note, done);
  if (o.type === 'schedule') return cueSchedPick_(o, pick, done);
  if (o.type === 'invline') return cueInvPick_(o, pick, done);   // invoice line edit (CueLookup.gs)
  if (o.type === 'canvasedit') return cueEditPick_(o, pick, done);   // generic Canvas edit (CueEdit.gs)
  if (o.type === 'allowset') return cueAllowPick_(o, pick, done);   // one allow-list row (CueEdit.gs)
  if (o.type === 'contactfill') return cueCsPick_(o, pick, done);   // old-email contact fill (CueContactScan.gs)
  if (o.type === 'contactnew') return cueCnPick_(o, pick, done, note);   // new contacts from Kiko's Gmail (CueContactNew.gs)
  if (o.type === 'unsched') return cueUnschedPick_(o, pick, done);
  if (o.type === 'mailreply') return cueMcPick_(o, pick, done);   // a proposed email reply (CueMailChat.gs, CUE-ASSISTANT-2026-11-03)   // the unscheduled alarm (CueSchedule.gs)   // task scheduler (CueSchedule.gs)   // tutor mode (CueTutor.gs)
  if (o.type === 'learned') {
    if (pick === 'undo') cueLocked_(() => { const sh = cueTeachTab_(); if (o.row >= 2 && cueName_(sh.getRange(o.row, 3).getValues()[0][0]) === cueName_(o.text)) sh.getRange(o.row, 1).setValues([[false]]); });
    cueTeachReset_();
    cueChat_('Kiko', pick === 'undo' ? 'Undo' : 'Keep', done);
    cueChat_('Cue', pick === 'undo' ? 'Undone. That rule is switched off.' : 'Kept. Change it any time under My rules in the Threads pane.', done);
    return { chat: true };
  }
  if (o.type === 'ticktick') {   // Kiko 17:26Z: Add = approve; nothing is created before it
    cueChat_('Kiko', pick === 'add' ? 'Add to TickTick' : 'Skip', done);
    if (pick !== 'add') { cueChat_('Cue', 'OK, not added.', done); return { chat: true }; }
    if (!cueTtOn_()) { cueTtKeep_(o); cueChat_('Cue', 'Kept: "' + o.title + '". TickTick is not connected yet. Type "connect ticktick" and sign in, and I will add it then.', done); return { chat: true }; }
    try { cueTtAdd_(o); cueChat_('Cue', 'Added to TickTick: "' + o.title + '"' + (o.due ? ', due ' + o.due : '') + '.', done); }
    catch (e) { cueChat_('Cue', 'TickTick did not take it: ' + e.message, done); }
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
  if (o.learn) { try { cueRouteSave_(o.text, pick); } catch (e) { console.warn('Routing example: ' + e); } }   // tutor mode: Not that / a split teaches the code
  if (pick === 'chat') { cueChat_('Cue', 'OK, just chatting. Nothing was started.', done); return { chat: true }; }
  return cueRouteStart_(o.text, pick, pick === 'intake' ? null : cueRouteTalk_(pick, (o.cands || {})[pick], o.found));
}

/* ---------- wrong command ---------- */
/** Whether "Wrong command?" shows on a task: it waits for Kiko, came from a message (no files), and nothing is saved in Canvas yet. */
function cueRouteCan_(s) {
  return !!cueCommand_(s.kind).cmd && (s.status === 'Needs you' || s.status === 'Failed') && !(s.files || []).length
    && !(s.canvas && (s.canvas.project_id || s.canvas.submitted)) && !s.approved_at && String(s.text || '').trim().length >= 3
    && !(s.mail && s.mail.from_inbox); // a New mail Draft reply was a button tap, not a typed command
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
    if (cueCommand_(L.s.kind).cmd === cmd) throw new Error('That is the command it already is.');
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
