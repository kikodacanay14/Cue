/* CUE-SCHEDULE-2026-10-22 (Kiko 19:12Z "we need a task scheduler"; 19:13Z "run a command and tell Cue to Schedule a task followed by
 * the task we want it to do"; spec specs/task-scheduler.md, Kiko "Go" 22 Oct 00:57Z).
 *   One registry, one trigger. Every timed job is a row in the Schedule tab of the Cue sheet. The 5-minute cueResume trigger calls
 *   cueSchedTick_, which starts the rows whose time has come. The morning sweep, the bid check and the Monday HubSpot check were
 *   their own triggers; they are now system rows (on/off and time can change; they cannot be deleted), and their triggers go.
 *   "Schedule <when> <command>" in chat makes a row after one Save tap. "show my schedules" lists them. Settings > Scheduled tasks
 *   shows them all with on/off, time, Run now and Delete.
 *   A scheduled run only prepares: it starts the same task Kiko would start by typing, so emails stay drafts and Canvas writes wait
 *   for approval unless an auto-send rule covers them. Intake is refused: it needs an inquiry to read.
 * Times are Manila. A row runs once even when Cue was down for hours (no pile-up), and says how late it was. */

const CUE_SCHED_TAB_ = 'Schedule';
const CUE_SCHED_HEAD_ = ['ID', 'Name', 'Type', 'Repeat', 'Days', 'Day of month', 'Date', 'Time', 'Command', 'Run', 'On', 'Next run', 'Last run', 'Last result', 'Last task', 'Created'];
const CUE_SCHED_DAYS_ = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CUE_SCHED_MAX_ = { per_tick: 3, rows: 60, late_min: 30 };
const CUE_SCHED_RE_ = /^\s*schedule\b[\s:,-]*/i;
const CUE_SCHED_LIST_RE_ = /^\s*(show|list|see)\s+(me\s+)?(all\s+)?(my\s+|the\s+)?(scheduled\s+tasks|schedules|scheduled)\s*[?.!]*\s*$|^\s*what'?s\s+scheduled\s*[?.!]*\s*$/i;

/* ---------- the tab ---------- */
function cueSchedSheet_() {
  const ss = SpreadsheetApp.openById(cueKey_('CUE_SHEET_ID'));
  let sh = ss.getSheetByName(CUE_SCHED_TAB_);
  if (!sh) { sh = ss.insertSheet(CUE_SCHED_TAB_); sh.appendRow(CUE_SCHED_HEAD_); sh.setFrozenRows(1); }
  return sh;
}
const cueSchedMs_ = v => v instanceof Date ? v.getTime() : typeof v === 'number' ? v : (Date.parse(String(v || '')) || 0);
function cueSchedRead_(sh) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, CUE_SCHED_HEAD_.length).getValues().map((r, i) => ({ row: i + 2, id: String(r[0] || ''), name: String(r[1] || ''),
    type: String(r[2] || 'user'), repeat: String(r[3] || ''), days: String(r[4] || '').split(/[,\s]+/).filter(d => CUE_SCHED_DAYS_.indexOf(d) >= 0),
    dom: Number(r[5]) || 0, date: r[6] instanceof Date ? r[6].toISOString().slice(0, 10) : String(r[6] || ''), time: r[7] instanceof Date ? ('0' + r[7].getHours()).slice(-2) + ':' + ('0' + r[7].getMinutes()).slice(-2) : String(r[7] || '').replace(/^'/, ''), command: String(r[8] || ''),
    run: String(r[9] || ''), on: r[10] === true || /^(true|yes|on)$/i.test(String(r[10])), next: cueSchedMs_(r[11]), last: cueSchedMs_(r[12]),
    result: String(r[13] || ''), task: String(r[14] || ''), created: cueSchedMs_(r[15]) })).filter(x => x.id) : [];
}
function cueSchedWrite_(sh, x) {
  sh.getRange(x.row, 1, 1, CUE_SCHED_HEAD_.length).setValues([[x.id, x.name, x.type, x.repeat, x.days.join(','), x.dom || '', x.date || '', x.time ? "'" + x.time : '', x.command, x.run,
    !!x.on, x.next ? new Date(x.next) : '', x.last ? new Date(x.last) : '', cueStr_(x.result, 300), x.task || '', x.created ? new Date(x.created) : new Date(cueNow_())]]);
}
/** The soonest time any row that is on comes due, kept in a property so a tick with nothing due never opens the sheet. */
function cueSchedNextSave_(list) {
  const due = list.filter(x => x.on && x.next).map(x => x.next);
  PropertiesService.getScriptProperties().setProperty('CUE_SCHED_NEXT', String(due.length ? Math.min.apply(null, due) : 0));
}

