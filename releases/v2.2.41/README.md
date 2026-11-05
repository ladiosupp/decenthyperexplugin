# HyperEx 2.2.41 experimental

Install [HyperExPulseFilter_v2.2.41_experimental.zip](HyperExPulseFilter_v2.2.41_experimental.zip). [中文交接 / Handoff](../../HANDOFF_v02241.md).

Command-scoped local gain, original angle scale, time-correct prediction, rate-bounded S2 recovery and uncertainty-labelled rescue timing. Control-quality diagnostics are separate from learning eligibility. Hardware validation pending.

Validation: 767/767 regression checks (including generated browser scripts), 3/3 existing simplified closed-loop checks. No new hardware-history calibration was possible; these counts do not establish real-device accuracy.

SHA256: `d9ba5e83ca84bd2ba3fa666ea87a757276ad996efb9d64d1d5035a4a7d5d7d74`

Rollback: reinstall 2.2.39; 2.2.40 remains at [its release directory](../v2.2.40/README.md). Reverting software does not undo learning history written by test shots.

Submitted by ChatGPT / OpenAI Codex. Published files on branch v1.79ds; this directory is not a GitHub Release entry.
