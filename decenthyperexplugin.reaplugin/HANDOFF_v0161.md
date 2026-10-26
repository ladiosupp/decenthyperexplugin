# HyperEx 0.1.61 handoff — 2026-10-26

Current source is1.60 plus recoverable target-feedback loss. User authorized relaxing missing-target protection to avoid premature cessation; prior ongoing GitHub upload authorization retained. Current changes do not change S2 learning admission or fake hardware confirmation.

## Current change
- Remove terminal fourth-consecutive-target-miss stop. First3 retries use existing path; fourth and later enter monitoring-degraded-target-feedback.
- Level checks continue. SAME unresolved target retries only at least3000ms after its last dispatch. One pending request, ACK required, no unconfirmed quantum accumulation.
- Exact fresh observed machine frame/target resets miss streak and monitoring status; normal control then needs the existing source/time/pressure gates. Reset no budgets.
- Every send including retries now requires a new source-scale endpoint compared with the last send. Fresh data, valid regression, same frame and output direction remain mandatory. Inside target band sends nothing; reversed error holds.
- Frame transition discards previous frame retry before another send. Check/write caps unchanged:2000 checks, L3 200writes; retries consume write cap. Missing ACK/transport/pressure/global brew protection unchanged.
- Diagnostics explicitly labels recoverable policy and slower retry after3 misses. Report fields feedbackPolicy=recoverable-same-target-retry,degradedRetryIntervalMs=3000.
-219/219 Node simulations pass plus node syntax and generated script compilation in the suite. New cases cover12 consecutive missing responses,3s cooldown while checks continue,late recovery,reversed direction,stale telemetry,write cap,new frame,new scale endpoint and check cap. These are synthetic; no1.61 hardware test yet. Browser visual rendering unavailable.

## Latest 1.60 hardware evidence (screenshots only)
Four distinct screenshots visible out of user's stated5. No original RAW trace; do not invent missing fifth content.
Run1792973999887-1: L3 250ms,target-feedback-missing-4-consecutive,153/2000checks,17/200writes,17ACK,10target responses,7misses/streak4,retries4. Exact cause of trim stop is old target policy, not budgets/skipStep.
S2 overall2.974g/s(-40.5%),R².94991,12s; tail60% mean3.73(-25.41%),CV10.35%,overshoot0%. Found2.84s usable learning windows but admission fails. Current reason conflates2.4s minimum,25% temporal coverage and60% cohort-duration check. Screenshot alone cannot identify which additional gate failed. Source fallback runs only when fixed total<2.4s; coverage rejection after that is a follow-up design issue. Do not claim resolved in1.61.
S3 actual overall1.472g/s(-1.9%),R².99897,35.79s; tail1.423(-5.14%),CV6.84%,overshoot7.93%.27.46s across3confirmed regions admitted to learning,normalized overall1.412,ratio.755STABLE; waiting for matching second cup. Actual quarter ratio.798. Normalized response and actual measured cup output differ by design; label honestly.
S1 startup1.384 vs previous1.074,mean1.229,variation25.2%,hold same .778 command. Original LUT untouched.

## Release
ZIP HyperExPulseFilter_v0161_fresh.zip, root decenthyperexplugin.reaplugin/. LICENSE/calibration JSON byte-identical to1.60. Do not overwrite old delivered ZIPs. README current; tests/verify_v0161.cjs and RESULTS_v0161.txt are the current validation. GitHub commit hash recorded in conversation after upload. Preserve all old remote files via base tree and expected-head protection.

## Earlier detailed handoff (historical; current facts above supersede)

# HyperEx1.60 handoff ·2026-10-26 Asia/Shanghai

Current source based on GitHub1.59 commit52d1934fa4d38b5cf0fcfb76124316115a37ef0b. Read current README.md/tests/RESULTS_v0160.txt. Package frozen before GitHub synchronization; final release commit records completion. Prior ZIPs immutable.211/211 simulated checks; no1.60 hardware validation. Browser rendering unavailable (no Chromium).

## User requirements

