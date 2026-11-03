// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: new mail shows only in the main chat.
// Kiko 3 Nov 2026 06:30Z: "the new mails are redundant. only make them appear on the left. if i ask it to do an action that is the
// only time it will show in the threadss". The Threads list (src/IndexThreads.html, listShows) leaves out an email's own chat and a
// new-kind-of-email question until Kiko asks for something in it or another task joins it.
const ML_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
const ML_FN = (() => {
  const a = ML_SRC.indexOf('  var MAIL_ONLY = '), b = ML_SRC.indexOf('  function threadState(th) {');
  assert.ok(a > 0 && b > a, 'listShows sits just above threadState');
  const ctx = {}; vm.runInNewContext(ML_SRC.slice(a, b) + '\nthis.listShows = listShows;', ctx); return ctx.listShows;
})();
const mlTh = (kinds, said) => ({ reqs: kinds.map((k, i) => ({ id: 'r' + i, kind: k, status: 'Needs you' })),
  lines: [{ who: 'Cue', text: 'Ana Cruz · Client\nSubject: Booth' }].concat((said || []).map(t => ({ who: 'Kiko', text: t }))) });

test('ML1 a new email\'s own chat and a new-kind question stay out of the Threads list', () => {
  deq([ML_FN(mlTh(['mail'])), ML_FN(mlTh(['mailtype'])), ML_FN(mlTh(['mailtype'], ['ignore']))], [false, false, false]);
});

test('ML2 a mail chat joins the list once Kiko asks for something in it or another task joins it; a plain "done" does not', () => {
  deq([ML_FN(mlTh(['mail'], ['draft a reply saying yes'])), ML_FN(mlTh(['mail'], ['what did they ask last week?'])), ML_FN(mlTh(['mail', 'email'])), ML_FN(mlTh(['mail', 'intake']))],
    [true, true, true, true]);
  deq([ML_FN(mlTh(['mail'], ['done'])), ML_FN(mlTh(['mail'], ['Ok, done.']))], [false, false]);
});

test('ML3 every other thread is listed as before, and the list and its count both use the same check', () => {
  deq(['intake', 'newmail', 'bids', 'gtask', 'email', 'sweep', 'personal'].map(k => ML_FN(mlTh([k]))), [true, true, true, true, true, true, true]);
  assert.ok(/listShows\(th\[k\]\) && threadState\(th\[k\]\)\.need/.test(ML_SRC), 'the Waiting on you count skips hidden mail chats');
  assert.ok(/\|\| !listShows\(t\)\) return;/.test(ML_SRC), 'the list skips hidden mail chats');
});
