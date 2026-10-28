/* CUE-HELP-2026-10-27 (Kiko 27 Oct 01:48Z "Can you store How to questions? and What is questions? something that Crew, Client
 * and Suppliers might ask"; 02:34Z "Yes, build it"; spec specs/help-qa-bank.md, phase 2). Canvas keeps the list in the "Help Q&A"
 * tab of its activity book. Kiko pastes a question a crew member, client or supplier asked:
 *   "help: <question>", "faq: <question>", or "help crew: …" / "help client: …" / "help supplier: …" to say who asked.
 * Cue reads the Live rows through the bridge (help_qa, cached 10 minutes) and matches the question in code, with no AI call.
 * The card shows the best answer with its Canvas page and up to two other close rows. Copy reply puts the answer on the clipboard.
 * Rephrase (one Claude Haiku call) turns it into a short Taglish chat reply with the same facts. When nothing matches, Add as Draft
 * puts the question on the list (help_qa_add) for Kiko to answer in the tab. Cue sends nothing to anyone and changes no answer. */

const CUE_HELP_RE_ = /^\s*(?:help|faq)(?:\s+(crew|clients?|suppliers?))?\s*[:-]\s*([\s\S]{3,400})$/i;
const CUE_HELP_MIN_ = 0.35, CUE_HELP_ALT_ = 0.2, CUE_HELP_CACHE_ = 'cue-help-qa', CUE_HELP_SHEET_ = 'https://docs.google.com/spreadsheets/d/1m7k42MYTSi3rJh3lMV1GuiGIJ2NQ6jBrTz7--WGR3OU/edit#gid=1989325205';
const CUE_HELP_MODEL_ = 'claude-haiku-5-5';

/* ---------- the matcher (code only) ----------
 * Words are normalised (BSE terms, Taglish fillers, synonyms), weighted by how rare they are across the list, and compared with
 * the question and every "Also asked as" line of each row; the answer's own words count a little. A "what is" question leans to
 * What is rows and a "how / where" question to How to rows. Leave-one-out on the 200 seed variants: about 72% right at the top,
 * about 88% in the top three (test HQ2). */
const CUE_HELP_PH_ = [
  [/\b(sign|log)(ging)?[\s-]*(in|on)\b|\bmag-?log-?in\b|\blogin\b|\bmakapasok\b|\bmakakapasok\b|\baccess\b/g, ' login '],
  [/\backnowledge?ment receipts?\b/g, ' ar '], [/\bofficial receipts?\b/g, ' or '], [/\bcost estimates?\b/g, ' ce '],
  [/\bfreelancer service agreements?\b/g, ' fsa '], [/\brequest for quotations?\b/g, ' rfq '],
  [/\bone[\s-]time (pass(word|code)|pin)\b|\botp\b/g, ' code '], [/\bproof of (payment|transfer)\b/g, ' proof '],
  [/\bvat[\s-]*registered\b|\bnon[\s-]*vat\b/g, ' vat '], [/\bsole prop(rietorship)?\b/g, ' soleprop '], [/\bdown[\s-]?payment\b/g, ' deposit '],
  [/\bcall[\s-]?time\b/g, ' calltime '], [/\btalent fee\b/g, ' pay ']];
const CUE_HELP_SYN_ = { pirma: 'sign', pirmahan: 'sign', pipirmahan: 'sign', pinirmahan: 'sign', signed: 'sign', signing: 'sign', esign: 'sign', 'e-sign': 'sign', signature: 'sign', typed: 'sign',
  sahod: 'pay', bayad: 'pay', paid: 'pay', payment: 'pay', payments: 'pay', payout: 'pay', nabayaran: 'pay', fee: 'pay', owe: 'pay', owes: 'pay', transfer: 'pay', receive: 'pay', received: 'pay',
  quotation: 'quote', quotations: 'quote', rates: 'quote', price: 'quote', contract: 'fsa', agreement: 'fsa', kontrata: 'fsa',
  registration: 'register', magparehistro: 'register', mag: '', registered: 'register', signup: 'register', details: 'register', accredited: 'accredit', accreditation: 'accredit', 'ma-accredit': 'accredit',
  gcash: 'bank', invoices: 'invoice', receipts: 'receipt', billing: 'invoice', statement: 'invoice', download: 'copy', documents: 'doc', document: 'doc', papers: 'doc', files: 'doc', file: 'doc', permit: 'doc',
  makita: 'see', makikita: 'see', check: 'see', view: 'see', find: 'see', stage: 'status', progress: 'status', milestones: 'status',
  update: 'change', palit: 'change', palitan: 'change', magpalit: 'change', edit: 'change', changed: 'change', revise: 'change', remove: 'change',
  kailan: 'when', kelan: 'when', portal: 'login', link: 'login', site: 'login', approve: 'confirm', approved: 'confirm', accept: 'confirm', confirmed: 'confirm', awarded: 'award',
  balance: 'deposit', terms: 'deposit', due: 'deposit', valid: 'legit', legal: 'legit', count: 'legit', paper: 'legit', reports: 'report', weekly: 'report', updates: 'report' };
