/* Finance run review: normalized, private notification records, not agent messages.
 * Scoped design: canvas-integration/specs/finance-run-notification-center.md.
 * No expense, attachment, transfer, email, or push operation in this module. */
const CUE_FIN_RUN_PREFIX_ = 'FIN_REVIEW_V1_';
function cueFinRunClean_(r) {
  const id = v => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,90}$/.test(v);
  const clean = (v,n) => typeof v === 'string' && v.length <= n && !/[\x00-\x1f\x7f]/.test(v);
  const count = v => Number.isSafeInteger(v) && v >= 0;
  const fail = () => { throw new Error('Invalid Finance scan report.'); };
  if (!r || r.version !== 1 || !id(r.run_id) || !clean(r.finished_at, 24) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.finished_at) ||
      !Number.isFinite(Date.parse(r.finished_at)) || new Date(r.finished_at).toISOString() !== r.finished_at ||
      !count(r.found) || !count(r.selected) || !count(r.read) || r.selected > 5 || r.read > r.selected ||
      r.selected > r.found || !Array.isArray(r.cards) || r.cards.length > r.read) fail();
  const seen = new Set();
  const cards = r.cards.map(c => {
    if (!c || !id(c.evidence_id) || seen.has(c.evidence_id) || !clean(c.project,120) || !clean(c.kind,40) ||
        !clean(c.date,10) || (c.amount !== null && !count(c.amount)) || !clean(c.file_name,130) ||
        (c.file_id !== '' && !/^[\w-]{10,100}$/.test(c.file_id || '')) ||
        !Array.isArray(c.options) || c.options.length > 3) fail();
    seen.add(c.evidence_id);
    const optionsSeen = new Set();
    const options = c.options.map(o => {
      if (!o || !id(o.request_id) || optionsSeen.has(o.request_id) || !clean(o.supplier,100) ||
          !clean(o.stage,60) || (o.amount !== null && !count(o.amount)) ||
          !Array.isArray(o.pairs) || !o.pairs.length || o.pairs.length > 5) fail();
      optionsSeen.add(o.request_id);
      const seenScopes = new Set();
      const pairs = o.pairs.map(p => {
        if (!p || !id(p.requirement_id) || !id(p.scope_id) || seenScopes.has(p.scope_id) ||
            !clean(p.requirement,100) || !clean(p.scope,100)) fail();
        seenScopes.add(p.scope_id);
        return { requirement_id:p.requirement_id, scope_id:p.scope_id, requirement:p.requirement, scope:p.scope };
      });
      return { request_id:o.request_id, supplier:o.supplier, stage:o.stage, amount:o.amount, pairs };
    });
    return { evidence_id:c.evidence_id, project:c.project, kind:c.kind, date:c.date, amount:c.amount,
      file_id:c.file_id, file_name:c.file_name, options };
  });
  return { version:1, run_id:r.run_id, finished_at:r.finished_at, found:r.found, selected:r.selected, read:r.read, cards };
}
function cueFinRunInsert_(store, input) {
  const run = cueFinRunClean_(input), key = CUE_FIN_RUN_PREFIX_ + run.run_id;
  const prior = store.getProperty(key);
  if (prior) {
    if (JSON.stringify(JSON.parse(prior).run) !== JSON.stringify(run)) throw new Error('Finance run ID already has a different report.');
    return false;
  }
  cueFinRunWrite_(store, key, { run, decisions:[] });
  return true;
}
function cueFinRunWrite_(store, key, record) {
  const encoded = JSON.stringify(record);
  // Reserve space below the Apps Script per-property byte limit, even for Unicode text.
  if (encodeURIComponent(encoded).replace(/%[0-9A-F]{2}/g, 'x').length > 8000) throw new Error('Finance report is too big to store.');
  store.setProperty(key, encoded);
}
function cueFinRunDecision_(store, runId, evidenceId, requestId, when) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9:_-]{1,90}$/.test(runId)) throw new Error('Finance run not found.');
  const key = CUE_FIN_RUN_PREFIX_ + runId, raw = store.getProperty(key);
  if (!raw) throw new Error('Finance run not found.');
  const saved = JSON.parse(raw), card = saved.run.cards.find(c => c.evidence_id === evidenceId);
  if (!card || !card.options.length || (requestId !== null && !card.options.some(o => o.request_id === requestId)))
    throw new Error('Pick a match from this card or Neither.');
  const prior = saved.decisions.find(d => d.evidence_id === evidenceId);
  if (prior) {
    if (prior.request_id !== requestId) throw new Error('A decision already exists for this card.');
    return prior;
  }
  const chosen = card.options.find(o => o.request_id === requestId);
  const decision = { evidence_id:evidenceId, request_id:requestId, decided_at:when, pairs:chosen ? chosen.pairs : [] };
  saved.decisions.push(decision);
  cueFinRunWrite_(store, key, saved);
  return decision;
}

