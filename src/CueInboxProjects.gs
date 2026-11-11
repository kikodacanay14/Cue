/* Team inbox: project chats (CanvasWorkspace docs/specs/team-inbox-design.md section 15; Kiko 11 Nov 2026 19:33 Manila:
 * "Project Chats"). Each open Canvas project gets its own chat in the inbox, made from the Canvas project board, never added by
 * hand. One bridge READ only: get_project_board, the same read the Morning batch, sweeps and GPT tasks already use. No Canvas
 * write, no new Canvas action, no Canvas release.
 * - Open = the board's phase is Initiation, Planning, Execution or Closure. Complete, On Hold, Cancelled and Not Awarded make no
 *   chat, and a project chat whose project leaves those phases is Retired (its messages stay).
 * - A project chat is a ChatGPT API chat (the only provider that answers today). Its label follows the project's name.
 * - The read runs when the Inbox page opens, at most once every 10 minutes, or when Kiko taps Refresh projects. A failed read
 *   leaves the chats as they are and the page says so. */

const CUE_INBOX_OPEN_PHASES_ = ['Initiation', 'Planning', 'Execution', 'Closure'];
const CUE_INBOX_PROJ_SYNC_KEY_ = 'cue-inbox-proj-sync', CUE_INBOX_PROJ_SYNC_S_ = 600;

/** True when a board project should have an Active chat. Uses the board's phase; a blank phase is read from the status. */
function cueInboxProjOpen_(p) {
  const ph = String((p && p.phase) || '').trim();
  if (ph) return CUE_INBOX_OPEN_PHASES_.indexOf(ph) >= 0;
  return /^for\s/i.test(String((p && p.status) || '').trim());   // every open Canvas status starts "For ..."
}
function cueInboxProjLabel_(p) { return cueStr_(String(p.name || p.event || p.id).trim(), 80); }

/** Makes, renames and retires project chats from the Canvas project board. force: skip the 10-minute wait. */
function cueInboxSyncProjects_(force) {
  cueOwner_();
  let cache = null; try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (!force && cache && cache.get(CUE_INBOX_PROJ_SYNC_KEY_)) return { skipped: true };
  const s = { id: 'INBOX-PROJ-' + cueNow_().toString(36), metrics: { ai_calls: 0, calls: [] } };
  let projects;
  try { projects = (cueBridge_(s, 'get_project_board', {}) || {}).projects || []; }
  catch (e) { return { error: 'Canvas projects could not be read: ' + cueStr_((e && e.message) || e, 160) }; }
  const chats = cueInboxRows_('Inbox Chats', CUE_INBOX_CHAT_COLS_), byPid = {};
  chats.forEach(c => { if (String(c.v[7] || '')) byPid[String(c.v[7])] = c; });
  const now = new Date(cueNow_()).toISOString(), out = { added: 0, renamed: 0, retired: 0 };
  projects.forEach(p => {
    const pid = String((p && p.id) || '').trim(); if (!pid) return;
    const open = cueInboxProjOpen_(p), label = cueInboxProjLabel_(p), c = byPid[pid];
    if (!c) {
      if (!open) return;
      cueSheet_('Inbox Chats').appendRow([cueInboxId_('CH'), 'ChatGPT API', label, 'Active', '', '', now, pid]);
      byPid[pid] = true; out.added++; return;
    }
    if (c === true) return;
    let changed = false;
    if (c.v[2] !== label) { c.v[2] = label; changed = true; out.renamed++; }
    if (!open && c.v[3] === 'Active') { c.v[3] = 'Retired'; changed = true; out.retired++; }
    if (changed) cueInboxSetRow_('Inbox Chats', c.row, CUE_INBOX_CHAT_COLS_, c.v);
  });
  if (cache) cache.put(CUE_INBOX_PROJ_SYNC_KEY_, '1', CUE_INBOX_PROJ_SYNC_S_);
  return out;
}

/* Public entry point for Inbox.html. Owner check is inside. */
function cueInboxSyncProjects(force) { return cueInboxSyncProjects_(!!force); }
