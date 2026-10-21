/* CUE-TICKTICK-2026-10-21 (Kiko 17:26Z approved "step 1 + TickTick"; specs/cue-skills-connectors.md).
 *   Add: Kiko asks in chat for a to-do in TickTick. The chat call Cue already makes fills todo (no extra AI call).
 *        Cue shows "Add to TickTick: …?" with Add or Skip. Add = approve: only then is the task created (POST /open/v1/task).
 *   List: "what's on my TickTick" reads the Inbox (and CUE_TICKTICK_PROJECT when set) and lists open tasks in chat. Read only.
 *   Connect: Kiko makes an app at developer.ticktick.com (redirect URL = Cue's web app URL) and sets CUE_TICKTICK_CLIENT_ID and
 *        CUE_TICKTICK_CLIENT_SECRET in Script Properties. "connect ticktick" gives a sign-in link; TickTick sends Kiko back to Cue
 *        (doGet with code and state), and Cue keeps the token in CUE_TICKTICK_TOKEN. The token never shows in chat or the sheet.
 * No token: Cue says how to connect and creates nothing. */

const CUE_TT_API_ = 'https://api.ticktick.com/open/v1', CUE_TT_AUTH_ = 'https://ticktick.com/oauth';
const CUE_TT_CONNECT_RE_ = /^\s*(?:please\s+)?(?:re-?)?connect\s+(?:my\s+)?tick\s?tick\b/i;
const CUE_TT_MAX_ = { title: 200, note: 1000, list: 15 };

const cueTtOn_ = () => !!cueProp_('CUE_TICKTICK_TOKEN', '');
function cueTt_(method, path, body) {
  const res = UrlFetchApp.fetch(CUE_TT_API_ + path, { method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cueKey_('CUE_TICKTICK_TOKEN') }, payload: body ? JSON.stringify(body) : undefined });
  const code = res.getResponseCode(), text = res.getContentText();
  if (code === 401) throw new Error('TickTick sign-in expired. Type "connect ticktick" to sign in again.');
  if (code >= 300) throw new Error('TickTick said ' + code + ': ' + String(text).slice(0, 200));
  return text ? JSON.parse(text) : {};
}

/* ---------- connect ---------- */
/** "connect ticktick": no AI call. Gives the sign-in link, or the setup steps when the app keys are not set yet. */
function cueTtConnectSaid_(text, ref) {
  const t = String(text || '').trim();
  if (!CUE_TT_CONNECT_RE_.test(t)) return null;
  cueChat_('Kiko', t, ref || '');
  const id = cueProp_('CUE_TICKTICK_CLIENT_ID', '');
  if (!id || !cueProp_('CUE_TICKTICK_CLIENT_SECRET', '')) {
    cueChat_('Cue', 'To connect TickTick: 1) Sign in at developer.ticktick.com, Manage Apps, + App Name "Cue". 2) Set its OAuth redirect URL to '
      + cueTtRedirect_() + ' 3) In Cue\'s Script Properties add CUE_TICKTICK_CLIENT_ID and CUE_TICKTICK_CLIENT_SECRET from that app. '
      + '4) Type "connect ticktick" again.', ref || '');
    return { chat: true, task: ref || '' };
  }
  const state = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('CUE_TICKTICK_STATE', state);
  const url = CUE_TT_AUTH_ + '/authorize?scope=' + encodeURIComponent('tasks:write tasks:read') + '&client_id=' + encodeURIComponent(id)
    + '&state=' + state + '&redirect_uri=' + encodeURIComponent(cueTtRedirect_()) + '&response_type=code';
  cueChat_('Cue', 'Open this link and allow Cue. TickTick brings you back to Cue when it is done: ' + url, ref || '');
  return { chat: true, task: ref || '' };
}
const cueTtRedirect_ = () => cueProp_('CUE_TICKTICK_REDIRECT', '') || ScriptApp.getService().getUrl();