/* ---------- when ---------- */
const cueSchedHm_ = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? { h: Number(m[1]), m: Number(m[2]) } : null; };
const cueSchedDow_ = day => new Date(Date.parse(day + 'T00:00:00Z')).getUTCDay();
/** The first moment after `after` (ms) that row x is due, or 0 when it never is again. */
function cueSchedNextAt_(x, after) {
  const hm = cueSchedHm_(x.time); if (!hm) return 0;
  const at = day => cuePhAt_(day, hm.h) + hm.m * 60000;
  if (x.repeat === 'once') { const t = /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? at(x.date) : 0; return t > after ? t : 0; }
  let day = cuePh_(after).day;
  for (let i = 0; i < 400; i++, day = cueAddDays_(day, 1)) {
    const w = cueSchedDow_(day), dom = Number(day.slice(8, 10));
    const last = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();   // a 31st runs on the month's last day
    const ok = x.repeat === 'daily' || (x.repeat === 'weekdays' && w >= 1 && w <= 5) || (x.repeat === 'weekly' && x.days.indexOf(CUE_SCHED_DAYS_[w]) >= 0)
      || (x.repeat === 'monthly' && dom === Math.min(x.dom, last));
    if (ok && at(day) > after) return at(day);
  }
  return 0;
}
const cueSchedOrd_ = n => n + ([, 'st', 'nd', 'rd'][n % 100 >> 3 ^ 1 && n % 10] || 'th');
/** "Daily 07:00", "Weekdays 08:00", "Mon, Thu 09:00", "15th monthly 16:00", "Once Fri 2026-10-24 15:00". */
function cueSchedWhen_(x) {
  const t = x.time;
  if (x.repeat === 'once') return 'Once ' + (x.date ? CUE_SCHED_DAYS_[cueSchedDow_(x.date)] + ' ' + x.date + ' ' : '') + t;
  if (x.repeat === 'daily') return 'Daily ' + t;
  if (x.repeat === 'weekdays') return 'Weekdays ' + t;
  if (x.repeat === 'weekly') return x.days.join(', ') + ' ' + t;
  if (x.repeat === 'monthly') return cueSchedOrd_(x.dom) + ' monthly ' + t;
  if (x.repeat === 'minute') return 'Every minute';   // its own trigger (cueRfpKick); never due in this list
  return t;
}
const cueSchedShow_ = ms => { if (!ms) return ''; const p = cuePh_(ms); return CUE_SCHED_DAYS_[cueSchedDow_(p.day)] + ' ' + p.day + ' ' + String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); };

