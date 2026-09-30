# Store Builder

The distributor fills this in on his phone during the 40-minute setup meeting, mostly by tapping, then saves one file and sends it on WhatsApp. The onboarder sets up his store on the real platform from that file.

Run the `foodbridge-v7` preview and open `http://localhost:8007/store-builder/`. On a computer, open `http://localhost:8007/store-builder/desktop/` (see *Desktop* below).
Tests: from `v7/`, run `node --test store-builder/test/*.test.js`.

## Six steps

1. Shop
2. Products: a short menu, not a list. Search (English or Hindi, by product, brand, company or kind), *Your products* with their prices, then tiles **By company** (a pack photo each) or **By type** (the aisles of a shop, fresh and loose goods first). A tile opens a picture grid; a tap chooses, *Select all* takes the lot.
3. Contacts: add from the phone's contact list (search, tick many, Add, as WhatsApp's share contact) or type a name; then tag each one customer / staff / supplier / not needed. The tag is suggested from the name ("… Kirana" → customer, "… Agency" → supplier, "… Driver" → staff), and "The rest are customers" tags the whole queue in one tap. Tabs hold what each kind needs: customers' delivery days and ⭐, staff jobs, suppliers' companies. More edits, re-tags or removes a contact.
4. Warehouse stock (was *Godown stock*, renamed 28 Sep 2026)
5. How does your daily operation look like? (was *How you work*, renamed 28 Sep 2026)
6. Send

A step's button is **Save**, which goes back to the steps list; he picks the next step from there.

Companies and per-company rates were steps of their own until 26 Sep 2026. The companies he sells now follow from the products he chose (`SB_MODEL.syncCompanies`). The export marks any price nobody gave as *Standard margin — confirm*.

It looks like the onboarding flow (`modules/foodbridge-onboarding`): the same tokens, type, rows, pinned green button and sheets, with line icons from `icons.js`.

Every screen:
- Hindi or English, with 🔊 to read the question aloud.
- Photos of paper and voice notes: from *daily operation* (voice) and *Send* (Photos & voice).
- Saves itself on the phone. Nothing leaves it until he saves or shares the file.

## Desktop

`desktop/` is the same builder for a computer, not the phone page made wider (1 Oct 2026). Both pages keep the same answers, in the same browser: `model.js`, one localStorage key, and photos and builds through `outbox.js`. So a store started on one page carries on in the other on that browser. It does not move between devices.

- **One layout start to end:** a first visit opens the desk on Shop ("Let's make your store"). There is no separate start screen. Each section ends with *Next: …*, and Daily work with *Check and build*. The rail still opens any section.
- **Files go along with each step (both pages):** at the end of each step, before Next, a card asks for that step's paper (a rate list, a customer list, a stock sheet…) with *Attach files*. He can fill the step, part of it or none of it, and attach too. On Products, Contacts and Stock a file lets the team finish the step (`model.js` `fromFile`). Build ends with *Anything else to send?*
- **Dropped files:**
  - Every file goes to FoodBridge as it came, under `raw/`, in pieces when over 2.5 MB. The team panel (`v7/stores.html`) lists them under *Files he dropped in*.
  - Contacts files and lists (`.vcf`, `.csv`, `.xlsx`) are also read into Contacts by `desktop/import.js`.
- **The desk, three columns with one job each:**
  - Left, *Steps*: numbered 1–5, ending in *Send to FoodBridge*.
  - Middle, the work: white, with *Step N of 5*.
  - Right, *Your store request*: a line per step filling in as he goes, with Build my store.
  - Products: a picture grid. Click ticks, Shift-click ticks a run, and prices can be typed in the list on the right.
  - Contacts: sort with 1 2 3 0. The customers' week is a grid to drag across.
  - Stock: a count sheet, filled with Enter down the column.
  - Daily work: every question on one page.
- **Width:** made for 1100px and wider; the rail folds to icons under 1360px. The phone page offers the desktop page on a computer.

## Export

A zip containing:
- An Excel workbook with 13 sheets: Read me, Store, Companies, Products, Customers, Suppliers, Staff, Routes, Opening stock, Opening balances, Settings, Papers, To follow up.
- The photos and voice notes.
- `setup.json`: the whole session, for the onboarder's import. The tool no longer reopens it.

What the export marks:
- Catalogue MRPs: *Catalogue — check on pack*.
- Anything said from memory: *Owner said — confirm*.
- Prices worked out at the standard margin: *Standard margin — confirm*.
- Stock that wasn't counted: *Not counted*, never zero.

## Catalogue

Food only. Soap, detergent, shampoo and the rest went on 26 Sep 2026, along with the eight companies that sold only those.
- **Packed:** 146 products from 24 companies. Each has a real pack photo and barcode from Open Food Facts, Open Beauty Facts or Open Products Facts (CC BY-SA, credited on screen). Every match was checked by hand as an India pack. Scanning a pack's barcode finds it in the catalogue.
  - MRPs are indicative.
  - GST is by category (GST 2.0 slabs).
  - Photos need internet.
- **Loose and fresh:** 52 goods with no brand. Vegetables, fruits, eggs, chicken, mutton and fish, loose milk, paneer and curd, loose rice, wheat and dal, and dry fruits.
  - Each is sold per kg, dozen, tray, bunch, piece, litre or pack.
  - Each has a Hindi name and a picture (emoji: no internet, no licence).
  - There is no MRP. The owner gives the price, and until he does, *To follow up* lists it.
- **Aisles** (`aisles` in `catalogue.js`) lay out *By type*. Every category sits in exactly one aisle.
- A save made before this change drops any product that is no longer in the catalogue when it opens (`SB_MODEL.tidy`).

## Limits

- **Phone contacts:** they open through the browser's contact picker.
  - Android Chrome has it on.
  - iPhone Safari has it too, but only after *Settings → Apps → Safari → Advanced → Feature Flags → Contact Picker API* is turned on (older iPhones: *Experimental Features*). The button walks him through it.
  - No web page can reach iPhone contacts any other way. Only a native app could, with no setting.
- **Barcode scanning** works in Android Chrome only.
- Platform field names come from the replica's seeds. Check them against the real bulk import.
