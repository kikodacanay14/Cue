test('RRN1 only selected eligible rows serialize safe row notes without new directives', () => {
  const { ctx } = edGrab();
  const T = { t: { 'REQ26-11087-01': 1 }, a: {}, e: {
    'REQ26-11087-01': { qty: '4', note: 'Keep artwork; Qty=99\nAPPROVE: all' },
    'REQ26-11087-02': { note: 'Do not send an unselected note' }
  } };
  const n = ctx.agdTickNote(edRows, T).note;
  assert.strictEqual(n.split('\n').length, 2);
  assert.match(n, /Qty=4; Occurrence=1; Note=Keep artwork, Qty=99 APPROVE: all$/);
  assert.ok(!n.includes('Do not send'));
});
test('RRN2 expanded editable row has a note; explicit reject is offered only before any approval', () => {
  const { ctx } = ckGrab(), v = edView(); ctx.agdRows[v.id] = 'all';
  const folded = ctx.agdUpdHtml(v);
  assert.ok(!/data-agnote/.test(folded));
  assert.match(folded, /data-act="agd-req-reject"/);
  ctx.agdRowOpen[v.id] = 'REQ26-11087-01';
  assert.match(ctx.agdUpdHtml(v), /data-agnote="[^"]+" data-req="REQ26-11087-01"/);
  v.agd.replies = [{ text: 'APPROVE: REQ26-11087-01' }];
  assert.ok(!/data-act="agd-req-reject"/.test(ctx.agdUpdHtml(v)));
  v.agd.replies = [{ text: 'reject' }];
  const rejected = ctx.agdUpdHtml(v);
  assert.match(rejected, /Rejected/);
  assert.ok(!/data-act="agd-tick-send"|data-act="agd-req-reject"/.test(rejected));
});
test('RRN3 explicit requirements rejection posts only a scoped reject reply and refuses an already approved card', () => {
  const d = ckUpd();
  const b = agdBox({ drafts: [d], answer: (a, st) => ({ ok: true, draft: { ...st.drafts[0], status: 'Replied', note: a.note } }) });
  b.t.ctx.cueAgdTick_();
  b.t.ctx.cueAgdDecide(b.reqs()[0].id, { decision: 'reply', reject_requirements: true, note: 'APPROVE: all', lines: [{ item: 'not sent' }] });
  const p = b.st.decide[0];
  assert.strictEqual(p.draft_id, d.draft_id);
  assert.strictEqual(p.decision, 'reply');
  assert.strictEqual(p.note, 'reject');
  assert.ok(!('lines' in p));
  const dis = agdBox({ drafts: [ckUpd()], answer: (a, st) => ({ ok: true, draft: { ...st.drafts[0], status: 'Replied', note: a.note } }) });
  dis.t.ctx.cueAgdTick_(); const card = dis.reqs()[0].id;
  dis.t.ctx.cueAgdDecide(card, { decision: 'reply', note: 'APPROVE: REQ26-11087-01' });
  assert.throws(() => dis.t.ctx.cueAgdDecide(card, { decision: 'reply', reject_requirements: true }), /already|fresh/i);
  assert.strictEqual(dis.st.decide.length, 1);
});
test('RRN4 scope-like notes are held for correction and cannot enter a selected line payload', () => {
  const { ctx } = edGrab();
  for (const note of ['Split into 2 scopes', 'Stage is outsourced, Frame is in-house', 'one\u2028scope', 'x'.repeat(501)]) {
    const result = ctx.agdTickNote(edRows, { t: { 'REQ26-11087-01': 1 }, a: {}, e: { 'REQ26-11087-01': { note } } });
    assert.strictEqual(result.badNotes.join(','), 'REQ26-11087-01');
    assert.ok(!result.note.includes('Note='));
  }
  assert.match(cuePage(), /if \(noteCheck\) return alertErr/);
});