const CUE_SCHED_DAY_RE_ = 'mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?';
const CUE_SCHED_MON_ = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const cueSchedDayOf_ = w => CUE_SCHED_DAYS_[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(String(w).slice(0, 3).toLowerCase())];
/** Reads the when out of Kiko's words, in code (no AI call). Returns { when: {repeat, days, dom, date, time}, rest } or { error }. */
function cueSchedParse_(text, now) {
  let s = ' ' + String(text || '').replace(/\s+/g, ' ') + ' ';
  const cut = (re, f) => { const m = re.exec(s); if (!m) return null; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return f ? f(m) : m; };
  const w = { repeat: '', days: [], dom: 0, date: '', time: '' };
  const today = cuePh_(now).day;
  let byName = false;
  // "in 2 hours", "in 30 minutes": once, exact.
  const inN = cut(/\bin\s+(\d{1,3})\s*(min(?:ute)?s?|h(?:ou)?rs?)\b/i, m => Number(m[1]) * (/^h/i.test(m[2]) ? 60 : 1));
  if (inN) { const p = cuePh_(now + inN * 60000); w.repeat = 'once'; w.date = p.day; w.time = String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); }
  // The time: 9am, 9:30 pm, 4 p.m., 16:00, noon.
  if (!w.time) {
    const t = cut(/\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)(?=[\s,.;:!?)]|$)/i, m => { let h = Number(m[1]) % 12; if (/^p/i.test(m[3])) h += 12; return h <= 23 ? String(h).padStart(2, '0') + ':' + (m[2] || '00') : ''; })
      || cut(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/, m => String(Number(m[1])).padStart(2, '0') + ':' + m[2])
      || cut(/\b(?:at\s+)?noon\b/i, () => '12:00');
    if (t) w.time = t;
  }
  // How often.
  if (!w.repeat) {
    let m;
    if ((m = cut(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+)?of\s+(?:the|every|each)\s+month\b/i)) || (m = cut(/\b(?:monthly|every\s+month|each\s+month)\s+(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i))
      || (m = cut(/\b(?:every|each)\s+(\d{1,2})(?:st|nd|rd|th)\b(?:\s+of\s+the\s+month)?/i)) || (m = cut(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\s+monthly\b/i))) {
      w.repeat = 'monthly'; w.dom = Number(m[1]);
      if (w.dom < 1 || w.dom > 31) return { error: 'A month has days 1 to 31.' };
    } else if (cut(/\b(?:every\s*day|everyday|daily|each\s+day)\b/i)) w.repeat = 'daily';
    else if (cut(/\b(?:every\s+)?(?:weekdays?|working\s+days?|work\s*days?)\b|\bmonday\s+(?:to|through|-)\s+friday\b/i)) w.repeat = 'weekdays';
    else if ((m = cut(new RegExp('\\b(?:every|each)\\s+((?:' + CUE_SCHED_DAY_RE_ + ')(?:\\s*(?:,|and|&|/)\\s*(?:' + CUE_SCHED_DAY_RE_ + '))*)\\b', 'i')))
      || (m = cut(new RegExp('\\b(?:on\\s+)?((?:mon|tues|wednes|thurs|fri|satur|sun)days(?:\\s*(?:,|and|&)\\s*(?:mon|tues|wednes|thurs|fri|satur|sun)days)*)\\b', 'i')))
      || (m = cut(/\bweekly\s+on\s+([a-z]+)\b/i))) {
      w.repeat = 'weekly'; w.days = CUE_SCHED_DAYS_.filter(d => m[1].split(/\s*(?:,|and|&|\/)\s*|\s+/i).map(cueSchedDayOf_).indexOf(d) >= 0);
      if (!w.days.length) return { error: 'I could not tell which day of the week.' };
    } else if (cut(/\btoday\b|\btonight\b/i)) { w.repeat = 'once'; w.date = today; }
    else if (cut(/\btomorrow\b/i)) { w.repeat = 'once'; w.date = cueAddDays_(today, 1); }
    else if ((m = cut(/\b(?:on\s+)?(\d{4}-\d{2}-\d{2})\b/))) { w.repeat = 'once'; w.date = m[1]; }
    else if ((m = cut(/\b(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)) || (m = cut(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i))) {
      const mon = CUE_SCHED_MON_.indexOf(String(/^\d/.test(m[1]) ? m[2] : m[1]).slice(0, 3).toLowerCase()) + 1, dd = Number(/^\d/.test(m[1]) ? m[1] : m[2]);
      let y = Number(today.slice(0, 4)); const pad = n => String(n).padStart(2, '0');
      if (y + '-' + pad(mon) + '-' + pad(dd) < today) y++;
      w.repeat = 'once'; w.date = y + '-' + pad(mon) + '-' + pad(dd);
    } else if ((m = cut(new RegExp('\\b(?:on\\s+|this\\s+|next\\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', 'i')))) {
      const want = CUE_SCHED_DAYS_.indexOf(cueSchedDayOf_(m[1])); let d = today;
      for (let i = 0; i < 7 && cueSchedDow_(d) !== want; i++) d = cueAddDays_(d, 1);
      w.repeat = 'once'; w.date = d; byName = true;   // today when it is that day and the time is still ahead; else a week on (below)
    }
  }
  if (!w.repeat && w.time) { w.repeat = 'once'; w.date = today; }
  if (!w.repeat) return { error: 'I could not tell when. Say it like "every Monday 9am", "weekdays 8am", "15th of the month 4pm", "Friday 3pm" or "tomorrow 10am".' };
  if (!w.time) return { error: 'What time? Say it like "9am" or "16:00".' };
  if (w.repeat === 'once' && cueSchedNextAt_(w, now) === 0) {
    if (byName && w.date === today) w.date = cueAddDays_(today, 7);
    else return { error: 'That time has already passed (' + w.date + ' ' + w.time + ' Manila).' };
  }
  const rest = s.replace(/^[\s,:;.-]*(?:(?:to|and|then|at|on)\s+)*/i, '').replace(/[\s,:;-]+$/, '').replace(/\s+/g, ' ').trim();
  return { when: w, rest };
}

/* ---------- what a row runs ---------- */
const CUE_SCHED_INTAKE_RE_ = /\b(intake|requote|re-?quote|new project)\b/i;
/** What Kiko's command means, decided once when it is saved (code only). 'say' replays it through Cue's chat like a typed message. */
function cueSchedResolve_(cmd) {
  const t = String(cmd || '').trim();
  const rm = /^remind\s+me\s+(?:to\s+|about\s+|that\s+)?(.+)$/i.exec(t);
  if (rm) return { run: 'remind', text: rm[1].trim() };
  if (CUE_SCHED_INTAKE_RE_.test(t) && !cueBidsAsked_(t)) return { error: 'Intake cannot be scheduled: it needs an inquiry to read. Send the inquiry when it comes, and I will run it then.' };
  if (/^(?:run\s+|do\s+|start\s+)?(?:the\s+)?(?:morning\s+)?(?:chasing\s+)?(?:sweep|batch|morning\s+batch)$/i.test(t)) return { run: 'sweep', text: t };
  if (cueBidsAsked_(t)) return { run: 'bids', text: t };
  if (cueHsAsked_(t)) return { run: 'hubspot', text: t };
  if (/^(?:run\s+|do\s+|check\s+)?(?:the\s+|a\s+|my\s+)?(?:sales\s+)?pipeline(?:\s+(?:review|check|health))?$/i.test(t)) return { run: 'pipeline', text: t };
  if (/^(?:show\s+|run\s+|check\s+)?(?:the\s+|my\s+)?(?:sales\s+funnel|funnel|hub\s?spot\s+tasks)$/i.test(t)) return { run: 'funnel', text: t };
  return { run: 'say', text: t };
}
const CUE_SCHED_RUNS_ = { unsched: 'Code check, no AI', remind: 'Reminder', sweep: 'Morning sweep', bids: 'Bid opportunity check', hubspot: 'HubSpot check', pipeline: 'Pipeline review', relnotes: 'Release notes', rfps: 'RFPs from your Gmail', funnel: 'Sales funnel (P0 to P9, deals, HubSpot tasks)', funnelreview: 'Sales funnel review', say: 'Runs as if you typed it' };

