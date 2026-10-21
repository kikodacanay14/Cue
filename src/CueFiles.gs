/* CUE-2026-10-21. Attachments for an intake: images, PDFs and text files Kiko adds in the chat. Cue keeps each one in a
 * "Cue uploads" Drive folder it made itself (Drive REST, drive.file scope: Cue sees only its own files) and stores only the file ids in
 * the request. GPT's read call (call 1) gets them directly: images as input_image, PDFs as input_file, text files as text.
 * The AI call count does not change. Attachments are untrusted evidence, the same as the inquiry text. */

const CUE_FILE_TYPES_ = { 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'application/pdf': 'pdf', 'text/plain': 'text', 'text/csv': 'text', 'message/rfc822': 'text' };
const CUE_FILES_MAX_ = { count: 10, each: 10 * 1024 * 1024, total: 20 * 1024 * 1024, text: 40000 };

/** The page uploads each file on its own (one big call with everything silently failed at ~10 MB), then sends the ids. */
function cueUpload(file) {
  cueOwner_();
  const b = cueBlob_(file);
  return cueDriveSave_(b, 'Cue upload, not sent yet');
}
function cueBlob_(f) {
  const name = String((f && f.name) || 'file').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120), type = String((f && f.type) || '');
  if (!CUE_FILE_TYPES_[type]) throw new Error(name + ': Cue reads photos (JPG, PNG, WebP, GIF), PDFs and text files. Save it as a PDF or JPG first.');
  const bytes = Utilities.base64Decode(String((f && f.data) || ''));
  if (!bytes.length) throw new Error(name + ' is empty.');
  if (bytes.length > CUE_FILES_MAX_.each) throw new Error(name + ' is over 10 MB.');
  return Utilities.newBlob(bytes, type, name);
}
function cueDriveSave_(b, why) {
  const folder = cueUploads_();
  const up = cueDrive_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media', { contentType: b.getContentType(), payload: b.getBytes() });
  cueDrive_('patch', CUE_DRIVE_ + '/' + up.id + '?addParents=' + folder, { contentType: 'application/json', payload: JSON.stringify({ name: b.getName(), description: why }) });
  return { id: up.id, name: b.getName(), type: b.getContentType(), size: b.getBytes().length };
}
/** files = [{id}] already uploaded with cueUpload, or [{name, type, data}] (base64) -> [{id, name, type, size}]. */
function cueFilesSave_(files, id) {
  if (!files || !files.length) return [];
  if (!Array.isArray(files) || files.length > CUE_FILES_MAX_.count) throw new Error('Attach ' + CUE_FILES_MAX_.count + ' files at most.');
  const folder = files.some(f => f && f.id) ? cueUploads_() : '';
  const known = files.filter(f => f && f.id).map(f => {
    let m; try { m = cueDrive_('get', CUE_DRIVE_ + '/' + encodeURIComponent(String(f.id)) + '?fields=id,name,mimeType,size,parents'); } catch (e) { throw new Error('An attachment did not finish uploading. Attach it again.'); }
    if ((m.parents || []).indexOf(folder) < 0 || !CUE_FILE_TYPES_[m.mimeType]) throw new Error('That attachment is not one Cue uploaded. Attach it again.');
    return { id: m.id, name: cueStr_(m.name, 120), type: m.mimeType, size: Number(m.size) || 0 };
  });
  const blobs = files.filter(f => !(f && f.id)).map(cueBlob_);
  const total = known.reduce((n, f) => n + f.size, 0) + blobs.reduce((n, b) => n + b.getBytes().length, 0);
  if (total > CUE_FILES_MAX_.total) throw new Error('The attachments add up to more than 20 MB. Send fewer or smaller files.');
  return known.concat(blobs.map(b => cueDriveSave_(b, 'Cue request ' + id)));
}
// Drive over REST with Cue's own token: the drive.file scope means Cue can only see the files and folder it made.
const CUE_DRIVE_ = 'https://www.googleapis.com/drive/v3/files';

const CUE_SNAPSHOT_RE_ = /^Cue snapshot /;   // the Cue bubble names its snapshots this way
/** Kiko 06:45Z: the files Kiko attaches belong in the Canvas project folder ("a critical part of the intake"). Cue sends each
 * one through the bridge (save_project_file) after Kiko approves. Photos go to Designs & Visuals, the rest to `other`.
 * A file already saved is skipped, and a repeat on Canvas's side returns the same file. A failure is a note, not a stop. */
