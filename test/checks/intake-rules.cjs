// Rules the intake-real check applies to what intake produced (backlog card intake-real-check, spec approved by Kiko 7 Nov 2026 13:59Z).
// R1 to R3 are Kiko's own answers, recorded in docs/business-rules.md as CUE-048:
//   R1 an RFQ to a supplier never names the client (Kiko 7 Nov 2026 13:37Z "1. yes", confirmed 13:38Z);
//   R2 an RFQ to a supplier never states a price or budget (same answer);
//   R3 an RFQ to a supplier never mentions other suppliers (Kiko 7 Nov 2026 13:59Z, "Yes").
// The check only reports these; nothing here blocks anything in Cue. Plain CommonJS so test/features can load it too.
'use strict';

const LEGAL = /\b(inc|corp|corporation|co|company|ltd|limited|llc|opc|phils?|philippines|the|and|of)\b\.?/gi;
const words = s => String(s || '').toLowerCase().replace(LEGAL, ' ').split(/[^a-z0-9ñ]+/).filter(w => w.length >= 2);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** True when every word of the name (legal suffixes dropped) appears in the text as a whole word. */
function namedIn(text, name) {
  const w = words(name), t = ' ' + String(text || '').toLowerCase() + ' ';
  return w.length > 0 && w.every(x => new RegExp('(^|[^a-z0-9ñ])' + esc(x) + '($|[^a-z0-9ñ])').test(t));
}

// R2: a money amount ("PHP 5,000", "₱5000", "P50,000", "Php 1.2M", "50k pesos") or the word budget.
const MONEY = [
  /(?:\bphp|₱)\s?\d/i,
  /(?:^|[^A-Za-z0-9])P\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/,     // P50,000 (a thousands comma tells it from "P1 lighting")
  /(?:^|[^A-Za-z0-9])P\s?\d{4,}(?:\.\d+)?\b/,                 // P50000
  /\b\d+(?:\.\d+)?\s?(?:k|m)\s?(?:pesos?|php)\b/i,           // 50k pesos
  /\b\d[\d,]*(?:\.\d+)?\s?pesos?\b/i,                        // 5,000 pesos
  /\bbudget\b/i
];

// Words too common to stand for a client on their own ("Sound" in "sound system", "Events" in any RFQ).
const GENERIC = new Set(['events', 'event', 'group', 'holdings', 'realty', 'sound', 'lights', 'lighting', 'services', 'solutions', 'global',
  'international', 'management', 'productions', 'production', 'marketing', 'trading', 'enterprises', 'enterprise', 'philippine', 'manila',
  'bank', 'foods', 'food', 'motors', 'systems', 'media', 'creative', 'studio', 'studios', 'design', 'digital', 'center', 'centre']);
/** A whole name as written (case ignored), or for the client also its first distinctive word ("Moldex" for "Moldex Realty Inc"). */
function mentions(text, name, distinctive) {
  const t = String(text || '').toLowerCase(), n = String(name || '').toLowerCase().replace(/[.,]+$/, '').trim();
  if (n && new RegExp('(^|[^a-z0-9ñ])' + esc(n) + '($|[^a-z0-9ñ])').test(t)) return true;
  if (!distinctive) return false;
  const first = words(name)[0];
  return !!first && first.length >= 4 && !GENERIC.has(first) && namedIn(t, first);
}

/**
 * Every R1 to R3 break in one RFQ draft. rfq: {supplier, body, subject}; ctx: {client, suppliers} where suppliers is
 * every supplier name in this intake's RFQs. Returns a list of plain reasons; empty means the draft keeps all three rules.
 */
