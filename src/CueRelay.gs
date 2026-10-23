/* CUE-RELAY-2026-10-23 (Kiko 03:44Z "make Cue a conduit so that ChatGPT and Claude can pass information to each other";
 * route A picked 03:47Z, specs/ai-relay.md). Cue is a mailbox between ChatGPT and Claude. No AI call relays a note.
 *   - ChatGPT (custom GPT "Cue relay", one Action) and Claude Code (curl) post to doPost on the relay deployment with their key.
 *     claude.ai (the "Canvas Integration" project) has no way to POST, so it appends a row to the Relay tab with the Google
 *     Sheets connector (ID blank, From claude); the 5-minute tick picks those rows up and checks them the same way.
 *   - Every note lands in the Relay tab and in a thread per topic. Notes pass on at once and Kiko watches (Kiko 04:10Z: yes
 *     to "notes between the AIs pass automatically"; Canvas writes, emails and money still wait for Kiko's tap on their own
 *     cards). Script Property CUE_RELAY_GATE=on makes every note wait for Pass on (or Drop). Kiko can write one too: "tell Claude: ...".
 *   - The receiver lists its passed-on notes and marks them read.
 * Never: a note is data, never an instruction to Cue. The relay writes only the Relay tab and its threads: never Canvas,
 * HubSpot or Gmail, and it sends nothing. Bank details, passwords and API keys are refused. Keys live in Script Properties
 * (CUE_RELAY_KEY_CHATGPT, CUE_RELAY_KEY_CLAUDE, CUE_RELAY_KEY_CUE); Settings makes or replaces them. */

