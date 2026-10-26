# HyperEx Pulse Filter 0.1.64

Based on delivered/GitHub1.63. Install over the same plugin; retain LUT/history and valid starting commands. No new calibration or dedicated coffee tests. No1.64 hardware validation yet.

## Historical consensus lookup fix (1.64)

A newer cup lacking S2 evidence, with a different phase command/context, or restored from unverified disk used to terminate the history search immediately. That could hide an earlier valid matching cup and make a currently admitted S2 keep reporting REPEAT SAME COMMAND. Now scan newest-to-oldest through the retained history and select the first comparable verified cup. Apply the same correction to S1/S3 history lookup.

Keep the same LUT/target/context/storage truth and stage command/shape checks. After finding the newest comparable cup, retain the existing variability/error-direction/pressure/actuator gates. Never skip a newer contradictory comparable cup to find an older agreeing one. No evidence is invented for a currently inadmissible stage. Missing current evidence still waits; this does not force every MISS into an adjustment.

The decision panel shows lookup counts (checked, missing stage, incompatible context/commands, unverified disk) and matched source run. These are translated while preserving raw IDs. A synthetic before/after replay of the same history (valid S2 → intervening missing-S2 row → current valid S2) changes old REPEAT to ADJUST2.507→2.607ml/s, then passes automatic upload and workflow verification. This reproduces a software defect, not the user's unavailable original1.62 RAW data. The exact blocker in the newly reported1.62 cup still needs its screenshot; do not assume this is its sole cause.

## 中文／English switch (1.63)

The page header now has 中文 / English buttons. Default language is Chinese; the chosen language is saved in existing pluginStorage under uiLanguage and restored on reopen/reload. Switches apply immediately without page reload, profile upload or a new machine request. Curve drafts, selected handles, input values, source records and learning history remain unchanged. Preference saves are serialized; an unsuccessful storage request visibly restores the prior language. Late initial-storage reads cannot overwrite a newer explicit choice.

Coverage: generated diagnostics/GHC pages, Step1–4 headings and controls, curve editor, automatic status and gate explanations, marker titles/details, confirm/alert dialogs, and plugin-provided dashboard/header/shot-strip text. RAW,LUT,ACK,DE1,units and product names are intentional technical terms. Raw CSV/JSON, numeric input values, IDs and code blocks are never translated. The native Decaid Plugins/settings interface is rendered by Decaid from manifest metadata and is outside the plugin page switch; this switch does not alter Decaid's app-wide language.

Text translation is reversible and observes newly rendered nodes, tooltips and accessible labels. Original text is retained in WeakMaps so switching cannot accumulate translation artifacts. The bootstrap is independent from the main diagnostics script; original CLOSE/HOME failure containment remains. The embedded reviewed catalog contains777phrase entries/aliases. Raw external error messages without a catalog entry remain original diagnostic text, not invented translations. The catalog is embedded in plugin.js; no remote translation/network service or extra dependency is used.

## Default live trim: ON / level3 (1.63)

User-authorized defaults now enable live trim at level3:250ms checks,2000check cap across S2/S3,200write cap including retries. Manifest and loadConfig defaults match; invalid/missing level falls back to3. Explicitly saved OFF or a different valid level is retained, so upgrading does not force a user's stored preference. A saved level1 remains1. Original ACK/pressure/source/command bounds,2%target aim and recoverable missing-target policy unchanged. Direct-driver-start test remains OFF. The initial slider, checkbox and instructional text match the new defaults.

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

Live trim defaults ON at level3; diagnostic slider/native dropdown. Saved explicit choices are retained. Success waits at least50ms for BOTH ACK and matching target, then next level tick/new source sample. Missing target alone does not end trim: after3misses, retry SAME unresolved target at least3s after prior send while continuing checks. Matching target recovers automatically; no unconfirmed accumulation. Missing driver ACK retains original abort path. Budgets never reset on recovery. Original pressure/no-scale/total-time/final-weight safeguards and post-shot profile restoration remain.

## Validation

263/263 Node simulations: interrupted historical lookup, missing-stage/context/command/storage exclusions, newest-conflicting-row retention, S3 lookup, absent evidence and automatic upload verification; plus reversible localization, newly authored text, raw CSV/JSON/input preservation, dialogs, storage rollback/late-read/serialization, dashboard actions, all static language coverage, ON/level3 defaults and explicit saved preferences; plus retained controller tests, generated browser-script compilation, UI draft/refresh/stale checks, pointer and keyboard interaction with a simulated DOM, quantization/shape/time bounds, real HTTP handlers for application and reset, rollback, fresh workflow edits, prior-run suppression/new-run learning, queued evaluation restoration, successful application vs failed UI refresh, arrow/retry direction, explicit stage decisions and dynamic fallback when fixed seconds pass but coverage fails. Generated full HTML has balanced elements and unique IDs; generated editor SVG parses as XML. Fixtures are synthetic, not unavailable user RAW replays.

Full browser visual/touch rendering was unavailable (Chromium/Firefox and SVG raster delegate not installed); simulated DOM/pointer checks are not hardware or full WebView validation. Existing handheld/tablet screenshots remain the actual1.60 evidence. No1.64 device results yet.

Run node --check plugin.js and node tests/verify_v0164.cjs. Current HANDOFF_v0164.md and tests/RESULTS_v0164.txt accompany this package. LICENSE and original calibration JSON are unchanged. Delivered older ZIPs remain immutable; old remote files retained for history.
