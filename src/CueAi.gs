/* CUE-2026-10-21. DRAFT. Cue's two AIs over plain HTTP (Apps Script has no SDK): GPT through the OpenAI Responses API and
 * Claude through the Messages API. Requests are built and parsed separately so independent calls run in parallel with
 * UrlFetchApp.fetchAll (Kiko's budget: 3-5 calls, 3 minutes). Every call is logged to the Cue sheet's AI Runs tab and counted.
 * Answers must be JSON matching the caller's schema; anything else throws and nothing is guessed.
 * Script Properties (all optional except the keys):
 *   OPENAI_MODEL (default gpt-5-mini), CUE_GPT_REASONING (default low; "off" sends none), CUE_GPT_WEB_TOOL (default web_search),
 *   OPENAI_PRICE ("input,output" US$ per million tokens, to log GPT cost; Settings > AI usage and cost prices win), CUE_CLAUDE_MODEL (default claude-sonnet-5-5),
 *   CUE_CLAUDE_EFFORT (default medium). */

const CUE_OPENAI_URL_ = 'https://api.openai.com/v1/responses';
const CUE_CLAUDE_URL_ = 'https://api.anthropic.com/v1/messages';
// US$ per million tokens [input, output], Anthropic list prices 2026-10.
const CUE_CLAUDE_PRICE_ = { 'claude-haiku-5-5': [0.10, 0.50], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20] };

function cueKey_(name) {
  const k = cueProp_(name, '');
  if (!k) throw new Error(name + ' is not set in Cue\'s Script Properties.');
  return k;
}

/** Teach Cue (CueTeach.gs): Kiko's matching facts and process, added to every call's instructions. memory: false leaves them out. */
function cueTeachAdd_(o) { return o.memory === false ? '' : cueTeachFor_(String(o.step || '') + ' ' + String(o.user || ''), String(o.step || '')); }

/** o = { step, system, user, schema, name, web?, maxTokens?, parts?, memory? } -> a call for cueAiAll_. parts = extra content (attachments). */
function cueGpt_(o) {
  const model = cueProp_('OPENAI_MODEL', 'gpt-5-mini'), effort = cueProp_('CUE_GPT_REASONING', 'low');
  const body = { model, instructions: String(o.system) + cueTeachAdd_(o), input: o.parts && o.parts.length ? [{ role: 'user', content: [{ type: 'input_text', text: String(o.user) }].concat(o.parts) }] : String(o.user), store: false, max_output_tokens: o.maxTokens || 6000,
    text: { format: { type: 'json_schema', name: o.name || 'answer', strict: true, schema: o.schema } } };
  if (effort !== 'off') body.reasoning = { effort };
  if (o.web) body.tools = [{ type: cueProp_('CUE_GPT_WEB_TOOL', 'web_search') }];
  return { step: o.step, provider: 'GPT', model, parse: cueGptParse_,
    req: { url: CUE_OPENAI_URL_, method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + cueKey_('OPENAI_API_KEY') } } };
}
function cueGptParse_(code, msg) {
  if (code !== 200 || !msg) throw new Error('HTTP ' + code + (msg && msg.error ? ' ' + String(msg.error.message || msg.error.type || '').slice(0, 200) : ''));
  if (msg.status && msg.status !== 'completed') throw new Error('GPT did not finish (' + msg.status + (msg.incomplete_details ? ': ' + msg.incomplete_details.reason : '') + ')');
  const parts = [].concat.apply([], (msg.output || []).filter(x => x && x.type === 'message').map(x => x.content || []));
  if (parts.some(p => p.type === 'refusal')) throw new Error('GPT refused the request');
  const text = parts.filter(p => p.type === 'output_text').map(p => p.text).join('');
  let data; try { data = JSON.parse(text); } catch (e) { throw new Error('GPT answered with something that is not JSON'); }
  const u = msg.usage || {};
  return { data, model: msg.model, input: u.input_tokens || 0, output: u.output_tokens || 0,
    web: (msg.output || []).filter(x => x && x.type === 'web_search_call').length };
}

/** o = { step, system, user, schema, effort?, maxTokens?, parts?, partsFirst? } -> a call for cueAiAll_. parts = Messages API content blocks
 * (documents, images): after the text by default (supplier registration), before it when partsFirst (personal expense second look). */