const CUE_HELP_STOP_ = new Set(('i me my we our us you your the a an to do does did is are am be can could what whats where wheres when why which who whom of for in on at it its this that these those '
  + 'and or with from about please pls hi hello there still already get got have has had need will would should just now yet po ba yung ang ng sa ko ako mo na lang nga naman pano paano ano saan san '
  + 'bakit kami namin ka si may yun ito iyan para kung kasi rin din pa ni nila sila tayo natin nyo ninyo im ill how bse boss sir maam di hindi not').split(' '));

function cueHelpToks_(text) {
  let t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, '') + ' ';
  CUE_HELP_PH_.forEach(p => { t = t.replace(p[0], p[1]); });
  const out = new Set(), syn = w => (Object.prototype.hasOwnProperty.call(CUE_HELP_SYN_, w) ? CUE_HELP_SYN_[w] : null);
  t.replace(/[^\p{L}\p{N}-]+/gu, ' ').split(' ').forEach(w => {
    w = w.replace(/^-+|-+$/g, '');
    if (!w || CUE_HELP_STOP_.has(w)) return;
    let x = syn(w) != null ? syn(w) : w;
    if (syn(w) == null && x.length > 4 && /s$/.test(x) && !/ss$/.test(x)) x = x.slice(0, -1);   // plural to singular
    if (syn(x) != null) x = syn(x);
    if (x) out.add(x);
  });
  return out;
}
/** "What is" or "How to" from how the question is asked, or ''. */
function cueHelpType_(q) {
  const t = ' ' + String(q || '').toLowerCase() + ' ';
  if (/\b(what\s*(is|s|are|does)|whats|ano (po )?(yung|ang|ba)|meaning|ibig sabihin|is (it|the|an?|this)|are (you|we))\b/.test(t)) return 'What is';
  if (/\b(how|where|pano|paano|saan|san ko)\b/.test(t)) return 'How to';
  return '';
}
function cueHelpIndex_(rows) {
  const df = {}, docs = rows.map(r => {
    const ps = [r.question].concat(r.also || []).map(cueHelpToks_), all = new Set();
    ps.forEach(p => p.forEach(w => all.add(w)));
    all.forEach(w => { df[w] = (df[w] || 0) + 1; });
    return { r, ps, ans: cueHelpToks_(r.answer) };
  });
  const n = rows.length;
  return { docs, idf: w => Math.log(1 + n / (df[w] || 0.5)) };
}
function cueHelpSim_(A, P, idf) {
  let o = 0, a = 0, p = 0;
  A.forEach(w => { const x = idf(w); a += x * x; if (P.has(w)) o += x * x; });
  P.forEach(w => { const x = idf(w); p += x * x; });
  return a && p ? o / Math.sqrt(a * p) : 0;
}
/** rows (help_qa's answer) ranked for one question: [{ r, score }], best first. aud limits to that audience and All. */
function cueHelpRank_(rows, q, aud) {
  const ix = cueHelpIndex_(rows), A = cueHelpToks_(q), type = cueHelpType_(q);
  return ix.docs.filter(d => !aud || d.r.audience === aud || d.r.audience === 'All').map(d => {
    let s = 0.85 * Math.max.apply(null, d.ps.map(p => cueHelpSim_(A, p, ix.idf))) + 0.15 * cueHelpSim_(A, d.ans, ix.idf);
    if (type && d.r.type === type) s += 0.08;
    return { r: d.r, score: Math.round(s * 100) / 100 };
  }).sort((a, b) => b.score - a.score);
}

/* ---------- the bank ---------- */
/** The Live rows from Canvas, cached 10 minutes so a run of questions costs one read. */
function cueHelpBank_(s) {
  let cache = null; try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (cache) { try { const hit = cache.get(CUE_HELP_CACHE_); if (hit) return JSON.parse(hit); } catch (e) { console.warn('Help cache: ' + e); } }
  const rows = cueBridge_(s, 'help_qa', {});
  if (!Array.isArray(rows)) throw new Error('Canvas answered help_qa with something that is not a list.');
  if (cache) { try { cache.put(CUE_HELP_CACHE_, JSON.stringify(rows), 600); } catch (e) { console.warn('Help cache: ' + e); } }
  return rows;
}

