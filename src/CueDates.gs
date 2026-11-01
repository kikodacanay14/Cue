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
/* CUE-TEMPLATES-2026-10-31 (spec part 2: "All times are in business days. Weekends and Philippine holidays are skipped"): the fixed
 * national holidays Cue knows. Script Property CUE_HOLIDAYS (YYYY-MM-DD, comma-separated) adds the ones proclaimed each year (Holy Week, National
 * Heroes Day, Eid, extra special days). */
const CUE_PH_HOLIDAYS_ = ['2026-11-30', '2026-12-08', '2026-12-24', '2026-12-25', '2026-12-30', '2026-12-31', '2027-01-01', '2027-04-09',
  '2027-05-01', '2027-06-12', '2027-08-21', '2027-11-01', '2027-11-30', '2027-12-08', '2027-12-25', '2027-12-30', '2027-12-31'];
function cueHoliday_(d) {
  if (!globalThis.CUE_HOLIDAY_SET_) { const m = {}; CUE_PH_HOLIDAYS_.concat(String(cueProp_('CUE_HOLIDAYS', '')).split(/[,\s]+/)).forEach(x => { if (/^\d{4}-\d{2}-\d{2}$/.test(x)) m[x] = 1; }); globalThis.CUE_HOLIDAY_SET_ = m; }
  return !!globalThis.CUE_HOLIDAY_SET_[d];
}
/** True for Monday to Friday that is not a Philippine holiday. */
function cueWorkday_(d) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w !== 0 && w !== 6 && !cueHoliday_(d); }
/** Adds n working days (Monday to Friday, holidays skipped) to a PH day. */
function cueAddWork_(day, n) {
  let d = day;
  for (let i = 0; i < n;) { d = cueAddDays_(d, 1); if (cueWorkday_(d)) i++; }
  return d;
}
