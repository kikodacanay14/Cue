/* Small text and number helpers that many Cue features use.
 * STRUCTURE-PHASE-1 (Kiko 28 Oct 2026 03:47Z, specs/cue-structure-review.md item 1.3): moved here unchanged from the feature
 * file named above each block, so shared helpers live in shared files. Apps Script shares one global space, so no call changed. */

// From CueIntake.gs
const cueStr_ = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
const cueR2_ = n => Math.round((Number(n) || 0) * 100) / 100;
const cuePos_ = v => (Number(v) > 0 && isFinite(Number(v)) ? Math.min(Number(v), 1e6) : 1);
const cueName_ = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cueEmail_ = e => (/^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,190}\.[a-z]{2,}$/i.test(String(e || '').trim()) ? String(e).trim() : '');
const CUE_DATE_RE_ = /^\d{4}-\d{2}-\d{2}$/;

// CUE-CONTACT-FIND-2026-10-30 (Kiko 30 Oct 03:33Z "teach Cue now how to find contacts! what the format of an email address is!!").
// An email address is local@domain.tld: the local part is 1 to 64 of letters, digits and . _ % + - ' (no dot at either end, no
// two dots in a row); the domain is labels of letters, digits and - (no - at either end of a label) joined by single dots, ending
// in a top-level domain of 2 or more letters (.com, .ph, .com.ph). No spaces, commas, quotes or angle brackets anywhere.
// cueEmailClean_ takes what people paste or what a header holds ("Ana Reyes <Ana@Acme.com.ph>", "mailto:ana@acme.com.ph?subject=x",
// "<ana@acme.com.ph>,") and returns the bare address in lower case, or '' when what is left is not an address.
const CUE_EMAIL_RE_ = /^(?!\.)(?!.*\.\.)[a-z0-9._%+'-]{1,64}(?<!\.)@(?=.{4,190}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}$/i;
function cueEmailClean_(v) {
  let t = String(v == null ? '' : v).trim();
  const br = t.match(/<([^<>]*)>/); if (br) t = br[1];                     // a display name: keep only the part in angle brackets
  t = t.replace(/^mailto:/i, '').replace(/[?#].*$/, '').replace(/^["'(\[\s]+|["')\].,;:\s]+$/g, '');
  return CUE_EMAIL_RE_.test(t) ? t.toLowerCase() : '';
}
/** Every address in a free text (a header, a signature line, a pasted list), cleaned, in order, each once. */
function cueEmailsIn_(text) {
  const out = [];
  (String(text || '').match(/[^\s<>()\[\],;:"]+@[^\s<>()\[\],;:"]+/g) || []).forEach(x => { const e = cueEmailClean_(x); if (e && out.indexOf(e) < 0) out.push(e); });
  return out;
}
/** A To or Cc line of one or more addresses ("a@x.com, Ana <b@y.ph>"): the clean addresses joined by ", ", or '' when any part is not one. */
function cueEmailList_(v) {
  const parts = String(v || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
  const ok = parts.map(cueEmailClean_);
  return parts.length && ok.every(Boolean) ? ok.filter((e, i) => ok.indexOf(e) === i).join(', ') : '';
}

// From CueChange.gs
const cueTerm_ = t => String(t || '').replace(/[^\p{L}\p{N} .&'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
