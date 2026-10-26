# HyperEx Pulse Filter0.1.61

Based on delivered/GitHub1.60. Install over the same plugin; preserve LUT/history/seed. No new calibration or dedicated coffee acceptance. Simulation validation only; no1.61 hardware result yet.

## Recoverable target-feedback loss (1.61)

Missing target feedback alone no longer terminates live trim after the fourth consecutive miss. First three misses allow the existing exact-target retry path. From the fourth, continue normal level-cadence checks but retry the SAME unresolved target no sooner than3s after its last send. Matching actual frame/target resets the streak and restores normal decision cadence. ACK is still mandatory; lack of target response never advances the known command or stacks flow increments.

Fresh scale endpoint, RAW regression, frame, machine data, pressure and actuator guards apply to every retry. If error reverses, hold the unresolved command; if output enters the2% band, keep observing without resending. Discard old-frame retries on transition before another send. All retries count toward the existing write cap; recovery resets neither budget. Check cap/shot completion/transport failure can still end trim. Missing driver ACK retains the original abort path. A whole-cup good result does not manufacture a per-write confirmation or normalized learning evidence.

Only target-feedback recovery is changed here. S2 learning admission/coverage rules remain1.60 behavior; its ambiguous admission-reason text remains a separate follow-up issue.

## Everyday self-diagnosis

Diagnostics now includes 本杯控制诊断: actual RAW stage-wide error, final60% mean/error, ripple CV, RMSE and observed overshoot, followed by stage learning-admission reasons and action-group comparisons. Routine use does not require sending screenshots/CSV. Export remains optional for unusual failures or deeper engineering review.

Outcome labels are heuristics: final60% absolute mean error≤8% and ripple CV≤10% -> target tracking/smoothness good. These are not a certified physical-performance standard. Stage-wide error and tail metrics are separate so startup ramp loss is not confused with a stable plateau error. Metrics are g/s from source-scale regressions, not DE1 ml/s commands. Group writes within3s on the same frame; use clean pre/post RAW windows when available. Overlapping actions are evaluated as a group, never falsely assigned individual causal success. Insufficient windows retain an explicit reason. Raw output quality remains visible even when command attribution is unavailable.

## Live-trim evidence can enter normal learning

The old last-write+2s settle+5s single-command-only gate no longer excludes a whole corrected phase. Current learning uses all fresh, observed machine-target epochs, including earlier valid windows before a late unconfirmed attempt. Machine target must correspond to the quantized initial command or a bounded prior written target for that frame; local send/ACK alone is not enough.

Constant epochs: allow750ms settling,≥6unique RAW source timestamps,≥1.2s regression,R²≥.90. Pool usable windows; S2 needs≥2.4s; shaped S3 needs≥1.2s per frame and≥5s overall. Require≥25% regional temporal coverage and keep a robust normalized-response cohort (within25% of median, at least60% of usable candidate duration).

If fast target changes leave too little fixed-epoch data, use contiguous source-time windows (about2s) and integrate actual observed target/starting-seed exposure. Both RAW time regression and exposure regression require R²≥.90; gaps/tare/duplicates do not create evidence. Normalization is a LOCAL PROPORTIONAL RESPONSE MODEL, not an exact hydraulic-delay model or measured physical law. Results are explicitly labelled and kept separate from original RAW diagnostics. Same seed/target/compatible frame-basis, two-cup consistency, variability and bounded next-shot correction still apply. Known S3 stalls are not normalized away.

Pressure/actuator protection uses actual observed dynamic targets rather than incorrectly treating every changed command as the shot-start command:≥80% fresh target/frame coverage,≥4 machine samples,hold if≥20% near pressure limit or≥25% actual flow below70% of target. Unknown targets,stale machine data,insufficient source samples or poor regressions show specific reasons. No LUT rewriting. Old compact records without enough original data are not fabricated into new evidence; existing valid compatible evidence remains usable, including different temperatures.

## Tolerances and timing

- Live cup-flow target band±2%; ordinary next-shot S1/S2 deadband±8% and S3 LEVEL threshold8%. S1 startup-quality gates and all correction bounds unchanged. Historical empty qualification/calibration search thresholds remain separate.
- The stock-DE1 A010 quantum remains1/16ml/s.±2% is a target, not guaranteed accuracy. Dynamic hydraulic smoothing might help but pure delay does not suppress ripple. No forced fixed-frequency dithering or invented measured delay is implemented.
- Successful write: require BOTH driver ACK and matching frame/target, then release wait after minimum50ms. Another correction is considered only on the next level tick with a new source-scale endpoint.50ms is not a mandatory50ms write loop.
- Missing response keeps original max(2s,2check periods) fault deadline. Missing driver ACK -> Idle abort. ACK but missing target -> exact-target retries; after3 misses use recoverable3s retry spacing rather than stopping trim. No blind quantum accumulation. Matching feedback resets streak. One pending write,per-frame±20%,pressure/data guards remain.

## Budgets and retained behavior

|Level|Check cadence|Check cap S2+S3|Write cap including retries|
|---|---|---|---|
|1|planned duration/50,minimum300ms; default944ms|2000|50|
|2|300ms|2000|150|
|3|250ms|2000|200|
|4|200ms|2000|250|

Four-position diagnostic slider; native settings dropdown. Enable default OFF. Budgets are software caps, not hardware limits or required write counts. Full profile restored at Idle before rearming after live writes. Normal physical GHC start confirmation and original pressure/no-scale/total-time/final-weight guards retained. Home temperature persists via selected workflow; temperature alone does not reset LUT/coffee context or exclude historical numeric evidence.

## Validation

219/219 Node simulations pass, including repeated feedback loss, cooldown/freshness/direction/write-cap gates, automatic late-feedback recovery, S2→S3 retry disposal, unchanged ACK abort and generated HTML script compilation, controlled S2 normalized evidence -> bounded auto-application, all corrected S3 frames, rapid-target exposure fallback, late unconfirmed writes retaining earlier data, pressure/stale/unknown/duplicate/bad-regression rejection, successful feedback release/new-source/50ms and missing-response paths, self-review/output metrics, plus retained previous tests. Fixtures are synthetic, not unavailable user RAW replays. Browser visual rendering unavailable: Chromium not installed. No1.61 hardware validation.

Run node --check plugin.js and node tests/verify_v0161.cjs. See HANDOFF_v0161.md/results. LICENSE/calibration JSON unchanged. Package finalized before GitHub synchronization; release commit records completion.