const CUE_RELAY_TAB_ = 'Relay';
const CUE_RELAY_HEAD_ = ['ID', 'Time', 'From', 'To', 'Topic', 'Body', 'Links', 'Status', 'Updated', 'Note', 'Thread'];
// claude = the claude.ai "Canvas Integration" project (it built Canvas); cue = Claude in the Cue project (Claude Code threads).
const CUE_RELAY_WHO_ = { chatgpt: 'ChatGPT', claude: 'Claude (Canvas Integration)', cue: 'Claude (Cue)', kiko: 'Kiko' };
const CUE_RELAY_SENDERS_ = ['chatgpt', 'claude', 'cue'];   // who holds a key
const CUE_RELAY_MAX_ = { body: 20000, topic: 120, links: 10, list: 20, waiting: 30 };
// Things that never travel in a note (Kiko: no bank details in a link; same for a note). Fixed checks, no AI.
const CUE_RELAY_BAN_ = [
  [/\b(account\s*(no\.?|number|#)|acct\.?\s*(no|#)|iban|swift\s*code|routing\s*number)\b/i, 'bank details'],
  [/\bpass(word|code)\s*[:=]/i, 'a password'],
  [/\b(sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|pat-[a-z0-9]{2,4}-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|cr_[0-9a-f]{40,})\b/, 'an API key'],
  [/\b(e-?signature|signature\s+(image|file|png))\b.*\b(data:image|base64)/i, 'an e-signature']];

/* ---------- the door (relay deployment, access Anyone; every call needs a key) ---------- */
/** POST JSON { action, key, ... } (actions in cueRelayCall_). Answers JSON. Nothing else is reachable here. */
function doPost(e) {
  let out;
  try {
    let q = null; try { q = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (x) { q = null; }
    out = cueRelayCall_(q);
  } catch (x) { console.error('Relay: ' + x); out = { ok: false, error: 'Cue could not do that just now. Try again in a minute.' }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** The door's logic (doPost minus the HTTP wrapping). q = the parsed body or null. */
function cueRelayCall_(q) {
  if (!q || typeof q !== 'object') return { ok: false, error: 'Send JSON with action and key.' };
  const who = cueRelayWho_(q.key);
  if (!who) return { ok: false, error: 'Not allowed.' };
  if (q.action === 'relay_post') return cueRelayPost_(who, q);
  if (q.action === 'relay_list') return { ok: true, notes: cueRelayList_(who) };
  if (q.action === 'relay_read') return { ok: true, read: cueRelayMarkRead_(who, q.ids) };
  if (q.action === 'canvas_read') return cueRelayRead_(who, q);
  if (q.action === 'relay_task') return cueRelayTask_(who, q);
  if (q.action === 'relay_task_status') return cueRelayStatus_(who, q);
  if (q.action === 'relay_task_reply') return cueRelayReply_(who, q);
  if (q.action === 'relay_task_confirm') return cueRelayConfirm_(who, q);
  return { ok: false, error: 'Unknown action. Use relay_post, relay_list, relay_read, canvas_read, relay_task, relay_task_status, relay_task_reply or relay_task_confirm.' };
}

/** Which sender a key belongs to, or ''. Compares every byte, so timing says nothing about a near miss. */
function cueRelayWho_(key) {
  const k = String(key || '');
  if (k.length < 20) return '';
  let found = '';
  CUE_RELAY_SENDERS_.forEach(w => {
    const want = cueProp_('CUE_RELAY_KEY_' + w.toUpperCase(), '');
    if (!want || want.length !== k.length) return;
    let diff = 0; for (let i = 0; i < k.length; i++) diff |= k.charCodeAt(i) ^ want.charCodeAt(i);
    if (!diff) found = w;
  });
  return found;
}

/* ---------- the store ---------- */
function cueRelaySheet_() {
  const id = cueProp_('CUE_SHEET_ID', '');
  if (!id) throw new Error('Run cueSetup first.');
  const ss = SpreadsheetApp.openById(id);
  let sh = ss.getSheetByName(CUE_RELAY_TAB_);
  if (!sh) { sh = ss.insertSheet(CUE_RELAY_TAB_); sh.appendRow(CUE_RELAY_HEAD_); sh.setFrozenRows(1); }
  return sh;
}
/** Every row as a note: { row, id, time, from, to, topic, body, links, status, updated, note, thread }. */
function cueRelayRows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, CUE_RELAY_HEAD_.length).getValues().map((r, i) => ({ row: i + 2, id: String(r[0] || ''),
    time: r[1] instanceof Date ? r[1].toISOString() : String(r[1] || ''), from: String(r[2] || '').trim().toLowerCase(), to: String(r[3] || '').trim().toLowerCase(),
    topic: String(r[4] || ''), body: String(r[5] || ''), links: String(r[6] || '').split(/\s+/).filter(String), status: String(r[7] || '').trim().toLowerCase(),
    updated: r[8] instanceof Date ? r[8].toISOString() : String(r[8] || ''), note: String(r[9] || ''), thread: String(r[10] || '') }));
}
function cueRelayWrite_(sh, n) {
  sh.getRange(n.row, 1, 1, CUE_RELAY_HEAD_.length).setValues([[n.id, n.time ? new Date(n.time) : new Date(cueNow_()), n.from, n.to, n.topic, n.body,
    n.links.join(' '), n.status, new Date(cueNow_()), n.note || '', n.thread || '']]);
}

/** Checks a note. Returns { note } with clean fields, or { error }. */
function cueRelayCheck_(from, q) {
  const to = String(q.to || '').trim().toLowerCase();
  if (!CUE_RELAY_WHO_[to] || to === 'kiko') return { error: 'to must be chatgpt, claude or cue.' };
  if (to === from) return { error: 'A note goes to someone else.' };
  const topic = cueStr_(String(q.topic || '').replace(/\s+/g, ' ').trim(), CUE_RELAY_MAX_.topic + 1);
  const body = cueStr_(String(q.body || '').trim(), CUE_RELAY_MAX_.body + 1);
  if (!topic) return { error: 'Give the note a topic.' };
  if (!body) return { error: 'The note is empty.' };
  if (topic.length > CUE_RELAY_MAX_.topic) return { error: 'The topic is too long (' + CUE_RELAY_MAX_.topic + ' characters at most).' };
  if (body.length > CUE_RELAY_MAX_.body) return { error: 'The note is too long (' + CUE_RELAY_MAX_.body + ' characters at most). Split it or link a doc.' };
  const raw = Array.isArray(q.links) ? q.links : String(q.links || '').split(/\s+/).filter(String);
  if (raw.length > CUE_RELAY_MAX_.links) return { error: 'Too many links (' + CUE_RELAY_MAX_.links + ' at most).' };
  const links = raw.map(u => String(u).trim()).filter(String);
  if (links.some(u => !/^https:\/\/[^\s"'<>]{3,500}$/.test(u))) return { error: 'Links must be https addresses.' };
  const all = topic + '\n' + body + '\n' + links.join(' ');
  const ban = CUE_RELAY_BAN_.filter(b => b[0].test(all))[0];
  if (ban) return { error: 'Not sent: the note seems to hold ' + ban[1] + '. Those never go through the relay.' };
  return { note: { from, to, topic, body, links } };
}

/** relay_post: checks, stores and shows a note. */
function cueRelayPost_(from, q) {
  const c = cueRelayCheck_(from, q);
  if (c.error) return { ok: false, error: c.error };
  return cueLocked_(() => {
    const sh = cueRelaySheet_(), rows = cueRelayRows_(sh);
    if (rows.filter(r => r.from === from && r.status === 'new').length >= CUE_RELAY_MAX_.waiting)
      return { ok: false, error: 'Kiko has ' + CUE_RELAY_MAX_.waiting + ' of your notes waiting already. Wait until Kiko passes them on.' };
    sh.appendRow(['']);
    const n = Object.assign(c.note, { row: sh.getLastRow(), id: cueRelayId_(), time: new Date(cueNow_()).toISOString(), status: '', note: '', thread: '' });
    cueRelayLand_(sh, n);
    return { ok: true, id: n.id, status: n.status === 'new' ? 'waiting for Kiko' : 'passed on' };
  });
}
function cueRelayId_() { return 'rl-' + Utilities.formatDate(new Date(cueNow_()), 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0'); }

/** A checked note gets its status and topic thread, and the thread says it arrived. Runs inside the lock. */
function cueRelayLand_(sh, n) {
  const gate = n.from !== 'kiko' && cueProp_('CUE_RELAY_GATE', 'off') === 'on';
  n.status = gate ? 'new' : 'passed';
  n.thread = cueRelayThread_(n.topic);
  cueRelayWrite_(sh, n);
  const line = CUE_RELAY_WHO_[n.from] + ' to ' + CUE_RELAY_WHO_[n.to] + ': ' + n.topic + (gate ? '. Waiting for your Pass on.' : '.');
  cueChat_('Cue', line, n.thread);
  if (gate) cueRelayNeedsYou_(n.thread, true);
  if (n.from !== 'kiko') cueChat_('Cue', line, '>' + n.thread);
}

/** The thread for a topic: the one already open in the recent list, or a new one. */
function cueRelayThread_(topic) {
  const key = cueName_(topic), rows = cueRows_(cueSheet_('Requests')), recent = rows.slice(-20);
  for (let i = recent.length - 1; i >= 0; i--) {
    let s = null; try { s = JSON.parse(recent[i].slice(10, 10 + CUE_CELLS_).join('')); } catch (e) { s = null; }
    if (s && s.kind === 'relay' && s.relay && cueName_(s.relay.topic) === key && !s.archived) return s.id;
  }
  const d = new Date(cueNow_()), id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'relay', created: d.toISOString(), started: cueNow_(), text: cueStr_('AI relay: ' + topic, 2000), files: [],
    status: 'Done', stage: 'Done', ref: '', relay: { topic }, metrics: { ai_calls: 0, calls: [] }, notes: [] };
  const sh = cueSheet_('Requests'); sh.appendRow([id]); cueSave_(sh, sh.getLastRow(), s);
  return id;
}
function cueRelayNeedsYou_(id, on) {
  const L = cueLoad_(id); if (!L) return;
  const st = on ? 'Needs you' : 'Done';
  if (L.s.status !== st) { L.s.status = st; L.s.stage = st; cueSave_(L.sh, L.row, L.s); }
}

/** relay_list: the notes passed on to this receiver and not read yet, oldest first. */
function cueRelayList_(who) {
  return cueRelayRows_(cueRelaySheet_()).filter(r => r.to === who && r.status === 'passed').slice(0, CUE_RELAY_MAX_.list)
    .map(r => ({ id: r.id, from: r.from, topic: r.topic, body: r.body, links: r.links, at: r.time }));
}
/** relay_read: marks the receiver's own passed-on notes read. Returns how many. */
function cueRelayMarkRead_(who, ids) {
  const want = (Array.isArray(ids) ? ids : []).map(String).slice(0, 100);
  if (!want.length) return 0;
  return cueLocked_(() => {
    const sh = cueRelaySheet_(); let n = 0;
    cueRelayRows_(sh).forEach(r => { if (r.to === who && r.status === 'passed' && want.indexOf(r.id) >= 0) { r.status = 'read'; cueRelayWrite_(sh, r); n++; } });
    return n;
  });
}

/* ---------- claude.ai's door: rows added to the Relay tab with the Google Sheets connector ---------- */
/** On the 5-minute tick: a row with a blank ID is a new note. Only From claude is taken (ChatGPT has its key and its Action). */
function cueRelaySweep_() {
  const sh = cueRelaySheet_(), fresh = cueRelayRows_(sh).filter(r => !r.id && (r.body || r.topic));
  if (!fresh.length) return 0;
  return cueLocked_(() => {
    let n = 0;
    cueRelayRows_(sh).filter(r => !r.id && (r.body || r.topic)).forEach(r => {
      r.id = cueRelayId_(); r.time = new Date(cueNow_()).toISOString();
      const c = r.from === 'claude' ? cueRelayCheck_('claude', r) : { error: 'Only Claude adds rows here (From must be claude).' };
      if (c.error) { r.status = 'refused'; r.note = c.error; cueRelayWrite_(sh, r); return; }
      cueRelayLand_(sh, Object.assign(r, c.note)); n++;
    });
    return n;
  });
}

/* ---------- Kiko's side ---------- */
const CUE_RELAY_SAY_RE_ = /^\s*(?:tell|send\s+(?:this\s+)?to|ask|note\s+to|message)\s+(chat\s?gpt|gpt|claude|canvas\s+integration)\s*(?:[:,-]|that\b)\s*([\s\S]{3,})$/i;
/** "tell Claude: ..." / "send to ChatGPT: ..." in the chat: Kiko's own note, passed on at once. No AI call. null otherwise. */
function cueRelaySaid_(text, ref) {
  const m = CUE_RELAY_SAY_RE_.exec(String(text || ''));
  if (!m) return null;
  const to = /claude|canvas/i.test(m[1]) ? 'claude' : 'chatgpt', body = m[2].trim();
  const L = ref ? cueLoad_(ref) : null, topic = L && L.s.kind === 'relay' ? L.s.relay.topic : cueStr_(body.split('\n')[0].replace(/\s+/g, ' '), 60) + (body.split('\n')[0].length > 60 ? '…' : '');
  const c = cueRelayCheck_('kiko', { to, topic, body, links: (body.match(/https:\/\/[^\s"'<>]+/g) || []).slice(0, CUE_RELAY_MAX_.links) });
  if (c.error) throw new Error(c.error);
  cueChat_('Kiko', String(text).trim(), L && L.s.kind === 'relay' ? ref : '');
  const id = cueLocked_(() => {
    const sh = cueRelaySheet_(); sh.appendRow(['']);
    const n = Object.assign(c.note, { row: sh.getLastRow(), id: cueRelayId_(), time: new Date(cueNow_()).toISOString() });
    cueRelayLand_(sh, n);
    return n.thread;
  });
  if (ref !== id) cueChat_('Cue', 'Sent to ' + CUE_RELAY_WHO_[to] + ' through the relay. It reads it the next time it checks Cue.', '>' + id);
  return { request_id: id, task: ref || '' };
}

/** Pass on or Drop on a waiting note (Kiko's tap). */
function cueRelayAct(id, nid, what) {
  cueOwner_();
  if (what !== 'pass' && what !== 'drop') throw new Error('Unknown action.');
  cueLocked_(() => {
    const sh = cueRelaySheet_(), r = cueRelayRows_(sh).filter(x => x.id === String(nid) && x.thread === String(id))[0];
    if (!r) throw new Error('That note is not in this thread.');
    if (r.status !== 'new') return;
    r.status = what === 'pass' ? 'passed' : 'dropped'; cueRelayWrite_(sh, r);
    cueChat_('Cue', (what === 'pass' ? 'Passed on to ' : 'Dropped. Not passed to ') + CUE_RELAY_WHO_[r.to] + ': ' + r.topic + '.', id);
    if (!cueRelayRows_(sh).some(x => x.thread === String(id) && x.status === 'new')) cueRelayNeedsYou_(id, false);
  });
  return cueView_(cueLoad_(id).s);
}

/** What the card shows: every note in this thread, oldest first (the last 30). */
function cueRelayView_(s) {
  let rows = []; try { rows = cueRelayRows_(cueRelaySheet_()).filter(r => r.thread === s.id); } catch (e) { console.warn('Relay view: ' + e); }
  return { topic: (s.relay || {}).topic || '', gate: cueProp_('CUE_RELAY_GATE', 'off') === 'on',
    notes: rows.slice(-30).map(r => ({ id: r.id, at: r.time, from: CUE_RELAY_WHO_[r.from] || r.from, to: CUE_RELAY_WHO_[r.to] || r.to, body: r.body,
      links: r.links.filter(u => /^https:\/\//.test(u)), status: r.status, note: r.note })) };
}

/* ---------- Settings: keys, the gate, the URL ---------- */
function cueRelaySettings_() {
  return { url: cueProp_('CUE_RELAY_URL', ''), gate: cueProp_('CUE_RELAY_GATE', 'off') === 'on', writes: cueProp_('CUE_RELAY_WRITES', 'on') !== 'off',
    keys: CUE_RELAY_SENDERS_.map(w => ({ slot: w, who: CUE_RELAY_WHO_[w], key: cueProp_('CUE_RELAY_KEY_' + w.toUpperCase(), '') })) };
}
/** Makes the missing keys, or replaces one (who = chatgpt | claude): the old key stops working at once. */
function cueRelayKeys(who) {
  cueOwner_();
  const P = PropertiesService.getScriptProperties();
  CUE_RELAY_SENDERS_.forEach(w => {
    const k = 'CUE_RELAY_KEY_' + w.toUpperCase();
    if (w === who || !P.getProperty(k)) P.setProperty(k, 'cr_' + (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  });
  return cueSettings();
}
/** Saves the relay address that Deploy Cue printed ("Cue relay is on Version N: <url>"). Empty clears it. */
function cueRelayUrlSet(url) {
  cueOwner_();
  const u = String(url || '').trim();
  if (u && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/.test(u)) throw new Error('Paste the relay address from the deploy, like https://script.google.com/macros/s/…/exec');
  const P = PropertiesService.getScriptProperties();
  if (u) P.setProperty('CUE_RELAY_URL', u); else P.deleteProperty('CUE_RELAY_URL');
  return cueSettings();
}
function cueRelayGate(on) {
  cueOwner_();
  PropertiesService.getScriptProperties().setProperty('CUE_RELAY_GATE', on ? 'on' : 'off');
  return cueSettings();
}
/** "Kiko can confirm Canvas changes in ChatGPT" (Settings). Off: ChatGPT's confirms are refused and Kiko approves on Cue's card. */
function cueRelayWrites(on) {
  cueOwner_();
  PropertiesService.getScriptProperties().setProperty('CUE_RELAY_WRITES', on ? 'on' : 'off');
  return cueSettings();
}

/* ---------- 1.31: ChatGPT reads Canvas and hands Cue work, start to finish in ChatGPT ----------
 * Kiko 23 Oct 03:59Z (jobs 2 and 3: ChatGPT reads Canvas; hands over intakes, expenses with screenshots and CE values), 04:07Z
 * (a worker inside Cue does the Canvas work, not a claude.ai project), 04:13Z ("I just want to talk to 1. If i started in gpt i
 * want the process to complete in gpt").
 *   - canvas_read: an allow-listed bridge read, read only (Kiko 04:03Z: money reads too). Bank, signature and secret fields are
 *     stripped from the answer.
 *   - relay_task: ChatGPT hands over a CE cost change, an expense or a project intake, with its files. Cue saves the files in its
 *     Drive folder, queues the task, and a one-off trigger starts it within a minute (the 5-minute tick is the fallback). It runs
 *     as the same Cue task Kiko would start from the chat, with the same AI calls and the same card in Cue.
 *   - relay_task_status: where it is. When it waits for Kiko: the proposal, and a one-time confirm code for that exact proposal
 *     (10 minutes). A question Cue asks (which project?) comes back too; relay_task_reply carries Kiko's answer.
 *   - relay_task_confirm: Kiko's go, given in ChatGPT. The GPT Action marks it consequential, so ChatGPT shows its own Allow
 *     prompt every time; Cue also wants the code. Cue then writes to Canvas once, through the bridge, as Approve on its card does.
 * Kiko's decision (04:13Z) replaces "ChatGPT never writes to Canvas" with "ChatGPT can trigger Cue's Canvas write after Kiko
 * confirms". ChatGPT still writes nothing itself. Never through the relay: emails and RFQs (an intake's phase 4 stays in Cue),
 * cancels and deletes. Script Property CUE_RELAY_WRITES=off (Settings) refuses every confirm. */
const CUE_RELAY_READS_ = ['search_projects', 'get_project', 'get_project_board', 'ce_lines', 'list_project_files', 'get_readiness', 'status_digest', 'finance_snapshot', 'overdue_billings', 'ar_list'];
const CUE_RELAY_KINDS_ = { ce_cost: 'cecost', expense: 'expense', intake: 'intake' };
const CUE_RELAY_TASK_ = { text: 12000, files: 4, total: 6 * 1024 * 1024, queued: 10, perTick: 3, codeMs: 10 * 60 * 1000, stuckMs: 15 * 60 * 1000, out: 60000 };
const CUE_RELAY_HIDE_ = /bank|account_?(no|num)|acct|iban|swift|signature|password|secret|token|api_?key/i;
const CUE_RELAY_EXT_ = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const CUE_RELAY_PID_RE_ = /^S-\d{3,12}[A-Z0-9]{2}$/;   // the bridge's Canvas project ID rule

/** canvas_read: { read, project_id?, args? }. */
function cueRelayRead_(who, q) {
  const read = String(q.read || '');
  if (CUE_RELAY_READS_.indexOf(read) < 0) return { ok: false, error: 'canvas_read takes only: ' + CUE_RELAY_READS_.join(', ') + '.' };
  const pid = String(q.project_id || '').trim().toUpperCase();
  if (pid && !CUE_RELAY_PID_RE_.test(pid)) return { ok: false, error: 'project_id is a Canvas project ID like S-31628060SP. Use search_projects to find it.' };
  const args = q.args && typeof q.args === 'object' && !Array.isArray(q.args) ? q.args : {};
  const s = { id: 'relay-' + who + '-' + cueNow_().toString(36), metrics: { ai_calls: 0, calls: [], canvas: [] } };
  try { return { ok: true, read, result: cueRelayOut_(cueBridge_(s, read, args, pid)) }; }
  catch (e) { return { ok: false, error: cueStr_((e && e.message) || e, 400) }; }
}
function cueRelayScrub_(x, d) {
  if (d > 12) return null;
  if (Array.isArray(x)) return x.slice(0, 300).map(v => cueRelayScrub_(v, d + 1));
  if (x && typeof x === 'object') { const o = {}; Object.keys(x).forEach(k => { if (!CUE_RELAY_HIDE_.test(k)) o[k] = cueRelayScrub_(x[k], d + 1); }); return o; }
  return x;
}
/** What goes back to ChatGPT: scrubbed, and cut when it is too big for one answer. */
function cueRelayOut_(x) {
  const o = cueRelayScrub_(x == null ? null : x, 0), j = JSON.stringify(o);
  return j.length <= CUE_RELAY_TASK_.out ? o : { cut: true, note: 'Too big for one answer. Ask for one project, or fewer.', json: j.slice(0, CUE_RELAY_TASK_.out) };
}

/** relay_task: { kind: ce_cost | expense | intake, text, project?, files?: [{ name, type, data }], openaiFileIdRefs? }. Queues it. */
function cueRelayTask_(who, q) {
  const kind = CUE_RELAY_KINDS_[String(q.kind || '')];
  if (!kind) return { ok: false, error: 'kind is ce_cost, expense or intake.' };
  const text = String(q.text || '').trim(), project = cueStr_(String(q.project || '').replace(/\s+/g, ' ').trim(), 120);
  if (text.length > CUE_RELAY_TASK_.text) return { ok: false, error: 'text is ' + CUE_RELAY_TASK_.text + ' characters at most.' };
  if (kind === 'cecost' && !project) return { ok: false, error: 'Give project (the project name or its Canvas ID) for a CE cost change.' };
  const ban = CUE_RELAY_BAN_.filter(b => b[0].test(text + '\n' + project))[0];
  if (ban) return { ok: false, error: 'Not sent: the task seems to hold ' + ban[1] + '. Those never go through the relay.' };
  const sh = cueRelaySheet_();
  if (cueRelayRows_(sh).filter(r => r.from === who && r.status === 'task').length >= CUE_RELAY_TASK_.queued)
    return { ok: false, error: 'Cue has ' + CUE_RELAY_TASK_.queued + ' of your tasks queued already. Wait a few minutes.' };
  let files;
  try { files = cueRelayFiles_(q).map(f => cueDriveSave_(cueBlob_(f), 'Cue relay task from ' + CUE_RELAY_WHO_[who])); }
  catch (e) { return { ok: false, error: cueStr_((e && e.message) || e, 300) }; }
  if (text.length < 3 && !files.length) return { ok: false, error: 'Say what to do, or attach the files.' };
  const label = { cecost: 'CE costs', expense: 'Expense', intake: 'Project intake' }[kind];
  const id = cueLocked_(() => {
    sh.appendRow(['']);
    const n = { row: sh.getLastRow(), id: cueRelayId_(), time: new Date(cueNow_()).toISOString(), from: who, to: 'cue', topic: cueStr_('Task: ' + label + (project ? ' · ' + project : ''), CUE_RELAY_MAX_.topic),
      body: JSON.stringify({ kind, text, project, files }), links: [], status: 'task', note: '', thread: '' };
    cueRelayWrite_(sh, n);
    return n.id;
  });
  cueRelayKick_();
  return { ok: true, id, state: 'queued', say: 'Cue starts it within about a minute. Call relay_task_status with this id in a minute.' };
}
/** The task's files as [{ name, type, data }]: base64 in files, or ChatGPT's own uploads in openaiFileIdRefs (fetched now; their links expire). */
function cueRelayFiles_(q) {
  const given = Array.isArray(q.files) ? q.files : [], refs = Array.isArray(q.openaiFileIdRefs) ? q.openaiFileIdRefs : [];
  if (given.length + refs.length > CUE_RELAY_TASK_.files) throw new Error('Attach ' + CUE_RELAY_TASK_.files + ' files at most.');
  const type = (t, name) => { const m = String(t || '').toLowerCase().split(';')[0].trim(); return /^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(m) ? m : CUE_RELAY_EXT_[(String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1]] || ''; };
  const out = given.map(f => ({ name: String((f && f.name) || 'file'), type: type(f && f.type, f && f.name), data: String((f && f.data) || '') }));
  refs.forEach(r => {
    const link = String((r && r.download_link) || ''), name = String((r && r.name) || 'file');
    if (!/^https:\/\/[^\s"'<>]{3,2000}$/.test(link)) throw new Error(name + ': no download link.');
    const res = UrlFetchApp.fetch(link, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) throw new Error(name + ': the download failed (HTTP ' + res.getResponseCode() + '). Attach it again.');
    out.push({ name, type: type(r.mime_type, name), data: Utilities.base64Encode(res.getContent()) });
  });
  let total = 0;
  out.forEach(f => {
    f.name = f.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120);
    if (!f.type) throw new Error(f.name + ': send photos (JPG, PNG, WebP, GIF) or PDFs.');
    total += Math.floor(f.data.length * 3 / 4);
  });
  if (total > CUE_RELAY_TASK_.total) throw new Error('The files add up to more than 6 MB. Send fewer or smaller files.');
  return out;
}
/** A saved relay file's bytes, as base64. */
function cueRelayFileData_(f) {
  const res = cueDrive_('get', CUE_DRIVE_ + '/' + encodeURIComponent(String(f.id)) + '?alt=media', { raw: true });
  return { name: f.name, type: f.type, data: Utilities.base64Encode(res.getContent()) };
}

/** Starts the queued work at once: a one-off trigger (at most one waiting). The 5-minute tick does it too if this fails. */
function cueRelayKick_() {
  try {
    if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'cueRelayKick')) return;
    ScriptApp.newTrigger('cueRelayKick').timeBased().after(1000).create();
  } catch (e) { console.warn('Relay kick: ' + e); }
}
/** The one-off trigger's run: starts queued tasks and moves started ones on. */
function cueRelayKick() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'cueRelayKick').forEach(t => ScriptApp.deleteTrigger(t));
  cueRelayTasks_();
  cueRelayAdvance_();
}
/** On the tick and the kick: each queued task becomes a Cue task (up to 3 at a time). */
function cueRelayTasks_() {
  const sh = cueRelaySheet_(), now = cueNow_();
  cueRelayRows_(sh).filter(r => r.status === 'starting' && now - Date.parse(r.updated) > CUE_RELAY_TASK_.stuckMs).forEach(r => cueLocked_(() => {
    r.status = 'failed'; r.note = 'Cue stopped while starting it. Send it again.'; cueRelayWrite_(sh, r); }));
  cueRelayRows_(sh).filter(r => r.status === 'task').slice(0, CUE_RELAY_TASK_.perTick).forEach(r => {
    const got = cueLocked_(() => { const x = cueRelayRows_(sh).filter(y => y.id === r.id)[0]; if (!x || x.status !== 'task') return null; x.status = 'starting'; cueRelayWrite_(sh, x); return x; });
    if (!got) return;
    let rid = '', err = '';
    try { rid = cueRelayStart_(got); } catch (e) { err = cueStr_((e && e.message) || e, 400); }
    cueLocked_(() => { got.status = rid ? 'started' : 'failed'; got.thread = rid; got.note = err; cueRelayWrite_(sh, got); });
  });
}
/** One task: the same Cue task Kiko would start from the chat. Returns its request id. */
function cueRelayStart_(r) {
  const t = JSON.parse(r.body), who = CUE_RELAY_WHO_[r.from] || r.from;
  const was = globalThis.CUE_SCHED_RUNNING_;
  globalThis.CUE_SCHED_RUNNING_ = true;   // Cue's own run, from its trigger (cueOwner_); no page call can set this
  try {
    if (t.kind === 'cecost') return cueCecGiven_(t.text, t.project, t.files, who).request_id;
    const say = 'From ' + who + ': ' + (t.text || 'see the attached files') + (t.project ? ' (project: ' + t.project + ')' : '');
    if (t.kind === 'expense') return cueExpense(say, t.files.map(cueRelayFileData_), '').id;
    return cueSendWith_(say, t.files.map(f => ({ id: f.id })), 'intake', '', null).request_id;
  } finally { globalThis.CUE_SCHED_RUNNING_ = was; }
}
/** Moves started tasks on now (a CE match, the next intake phase) instead of on the next tick. */
function cueRelayAdvance_() {
  const now = cueNow_();
  cueRelayRows_(cueRelaySheet_()).filter(r => r.status === 'started' && r.thread).slice(-20).forEach(r => {
    const L = cueLoad_(r.thread);
    if (L && L.s.status === 'Working' && !(L.s.lease_until > now)) { try { cueRunLeased_(r.thread); } catch (e) { console.error('Relay advance ' + r.thread + ': ' + e); } }
  });
}

/** The caller's own task row and its Cue task. */
function cueRelayMine_(who, id) {
  const r = cueRelayRows_(cueRelaySheet_()).filter(x => x.id === String(id || '') && x.from === who && /^Task: /.test(x.topic))[0];
  return r ? { r, L: r.thread ? cueLoad_(r.thread) : null } : null;
}
/** What Kiko can confirm from ChatGPT right now: a CE cost card, an expense card, or intake phases 1 to 3. */
function cueRelayCan_(s) {
  if (s.status !== 'Needs you') return false;
  if (s.kind === 'cecost') return !!((s.cec || {}).rows || []).length;
  if (s.kind === 'expense') return !!(s.expense && s.expense.plan);
  return (s.kind || 'intake') === 'intake' && !!s.phased && [1, 2, 3].indexOf(s.phase) >= 0;
}
const cueRelayBind_ = s => [s.status, s.phase || 0, s.card_at || s.ready_at || 0].join(':');

/** relay_task_status: { id }. */
function cueRelayStatus_(who, q) {
  const m = cueRelayMine_(who, q.id);
  if (!m) return { ok: false, error: 'No task with that id from you.' };
  const r = m.r;
  if (r.status === 'task' || r.status === 'starting') return { ok: true, id: r.id, state: 'queued', say: 'Cue is starting it. Ask again in a minute.' };
  if (r.status === 'failed' || !m.L) return { ok: true, id: r.id, state: 'failed', error: r.note || 'The task is gone from Cue.' };
  let s = m.L.s;
  const base = { ok: true, id: r.id, kind: s.kind || 'intake', stage: s.stage, cue_thread: s.id };
  if (s.status === 'Working' || s.status === 'Writing to Canvas') return Object.assign(base, { state: 'working', say: 'Cue is on it (' + s.stage + '). Ask again in a minute.' });
  if (/^Done/.test(s.status)) return Object.assign(base, { state: 'done', result: cueRelayOut_(cueRelayResult_(s)), notes: s.notes || [] });
  if (s.status !== 'Needs you') return Object.assign(base, { state: s.status === 'Failed' ? 'failed' : 'closed', error: s.error || '' });
  if (!cueRelayCan_(s)) {
    if (s.kind === 'intake' && s.phase === 4) return Object.assign(base, { state: 'done', result: cueRelayOut_(cueRelayResult_(s)),
      say: 'The project is in Canvas. The RFQs are ready in Cue: emails never go through the relay, so Kiko sends them from Cue.' });
    return Object.assign(base, { state: 'question', question: s.error || 'Cue needs Kiko in this task.', say: 'Ask Kiko, then send the answer with relay_task_reply.' });
  }
  const code = cueLocked_(() => {
    const N = cueLoad_(s.id), k = N.s.relay_ok, bind = cueRelayBind_(N.s);
    if (k && k.bind === bind && k.until > cueNow_()) return k.code;
    N.s.relay_ok = { code: String(Math.floor(100000 + Math.random() * 900000)), until: cueNow_() + CUE_RELAY_TASK_.codeMs, bind };
    cueSave_(N.sh, N.row, N.s); s = N.s;
    return N.s.relay_ok.code;
  });
  return Object.assign(base, { state: 'needs_kiko', question: s.error || '', proposal: cueRelayOut_(cueRelayProposal_(s)), confirm_code: code,
    say: 'Show Kiko this proposal in plain words. Only when Kiko says yes, call relay_task_confirm with this confirm_code (it works once, for 10 minutes) and any edits Kiko asked for.' });
}
/** The proposal, short enough for ChatGPT to show Kiko. */
function cueRelayProposal_(s) {
  if (s.kind === 'cecost') { const v = cueCecView_(s);
    return { what: 'CE unit costs to change', project: v.project, ce_no: v.ce_no, note: v.note,
      lines: v.rows.map(r => ({ key: r.key, item: r.category + (r.description ? ': ' + r.description : ''), qty: r.qty, occurrence: r.occurrence, cost_now: r.old, cost_new: r.cost, change: r.tick, quoted: r.quoted, in_a_lot: r.lot })),
      lots: v.lots, unmatched: v.unmatched,
      edits: 'Optional: { rows: { L2: { tick: false }, L3: { tick: true, cost: 1200 } } }. Only lines with change true are written.' }; }
  if (s.kind === 'expense') { const v = cueExpView_(s);
    return { what: 'Expense to record in Canvas', project: v.project, guessed_project: v.guessed, read: v.read, plan: v.plan,
      points_to_check: ((v.plan || {}).doubts || []).map((d, i) => ({ n: i, point: d })),
      edits: 'Kiko must clear each point to check: { cleared: [0, 1] } (their n). Other fields of plan can be corrected the same way as on Cue\'s card.' }; }
  const v = cuePhView_(s);
  return { what: 'Project intake, phase ' + s.phase + ' of 4: ' + (CUE_PH_NAMES_[s.phase] || ''), details: v.x, requirements: v.rows, lines: v.lines,
    edits: 'Usually none. Kiko\'s changes are easier as a relay_task_reply first.' };
}
/** What was saved, for the done answer. */
function cueRelayResult_(s) {
  if (s.kind === 'cecost') { const c = s.cec || {}; return { project: c.project, ce_no: c.ce_no, saved: (c.rows || []).filter(r => r.tick).map(r => ({ req_id: r.req_id, item: r.category, from: r.old, to: r.after, saved: !!r.saved, why_not: r.result || '' })) }; }
  if (s.kind === 'expense') return { project: (s.expense || {}).project, canvas: s.canvas || null };
  return { project_saved: s.project_saved || [], canvas: s.canvas || null, phase: s.phase || 0 };
}

/** relay_task_reply: { id, text }: Kiko's answer to Cue's question, as if Kiko typed it in the task's thread. */
function cueRelayReply_(who, q) {
  const m = cueRelayMine_(who, q.id), text = String(q.text || '').trim();
  if (!m || !m.L) return { ok: false, error: 'No started task with that id from you.' };
  if (!text || text.length > 2000) return { ok: false, error: 'text is 1 to 2,000 characters.' };
  const ban = CUE_RELAY_BAN_.filter(b => b[0].test(text))[0];
  if (ban) return { ok: false, error: 'Not sent: it seems to hold ' + ban[1] + '.' };
  const was = globalThis.CUE_SCHED_RUNNING_;
  globalThis.CUE_SCHED_RUNNING_ = true;
  try { cueSendWith_(text, [], '', m.L.s.id, null); }
  catch (e) { return { ok: false, error: cueStr_((e && e.message) || e, 300) }; }
  finally { globalThis.CUE_SCHED_RUNNING_ = was; }
  cueRelayKick_();
  return { ok: true, id: m.r.id, state: 'working', say: 'Sent. Ask relay_task_status again in a minute.' };
}

/** relay_task_confirm: { id, code, edits? }: Kiko said yes in ChatGPT. Writes to Canvas once, as Approve on Cue's card. */
function cueRelayConfirm_(who, q) {
  if (cueProp_('CUE_RELAY_WRITES', 'on') === 'off') return { ok: false, error: 'Kiko turned off confirming from ChatGPT (Cue Settings, AI relay). Kiko approves it in Cue.' };
  const m = cueRelayMine_(who, q.id);
  if (!m || !m.L) return { ok: false, error: 'No started task with that id from you.' };
  const id = m.L.s.id, code = String(q.code || '');
  const bad = cueLocked_(() => {
    const N = cueLoad_(id), k = N.s.relay_ok;
    if (!cueRelayCan_(N.s)) return 'This task is ' + N.s.status + ', not waiting for Kiko.';
    if (!k || !code || k.code !== code || !(k.until > cueNow_()) || k.bind !== cueRelayBind_(N.s)) return 'That confirm code is old or wrong. Call relay_task_status for the current proposal and code, show it to Kiko, then confirm.';
    delete N.s.relay_ok; cueSave_(N.sh, N.row, N.s);   // one use
    return '';
  });
  if (bad) return { ok: false, error: bad };
  const edits = q.edits && typeof q.edits === 'object' && !Array.isArray(q.edits) ? JSON.parse(JSON.stringify(q.edits)) : {};
  delete edits.files;
  const s = cueLoad_(id).s;
  cueChat_('Cue', 'Kiko confirmed this in ' + CUE_RELAY_WHO_[who] + '. Writing to Canvas.', id);
  try {
    if (s.kind === 'cecost') cueCecApprove_(id, edits);
    else if (s.kind === 'expense') cueExpenseApprove_(id, Object.assign(edits, { files: (JSON.parse(m.r.body).files || []).map(cueRelayFileData_) }));
    else cuePhApprove_(id, edits);
  } catch (e) { return { ok: false, error: cueStr_((e && e.message) || e, 400) }; }
  cueRelayKick_();
  return cueRelayStatus_(who, { id: m.r.id });
}
