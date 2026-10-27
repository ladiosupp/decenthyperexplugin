# HyperEx 1.75 handoff · 2026-10-28

Baseline GitHub 1.74 commit a6e6f7e95c5c2fdf3166463bd95c7cfc602ee91c. User supplied run1793143669213-1 screenshots: saved/last cup approach still3s despite dragging1.5s; no saved edit. S3 late cup flow remains above target. Photos alone do not identify precise blocked down-write gate or physical cause.

Implemented independent refill-settings-save with revision/idle/storage validation and busy lock; persists settings+previous change only, no profile/override/learning source changes. UI Save refill settings button, success/error; 1.5s survives reload in simulation. Existing full apply remains.

S3 live upward corrections wait1600ms after previous write; same-frame RAW regression now exposes .75s tail vs earlier segment and bounded-time forecast. If fast flow >=98%target or forecast >=target hold upward. Existing down path, bounds, pressure/feedback protections retained. No S3 manual curve reset. Does not establish root cause of user's high plateau; command-bound or missing target may still limit downward action. No unsupported hardware claim.

Display-only zero bridges between stage1 and brew groups for combined flow, raw rendered slope, weight and issued-write line. Uses existing real elapsed timestamps; does not fit RAW across restart or inject zeros in original data, CSV, summaries or learning. Other gaps still break. Weight zero bridge is explicitly schematic per user request, not measured mass.

505/505 simulations PASS, generated HTML script syntax checks included. Two old chart expectations adapted to requested continuous zero bridge; six new checks added. No full browser/device validation. Preserve LUT/history, S3 user values, 1.74 full5g/s S2 target and wet-onset assessment. No agents used. No GitHub upload in this turn.
