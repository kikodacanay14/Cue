# Cue application source

Read root guides first. Apps Script files share globals. Index.html assembles IndexStyle, IndexChat, IndexViewer, IndexThreads, IndexPages and IndexCards in that order; client parts share one JavaScript scope. Preserve include order, exposed handlers and cross-part state; check the assembled page, not isolated snippets.

Read both sides of a changed Canvas bridge contract and update matching fixtures/schema version only when justified. Retain exact approval, send, deduplication and signing boundaries, including narrowly documented automatic exceptions; do not generalize them. Apply verified BSE rules and rule-ID references from ../docs/business-rules.md. Never exercise real sends or production writes as a regression check.
