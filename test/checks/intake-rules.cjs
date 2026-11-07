// Rules the intake-real check applies to what intake produced (backlog card intake-real-check, spec approved by Kiko 7 Nov 2026 13:59Z).
// R1 to R3 are Kiko's own answers, recorded in docs/business-rules.md as CUE-047 to CUE-049:
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

/** Event fields that phase 1 left blank but the draft fills in instead of writing TBC (Cue 1.27.72 fix). */
function tbcBreaks(rfq, event) {
  const e = event || {}, body = String((rfq && rfq.body) || ''), out = [];
  const blank = v => v === 0 || v === '0' || !String(v == null ? '' : v).trim();
  if (!/\bTBC\b/.test(body) && ['date', 'venue', 'city', 'pax'].some(k => blank(e[k]))) {
    out.push('event details are blank (' + ['date', 'venue', 'city', 'pax'].filter(k => blank(e[k])).join(', ') + ') but the draft never says TBC');
  }
  if (blank(e.pax) && /\b(?:pax|guests?|attendees?)\s*:?\s*0\b/i.test(body)) out.push('says 0 pax instead of TBC');
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
  return { client, client_in_inquiry: !client || namedIn(src, client) || namedIn(String((source && source.from) || '').replace(/[@.]/g, ' '), client),
    event, event_in_inquiry: !event || words(event).filter(w => w.length >= 4).some(w => namedIn(src, w)) };
}

module.exports = { rfqBreaks, tbcBreaks, supplierBreaks, readBack, namedIn, mentions };