function rfqBreaks(rfq, ctx) {
  const text = String((rfq && rfq.subject) || '') + '\n' + String((rfq && rfq.body) || ''), out = [];
  const client = String((ctx && ctx.client) || '').trim();
  if (client && mentions(text, client, true)) out.push('R1 names the client (' + client + ')');
  const m = MONEY.map(re => text.match(re)).find(Boolean);
  if (m) out.push('R2 states a price or budget ("' + m[0].trim() + '")');
  const self = String((rfq && rfq.supplier) || '');
  ((ctx && ctx.suppliers) || []).filter(n => n && words(n).join(' ') !== words(self).join(' ') && mentions(text, n, false))
    .forEach(n => out.push('R3 names another supplier (' + n + ')'));
  return out;
}

/**
 * Event fields that phase 1 left blank but the draft fills in instead of writing TBC (Cue 1.27.72 fix). Each blank field is
 * checked on its own: a labelled line ("Date: 5 December") must say TBC, and with no labelled line the draft must say TBC somewhere.
 */
const TBC_LABEL = { date: '(?<!due |quote |deadline )date', venue: 'venue', city: 'city', pax: '(?:expected\\s+)?pax|guests?|attendees?' };
function tbcBreaks(rfq, event) {
  const e = event || {}, body = String((rfq && rfq.body) || ''), out = [];
  const blank = v => v === 0 || v === '0' || !String(v == null ? '' : v).trim();
  const missing = [];
  ['date', 'venue', 'city', 'pax'].filter(k => blank(e[k])).forEach(k => {
    const said = body.match(new RegExp('\\b(?:' + TBC_LABEL[k] + ')\\s*:\\s*([^,.;\\n]*)', 'i'));
    if (said ? !/\bTBC\b/i.test(said[1]) : !/\bTBC\b/.test(body)) missing.push(k + (said ? ' ("' + said[1].trim() + '")' : ''));
  });
  if (missing.length) out.push('event details are blank in phase 1 but the draft does not say TBC for: ' + missing.join(', '));
  return out;
}

/** AC4: each RFQ's supplier is one phase 3 named for that RFQ's lines (from Canvas's evidence, or found and marked new). */
function supplierBreaks(rfq, lines) {
  const keys = (rfq && rfq.keys) || [], self = words(rfq && rfq.supplier).join(' ');
  const ok = (lines || []).filter(l => !keys.length || keys.indexOf(l.key) >= 0)
    .some(l => (l.suppliers || []).some(x => words(x.name || x).join(' ') === self));
  return ok ? [] : ['supplier ' + (rfq && rfq.supplier) + ' is not one phase 3 named for lines ' + (keys.join(', ') || '(none)')];
}

/** AC2: the phase 1 client and event, side by side with the inquiry, and whether each was read from it. */
function readBack(card, source) {
  const src = [source && source.from, source && source.subject, source && source.text].join('\n');
  const client = String((card && card.client) || ''), event = String((card && card.event && card.event.name) || '');
  const from = String((source && source.from) || '').replace(/[@.]/g, ' ');
  // "Asian Development Bank (ADB)": the name outside the brackets, or the short name inside them, counts as read from the inquiry.
  const forms = [client].concat(client.match(/^(.*?)\s*\(([^)]+)\)\s*$/) ? client.match(/^(.*?)\s*\(([^)]+)\)\s*$/).slice(1) : []).filter(Boolean);
  // Event words of 4 letters or more; a name made only of short words ("IRT YEP") uses all of them.
  const long = words(event).filter(w => w.length >= 4), ev = long.length ? long : words(event).filter(w => w.length >= 3);
  // An inquiry with attachments: intake also read the files, which the check cannot see. A name not in the email text is then
  // 'unverified', not false: the check reports it but does not fail on it.
  const miss = (source && Number(source.files) > 0) ? 'unverified' : false;
  return { client, client_in_inquiry: !client || forms.some(f => namedIn(src, f) || namedIn(from, f)) || miss,
    event, event_in_inquiry: !event || ev.some(w => namedIn(src, w)) || miss };
}

module.exports = { rfqBreaks, tbcBreaks, supplierBreaks, readBack, namedIn, mentions };
