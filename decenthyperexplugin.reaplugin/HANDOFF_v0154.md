# HyperEx 1.54 handoff · 2026-10-26 Asia/Shanghai

## Latest authorized scope
User requests experiment: S2+S3 up to50 checks and50 write opportunities, interval based on expected duration (~944ms default), ±6% cup-flow band, default-OFF independent switch, plot check/write points, keep existing next-shot learning active. Latest explicit instructions override earlier skill blanket prohibition on live flow control only for this opt-in bounded experiment. Still no extra skipStep, global calibration changes or LUT overwrite.

Implementation is in plugin.js. README.md gives exact protocol/gates/limits/operator steps. Stock-DE1 A010 frame semantics were checked against official Decaid encoding, but immediate-current-frame behavior is NOT hardware verified. Do not call ACK proof of actuation or claim convergence. ACK missing -> Idle abort; ACK without target response -> stop further live corrections. Model gate excludes Bengle v2. All metadata/limiter bytes preserved except flowSetVal. Startup A002 experiment from1.53 remains separate default OFF and still unverified.

Normal next-shot learning stays active. Changed-frame evidence is taken only from last verified command's stable post2s settle windows; otherwise hold that affected phase. Never assign corrected output to shot-start command. Keep S1 evidence and history. Restore full original profile at Idle by clearing runtime machine ACK, then normal next-shot evaluation applies eligible consensual bounded corrections. Live trace is retained in diagnostic/compact history, not raw LUT.

## Prior hardware evidence
1.52 installed and first coffee:5 saved /1 compatible /4 baseline references; actual seed .719 S1 /2.507 S2 /S3 .698×8s→.720×14s→.778. S1 startup1.327g/s MEDIUM, S2 3.413 vs5, S3 1.396 vs1.5, ratio.857 STABLE. First-coffee adaptation waiting/PENDING. No second dedicated coffee acceptance; use ordinary consumed coffees for later evidence.
1.53 delivered with REST-then-raw A002 test,143/143 simulated checks, ZIP7620b6a892584caa2049fd7eb9c0638cea8e3a03bb9bad67bc697c0cf9fa196e. No real-machine result received. 1.52 originalZIPf28c944a77c8ae5670c981bc0c393f00dbed712606cb210032b22c84c1f62340 preserved.

## Validation and remaining risks
167/167 simulations passed, including original143 checks plus live-trim protocol/counters/limits/concurrency/feedback/restoration/learning/marker tests. Browser-render check uses clearly synthetic in-memory fixture, not real RAW. Results in tests/RESULTS_v0154.txt. Firmware frame rewrite timing, target effects, pump/cup delay, installed Decaid compatibility and convergence require hardware observation. Native DE1 quantum1/16ml/s may make±6% impossible in some low-flow conditions.

GitHub main last verified1.52 commit5874f39f02acfb72a8164e46a3a4f513f1ddc92e; no1.53/1.54 upload. Privacy request remains unfinished; browser fallback authorization not yet granted. Do not claim private. Low Water curve immediate-stop: preflight gate reproduced in simulation; affected user's actual logs missing, no fix included. Dashboard CLOSE/HOME device issue remains.

User requests early warning/handoff before conversation grows too long, not fictitious precise token monitoring. Android canonical Library viewer link failed; /api/library/files/<actual library_file_id>/download requested as browser download. Preserve actual IDs; no invented links.
