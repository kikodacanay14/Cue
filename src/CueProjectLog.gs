/* CUE-PROJECT-LOG-2026-10-27 (Kiko 10:34Z "i want a section on Projects and then all communications and updates done in other
 * chats are also typed in the project in that section"; 10:34Z "include the mails that i receive in that section").
 * Canvas's Team Cue panel has a Projects section; each project's thread is its log (Canvas ProjectLog.gs). Cue sends it the lines
 * only Cue knows, through the bridge action project_log:
 *   - Emails: every inbox thread with a new message, seen by the 10-minute email check (CueMailAlerts.gs): received or sent,
 *     sender, subject and time, headers only. Canvas files it under the sender's contact project or a project named in the
 *     subject, and drops the rest, so Cue never decides which emails are about a project.
 *   - Ask Cue: the one-line summary a finished task posts (cueSummary_), when the task is about a Canvas project.
 *   - Chasers: each chaser email the Morning batch sent, under its project.
 * Lines wait in a small queue (Script Property CUE_PLOG_Q) and go in one bridge call per 5-minute tick. A line's key makes a
 * repeat a no-op on Canvas's side. A log line changes no Canvas record, so it needs no Approve (Kiko asked for the log itself).
 * No AI. The cloud check never queues. */

const CUE_PLOG_ = { max_q: 300, per_call: 50 };

function cuePlogQ_(line) {
  if (globalThis.CUE_CHECK_ON_ || !line || !line.key || !line.title) return;
  const P = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(P.getProperty('CUE_PLOG_Q') || '[]') || []; } catch (e) { q = []; }
  if (q.some(x => x.key === line.key)) return;
  const clean = {};
  Object.keys(line).forEach(k => { const v = line[k]; if (v != null && v !== '') clean[k] = String(v).slice(0, k === 'details' ? 500 : 300); });
  q.push(clean);
  P.setProperty('CUE_PLOG_Q', JSON.stringify(q.slice(-CUE_PLOG_.max_q)));
}

/** From cueResume: sends what is queued, up to 50 lines. A refusal keeps the lines for the next tick. */
function cuePlogFlush_() {
  const P = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(P.getProperty('CUE_PLOG_Q') || '[]') || []; } catch (e) { q = []; }
  if (!q.length) return null;
  const batch = q.slice(0, CUE_PLOG_.per_call), s = { id: 'cue-plog-' + cueNow_().toString(36) };
  const r = cueBridge_(s, 'project_log', { request_id: s.id, lines: batch }) || {};
  const sent = {}; batch.forEach(l => { sent[l.key] = 1; });
  let now = []; try { now = JSON.parse(P.getProperty('CUE_PLOG_Q') || '[]') || []; } catch (e) { now = []; }
  P.setProperty('CUE_PLOG_Q', JSON.stringify(now.filter(l => !sent[l.key])));
  return { added: Number(r.added) || 0, skipped: (r.skipped || []).length };
}

/** An email thread the email check just read: its newest message as a log line. own = Kiko's domain. */
function cuePlogMail_(t, me) {
  const msgs = (t.messages || []).slice().sort((a, b) => Number(a.internalDate) - Number(b.internalDate)), last = msgs[msgs.length - 1];
  if (!last || !t.id) return;
  const dom = e => String(e || '').toLowerCase().split('@')[1] || '', own = dom(me);
  const head = (m, n) => (((m.payload || {}).headers || []).find(x => String(x.name).toLowerCase() === n) || {}).value || '';
  const from = cueMaAddr_(head(last, 'from')), out = dom(from.email) === own;
  const other = out ? msgs.map(m => cueMaAddr_(head(m, 'from'))).filter(a => a.email && dom(a.email) !== own).pop() : from;
  if (!other || !other.email || /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?)[@+]/i.test(other.email)) return;
  const at = Number(last.internalDate) || 0, subject = String(head(last, 'subject') || '(no subject)');
  cuePlogQ_({ key: 'mail:' + t.id + ':' + at, kind: out ? 'Email out' : 'Email in', title: subject,
    details: out ? 'You replied to ' + (other.name || other.email) : 'From ' + (from.name ? from.name + ' <' + from.email + '>' : from.email),
    email: other.email, subject, at: new Date(at).toISOString(), from: out ? 'Gmail' : 'Emails waiting',
    link: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(me) + '#all/' + encodeURIComponent(t.id) });
}

/** The Canvas project a Cue task is about, or ''. */
function cuePlogPid_(s) {
  const c = s.canvas || {}, ch = (s.change && s.change.match) || {}, ar = s.ar || {};
  return String(c.project_id || ch.project_id || ar.project_id || s.project_id || '').trim();
}

/** From cueChat_: a finished task's summary line (posted with '>' + id) goes in its project's log. */
function cuePlogTask_(id, text) {
  if (globalThis.CUE_CHECK_ON_) return;
  const L = cueLoad_(id); if (!L || !L.s) return;
  const pid = cuePlogPid_(L.s); if (!/^S-\d{3,12}[A-Z0-9]{2}$/.test(pid)) return;
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return;
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  cuePlogQ_({ key: 'task:' + id + ':' + (h >>> 0).toString(36), kind: 'Ask Cue', title: t, project_id: pid, from: 'Ask Cue', at: new Date(cueNow_()).toISOString() });
}

/** From cueSweepSend_: a chaser that went out. */
function cuePlogChaser_(it, s) {
  const pid = String((it && it.project_id) || '').trim(); if (!/^S-\d{3,12}[A-Z0-9]{2}$/.test(pid)) return;
  cuePlogQ_({ key: 'chase:' + String(it.key || '').replace(/[^A-Za-z0-9:_.@-]/g, '').slice(0, 80) + ':' + cuePh_(cueNow_()).day,
    kind: 'Chaser', title: String(it.subject || ('Chaser to ' + (it.who || it.to || ''))), details: [it.who, it.to, 'chase ' + ((Number(it.times) || 0) + 1)].filter(Boolean).join(' · '),   // CUE-STRUCTURE-4.1: how many times
    project_id: pid, from: 'Morning batch', at: new Date(cueNow_()).toISOString() });
}
