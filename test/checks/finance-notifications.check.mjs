import fs from 'node:fs';
const sample = JSON.parse(fs.readFileSync(new URL('../finance-review-pilot.fixture.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
export default {
  name: 'Finance Notifications: synthetic n8n replay',
  steps: [
    { title:'Replay the n8n result twice without adding Messages', run:async h=>{
      const seed=()=>h.door('check_call',{fn:'cueFinReviewCheckSeed_',args:[sample]});
      const first=await seed(), repeat=await seed();
      if(!first.ok||first.result!==true||!repeat.ok||repeat.result!==false) throw new Error('Expected one inserted scan and one duplicate.');
      await h.page().reload();
      await h.page().locator('#fin-notifications-open').click();
      if(await h.page().locator('[data-fin-run]').count()!==1) {
        await h.page().locator('[data-fin-run]').first().waitFor({state:'visible'});
        if(await h.page().locator('[data-fin-run]').count()!==1) throw new Error('Expected just one alert.');
      }
      const chat=await h.door('check_call',{fn:'cueState',args:[]});
      if(!chat.ok||JSON.stringify(chat.result.chat).includes(sample.run_id)||JSON.stringify(chat.result.chat).includes('QA project')) throw new Error('Could not verify Messages separation.');
    }},
    { title:'Confirm only the listed Requirement and Scope', run:async h=>{
      await h.page().locator('[data-fin-run]').click();
      const cards=h.page().locator('#fin-notifications .card');
      if(await cards.count()!==2) throw new Error('Expected two transaction cards.');
      await h.see('Logistics → Delivery');
      await cards.first().locator('input[value="0"]').check();
      await cards.first().getByRole('button',{name:'Confirm match'}).click();
      await h.see('Match confirmed. No payment posted.');
      const read=await h.door('check_call',{fn:'cueFinReviewInbox',args:[]});
      const d=read.result?.records[0]?.decisions[0];
      if(!read.ok||d?.request_id!=='AP-QA1'||d.pairs[0]?.requirement_id!=='REQ-QA1'||d.pairs[0]?.scope_id!=='SCP-QA1') throw new Error('Exact selection did not read back.');
    }}
  ]
};
