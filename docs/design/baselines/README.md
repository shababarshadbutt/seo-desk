# Screenshot Artifacts Convention

Playwright screenshots captured during the redesign (baseline "before" shots and post-implementation "after" shots) are **not** stored under `docs/design/`. They go to:

```
artifacts/ui-audit/<route-group>/before-{desktop,tablet,mobile}.png
artifacts/ui-audit/<route-group>/after-{desktop,tablet,mobile}.png
```

`<route-group>` matches the route group names in `docs/design/PROGRESS.md` (e.g. `login`, `dashboard-home`, `websites`, `scripts`). Route groups with multiple states (e.g. Scripts: list/detail/running/terminal/success/failure) get one file per state, e.g. `before-desktop-running.png`.

`artifacts/` is listed in `.gitignore` — these screenshots are working artifacts for visual comparison against Stitch, not committed to version control.
