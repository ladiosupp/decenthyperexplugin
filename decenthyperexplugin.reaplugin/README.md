# HyperEx Pulse Filter v0.1.52

## Current candidate: once-only completion, inspectable readback, automatic coffee learning

Based on the exact delivered 1.51 source. Its original ZIP remains unchanged.

### Completion and auto-apply
Repeated Idle events while finishing now schedule one tracked completion callback. The callback checks the sequence and diagnostic-run identity. Once completion saves the run, later Idle events cannot cancel its pending automatic application. New-shot/unload cleanup still cancels obsolete timers. Auto-apply reports scheduled, applying, waiting, applied, error or explicit cancellation; duplicate application of an applying/applied source run is suppressed. Profile writes still require idle and verified upload/workflow readback.

The Idle-timer defect was reproduced in 1.51 simulations. The user's fourth empty-basket shot showed a proposal but old workflow commands; without its raw machine logs, the defect is not proven to be that shot's sole cause.

### Raw workflow audit
READ RAW WORKFLOW calls the read-only adaptive-audit endpoint. It performs a fresh GET /workflow and returns the raw profile, actual commands, expected-current-profile match, latest-proposal match, separate cached profile truth, auto-apply state and baseline provenance. It does not repair/upload a profile. Selection/context changes during the read prevent a matching claim. JSON can be selected/copied from the page. Upload acknowledgement remains distinct from independent DE1 firmware-memory readback.

### Automatic normal coffee use with the empty-basket baseline retained
No basket-mode toggle is required. New-user flow: Step 1 uses an empty locked-in basket to save the original LUT. Step 2 uses 2–3 empty-basket HyperEx runs to refine next-shot command corrections while retaining that original LUT. Two clean stable runs (S2/S3 within 12%, adequate regression windows/quality and repeat variability) may finish qualification early. At three completed same-baseline empty runs with usable recent data but limited improvement, end empty tuning and recommend at most one dedicated coffee acceptance. Workflow/upload/history or automatic-apply failures, invalid data and detected stalls block readiness rather than being bypassed by the count; stop tests and inspect diagnostics, do not demand endless extra cups.

Readiness changes the learning context automatically between shots. Dedicated calibration always stays EMPTY BASKET ONLY. Both Diagnostics and the existing cooperative Dashboard shortcut display READY FOR COFFEE / READY · ADD COFFEE. Valid saved pre-upgrade records count; the current user's four empty shots need not be repeated. Saved coffee evidence keeps normal coffee mode across reload. Changes to the physical LUT/settings invalidate unrelated qualification records. This is an operating-intent transition, not a sensor claim that grounds were detected.

Keep the physical LUT, existing valid bounded baseline commands/manual seed, and saved history. Prior empty/pre-upgrade overrides remain the starting command trajectory (if their calibration/target bindings and existing profile guards pass); they are labelled as baseline seeds, not newly validated coffee corrections. Matching verified completed empty/pre-upgrade history is exposed as baseline cup-response/reference evidence and frozen with the new run. No speculative numerical backpressure multiplier is applied.

Coffee response differs from empty-basket response. New numeric coffee consensus uses completed coffee runs, with explicit frozen context and pressure/actuator quality. Old records remain baseline references and diagnostics rather than pretending to be a second matching coffee shot. History may therefore show 4 saved / 0 coffee-compatible and 4 baseline references after upgrade; this is retention with a different evidence role.

For coffee numeric evidence, exclude the first second of machine transients and require at least four fresh, explicitly valid machine samples and at least 80% usable coverage. Hold the affected stage when ≥20% of samples reach 95% of its pressure limiter or ≥25% have machine flow below 70% of its frozen command. Shaped S3 requires actual frame identity. Missing/stale telemetry also withholds numeric correction. These are conservative engineering evidence gates, not a perfect physical detector of all pressure-limited conditions. Pressure limits are never raised to chase an unreachable cup-flow target.

### Validation and use
125/125 built-in Node checks pass, including the original 81; full Idle-burst completion→auto-apply→DTO readback, failure handling, prior preservation, context/history isolation, normal coffee evidence, pressure/actuator guards, read-only audit versus stale cache, and rendered-browser-script compilation.

This version has not yet run on the user's DE1 with coffee. For an established baseline, do not add more empty-basket flow-tuning rounds. New users follow the bounded Step 1/Step 2 flow above. Install over the same plugin without uninstalling/clearing data; preserve parameters, LUT, seed and history. Before filling/brewing, confirm CAL READY, READY FOR COFFEE and WORKFLOW READBACK VERIFIED. Then brew normally with grounds; at most one dedicated filled-basket acceptance shot, possibly zero if the first normal consumed coffee supplies the observation. PENDING/REPEAT/LIMITED-HOLD is not permission to schedule repeated special test cups. Let subsequent normal consumed coffees accumulate trustworthy evidence. If a blocker appears, capture existing diagnostics/audit and fix it without demanding repeated dedicated coffee trials.

Dashboard CLOSE/HOME remains a separate open issue. The current 1.52 is not uploaded to GitHub; the latest authorized upload remains 1.51.

Run:
```sh
node --check plugin.js
node tests/verify_v0152.cjs
```

See HANDOFF_v0152.md. Older release notes below are historical and their manual basket-switch/override-discard assumptions do not describe 1.52.

---

# Historical v0.1.51 release notes

## Current candidate: independent conservative S3 SHAPE fallback

Based on the exact v0.1.50 ZIP (SHA-256 dbdb995b68e1ced18b2d712ed077580fec15196f17fdabff675f47e993b72711). v0.1.50 passed workflow verification on the user's machine. Three shots showed stable S2, inconsistent S1 startup quality, and repeated S3 decay with varying absolute frame flows.

- S1 quality thresholds are unchanged. Diagnostics now lists the failed checks, sample count and active duration. A 0.70 s 20–80% interval remains below the 0.90 s minimum.
- When the existing absolute S3 variability gate rejects a pair, a separate SHAPE-only fallback can use two clean same-command/same-timing/same-measurement-basis shots. Both must show late decay in quarters and profile frames. Each regression R² ≥0.95, frame windows ≥3 s, normalized frame variability ≤15%, overall variability ≤20%, and frame late/early ratio difference ≤0.12.
- LEVEL factor stays 1 in this fallback. Each command change is bounded by 4% and 0.05 ml/s; monotonicity, hard limits and adjacent-rise limits remain enforced. Measurement-window-weighted command exposure must remain within 0.2% after rounding. This is an engineering constraint, not a guarantee of unchanged cup flow or final water volume.
- Existing normal S3 and stall paths remain. Mixed measurement bases cannot form a pair. Next-shot-only application still requires idle, valid LUT and verified workflow upload/readback.
- No calibration LUT rewriting, running-shot scale feedback or new skipStep calls.
- Diagnostics shows the SHAPE ONLY / LEVEL HOLD action, normalized variability and decision reason.