S2 remains MISS without numeric adjustment. User wants relaxed evidence admission because live-control output is trustworthy, narrower live±2%/next-shot±8%, no fixed2s pause after successful feedback, and ordinary users should get analysis within the plugin rather than repeatedly sending screenshots/CSV. User notes hydraulic inertia could smooth discrete switching; model estimates are NOT measured machine latency. Fixed-frequency open-loop dithering was not requested/implemented. Keep high-frequency checks and feedback-gated corrections, not mandatory writes each sample.

##1.59 device observations

User screenshots:11saved/5compatible/5empty-or-upgrade references; coffee context and shaped seed restored. Starting S1.778,S2 2.507,S3.698×8s→.720×14s→.778. Live level3,250ms,shot-finished,checks203/2000,writes15/200,ACK15,target responses9,misses5/streak1,retries3. Thus budget no longer stops at200 and feedback tolerance operates across shot. Raw end94.9g,completed cumulative101.90g,576combined/869RAW. No exact cause assigned to raw/cumulative difference.

Clear final photo: S1first-rise10.29s,20–80%1.074g/s,R².97033,transit2.18s,22samples,active3.73s,MEDIUM; pending same-command consensus. S3actual quarters1.520/1.460/1.531g/s,late/early1.007 STABLE,no stall;frame regressions1.641/1.414/1.472 at nominalseed.698/.720/.778. S2 and S3 numeric evidence absent (—,INSUFFICIENT), not unapplied suggestions. Original1.59 learning path used only final write's confirmed command+2s settle+≥5s stable data, conflicting with frequent correction in short S2. Original exported trace not supplied, so precise failed gate for that device cup is not proven.

##1.60 implementation

- New controlLearningAssessment uses actual observed target/frame/pressure/flow against bounded initial/written command catalogue. All good constant epochs can contribute; short-window pooling or dynamic target-exposure normalization handles rapid correction. Original RAW untouched. Phase evidence is normalized to starting seed using a labelled local proportional model, so output after live trim is never falsely assigned directly to starting command.
- Constant windows750ms settling,≥1.2s/6unique/R².90; S2≥2.4s total, S3≥1.2/frame and5s total,≥25% region temporal coverage, robust cohort within25% median containing≥60% candidate-window duration. Dynamic fallback integrates observed targets over source-scale intervals; RAW and model fits both≥.90. No unsupported fixed latency or exact gain claim.
- Actual dynamic actuator coverage/pressure gates replace shot-start-command assumptions for corrected stages. Still≥80% fresh/4 samples,20% pressure-limit and25% actuator-under-command gates. Missing target attribution yields explicit reason; RAW outcome can still be reviewed. Known S3 stall withholds normalized evidence. Two-cup matching and bounded correction retained; compatible profile-frame vs normalized-frame evidence can match, incompatible quarter/frame bases remain isolated.
- Next-shot tolerances8% (S1/S2 and ordinary S3 LEVEL); live2%. Empty qualification/calibration search thresholds remain separate. Quantum1/16 unchanged;2% not guaranteed. No forced dither/static one-quantum veto.
- Both ACK and matching target can release pending wait after50ms; next level tick and new source endpoint required. Missing-response fault timeout stays max(2s,2periods),three-miss tolerance/fourth stop,missing-ACK Idle abort. No accumulating unconfirmed commands. Per-frame±20%,write/check budgets and original protections unchanged.
- controlRunReview rendered directly in diagnostics: RAW goal tracking/smoothness,phase-wide vs final60% metrics,learning reasons,action-group before/after error changes.3s grouping and clean pre/post windows; insufficient overlap labelled, no per-write causal claims. Good-output labels are heuristics(abs tail error≤8%,CV≤10%),not standards. Exports optional for exceptions; no routine screenshot/CSV requirement. Diagnostic learning values clearly distinguished from actual RAW.

## Validation and next work

