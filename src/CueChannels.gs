/* CUE-DRAG-TO-CHANNEL-2026-11-18 (Kiko 18 Nov 2026 04:31:41Z "Messages in General Chat can i drag and drop them to a channel? That
 * would then become a rule that messages like those should be moved to that channel"; "yes scope it" 04:41:26Z; 05:08:40Z chose "By
 * where it came from": Cue tags each new General message with its source and a rule matches that source exactly, new messages only;
 * mockup approved "okay" 05:20:38Z).
 *
 * A General line Kiko drags (or, on a phone, long-presses and picks "Move to…") onto a Jobs or Systems channel moves there. The Chat
 * row keeps it: column G holds the channel ("job:bids", "sys:alerts"), with a trailing "?" while the "Also send future … messages
 * there?" question under it is open. "Yes, always" saves a channel rule for the line's source (column F, set by cueChat_). A rule
 * moves the lines from that source that came after it was saved; removing it stops later moves and leaves the earlier ones where
 * they are. Display only: nothing is sent, deleted or written to Canvas. Rules live in the script property CUE_CHAN_RULES as
 * [{ src, chan, at, off }], times as ISO text; a removed rule keeps its entry with off set. */
const CUE_CHAN_RE_ = /^(job|sys):[\w:-]{1,60}$/;
const CUE_CHAN_LOOK_ = 300;   // the lines a move can reach: the same 300 the page shows (cueState)
const CUE_CHAN_KEEP_ = 100;   // rule entries kept, removed ones included

/** The page's chat line plus its source (src) and the channel Kiko moved it to (mv, "?" while the question is open). r = Chat row A:G. */
function cueChanLine_(m, r) {
  if (r && r[5]) m.src = String(r[5]);
  if (r && r[6]) m.mv = String(r[6]);
  return m;
}

function cueChanRules_() {
  let v = []; try { v = JSON.parse(cueProp_('CUE_CHAN_RULES', '[]')); } catch (e) { v = []; }
  return Array.isArray(v) ? v.filter(x => x && x.src && CUE_CHAN_RE_.test(String(x.chan || ''))) : [];
}
function cueChanSave_(l) { PropertiesService.getScriptProperties().setProperty('CUE_CHAN_RULES', JSON.stringify(l.slice(-CUE_CHAN_KEEP_))); }
function cueChanActive_(l, src) { return l.filter(x => x.src === src && !x.off)[0] || null; }
function cueChanIso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }

/** The Chat row (number) of the line the page names by its time, who and text (two lines can share a millisecond), among the last
 * CUE_CHAN_LOOK_ rows; 0 when not found. */
function cueChanRow_(sh, time, who, text) {
  const n = sh.getLastRow() - 1; if (n < 1) return 0;
  const k = Math.min(n, CUE_CHAN_LOOK_), first = n + 2 - k, rows = sh.getRange(first, 1, k, 3).getValues();
  for (let i = rows.length - 1; i >= 0; i--) if (cueChanIso_(rows[i][0]) === String(time) && String(rows[i][1]) === String(who) && String(rows[i][2]) === String(text)) return first + i;
  return 0;
}

/** Moves one General line to a channel. Returns { ok, ask }: ask is true when the line has a source and no rule covers it yet. */
function cueChanMove(time, who, text, chan) {
  cueOwner_();
  chan = String(chan || ''); if (!CUE_CHAN_RE_.test(chan)) throw new Error('That is not a channel.');
  return cueLocked_(() => {
    const sh = cueSheet_('Chat'), row = cueChanRow_(sh, time, who, text);
    if (!row) throw new Error('That message is no longer in the chat.');
    const r = sh.getRange(row, 1, 1, 7).getValues()[0], src = String(r[5] || '');
    const ask = !!src && !cueChanActive_(cueChanRules_(), src);
    sh.getRange(row, 7, 1, 1).setValues([[chan + (ask ? '?' : '')]]);
    return { ok: true, ask };
  });
}

/** Answers "Also send future … messages there?" for one moved line. always = true saves the rule for the line's source. */
function cueChanAnswer(time, who, text, always) {
  cueOwner_();
  return cueLocked_(() => {
    const sh = cueSheet_('Chat'), row = cueChanRow_(sh, time, who, text);
    if (!row) throw new Error('That message is no longer in the chat.');
    const r = sh.getRange(row, 1, 1, 7).getValues()[0], src = String(r[5] || ''), chan = String(r[6] || '').replace(/\?$/, '');
    if (!CUE_CHAN_RE_.test(chan)) throw new Error('That message was not moved.');
    sh.getRange(row, 7, 1, 1).setValues([[chan]]);
    if (always && src) {
      const l = cueChanRules_(), now = new Date(cueNow_()).toISOString(), cur = cueChanActive_(l, src);
      if (cur && cur.chan !== chan) cur.off = now;
      if (!cur || cur.chan !== chan) l.push({ src, chan, at: now });
      cueChanSave_(l);
    }
    return { ok: true, rule: !!(always && src) };
  });
}

/** Removes the rule for a source: later lines from it stay in General; lines it already moved stay in their channel. */
function cueChanRuleDel(src) {
  cueOwner_();
  cueLocked_(() => {
    const l = cueChanRules_(), now = new Date(cueNow_()).toISOString();
    l.forEach(x => { if (x.src === String(src) && !x.off) x.off = now; });
    cueChanSave_(l);
  });
  return cueAdminChanRules();
}

/** Cue Admin › Channel rules: the rules in use, newest first, each with how many lines it has moved so far. */
function cueAdminChanRules() {
  cueOwner_();
  const l = cueChanRules_(), sh = cueSheet_('Chat'), n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 7).getValues() : [];
  return l.filter(x => !x.off).map(x => ({ src: x.src, chan: x.chan, at: x.at,
    moved: rows.filter(r => String(r[5] || '') === x.src && !r[4] && !r[6] && cueChanIso_(r[0]) >= x.at).length })).reverse();
}
