# Cue regression tests

Read root guides. Run `node test/cue.test.js`; numbered test/features files execute in filename order in a shared harness scope and are not generally standalone test commands. Use synthetic fixtures/mocks, never live client data, credentials or real outbound sends.

test/page.js assembles the client parts; preserve include-order coverage in features/50-page-parts.js. Preserve generated-map validation in features/48-feature-map.js and regenerate the map through tools/map.mjs rather than editing it manually. Keep bridge fixtures consistent with the actual supported contract.

Reproduce a bug before fixing it where practical, cover adjacent behavior and never weaken assertions to force a pass. Record actual commands/results and browser/live gaps. Check Cue is deployment/data-mutating and requires its own authorization.
