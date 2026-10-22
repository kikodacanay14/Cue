/* CUE-2026-10-22. Image batches (Kiko 22 Oct 03:03Z, specs/image-batches.md): "more coming" (or the More coming chip) holds
 * the files and text of several messages for one task, and Done sends them as one message. Plain code, no AI call until Done.
 * One batch per box: the main chat ('main') or a thread (its task id). Each is a script property, so a reload keeps it;
 * a batch untouched for 2 hours is dropped with a line in the chat. Files are already in Drive "Cue uploads" (cueUpload). */

const CUE_BATCH_KEY_ = 'CUE_BATCH:', CUE_BATCH_HOURS_ = 2, CUE_BATCH_TEXT_ = 5000;   // one property per box (9 KB each)

function cueBatchBox_(ref) { return /^cue-[0-9A-Za-z-]{6,40}$/.test(String(ref || '')) ? String(ref) : 'main'; }
/** All open batches by box, after dropping the stale ones. */
function cueBatchAll_() {
  const props = PropertiesService.getScriptProperties().getProperties(), all = {}, old = cueNow_() - CUE_BATCH_HOURS_ * 3600000;
  Object.keys(props).filter(p => p.indexOf(CUE_BATCH_KEY_) === 0).forEach(p => {
    const k = p.slice(CUE_BATCH_KEY_.length); let b = null; try { b = JSON.parse(props[p]); } catch (e) { b = null; }
    if (b && b.touched > old) { all[k] = b; return; }
    const n = ((b && b.files) || []).length;
    cueChat_('Cue', 'Dropped the batch of ' + n + ' file' + (n === 1 ? '' : 's') + ' I was holding: nothing was added for ' + CUE_BATCH_HOURS_
      + ' hours. Nothing was sent. Attach them again with "more coming" to start over.', k === 'main' ? '' : k);
    cueBatchSave_(k, null);
  });
  return all;
}
function cueBatchSave_(k, b) {
  const p = PropertiesService.getScriptProperties();
  if (b) p.setProperty(CUE_BATCH_KEY_ + k, JSON.stringify(b)); else p.deleteProperty(CUE_BATCH_KEY_ + k);
}
/** What the page shows: per box, the count line and whether Cue asked what to do. */
function cueBatchView_(all) {
  const out = {};
  Object.keys(all).forEach(k => { const b = all[k], size = b.files.reduce((n, f) => n + (f.size || 0), 0);
    out[k] = { count: b.files.length, msgs: b.msgs, mb: Math.round(size / 104857.6) / 10, texts: b.texts.length, asked: !!b.asked }; });
  return out;
}
function cueBatchNew_() { const now = cueNow_(); return { files: [], texts: [], msgs: 0, started: now, touched: now, asked: false }; }

/** The More coming chip with nothing attached yet: open an empty batch in this box. */
function cueBatchStart(ref) {
  cueOwner_();
  return cueLocked_(() => { const all = cueBatchAll_(), k = cueBatchBox_(ref); if (!all[k]) { all[k] = cueBatchNew_(); cueBatchSave_(k, all[k]); } return cueBatchView_(all); });
}
/** One message of the batch: its text (without "more coming") and the ids of files the page already uploaded. */
function cueBatchAdd(ref, text, files) {
  cueOwner_();
  const t = String(text || '').trim(), list = (Array.isArray(files) ? files : []).filter(f => f && f.id);
  const folder = list.length ? cueUploads_() : '', got = list.map(f => cueFileKnown_(f.id, folder));   // Drive calls outside the lock
  return cueLocked_(() => {
    const all = cueBatchAll_(), k = cueBatchBox_(ref), b = all[k] || cueBatchNew_();
    const fresh = got.filter(f => !b.files.some(x => x.id === f.id));
    const size = b.files.concat(fresh).reduce((n, f) => n + (f.size || 0), 0);
    if (b.files.length + fresh.length > CUE_FILES_MAX_.count) throw new Error('That is the most for one task (' + CUE_FILES_MAX_.count + ' files). '
      + 'I am holding ' + b.files.length + '. Say done, or Cancel.');
    if (size > CUE_FILES_MAX_.total) throw new Error('That is the most for one task (' + (CUE_FILES_MAX_.total / 1048576) + ' MB). '
      + 'I am holding ' + b.files.length + ' files. Say done, or Cancel.');
    if (b.texts.join('').length + t.length > CUE_BATCH_TEXT_) throw new Error('That is more text than a batch can hold (' + CUE_BATCH_TEXT_
      + ' characters). Send the files now, then put the long text in your last message, after "done".');
    b.files = b.files.concat(fresh.map(f => ({ id: f.id, name: cueStr_(f.name, 60), size: f.size }))); if (t) { b.texts.push(t); b.asked = false; }
    b.msgs++; b.touched = cueNow_(); all[k] = b; cueBatchSave_(k, b);
    return cueBatchView_(all);
  });
}
/** Done. extra = text after "done", or Kiko's answer to "What should I do with these files?". With no text at all, Cue asks once and keeps the batch.
 * Returns { ask, count, batches } or { text, files: [{id, name}], count, batches }; the page then sends it as one message. */
function cueBatchTake(ref, extra) {
  cueOwner_();
  const x = String(extra || '').trim();
  return cueLocked_(() => {
    const all = cueBatchAll_(), k = cueBatchBox_(ref), b = all[k];
    if (!b) throw new Error('No batch is open here. Attach the files and say "more coming" to start one.');
    const texts = b.texts.concat(x ? [x] : []);
    if (!texts.length && b.files.length) { b.asked = true; b.touched = cueNow_(); cueBatchSave_(k, b); return { ask: true, count: b.files.length, batches: cueBatchView_(all) }; }
    if (!texts.length) throw new Error('Nothing is held yet. Attach files, or Cancel.');
    delete all[k]; cueBatchSave_(k, null);
    return { text: texts.join('\n\n'), files: b.files.map(f => ({ id: f.id, name: f.name })), count: b.files.length, batches: cueBatchView_(all) };
  });
}
/** Cancel: drop the held list. Nothing went to any AI. The files stay in Drive "Cue uploads", like any unsent upload. */
function cueBatchCancel(ref) {
  cueOwner_();
  return cueLocked_(() => { const all = cueBatchAll_(), k = cueBatchBox_(ref), n = all[k] ? all[k].files.length : 0; delete all[k]; cueBatchSave_(k, null);
    return { dropped: n, batches: cueBatchView_(all) }; });
}
