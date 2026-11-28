'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), a=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'..','src','CueFinanceReview.gs'),'utf8');
const c=vm.createContext({}); vm.runInContext(code,c);
const properties={};
const store={getProperty:k=>properties[k]??null,setProperty:(k,v)=>{properties[k]=v;}};
const testTime='2026-11-28T13:00:00.000Z';
const pair={requirement_id:'REQ-1',scope_id:'SCP-1',requirement:'Logistics',scope:'Delivery'};
const option={request_id:'AP-1',supplier:'Test Logistics',stage:'Deposit',amount:250000,pairs:[pair]};
const card={evidence_id:'proof-1',project:'Sample',kind:'Receipt',date:'2026-11-28',amount:250000,
 file_id:'synthetic_file_1',file_name:'Sample.pdf',options:[option,{...option,request_id:'AP-2',stage:'Final balance'}]};
const run={version:1,run_id:'qa-run',finished_at:testTime,found:4,selected:2,read:2,cards:[card,{...card,evidence_id:'proof-2'}]};
a.throws(()=>c.cueFinRunInsert_(store,{...run,read:0}),/Invalid/);
a.throws(()=>c.cueFinRunInsert_(store,{...run,cards:[card,card]}),/Invalid/);
a.equal(c.cueFinRunInsert_(store,run),true);
a.equal(c.cueFinRunInsert_(store,run),false);
a.throws(()=>c.cueFinRunInsert_(store,{...run,found:5}),/different report/);
a.throws(()=>c.cueFinRunDecision_(store,'qa-run','proof-1','AP-other',testTime),/Pick a match/);
const saved=c.cueFinRunDecision_(store,'qa-run','proof-1','AP-2',testTime);
a.equal(saved.pairs[0].scope_id,'SCP-1');
a.equal(saved.request_id,'AP-2');
a.equal(c.cueFinRunDecision_(store,'qa-run','proof-1','AP-2','later').decided_at,testTime);
a.throws(()=>c.cueFinRunDecision_(store,'qa-run','proof-1','AP-1',testTime),/already exists/);
a.equal(c.cueFinRunDecision_(store,'qa-run','proof-2',null,testTime).request_id,null);
a.equal(c.cueFinRunInsert_(store,run),false);
const serialized=Object.values(properties);
a.equal(serialized.length,1);
const persisted=JSON.parse(serialized[0]);
a.deepEqual(persisted.decisions.map(x=>x.request_id),['AP-2',null]);
a.deepEqual(persisted.decisions[0].pairs,[pair]);
console.log('Finance review storage: 14 assertions passed.');
const ev={project:{id:'P1'},matches:[{id:'AP-X',pid:'P2'},{id:'AP-2',pid:'P1'},{id:'AP-1',pid:'P1'}],
 requests:[{id:'AP-1',scopes:'SCP-1',amount:2500,supplier:'Example'},{id:'AP-2',scopes:'SCP-1, SCP-2',amount:2500,supplier:'Example'}],
 scopes:[{id:'SCP-1',requirement_id:'REQ-1',category:'Delivery'},{id:'SCP-2',requirement_id:'REQ-1',category:'Toll'}],
 requirements:[{id:'REQ-1',category:'Logistics'}]};
const opt=(e=ev,rec=[])=>JSON.parse(JSON.stringify(c.cueFinOptions_(e,'P1',{'AP-1':'Deposit','AP-2':'Balance'},rec)));
a.equal(opt().status,'choices');
a.deepEqual(opt().options.map(o=>o.request_id),['AP-2','AP-1']);
a.deepEqual(opt().options[0].pairs.map(p=>p.scope_id),['SCP-1','SCP-2']);
a.equal(opt().options[0].stage,'Balance');
a.deepEqual(opt(ev,['AP-1','AP-2']),{status:'already_recorded',options:[]});
a.deepEqual(opt(ev,null),{status:'recording_unverified',options:[]});
a.deepEqual(opt({...ev,scopes:ev.scopes.slice(0,1)}).options.map(x=>x.request_id),['AP-1']);
a.equal(opt({...ev,scopes:[]}).status,'incomplete_coverage');
console.log('Canvas match mapping: 8 assertions passed.');


const pilot=JSON.parse(fs.readFileSync(path.join(__dirname,'finance-review-pilot.fixture.json'),'utf8').replace(/^\uFEFF/,''));
let owner=true, enabled=true;
Object.assign(c,{cueOwner_:()=>{if(!owner)throw new Error('owner only');},cueProp_:()=>enabled?'true':'',
  cueLocked_:fn=>fn(),cueNow_:()=>Date.parse(testTime),
  PropertiesService:{getScriptProperties:()=>({...store,getProperties:()=>({...properties})})}});
enabled=false;
a.deepEqual(JSON.parse(JSON.stringify(c.cueFinReviewInbox())),{enabled:false,records:[]});
a.throws(()=>c.cueFinReviewReceive_(pilot),/off/);
enabled=true;
a.equal(c.cueFinReviewReceive_(pilot),true);
a.equal(c.cueFinReviewReceive_(pilot),false);
owner=false;
a.throws(()=>c.cueFinReviewInbox(),/owner only/);
a.throws(()=>c.cueFinReviewConfirm(pilot.run_id,'evidence-qa1','AP-QA1'),/owner only/);
owner=true;
a.equal(c.cueFinReviewInbox().records.filter(r=>r.run.run_id===pilot.run_id).length,1);
a.equal(c.cueFinReviewConfirm(pilot.run_id,'evidence-qa1','AP-QA1').request_id,'AP-QA1');
const replay=c.cueFinReviewInbox().records.find(r=>r.run.run_id===pilot.run_id);
a.equal(replay.decisions[0].pairs[0].requirement_id,'REQ-QA1');
a.equal(replay.decisions[0].pairs[0].scope_id,'SCP-QA1');
const assembled=require('./page').cuePage(), start=assembled.indexOf('<script>'), end=assembled.lastIndexOf('</script>');
a.ok(start>=0&&end>start);
new vm.Script(assembled.slice(start+8,end));
a.ok(assembled.includes('id="fin-notifications"'));
console.log('Real synthetic n8n output accepted once; owner gate and readback passed with simulated Apps Script.');


const cached=new Map();
Object.assign(c,{cueCheckTag_:()=> 'synthetic-tag',CacheService:{getScriptCache:()=>({
 get:k=>cached.get(k)??null,put:(k,v)=>cached.set(k,v)
})}});
a.throws(()=>c.cueFinReviewCheckSeed_(pilot),/not available/);
const prodBefore=Object.keys(properties).length;
c.CUE_CHECK_ON_=true;
a.equal(c.cueFinReviewInbox().enabled,false);
a.throws(()=>c.cueFinReviewReceive_(pilot),/synthetic Finance replay/);
a.throws(()=>c.cueFinReviewCheckSeed_({...pilot,cards:[{...pilot.cards[0],file_id:'realFileId123'}]}),/Only synthetic/);
a.equal(c.cueFinReviewCheckSeed_(pilot),true);
a.equal(c.cueFinReviewCheckSeed_(pilot),false);
a.equal(c.cueFinReviewInbox().records.length,1);
a.equal(c.cueFinReviewConfirm(pilot.run_id,'evidence-qa1','AP-QA1').request_id,'AP-QA1');
a.equal(Object.keys(properties).length,prodBefore);
a.equal(c.cueFinReviewInbox().records[0].decisions.length,1);
c.cueCheckTag_=()=> 'independent-check';
a.equal(c.cueFinReviewInbox().enabled,false);
console.log('Check Cue seed is synthetic-only, deduplicated, and isolated from normal app state.');
