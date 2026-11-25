// Part of test/cue.test.js. Feature: AGENT-CHECK-CARD-2026-11-18 (Kiko 18 Nov 2026 04:35:50Z "what i want to see are Payments without
// Invoices, no signed FSAs and ARs, suppliers that are not accredited in a project"; 05:27:45Z "I expect separate reports - Admin Check
// and Finance Check"; 05:32:00Z "tha main table expands and shows details of the FSAs / ARs / Suppliers. same thing with Finance";
// approved 06:06:51Z, mockup cards 3a and 3b https://claude.ai/artifact/Xb3X3eXTnSnS2AB3GB2wyk). One main table, one row per check.
const ackId = 'a1b2c3d4e5f6g7h8i9j0';
const ackAdmin = { kind: 'admin', run_at: '18 Nov, 2:00 PM', rows: [
  { check: 'fsa', ok: 59, items: [{ name: 'Crew <C>', scope: 'Manpower, Area 01', date: '15 Nov', amount: '2500', status: 'Not signed' }] },
  { check: 'ar', ok: 58, items: [{ name: 'Supplier B', scope: 'Food carts', date: '10 Nov', amount: '18500.5', status: 'Not signed' }] },
  { check: 'accreditation', ok: 11, items: [] }] };
function ackView(check) {
  const b = agdBox({ drafts: [agdUpd(80, { project: 'Kings Day', project_id: 'S-6133716KI', agent: 'Admin agent', handover: { handover_ref: 'CHK', summary: 's', state: 'Delivered', check } })] });
  b.t.ctx.cueAgdTick_(); return JSON.parse(JSON.stringify(b.t.ctx.cueView_(b.reqs()[0])));
}
function ackGrab() {
  const page = cuePage(), grab = name => { const a = page.indexOf('  function ' + name + '('); return a < 0 ? '' : page.slice(a, page.indexOf('\n  }\n', a) + 4); };
  const v = page.indexOf('  var AGD_CHK = '), chk = page.slice(v, page.indexOf('] };\n', v) + 5);
  const ctx = { editing: {}, agdRows: {}, agdRowOpen: {}, agdTick: {} }; vm.createContext(ctx);
  vm.runInContext(chk + ['esc', 'agKv', 'agdLabel', 'agdPeso', 'agdTxt', 'agdWhole', 'agdAdded', 'agdAddLine', 'agdSplitLines', 'agdRowsHtml', 'agdCheck', 'agdCkSum', 'agdIntakeHtml', 'agdCheckHtml', 'agdUpdHtml'].map(grab).join('\n'), ctx);
  return ctx;
}
test('ACK1 a check from Canvas is kept clean: Admin or Finance only, its own checks only, amounts as plain decimals, proof as a Drive file ID', () => {
  const t = sandbox({});
  assert.strictEqual(t.ctx.cueAgdHand_({ check: { kind: 'other', rows: [] } }).check, null);
  assert.strictEqual(t.ctx.cueAgdHand_({ summary: 'y' }).check, null);
  const c = t.ctx.cueAgdHand_({ check: { kind: 'finance', rows: [{ check: 'fsa', items: [{}] }, { check: 'invoice', ok: -1, items: [
    { name: 'Lights Co', amount: '12,000', proof: { file_id: ackId + 'P1' } }, { name: 'X', amount: '900.25', proof: { file_id: 'bad"' } }, null] }] } }).check;
  assert.deepStrictEqual(c.rows.map(x => x.check), ['invoice'], 'Finance carries only the invoice check');
  assert.strictEqual(c.rows[0].ok, null); assert.deepStrictEqual([c.rows[0].items[0].amount, c.rows[0].items[1].amount], ['', '900.25'], 'a formatted amount is not guessed');
  assert.deepStrictEqual(JSON.parse(JSON.stringify([c.rows[0].items[0].proof, c.rows[0].items[1].proof])), [{ file_id: ackId + 'P1' }, null]);
});
test('ACK2 Admin check: one row per check with Missing and OK; a row opens to its items; money centred with commas; Mark read and Reply', () => {
  const v = ackView(ackAdmin), ctx = ackGrab(), shut = ctx.agdUpdHtml(v);
  assert.ok(/Agent update · Admin check/.test(shut) && /Admin check · Kings Day/.test(shut) && /class="tag warn">2 missing/.test(shut));
  assert.ok(/2 items are missing something\. Open a row for the details\. Nothing was sent\./.test(shut));
  const heads = (shut.match(/<th>[^<]*<\/th>/g) || []).map(x => x.replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(heads, ['Check', 'Missing', 'OK']);
  assert.ok(/<td>FSAs not signed<\/td><td class="c">1<\/td><td class="c">59<\/td>/.test(shut) && /<td>Suppliers not accredited<\/td><td class="c">0<\/td><td class="c">11<\/td>/.test(shut));
  assert.ok(!/class="agdet"/.test(shut) && /data-act="agd-read"/.test(shut) && /data-act="agd-reply"/.test(shut));
  ctx.agdRowOpen[v.id] = 'ar'; const open = ctx.agdUpdHtml(v);
  assert.strictEqual((open.match(/class="agdet"/g) || []).length, 1);
  assert.ok(/<th>Payee<\/th><th>Scope<\/th><th>Paid<\/th><th>Amount \(₱\)<\/th><th>AR<\/th>/.test(open));
  assert.ok(/<td class="c">18,500\.50<\/td><td class="c"><span class="tag crit">Not signed<\/span><\/td>/.test(open), open);
  ctx.agdRowOpen[v.id] = 'fsa'; assert.ok(/Crew &lt;C&gt;/.test(ctx.agdUpdHtml(v)) && /2,500\.00/.test(ctx.agdUpdHtml(v)));
  ctx.agdRowOpen[v.id] = 'accreditation'; assert.ok(/Nothing missing\./.test(ctx.agdUpdHtml(v)));
});
test('ACK3 Finance check: payments without invoice open to Supplier, Scope, Paid, Amount and a Proof link; nothing missing says All clear', () => {
  const v = ackView({ kind: 'finance', rows: [{ check: 'invoice', ok: 40, items: [{ name: 'Lights Co', scope: 'Stage and lights', date: '12 Nov', amount: '45000', proof: { file_id: ackId + 'P1' } }] }] });
  const ctx = ackGrab(); ctx.agdRowOpen[v.id] = 'invoice'; const html = ctx.agdUpdHtml(v);
  assert.ok(/Finance check · Kings Day/.test(html) && /<td>Payments without invoice<\/td><td class="c">1<\/td><td class="c">40<\/td>/.test(html));
  assert.ok(/<th>Supplier<\/th><th>Scope<\/th><th>Paid<\/th><th>Amount \(₱\)<\/th><th>Proof<\/th>/.test(html) && /45,000\.00/.test(html));
  assert.ok(/<a data-agpic href="https:\/\/drive\.google\.com\/file\/d\/a1b2c3d4e5f6g7h8i9j0P1\/view"/.test(html));
  const clear = ackGrab().agdUpdHtml(ackView({ kind: 'finance', rows: [{ check: 'invoice', ok: 40, items: [] }] }));
  assert.ok(/class="tag good">All clear/.test(clear) && /All clear: nothing is missing\./.test(clear));
});