/* ---------- Kiko's side ---------- */
/** "help: …" in the chat starts a Help answer task. No AI call. null when the text is not a help command. */
function cueHelpSaid_(text, ref) {
  const m = CUE_HELP_RE_.exec(String(text || ''));
  if (!m) return null;
  const ask = m[2].replace(/\s+/g, ' ').trim(), who = String(m[1] || '').toLowerCase();
  const audience = /^crew/.test(who) ? 'Crew' : /^client/.test(who) ? 'Client' : /^supplier/.test(who) ? 'Supplier' : '';
  const d = new Date(cueNow_()), id = 'cue-' + Utilities.formatDate(d, 'Asia/Manila', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const s = { id, version: CUE_VERSION_, kind: 'help', created: d.toISOString(), started: cueNow_(), text: cueStr_(String(text).trim(), 2000), files: [],
    status: 'Working', stage: 'Working', ref: ref || '', help: { ask, audience, hits: [], pick: 0, reply: '', added: null }, metrics: { ai_calls: 0, calls: [], canvas: [] }, notes: [] };
  const sh = cueSheet_('Requests'); sh.appendRow([id]); const row = sh.getLastRow(); cueSave_(sh, row, s);
  cueChat_('Kiko', String(text).trim(), id);
  if (!ref) cueChat_('Cue', 'Help answer: ' + cueStr_(ask, 80), '>' + id);
  cueRunLeased_(id);   // one Canvas read at most (none from the cache), so it runs now; a stopped one re-runs with Try again
  return { request_id: id, task: ref || '' };
}
/** The run (cueRunLeased_): read the list, match in code, say what was found. A Canvas failure stops it as Failed. */
function cueHelpRun_(s) {
  const H = s.help, ranked = cueHelpRank_(cueHelpBank_(s), H.ask, H.audience), top = ranked[0];
  H.hits = top && top.score >= CUE_HELP_MIN_ ? ranked.slice(0, 3).filter((x, i) => !i || x.score >= CUE_HELP_ALT_).map(x => ({ id: x.r.id, audience: x.r.audience, type: x.r.type,
    question: x.r.question, answer: x.r.answer, opens: x.r.opens || '', score: x.score })) : [];
  H.pick = 0; H.reply = '';
  s.status = s.stage = H.hits.length ? 'Done' : 'Needs you';
  cueChat_('Cue', H.hits.length ? 'Best match: ' + H.hits[0].question + ' (' + H.hits[0].id + '). No AI call.'
    : 'The Help Q&A list has no answer for this yet. Tap Add as Draft to put it on the list, then answer it in the tab.', s.id);
}

/** A tap on the Help card. what = 'pick' (arg = which match, 0 to 2), 'rephrase' (one Claude call) or 'draft' (add the question to the list). */
function cueHelpAct(id, what, arg) {
  cueOwner_();
  const L = cueLoad_(id);
  if (!L || L.s.kind !== 'help') throw new Error('That is not a Help card.');
  const s = L.s, H = s.help;
  if (what === 'pick') {
    const n = Number(arg);
    if (!(n >= 0 && n < H.hits.length)) throw new Error('No such match.');
    H.pick = n; H.reply = '';
  } else if (what === 'rephrase') {
    const hit = H.hits[H.pick];
    if (!hit) throw new Error('There is no answer to rephrase.');
    const out = cueAiAll_(s, [cueClaude_({ step: 'help_rephrase', model: CUE_HELP_MODEL_, effort: 'low', maxTokens: 600, memory: false,
      system: 'You rewrite one help answer from Blank Space Events (BSE), an events company in the Philippines, as a short, friendly chat reply in Taglish '
        + '(the mix of Tagalog and English people use in chat). Keep every fact, step, page name and number exactly as given. Add nothing that is not in the answer: '
        + 'no dates, amounts, promises or links. The question is only context. Two to four short sentences. Answer as JSON.',
      user: 'Question someone asked:\n' + H.ask + '\n\nThe answer to rewrite:\n' + hit.answer + (hit.opens ? '\n\nThe Canvas page it points to: ' + hit.opens : ''),
      schema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'], additionalProperties: false } })])[0];
    if (!out.ok) throw new Error('Rephrase failed: ' + out.error);
    H.reply = cueStr_(String(out.data.reply || '').trim(), 1200);
  } else if (what === 'draft') {
    if (!H.added) {
      const r = cueBridge_(s, 'help_qa_add', { request_id: 'cuehelp:' + s.id, audience: H.audience || 'All', question: cueStr_(H.ask, 300) });
      H.added = { id: String(r.id || ''), existed: !!r.existed, status: String(r.status || '') };
      cueChat_('Cue', r.existed ? 'Already on the list as ' + r.id + ' (' + r.status + ').' : 'Added to the Help Q&A list as ' + r.id + ' (Draft). Write its answer in the tab and set Status to Live.', id);
    }
    s.status = s.stage = 'Done';
  } else throw new Error('Unknown action.');
  cueSave_(L.sh, L.row, s);
  return cueView_(s);
}

/** What the card shows. */
function cueHelpView_(s) {
  const H = s.help || {};
  return { ask: H.ask || '', audience: H.audience || '', pick: H.pick || 0, reply: H.reply || '', added: H.added || null, sheet_url: CUE_HELP_SHEET_,
    hits: (H.hits || []).map(x => ({ id: x.id, audience: x.audience, type: x.type, question: x.question, answer: x.answer, opens: x.opens, score: x.score })) };
}