/** TickTick sends Kiko back here (doGet) with code and state. One use per link. */
function cueTtCallback_(p) {
  cueOwner_();
  const P = PropertiesService.getScriptProperties(), want = P.getProperty('CUE_TICKTICK_STATE');
  const page = t => HtmlService.createHtmlOutput('<p style="font:16px sans-serif;margin:40px">' + t + '</p>').setTitle('Cue');
  if (!want || String(p.state || '') !== want) return page('This TickTick link is old. Type "connect ticktick" in Cue for a new one.');
  P.setProperty('CUE_TICKTICK_STATE', '');
  const res = UrlFetchApp.fetch(CUE_TT_AUTH_ + '/token', { method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(cueKey_('CUE_TICKTICK_CLIENT_ID') + ':' + cueKey_('CUE_TICKTICK_CLIENT_SECRET')) },
    payload: { code: String(p.code || ''), grant_type: 'authorization_code', scope: 'tasks:write tasks:read', redirect_uri: cueTtRedirect_() } });
  const d = (() => { try { return JSON.parse(res.getContentText()); } catch (e) { return {}; } })();
  if (res.getResponseCode() >= 300 || !d.access_token) { cueChat_('Cue', 'TickTick did not connect (' + res.getResponseCode() + '). Type "connect ticktick" to try again.', ''); return page('TickTick did not connect. Go back to Cue and try again.'); }
  P.setProperty('CUE_TICKTICK_TOKEN', String(d.access_token));
  cueChat_('Cue', 'TickTick is connected. Ask me to add a to-do, or "what\'s on my TickTick".', '');
  return page('TickTick is connected. You can close this tab and go back to Cue.');
}

/* ---------- add and list, from the chat call's todo field ---------- */
/** After the chat reply: an add asks Add or Skip; a list answers in chat. Never throws into the chat call. */
function cueTtFromTalk_(todo, where) {
  const job = todo && todo.job;
  if (job !== 'add' && job !== 'list') return '';
  if (!cueTtOn_()) { cueChat_('Cue', 'TickTick is not connected yet. Type "connect ticktick" and I will set it up.', where); return ''; }
  if (job === 'list') { try { cueChat_('Cue', cueTtList_(), where); } catch (e) { cueChat_('Cue', 'I could not read TickTick: ' + e.message, where); } return ''; }
  const title = cueStr_(String(todo.title || '').replace(/\s+/g, ' ').trim(), CUE_TT_MAX_.title);
  if (title.length < 2) return '';
  const due = /^\d{4}-\d{2}-\d{2}$/.test(String(todo.due || '')) ? String(todo.due) : '';
  const note = cueStr_(String(todo.note || '').trim(), CUE_TT_MAX_.note);
  return cueAskOpen_({ type: 'ticktick', title, due, note }, 'Add to TickTick: "' + title + '"' + (due ? ', due ' + due : '') + '?', ['add', 'skip'], where);
}

/** Kiko tapped Add: the task is created as shown, in the Inbox or CUE_TICKTICK_PROJECT. */
function cueTtAdd_(o) {
  const body = { title: o.title, content: o.note || '', timeZone: 'Asia/Manila' };
  if (o.due) Object.assign(body, { dueDate: o.due + 'T00:00:00+0800', startDate: o.due + 'T00:00:00+0800', isAllDay: true });
  const pid = cueProp_('CUE_TICKTICK_PROJECT', ''); if (pid) body.projectId = pid;
  return cueTt_('post', '/task', body);
}

/** TickTick gives times in UTC ("2026-10-22T16:00:00.000+0000"): the day in Manila. */
function cueTtDay_(v) {
  const ms = Date.parse(String(v).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return isFinite(ms) ? Utilities.formatDate(new Date(ms), 'Asia/Manila', 'yyyy-MM-dd') : String(v).slice(0, 10);
}

/** Open tasks, soonest due first, at most 15. */
function cueTtList_() {
  const ids = ['inbox'].concat(cueProp_('CUE_TICKTICK_PROJECT', '') ? [cueProp_('CUE_TICKTICK_PROJECT', '')] : []);
  const tasks = [].concat.apply([], ids.map(id => (cueTt_('get', '/project/' + encodeURIComponent(id) + '/data').tasks || [])))
    .filter(x => x && !x.status && String(x.title || '').trim());
  if (!tasks.length) return 'Your TickTick list is empty.';
  tasks.sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  return 'On your TickTick (' + tasks.length + ' open):\n' + tasks.slice(0, CUE_TT_MAX_.list).map(x => '- ' + cueStr_(String(x.title).trim(), 120)
    + (x.dueDate ? ' (due ' + cueTtDay_(x.dueDate) + ')' : '')).join('\n') + (tasks.length > CUE_TT_MAX_.list ? '\n…and ' + (tasks.length - CUE_TT_MAX_.list) + ' more.' : '');
}
