/* CUE-CLOUD-CHECK-2026-10-27, release line only. The live line (1.27.x) has no AI relay, so it has no doPost; this one answers
 * only the check door (CueCheck.gs). Everywhere but the one "Cue check" version CUE_CHECK_FP_ is empty, so it refuses every
 * call, and live /exec stays Google sign-in only (its manifest is MYSELF). When the relay (CueRelay.gs, which has its own
 * doPost with the same check routing) reaches this line, delete this file: Apps Script must have only one doPost. */
function doPost(e) {
  let out;
  try {
    let q = null; try { q = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (x) { q = null; }
    out = cueCheckDoor_(q);
  } catch (x) { console.error('Check door: ' + x); out = { ok: false, error: 'Cue could not do that just now. Try again in a minute.' }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
