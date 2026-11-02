/* ACC-12 to ACC-15 part 3 (Kiko 2 Nov 2026, cloud chat "Ask Cue changes": "have you Cue to be allowed in modifying fields for contact
 * and clients, projects, suppliers and freelancers"; Q5 "A. Allow edit of supplier bank details. yes to others"; round 1 Q2 "Cue can
 * propose i will approve"; Q6 "Yes" to the bank warning; round 3 Q3 "A"; assumptions 13 and 21). Spec: CanvasWorkspace
 * docs/specs/ask-cue-changes-spec.md. The edit itself is CueEdit.gs (generic bridge write_rows after Kiko's approve). This file adds:
 *   - the lock list Cue checks before any card (R2), on top of Canvas's own never-lists;
 *   - typed answers: Kiko types "approve" or "not" for an Approve question, with no buttons in Ask Cue chat (his screen 1 note);
 *   - the Canvas edits log (Cue sheet tab) and Undo from Cue Admin › Edit log, which opens an Approve question like any edit;
 *   - the supplier bank warning helper (R3, a warning only). */

// R2: never edited by Cue, even with Kiko's approve. Supplier bank details (Supplier Database Main) are the one exception (Q5).
const CUE_ED_LOCK_RE_ = /\btin\b|accredit|verification|government|gov(?:t|ernment)?\.?\s*id|e-?sign|signature|password|passcode|\brole\b|approv|status|award|book(?:ed|ing)\b|\bpaid\b|payment|card\s*(?:no|num)|iban|swift|routing|\bpin\b|secret|token/i;
const CUE_ED_BANK_RE_ = /bank|account\s*(?:name|no|num|#)|accountnumber/i;
const CUE_ED_LOCK_SAY_ = 'It stays locked, along with accreditation, TIN, status, award, booking and payment fields, government ID, e-signature, '
  + 'freelancer bank details, passwords, roles and approvals.';
const cueEdSupplierMain_ = (book, tab) => String(book).toLowerCase() === 'suppliers' && String(tab).toLowerCase() === 'main';

/** True when Cue must not edit this column (R2). */
function cueEdLocked_(book, tab, column) {
  const c = String(column || '');
  if (CUE_ED_LOCK_RE_.test(c)) return true;
  return CUE_ED_BANK_RE_.test(c) && !cueEdSupplierMain_(book, tab);
}
/** The supplier bank columns an edit touches (they get the R3 warning). */
function cueEdBankCols_(o) { return cueEdSupplierMain_(o.book, o.tab) ? Object.keys(o.set || {}).filter(c => CUE_ED_BANK_RE_.test(c)) : []; }

/** ACC-15: one row per changed column in the Canvas edits tab, after Canvas saved it. */
function cueEdLog_(o, now) {
  try {
    const sh = cueSheet_('Canvas edits'), t = new Date(cueNow_());
    // Whole values (up to the edit limit), so Undo puts back exactly what was there; the Edit log shortens them only on screen.
    Object.keys(o.set || {}).forEach(c => sh.appendRow([t, o.book, o.tab, o.keycol || '', o.key, c, o.add ? '' : cueStr_((o.was || {})[c], CUE_EDIT_MAX_.value),
      cueStr_(now && now[c] != null ? now[c] : o.set[c], CUE_EDIT_MAX_.value), o.undo ? 'undo of ' + o.undo : 'approved by Kiko']));
  } catch (e) { console.warn('Canvas edits log: ' + e); }
}

/** Cue Admin › Edit log: the newest edits first. n = the sheet row, used by Undo. */
function cueAdminEdits() {
  cueOwner_();
  const sh = cueSheet_('Canvas edits'), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 9).getValues().map((r, i) => ({ n: i + 2, at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), book: String(r[1]),
    tab: String(r[2]), keycol: String(r[3]), key: String(r[4]), column: String(r[5]), old: String(r[6]), now: String(r[7]), how: String(r[8]) })).reverse().slice(0, 100);
}
/** Undo one logged edit: an Approve question in Ask Cue that puts the old value back. Nothing is written before Kiko approves. */
function cueAdminEditUndo(n) {
  cueOwner_();
  const sh = cueSheet_('Canvas edits'); n = Number(n);
  if (!(n >= 2 && n <= sh.getLastRow())) throw new Error('No such edit.');
  const r = sh.getRange(n, 1, 1, 9).getValues()[0], col = String(r[5]);
  if (cueEdLocked_(r[1], r[2], col)) throw new Error(col + ' is locked; Cue cannot change it.');
  const o = { book: String(r[1]), tab: String(r[2]), keycol: String(r[3]), key: String(r[4]), add: false, set: {}, was: {}, undo: 'row ' + n };
  o.set[col] = String(r[6]); o.was[col] = String(r[7]);
  cueEditCard_(o, '');
  cueChat_('Cue', 'Undo asked from Cue Admin: putting ' + col + ' back to "' + cueStr_(r[6], 120) + '". Reply "approve" to save it.', '');
  return { ok: true };
}

/** Kiko types "approve" or "not" (or "cancel") in the chat where an Approve question waits: it answers the newest such question
 * there, as the button did. Returns null when no Approve question waits in that chat. */
function cueAskSaid_(c) {
  const t = String(c.text || '').trim().toLowerCase().replace(/[.!]+$/, '');
  const pick = /^(approve|approved|yes,? approve|ok,? approve|save it|yes)$/.test(t) ? 'approve' : /^(not|not that|no|cancel|ignore|don'?t)$/.test(t) ? 'not' : '';
  if (!pick) return null;
  const all = PropertiesService.getScriptProperties().getProperties(), where = c.ref || '';
  const open = Object.keys(all).filter(k => k.indexOf('CUE_ASK_') === 0).map(k => { let o = null; try { o = JSON.parse(all[k]); } catch (e) { return null; } return o ? { id: k.slice(8), o } : null; })
    .filter(x => x && ['canvasedit', 'allowset', 'contactfill', 'invline'].indexOf(x.o.type) >= 0 && (x.o.where || '') === where)
    .sort((a, b) => (parseInt(b.id.slice(4, 12), 36) || 0) - (parseInt(a.id.slice(4, 12), 36) || 0));
  if (!open.length) return null;
  return cueAskPick(open[0].id, pick);
}

/** Cloud check (test/checks/1.27.88-ask-cue.check.mjs): reads the email types and counts the Canvas edits log. Read only: it
 * creates no tab and writes nothing. */
function cueAccCheck() {
  cueOwner_();
  let edits = 0;
  try { const sh = SpreadsheetApp.openById(cueProp_('CUE_SHEET_ID', '')).getSheetByName('Canvas edits'); edits = sh ? Math.max(0, sh.getLastRow() - 1) : 0; } catch (e) { edits = -1; }
  const types = cueMtTypes_();
  return { settings: CUE_MT_SETTINGS_, types: Object.keys(types).map(t => ({ type: t, setting: types[t] })), edits };
}
