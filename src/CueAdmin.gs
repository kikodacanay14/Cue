/* CUE-ADMIN-2026-10-29 (Kiko 29 Oct 02:13Z "all the Cue admin stuff system config and app settings ... a separate page?";
 * 02:16Z "cue.blankspaceevent.com"; 02:17Z "On a separate page"; 02:42Z "yes" to previews/admin-settings/cue-admin-page.png).
 * Epic Cue #193. Cue Admin is the page doGet serves for ?view=admin: the Settings sections as one full page in Canvas's look.
 * This file holds the two sections that are new on it:
 *   - Triage rules (story #195): the rows of the Triage rules tab, and Remove for one row. The rules themselves work as before
 *     (CueTriage.gs reads the tab on each run).
 *   - Release notes (story #196): the newest rows of the Release Notes tab (CueRelnotes.gs), read only. */

const CUE_ADMIN_RN_MAX_ = 30;

/** This deployment's address; the chat's Settings button opens it with ?view=admin (story #197). */
function cueAdminAppUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

const cueAdminDay_ = v => { const t = v instanceof Date ? v.getTime() : Date.parse(String(v || '')); return isNaN(t) ? String(v || '') : cueRnDay_(cuePh_(t).day); };

/** Triage rules, newest first: { sender, rule, set, why, key }. key names the row for cueAdminTriageDel. */
function cueAdminTriage() {
  cueOwner_();
  return cueTriageTab_('Triage rules').map(r => ({ sender: String(r[0] || '').trim(), rule: String(r[1] || ''), set: cueAdminDay_(r[2]), why: String(r[3] || ''),
    key: String(r[0] || '').trim().toLowerCase() + '|' + (r[2] instanceof Date ? r[2].getTime() : String(r[2] || '')) }))
    .filter(x => x.sender).reverse();
}

/** Removes the Triage rules row named by key (sender and the time it was set), then returns the list again. */
function cueAdminTriageDel(key) {
  cueOwner_();
  const sh = cueSheet_('Triage rules'), n = sh.getLastRow() - 1;
  if (n > 0) {
    const rows = sh.getRange(2, 1, n, 3).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i], k = String(r[0] || '').trim().toLowerCase() + '|' + (r[2] instanceof Date ? r[2].getTime() : String(r[2] || ''));
      if (k === String(key || '')) { sh.deleteRow(i + 2); break; }
    }
  }
  return cueAdminTriage();
}

/** Release notes, newest first: { day, app, release, outcome, ann }. */
function cueAdminRelnotes() {
  cueOwner_();
  const sh = cueRnSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, CUE_RN_HEAD_.length).getValues().reverse().slice(0, CUE_ADMIN_RN_MAX_)
    .map(r => ({ day: cueAdminDay_(r[4] || r[3]), app: String(r[1] || ''), release: String(r[2] || ''), outcome: String(r[6] || ''), ann: String(r[7] || '') }));
}