211/211 Node tests, generated scripts compile, ZIP/source comparisons. Tests include late-unconfirmed yet earlier-valid S2, bounded next-shot application,3S3frames,rapid commands/dynamic fallback,pressure/coverage/raw integrity,±2/8%,fast release requiring BOTH feedbacks/new scale/min50ms,missing-response fault behavior,and self-review grouping. Fixtures synthetic,not true user replay. New model/time gates require hardware observation through ordinary coffees, not extra dedicated tests. Do not call a flat curve proof of every isolated action's physical response. No promise of perfect automatic diagnosis.

User previously asked early conversation-length warning/handoff; this conversation is long. Current handoff carries state. Keep historical LUT and all records; no reclassification/deletion or extra calibration. Native GHC confirmation preserved. Latest GitHub synchronization is authorized in this session; preserve LICENSE/history and use expected-head ref update. Commit submitter OpenAI Codex(GPT-6).

Historical handoff follows; older budget/temperature/exact-last-window statements are superseded by current section.

# HyperEx1.59 handoff ·2026-10-26 Asia/Shanghai

Read current README.md and tests/RESULTS_v0159.txt. User explicitly requested final update uploaded to GitHub ladiosupp/decenthyperexplugin, with submitter/model in commit. Baseline remote main15d8bc0dac78762720475c6bdba10c980dee9e56 (1.54). Package finalized before upload; completion SHA is in release commit/final response. Preserve root LICENSE and all historical files. Earlier ZIPs immutable.

## Latest scope implemented

- All live levels maxChecks2000; maxWrites50/150/200/250 by levels1–4. Cadences remain original(default944)/300/250/200ms. Actual retries consume writes. Keep response waits,quality/pressure/bounds,one pending write,3missing-target tolerance,missing-ACK abort,profile restoration and normal learning. No automatic enable.2000 is plugin software cap, not firmware/Decaid maximum. Max-run and natural termination still end the shot sooner.
- New numericLearningFingerprintKey strips only shotSettings.temperature for trusted completed run/history restore/previous-evidence matching. Stored full fingerprints retain temperature; exact storage validation/audit/profile equivalence are not weakened. Cross-temperature records can form numeric consensus under all original quality/pressure/command/variability/bounds checks. Basket context,physical LUT,targets,multiplier,other settings still match.
-1.58 home-temperature adoption and qualification/seed-preservation remain. Temperature default setting only seeds new profiles; existing profile/home value authoritative. No separate temperature store. No resetting empty qualification for routine temperature adjustment. Keep original LUT/history.

190/190 simulated checks pass, generated HTML scripts compile. New cases: >200checks continues,2000 cap,all independent write caps;92°C prior plus94°C new forms consensus and applies bounded correction with LUT unchanged; old-temperature metadata preserved;other-context bindings and pressure gates still reject evidence. Browser visual rendering unavailable (Chromium missing). No1.59 hardware evidence.

Potential S3 issue remains: unresolved target whose cup error reverses is held rather than blindly accumulated. Need existing JSON trace to determine if1.57 entered unconfirmed-target-direction-changed. Do not guess skipStep root cause or request additional dedicated coffee tests.1.57 budget exhausted at200, not necessarily this hold. Existing three missing-target allowance unchanged.

Prior engineering/hardware handoff follows as historical evidence; any older temperature exclusion,version/test count or budget statements are superseded above.

# HyperEx1.58 handoff ·2026-10-26 Asia/Shanghai

Read current README.md and tests/RESULTS_v0158.txt.1.58 is based on delivered1.57, no1.58 hardware validation and not uploaded GitHub. Current count185/185 simulation checks; older counts/policies below are historical. Latest verified GitHub1.54 commit15d8bc0dac78762720475c6bdba10c980dee9e56. Prior delivered ZIPs immutable.

## New user report and1.57 evidence

Home brew-temperature increase is overwritten to92°C. User then supplied1.57 test, explicitly corrected version from1.56 to1.57 and said this cup was94°C. Screenshots: level3,250ms,200-check-budget-complete,checks200/200,writes8,ACK8,target confirmations5,target misses3/streak3(tolerate3),retries2. Thus tolerance worked and checks continued through S3 to budget; not a first-miss stop. No raw export yet.

