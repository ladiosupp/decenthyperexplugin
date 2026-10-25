# HyperEx Pulse Filter0.1.59

Current release based on delivered1.58, incorporating changes since GitHub1.54. Install over the same plugin; preserve LUT, history and command seeds. No new calibration or dedicated coffee acceptance is needed.1.59 has simulation validation, not hardware validation.

## Live control budgets

Each shot allows up to2000 checks across S2+S3. Write limits are separate; all initial writes and retries consume the write budget.

|Level|Check interval|Check cap|Write cap|
|---|---|---|---|
|1|planned S2+S3/50, min300ms; default944ms|2000|50|
|2|300ms|2000|150|
|3|250ms|2000|200|
|4|200ms|2000|250|

Level1 retains its original cadence formula, not a2000th-of-duration interval. Diagnostics provides a4-position slider; native plugin settings provide a dropdown. Enable remains default OFF. Changing level does not enable it. Diagnostics/exports show separate counts. Exhausting writes leaves checks running until normal termination or check cap; pending final writes retain ACK/target watchdogs. Natural final weight/total-time/pressure/scale guards take precedence. Raw scale acquisition rate is unchanged.

A010 current-frame writes remain one native1/16ml/s quantum from the last confirmed command, per-frame±20%, with fresh1.6s regression,6unique samples,1.2s span,R²≥.90,±6% deadband, pressure/actuator headroom and one outstanding write. At least max(2s,2check periods) between correction attempts. ACK without target feedback: tolerate3 consecutive misses, stop on fourth; matching feedback resets streak. Unconfirmed targets retry identically without accumulating quanta; direction reversal holds unresolved command. No missing-ACK bypass. No extra skipStep. Full original application profile restored after raw writes at Idle before another shot may arm.

## Temperature and learning

Adjust an existing HyperEx curve's brew temperature on the home page. Fresh workflow read adopts valid uniform70–100°C temperature before generating/upserting the profile, so it is not reset to92°C. Plugin Temperature is INITIAL DEFAULT for new profiles; diagnostic page shows current effective value. Active-shot temperature is not changed by this plugin. Reload retains the home temperature through the saved workflow.

Temperature alone does not reset LUT, empty qualification, coffee context, seed or numeric-history eligibility. Prior cups at other temperatures are eligible for numeric learning. Their original temperature metadata remains unchanged. Existing basket-context, LUT/targets, multiplier, pressure limits, same-command/shape/timing, regression quality, actuator quality, variability, consensus and bounded-correction rules still apply. Temperature is no longer an independent history veto; inclusion is not guaranteed numeric adjustment when another quality gate fails. Exact storage/readback checks still include full original metadata.

## Startup and evidence

Retain physical GHC confirmation. Added20s cup-gain startup watchdog removed; original GHC countdown/retries/timeout,pressure/no-scale/total-run/final-weight guards remain. Optional legacy raw startup switch stays OFF; GHC/unknown capability skips redundant A002. REST and raw write the same requestedState; no interlock/flag modification is implemented.

1.57 user evidence: level3,checks200/200,writes8,ACK8,target responses5,misses3,streak3,retries2,then old check budget ended. At94°C, coffee context and shaped seed reverted to EMPTY/LUT; simulation reproduced the92→94 fingerprint path.1.58 fixed home temperature and qualification;1.59 extends temperature compatibility to numeric learning and separates2000 checks from write caps. Do not compare these hardware curves as identical starting trajectories, or claim raw ACK alone proves cup-response convergence.

## Validation

190/190 Node simulations pass, including generated HTML scripts compiling, slider shared-settings save, temperature persistence/races/seed preservation, cross-temperature numeric consensus and bounded auto-application, pressure exclusion, separate write caps, checks beyond200 and2000 hard cap, missing-target tolerance and profile restoration. Browser visual rendering unavailable: Chromium not installed. No1.59 hardware result received.

Run: node --check plugin.js; node tests/verify_v0159.cjs. See HANDOFF_v0159.md and tests/RESULTS_v0159.txt. LICENSE and calibration JSON contents are preserved. This package was finalized before its authorized GitHub upload; the release commit records upload completion.
