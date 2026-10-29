// Part of test/cue.test.js, loaded in file-name order into one shared scope. Feature: client-accreditation.
// CLIENT-ACCRED-THREADS-2026-10-29 (Kiko 29 Oct 16:14Z "any reply for accreditation shows there as well", "accreditation threads";
// 17:24Z picked "P4 companies + accreditation words"): one Ask Cue thread per company, each new reply one line with a link to the email.
const AC_P0 = [
  { _row: 5, Priority: 'P4', Company: 'Concentrix', 'Contact Count': '2', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 6, Priority: 'P4', Company: 'Solo Co', 'Contact Count': '1', 'Last Outreach Date': '', 'Reply Status': '' },
  { _row: 7, Priority: 'P2', Company: 'QBE', 'Contact Count': '1', 'Last Outreach Date': '', 'Reply Status': '' }];
const AC_CONTACTS = [
  { _row: 2, Company: 'Concentrix', 'Email Address': 'Ana.Cruz@concentrix.com' },
  { _row: 3, Company: 'Concentrix', 'Email Address': 'ops@concentrix.com' },
  { _row: 4, Company: 'Solo Co', 'Email Address': 'solo.owner@gmail.com' },
  { _row: 5, Company: 'QBE', 'Email Address': 'vendor.team@qbe.com' },
  { _row: 6, Company: 'Staff', 'Email Address': 'mariana@example.com' }];
const AC_ALLOW = [
  { book: 'priority', tab: 'P0', key: '', mode: 'read', columns: ['Priority', 'Company', 'Contact Count', 'Last Outreach Date', 'Reply Status'], writable: [], rows: AC_P0 },
  { book: 'priority', tab: 'P0 Contacts', key: '', mode: 'read', columns: ['Company', 'Email Address'], writable: [], rows: AC_CONTACTS }];
const AC_MAIL = [
  { id: 'a1', thread: '18f0a1b2c3d4e5f6', from: 'Ana Cruz <ana.cruz@concentrix.com>', subject: 'Re: Vendor documents', body: 'Please send your BIR 2303 and Mayor\'s Permit.', date: '2026-10-21T01:00:00Z' },
  { id: 'a2', thread: '18f0a1b2c3d4e5f7', from: '"QBE Vendor Team" <vendor.team@qbe.com>', subject: 'Supplier registration: next step', body: 'Your vendor enrolment form is approved.', date: '2026-10-21T02:00:00Z' },
  { id: 'a3', thread: '18f0a1b2c3d4e5f8', from: 'Mariana <mariana@example.com>', subject: 'Accreditation docs', body: 'Internal note.', date: '2026-10-21T03:00:00Z' }];
const acRun = (o = {}) => { const t = sandbox(Object.assign({ allow: AC_ALLOW, cecMail: AC_MAIL }, o)); return { t, n: t.ctx.cueAcRun_() }; };
const acThreads = t => t.tabs.Requests.rows.slice(1).map(r => JSON.parse(r.slice(10, 14).join(''))).filter(s => s.kind === 'accred');

test('AC1 the search follows Kiko\'s pick: P4 companies by domain (a personal address by itself) or the accreditation words; never Kiko, BSE staff or a P2 domain', () => {
  const { ctx } = sandbox();
  const C = ctx.cueAcCompanies_(AC_P0, AC_CONTACTS, 'example.com');
  deq([C.p4.domains, C.p4.emails], [['concentrix.com'], ['solo.owner@gmail.com']]);
  const q = ctx.cueAcQuery_(C);
  assert.ok(/^newer_than:3d -from:me -in:drafts -in:chats \{subject:\(accreditation OR accredited OR "vendor registration" OR "supplier registration" OR "vendor enrollment" OR "vendor enrolment"\) from:\(@concentrix\.com OR solo\.owner@gmail\.com\)\}$/.test(q), q);
  deq(ctx.cueAcCompanyOf_(C, 'vendor.team@qbe.com', 'example.com'), { key: 'qbe', name: 'QBE', p: 'P2' }, 'a P2 company still names its thread when the subject has the words');
  deq(ctx.cueAcCompanyOf_(C, 'someone@newco.ph', 'example.com'), { key: 'newcoph', name: 'newco.ph', p: '' }, 'an unknown sender: its domain');
  assert.strictEqual(ctx.cueAcCompanyOf_(C, 'mariana@example.com', 'example.com'), null, 'BSE staff');
});

