// Cloud check for Cue 1.27.40 chaser fixes (PR #117): the robot runs the chasing sweep on the check link and reads the batch card.
// RFQ chasers must not list BSE's own supplier applications (accreditation, vendor or supplier registration, procurement process),
// no line may go To a no-reply address, and no accreditation email may ask for an account number or account name. The robot never
// presses Approve and send or Drafts only: it closes the batch without sending. Check mode keeps the sweep read-only (no sweep day,
// no Chase log, no Canvas posted-hook) and refuses any Gmail draft or send anyway.
const NO_REPLY = e => { const a = String(e || '').toLowerCase(), local = a.split('@')[0], dom = a.split('@')[1] || '';   // copy of cueNoReply_
  return /^(no-?reply|do-?not-?reply|do_not_reply|donotreply|mailer-daemon|postmaster|bounces?|notifications?|notification-service|message-service|auto-?reply)([+._-].*)?$/.test(local)
    || /(^|\.)(sender|bounces?|mailer|notifications?)\./.test(dom) || /(^|\.)zohoinvoice\.com$/.test(dom); };
const APPLICATION = /accredit|\b(vendor|supplier)\s+(registration|enrol?ment|onboarding)\b|procurement process/i;   // cueRfqNotRfq_
const ASKS_ACCOUNT = /\b(account|acct)\.?\s*(number|no\b|no\.|num\b|#)|\baccount\s+name\b|\bacct\b/i;               // cueAccrAsksAccount_

// The batch's lines as Cue gave them to the page (cueState, a read): [{ kind, text, to, body }]. The card shows To only on lines that
// name a project, so the To and the email come from the state the card is drawn from, not from the card's text.
const lines = h => h.page().evaluate(() => new Promise((ok, bad) => google.script.run.withSuccessHandler(st => {
  const b = (st.requests || []).filter(r => r.kind === 'sweep' && r.batch).sort((x, y) => String(y.created).localeCompare(String(x.created)))[0];
  ok(b ? b.batch.items.map(it => ({ kind: it.label, text: [it.project, it.who, it.subject, it.summary].filter(Boolean).join(' · '),
    to: String(it.to || '').split(/[,;\s]+/).filter(e => /@/.test(e)), body: String(it.body || '') })) : null);
}).withFailureHandler(e => bad(e)).cueState()));

export default {
  name: '1.27.40 chasers (RFQ skips supplier applications; accreditation skips no-reply, never asks for an account number)',
  steps: [
    { title: 'Run the chasing sweep: Cue finds the lines and words them (one AI call)', run: async h => {
      await h.say('run the chasing sweep now');
      const said = await h.see(/Morning batch is ready: [^\n]+|Morning sweep: nothing to chase today\.[^\n]*/, 600000);
      h.quiet = /nothing to chase/.test(said);
      console.log('     ' + said);
      const broke = said.match(/(RFQ chasers|Accreditation chasers): could not check \([^)]*\)/);
      if (broke) throw new Error(broke[0] + ': the check cannot say anything about this kind');
      if (h.quiet) return 'SKIP: nothing to chase today, so there is no card to read; the sweep itself ran clean';
    } },
    { title: 'Open the batch: lines grouped by kind, nothing ticked was sent', run: async h => {
      if (h.quiet) return 'SKIP: no batch';
      await h.page().getByText(/^\s*Morning batch \d\d\/\d\d\s*$/).first().click();   // a thread's name opens it
      await h.see('Approved emails go out at 9:00.', 60000);
      h.lines = await lines(h);
      if (!h.lines) throw new Error('the batch card did not show');
      const by = {}; h.lines.forEach(l => { by[l.kind] = (by[l.kind] || 0) + 1; });
      console.log('     lines: ' + (Object.keys(by).map(k => by[k] + ' ' + k).join(', ') || 'none'));
      await h.notSee(/\bsent\b.*\bin Drafts\b|in Drafts/, 1000);
    } },
    { title: 'RFQ chasers: no BSE supplier application (accreditation, vendor registration, procurement process)', run: async h => {
      if (h.quiet) return 'SKIP: no batch';
      const rfq = h.lines.filter(l => l.kind === 'RFQ chasers');
      const bad = rfq.filter(l => APPLICATION.test(l.text + ' ' + l.body));
      if (bad.length) throw new Error('chased as an RFQ: ' + bad.map(l => l.text.trim().slice(0, 120)).join(' | '));
      if (!rfq.length) return 'SKIP: no RFQ chasers today; nothing was wrongly listed, but there was nothing to read';
    } , stopOnFail: false },
    { title: 'No line goes To a no-reply address (no-reply, bounce, an invoicing app\'s sender)', run: async h => {
      if (h.quiet) return 'SKIP: no batch';
      const bad = h.lines.filter(l => l.to.some(NO_REPLY));
      if (bad.length) throw new Error('To a no-reply address: ' + bad.map(l => l.kind + ': ' + l.to.join(', ')).join(' | '));
    } , stopOnFail: false },
    { title: 'Accreditation chasers never ask for an account number or account name', run: async h => {
      if (h.quiet) return 'SKIP: no batch';
      const accr = h.lines.filter(l => l.kind === 'Accreditation chasers');
      const bad = accr.filter(l => ASKS_ACCOUNT.test(l.body));
      if (bad.length) throw new Error('asks for an account number or name: ' + bad.map(l => l.text.trim().slice(0, 80)).join(' | '));
      if (!accr.length) return 'SKIP: no accreditation chasers today';
    } , stopOnFail: false },
    { title: 'Close without sending: no draft made, nothing sent', run: async h => {
      if (h.quiet) return 'SKIP: no batch to close';
      const before = h.calls().length;
      await h.tap(/^\s*(Close without sending|Got it)\s*$/);
      for (let i = 0; i < 60 && h.calls().length === before; i++) await h.wait(500);
      if (h.calls().some(f => f === 'cueApprove' || f === 'cueSweepItem')) throw new Error('the page asked Cue to approve or change a line');
      await h.notSee(/Approved\. Sending at|in Drafts/, 5000);
    } }
  ]
};