Shot-start .719/2.507/.569 flat AUTO/LUT. Source says basket context changed; previous overrides ignored; using LUT baseline. UI says EMPTY BASELINE,1/3 and1baseline reference; do NOT ask user to restart empty calibration. Prior1.55 had9saved/4compatible and coffee state with appliedS1.778 and shapedS3.698/.720/.778. A simulation on exact1.57 reproduces92→94 causing NORMAL COFFEE→EMPTY BASELINE and invalid coffee seed despite retained history. This is strong code-path evidence matching screenshots, not proof there were no other concurrent setting/storage changes.

S2RAW3.141g/s vs5(-37.2%),R².97356,window11.9s. S3RAW1.110 vs1.5(-26%),R².99545,46.41s; late/early.639 LATE DECAY,EARLY1.466/MID1.105/LATE.937,no stall. S1wholeRAW.311,R².42858,10.87s; startup20–80%1.603g/s,R².92931,transit1.2s,11samples,MEDIUM;first-rise.13s may involve initial noise, do not use whole-S1 deficit as command correction. Completed101.20g,RAW94.3g,620combined/935raw. Do not invent cause of cumulative/RAW difference.

User asks whether cup-to-cup learning is diverging and whether S3 stops due skipStep. Distinguish: starting trajectory changed, so not a controlled comparison of cadence/bypass. Final status is budget exhausted, not skipStep stop.3missing targets and2retries may leave unresolved-target error reversal hold; source1.57 holds when direction flips. This branch is unchanged in1.58. Need existing JSON trace to establish frame/command/target/check reasons; no extra dedicated coffee run requested.

##1.58 implementation

- Fresh selected workflow GET moved before expected-profile creation/upsert. Uniform valid70–100°C selected HyperEx stage temperature is adopted; all other flow/pressure/timing validation and normal profile repair remain.
- Notification temperature adoption while idle increments context revision to invalidate old in-flight sync; deferred fresh verification handles races. Do not adopt active-shot temperature into the frozen run or live A010 profile.
- Workflow itself persists home temperature across reload; no second KV temperature or self-reloading settings POST. Native Temperature setting renamed INITIAL DEFAULT for new curves. Advanced field is effective-temperature readout directing home adjustment, removed from settings save map.
- New qualificationFingerprintKey ignores basket-context and temperature only for qualification/baseline references. Routine temperature adjustment retains coffee context, empty qualification, original LUT/history and bounded command seed. Physical LUT/targets/other-settings changes still invalidate unrelated qualification.
- Numeric learning/trusted-run fingerprints still include temperature: old-temperature evidence stored but incompatible for current numeric consensus. No relabelling/deleting old records.1.57 bypass logic unchanged.

185/185 Node checks pass, generated scripts compile. Tests cover temperature reload, shaped frames, other-field repair,bounds,active-shot freeze,LUT/seed preservation,coffee qualification vs full numeric fingerprint,baseline refs,in-flightGET race, and all prior bypass/startup/slider checks. Browser rendering unavailable because no Chromium. Hardware feedback pending.

Previous handoff follows for historical details, superseded by this section.

# HyperEx1.57 handoff ·2026-10-26 Asia/Shanghai

Read README.md and tests/RESULTS_v0157.txt first.1.57 is based on delivered1.56; not uploaded GitHub and no1.57 hardware validation. Prior released ZIPs immutable. Current simulation count175/175; older counts below are historical.

## New1.55 hardware evidence from five screenshots

Level2:300ms,checks53/150,writes6/150,driver ACK6,target responses5,stopped driver-ack-but-no-machine-target-response. Confirms higher cadence setting active but still early stop on final missing target. No raw exported trace supplied; do not claim transition root cause.

S1 wholeRAW.187g/s,R².45382,11.8s. Startup first rise9.16s,20–80%1.410g/s,R².988,transit1.55s,16samples,active2.91s,MEDIUM; do not use wholeRAW deficit for startup command. Two startup evidence values1.418→1.410,mean1.414,var.6%,HIGH consensus. This shot started S1.748ml/s; next-shot actual workflow .778ml/s,applied+verified+machine upload acknowledged. This is actual automatic application evidence, not just proposal. Native MANUAL TEST label is an existing override representation, not proof user manually made this adjustment.