Validation: 81/81 Node checks passed, including the original 70, screenshot-derived frame evidence (not a replay of unavailable RAW logs), synthetic full RAW pipeline, idle guard, verified DTO upload, upload-failure rollback, command bounds and rendered browser-script syntax. Real-machine correction behavior remains unverified.

Install 0.1.51 over the same plugin without uninstalling/clearing data. Preserve parameters, valid LUT and manual seed. Confirm CAL READY, PERSISTENT history and WORKFLOW READBACK VERIFIED before any shot. Upgrade restores compatible compact evidence but does not automatically recompute the previous run's suggestion: a new completed shot is normally needed. Do not assume old latest-shot details survive reload. Capture the next-shot action and actual commands after that shot; if correction applied, validate its execution on the following shot.

Run:
```sh
node --check plugin.js
node tests/verify_v0151.cjs
```

See HANDOFF_v0151.md for current state. Earlier release notes below are historical.

---

# Historical v0.1.50 release notes

## v0.1.50 — Decaid profile serialization compatibility

The first v0.1.49 hardware screenshot showed PERSISTENT history and retained LUT values, but `Final GET /workflow does not match expected LUT/adaptive profile`. The v0.1.49 simulations echoed submitted JSON and missed Decaid's real serialization.

The [official Decaid model](https://github.com/decentespresso/decaid/blob/f2248a756f80639c5f96e1fbdd4c426c956fbca4/lib/src/models/data/profile.dart) omits top-level import-only `type` and `legacy_profile_type`, and a flow step serializes `flow` without its unused `pressure` field. v0.1.49 compared those discarded keys and could reject a correctly applied profile indefinitely.

v0.1.50 compares Decaid-retained profile content, applies numeric string/number normalization, and compares the actuator appropriate to each pump type. Library upsert deduplication uses the same retained-content model. **Actual flow, pressure for pressure steps, temperature, duration, weight/volume stops, limiter, and step exit conditions remain verified.** A mismatch still prevents arming and now reports differing field paths and expected/actual values. Diagnostics labels actual commands explicitly as GET /workflow results.

The evidence truth schema advances to 3 because the comparator now also verifies step exits. Old evidence stays diagnostic-only. Valid LUTs and compatible manual seed commands are retained; this upgrade alone does not require recalibration. The first new verified completed shot begins current consensus evidence.

Verification: **70/70 simulated checks pass**, including Decaid DTO roundtrips, literal 2/5/1.5 repair, S3 seed shape, unchanged profile write deduplication, genuine mismatch gating and field-level diagnostics. This is not a claim of hardware validation.

### Immediate hardware test

1. Install v0.1.50 and confirm CAL READY. Do not rerun calibration or alter targets/multiplier/manual commands.
2. Select HyperEx, open Diagnostics, and wait for WORKFLOW READBACK VERIFIED. Before running a shot, send a photo of that area including actual commands and history status.
3. If still NOT VERIFIED, do not run a shot. Capture the full error: it now names differing fields.
4. Once verified, complete two shots without manual changes or APPLY TEST COMMANDS. Capture workflow commands, shot snapshots, RAW regression and adaptive decisions. Add a third shot only if a next-shot correction needs validation.

The machine upload status is an HTTP acknowledgement, not independent DE1 internal-profile readback. Dashboard CLOSE/HOME remains a separate open hardware/UI issue.

Run: `node --check plugin.js` and `node tests/verify_v0150.cjs` from this directory. The runner uses only Node.js built-ins and injects test hooks into memory, not the shipped runtime code.

Earlier release notes below describe their historical versions; use this section and HANDOFF_v0150.md for the current state.



## v0.1.49 — profile truth and persistent history hardening

This build is based on the original `HyperExPulseFilter_v0148_fresh.zip`. Valid calibration LUTs and Settings are retained. S1/S2/S3 settings always mean real cup mass flow in g/s; DE1 flow is an actuator command.

- Selecting HyperEx requires fresh `GET /workflow` reads before and after synchronization. A matching `workflowUpdated` notification alone cannot arm the controller. Mismatches are repaired with LUT/adaptive commands, machine upload must succeed, and final workflow/multiplier reads must match before arming.
- Diagnostics reports **WORKFLOW READBACK VERIFIED** and **machine upload acknowledged** separately. HTTP upload success is NOT independent readback of DE1 internal profile memory. Machine telemetry and real-scale measurements still require hardware validation.
- Profile synchronizations are serialized. An unchanged workflow skips its PUT; a previously acknowledged unchanged machine upload is skipped. A changed workflow or failed verification invalidates the upload acknowledgement. Writes are blocked during a shot, and selection changes / changed expected commands invalidate an in-flight verification. An idle retry is throttled to once per 3 seconds after failure.
- HyperEx-only multiplier setup completes before arming. Automatic verification never writes a GLOBAL multiplier. Leaving scope during an in-flight multiplier update restores the saved original; a failed restore retains that saved value for retry.
- Each shot freezes its LUT points, actual multiplier, real-flow targets, phase weights, temperature, pressure settings, and truth-schema fingerprint at start. Only completed, verified, compatible shots can contribute numeric adaptive evidence. Older truth-schema evidence remains diagnostic-only; 1.49 begins a new trusted consensus sequence. Existing valid LUTs do not need recalibration solely because of this upgrade.
- History startup reads complete before any history-file write. The probe AND the complete history file must pass write/readback verification before PERSISTENT is displayed. Writes are serialized; late initial reads merge session records. A failed readback disables cross-reload evidence while preserving current-session adaptation. Storage timeouts survive brew timer cleanup.
- Compact history fields now use the actual diagnostic property names and store confirmed next-shot applications separately from the source shot evidence.
- S1 startup gating, S2 HIT/HOLD, S3 command provenance and LEVEL/SHAPE limits remain in place. No running-shot scale closed loop or additional skipStep calls are added. The old static main HyperEx profile remains absent.

### Upgrade / hardware acceptance

1. Install this ZIP and confirm `CAL READY`; retain a valid existing LUT.
2. Select HyperEx, open Diagnostics, and wait for `WORKFLOW READBACK VERIFIED`. Check actual workflow commands against the LUT/adaptive commands; do not expect literal machine flows of 2/5/1.5.
3. Check `ADAPTIVE HISTORY · PERSISTENT`. If it says SESSION ONLY, capture the stated error; same-session adaptation is still available.
4. Run two shots with unchanged settings and no APPLY TEST COMMANDS. Compare the actual workflow commands, shot snapshot, machine telemetry, RAW regressions and next-shot decision. The first trusted shot establishes evidence; the second can establish consensus.
5. Dashboard DIAG → CLOSE/HOME remains a known hardware/UI integration issue. This release does not claim to fix it or introduce an external URL fallback.

### Reproducible local checks

From this plugin directory, run `node --check plugin.js` and `node tests/verify_v0149.cjs` (Node.js, no dependencies). The bundled runner injects test-only hooks into an in-memory copy; the runtime plugin has no test exports. **56 simulated checks pass**, covering failure gating, races, deduplication, fingerprint isolation, persistence and representative S1/S2/S3 behavior. Simulated results do not establish Decaid/DE1 hardware compatibility.

### Historical release notes





## v0.1.48 S3 stall-recovery adaptive path

- Adds a conservative **STALL RECOVERY** path to the shot-to-shot S3 controller. A single stall never triggers a numeric change: the same S3 command shape must be observed in two matching shots, both must show late weakness, and at least one must contain the dedicated 6 s low-flow stall signature (RAW cup slope collapsed while DE1 flow remained active).
- A confirmed stall no longer discards the whole S3 shot just because the LATE linear-fit R² is poor. EARLY and MID still require clean regressions; LATE is accepted only as qualitative stall evidence from the dedicated stall detector.
- Recovery keeps **LEVEL** and **SHAPE** separate. LEVEL may rise only when both matching overall S3 flows are more than 10% below target, and is capped at +4% for one next-shot step. SHAPE is normalized and shifts command toward LATE; each frame remains capped at ±7% and ±0.05 ml/s.
- Adaptive auto-applied overrides now report `adaptive auto applied` instead of the misleading `manual test active` source label.
- Shot-to-shot adaptive evidence is now persisted in plugin storage (last 8 evidence rows), so ordinary plugin/UI reloads and later upgrades no longer reset two-shot consensus. Calibration clear also clears this history.
- S1 startup safety, S2 HIT/consensus behavior, calibration LUT immutability, no running-shot scale closed loop, and no extra `skipStep` calls are unchanged.


## v0.1.45 S3 adaptive command-provenance fix

- Fixes S3 adaptive evidence fallback when a shaped shot lacks complete per-profile-frame RAW regressions.
- Measurement windows may still fall back to the robust S3 EARLY/MID/LATE 25/50/25 regressions, but command provenance now always comes from the actual shot-start shape (`EARLY / MID / LATE`) rather than flattening all three to the MID command.
- Prevents a real `0.698 → 0.720 → 0.778` shot from being stored as `0.720 → 0.720 → 0.720`, which would otherwise poison the two-shot same-shape consensus gate.
- Adaptive history remains runtime-only, so upgrading/reloading starts fresh evidence collection after this fix.

## v0.1.44 workflow + three-stage automatic next-shot adaptive

Diagnostics now follows the actual user workflow:

1. **STEP 1 · FLOW CALIBRATION** — first-time empty-basket RAW-scale calibration; a valid LUT is required before normal adaptive use.
2. **STEP 2 · SHOT-TO-SHOT AUTO ADAPTIVE** — authoritative next-shot profile, latest-shot command snapshot, RAW regression validation, S1 startup/S3 stability, automatic S1/S2/S3 next-shot decisions, and real flow/weight curves.
3. **STEP 3 · MANUAL / ENGINEERING** — reference advisory, manual test overrides, S3 shape editor, and advanced settings.
4. **STEP 4 · COPY CSV** — raw engineering export.

Adaptive behavior is completed-shot only. S1 requires repeated MEDIUM-confidence startup evidence; S2 requires repeated high-quality RAW-regression evidence; S3 separately solves overall **LEVEL** and normalized EARLY/MID/LATE **SHAPE** before combining a bounded next-shot command. No running-shot scale closed loop is introduced, calibration LUT data is never rewritten by adaptive history, and no additional `skipStep` calls are added.


## v0.1.43 diagnostics provenance + Dashboard exit fix

- Separates diagnostic command semantics into **NEXT SHOT · APPLIED PROFILE**, **LATEST SHOT · COMMAND SNAPSHOT**, **PROPOSED next shot**, and **MEASURED** telemetry/results. A single S3 MID value is no longer presented as if it represented the whole active S3 shape.
- S3 frame-result tables are explicitly historical: their command values are the commands captured for the completed shot, not the current next-shot profile.
- AUTO APPLY now distinguishes `APPLIED ✓`, `NOT APPLIED`, and `AUTO APPLY ARMED`; an ON switch alone is no longer shown as proof that a suggestion was written.
- Dashboard `DIAG / CAL` uses the same Streamline **page/history navigation model** as the Settings → OPEN path, avoiding external-browser root fallbacks.
- Normal entry from **Plugins → HyperEx Pulse Filter → OPEN** keeps the same internal history-based close behavior.
- Adds the missing `adaptive-auto-set` HTTP declaration to the manifest so the diagnostics AUTO APPLY toggle is declared consistently with its handler.
- Brew execution, calibration LUT rules, no-running-shot feedback rule, and no-extra-`skipStep` invariant are unchanged.


## v0.1.41 settings / navigation / profile-write regression fix

- Restores the complete v0.1.39-style plugin Settings surface: temperature, S1/S2/S3 real-flow targets, pressure limits, release/retry/scale safeguards, calibration controls, diagnostic cadence, and maximum sequence time are visible again in **Plugins → HyperEx Pulse Filter**.
- Removes v0.1.40's separate `advancedSettings` persistence layer and its second startup profile-sync pass. There is now one numeric configuration source: the normal plugin Settings values. The Diagnostics Advanced panel is only a quick editor for that same Settings source.
- Profile installation is idempotent: if the generated HyperEx or calibration profile is content-equivalent to the existing Decaid profile, the plugin skips the PUT write. This reduces unnecessary profile reload activity when opening the plugin/diagnostics page.
- `CLOSE / HOME` no longer stops after only posting `streamline:close`. It first asks Streamline to close the overlay, then uses a delayed top-level/history fallback if the page is still alive.
- Keeps v0.1.40 default-on verified **AUTO APPLY NEXT SHOT**, two-shot S3 consensus, S1 safeguards, Target-LUT calibration, and no-running-shot-change rule unchanged.


## v0.1.40 default-on verified auto apply

- **AUTO APPLY NEXT SHOT defaults ON after installation/upgrade.** The user does not need to open DIAG or press APPLY after every completed shot.
- Auto mode does **not** relax v0.1.39 gates. `REPEAT SAME SHAPE`, `VARIABLE / REPEAT`, insufficient S1 data, invalid LUT state, or failed readback/profile verification cause **no parameter change**.
- Only an **actionable** suggestion is applied: S1 must have a bounded `ADJUST`, and/or S3 must have a valid two-shot `CONSENSUS SHAPE`. HOLD-only suggestions do not rewrite overrides.
- Automatic apply runs only after a normally completed HyperEx shot has returned to Idle. It uses the same transactional path as manual APPLY: merge only suggested fields, preserve unsuggested manual settings, persist, read back, regenerate the HyperEx profile, verify effective mode/values, and roll back on any failure.
- DIAG shows `AUTO APPLY NEXT SHOT: ON/OFF`. Turning it **OFF** restores the exact v0.1.39 workflow where a numeric suggestion waits for the user to press `APPLY NEXT SHOT`. The choice is persisted.
- The plugin setting `Auto-apply verified next-shot adaptation` also defaults to ON for fresh installs.
- Running-shot control remains unchanged: no scale PID, no live target rewrites, no extra plugin `skipStep`; S3 shape subframes still advance only by profile time.
- **Settings-page simplification:** the plugin Settings page exposes only switches plus the core HyperEx curve timing/weight controls: S1 release weight, release-settle time, zero-pressure soak time, S2→S3 transition weight, final beverage weight, and GHC re-arm timeout. Other numeric engineering parameters are moved to a collapsible **ADVANCED SETTINGS** panel at the bottom of DIAG / CAL.
- Curve weights on the Settings page are authoritative. Legacy/stored ADVANCED SETTINGS weight fields are ignored so an old diagnostic-page value cannot silently overwrite a user-visible S1/S2/final weight.
- Advanced settings are stored by the plugin, hard-clamped on save and again at profile generation. Changing S1/S2/S3 real-flow targets clears stale manual/adaptive overrides and repeat evidence, but does not rewrite the calibration LUT.

## v0.1.39 two-shot consensus adaptive

- S3 NEXT SHOT no longer trusts a single completed shot. A numeric S3 shape proposal requires **two completed HyperEx runs with the same S3 EARLY/MID/LATE commands and the same EARLY/MID times**.
- First clean run on a new shape shows **REPEAT SAME SHAPE** and does not offer a numeric S3 APPLY suggestion.
- The second matching run is compared segment-by-segment. If any segment differs by more than **20% of the two-shot mean**, the result is **VARIABLE / REPEAT** and no numeric S3 trim is offered.
- When the repeated response is consistent, the proposal uses the **two-shot mean** with only **7–10% correction gain**, a hard **±0.03 ml/s** per-segment step limit, monotonic EARLY≤MID≤LATE projection, and an empirical **EARLY floor of 0.68 ml/s** to avoid the previously observed low-flow nonlinear/stall region.
- APPLY NEXT SHOT remains user-confirmed, changes only test/profile-time overrides, never rewrites the calibration LUT, and never performs scale feedback control during a running shot.
- The manual S3 area no longer shows a single-shot fallback shape while the consensus engine is waiting for a repeat.
- S1 remains conservative: startup-sensitive or sub-second 20–80% trajectories stay REPEAT/INSUFFICIENT and do not create an aggressive numeric trim.

## v0.1.38 action hierarchy

- `APPLY NEXT SHOT` is the primary/recommended action and is visually promoted inside the NEXT SHOT ADAPTIVE section.
- `APPLY TEST COMMANDS` is explicitly secondary and lives in an ADVANCED / MANUAL panel for deliberate experiments.
- `RETURN ALL TO LUT` is tertiary/recovery. This separates the normal adaptive workflow from expert manual overrides.

## v0.1.38 adaptive apply verification

- Fixes v0.1.37 schema mismatch: `APPLY NEXT SHOT` wrote schema 3 while the override reader only accepted schemas 1/2, causing S3 to fall back to AUTO/LUT and FLAT after refresh.
- Schema 3 is now accepted end-to-end; manual TEST saves use schema 3 as well.
- `APPLY NEXT SHOT` performs a server-side readback verification before reporting success. S3 must read back as `shape` with the expected EARLY/MID/LATE commands or the apply fails.
- Merge rule: `APPLY NEXT SHOT` overwrites only stages that have a bounded suggestion. Any stage with no suggestion preserves the MANUAL command (or S3 shape) actually used by the source shot, so an adaptive S3 update cannot silently reset S1/S2 back to AUTO/LUT.
- Upgrade guard: malformed/previously-unreadable v0.1.37 adaptive schema-3 writes are not silently activated by v0.1.38; they are ignored until a new validation shot is run and explicitly applied.
- The S3 row now shows `SHAPE ACTIVE` when a profile-time shape is effective; the lower shape panel uses the same NEXT SHOT ADAPTIVE numbers instead of a separate legacy hint.
- S1 sub-second 20–80% windows remain diagnostic only; they show STARTUP / REPEAT rather than a misleading MISS/numeric trim.

## v0.1.38 diagnostics bootstrap fix

- Fixes the v0.1.36 diagnostics overlay startup syntax error caused by an incorrectly escaped newline in the NEXT SHOT confirmation text.
- Binds CLOSE / HOME in a separate bootstrap script before the main diagnostics script, so the overlay can still be closed if the main UI script ever fails to initialize.
- UI initialization failures now show DIAGNOSTICS UI ERROR instead of remaining on Checking… forever.
- A fresh install/reload with no in-memory HyperEx shot explicitly shows NEW INSTALL / NO PREVIOUS SHOT; no previous-shot snapshot recovery is attempted.
- Brew state machine, calibration LUT, S1/S3 adaptive math, S3 profile-time shape, and skipStep topology are unchanged from v0.1.36.

## v0.1.38 shot-to-shot adaptive suggestion

- Adds **NEXT SHOT ADAPTIVE** analysis for S1 and S3. The completed shot is analyzed; nothing changes during the running shot.
- **APPLY NEXT SHOT** requires explicit user confirmation and writes only bounded manual-test/profile-time commands. The calibration LUT remains unchanged.
- S1 uses 20–80% active cup-flow trajectory and ignores first-rise delay as a flow error.
- S3 uses EARLY/MID/LATE frame regressions and generates a bounded non-decreasing next-shot shape. Per segment, one-shot change is limited to -6%/+10% and ±0.08 ml/s.
- High-quality `LATE/EARLY < 0.75` now overrides a whole-stage HIT and reports **LATE DECAY / SHAPE ADVISED**.
- Stable two-skip topology remains unchanged; S3 shape subframes advance by profile time only.

## v0.1.35 S1/S3 refinement (carried forward)

- Keeps the proven two active `skipStep` topology: restart S1→S2 once, then 40 g S2→S3 once.
- Adds an explicit **S3 DECAY COMP TEST** mode. When enabled, S3 becomes three profile-timed subframes (EARLY/MID/LATE); the DE1 advances those frames by their own `seconds` values. The plugin sends **no extra skipStep** calls inside S3.
- UI suggests a conservative shape from the latest S3 LATE DECAY/stall result, but never enables or applies it automatically.
- Shape safety guards: 0.10–8.00 ml/s hard command bounds, 3–30 s EARLY/MID timing bounds, non-decreasing commands, and bounded adjacent rises (≤35% and ≤0.25 ml/s).
- S1 remains a static manual-test command. Use the startup 20–80% trajectory, not the whole-stage regression, when choosing S1 test values.
- Calibration LUT remains unchanged by all manual/shape tests. New calibration or changed real-flow targets invalidate old test overrides.


## v0.1.34 S1 startup + S3 stability diagnostics

- Brew execution remains the stable **three-frame** controller from v0.1.32/v0.1.33. Scale feedback never changes a running shot and does not add skipStep calls.
- S1 now reports first cup-rise delay and a **20–80% cup-weight trajectory** flow estimate. Reference advice for S1 is based on that active trajectory, not the startup-sensitive whole-phase R². First-rise delay is displayed separately and never treated as a flow error by itself.
- S3 now reports independent **EARLY 25% / MID 50% / LATE 25%** RAW-weight regressions plus late/early ratio.
- A 6 s LOW-FLOW STALL detector flags cases where DE1 flow remains ≥0.40 ml/s while cup-weight slope collapses below the bounded stall threshold. A stall only produces a conservative manual-test range; it never rewrites the LUT or changes a running shot.
- Diagnostic CSV now includes the S1 startup metrics, S3 segment/stall metrics, and correct Reference Range min/max fields.



## v0.1.34 reference ranges + manual test commands

- Keeps the v0.1.32 stable three-frame brew execution unchanged: no adaptive ladder and no scale-driven runtime `skipStep`.
- Reference Advisory now includes a conservative **Reference Range**. It moves only part-way toward the theoretical target/measured correction; LOW confidence is explicitly manual-test-only and INSUFFICIENT gives no numeric range.
- DIAG / CAL now exposes per-stage **AUTO / LUT** vs **MANUAL TEST** commands. Manual values are static for the whole shot, hard-bounded to 0.10–8.00 ml/s, and never modify the saved calibration LUT.
- `RETURN ALL TO LUT` clears all manual test overrides.
- Manual overrides are bound to the current real-flow targets and current calibration-map timestamp. Changing targets or generating a new calibration LUT invalidates/clears old overrides so an experiment cannot silently survive a new calibration.
- HyperEx profile notes and diagnostics record whether each stage used AUTO/LUT or MANUAL TEST.


## v0.1.34 stable 3-frame execution + reference-only advice

- Restores the proven v0.1.29 execution model: exactly three HyperEx brew frames. The second Espresso restart uses one `skipStep` to S2; the cumulative S2 weight trigger uses one `skipStep` to S3; final weight requests Idle.
- Removes adaptive/multi-skip control from the running shot. Scale feedback never calls `skipStep` and never rewrites a live DE1 target.
- Each of the two legitimate stage transitions preflights the latest `profileFrame`: restart only allows 0→1, and the 40 g transition only allows 1→2. If already at the target frame no skip is sent; any other frame is treated as a state mismatch instead of blindly advancing.
- Keeps Target-LUT Low Water calibration, automatic validated LUT sync, user-editable S1/S2/S3 real-flow targets, water preflight, scoped flowMultiplier handling, and RAW weight-regression validation. Existing schema-3 LUTs remain usable.
- Adds **REFERENCE ADVISORY** after each HyperEx shot. HIGH/MEDIUM quality data may show a bounded reference command estimate; LOW/INSUFFICIENT quality only recommends repeating the empty-basket validation. No advice is applied automatically.
- Legacy S1 startup correction values are retained only so they can be shown/cleared; v0.1.34 ignores them during profile generation.
- Adds runtime hard bounds: desired real flow 0.30–6.50 g/s, DE1 command flow 0.10–8.00 ml/s, brew temperature 70–100 °C, pressure ceilings no higher than the emergency stop and never above 12 bar, ordered stage weights, and profile/calibration frame count ≤20.

## v0.1.29 shot validation + cooperative Dashboard entry

- Keeps the v0.1.27 Target-LUT calibration and automatic validated HyperEx sync unchanged. Existing schema-3 v0.1.27 LUTs remain usable; no forced recalibration is required.
- Separates **CURRENT HYPEREX VALIDATION** from **CALIBRATION LUT** in Diagnostics so one shot's validation is not confused with the saved calibration run.
- Physical stage validation now uses a multi-second linear regression of raw scale weight vs scale timestamp. The adjacent-sample RAW dW/dt remains visible for debugging but is not the acceptance reference.
- Each HyperEx stage reports desired real g/s, DE1 Flow, Decaid weightFlow, RAW regression g/s, regression R²/window, error %, and HIT/NEAR/MISS (or TRANSIENT for a very short S1 window).
- Dashboard `DIAG / CAL` is enabled by default again. If another plugin owns the reserved header slot, use Plugins → HyperEx Pulse Filter; HyperEx has no active reclaim/retry loop.
- Diagnostics `CLOSE / HOME` closes a Streamline overlay back to the Dashboard. When opened as a normal plugin page it preferentially goes back two navigation steps (Plugins → Home), with safe fallback to one-step back/root.


## v0.1.27 Target-LUT calibration

- Low Water is now a target-focused 3×3 search in HyperEx order: S1 real target, S2 real target, then S3 real target after the high-flow block.
- Each target is accepted only by a tight local bracket or a sufficiently close measured hit.
- The final saved LUT contains three validated real-flow anchors and is automatically synchronized to HyperEx only when all targets pass.
- Invalid calibration runs never replace the previous valid LUT and never auto-sync a bad result.
- Full remains the 12-point engineering staircase.
- Low Water nominal command water is about 95 ml with the existing ~240 g actual-water hard stop and 300 ml vessel recommendation.
- v0.1.26 and older calibration maps are treated as legacy/stale and require a v0.1.27 rerun.

# HyperEx Pulse Filter for Decaid

Experimental Decaid plugin for a DE1XL v1.45 pulse-filtration sequence.

## Dual persistent calibration profiles (v0.1.26)

v0.1.26 creates/updates **both** empty-basket calibration profiles on plugin load:

- `HyperEx Flow Calibration - Low Water` — default. A 3 ml/s × 3 s prime is followed by 9 optimized command-flow plateaus at 6 s each (about 93 ml nominal command water), approximately 240 g actual-water safety stop.
- `HyperEx Flow Calibration - Full` — a 3 ml/s × 3 s prime is followed by 12 plateaus at 6 s each (about 143 ml nominal command water), approximately 270 g actual-water safety stop.

The diagnostic page mode selector only chooses which persistent profile **PREPARE FLOW CAL** will load; it no longer overwrites the other calibration profile. Selecting either calibration profile directly in Decaid also auto-selects the matching mode. During upgrade from v0.1.23, the legacy single `HyperEx Flow Calibration` profile is hidden after both new profiles are installed.

Both modes require a catch vessel of at least 300 ml and automatically request Idle before the collected weight can approach the vessel limit. Low Water is recommended for routine calibration; Full is for deeper mapping or troubleshooting. PREPARE FLOW CAL also checks the live DE1 tank level (current water height vs refill threshold, in mm) when that telemetry is available.


## Sequence

1. S1 desired real flow defaults to **2.0 g/s**; a valid LUT maps that to the bounded DE1 command.
2. At **4.0 g cumulative beverage weight**, request `Espresso -> Idle` to actively depressurize.
3. Confirm the DE1 has actually entered **Idle**. Pressure is **not** used as the release gate because the HyperEx stage-1 workflow is intentionally low-resistance/low-pressure.
4. After Idle, wait at least **0.8 s** for valve/water-path settling. Prefer two snapshots with actual flow **<= 0.4 ml/s**; if the Idle flow field is stale, fall back to **1.5 s** of stable Idle.
5. Hold for **10.0 s** soak. Weight dripping during dump/soak remains part of cumulative weight.
6. Restart Espresso, then issue exactly one `skipStep` to enter S2 (default desired real flow **5.0 g/s**).
7. At **40.0 g cumulative weight**, issue exactly one `skipStep` to enter S3 (default desired real flow **1.5 g/s**).
8. At **100.0 g cumulative weight**, request `Idle` to end the shot.

Pressure is not the primary control variable. Profile pressure limiters are safety ceilings (3 / 6 / 3 bar by default).

## Important architecture detail

The profile intentionally has **no weight exits**. All 4 g / 40 g / 100 g decisions are owned by the plugin. This avoids a race between Decaid's normal weight-exit `skipStep` logic and the plugin's active-dump state transition.

The plugin also detects a large downward scale jump as a tare/reset. This is used to preserve cumulative weight if Decaid tares the scale when Espresso is restarted after the 10-second soak.

## Installation

Install the release ZIP in Decaid's plugin installer. The ZIP root contains the `decenthyperexplugin.reaplugin/` directory with `manifest.json` and `plugin.js`.

On plugin load it attempts to create the **HyperEx Pulse Filter** profile in Decaid's profile library through the local REST API. If automatic profile creation fails, import `HyperEx_Pulse_Filter.json` manually.

Then:

1. Enable the plugin.
2. Select the **HyperEx Pulse Filter** profile/workflow in Decaid.
3. Make sure a scale is connected and delivering weight.
4. Start Espresso normally.
5. Watch Decaid logs for `[HyperEx]` messages during the first dry/water test.

## First test recommendation

Use water / a low-risk setup first. Confirm this exact sequence in logs and graphs before putting the filtration stack under load:

- 4 g trigger
- Idle command
- machine confirms Idle
- valve/water-path settle (prefer low flow; timed fallback if the Idle flow field is stale)
- 10 s soak
- Espresso restart
- skipStep to 5 ml/s
- 40 g skipStep to 1.5 ml/s
- 100 g Idle

If the physical DE1XL v1.45 does not actively dump pressure on the Espresso -> Idle transition in your firmware/build, stop testing and capture the Decaid log plus pressure/state graph; the control strategy then needs to target a different machine-state path rather than simply changing timing.

## Default settings

- Temperature: 92 C
- Stage 1: 2.0 ml/s, 4 g trigger, 3 bar limiter
- Release confirmation: Idle + minimum 0.8 s settle; prefer flow <=0.4 ml/s for 2 samples; 1.5 s stable-Idle fallback; 5 s fail-safe timeout
- Soak: 10 s
- Stage 3: 5.0 ml/s, 40 g trigger, 6 bar limiter
- Stage 4: 1.5 ml/s, 100 g stop, 3 bar limiter
- Emergency pressure stop: 8 bar for 3 samples

Core curve timing/weight controls and switches are on the plugin Settings page. Engineering numeric controls such as flow targets, temperature, pressure limiters, release thresholds, retry timing, and diagnostic cadence live in DIAGNOSTICS / FLOW CAL → ADVANCED SETTINGS. Saved values are hard-clamped again before profile generation.

## Safety / experimental status

This is experimental control software, not an official Decent plugin. It has not been validated on the user's physical DE1XL v1.45. Use conservative tests and keep the machine attended.


## v0.1.2
- Fix Decaid install crash (`type Null`) by declaring the required empty `api` array in `manifest.json`.


## v0.1.2 timing fix

HyperEx now waits for Decaid machine substate `preinfusion` or `pouring` before starting stage-1 control, and after the 10-second soak it waits for the restarted Espresso to reach `preinfusion`/`pouring` before sending `skipStep`. This avoids Decaid classifying the plugin command as "Shot aborted during preheat, before the pour began".


## v0.1.3
- Tuned the default depressurization threshold from 0.25 bar to 0.8 bar based on DE1XL v1.45 physical testing where Idle residual pressure settles around 0.5-0.7 bar.
- The threshold remains user-configurable; soak still starts only after 3 consecutive low-pressure samples.


## v0.1.7
- Reworked the 4 g release condition for the actual HyperEx low-resistance workflow (coarse/pourover grind).
- Stage-1 pressure is no longer a gate because the 2 ml/s prewet stage may legitimately stay around 0.5-1.5 bar.
- The plugin now requires machine `idle`, a minimum valve/water-path settling interval, and prefers near-zero actual flow confirmation. A short stable-Idle fallback prevents stale Idle flow telemetry from blocking the sequence.
- Pressure remains logged and the independent emergency high-pressure stop remains active.


## v0.1.7
- Fixes a physical-test stall after the 4 g Idle transition.
- HyperEx no longer depends on post-shot `stateUpdate` events to advance the release state.
- After requesting Idle it actively polls `GET /api/v1/machine/state`, then uses an independent 0.8 s valve/water-path settle timer before the 10 s soak.
- After the soak the restarted Espresso is actively polled until `preinfusion`/`pouring` before `skipStep` to 5 ml/s.
- Decaid may finalize/upload the first 4 g segment as a separate shot when Idle is used; HyperEx state intentionally survives that finalize and continues the programmed sequence.


## v0.1.7 weight-source fix
Decaid plugin `stateUpdate` is machine-only and does not carry scale weight. v0.1.7 subscribes directly to `ws://localhost:8080/ws/v1/scale/snapshot` through the plugin transport API. The 4 g / 40 g / 100 g gates are driven by that live scale stream.


## v0.1.7 change

Second-Espresso preheat/pour confirmation timeout increased from 8 s to 12 s and exposed as **Restart preheat timeout (s)**.


## v0.1.8 GHC-confirm restart behavior

After the 4 g active Idle release and the configured soak (default 10 s), the plugin sends the Espresso request once. On GHC-equipped DE1 hardware this can light the physical Espresso button without starting the pump. v0.1.8 intentionally waits without a restart timeout. Press the physical GHC Espresso button; when Decaid reports preinfusion/pouring, the plugin automatically sends skipStep to enter the 5 ml/s stage. The overall MaxRunSeconds safety limit still applies.


## v0.1.9 GHC confirmation timeout

The GHC-confirm restart wait is no longer infinite. After the configured soak (default 10 s), HyperEx arms Espresso and waits for the physical GHC Espresso button. The new **GHC confirmation timeout (s)** setting defaults to **20 s**.

- If the user presses the GHC Espresso button within 20 s and Decaid reports `preinfusion` or `pouring`, HyperEx automatically sends `skipStep` and continues at 5 ml/s.
- If no physical confirmation arrives within 20 s, HyperEx sends `Idle`, cancels the armed restart, clears all sequence timers and cumulative-weight/tare state, and returns to the idle controller state. This prevents an abandoned half-sequence from contaminating the next shot.
- The timeout is configurable in plugin settings.


## v0.1.15 GHC prompt UX

After the 10 s soak, HyperEx arms Espresso and starts the configured GHC confirmation window (20 s by default). It now:

- emits a `ghcPrompt` status event (`waiting`, `confirmed`, `timeout`, `cleared`) with `secondsRemaining`;
- writes an unmistakable `PRESS GHC ESPRESSO BUTTON` countdown to the plugin log at the start, 15 s, 10 s, and every second from 5 s to 1 s;
- clears the prompt immediately once `preinfusion`/`pouring` confirms the physical GHC press;
- on timeout, explicitly reports cancellation, sends Idle, and fully resets the HyperEx sequence.

Decaid currently does not expose a generic plugin API for forcing a global Snackbar/Toast on the stock UI. The `ghcPrompt` event is included so a skin/UI can render a native countdown later without changing the brew controller.


## v0.1.15 plugin-only prompt flow

- No Streamline source files are modified. All UI is provided by Decaid plugin surfaces/endpoints.
- The first visible countdown equals `SoakSeconds`; no Espresso arm request is sent before it reaches zero.
- At zero, HyperEx sends one Espresso arm request, starts the GHC confirmation window, and may send bounded automatic arm reinforcements while the second pour has not started.
- The prompt says: pink light ON -> press physical GHC Espresso; pink light OFF -> use RE-ARM.
- RE-ARM resends only the second-stage Espresso request. It preserves cumulative weight and does not rerun stage 1 or the soak.
- When the GHC window expires, HyperEx sends Idle and immediately resets its internal sequence state.


## v0.1.15 UI layout
- Removed RE-ARM from the Drink/yield tile area.
- GHC guidance now uses the full shot information row: PINK ON -> PRESS GHC / PINK OFF -> TAP RE-ARM.
- The header RE-ARM entry is one-tap: opening it immediately resends only the second-stage Espresso arm request, preserves cumulative weight/soak, confirms the request, then closes.


## v0.1.16 active-release reliability

Fixes an intermittent post-stage-1 stall where the exact `idle` snapshot could be missed during Decaid shot finalization. Release confirmation is now multi-path: exact Idle, settled/pouringDone telemetry, one reinforced Idle write after `DumpFallbackSeconds`, and a final acknowledged-Idle fallback unless fresh telemetry explicitly shows espresso still pouring with meaningful flow. A `RELEASING` plugin surface is shown immediately after the 4 g trigger. DYE2/shot finalization can therefore no longer make the controller depend on catching one specific Idle frame.


## v0.1.17 skin-independent arm recovery

- Keeps the v0.1.16 active-release and soak state machine unchanged.
- After the full soak reaches zero, the initial second-stage Espresso arm request is sent as before.
- If `preinfusion`/`pouring` has not begun, HyperEx automatically resends Espresso at **+3 s** and **+7 s** by default. These two delays are configurable; `0` disables that retry.
- The retries are bounded: there is no loop and they do not extend the existing GHC confirmation timeout.
- Any confirmed second-stage pour immediately cancels both pending retries.
- A user-triggered RE-ARM also cancels the remaining scheduled automatic retries, preserves cumulative weight, and leaves the original GHC timeout deadline unchanged.
- The physical GHC pink light remains the skin-independent user cue; Streamline plugin surfaces remain an optional enhanced UI.


## v0.1.18 built-in diagnostics

Diagnostic logging is enabled by default and is passive: it adds no DE1 control commands and does not alter the v0.1.17 brew state machine. During each armed HyperEx run the plugin samples roughly every 100 ms (configurable) and stores the most recent run in memory.

Captured fields include phase, machine state/substate, profile frame, target flow/pressure, measured machine flow/pressure, machine weight-flow when present, scale weight, scale `weightFlow` (GFlow), HyperEx cumulative weight, scale age, and GFlow/machine-flow ratio. Event markers include stage-1 weight trigger, Idle release requests, soak start/completion, second-stage arm/re-arm attempts, GHC pour confirmation, skipStep transitions, and final stop.

After a run finishes, Streamline-compatible skins show a `DIAG LAST` header surface while HyperEx is idle. It opens a diagnostics page with stage summaries and the raw CSV. The same data is available from the plugin HTTP endpoints `diagnostics` (JSON) and `diagnostics-csv` (CSV). Diagnostics are kept only in memory and are replaced by the next completed HyperEx run.

## v0.1.19 diagnostics CLOSE fix

- Diagnostics opened as a Streamline overlay close with the plugin surface `streamline:close` message.
- When the same plugin UI is opened as a normal plugin page, CLOSE falls back to browser `history.back()` instead of sending an overlay-only close message.
- The same close helper is used after one-tap RE-ARM auto-close.

## v0.1.20 raw-scale diagnostics

Brew control remains the v0.1.17/v0.1.16 state machine. This release changes diagnostics only.

- Keeps **DE1 machine Flow** as firmware flow estimation; it is not treated as direct flow-meter truth.
- Keeps Decaid scale **`weightFlow`** as a separate channel.
- Captures **RAW scale weight** from each `/ws/v1/scale/snapshot` message.
- Computes **RAW dW/dt** directly from adjacent raw scale weights and the scale snapshot timestamps. A detected tare/reset drop intentionally leaves RAW dW/dt blank for that sample.
- The diagnostics CSV keeps the combined machine/scale table and adds an independent `raw_scale_*` table with raw timestamp, raw weight, adjacent RAW dW/dt, Decaid `weightFlow`, phase, and tare marker.
- The diagnostics page shows DE1 machine Flow / Decaid `weightFlow` / RAW dW/dt together for each HyperEx stage, plus the final raw scale weight and raw-flow readings.

No global `calFlowEst` changes and no GFlow PID/closed-loop control are introduced in v0.1.20.


## Flow Calibration water requirement

v0.1.26 provides two empty-basket calibration modes:

- **Low Water (default):** 3 ml/s × 3 s prime, then 9 plateaus × 6.0 s, about **93 ml nominal command water**, with an active stop at about **240 g actual collected water**. Recommended for routine calibration.
- **Full:** 3 ml/s × 3 s prime, then 12 plateaus × 6.0 s, about **143 ml nominal command water**, with an active stop at about **270 g actual collected water**. Use this when a denser LUT is useful for troubleshooting.

For both modes:

- Use **EMPTY BASKET** only.
- Use a catch vessel of at least **300 ml**.
- PREPARE FLOW CAL reads the DE1 water-level stream when available. It blocks if the tank is at/too close to the refill threshold, warns on a small remaining height margin, and requires explicit manual confirmation if live water-level data is unavailable/stale.
- Tare the scale before starting.
- Do not remove the vessel until the machine returns to Idle.
- The plugin requests Idle when the mode's actual-water safety cap is reached, leaving margin for stop latency below the 300 ml vessel recommendation.

The Diagnostics / Flow Cal page shows the selected mode, prime, expected command water, actual-water stop cap, live tank level/refill threshold (mm), and catch-vessel requirement before the calibration profile is selected.

## v0.1.26 real-flow calibration + scoped DE1 flowMultiplier

The v0.1.16/v0.1.17 HyperEx dump/soak/GHC state machine is intentionally unchanged. v0.1.26 refines the calibration layer around it.

### Goal

`Stage1Flow`, `Stage2Flow`, and `Stage3Flow` are now treated as desired **cup-scale mass flow** targets in g/s. When a valid calibration map is available, the plugin converts those real-flow targets to DE1 profile command-flow values with an inverse LUT. With no valid LUT, it safely falls back to the numeric DE1 flow commands used by earlier versions.

### Flow Calibration workflow

### Strict v0.1.26 quality gate

- Low Water and Full start with a short prime that is **not** used in the LUT fit.
- Each calibration plateau uses the tail of the plateau after a settle period; RAW scale weight vs scale timestamp is linearly regressed.
- Every plateau is shown in Diagnostics, including rejected points and the rejection reason.
- A LUT is accepted only when stable monotonic points tightly bracket **all three HyperEx real-flow targets (1.5 / 2 / 5 g/s)**. A wide interpolation gap no longer counts as valid coverage.
- The suggested DE1 `flowMultiplier` is calculated only from points accepted into the final LUT.
- v0.1.24 calibration maps are treated as legacy/stale and must be rerun before they can control HyperEx.
- If the strict gate fails, the plugin keeps the previous valid map unchanged and **does not auto-sync** a new HyperEx profile.


On first load the plugin creates/updates both `HyperEx Flow Calibration - Low Water` and `HyperEx Flow Calibration - Full`. Open **DIAG / CAL**, choose the desired mode, and press **PREPARE FLOW CAL**; the plugin selects the already-existing matching profile. Low Water is the default. PREPARE performs a live DE1 tank-level preflight when possible. Tare the connected scale, start Espresso manually, and let the profile return to Idle (unless its actual-water safety stop ends it earlier).

For every profile frame the plugin uses the raw scale `weight + timestamp` samples. It discards the configured settling interval, performs a linear regression over the tail window, and records:

- DE1 command flow;
- RAW scale mass-flow slope (g/s);
- DE1 machine Flow;
- Decaid `weightFlow`;
- pressure;
- regression R² and sample count.

A valid monotonic map is persisted in plugin storage and, by default, automatically synced into the HyperEx Pulse Filter profile. The generated profile notes show the mapped DE1 command values.

### DE1 machine Flow / flowMultiplier

The calibration also calculates a single best-fit `flowMultiplier` suggestion for making DE1 machine Flow closer to RAW scale mass flow over the measured staircase. This is separate from the real-flow LUT.

Scope choices:

- **OFF** — the plugin never writes `flowMultiplier`.
- **HYPEREX ONLY** — default. When HyperEx or Flow Calibration is selected, the plugin can temporarily apply the multiplier tied to the calibration map; when another profile is selected it restores the previous machine value.
- **GLOBAL** — the machine multiplier remains in effect for all profiles. A global write is never automatic: the diagnostics page requires the explicit **APPLY SUGGESTED GLOBALLY** action and saves the prior value for **RESTORE PREVIOUS GLOBAL**.

If a different multiplier is selected for a future calibration (including the suggested value), rerun Flow Calibration. A LUT is tied to the multiplier at which it was measured.

### Safety

Flow Calibration is for an **empty basket** and a sufficiently large catch vessel. The existing independent emergency stop remains active: pressure above the configured hard limit (8 bar default) for three samples sends Idle and aborts the calibration run.


## v0.1.26 cooperative dashboard shortcut

- The Decaid Plugins page is now the primary idle entry for Diagnostics / Flow Cal. Opening the plugin UI directly while idle lands on the diagnostics/calibration page.
- New setting **Dashboard idle DIAG/CAL shortcut** defaults to **off**. This prevents HyperEx from continuously competing for Streamline's reserved header-button space when another plugin already uses it.
- Users who explicitly want the idle `DIAG / CAL` header shortcut may enable it in plugin settings. HyperEx does not implement any polling/reclaim loop for the slot; Streamline remains the sole arbiter.
- Active-shot status surfaces (release / soak / GHC / running calibration) remain available because they are transient operational cues, not persistent idle launchers.
- The diagnostics page explicitly reminds users to open **Plugins → HyperEx Pulse Filter** if a dashboard shortcut is unavailable.


### v0.1.43
- Dashboard `DIAG / CAL` now opens diagnostics using the same Streamline page-navigation model as the plugin Settings `OPEN` path instead of a separate overlay route.
- `CLOSE / HOME` no longer uses `/` or browser-location fallbacks; Dashboard entry returns through Decaid history, preventing accidental launch of the system browser.
- Keeps the diagnostics command-provenance cleanup (`APPLIED`, `LATEST SHOT`, `PROPOSED`, `MEASURED`) unchanged.


## v0.1.48 profile truth guard

HyperEx desired S1/S2/S3 values are always cup-scale real mass-flow targets (g/s). The DE1 workflow profile must contain only LUT/adaptive actuator commands. When a HyperEx workflow is selected, the plugin now compares the selected workflow execution steps against the generated LUT/adaptive profile. A mismatch is repaired before the controller arms, and a shot that begins before verification is stopped and excluded from adaptive history. Diagnostics reports the actual workflow readback rather than treating in-memory commands as authoritative. The old static HyperEx_Pulse_Filter.json bootstrap profile is no longer shipped because its literal 2/5/1.5 machine-flow values could be mistaken for calibrated commands.


## v0.1.48 persistent adaptive history

Each completed HyperEx shot appends a compact record to pluginStorage key `adaptiveHistoryFileV2` (up to 30 shots). Records carry a calibration/LUT fingerprint, actual shot commands, RAW regression summaries, S1 startup metrics, S3 stability/stall data, the adaptive decision, and the compact evidence used by the controller. On load the plugin restores only rows whose fingerprint matches the current calibration map, flowMultiplier binding, and S1/S2/S3 real-flow targets; incompatible history remains stored for diagnostics but cannot drive numeric adaptation. A write/readback probe verifies pluginStorage availability. If the probe fails, Diagnostics explicitly reports SESSION ONLY: same-session adaptation remains active, while cross-reload/version history is disabled. Legacy evidence is kept out of current numeric consensus; v0.1.49 additionally requires truth schema 2 and a matching frozen fingerprint.
