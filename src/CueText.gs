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

// From CueChange.gs
const cueTerm_ = t => String(t || '').replace(/[^\p{L}\p{N} .&'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
