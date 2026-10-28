// Cue's page as Apps Script serves it (STRUCTURE-PHASE-2 item 2.4, Kiko 28 Oct 2026 04:21Z). src/Index.html is split into parts;
// doGet runs it as a template, where <? ... ?> prints nothing and <?!= cueInclude_('Name') ?> prints src/Name.html without its last
// newline (cueInclude_ in src/Cue.gs). This joins it the same way, for the tests, tools/map.mjs and the cloud check (test/checks/run.mjs).
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
function cuePage(dir = SRC) {
  const page = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8');
  return page.replace(/<\?!= cueInclude_\('([A-Za-z0-9]+)'\) \?>|<\?(?!=)[\s\S]*?\?>/g, (m, name) => name ? fs.readFileSync(path.join(dir, name + '.html'), 'utf8').replace(/\n$/, '') : '');
}
module.exports = { cuePage };
