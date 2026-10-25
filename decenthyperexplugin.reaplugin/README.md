# HyperEx Pulse Filter 0.1.54 — experimental in-shot flow trim

2026-10-26 Asia/Shanghai. Based on immutable delivered 1.53. The new experimental switch is default OFF, independent of DirectDriverStartTest. Install over existing data; preserve LUT, history and command seed.

## Settings
- **TEST: S2/S3 live flow trim (50 cycles)** / LiveFlowTrimTest: new default-OFF switch. Also in diagnostic Step 3 Advanced Settings; save normally.
- **TEST: direct driver write after soak** / DirectDriverStartTest: existing 1.53 default-OFF switch. When ON: after full soak, REST Espresso request succeeds first, then one raw A002=04 write. 20 s from dispatch must observe actual pouring and sustained 2 s cup-weight increase or abort with Idle. No automatic re-arm retries during this test. It is not a proven GHC bypass. This switch is independent; enable only if intentionally testing startup too.

## Live flow experiment
Normal first start, dump/soak/GHC flow remain when startup test OFF. Only S2/S3 are eligible for live trim. Initial commands come from the existing LUT/next-shot correction layer; original LUT is never rewritten.

At shot start freeze period = ((S2Weight−S1Weight)/S2Target + (FinalWeight−S2Weight)/S3Target) /50, min300ms. Defaults4→40→100g,5/1.5g/s give944ms. This replaces the earlier300ms proposal for this experiment. Up to50 checks and50 write opportunities across S2+S3, not50 mandatory writes. Warm-up/inside-band/pending/limited checks consume a check but do not write. Async send acceptance and response waits may extend real spacing. Natural shot duration can end before budget.

Each check uses raw weight vs source timestamp regression over the recent1.6s, ≥6 unique samples, ≥1.2s span, R²≥0.90; frame settling1.6s and fresh scale/machine data≤600ms. Cup deadband±6%: S2 4.70–5.30g/s, S3 1.41–1.59g/s. S1 unaffected.

Write only one stock-DE1 current profile frame via Decaid raw WebSocket /ws/v1/machine/raw, characteristic A010, operation write. Preserve flags, temperature, encoded duration, volume and trigger; only SetVal flow byte changes. Extended pressure-limiter frames unchanged. No profile header/full upload during shot; no extra skipStep. Model must report DE1 family; Bengle v2 is not supported by this encoder.

One correction is one native1/16ml/s quantum; total bounded to±20% of the quantized initial command for that frame and normal0.10–8.00ml/s bounds. Do not increase under≥95% pressure limiter or insufficient actuator flow. The granularity is meaningful: nominal0.720 encodes0.750ml/s, next higher0.8125. ±6% cup-flow target may not be attainable without oscillation; no guaranteed convergence.

One write at a time. Record local dispatch, driver ACK and machine targetFlow response separately; wait at least max2s /2check periods before another correction. Missing ACK aborts with Idle. ACK but no corresponding target response stops further live trim, with a visible reason; no blind repeated increases. Driver ACK is not proof of current-frame effect or cup response. Firmware may ignore updates or apply them with different semantics. This is a hardware experiment, not validated control.

## Normal next-shot learning remains ON
The switch does not disable existing shot-to-shot learning. Initial seed, history and normal consensus/limits are retained. S1 and untouched phases use the original evidence path. For a corrected frame, require matching targetFlow feedback, then2s settling and≥5s of stable-command scale data; pair those data with the actual confirmed command, not the shot-start command. If insufficient, hold that stage while other valid stages can still learn. Do not use this requirement to ask for additional dedicated coffee tests; use normal consumed coffees.

Actual in-shot changes are not saved into the original LUT or blindly persisted as a next-shot seed. On completion/abort, invalidate machine upload ACK and restore the original application profile at Idle before the next shot can arm; then normal next-shot adaptation proceeds. On reload, normal verified full profile upload also restores the saved profile. Preserving application workflow readback does not independently prove DE1 internal memory contents.

## Diagnostics
Flow graph adds green circles = measured check g/s; gray baseline circles = check without usable regression; orange diamonds = raw write command ml/s; pale squares = machine target feedback ml/s. Real cup target is pink, machine target yellow. Chart shares time but streams use their labelled units. Tap a marker to display time/value/reason. Shot-start command table is explicitly a starting snapshot. Full JSON and CSV include experiment events/counters and trace. Markers from software simulations are not hardware measurements.

One run can show whether ACK/target feedback occurred and whether the curve improved. A smoother curve alone does not establish causality or guaranteed convergence. Prefer empty basket for the actuation experiment or one normal consumed coffee; the existing dedicated coffee acceptance allowance was already used on1.52. No repeated filled-basket acceptance campaign.

Original1.52/1.53 ZIPs are preserved. GitHub last verified1.52 commit5874f39f02acfb72a8164e46a3a4f513f1ddc92e. Neither1.53 nor this1.54 candidate has been uploaded. Low Water immediate-pause report remains unresolved and is not fixed here. See tests/RESULTS_v0154.txt and HANDOFF_v0154.md for evidence.
