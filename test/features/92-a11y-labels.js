// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: accessibility fixes from the 8 Nov 2026
// code review (/mnt/project-files/audits/web-guidelines/2026-11-08-code-review.md, Kiko 8 Nov 2026 "fix them").
/* A11Y-2026-11-08: every form control a person types into or picks from has a label that screen readers announce, and table
 * digits take equal widths so number columns stop shifting. */

const AL_SRC = f => require('fs').readFileSync(require('path').join(__dirname, '..', 'src', f), 'utf8');

test('AL1 the fields the review flagged now carry a label', () => {
  const cards = AL_SRC('IndexCards.html'), pages = AL_SRC('IndexPages.html'), index = AL_SRC('Index.html');
  ['item" placeholder="Item, 6 words" aria-label="Item"', 'spec" placeholder="Spec, 12 words" aria-label="Spec"',
   'quantity" value="1" aria-label="Quantity"', 'days" value="1" aria-label="Days"',
   'add_supplier" placeholder="Add supplier name" aria-label="Add supplier name"', 'add_email" placeholder="their email" aria-label="Supplier email"',
   'data-pick-add="name" placeholder="Add supplier name" aria-label="Add supplier name"', 'data-pick-add="email" placeholder="their email" aria-label="Supplier email"']
    .forEach(s => assert.ok(cards.includes(s), s));
  assert.strictEqual((cards.match(/<select data-f="status" aria-label="Included or optional"/g) || []).length, 2, 'both status pickers');
  assert.strictEqual((cards.match(/<select data-f="execution" aria-label="In house or outsourced"/g) || []).length, 2, 'both execution pickers');
  assert.ok(pages.includes('data-msgr-token placeholder="Paste the Page access token" aria-label="Page access token"'), 'token field');
  assert.ok(index.includes('<input id="ask-in" aria-labelledby="ask-t"'), 'ask box named by its title');
});
test('AL2 no input, select or textarea in the card templates is left without a label', () => {
  const cards = AL_SRC('IndexCards.html');
  const bare = (cards.match(/<(input|select|textarea)\b[^>]*>/g) || [])
    .filter(t => !/aria-label|aria-labelledby|type="(hidden|checkbox|radio|file|button|submit)"|\bhidden\b|\$\{|' \+/.test(t))
    .filter(t => /data-f="(item|spec|quantity|days|add_supplier|add_email|status|execution)"|data-pick-add/.test(t));
  assert.deepStrictEqual(bare, []);
});
test('AL3 table digits use tabular numbers', () => {
  assert.ok(/table :is\(td, th\) \{ font-variant-numeric:tabular-nums; \}/.test(AL_SRC('IndexStyle.html')));
});