/** The rows Cue itself keeps. On as before for jobs that already ran on their own trigger; the newer ones start off until Kiko turns them on. */
function cueSchedSystem_() {
  const rows = [
    { id: 'sys-sweep', name: 'Morning sweep', repeat: 'daily', time: String(cueRules_().general.build).padStart(2, '0') + ':00', run: 'sweep', command: 'Morning sweep and chasers', on: true },
    { id: 'sys-bids', name: 'Bid opportunities', repeat: 'daily', time: String(CUE_BIDS_RULES_.hour).padStart(2, '0') + ':00', run: 'bids', command: 'Bid opportunity check', on: true },
    { id: 'sys-hubspot', name: 'Monday HubSpot check', repeat: 'weekly', days: ['Mon'], time: '06:00', run: 'hubspot', command: 'HubSpot clean-up scan', on: true },
    { id: 'sys-pipeline', name: 'HubSpot sales review', repeat: 'weekly', days: ['Thu'], time: '08:00', run: 'pipeline', command: 'Pipeline review', on: false },
    { id: 'sys-funnel', name: 'Sales funnel', repeat: 'daily', time: '07:00', run: 'funnel', command: 'Sales funnel', on: true },   // Kiko 24 Oct 13:56Z, no AI
    { id: 'sys-funnelreview', name: 'Monday sales funnel review', repeat: 'weekly', days: ['Mon'], time: '07:00', run: 'funnelreview', command: 'Sales funnel review', on: true },   // CueSweepFunnel.gs, spec canvas-crm-funnel.md F6 (Kiko 26 Oct 16:08Z)
    { id: 'sys-relnotes', name: 'Daily release notes', repeat: 'daily', time: '19:45', run: 'relnotes', command: 'Release notes for today', on: true },   // CueRelnotes.gs, Kiko 02:34Z 27 Oct
    { id: 'sys-rfps', name: 'RFPs from your Gmail', repeat: 'minute', time: '', run: 'rfps', command: 'Send the RFPs you pressed Send on in Canvas', on: true },   // CueRfpSend.gs, its own 1-minute trigger; Run now sends at once (Kiko 28 Oct 08:33Z)
    { id: 'sys-unsched', name: 'Unscheduled check', repeat: 'daily', time: '07:00', run: 'unsched', command: 'Alarm me about anything unscheduled', on: true }];
  // The lead-gen and review tasks (CueGptTasks.gs, kind gtask) register through cueGtSchedules_ when that file is in Cue.
  if (typeof cueGtSchedules_ === 'function') {
    try {
      cueGtSchedules_().forEach(g => rows.push({ id: 'sys-gt-' + g.key, name: g.name, repeat: g.repeat, days: (g.days || []).map(cueSchedDayOf_).filter(Boolean),
        dom: Number(g.day_of_month) || 0, time: g.time, run: 'gtask:' + g.key, command: g.command || g.name, on: false }));
    } catch (e) { console.warn('Scheduled ChatGPT tasks: ' + e); }
  }
  return rows;
}
/** Adds any system row the tab does not have yet. Cheap: skipped while the list of system rows is unchanged. */
function cueSchedSeed_() {
  // Read every 5 minutes, so the check costs one property read: Cue's own rows (v2 added the unscheduled check), plus the ChatGPT task keys.
  let gt = ''; try { gt = typeof cueGtSchedules_ === 'function' ? cueGtSchedules_().map(g => g.key).join(',') : ''; } catch (e) { gt = ''; }
  const sig = 'v6:' + gt;   // v4 added the release notes, v5 the RFP sender, v6 the sales funnel review
  if (cueProp_('CUE_SCHED_SEED', '') === sig) return;
  const sys = cueSchedSystem_();
  cueLocked_(() => {
    const sh = cueSchedSheet_(), have = cueSchedRead_(sh).map(x => x.id), now = cueNow_();
    sys.filter(x => have.indexOf(x.id) < 0).forEach(x => {
      const r = { row: sh.getLastRow() + 1, id: x.id, name: x.name, type: 'system', repeat: x.repeat, days: x.days || [], dom: x.dom || 0, date: '', time: x.time,
        command: x.command, run: x.run, on: x.on, next: 0, last: 0, result: '', task: '', created: now };
      r.next = cueSchedNextAt_(r, now); sh.appendRow([r.id]); cueSchedWrite_(sh, r);
    });
    cueSchedNextSave_(cueSchedRead_(sh));
    PropertiesService.getScriptProperties().setProperty('CUE_SCHED_SEED', sig);
  });
}

