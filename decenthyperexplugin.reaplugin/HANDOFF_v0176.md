# HyperEx 1.76 handoff · 2026-10-28

Based on delivered 1.75 and GitHub commit1a969f11b7278aa1de5ead3a63e235f249127d07. User screenshot shows save failed with endpoint refill-settings-save not available; draft1.5s/cutoff80%. Confirmed manifest omitted new HTTP endpoint, so host rejects before existing handler. Add declaration only plus version/docs/tests. Preserve control algorithms and prior settings/history/LUT. New host-manifest registration + HTTP handler save/reload test and all handler declaration coverage. No new device proof. On install host must reload plugin manifest, not just diagnostic page. Old ZIPs immutable. No agents.

507/507 simulations PASS, including all HTTP handler IDs registered and real handler persistence/reload. Generated scripts checked in suite. ZIP validated and SHA256 delivered separately.