// Resolve only explicit Canvas IDs; ranking is not proof and a partial join is not selectable.
function cueFinOptions_(evidence, projectId, stages, recordedRequestIds) {
  if (!evidence || !projectId || !evidence.project || evidence.project.id !== projectId)
    return { status:'project_unverified', options:[] };
  if (!Array.isArray(recordedRequestIds)) return { status:'recording_unverified', options:[] };
  if (recordedRequestIds.length) return { status:'already_recorded', options:[] };
  const indexed = rows => new Map((Array.isArray(rows) ? rows : []).map(x => [x.id,x]));
  const reqs=indexed(evidence.requests), scopes=indexed(evidence.scopes), requirements=indexed(evidence.requirements);
  const seen = new Set(), options = [];
  let incomplete = false;
  for (const m of (Array.isArray(evidence.matches) ? evidence.matches : [])) {
    if (!m || m.pid !== projectId || typeof m.id !== 'string' || seen.has(m.id)) continue;
    seen.add(m.id);
    const req = reqs.get(m.id);
    const ids = [...new Set(String(req && req.scopes || '').split(',').map(s => s.trim()).filter(Boolean))];
    const pairs = ids.map(id => {
      const s = scopes.get(id), p = s && requirements.get(s.requirement_id);
      return p ? { requirement_id:p.id, scope_id:s.id, requirement:String(p.category || p.id).slice(0,100),
        scope:String(s.category || s.description || s.id).slice(0,100) } : null;
    });
    if (!req || !pairs.length || pairs.length > 5 || pairs.includes(null)) { incomplete=true; continue; }
    const amount = typeof req.amount === 'number' ? Math.round(req.amount*100) : null;
    options.push({ request_id:req.id, supplier:String(req.supplier || req.payee || '').slice(0,100),
      stage:String(stages && Object.prototype.hasOwnProperty.call(stages,req.id) ? stages[req.id] || '' : '').slice(0,60),
      amount:Number.isSafeInteger(amount) && amount>=0 ? amount : null, pairs });
  }
  return { status:incomplete ? 'incomplete_coverage' : options.length > 3 ? 'more_candidates' : options.length ? 'choices' : 'no_verified_match',
    options: options.slice(0,3) };
}


// These app methods are opt-in. The only writer from a browser records a review decision.
function cueFinReviewEnabled_() {
  if (globalThis.CUE_CHECK_ON_) return Object.keys(cueFinReviewCheckStore_().getProperties()).length > 0;
  return cueProp_('CUE_FIN_REVIEW_V1_ENABLED', '') === 'true';
}
function cueFinReviewStore_() { return globalThis.CUE_CHECK_ON_ ? cueFinReviewCheckStore_() : PropertiesService.getScriptProperties(); }
function cueFinReviewRecords_(store) {
  const props = store.getProperties();
  return Object.keys(props).filter(k => k.indexOf(CUE_FIN_RUN_PREFIX_) === 0)
    .map(k => JSON.parse(props[k])).sort((a,b) => b.run.finished_at.localeCompare(a.run.finished_at) || a.run.run_id.localeCompare(b.run.run_id));
}
// Called only by the authenticated server-side receiver, never by google.script.run.
function cueFinReviewReceive_(packet) {
  if (globalThis.CUE_CHECK_ON_) throw new Error('Use the synthetic Finance replay in check mode.');
  if (!cueFinReviewEnabled_()) throw new Error('Finance review is off.');
  return cueLocked_(() => {
    const store = cueFinReviewStore_();
    const run = cueFinRunClean_(packet);
    if (!store.getProperty(CUE_FIN_RUN_PREFIX_ + run.run_id) && cueFinReviewRecords_(store).length >= 25)
      throw new Error('Finance review storage is full; this run was not saved.');
    return cueFinRunInsert_(store, run);
  });
}
function cueFinReviewInbox() {
  cueOwner_();
  if (!cueFinReviewEnabled_()) return { enabled:false, records:[] };
  return { enabled:true, records:cueFinReviewRecords_(cueFinReviewStore_()) };
}
function cueFinReviewConfirm(runId,evidenceId,requestId) {
  cueOwner_();
  if (!cueFinReviewEnabled_()) throw new Error('Finance review is off.');
  return cueLocked_(() => {
    const store = cueFinReviewStore_();
    cueFinRunDecision_(store,runId,evidenceId,requestId,new Date(cueNow_()).toISOString());
    const persisted = JSON.parse(store.getProperty(CUE_FIN_RUN_PREFIX_ + runId));
    const decision = persisted.decisions.find(d => d.evidence_id === evidenceId && d.request_id === requestId);
    if (!decision) throw new Error('Finance choice could not be read back.');
    return decision;
  });
}


/* Only the existing key-locked Check Cue door can seed a synthetic replay. Check storage
 * expires and is scoped to its per-run fingerprint, separate from all normal Finance state. */
function cueFinReviewCheckStore_() {
  const cache=CacheService.getScriptCache(), tag='cue-fin-check-' + cueCheckTag_() + ':';
  const k=CUE_FIN_RUN_PREFIX_+'finance-isolated-pilot';
  const assertKey = key => { if (key!==k) throw new Error('Only the synthetic Finance run is accepted in check mode.'); };
  return {
    getProperty(key) { assertKey(key); return cache.get(tag+key); },
    setProperty(key,value) { assertKey(key); cache.put(tag+key,value,2700); },
    getProperties() { const value=cache.get(tag+k); return value ? { [k]:value } : {}; }
  };
}
function cueFinReviewCheckSeed_(packet) {
  if (!globalThis.CUE_CHECK_ON_) throw new Error('Finance test seed is not available in the app.');
  if (!packet || packet.run_id !== 'finance-isolated-pilot' || !Array.isArray(packet.cards) ||
      packet.cards.some(c=>!c || c.file_id !== '' || c.project !== 'QA project'))
    throw new Error('Only synthetic Finance evidence is allowed.');
  return cueLocked_(()=>cueFinRunInsert_(cueFinReviewCheckStore_(),packet));
}