/** Runs one row now. Returns { result, task }. Never approves or sends anything. */
function cueSchedRun_(x, manual) {
  const P = PropertiesService.getScriptProperties(), today = cuePh_(cueNow_()).day, id = o => (o && (o.request_id || o.id)) || '';
  globalThis.CUE_SCHED_RUNNING_ = true;   // cueOwner_ lets Cue's own scheduled run through (a trigger has no page user)
  try {
    if (x.run === 'remind') {
      cueChat_('Cue', '⏰ Reminder: ' + x.command.replace(/^remind\s+me\s+(?:to\s+|about\s+|that\s+)?/i, ''), '');
      return { result: 'Reminded', task: '' };
    }
    if (x.run === 'sweep') {
      if (manual) return { result: 'Started', task: id(cueSweepNow()) };
      const s = cueSweep(); return s ? { result: 'Started', task: s.id } : { result: 'Already ran today', task: '' };
    }
    if (x.run === 'bids') {
      if (!manual && P.getProperty('CUE_BIDS_DAY') === today) return { result: 'Already ran today', task: '' };
      P.setProperty('CUE_BIDS_DAY', today);
      return { result: 'Started', task: id(cueBidsStart_(manual ? 'Run bid opportunity check' : 'Daily bid opportunity check', 'daily')) };
    }
    if (x.run === 'hubspot') {
      if (!manual && P.getProperty('CUE_HSC_WEEK') === today) return { result: 'Already ran today', task: '' };
      P.setProperty('CUE_HSC_WEEK', today);
      return { result: 'Started', task: id(cueHsStart_('Monday HubSpot check', 'weekly')) };
    }
    if (x.run === 'unsched') { const n = cueUnschedCheck_(manual); return { result: n ? n + ' to look at' : 'All scheduled', task: '' }; }
    if (x.run === 'rfps') {   // CUE-RFP-SEND-2026-10-28: only Run now reaches here; the minutes run from cueRfpKick
      const o = cueRfpRun_();
      if (o.busy) return { result: 'Already sending', task: '' };
      if (o.row && o.row[3] === 'Failed') return { result: 'Failed: ' + o.row[4], task: '' };
      return { result: o.sent || o.failed ? 'Sent ' + (o.sent || 0) + (o.failed ? ', ' + o.failed + ' not sent' : '') : o.note && /^Could not read/.test(o.note) ? o.note : 'Nothing waiting', task: '' };
    }
    if (x.run === 'funnelreview') {   // CRM-FUNNEL-REST-2026-10-28: one GPT call, lines in Cue's chat
      if (!manual && P.getProperty('CUE_FREV_DAY') === today) return { result: 'Already ran today', task: '' };
      if (!manual) P.setProperty('CUE_FREV_DAY', today);
      try { const o = cueFunnelReview_(manual); return { result: o.lines ? 'Posted ' + o.lines + ' lines in the chat' : 'Posted the numbers (no AI answer)', task: '' }; }
      catch (e) { return { result: 'Failed: ' + String((e && e.message) || e).slice(0, 200), task: '' }; }
    }
    if (x.run === 'pipeline') return { result: 'Started', task: id(cuePipeStart_(x.command || 'Pipeline review', '')) };
    if (x.run === 'funnel') {
      if (!manual && P.getProperty('CUE_FUNNEL_DAY') === today) return { result: 'Already ran today', task: '' };
      P.setProperty('CUE_FUNNEL_DAY', today);
      return { result: 'Started', task: id(cueFunnelStart_(x.command || 'Sales funnel', 'daily')) };
    }
    if (x.run === 'relnotes') {   // CUE-RELNOTES-2026-10-27: a day with nothing live makes no thread
      if (!manual && P.getProperty('CUE_RN_DAY') === today) return { result: 'Already ran today', task: '' };
      if (!manual) P.setProperty('CUE_RN_DAY', today);
      const o = cueRnStart_(manual); return o.skip ? { result: o.skip, task: '' } : { result: 'Started', task: id(o) };
    }
    if (/^gtask:/.test(x.run)) {
      if (typeof cueGtScheduled !== 'function') return { result: 'Not in this Cue yet', task: '' };
      const o = cueGtScheduled(x.run.slice(6));
      return o ? { result: 'Started', task: id(o) } : { result: 'Already ran today', task: '' };
    }
    // 'say': exactly what Kiko would get by typing the command (tutor mode, if on, shows its plan card first).
    cueChat_('Cue', '⏰ ' + x.name + (manual ? ' (Run now)' : ' (scheduled ' + x.time + ')') + ':', '');
    const o = cueSendWith_(x.command, [], '', '', null);
    return { result: o && o.request_id ? 'Started' : 'Answered in chat', task: id(o) };
  } finally { globalThis.CUE_SCHED_RUNNING_ = false; }
}

