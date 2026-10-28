# HyperEx 1.77ds handoff — 2026-10-28

Development build on top of delivered 1.76 (commit 88f0756). Version label is deliberately `1.77ds` (local tuning build). It is **not strict semver**: Decaid's manifest parser accepts it, but `comparePluginVersions` reduces it to core `1.0`, and a GitHub **release** install would still require an X.Y.Z tag. Keep this build local unless the version is changed.

## Fixes from the 1.75/1.76 review

1. **Refill save verifies storage by read-back.** `saveS2RefillSettings` writes the record, then calls `storageRead(STORAGE_S2_REFILL)` and waits (1.5 s) for a matching read. Success is reported only when the returned basis and five numeric fields match what was written. A missing or different read returns 409 with「补水参数已写入，但没有收到存储回读确认」. A mismatched read leaves the previous in-memory settings untouched. This closes the "UI says saved, reload reverts" hole left open by 1.76.
2. **Abort reset timer is tracked.** `abortSequence` now stores its 1.2 s `resetSequence` timer in `state.abortResetTimer`; `clearAllTimers` clears it, and the callback only resets when the phase is still `aborted`. A new shot can no longer be wiped by a late reset from the previous abort.
3. **Escaping covers attribute quotes.** The generated UI's `esc()` now escapes `"` and `'` in addition to `& < >`.
4. **Single version constant.** `PLUGIN_VERSION` drives the manifest/runtime/page strings instead of 16 hard-coded copies.

I checked the two manifest entries I previously described as dead: `changed` and `ghcPrompt` are `type: "websocket"` event declarations, not HTTP endpoints. They are legitimate and were left untouched.

## Validation

- `tests/verify_v0177ds.cjs`: **511/511 pass**. 507 inherited checks (two adapted for the read-back), plus four new: read-back success, read-back mismatch refusal, bidirectional manifest/handler/UI consistency, version consistency, abort-timer tracking, quote escaping.
- Generated HTML script syntax is exercised by the suite. No 1.77ds hardware, full-browser or WebView validation.

## Local simulator (not part of the plugin package)

`sim/` at the repository root loads the real `plugin.js` in a VM with a fake host, virtual clock and a small hydraulic plant, and serves a browser dashboard on `http://127.0.0.1:4780`.

- `sim/harness.js` — plugin loader, fake API/storage/transport, plant model, shot runner.
- `sim/server.js` — static server + `POST /api/run`.
- `sim/public/` — parameter panel, flow/weight/pressure charts, A/B comparison, JSON export.
- `sim/README.md` — model description and limits.

The machine side follows Decaid's own `mock_de1.dart`: 100 ms ticks, a 0.35/tick first-order flow response, pressure proportional to machine flow, and the current frame's limiter (or 11 bar) feeding back to cap flow. Cup flow is fitted to the user's 0.1.77 export (20 steady points): `cup = 1.883 * machineFlow^0.564`, R2 0.984, times a user-set yield factor. `skipStep` advances one profile step and resets the step clock, matching Decaid's mock. Decaid ships no cup-scale model, so weight remains an integration of cup flow plus noise. It is a trend tool: it does not reproduce Decaid profile verification, GHC interaction, real pump/valve dynamics, firmware closed loops or host storage timing.

## Packaging

Same 9-file layout as 1.76 inside `decenthyperexplugin.reaplugin/`; `sim/` stays outside the plugin directory so it is not shipped in the ZIP. Old ZIPs remain immutable. No release upload was made for this build.