function cueSaveToProject_(s, pid, files, other) {
  if (!pid || !(files || []).length) return;
  const saved = s.project_saved || (s.project_saved = []), ok = [];
  let loose = false;
  files.forEach(f => {
    const was = saved.find(x => x.id === f.id); if (was && was.url) return;
    const rec = was || { id: f.id, name: f.name }; if (!was) saved.push(rec);
    try {
      const data = Utilities.base64Encode(cueDrive_('get', CUE_DRIVE_ + '/' + f.id + '?alt=media', { raw: true }).getContent());
      // A snapshot of Kiko's screen (Cue bubble 1.2) is evidence, not a design: it goes with the brief (Kiko 08:17Z).
      const type = /^image\//.test(f.type) && !CUE_SNAPSHOT_RE_.test(f.name) ? 'Designs & Visuals' : other;
      const r = cueBridge_(s, 'save_project_file', { request_id: s.id, name: f.name, mime: f.type, type, data }, pid) || {};
      rec.url = String(r.url || ''); rec.folder = r.in_project_folder === false ? 'Canvas Files, ' + type : type; rec.error = ''; ok.push(f.name);
      if (r.in_project_folder === false) loose = true;
    } catch (e) { rec.error = cueStr_((e && e.message) || e, 200); }
  });
  const bad = saved.filter(x => !x.url);
  // Canvas V186 says when a project has no Drive folder yet (usually no event date): then the files are in Canvas Files for it.
  if (ok.length) cueChat_('Cue', 'Saved ' + ok.length + ' file' + (ok.length === 1 ? '' : 's') + (loose ? ' to Canvas Files for this project (it has no Drive project folder yet, '
    + 'usually because it has no event date; Canvas shows them in its Files tab)' : ' to the Canvas project folder') + ': ' + ok.join(', ') + '.', s.id);
  if (bad.length) (s.notes = s.notes || []).push('Not saved to the project folder yet: ' + bad.map(x => x.name + ' (' + x.error + ')').join('; ') + '.');
}
function cueDrive_(method, url, o) {
  const opt = Object.assign({ method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }, o || {});
  delete opt.raw;
  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();
  if (code === 403 && /scope/i.test(res.getContentText())) throw new Error('Cue does not have Drive access yet. Tap Fix Google access in the Threads pane.');
  if (code !== 200) throw new Error('Drive said HTTP ' + code + ' (' + method.toUpperCase() + ' ' + url.split('?')[0].split('/').slice(-1)[0] + ')' + cueGoogleWhy_(res));
  return o && o.raw ? res : JSON.parse(res.getContentText() || '{}');
}
function cueUploads_() {
  const fid = cueProp_('CUE_UPLOADS_FOLDER', '');
  if (fid) { try { if (!cueDrive_('get', CUE_DRIVE_ + '/' + fid + '?fields=id,trashed').trashed) return fid; } catch (e) { /* gone: make a new one */ } }
  const f = cueDrive_('post', CUE_DRIVE_, { contentType: 'application/json', payload: JSON.stringify({ name: 'Cue uploads', mimeType: 'application/vnd.google-apps.folder' }) });
  PropertiesService.getScriptProperties().setProperty('CUE_UPLOADS_FOLDER', f.id);
  return f.id;
}
/** The request's attachments as Responses API content parts, after the inquiry text part. */
function cueFilesParts_(s) {
  return (s.files || []).map(f => {
    let res; try { res = cueDrive_('get', CUE_DRIVE_ + '/' + f.id + '?alt=media', { raw: true }); } catch (e) { throw new Error('The attachment ' + f.name + ' is no longer in Cue uploads.'); }
    const kind = CUE_FILE_TYPES_[f.type], b64 = () => Utilities.base64Encode(res.getContent());
    if (kind === 'image') return { type: 'input_image', image_url: 'data:' + f.type + ';base64,' + b64(), detail: 'high' };
    if (kind === 'pdf') return { type: 'input_file', filename: f.name, file_data: 'data:application/pdf;base64,' + b64() };
    return { type: 'input_text', text: '<attachment name="' + f.name.replace(/"/g, "'") + '">\n' + res.getContentText().slice(0, CUE_FILES_MAX_.text) + '\n</attachment>' };
  });
}
/** Google's own reason for a refusal (e.g. "Drive API has not been used in project ..."), short. */
function cueGoogleWhy_(res) {
  try { const e = JSON.parse(res.getContentText()).error; return e && e.message ? ': ' + String(e.message).slice(0, 200) : ''; } catch (x) { return ''; }
}

/** PC test 17:42Z: a pasted screenshot (image.png) had no Drive thumbnail yet, so the viewer fell back to Drive's own preview with
 * zoom and rotate off, and the card showed black. The page asks for the image itself instead: one of Cue's own uploads, 8 MB at most. */
function cueFileData(id) {
  cueOwner_();
  id = String(id || '');
  if (!/^[\w-]{10,}$/.test(id)) throw new Error('No such file.');
  const meta = cueDrive_('get', CUE_DRIVE_ + '/' + id + '?fields=mimeType,size');
  if (CUE_FILE_TYPES_[meta.mimeType] !== 'image') throw new Error('Not an image.');
  if (Number(meta.size) > 8 * 1024 * 1024) throw new Error('Too big to show here.');
  return 'data:' + meta.mimeType + ';base64,' + Utilities.base64Encode(cueDrive_('get', CUE_DRIVE_ + '/' + id + '?alt=media', { raw: true }).getContent());
}
