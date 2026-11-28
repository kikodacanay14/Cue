// Chromium check: load Cue's exact HTML and seed one in-memory Finance row; no records or messages are written.
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {cuePage} = require('../page.js');
const sample = {id:'FIN-COMPACT-QA', kind:'agd', status:'Done', created:'2026-11-28T14:20:00Z', text:'',
  agd:{agent:'Finance', type:'update', status:'Unread', item:'Finance summary 2026-11-28T22',
    handover:{summary:'Finance run 2026-11-28T22: 1923 files found in 309 folders (coverage complete), Gemini OCR read 5 files (0 failed), 1 payment links for you to confirm.',
      gaps:'QA legacy proof detail', next_action:'Confirm', state:'Blocked'}}};

export default {
  name:'Finance scan stays compact in Messages',
  steps:[
    {title:'Show one short line and hide the underlying proof details', run:async h=>{
      const end=/\}\)\(\);\r?\n\/\* TABLE-ALIGN/;
      const app=cuePage();
      if (!end.test(app)) throw new Error('Could not locate the original app closure.');
      const html=app.replace(end, match=>
        'window.__cueFinanceFixture=function (row) { clearTimeout(polling); state.requests=[row]; state.chat=[]; openPane({key:"t:"+row.id,type:"thread",id:row.id}); showConv(); renderChat(); };\n'+match);
      await h.page().route('https://cue.check/', r=>r.fulfill({status:200,contentType:'text/html',body:html}));
      await h.page().reload();
      await h.page().waitForFunction(()=>typeof window.__cueFinanceFixture==='function');
      await h.page().waitForFunction(()=>document.querySelector('#dot').style.background.length>0);
      await h.page().evaluate(row=>window.__cueFinanceFixture(row),sample);
      await h.page().locator('#tmsgs .agtx').getByText('Finance scan: 1923 listed · 5 OCR read · 1 to review',{exact:true}).waitFor({timeout:10000});
      if (await h.page().locator('#tmsgs').getByText('QA legacy proof detail',{exact:true}).count()) throw new Error('Proof detail visible before opening Details.');
    }},
    {title:'Details still opens and closes the original card', run:async h=>{
      const thread=h.page().locator('#tmsgs');
      await thread.getByRole('button',{name:'Details',exact:true}).click();
      await thread.getByText('QA legacy proof detail',{exact:true}).waitFor({timeout:10000});
      await thread.getByRole('button',{name:'Hide details',exact:true}).click();
      await thread.getByText('QA legacy proof detail',{exact:true}).waitFor({state:'hidden',timeout:10000});
      if (h.calls().some(fn=>!/^(cueState|cueAppUrl|cueSettings|cueCheckInfo|cueUser|cue.*Rules)$/i.test(fn))) {
        const writes=h.calls().filter(fn=>/Send|Save|Write|Approve|Edit|Delete|MarkSeen/i.test(fn));
        if (writes.length) throw new Error('Unexpected write call: '+writes.join(', '));
      }
    }}
  ]
};