function cueClaude_(o) {
  const model = o.model || cueProp_('CUE_CLAUDE_MODEL', 'claude-sonnet-5-5');   // model: a cheap step names its own (New mail sort: Haiku)
  const body = { model, max_tokens: o.maxTokens || 8000, system: String(o.system) + cueTeachAdd_(o), messages: [{ role: 'user', content: o.parts && o.parts.length
    ? (o.partsFirst ? o.parts.concat([{ type: 'text', text: String(o.user) }]) : [{ type: 'text', text: String(o.user) }].concat(o.parts)) : String(o.user) }],
    output_config: { effort: o.effort || cueProp_('CUE_CLAUDE_EFFORT', 'medium'), format: { type: 'json_schema', schema: o.schema } } };
  return { step: o.step, provider: 'Claude', model, parse: cueClaudeParse_,
    req: { url: CUE_CLAUDE_URL_, method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
      headers: Object.assign({ 'x-api-key': cueKey_('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
        // An organization-wide key must name its workspace (Kiko's key at 05:47Z said so); a workspace key needs nothing.
        cueProp_('ANTHROPIC_WORKSPACE_ID', '') ? { 'anthropic-workspace-id': cueProp_('ANTHROPIC_WORKSPACE_ID', '') } : {}) } };
}
function cueClaudeParse_(code, msg) {
  if (code === 400 && msg && msg.error && /workspace/i.test(String(msg.error.message || ''))) throw new Error('the Anthropic key is not tied to a workspace. '
    + 'Either make a new key inside a workspace at console.anthropic.com and save it as ANTHROPIC_API_KEY, or add the Script Property ANTHROPIC_WORKSPACE_ID with the workspace ID (wrkspc_...).');
  if (code !== 200 || !msg) throw new Error('HTTP ' + code + (msg && msg.error ? ' ' + msg.error.type + ': ' + String(msg.error.message || '').slice(0, 200) : ''));
  if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') throw new Error('Claude did not finish the answer (' + msg.stop_reason + ')');
  const text = (msg.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('');
  let data; try { data = JSON.parse(text); } catch (e) { throw new Error('Claude answered with something that is not JSON'); }
  const u = msg.usage || {};
  return { data, model: msg.model, input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), output: u.output_tokens || 0 };
}

/**
 * Runs AI calls in parallel. A 429 or 5xx gets one more try (counted, since Kiko's metric counts API calls).
 * Returns one {ok, data, error} per call, in order, so one failed call never hides the others.
 */
function cueAiAll_(s, calls) {
  if (!calls.length) return [];
  const t0 = cueNow_();
  let res = UrlFetchApp.fetchAll(calls.map(c => c.req));
  cueCount_(s, calls.length);
  const retry = res.map((r, i) => (r.getResponseCode() === 429 || r.getResponseCode() >= 500 ? i : -1)).filter(i => i >= 0);
  if (retry.length) {
    Utilities.sleep(2000);
    const again = UrlFetchApp.fetchAll(retry.map(i => calls[i].req));
    cueCount_(s, retry.length);
    retry.forEach((i, j) => { res[i] = again[j]; });
  }
  const secs = Math.round((cueNow_() - t0) / 100) / 10;
  return calls.map((c, i) => {
    const code = res[i].getResponseCode();
    let msg = null; try { msg = JSON.parse(res[i].getContentText()); } catch (e) { msg = null; }
    try {
      const out = c.parse(code, msg);
      cueAiLog_(s, c, out.model || c.model, out.input, out.output, secs, 'OK', out.web ? out.web + ' web searches' : '');
      return { ok: true, data: out.data };
    } catch (e) {
      const why = String((e && e.message) || e).slice(0, 300);
      cueAiLog_(s, c, c.model, 0, 0, secs, 'Failed', why);
      return { ok: false, error: c.provider + ' (' + c.step + '): ' + why };
    }
  });
}
function cueCount_(s, n) { const m = s.metrics || (s.metrics = { ai_calls: 0, calls: [] }); m.ai_calls = (m.ai_calls || 0) + n; }

/** US$ for the Cost column, from the same price table as Settings > AI usage and cost (CueUsage.gs). Blank when the model has no price. */
function cueAiCost_(provider, model, inTok, outTok, web) {
  const c = cueUsageCost_(cueUsagePrices_(), provider, model, inTok, outTok, web);
  return c === null ? '' : Math.round(c * 10000) / 10000;
}
/** Logs one call. Never fails the caller. The page shows the per-call list as the Working on hand-off. */
function cueAiLog_(s, c, model, inTok, outTok, secs, status, note) {
  const m = s.metrics || (s.metrics = { ai_calls: 0, calls: [] });
  (m.calls || (m.calls = [])).push({ step: c.step, provider: c.provider, seconds: secs, status });
  try { cueSheet_('AI Runs').appendRow([new Date(cueNow_()), s.id, c.step, c.provider, model || '', inTok, outTok,
    cueAiCost_(c.provider, model, inTok, outTok, cueUsageWeb_(note)), secs, status, String(note || '').slice(0, 300)]); }
  catch (e) { console.error('AI Runs log: ' + e); }
}
