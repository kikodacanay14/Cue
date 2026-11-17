// SessionStart hook for source "compact" and "resume" (Kiko, 17 Nov 2026: yes to a hook for skills skipped after compaction).
// Why: required skill calls were skipped after a compaction three times (observations 0027, 0105, and 0043 in the PC log),
// and text a hook injects was once read as if the skill had run. This hook only reminds; it loads nothing itself.
const text = [
  'CONTEXT WAS COMPACTED OR RESUMED. Skills loaded before this point are NOT loaded now, and this message is not a skill.',
  'Before your next reply, call the Skill tool again for each skill this repo\'s CLAUDE.md requires (caveman; superpowers:using-superpowers for code or build work; scope-then-design for a new task; for any screen work also mockup-review, brand-ui-check and verify-before-done) and re-run the task-observer Session Start Protocol.',
  'In that reply, name the skills you reloaded.',
  'Facts from before the compaction (status, counts, roles, versions) are memory: read them fresh before you state them.',
].join(' ');
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
