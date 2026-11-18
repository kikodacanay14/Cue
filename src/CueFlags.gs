/* CUE-FLAG-2026-11-18 (Kiko 18 Nov 2026 08:47:46Z "add a feature that allows me to Flag a message. Flagged message now goes to a
 * thread named Flagged - meaning these are the messages i wanna get back to later on"; 08:48:00Z "when an item is Flagged i can also
 * Unflag it").
 *
 * Kiko flags a Cue or agent message from its bubble; it is listed in the Flagged channel (top of the channel list) until he
 * unflags it there or on the bubble. The Flagged tab of the Cue sheet keeps one row per flagged message: a copy of who, when and
 * what it said, and the thread it came from, so the list survives the chat scrolling past it. Unflag deletes the row. Nothing is
 * sent, and nothing in Canvas changes. Key: "l:<time>|<who>" for a chat line, "r:<request id>" for an agent message. */
const CUE_FLAG_KEY_RE_ = /^(l:[\dTZ:.+-]{10,40}\|[^\n]{1,80}|r:[\w-]{4,80})$/;
const CUE_FLAG_SHOW_ = 300;   // newest flagged messages the page gets

function cueFlags_() {
  const sh = cueSheet_('Flagged'), n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, 8).getValues().filter(r => r[0]).map(r => ({ key: String(r[0]), at: cueChanIso_(r[1]), kind: String(r[2]), from: String(r[3]),
    who: String(r[4]), time: cueChanIso_(r[5]), text: String(r[6]), thread: String(r[7]) })).reverse().slice(0, CUE_FLAG_SHOW_);
}

/** Flags (on = true) or unflags one message. item: { key, from, who, time, text, thread }. Returns the flagged list, newest first. */
function cueFlag(item, on) {
  cueOwner_();
  const it = item || {}, key = String(it.key || '');
  if (!CUE_FLAG_KEY_RE_.test(key)) throw new Error('Cue could not tell which message to flag.');
  return cueLocked_(() => {
    const sh = cueSheet_('Flagged'), n = sh.getLastRow() - 1, keys = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0])) : [];
    const at = keys.indexOf(key);
    if (on && at < 0) sh.appendRow([key, new Date(cueNow_()).toISOString(), key.charAt(0) === 'r' ? 'agent' : 'line', String(it.from || '').slice(0, 120),
      String(it.who || '').slice(0, 80), String(it.time || '').slice(0, 40), String(it.text || '').slice(0, 2000), String(it.thread || '').slice(0, 120)]);
    if (!on && at >= 0) sh.deleteRow(at + 2);
    return cueFlags_();
  });
}
