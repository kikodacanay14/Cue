/* CUE-CLOUD-CHECK-2026-10-27. The check link's lock values. In src/ and in every live, /dev and relay version they stay empty,
 * so the check door (CueCheck.gs) refuses every call there. tools/check.mjs fills them only in the copy it pushes for the one
 * "Cue check" version of a check run: the SHA-256 of that run's key, when the run ends, the Canvas test project and the
 * test email addresses, and whether the run may email anyone ('on' or 'no'). The "off" version sets CUE_CHECK_FP_ = 'off'. Never edit these by hand. */
const CUE_CHECK_FP_ = '';
const CUE_CHECK_UNTIL_ = 0;
const CUE_CHECK_PID_ = '';
const CUE_CHECK_MAIL_ = '';
const CUE_CHECK_SEND_ = '';
