# Control Tower tests

Run from `v7/`.

**Headless (unit, integration, failure paths)**: no dependencies.

```bash
node --test test/control-tower/*.test.js
```

**Browser end to end**: needs a running v7 server, Chrome, and `puppeteer-core`
installed anywhere (it isn't a dependency of this repository).

```bash
NODE_PATH=/path/to/node_modules node --test test/control-tower/e2e/control-tower.e2e.js
```

`CT_BASE` (default `http://localhost:8007`) and `CHROME` override the defaults.

Every suite runs on real records: the demonstration tenant's own Zoho export,
and onboarding's own sample import for the money path (`fixture.js`).
