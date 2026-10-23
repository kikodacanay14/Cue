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
/** POST JSON { action: relay_post | relay_list | relay_read, key, ... }. Answers JSON. Nothing else is reachable here. */
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
  return { ok: false, error: 'Unknown action. Use relay_post, relay_list or relay_read.' };
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
  return { url: cueProp_('CUE_RELAY_URL', ''), gate: cueProp_('CUE_RELAY_GATE', 'off') === 'on',
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
