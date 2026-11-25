// Part of test/cue.test.js. Feature: DEPLOY-BASE-GUARD (tools/deploy-guard.cjs, used by tools/deploy.mjs). Kiko 25 Nov 2026, decision
// card "Should I draft the Cue deploy guard (stop deploy when live is newer)?": "Yes, draft the guard". Task-observer observation 0110:
// two releases got the go a minute apart, and the second, built on Version 267, would have replaced Version 268.
test('DBG1 a live deploy built on the live Version goes ahead; one built on an older Version stops and says to rebuild', () => {
  const { baseGuard } = require(path.join(__dirname, '..', 'tools', 'deploy-guard.cjs'));
  assert.strictEqual(baseGuard('deploy', 268, '268'), '');
  assert.match(baseGuard('deploy', 268, '267'), /live is Version 268, but this release was built on Version 267\. .*rebuild/);
  assert.match(baseGuard('deploy', 268, ''), /give base_version/, 'no base given stops a live deploy');
  assert.match(baseGuard('deploy', 268, undefined), /give base_version/);
  assert.match(baseGuard('deploy', 268, 'v268'), /give base_version/, 'only a plain number counts');
  assert.match(baseGuard('deploy', undefined, '268'), /live is Version \(head\)/);
});
test('DBG2 check, preview and test never need a base, since they do not move the live deployment', () => {
  const { baseGuard } = require(path.join(__dirname, '..', 'tools', 'deploy-guard.cjs'));
  ['check', 'preview', 'test'].forEach(m => assert.strictEqual(baseGuard(m, 268, ''), '', m));
});
test('DBG3 deploy.mjs runs the base check after check mode exits and before anything is pushed; the workflow passes base_version', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'deploy.mjs'), 'utf8');
  const exitCheck = src.indexOf("if (mode === 'check')"), guard = src.indexOf('deployGuard.baseGuard(mode, live, process.env.BASE_VERSION)'), push = src.indexOf("clasp(pushDir, 'push'");
  assert.ok(exitCheck > 0 && guard > exitCheck && push > guard, 'order: check exit, base check, push');
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(wf, /base_version:/); assert.match(wf, /BASE_VERSION: \$\{\{ inputs\.base_version \}\}/);
});
