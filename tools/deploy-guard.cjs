// Base check for a live Cue deploy (Kiko, 25 Nov 2026, decision card "Yes, draft the guard"; task-observer observation 0110).
// On 18 Nov 2026 two releases got Kiko's go a minute apart. The second, built on Version 267, ran after the first had gone
// live as Version 268, and would have shipped Version 269 without it, because deploy.mjs compares files, not history.
// A live deploy therefore names the Version it was built on (workflow input base_version), and stops if live has moved on.
// check, preview and test never move the live deployment, so they are not checked.
function baseGuard(mode, live, base) {
  if (mode !== 'deploy') return '';
  const b = String(base == null ? '' : base).trim();
  if (!/^\d+$/.test(b)) return 'give base_version: the live Version this release was built on (mode=check prints it)';
  if (Number(b) !== Number(live)) return `live is Version ${live || '(head)'}, but this release was built on Version ${b}. ` +
    'Another release went live since: rebuild on what is live and run mode=check first.';
  return '';
}
module.exports = { baseGuard };
