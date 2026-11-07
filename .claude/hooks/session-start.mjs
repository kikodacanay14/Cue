// SessionStart hook (observation review 7 Nov 2026, package P4; observations 0026 and 0027).
// Same file in Cue and CanvasWorkspace. Reads the hook event from stdin. Never fails the session: every error exits 0.
// 1. Cloud sessions start from a shallow clone that fetches only main, so the stop hook reported "unpushed commits" for
//    every new branch (0026). Widen the fetch refspec once and let a first push set its own upstream.
// 2. After a compaction or a resume the task-observer duty has left the context (0027). Print a reminder; SessionStart
//    stdout is added to the context.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

try {
  let ev = {};
  try { ev = JSON.parse(fs.readFileSync(0, 'utf8').trim() || '{}'); } catch { ev = {}; }
  const cwd = process.env.CLAUDE_PROJECT_DIR || ev.cwd || process.cwd();
  const git = (...args) => { try { execFileSync('git', args, { cwd, stdio: 'ignore', timeout: 5000 }); } catch { /* not a repo or no git: skip */ } };
  git('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  git('config', 'push.autoSetupRemote', 'true');
  if (ev.source === 'compact' || ev.source === 'resume')
    process.stdout.write('Context was compacted or resumed: re-run the task-observer Session Start Protocol (CLAUDE.md, Task observer).\n');
} catch { /* never block the session */ }
process.exit(0);
