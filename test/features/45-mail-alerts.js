// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: mail-alerts.
/* ---------- CUE-MAIL-ALERTS-2026-10-27: Cue writes the Emails waiting file for Canvas (CueMailAlerts.gs) ---------- */
function maBox(threads) {
  const t = sandbox(), calls = [], files = {}, perms = [];
  let gets = 0;
  t.ctx.Session = { getEffectiveUser: () => ({ getEmail: () => 'kikodacanay@blankspaceevent.com' }) };
  const resp = (c, b) => ({ getResponseCode: () => c, getContentText: () => JSON.stringify(b), getHeaders: () => ({}) });
  const route = r => {
    const u = r.url; calls.push(((r.method || 'get') + ' ' + u).slice(0, 140));
    if (/\/users\/me\/threads\?labelIds=INBOX/.test(u)) return resp(200, { threads: threads.map(x => ({ id: x.id, historyId: x.h })) });
    const m = u.match(/\/users\/me\/threads\/([^?]+)\?format=metadata/);
    if (m) { gets++; const x = threads.find(y => y.id === m[1]); return x ? resp(200, { id: x.id, messages: x.msgs }) : resp(404, {}); }
    if (/upload\/drive\/v3\/files\?uploadType=media/.test(u)) { files.F1 = JSON.parse(r.payload); return resp(200, { id: 'F1' }); }
    if (/upload\/drive\/v3\/files\/F1\?uploadType=media/.test(u)) { files.F1 = JSON.parse(r.payload); return resp(200, { id: 'F1' }); }
    if (/drive\/v3\/files\/F1\/permissions/.test(u)) { perms.push(JSON.parse(r.payload)); return resp(200, {}); }
    if (/drive\/v3\/files\/F1$/.test(u)) { files.name = JSON.parse(r.payload).name; return resp(200, {}); }
    throw new Error('unexpected ' + u);
  };
  t.ctx.UrlFetchApp = { fetch: (url, o) => route(Object.assign({ url }, o || {})), fetchAll: rs => rs.map(route) };
  return Object.assign(t, { calls, files, perms, gets: () => gets });
}
const maMsg = (from, ms, labels) => ({ internalDate: String(ms), labelIds: labels || [], payload: { headers: [{ name: 'From', value: from }, { name: 'Subject', value: 'Re: RFQ' }] } });

test('MA1 Cue writes Emails waiting for Canvas every 10 minutes: waiting threads only, shared view-only with info@, unchanged threads not read again', () => {
  const now = Date.parse('2026-10-27T02:00:00Z');
  const threads = [
    { id: 'a1', h: '10', msgs: [maMsg('Kiko <kikodacanay@blankspaceevent.com>', now - 9e6), maMsg('Ana Reyes <ana@acme.example>', now - 3e6, ['INBOX', 'UNREAD'])] },
    { id: 'a2', h: '11', msgs: [maMsg('Ana Reyes <ana@acme.example>', now - 5e6), maMsg('kikodacanay@blankspaceevent.com', now - 4e6)] },   // answered
    { id: 'a3', h: '12', msgs: [maMsg('no-reply@shop.example', now - 2e6)] },
    { id: 'a4', h: '13', msgs: [maMsg('Old <old@x.example>', now - 20 * 864e5)] }];
  const t = maBox(threads);
  t.ctx.cueNow_ = () => now;
  assert.strictEqual(t.ctx.cueMaTick_(), 1);
  deq([t.files.F1.on, t.files.F1.email, t.files.F1.checked, t.files.F1.threads.map(x => [x.id, x.email, x.unread, x.repliedBefore])],
    [true, 'kikodacanay@blankspaceevent.com', now, [['a1', 'ana@acme.example', true, true]]]);
  deq([t.files.name, t.perms], ['canvas-email-alerts.json', [{ role: 'reader', type: 'user', emailAddress: 'info@blankspaceevent.com' }]]);
  assert.ok(t.calls.some(c => /permissions\?sendNotificationEmail=false/.test(c)), 'no share email');
  assert.strictEqual(t.ctx.cueMaTick_(), null, 'not due again within 10 minutes');
  t.ctx.cueNow_ = () => now + 10 * 60e3;
  threads[2].h = '99';
  assert.strictEqual(t.ctx.cueMaTick_(), 1);
  deq([t.gets(), t.perms.length, t.files.F1.checked], [5, 1, now + 10 * 60e3]);   // only the moved thread is read again; the file is updated, not remade
  assert.ok(!t.calls.some(c => /\/(send|modify|trash)/.test(c)), 'nothing changes in Gmail');
});

test('MA2 the email check rides cueResume and never runs for a non-BSE account; a Gmail failure never stops the tick', () => {
  const t = sandbox(); t.ctx.cueResume();
  assert.ok(!(t.log.cache || {}).cue_ma_seen2, 'kiko@example.com: Canvas would not read it, so nothing is read');
  const u = maBox([]); u.ctx.UrlFetchApp.fetch = () => { throw new Error('Gmail down'); };
  assert.doesNotThrow(() => u.ctx.cueResume());
  assert.ok(u.ctx.cueJobs_().some(j => j.fn === 'cueMaTick_'), 'a job in the cueResume list (CueJobs.gs)');
});

test('MA3 each waiting email carries its first line from Gmail\'s preview, greetings left out, for the compact Emails waiting card', () => {
  const now = Date.parse('2026-10-28T02:00:00Z');
  const msg = Object.assign(maMsg('Peachy <peachy@client.example>', now - 3e6, ['INBOX']),
    { snippet: 'Hi Kiko, Good day! I hope you&#39;re well. May we ask for your rate for the video edit &amp; the schedule?' });
  const t = maBox([{ id: 'c1', h: '1', msgs: [msg] }]);
  t.ctx.cueNow_ = () => now; t.ctx.cueMaTick_();
  assert.strictEqual(t.files.F1.threads[0].gist, 'May we ask for your rate for the video edit & the schedule?');
  const g = t.ctx.cueMaGist_;
  deq([g('Dear Ms. Ana, Attached is the PO.'), g('Good morning team, please see the quote.'), g('Hello!'), g(''), g('x'.repeat(300)).length],
    ['Attached is the PO.', 'please see the quote.', 'Hello!', '', 220]);
});
