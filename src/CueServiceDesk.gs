/**
 * SERVICE-DESK-2026-11-07 (Kiko 7 Nov 2026 11:47Z: "a report a bug function ... after submitting it will go to service desk";
 * 11:59Z answer 3: "can be thru Cue"). Canvas saves each bug report in its Service Desk (Kiko only). Cue tells Kiko in its chat:
 * every 15 minutes it reads Canvas's newest reports through the bridge (service_desk_new, read only) and posts one line per
 * report it has not told him about, with an Open in Canvas button for that report. It remembers the highest report number it
 * told (script property CUE_SD_STATE), so a report is told once. No AI call, no email, nothing written to Canvas.
 */
const CUE_SD_ = { every_min: 15, prop: 'CUE_SD_STATE', text: 300 };

function cueSdLoad_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CUE_SD_.prop) || '{}') || {}; } catch (e) { return {}; } }
function cueSdSave_(st) { PropertiesService.getScriptProperties().setProperty(CUE_SD_.prop, JSON.stringify(st)); }

/** One chat line for one report. Pure: the tests call it. */
function cueSdLine_(x) {
  const where = [x.page, x.project].filter(Boolean).join(', ');
  const t = String(x.text || '').replace(/\s+/g, ' ').trim();
  return 'New bug report ' + x.id + ' from ' + (x.by || 'someone') + (where ? ' (' + where + ')' : '') + ': '
    + (t.length > CUE_SD_.text ? t.slice(0, CUE_SD_.text - 1) + '…' : t)
    + (x.picture ? ' A picture came with it.' : '')
    + (x.link ? ' ' + cueCanvasTok_({ title: 'Open ' + x.id + ' in Service Desk', url: x.link }) : '');
}

/** From cueResume (CueJobs.gs). Returns how many reports it told Kiko about, or null when not due. */
function cueSdTick_() {
  if (globalThis.CUE_CHECK_ON_ || UrlFetchApp.__cueCheck === true) return null;   // a check version never posts in Kiko's chat
  const st = cueSdLoad_(), now = cueNow_();
  if (st.at && now - st.at < CUE_SD_.every_min * 60000) return null;
  st.at = now; cueSdSave_(st);
  const r = cueBridge_({ id: 'sd-' + now.toString(36) }, 'service_desk_new', {}) || {};
  const seen = Number(st.n) || 0;
  const fresh = (r.items || []).filter(x => x && /^BUG-\d+$/.test(String(x.id)) && Number(x.n) > seen).sort((a, b) => a.n - b.n);
  fresh.forEach(x => cueChat_('Cue', cueSdLine_(x), ''));
  if (fresh.length) { st.n = fresh[fresh.length - 1].n; cueSdSave_(st); }
  return fresh.length;
}