/** From cueResume (every 5 minutes). Starts the rows that are due, at most 3 per tick; the rest wait 5 minutes. */
function cueSchedTick_() {
  cueSchedSeed_();
  const now = cueNow_(), next = Number(cueProp_('CUE_SCHED_NEXT', '0'));
  if (next && next > now) return [];
  const take = cueLocked_(() => {
    const sh = cueSchedSheet_(), list = cueSchedRead_(sh);
    const due = list.filter(x => x.on && x.next && x.next <= now).sort((a, b) => a.next - b.next).slice(0, CUE_SCHED_MAX_.per_tick);
    due.forEach(x => {   // the next time is written before the run, so a row never runs twice for one time
      x.due = x.next; x.last = now; x.next = cueSchedNextAt_(x, now);
      if (x.repeat === 'once') x.on = false;
      x.result = 'Starting'; cueSchedWrite_(sh, x);
    });
    // A row switched on with no next time (e.g. typed into the sheet) gets one.
    list.filter(x => x.on && !x.next && due.indexOf(x) < 0).forEach(x => { x.next = cueSchedNextAt_(x, now); if (x.next) cueSchedWrite_(sh, x); });
    cueSchedNextSave_(list);
    if (list.filter(x => x.on && x.next && x.next <= now).length) PropertiesService.getScriptProperties().setProperty('CUE_SCHED_NEXT', String(now));
    return due;
  });
  take.forEach(x => {
    let out = null;
    try { out = cueSchedRun_(x, false); } catch (e) { out = { result: 'Failed: ' + String((e && e.message) || e).slice(0, 200), task: '' }; console.error('Schedule ' + x.id + ': ' + e); }
    const late = Math.round((now - x.due) / 60000);
    if (late >= CUE_SCHED_MAX_.late_min) out.result += ' (late by ' + (late >= 120 ? Math.round(late / 60) + ' h' : late + ' min') + ')';
    cueSchedDone_(x.id, out);
  });
  return take.map(x => x.id);
}
function cueSchedDone_(id, out) {
  cueLocked_(() => {
    const sh = cueSchedSheet_(), x = cueSchedRead_(sh).filter(y => y.id === id)[0]; if (!x) return;
    x.result = out.result; if (out.task) x.task = out.task; if (out.at) x.last = out.at; cueSchedWrite_(sh, x);
  });
}

/* ---------- chat ---------- */
/** "Schedule <when> <command>" and "show my schedules". Plain words, so no AI call. Returns null for any other message. */
function cueSchedSaid_(text, ref) {
  const t = String(text || '').trim();
  if (CUE_SCHED_LIST_RE_.test(t)) {
    cueSchedSeed_();
    cueChat_('Kiko', t, ref || '');
    cueChat_('Cue', cueSchedListText_(), ref || '');
    return { chat: true, task: ref || '' };
  }
  if (!CUE_SCHED_RE_.test(t)) return null;
  cueChat_('Kiko', t, ref || '');
  const say = m => { cueChat_('Cue', m, ref || ''); return { chat: true, task: ref || '' }; };
  const p = cueSchedParse_(t.replace(CUE_SCHED_RE_, ''), cueNow_());
  if (p.error) return say(p.error);
  if (!p.rest) return say('What should I run then? Say it like "Schedule every Monday 9am pipeline review" or "Schedule Friday 3pm remind me to send the invoice".');
  const r = cueSchedResolve_(p.rest);
  if (r.error) return say(r.error);
  const x = Object.assign({ days: [], dom: 0, date: '' }, p.when);
  const name = r.run === 'remind' ? 'Remind: ' + cueStr_(r.text, 60) : cueStr_(p.rest.charAt(0).toUpperCase() + p.rest.slice(1), 70);
  const first = cueSchedNextAt_(x, cueNow_());
  const q = 'Schedule this?\n' + name + '\n' + cueSchedWhen_(x) + ' (Manila)' + (x.repeat === 'once' ? '' : '\nFirst run: ' + cueSchedShow_(first))
    + '\nWhat runs: ' + (r.run === 'say' ? 'the same as typing "' + cueStr_(p.rest, 120) + '" (one chat call each time)' : CUE_SCHED_RUNS_[r.run] + (r.run === 'remind' ? ', no AI call' : ''))
    + '\nDrafts only. Nothing sends without your Approve.';
  cueAskOpen_({ type: 'schedule', name, when: x, command: r.run === 'remind' ? 'Remind me to ' + r.text : p.rest, run: r.run }, q, ['save', 'not'], ref || '');
  return { chat: true, task: ref || '' };
}
/** Save or Not that on the confirm card (CueRoute.gs cueAskPick). */
function cueSchedPick_(o, pick, done) {
  cueChat_('Kiko', pick === 'save' ? 'Save' : 'Not that', done);
  if (pick !== 'save') { cueChat_('Cue', 'OK, not scheduled.', done); return { chat: true }; }
  const x = cueSchedAdd_(o);
  cueChat_('Cue', 'Saved. ' + x.name + ', ' + cueSchedWhen_(x) + '. Next run ' + cueSchedShow_(x.next) + '. See or change it in Settings > Scheduled tasks.', done);
  return { chat: true };
}
function cueSchedAdd_(o) {
  return cueLocked_(() => {
    const sh = cueSchedSheet_(), list = cueSchedRead_(sh), now = cueNow_();
    if (list.filter(x => x.type === 'user').length >= CUE_SCHED_MAX_.rows) throw new Error('You have ' + CUE_SCHED_MAX_.rows + ' schedules. Delete one in Settings first.');
    const w = o.when || {};
    const x = { row: sh.getLastRow() + 1, id: 'sch-' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36), name: cueStr_(o.name, 80), type: 'user',
      repeat: w.repeat, days: w.days || [], dom: w.dom || 0, date: w.date || '', time: w.time, command: cueStr_(o.command, 500), run: o.run, on: true,
      next: 0, last: 0, result: '', task: '', created: now };
    x.next = cueSchedNextAt_(x, now);
    if (!x.next) throw new Error('That time has already passed.');
    sh.appendRow([x.id]); cueSchedWrite_(sh, x); cueSchedNextSave_(list.concat([x]));
    return x;
  });
}
function cueSchedListText_() {
  const list = cueSchedRead_(cueSchedSheet_());
  if (!list.length) return 'Nothing is scheduled yet. Say "Schedule every Monday 9am pipeline review".';
  return 'Scheduled tasks (Manila time):\n' + list.map(x => '- ' + x.name + ': ' + cueSchedWhen_(x) + (x.on ? (x.next ? ', next ' + cueSchedShow_(x.next) : '') : ', off')
    + (x.last ? '. Last: ' + cueSchedShow_(x.last) + ', ' + (x.result || '') : '')).join('\n') + '\nTurn them on or off, change times or Run now in Settings > Scheduled tasks.';
}