S2RAW3.282 vs5g/s(-34.4%),R².9837,10.93s. Main white-flow curve has slow ramp AND platform around3.7–3.9g/s, lower than prior roughly4.5; cannot attribute all deficit to ramp. S3RAW1.447 vs1.5(-3.5%),R².99959,36.17s,HIT,late/early.886 STABLE,no stall. Quarters1.653/1.423/1.465; timed-frame regressions1.759/1.406/1.454. S2/S3 next-shot REPEAT/INSUFFICIENT; exact failed gate needs exported trace. History9saved,4compatible,4empty/pre-upgrade baseline refs retained. Completed cumulative101.50g vsRAW94.2g; retain difference without inventing cause.

## User-authorized change

User requested tolerating e.g.3 missing targets instead of stopping on first, or sending each sample. Implemented limited tolerance, NOT unchecked sample-rate actuation:
- Acknowledged write without matching target after max(2s,2periods) increments total/streak; first3 tolerated, fourth stops live trim, normal brew continues.
- Matching target resets consecutive streak. Missing driver ACK still aborts with Idle.
- Unconfirmed write does not advance known command. Same-frame retries repeat exactly the same target, only with fresh regression/pressure/actuator/bounds checks. No quantum accumulation before target confirmation.
- Error enters band -> hold; reverses -> hold unresolved target. Late target during retry hold can confirm. New frame drops old-frame retry; normal new-frame checks continue. Retries consume budget; final-budget watchdog remains.
- UI/JSON/CSV counters include total/streak/retries and timeout/bypass/write events. Normal next-shot learning remains; unconfirmed corrected-frame windows ineligible. Raw LUT never rewritten.

175/175 Node tests pass including all retained control/profile/history/UI tests plus first3/fourthstop,same-payload retry,no blind commands,success reset,late target,pressure/stale/error reversal,frame transition,budget cap and missing-ACK abort. Generated scripts compile. Browser visual QA unavailable: no Chromium. No new dedicated coffee tests requested; use existing logs/normal consumed coffees.1.56 changes were slider only;1.57 changes tolerance and command bookkeeping.

Previous1.56/1.55 handoff follows; those statements describe their versions, especially prior stop-on-first policy, now superseded.

# HyperEx1.56 handoff ·2026-10-26 Asia/Shanghai

Based on delivered1.55. User requested slider instead of typing trim level. Advanced Settings now has range min1 max4 step1 plus live Chinese label displaying cadence/budget; native Plugins settings changed number to enum strings1–4 because host only supports standard widgets, no slider. Old numeric level is still accepted by loadConfig; diagnostics reads effective numeric level and saves the corresponding enum string. Selection does not enable live trim and dragging alone does not save/reload. Existing save button applies through shared settings.

168/168 Node checks pass, including final generated scripts compiling and DOM-stub settings load/label/save test. No browser visual rendering (Chromium unavailable) or1.56 hardware validation. No control/startup/safety changes vs1.55; prior default-OFF and original GHC guards remain.1.56 not uploaded GitHub. Prior ZIPs remain immutable.

Video subsequently supplied: mmexport1792968517491.mp4, official attachment libfile_70d2fd7d88608191a476f536d0f09401. Approx33s screen confirm,37s physical GHC touch,38s UI switches cancel-wait to pause,55s still preheating,55.5–56s blue/green lights and output-counting UI,60s accumulated weight begins to rise. Supports physical confirmation followed by preparation delay. Pink light alone cannot classify awaiting-confirmation; do not derive exact machine substates/pump timing from video. This is flow-calibration startup, not proof of HyperEx restart timing. New20s cup-gain watchdog removal remains warranted as avoiding false timeouts.

Earlier1.55 handoff follows for retained engineering evidence; its version/test/upload statements describe that earlier release.

# HyperEx1.55 handoff ·2026-10-26 Asia/Shanghai

