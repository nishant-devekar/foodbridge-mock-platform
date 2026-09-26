# Store Builder

The distributor fills this in on his phone during the 40-minute setup meeting, mostly by tapping, then saves one file and sends it on WhatsApp. The onboarder sets up his store on the real platform from that file.

Run the `foodbridge-v7` preview and open `http://localhost:8007/store-builder/`.
Tests: from `v7/`, run `node --test store-builder/test/*.test.js`.

## Twelve steps

1. Shop
2. Companies
3. Rates (buy and sell price per ₹100 of MRP, once per company)
4. Products
5. Phone contacts, sorted into shop / supplier / staff / not needed
6. Shops (delivery days, ⭐ big shops)
7. Staff
8. Suppliers
9. Usual orders
10. Godown stock
11. How you work
12. Send

Every screen:
- Hindi or English, with 🔊 to read the question aloud.
- 📷 for photos of paper and voice notes.
- Saves itself on the phone. Nothing leaves it until he saves or shares the file.

## Export

A zip containing:
- An Excel workbook with 15 sheets: Read me, Store, Companies, Products, Customers, Suppliers, Staff, Routes, Usual orders, First orders, Opening stock, Opening balances, Settings, Papers, To follow up.
- The photos and voice notes.
- `setup.json`, which reopens the session (menu ⋯ → Open a setup file).

What the export marks:
- Catalogue MRPs: *Catalogue — check on pack*.
- Anything said from memory: *Owner said — confirm*.
- Stock that wasn't counted: *Not counted*, never zero.

## Catalogue

182 products from 32 companies. Each has a real pack photo and barcode from Open Food Facts, Open Beauty Facts or Open Products Facts (CC BY-SA, credited on screen). Every match was checked by hand as an India pack. Scanning a pack's barcode finds it in the catalogue.
- MRPs are indicative.
- GST is by category (GST 2.0 slabs).
- Photos need internet.

## Limits

- Picking phone contacts and barcode scanning work in Android Chrome only. Elsewhere he types names in or opens a contacts file.
- Platform field names come from the replica's seeds. Check them against the real bulk import.