test('AC2 one run posts each reply once into its company\'s thread, waiting on Kiko, with a link to the email; staff mail is logged and skipped; nothing is sent', () => {
  const { t, n } = acRun();
  assert.strictEqual(n, 2);
  assert.ok(/from:\(@concentrix\.com OR solo\.owner@gmail\.com\)/.test(t.log.cecQ), t.log.cecQ);
  const T = acThreads(t);
  deq(T.map(s => [s.text, s.status, s.acc.p, s.acc.items.length]), [['Accreditation · Concentrix', 'Needs you', 'P4', 1], ['Accreditation · QBE', 'Needs you', 'P2', 1]]);
  const a = T[0].acc.items[0];
  deq([a.who, a.subject, a.url], ['Ana Cruz', 'Re: Vendor documents', 'https://mail.google.com/mail/?authuser=kiko%40example.com#all/18f0a1b2c3d4e5f6']);
  assert.strictEqual(T[1].acc.items[0].who, 'QBE Vendor Team');
  deq(t.tabs['Accreditation Mail'].rows.slice(1).map(r => [r[1], r[2]]), [['a1', 'Concentrix'], ['a2', 'QBE'], ['a3', 'BSE staff (skipped)']]);
  assert.strictEqual((t.log.sent || []).length, 0);
  // The second run finds the same emails already posted.
  assert.strictEqual(t.ctx.cueAcRun_(), 0); assert.strictEqual(acThreads(t).length, 2);
});

test('AC3 a later reply joins the same thread newest first and reopens it after Done; the view marks only replies after Done as new', () => {
  const mail = AC_MAIL.slice(0, 1);
  const { t } = acRun({ cecMail: mail });
  const id = acThreads(t)[0].id;
  const v = t.ctx.cueAcDone(id);
  deq([v.status, v.acc.company, v.acc.p, v.acc.items.map(x => x.fresh)], ['Done', 'Concentrix', 'P4', [false]]);
  assert.ok(/\?page=clientdesk&q=Concentrix$/.test(v.acc.accounts_url), v.acc.accounts_url);
  mail.push({ id: 'a4', thread: '18f0a1b2c3d4e5f9', from: 'ops@concentrix.com', subject: 'Re: Vendor documents', body: 'Received, thank you.', date: '2026-10-21T05:00:00Z' });
  assert.strictEqual(t.ctx.cueAcRun_(), 1);
  const s = acThreads(t); assert.strictEqual(s.length, 1, 'same company, same thread');
  deq([s[0].status, s[0].acc.items.map(x => x.id)], ['Needs you', ['a4', 'a1']]);
  const w = t.ctx.cueView_(s[0]);
  deq(w.acc.items.map(x => [x.who, x.fresh]), [['ops@concentrix.com', true], ['Ana Cruz', false]]);
});

test('AC4 the 5-minute job runs it every 30 minutes, never in a cloud check; the page draws one card with the replies, Open Accounts and Done', () => {
  const { t } = acRun({ cecMail: [], props: { CUE_AC_AT: '0' } });
  assert.ok(t.ctx.cueJobs_().some(j => j.fn === 'cueAcTick_' && j.job === 'Client accreditation mail'));
  assert.strictEqual(t.ctx.cueAcTick_(), 0); assert.strictEqual(t.ctx.cueAcTick_(), null, 'not due again for 30 minutes');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexPages.html'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'src', 'IndexThreads.html'), 'utf8');
  assert.ok(/function acCardHtml\(r\)/.test(page) && /r\.kind === 'accred' && r\.acc\) h \+= acCardHtml\(r\)/.test(page));
  assert.ok(/Open Accounts in Canvas/.test(page) && /data-act="ac-done"/.test(page) && /Open email/.test(page));
});