/* ---------- Settings > Scheduled tasks ---------- */
function cueSchedView_() {
  return cueSchedRead_(cueSchedSheet_()).map(x => ({ id: x.id, name: x.name, system: x.type === 'system', when: cueSchedWhen_(x), on: x.on, command: x.command,
    runs: /^gtask:/.test(x.run) ? 'ChatGPT' : x.run === 'remind' ? 'Reminder' : x.run === 'say' ? 'As typed' : CUE_SCHED_RUNS_[x.run] || x.run,
    next: x.on ? cueSchedShow_(x.next) : '', last: cueSchedShow_(x.last), result: x.result, task: x.task,
    about: cueAdminSchedAbout_(x) }));   // CUE-ADMIN-2-2026-10-29: what it does, who asked and when, what it follows
}
function cueSchedules() { cueOwner_(); cueSchedSeed_(); return cueSchedView_(); }
/** o = { on: true|false } and/or { when: 'weekdays 8am' }. The when is read by the same code as the chat command. */
function cueSchedSet(id, o) {
  cueOwner_(); o = o || {};
  // The sweep's hour is also Chaser rules' "build at" (whole hours, before the send time): that is saved first, so a bad hour changes nothing.
  if (String(id) === 'sys-sweep' && o.when != null) {
    const p = cueSchedParse_(String(o.when), cueNow_()), hm = p.when && cueSchedHm_(p.when.time);
    if (hm && hm.m) throw new Error('The morning sweep runs on the hour, e.g. 7am.');
    if (hm && hm.h !== cueRules_().general.build) cueRulesSave({ 'general.build': hm.h });
  }
  cueLocked_(() => {
    const sh = cueSchedSheet_(), list = cueSchedRead_(sh), x = list.filter(y => y.id === String(id))[0], now = cueNow_();
    if (!x) throw new Error('No such schedule.');
    if (o.when != null) {
      const p = cueSchedParse_(String(o.when), now);
      if (p.error) throw new Error(p.error);
      if (p.rest) throw new Error('Only the time and days go here, e.g. "weekdays 8am". To change what it runs, delete it and schedule again.');
      Object.assign(x, { repeat: p.when.repeat, days: p.when.days || [], dom: p.when.dom || 0, date: p.when.date || '', time: p.when.time });
    }
    if (o.on != null) x.on = !!o.on;
    x.next = x.on ? cueSchedNextAt_(x, now) : 0;
    if (x.on && !x.next) x.on = false;
    cueSchedWrite_(sh, x); cueSchedNextSave_(list);
  });
  return cueSchedView_();
}
function cueSchedRunNow(id) {
  cueOwner_();
  const x = cueSchedRead_(cueSchedSheet_()).filter(y => y.id === String(id))[0];
  if (!x) throw new Error('No such schedule.');
  let out;
  try { out = cueSchedRun_(x, true); } catch (e) { out = { result: 'Failed: ' + String((e && e.message) || e).slice(0, 200), task: '' }; }
  out.at = cueNow_(); cueSchedDone_(x.id, out);
  return cueSchedView_();
}
function cueSchedDelete(id) {
  cueOwner_();
  cueLocked_(() => {
    const sh = cueSchedSheet_(), list = cueSchedRead_(sh), x = list.filter(y => y.id === String(id))[0];
    if (!x) throw new Error('No such schedule.');
    if (x.type === 'system') throw new Error('Cue\'s own schedules can be turned off but not deleted.');
    sh.deleteRow(x.row); cueSchedNextSave_(list.filter(y => y !== x));
  });
  return cueSchedView_();
}