Read README.md and tests/RESULTS_v0155.txt. Baseline1.54 is uploaded at15d8bc0dac78762720475c6bdba10c980dee9e56.1.55 not uploaded; no1.55 hardware evidence. Delivered ZIPs immutable. Earlier HANDOFF_v0154.md is historical and its not-uploaded statement is stale.

## Latest user requests and evidence

Remove new20s cup-weight startup insurance; keep original safeguards. Four levels: current,300ms/150,250ms,calculate upper tier. User reports startup failed, physical GHC still required, cup flow flatter. Clear screenshot: checks17/50,writes4/50,ACK4,target responses3,interval944ms,stopped driver-ack-but-no-machine-target-response. Do not claim sustained S3 closed loop or fourth-write root cause. New diagnostic event makes future frame/target mismatch inspectable; stop policy unchanged.

S2 RAW3.611 vs5g/s(-27.8%),R².97547,10.09s. S3 RAW1.542 vs1.5(+2.8%),R².99927,32.38s,late/early.885 STABLE,no stall; quarters1.767/1.530/1.564. S1 first rise4.63s,20–80%1.418g/s,R².9828,transit1.52s,15samples,active2.82s,MEDIUM. Whole S1.451 includes onset delay. Shot-start S3 commands .698/.720/.778 are snapshots.

Additional chart: white cup flow starts around3s, reaches roughly4.5g/s around8s, transition near12s; visual estimates, not source regression. User correctly notes S2 slow ramp. Separate onset/ramp/plateau analysis is future work, NOT implemented; do not boost steady commands by whole-stage27.8%.

## Startup investigation

Official Decaid commit f2248a756f80639c5f96e1fbdd4c426c956fbca4:
- doc/device-notes/de1.md#group-head-controller-start-restriction explicitly describes firmware GHC physical-start restriction.
- de1handler.dart REST -> controller.requestMachineState -> UnifiedDe1.requestState -> Endpoint.requestedState(A002), espresso04.
- unified_de1.raw.dart uses same transport.writeWithResponse for raw writes.
- de1.models.dart stateInfo A00E is a separate notification path; receiving a state change is not an exposed writable button.
- Official de1app machine.tcl ghc_message/start_espresso reinforces physical confirmation and UL limit. No supported writable GHC press endpoint was found in inspected code; firmware internals not inspected. Do not assert impossible in all firmware, or spoof interlock/GHC flags.

Added code restores original GHC timeout/retries after REST even when startup switch enabled; GHC/unknown skips raw; no-GHC DE1 may retain legacy raw.5s optional setup cleanup is transport-only, no Idle. New20s sustained-weight observer removed entirely. Manual rearm/pour/cancel invalidate late raw work. Existing other safety code unchanged.

## Controller changes and limits

Four levels in README. Fourth200ms/250 is chosen experimental software ceiling, not proven machine maximum. Default47.2s supports157/188/236 fixed-period ticks; level2 capped150. Underlying scale sampling unchanged. Keep ≥2s write response spacing, regression quality and bounds; opportunities are not executed writes. Finite hardware max requires scale/ACK/target/cup-response latency measurements unavailable here.

LUT, seed, history, normal next-shot learning/stable-command evidence and idle full-profile restoration retained. Corrected-frame evidence cannot be attributed to starting command. Final-budget pending write remains monitored before stop; no51st/151st/etc check.

## Verification and next work

167/167 updated Node simulations pass (different test set from1.54's167): retained learning/profile/pressure/data tests, all levels, frozen settings, bounds, feedback waiting, budget caps/final-write timeout, startup guards/cancellation, generated browser-script compile. Browser visual rendering not run: installed Playwright lacks Chromium executable. No claim of new hardware validation.

Keep user's4empty baselines and filled-basket acceptance already used on1.52. Observe ordinary consumed coffees only; no repeat calibration/dedicated coffee campaign. Low Water/CLOSE-HOME remain separate. Warn before context grows too long, not fake precise token tracking. Upload1.55 to GitHub only if user requests. Preserve LICENSE. Use real file IDs for Android downloads.
