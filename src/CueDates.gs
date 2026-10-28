/* Philippine-time date helpers that many Cue features use.
 * STRUCTURE-PHASE-1 (Kiko 28 Oct 2026 03:47Z, specs/cue-structure-review.md item 1.3): moved here unchanged from the feature
 * file named above each block, so shared helpers live in shared files. Apps Script shares one global space, so no call changed. */

// From CueSweep.gs
const CUE_PH_MS_ = 8 * 3600 * 1000;               // the Philippines is UTC+8 all year (no daylight saving)

/** Philippine date (YYYY-MM-DD) and hour of a moment. */
function cuePh_(ms) { const d = new Date(ms + CUE_PH_MS_); return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes() }; }
/** The moment of hour:00 Philippine time on day (YYYY-MM-DD). */
function cuePhAt_(day, hour) { return Date.parse(day + 'T00:00:00Z') - CUE_PH_MS_ + hour * 3600 * 1000; }
function cueAddDays_(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
/** Adds n working days (Monday to Friday) to a PH day. */
function cueAddWork_(day, n) {
  let d = day;
  for (let i = 0; i < n;) { d = cueAddDays_(d, 1); const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w !== 0 && w !== 6) i++; }
  return d;
}