/* ---------- the sweep's hour lives in two places: Chaser rules (build at) and its row here ---------- */
/** Chaser rules changed the build hour: the sweep row follows. */
function cueSchedSweepHour_(hour) {
  try {
    cueSchedSeed_();
    cueLocked_(() => {
      const sh = cueSchedSheet_(), list = cueSchedRead_(sh), x = list.filter(y => y.id === 'sys-sweep')[0]; if (!x) return;
      x.time = String(hour).padStart(2, '0') + ':00'; x.next = x.on ? cueSchedNextAt_(x, cueNow_()) : 0; cueSchedWrite_(sh, x); cueSchedNextSave_(list);
    });
  } catch (e) { console.warn('Sweep schedule: ' + e); }
}

/* ---------- "unscheduled" alarm (Kiko 22 Oct 05:20Z "alarm me if there's any task that is unscheduled"; picked Both 05:21Z) ----------
 * Daily 07:00 (its own row). Scheduled jobs that will not run: switched off, on with no next time, last run failed, or overdue (the
 * tick did not start it). Open tasks waiting on Kiko with no due date and no reminder. One card in the main chat only when something
 * is found; Mute these hides those items from later cards. Code only, no AI call. */
const CUE_UNSCHED_WAIT_ = ['Needs you', 'Failed', 'Reopened'];
function cueUnschedFind_() {
  const now = cueNow_(), out = [];
  cueSchedRead_(cueSchedSheet_()).filter(x => x.id !== 'sys-unsched').forEach(x => {
    const w = x.name + ' (' + cueSchedWhen_(x) + ')';
    if (!x.on) out.push({ key: 'off:' + x.id, line: w + ': switched off' });
    else if (x.repeat === 'minute') { /* its own 1-minute trigger: never has a next run here */ }
    else if (!x.next) out.push({ key: 'none:' + x.id, line: w + ': on, but has no next run' });
    else if (x.next < now - CUE_SCHED_MAX_.late_min * 60000) out.push({ key: 'late:' + x.id + ':' + x.next, line: w + ': missed its ' + cueSchedShow_(x.next) + ' run' });
    if (/^Failed/.test(x.result)) out.push({ key: 'fail:' + x.id + ':' + x.last, line: w + ': last run failed (' + x.result.replace(/^Failed:\s*/, '').slice(0, 120) + ')' });
  });
  const list = cueRows_(cueSheet_('Requests')).slice(-60).map(r => { try { return JSON.parse(r.slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { return null; } }).filter(Boolean);
  const by = {}; list.forEach(x => { by[x.id] = x; });
  const root = id => { for (let i = 0; i < 8 && by[id] && by[id].ref; i++) id = by[id].ref; return id; }, seen = {};
  list.slice().reverse().forEach(x => {   // newest run per thread decides
    const r = root(x.id); if (seen[r]) return; seen[r] = 1;
    const R = by[r] || x;
    // A report a schedule made (bids, the Monday check, a ChatGPT task) comes back on its own time, so it is not "unscheduled".
    if (R.archived || x.kind === 'sweep' || R.how === 'daily' || R.how === 'weekly' || R.how === 'scheduled' || CUE_UNSCHED_WAIT_.indexOf(x.status) < 0 || R.due || R.remind_at) return;
    out.push({ key: 'task:' + r, line: cueTaskName_(R) + ': waiting on you (' + x.status + '), no due date or reminder', task: r });
  });
  return out;
}
function cueUnschedMuted_() { try { return JSON.parse(cueProp_('CUE_UNSCHED_MUTE', '[]')); } catch (e) { return []; } }
/** Posts the card when something is found (or, from Run now, says all is scheduled). Returns how many items it listed. */
function cueUnschedCheck_(manual) {
  const mute = cueUnschedMuted_(), items = cueUnschedFind_().filter(x => mute.indexOf(x.key) < 0);
  if (!items.length) { if (manual) cueChat_('Cue', 'Unscheduled check: everything is scheduled.', ''); return 0; }
  const jobs = items.filter(x => !x.task), tasks = items.filter(x => x.task);
  const q = '⚠️ Unscheduled check: ' + items.length + ' to look at.'
    + (jobs.length ? '\nScheduled tasks that will not run:\n' + jobs.map(x => '- ' + x.line).join('\n') + '\nFix them in Settings > Scheduled tasks.' : '')
    + (tasks.length ? '\nTasks waiting on you with no due date or reminder:\n' + tasks.map(x => '- ' + x.line).join('\n') + '\nReply in a task\'s thread with a date, e.g. "remind me Friday 3pm".' : '');
  cueAskOpen_({ type: 'unsched', keys: items.map(x => x.key) }, q, ['ok', 'mute'], '');
  return items.length;
}
/** Got it, or Mute these: the listed items stay out of later cards (a new failure or missed run has a new key, so it still shows). */
function cueUnschedPick_(o, pick, done) {
  cueChat_('Kiko', pick === 'mute' ? 'Mute these' : 'Got it', done);
  if (pick === 'mute') {
    const keep = cueUnschedMuted_().concat(o.keys || []).filter((k, i, a) => a.indexOf(k) === i).slice(-300);
    PropertiesService.getScriptProperties().setProperty('CUE_UNSCHED_MUTE', JSON.stringify(keep));
    cueChat_('Cue', 'Muted. Those ' + (o.keys || []).length + ' will not show again; anything new still will.', done);
  }
  return { chat: true };
}
