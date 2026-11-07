// PreToolUse guard (Kiko 22 Oct 2026, item 6 of specs/claude-code-automations.md).
// Asks Kiko before anything that changes live Cue or Canvas code or the deploy sign-in; lets everything else through.
// Same file in Cue and CanvasWorkspace. Reads the hook event from stdin; prints an "ask" decision or nothing.
import fs from 'node:fs';

let ev = {};
try { ev = JSON.parse(fs.readFileSync(0, 'utf8').trim() || '{}'); } catch { process.exit(0); }   // unreadable event: let the call through
const tool = ev.tool_name || '';
const input = ev.tool_input || {};
const ask = reason => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
  process.exit(0);
};

// 1. clasp from a shell: push changes the Apps Script head (/dev, the triggers, and Canvas's 11pm release);
//    deploy/version commands change or prepare the live web app.
if (tool === 'Bash') {
  const cmd = String(input.command || '');
  const m = cmd.match(/\bclasp\s+(push|deploy|create-deployment|update-deployment|redeploy|undeploy|delete-deployment|version|create-version)\b/);
  if (m) ask(`clasp ${m[1]} changes the Apps Script project directly. Live changes go through Deploy Cue / Deploy Canvas after Kiko's go.`);
}

// 2. GitHub MCP: a re-run (a re-run repeats the original inputs, which may be mode=deploy).
//    A plain live deploy run (gh workflow run or run_workflow with mode=deploy) is no longer asked: Kiko's 2 Nov 2026 rule
//    lets any session ship end to end (observation review 7 Nov 2026, decision D1). Deploy Cue's own checks still apply.
if (tool === 'mcp__github__actions_run_trigger') {
  if (/^rerun/.test(String(input.method || '')))
    ask(`Re-running a workflow run in ${input.repo}. If it is a Deploy run it repeats its original mode, which may be live.`);
}

// 3. Files that hold the deploy sign-in, the deploy target, or the workflows that ship code.
if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
  const p = String(input.file_path || input.notebook_path || '').replace(/\\/g, '/');
  if (/(^|\/)\.deploy\//.test(p) || /(^|\/)deploy\.json$/.test(p) || /(^|\/)\.github\/workflows\//.test(p))
    ask(`${p} controls how code reaches live. Kiko approves changes to it.`);
}
