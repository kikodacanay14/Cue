/* CUE-2026-10-21. Attachments for an intake: images, PDFs and text files Kiko adds in the chat. Cue keeps each one in a
 * "Cue uploads" Drive folder it made itself (Drive REST, drive.file scope: Cue sees only its own files) and stores only the file ids in
 * the request. GPT's read call (call 1) gets them directly: images as input_image, PDFs as input_file, text files as text.
 * The AI call count does not change. Attachments are untrusted evidence, the same as the inquiry text. */

const CUE_FILE_TYPES_ = { 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'application/pdf': 'pdf', 'text/plain': 'text', 'text/csv': 'text', 'message/rfc822': 'text' };
const CUE_FILES_MAX_ = { count: 8, each: 10 * 1024 * 1024, total: 15 * 1024 * 1024, text: 40000 };

/** files = [{name, type, data}] from the page (data is base64, no data: prefix) -> saved [{id, name, type, size}]. */
function cueFilesSave_(files, id) {
  if (!files || !files.length) return [];
  if (!Array.isArray(files) || files.length > CUE_FILES_MAX_.count) throw new Error('Attach ' + CUE_FILES_MAX_.count + ' files at most.');
  let total = 0;
  const blobs = files.map(f => {
    const name = String((f && f.name) || 'file').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120), type = String((f && f.type) || '');
    if (!CUE_FILE_TYPES_[type]) throw new Error(name + ': Cue reads photos (JPG, PNG, WebP, GIF), PDFs and text files. Save it as a PDF or JPG first.');
    const bytes = Utilities.base64Decode(String((f && f.data) || ''));
    if (!bytes.length) throw new Error(name + ' is empty.');
    if (bytes.length > CUE_FILES_MAX_.each) throw new Error(name + ' is over 10 MB.');
    total += bytes.length;
    return Utilities.newBlob(bytes, type, name);
  });
  if (total > CUE_FILES_MAX_.total) throw new Error('The attachments add up to more than 15 MB. Send fewer or smaller files.');
  const folder = cueUploads_();
  return blobs.map(b => {
    const up = cueDrive_('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media', { contentType: b.getContentType(), payload: b.getBytes() });
    cueDrive_('patch', CUE_DRIVE_ + '/' + up.id + '?addParents=' + folder, { contentType: 'application/json',
      payload: JSON.stringify({ name: b.getName(), description: 'Cue intake ' + id }) });
    return { id: up.id, name: b.getName(), type: b.getContentType(), size: b.getBytes().length };
  });
}
// Drive over REST with Cue's own token: the drive.file scope means Cue can only see the files and folder it made.
const CUE_DRIVE_ = 'https://www.googleapis.com/drive/v3/files';
function cueDrive_(method, url, o) {
  const opt = Object.assign({ method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }, o || {});
  delete opt.raw;
  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('Drive said HTTP ' + code + ' (' + method.toUpperCase() + ' ' + url.split('?')[0].split('/').slice(-1)[0] + ')');
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
