// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: contact-new.
// CUE-CONTACT-NEW-2026-10-29: new contacts and companies from the From and Cc of Kiko's own Gmail (Kiko 29 Oct 13:14Z; spec
// specs/gmail-new-contacts.md). Gmail and Canvas (contact_new_check, contact_add) are mocked here; the arguments are checked
// against the real bridge schema in fixtures/ZapBridge.gs.
const CN_MSGS = [
  { id: 'm1', threadId: '18c3aa0100000001', date: '2025-03-14T02:00:00Z', from: 'Ana Reyes <ana.reyes@northwind.test>', cc: '"Lim, Mark" <mark.lim@northwind.test>, Old Friend <old@acme.test>', subject: 'Year-end party quote' },
  { id: 'm2', threadId: '18c3aa0200000002', date: '2026-09-02T02:00:00Z', from: 'kiko@example.com', cc: 'Joy Santos <joy@acme.test>', subject: 'RFP: Family Day 2026' },
  { id: 'm3', threadId: '18c3aa0300000003', date: '2024-06-21T02:00:00Z', from: 'carlo.dizon@gmail.com', cc: '', subject: 'Team building inquiry' }];
const CN_SIG = { 'ana.reyes@northwind.test': [{ id: 's1', body: 'Hi Kiko,\nPlease quote.\n\nThanks,\nAna Reyes\nHR Engagement Lead\nNorthwind Solutions\n+63 917 123 4567\n\nOn Mon wrote:\n> old' }] };
const CN_AI = { people: [{ k: 'P1', title: 'HR Engagement Lead', title_line: 'HR Engagement Lead', company: 'Northwind Solutions', company_line: 'Northwind Solutions', phone: '0917 123 4567', phone_line: '+63 917 123 4567' }] };
/** Canvas, simplified: kiko@ and old@ are known; acme.test is Acme Corp (P6); other domains are new; a personal address has no company. */
const cnCanvas = people => {
  const known = [], by = {}, order = [];
  people.forEach(p => { const e = p.email, d = e.split('@')[1];
    if (e === 'old@acme.test' || e === 'kiko@example.com') { known.push(e); return; }
    const g = d === 'acme.test' ? { company: 'Acme Corp', domain: d, status: 'keep', p: 'P6' } : d === 'gmail.com' ? (p.company ? { company: p.company, domain: '', status: 'new', p: 'P0' } : { company: '', domain: '', status: 'none', p: '' })
      : { company: p.company || d.split('.')[0].replace(/^./, c => c.toUpperCase()), domain: d, status: 'new', p: 'P0' };
    const k = g.domain ? 'd|' + d : g.status + '|' + g.company; if (!by[k]) { by[k] = Object.assign(g, { emails: [] }); order.push(k); } else if (p.company) by[k].company = p.company;   // one domain, one company
    by[k].emails.push(e); });
  return { known, groups: order.map(k => by[k]) };
};
function cnBox(o = {}) {
  let t = null;
  const enc = s => Buffer.from(s, 'utf8').toString('base64url');
  const web = req => {
    const u = req.url;
    if (u.indexOf('gmail.googleapis.com') >= 0) {
      const log = t.log; if (u.indexOf('/messages?') >= 0) { const q = decodeURIComponent(u.split('q=')[1].split('&')[0]); (log.cnQ = log.cnQ || []).push(q);
        if (/from:/.test(q)) { const who = q.match(/from:(\S+)/)[1]; return resp(200, { messages: (CN_SIG[who] || []).map(m => ({ id: m.id, threadId: m.id })) }); }
        if (o.listFail) return resp(500, {});
        return resp(200, { messages: (o.msgs || CN_MSGS).map(m => ({ id: m.id, threadId: m.threadId })) }); }
      (log.cnGet = log.cnGet || []).push(u.split('/messages/')[1]);
      const id = u.split('/messages/')[1].split('?')[0], m = (o.msgs || CN_MSGS).find(x => x.id === id);
      if (m && /format=metadata/.test(u)) return resp(200, { id, threadId: m.threadId, internalDate: String(Date.parse(m.date)),
        payload: { headers: [{ name: 'From', value: m.from }, { name: 'Cc', value: m.cc }, { name: 'Subject', value: m.subject }] } });
      const s = [].concat(...Object.values(CN_SIG)).find(x => x.id === id);
      return s ? resp(200, { id, threadId: id, payload: { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: enc(s.body) } }] } }) : resp(404, {});
    }
    if (u.indexOf('script.google.com') >= 0) { const body = JSON.parse(req.payload), log = t.log;
      if (body.action === 'contact_new_check') { (log.cnCheck = log.cnCheck || []).push(body.args); return resp(200, { ok: true, status: 'Completed', result: cnCanvas(body.args.people) }); }
      if (body.action === 'contact_add') { const pl = (log.plans_ || {})[body.task_id], cmds = pl ? JSON.parse(pl).commands : null;
        if (!cmds) return resp(200, { ok: false, status: 'Rejected', error: 'no claimed plan for this task' });
        (log.cnAdd = log.cnAdd || []).push(body.args);
        if (o.addRefused) return resp(200, { ok: true, status: 'Completed', result: { refused: o.addRefused } });
        const plan = cnCanvas(body.args.people);
        return resp(200, { ok: true, status: 'Completed', result: { saved: true, companies: plan.groups.filter(g => g.status === 'new').map(g => g.company),
          contacts: [].concat(...plan.groups.map(g => g.emails.map(e => ({ email: e, company: g.company })))), known: plan.known } }); }
    }
    return null;
  };
  t = sandbox(Object.assign({ web, csAi: o.ai || CN_AI, props: { CUE_CN_STATE: '' } }, o.box || {}));
  return t;
}
const cnCard = t => { const r = t.tabs.Chat.rows.filter(x => /^\?ask-/.test(String(x[3]))).pop(); return r ? { text: String(r[2]), id: String(r[3]).slice(1).split(':')[0], choices: String(r[3]).split(':')[1] } : null; };
const cnRows = t => t.tabs['New contacts'].rows.slice(1).map(r => [r[0], r[6], String(r[7]).replace(/^'/, '')]);

test('CN1 the 3-year rewind reads only From, Cc and Subject; Canvas checks; one card with ticks; nothing written before Approve', () => {
  const t = cnBox();
  t.ctx.cueCnTick_();
  assert.ok(/^after:\d+ before:\d+ -in:chats$/.test(t.log.cnQ[0]), t.log.cnQ[0]);
  const after = Number(t.log.cnQ[0].match(/after:(\d+)/)[1]), before = Number(t.log.cnQ[0].match(/before:(\d+)/)[1]);
  assert.ok(Math.abs((before - after) / 86400 - 3 * 365.25) < 1, 'three years');
  assert.ok(t.log.cnGet.filter(g => /^m\d/.test(g)).every(g => /format=metadata&metadataHeaders=From&metadataHeaders=Cc&metadataHeaders=Subject$/.test(g)), 'scanned mail: headers only, never a body');
  deq(t.log.cnGet.filter(g => /format=full/.test(g)), ['s1?format=full'], 'a body is read only for the signature of a person on the card, from their own email');
  deq(t.log.cnCheck.map(c => c.people.length), [6, 4], 'one check for all six people, one for the four on the card');
  t.log.cnCheck.forEach(c => assert.strictEqual(bridgeCheck('contact_new_check', c), ''));
  assert.strictEqual(t.log.claude.length, 1, 'one Haiku call for the signatures'); assert.strictEqual(t.log.claude[0].model, 'claude-haiku-5-5');
  const c = cnCard(t); assert.ok(c, 'a card'); assert.strictEqual(c.choices, 'approve,skippage');
  assert.ok(/^Add new contacts to Canvas\? From the From and Cc of your Gmail \(the last 3 years\): 2 companies, 4 people\.\n/.test(c.text), c.text);
  assert.ok(/\nNorthwind Solutions · northwind\.test · New company, P0\n☐1 Ana Reyes · HR Engagement Lead · ana\.reyes@northwind\.test · From · "Year-end party quote" · 2025-03-14\n☐2 Lim, Mark · title not in signature · mark\.lim@northwind\.test · Cc/.test(c.text), c.text);
  assert.ok(/\nAcme Corp · acme\.test · In Canvas, P6, stage stays\n☐3 Joy Santos/.test(c.text) && /\nNo company \(personal email\) · contact only\n☐4 carlo\.dizon/.test(c.text), c.text);
  assert.ok(!/old@acme|kiko@example/.test(c.text), 'people already in Canvas are not on the card');
  assert.ok(!(t.log.cnAdd || []).length, 'nothing written before Approve');
  deq(cnRows(t), [['ana.reyes@northwind.test', 'On card', 'Northwind Solutions'], ['mark.lim@northwind.test', 'On card', 'Northwind Solutions'], ['old@acme.test', 'Known', ''],
    ['kiko@example.com', 'Known', ''], ['joy@acme.test', 'On card', 'Acme Corp'], ['carlo.dizon@gmail.com', 'On card', '']]);
  t.ctx.cueCnTick_(); assert.strictEqual(t.tabs.Chat.rows.filter(x => /^\?ask-/.test(String(x[3]))).length, 1, 'one card at a time');
  t.ctx.cueAskPick(c.id, 'approve', 'skip:2')
  assert.strictEqual(t.log.cnAdd.length, 1); assert.strictEqual(bridgeCheck('contact_add', t.log.cnAdd[0]), '');
  deq(t.log.cnAdd[0].people, [
    { email: 'ana.reyes@northwind.test', name: 'Ana Reyes', title: 'HR Engagement Lead', phone: '+63 917 123 4567', company: 'Northwind Solutions', via: 'From', subject: 'Year-end party quote', date: '2025-03-14', thread: '18c3aa0100000001' },
    { email: 'joy@acme.test', name: 'Joy Santos', company: 'Acme Corp', via: 'Cc', subject: 'RFP: Family Day 2026', date: '2026-09-02', thread: '18c3aa0200000002' },
    { email: 'carlo.dizon@gmail.com', via: 'From', subject: 'Team building inquiry', date: '2024-06-21', thread: '18c3aa0300000003' }], 'Mark was unticked');
  const last = String(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2]);
  assert.ok(/^Added 3 contacts and 1 new company at P0 to Canvas\. Undo any of it in Canvas › Accounts › Auto add\./.test(last), last);
  deq(cnRows(t).map(r => r[1]), ['Added', 'Not added', 'Known', 'Known', 'Added', 'Added']);
  assert.strictEqual(t.log.gmail.length + (t.log.sent || []).length, 0, 'no email drafted or sent');
});
test('CN2 Skip page adds nobody; a Canvas refusal puts the people back for the next card; a Gmail failure keeps the page for next time', () => {
  let t = cnBox(); t.ctx.cueCnTick_(); t.ctx.cueAskPick(cnCard(t).id, 'skippage');
  assert.ok(!(t.log.cnAdd || []).length); deq(cnRows(t).map(r => r[1]), ['Skipped', 'Skipped', 'Known', 'Known', 'Skipped', 'Skipped']);
  t = cnBox({ addRefused: 'P0 is busy. Nothing was saved.' }); t.ctx.cueCnTick_(); t.ctx.cueAskPick(cnCard(t).id, 'approve', 'skip:');
  assert.ok(/^Canvas refused: P0 is busy\. Nothing was saved\. Nobody was added\./.test(String(t.tabs.Chat.rows[t.tabs.Chat.rows.length - 1][2])));
  deq(cnRows(t).map(r => r[1]), ['New', 'New', 'Known', 'Known', 'New', 'New']);
  t.ctx.cueCnTick_(); assert.strictEqual(t.tabs.Chat.rows.filter(x => /^\?ask-/.test(String(x[3]))).length, 2, 'the same people on a new card');
  t = cnBox({ listFail: true });
  assert.throws(() => t.ctx.cueCnTick_(), /Gmail did not list messages/);
  const st = JSON.parse(t.props.CUE_CN_STATE); assert.strictEqual(st.done, false); assert.strictEqual(st.kind, 'rewind'); assert.ok(!cnCard(t));
});
test('CN3 after the rewind, a weekly window: mail since the last window, a week later; nothing in between', () => {
  const t = cnBox(); t.ctx.cueCnTick_(); t.ctx.cueAskPick(cnCard(t).id, 'skippage');
  const first = JSON.parse(t.props.CUE_CN_STATE); assert.ok(first.done);
  t.log.cnQ = []; t.ctx.__wait(3 * 864e5); t.ctx.cueCnTick_(); deq(t.log.cnQ, [], 'no read 3 days later');
  t.ctx.__wait(5 * 864e5); t.ctx.cueCnTick_();
  const st = JSON.parse(t.props.CUE_CN_STATE); assert.strictEqual(st.kind, 'weekly'); assert.strictEqual(st.from, first.to);
  assert.ok(t.log.cnQ[0].indexOf('after:' + Math.floor(first.to / 1000) + ' ') === 0, t.log.cnQ[0]);
});
test('CN4 headers: names with commas and quotes, bare addresses; the page draws ticks and Approve sends the unticked rows', () => {
  const t = cnBox(), a = v => JSON.parse(JSON.stringify(t.ctx.cueCnAddrs_(v)));
  deq(a('"Lim, Mark" <Mark.Lim@x.test>, Ana Reyes <ana@y.test>, joy@z.test, bad@, \'Bo\' <bo@w.test>'),
    [{ name: 'Lim, Mark', email: 'mark.lim@x.test' }, { name: 'Ana Reyes', email: 'ana@y.test' }, { name: '', email: 'joy@z.test' }, { name: 'Bo', email: 'bo@w.test' }]);
  const html = cuePage();
  assert.ok(/function tickText\(m\)/.test(html) && /data-tk="' \+ esc\(q\.id\) \+ '"/.test(html), 'tick lines become checkboxes');
  assert.ok(/call\('cueAskPick', \[id, 'approve', 'skip:' \+ off\.join\(','\)\]/.test(html), 'Approve sends the unticked numbers');
  assert.ok(/skippage: 'Skip page'/.test(html));
  assert.ok(vm.runInContext('CUE_CN_RE_', t.ctx).test('scan my gmail for new contacts'));
});
