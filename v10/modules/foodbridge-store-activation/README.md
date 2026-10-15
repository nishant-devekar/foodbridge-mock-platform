# Store activation, cloned into v10

The store-activation module's own modal: **`store-activation-v0.1.12`**, as released to QA, from
`foodbridge-module-digital-assistant` (`modules/store-activation`). It is used as is: upload, reading, the
review sheet, the map picker and submit are the module's components, unchanged.

| Path | What |
| --- | --- |
| `app/` | the built page (React inside the bundle, the module's Tailwind utilities). `app/VERSION` names the tag |
| `build/adapter/main.tsx` | the only v10 code: v10's host ports, and the frame protocol with the Control Tower |
| `build/build.sh` | rebuilds `app/` from a tag of the module repo; nothing in that repo is changed |

**What runs where.** The module's in-memory API (`dev/mockApi`) answers like its backend; its reader answers
from the module's test-bed read results, and **Try a sample file** works. The host ports are v10's: saved
products and customers are kept in `localStorage` under `fb.v7.sa.store`, with the rows still waiting in an
open import (`open.items`, `open.customers`).

**How the Control Tower uses it.** A journey step whose payload has
`"flow": { "module": "store-activation", "step": "items" | "customers", "mode": "setup" }` opens this page in
one frame over the tower (`#ct-flow`). The frame stays for as long as the tower is open, so an import that is
half fixed is still there the next time. The tower reopens it with
`postMessage({ type: "fb:sa:open", step, mode })`, and the page answers `{ type: "fb:sa:closed" }` when the
modal closes. The tower then reads `fb.v7.sa.store` as the journey's facts for Products and Customers
(`saFacts()` in `screens/control-tower.js`).

**As released, so desktop only.** Under 1024 px the module shows its own "Activate your store on a computer"
screen. On a phone the journey's step sheet still offers each step's demo link.

```sh
sh build/build.sh            # default: ../../../../foodbridge-module-digital-assistant, store-activation-v0.1.12
```
