# HyperEx Pulse Filter 0.1.62

Based on delivered/GitHub1.61. Install over the same plugin; retain LUT/history and valid starting commands. No new calibration or dedicated coffee tests. No1.62 hardware validation yet.

## 下一杯曲线编辑（Step 2）

Step2 now contains a visual command editor with5 selectable handles: S1,S2,S3 EARLY/MID/LATE. Select a handle and drag vertically, use ↑/↓ buttons, or keyboard arrows. Each button advances to the next native1/16ml/s command level. Preview the draft and current commands, inspect generated parameters, then click 应用到下一杯. This is an explicit next-shot application, never a running-shot edit. Preview does not write to the machine.

The vertical axis is DE1 flow command ml/s, not measured cup g/s. Gray dashed is current setup; orange is draft. This is a stage diagram: S1/S2 remain weight-triggered, release/soak are omitted, and the S3 handles show their actual0/early/early+mid second starts. Change S3 EARLY/MID durations with±1s buttons (3–30s); late runs to final weight. S3 retains non-decreasing commands and existing adjacent-rise limits. No free-form profile frames, extra skipStep calls, physical-response guarantee or invented delay model.

Editing S1/S2 preserves other stage modes and current commands. Editing S3 enables the3-part shape; switching shape off gives flat S3 at the middle command. Flow command bounds remain0.1–8ml/s. Draft/current visibility switches are separate. Dirty drafts survive refresh; changed applied parameters disable applying an obsolete draft until reloaded. Applying requires selected verified HyperEx, idle state, valid LUT, a fresh unchanged workflow, upload acknowledgement and final readback. Failure rolls back previous overrides. A successful upload followed by a page-refresh failure remains labelled applied, with a refresh warning. A successful application updates Step2 APPLIED PROFILE and provenance. Old-run automatic or manual adaptive proposals cannot overwrite the new curve; new completed coffees continue normal learning. Numeric precision editor remains under optional Step3 details, using the same storage/profile source, verification/rollback and prior-run supersession. RETURN ALL TO LUT also verifies application and suppresses stale old-run proposals. AUTO APPLY remains unchanged.

## Curve and decision output audit

- Real-scale flow chart has independent visibility checkboxes for cup target, RAW cup flow, Decaid cup flow, machine target, machine actual and issued flow commands. Units remain visible; original raw weight chart unchanged.
- Issued writes use small upward/downward arrows according to command change. SAME-target retries use↻, rather than falsely counting another increment. Historical writes without a recorded previous command have an unknown-direction dot. ACK is not a cup-output confirmation; matching machine target remains a separate square.
- Validation now has an adjacent 下一杯决策 panel explaining each stage's output error, whether an adjustment is proposed/applied/failed/held/waiting, and the exact learning blocker. Manual application marks the old cup analysis as superseded. An available proposal is not described as already applied before successful readback.
- Fixed-target learning previously tried dynamic exposure only when fixed-window seconds were too short. It now tries the dynamic path if ANY fixed-window admission gate fails, including temporal coverage or consistent-cohort share. Prefer an eligible dynamic analysis. RAW/machine/pressure gates, ≥1.2s and6unique source samples,R²≥.90, S2≥2.4s,25% temporal coverage,60% consistent-window share, matching two-cup consensus and correction bounds remain unchanged.
- Learning reports structured actual/required seconds, temporal coverage, consistent-window share and precise failures. It no longer says merely “need2.4s” when2.84s has already passed that condition. This repairs a skipped analysis path; it does not guarantee every MISS should cause an automatic adjustment.

## Retained controller and learning behavior

Original LUT unchanged. S1 startup quality gates unchanged; normal next-shot S1/S2 deadband8%,S3 LEVEL8%. Live target band2% is an aim, not guaranteed physical precision; DE1 command quantum1/16ml/s. Unique RAW source timestamps, pressure/actuator and fresh-machine guards retained. S3 timed subframes advance naturally. Only the original2business skip transitions; physical GHC confirmation remains. Home temperature persists; temperature alone does not invalidate numeric consensus or require a new LUT. Actual output review stays separate from labelled target-normalized local-model learning. Whole-cup smoothness supports overall outcome, not isolated per-write causal proof.

|Level|Check cadence|Check cap S2+S3|Write cap including retries|
|---|---|---|---|
|1|planned duration/50,minimum300ms; default944ms|2000|50|
|2|300ms|2000|150|
|3|250ms|2000|200|
|4|200ms|2000|250|

Live trim default OFF; diagnostic slider/native dropdown. Success waits at least50ms for BOTH ACK and matching target, then next level tick/new source sample. Missing target alone does not end trim: after3misses, retry SAME unresolved target at least3s after prior send while continuing checks. Matching target recovers automatically; no unconfirmed accumulation. Missing driver ACK retains original abort path. Budgets never reset on recovery. Original pressure/no-scale/total-time/final-weight safeguards and post-shot profile restoration remain.

## Validation

243/243 Node simulations: retained controller tests, generated browser-script compilation, UI draft/refresh/stale checks, pointer and keyboard interaction with a simulated DOM, quantization/shape/time bounds, real HTTP handlers for application and reset, rollback, fresh workflow edits, prior-run suppression/new-run learning, queued evaluation restoration, successful application vs failed UI refresh, arrow/retry direction, explicit stage decisions and dynamic fallback when fixed seconds pass but coverage fails. Generated full HTML has balanced elements and unique IDs; generated editor SVG parses as XML. Fixtures are synthetic, not unavailable user RAW replays.

Full browser visual/touch rendering was unavailable (Chromium/Firefox and SVG raster delegate not installed); simulated DOM/pointer checks are not hardware or full WebView validation. Existing handheld/tablet screenshots remain the actual1.60 evidence. No1.62 device results yet.

Run node --check plugin.js and node tests/verify_v0162.cjs. Current HANDOFF_v0162.md and tests/RESULTS_v0162.txt accompany this package. LICENSE and original calibration JSON are unchanged. Delivered older ZIPs remain immutable; old remote files retained for history.
