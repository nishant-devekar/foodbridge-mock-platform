# Product management, frozen discovery v7 (cloned into v10)

`discovery/versions/v7/` is `foodbridge-module-product-management`'s **discovery v7 Products page, locked
2026-10-13** (its Addendum 019, commit `f377dfa`), copied byte for byte. It is the HTML prototype, not
the module's Development build: nothing here is built or wired to the module's packages. Its own seed data
and its discovery "server" rules come with it, as do the "Discovery controls (not module UI)" panel and
the other screens of the snapshot (product detail, raw materials, categories, catalogue, image gallery).

v10 points **Product Master → Finished Goods** at `discovery/versions/v7/screens/products-list.html`
(`assets/modules.json`). To refresh it from a later lock, copy the module's `discovery/versions/<vN>/`
over this folder as it is.
