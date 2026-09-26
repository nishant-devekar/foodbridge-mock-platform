/* Store Builder · the product catalogue.

   What a distributor picks from instead of remembering. Companies → brands →
   items, the way a distributor already thinks ("I am the Parle distributor").

   REAL PHOTOS. Every item carries a real pack photo and its barcode from the
   open product databases Open Food Facts, Open Beauty Facts and Open Products
   Facts (photos CC BY-SA, credited on screen). Each photo was matched to the
   product and checked by hand as an India pack; an item without a verified
   photo is not listed. No brand logos: those are trademarks.

   HONESTY RULES
   - MRPs are INDICATIVE. Most packs here are price-point packs (₹5, ₹10, ₹20),
     whose MRP is stable and whose grammage moves; the rest are close to the
     shelf in 2026 but must be checked on the pack. The export marks every
     catalogue MRP "catalogue — check on pack" until the owner touches it.
   - GST is by category, from the GST 2.0 slabs that apply from 22 Sep 2025
     (5% merit, 18% standard, 40% aerated drinks). It is a starting point for
     the accountant, not tax advice. The export says so.
   - Case sizes are typical outers. The owner corrects them in one tap.

   Adding a company or an item is a one-line edit below: nothing else changes.
   Item row: [id, companyId, brand, name, pack, mrp, piecesPerCase, category, barcode, photo]
   Photo prefixes: off: / obf: / opf: → images.open{food,beauty,products}facts.org/images/products/ */

(function (root) {
  "use strict";

  const PHOTO = { off: "https://images.openfoodfacts.org/images/products/", obf: "https://images.openbeautyfacts.org/images/products/", opf: "https://images.openproductsfacts.org/images/products/" };

  const categories = {
    biscuit: {"icon": "🍪", "hsn": "1905", "gst": 5, "en": "Biscuits & cakes", "hi": "बिस्किट और केक"},
    namkeen: {"icon": "🥨", "hsn": "2106", "gst": 5, "en": "Namkeen", "hi": "नमकीन"},
    chips: {"icon": "🥔", "hsn": "2005", "gst": 5, "en": "Chips & wafers", "hi": "चिप्स / वेफर्स"},
    noodles: {"icon": "🍜", "hsn": "1902", "gst": 5, "en": "Noodles & pasta", "hi": "नूडल्स"},
    choco: {"icon": "🍫", "hsn": "1806", "gst": 5, "en": "Chocolates", "hi": "चॉकलेट"},
    sweets: {"icon": "🍬", "hsn": "1704", "gst": 5, "en": "Sweets & toffee", "hi": "मिठाई / टॉफ़ी"},
    tea: {"icon": "🍵", "hsn": "0902", "gst": 5, "en": "Tea", "hi": "चाय पत्ती"},
    coffee: {"icon": "☕", "hsn": "2101", "gst": 5, "en": "Coffee", "hi": "कॉफ़ी"},
    healthdrink: {"icon": "🥤", "hsn": "1901", "gst": 5, "en": "Health & milk drinks", "hi": "हेल्थ ड्रिंक"},
    milk: {"icon": "🥛", "hsn": "0401", "gst": 0, "en": "Milk & buttermilk", "hi": "दूध / छाछ"},
    milkpowder: {"icon": "🥛", "hsn": "0402", "gst": 5, "en": "Milk powder", "hi": "दूध पाउडर"},
    dairy: {"icon": "🧈", "hsn": "0405", "gst": 5, "en": "Ghee & butter", "hi": "घी / मक्खन"},
    cheese: {"icon": "🧀", "hsn": "0406", "gst": 5, "en": "Cheese", "hi": "चीज़"},
    babyfood: {"icon": "🍼", "hsn": "1901", "gst": 5, "en": "Baby food", "hi": "बेबी फ़ूड"},
    sauce: {"icon": "🍅", "hsn": "2103", "gst": 5, "en": "Sauces & ketchup", "hi": "सॉस / केचप"},
    jam: {"icon": "🍯", "hsn": "2007", "gst": 5, "en": "Jam & honey", "hi": "जैम / शहद"},
    ready: {"icon": "🍲", "hsn": "2104", "gst": 5, "en": "Soups & ready mixes", "hi": "सूप / रेडी मिक्स"},
    cereal: {"icon": "🥣", "hsn": "1904", "gst": 5, "en": "Cereals & oats", "hi": "कॉर्नफ्लेक्स / ओट्स"},
    oil: {"icon": "🛢️", "hsn": "1512", "gst": 5, "en": "Cooking oil", "hi": "खाने का तेल"},
    spice: {"icon": "🌶️", "hsn": "0910", "gst": 5, "en": "Spices & masala", "hi": "मसाले"},
    salt: {"icon": "🧂", "hsn": "2501", "gst": 0, "en": "Salt", "hi": "नमक"},
    atta: {"icon": "🌾", "hsn": "1101", "gst": 5, "en": "Atta, rice & besan", "hi": "आटा / चावल / बेसन"},
    dal: {"icon": "🫘", "hsn": "0713", "gst": 5, "en": "Dal & pulses", "hi": "दाल"},
    sugar: {"icon": "🍚", "hsn": "1701", "gst": 5, "en": "Sugar", "hi": "चीनी"},
    water: {"icon": "💧", "hsn": "2201", "gst": 5, "en": "Drinking water", "hi": "पानी की बोतल"},
    juice: {"icon": "🧃", "hsn": "2202", "gst": 5, "en": "Juice & fruit drinks", "hi": "जूस"},
    softdrink: {"icon": "🥤", "hsn": "2202", "gst": 40, "en": "Cold drinks (fizzy)", "hi": "कोल्ड ड्रिंक"},
    soap: {"icon": "🧼", "hsn": "3401", "gst": 5, "en": "Bath soap", "hi": "नहाने का साबुन"},
    shampoo: {"icon": "🧴", "hsn": "3305", "gst": 5, "en": "Shampoo", "hi": "शैम्पू"},
    hairoil: {"icon": "💆", "hsn": "3305", "gst": 5, "en": "Hair oil & hair care", "hi": "बालों का तेल"},
    toothpaste: {"icon": "🪥", "hsn": "3306", "gst": 5, "en": "Toothpaste & brush", "hi": "टूथपेस्ट / ब्रश"},
    talc: {"icon": "🌸", "hsn": "3304", "gst": 5, "en": "Talc powder", "hi": "पाउडर"},
    skincare: {"icon": "🧴", "hsn": "3304", "gst": 18, "en": "Creams & face wash", "hi": "क्रीम / फेसवॉश"},
    shaving: {"icon": "🪒", "hsn": "8212", "gst": 18, "en": "Shaving", "hi": "शेविंग"},
    detergent: {"icon": "🫧", "hsn": "3402", "gst": 18, "en": "Detergent & bars", "hi": "सर्फ़ / डिटर्जेंट"},
    dishwash: {"icon": "🍽️", "hsn": "3402", "gst": 18, "en": "Dishwash", "hi": "बर्तन साबुन"},
    cleaner: {"icon": "🚽", "hsn": "3402", "gst": 18, "en": "Floor & toilet clean", "hi": "फ़र्श / टॉयलेट क्लीनर"},
    repellent: {"icon": "🦟", "hsn": "3808", "gst": 18, "en": "Mosquito & insect", "hi": "मच्छर / कीड़े"},
    baby: {"icon": "👶", "hsn": "9619", "gst": 5, "en": "Diapers", "hi": "डायपर"},
    sanitary: {"icon": "🌼", "hsn": "9619", "gst": 0, "en": "Sanitary pads", "hi": "सैनिटरी पैड"},
    ohc: {"icon": "💊", "hsn": "3004", "gst": 5, "en": "Balm & first aid", "hi": "बाम / दवा"},
    agarbatti: {"icon": "🪔", "hsn": "3307", "gst": 5, "en": "Agarbatti", "hi": "अगरबत्ती"},
    other: {"icon": "📦", "hsn": "", "gst": 18, "en": "Other", "hi": "दूसरा सामान"},
  };

  const companies = [
    {"id": "hul", "name": "Hindustan Unilever", "short": "HUL", "color": "#1F5AA6"},
    {"id": "itc", "name": "ITC", "short": "ITC", "color": "#1B4F72"},
    {"id": "nestle", "name": "Nestlé", "short": "Nestlé", "color": "#5B7A99"},
    {"id": "brit", "name": "Britannia", "short": "Britannia", "color": "#C8102E"},
    {"id": "parle", "name": "Parle Products", "short": "Parle", "color": "#D99A00"},
    {"id": "mdlz", "name": "Mondelez (Cadbury)", "short": "Cadbury", "color": "#4B2A7B"},
    {"id": "pepsi", "name": "PepsiCo", "short": "PepsiCo", "color": "#004B93"},
    {"id": "coke", "name": "Coca-Cola", "short": "Coca-Cola", "color": "#D71A28"},
    {"id": "pagro", "name": "Parle Agro", "short": "Parle Agro", "color": "#E8751A"},
    {"id": "amul", "name": "Amul", "short": "Amul", "color": "#0072BC"},
    {"id": "tata", "name": "Tata Consumer", "short": "Tata", "color": "#1A4E8A"},
    {"id": "dabur", "name": "Dabur", "short": "Dabur", "color": "#00843D"},
    {"id": "marico", "name": "Marico", "short": "Marico", "color": "#2E3192"},
    {"id": "awl", "name": "AWL Agri (Fortune)", "short": "Fortune", "color": "#C4161C"},
    {"id": "patanjali", "name": "Patanjali", "short": "Patanjali", "color": "#E07000"},
    {"id": "haldiram", "name": "Haldiram's", "short": "Haldiram's", "color": "#B3121B"},
    {"id": "bikaji", "name": "Bikaji", "short": "Bikaji", "color": "#D2232A"},
    {"id": "balaji", "name": "Balaji Wafers", "short": "Balaji", "color": "#C62828"},
    {"id": "colgate", "name": "Colgate-Palmolive", "short": "Colgate", "color": "#C4000C"},
    {"id": "pg", "name": "Procter & Gamble", "short": "P&G", "color": "#003DA5"},
    {"id": "reckitt", "name": "Reckitt", "short": "Reckitt", "color": "#C8005A"},
    {"id": "godrej", "name": "Godrej Consumer", "short": "Godrej", "color": "#6E2C91"},
    {"id": "wipro", "name": "Wipro Consumer", "short": "Santoor", "color": "#D9731A"},
    {"id": "jyothy", "name": "Jyothy Labs", "short": "Jyothy", "color": "#0067B1"},
    {"id": "emami", "name": "Emami", "short": "Emami", "color": "#B71C1C"},
    {"id": "mdh", "name": "MDH", "short": "MDH", "color": "#A0141E"},
    {"id": "everest", "name": "Everest", "short": "Everest", "color": "#9E1B32"},
    {"id": "bisleri", "name": "Bisleri", "short": "Bisleri", "color": "#00897B"},
    {"id": "himalaya", "name": "Himalaya", "short": "Himalaya", "color": "#00703C"},
    {"id": "mdairy", "name": "Mother Dairy", "short": "Mother Dairy", "color": "#0C4DA2"},
    {"id": "kelloggs", "name": "Kellogg's", "short": "Kellogg's", "color": "#C62D1F"},
    {"id": "renuka", "name": "Shree Renuka (Madhur)", "short": "Madhur", "color": "#7A5C00"},
  ];

  /* [id, companyId, brand, name, pack, mrp, piecesPerCase, category, barcode, photo] */
  const rows = [
    // Hindustan Unilever
    ["hul01", "hul", "Surf Excel", "Surf Excel Quick Wash", "1 kg", 225, 12, "detergent", "8909106006478", "opf:890/910/600/6478/front_en.7.200.jpg"],
    ["hul04", "hul", "Surf Excel", "Surf Excel Detergent Bar", "250 g", 35, 40, "detergent", "8909106040670", "opf:890/910/604/0670/front_en.5.200.jpg"],
    ["hul05", "hul", "Wheel", "Wheel Detergent Powder", "1 kg", 70, 12, "detergent", "8901030997723", "off:890/103/099/7723/front_en.3.200.jpg"],
    ["hul07", "hul", "Vim", "Vim Dishwash Liquid", "250 ml", 55, 24, "dishwash", "8901030889875", "off:890/103/088/9875/front_en.3.200.jpg"],
    ["hul08", "hul", "Lux", "Lux Soft Glow Soap", "100 g", 38, 72, "soap", "8901030539749", "obf:890/103/053/9749/front_en.10.200.jpg"],
    ["hul10", "hul", "Lifebuoy", "Lifebuoy Soap", "₹10 bar", 10, 144, "soap", "6281006483705", "off:628/100/648/3705/front_en.3.200.jpg"],
    ["hul13", "hul", "Clinic Plus", "Clinic Plus Shampoo", "175 ml", 110, 24, "shampoo", "8901030984709", "off:890/103/098/4709/front_en.3.200.jpg"],
    ["hul14", "hul", "Clinic Plus", "Clinic Plus Sachet strip (16)", "16 sachets", 16, 48, "shampoo", "8901030778445", "off:890/103/077/8445/front_en.3.200.jpg"],
    ["hul15", "hul", "Sunsilk", "Sunsilk Black Shine Shampoo", "180 ml", 150, 24, "shampoo", "6281006424548", "off:628/100/642/4548/front_en.3.200.jpg"],
    ["hul16", "hul", "Pond's", "Pond's Dreamflower Talc", "100 g", 95, 48, "talc", "8901030869013", "off:890/103/086/9013/front_en.4.200.jpg"],
    ["hul19", "hul", "Close-Up", "Close-Up Red Hot", "150 g", 115, 48, "toothpaste", "4800888147288", "off:480/088/814/7288/front_en.6.200.jpg"],
    ["hul20", "hul", "Red Label", "Brooke Bond Red Label", "250 g", 150, 36, "tea", "8901030877124", "off:890/103/087/7124/front_en.3.200.jpg"],
    ["hul21", "hul", "Red Label", "Brooke Bond Red Label", "₹10 pack", 10, 200, "tea", "8901030877124", "off:890/103/087/7124/front_en.3.200.jpg"],
    ["hul22", "hul", "Taj Mahal", "Taj Mahal Tea", "250 g", 220, 36, "tea", "8901030815140", "off:890/103/081/5140/front_en.5.200.jpg"],
    ["hul23", "hul", "Bru", "Bru Instant Coffee", "50 g", 115, 48, "coffee", "8901030519017", "off:890/103/051/9017/front_en.3.200.jpg"],
    ["hul24", "hul", "Kissan", "Kissan Fresh Tomato Ketchup", "850 g pouch", 110, 12, "sauce", "8901030534898", "off:890/103/053/4898/front.5.200.jpg"],
    ["hul25", "hul", "Kissan", "Kissan Mixed Fruit Jam", "200 g", 85, 24, "jam", "8901030922787", "off:890/103/092/2787/front_en.3.200.jpg"],
    ["hul27", "hul", "Horlicks", "Horlicks Classic Malt", "500 g jar", 250, 12, "healthdrink", "8901030993398", "off:890/103/099/3398/front_en.3.200.jpg"],

    // ITC
    ["itc01", "itc", "Aashirvaad", "Aashirvaad Shudh Chakki Atta", "5 kg", 280, 4, "atta", "8901725121129", "off:890/172/512/1129/front_en.30.200.jpg"],
    ["itc02", "itc", "Aashirvaad", "Aashirvaad Shudh Chakki Atta", "10 kg", 520, 2, "atta", "8901725121129", "off:890/172/512/1129/front_en.30.200.jpg"],
    ["itc03", "itc", "Aashirvaad", "Aashirvaad Salt", "1 kg", 28, 25, "salt", "8901725123123", "off:890/172/512/3123/front_en.13.200.jpg"],
    ["itc04", "itc", "Sunfeast", "Sunfeast Marie Light", "₹10 pack", 10, 72, "biscuit", "3948725000370", "off:394/872/500/0370/front_en.3.200.jpg"],
    ["itc05", "itc", "Sunfeast", "Sunfeast Dark Fantasy Choco Fills", "75 g", 40, 48, "biscuit", "8901725015879", "off:890/172/501/5879/front_en.16.200.jpg"],
    ["itc06", "itc", "Sunfeast", "Sunfeast Mom's Magic Cashew & Almond", "₹10 pack", 10, 72, "biscuit", "8901725013066", "off:890/172/501/3066/front_en.15.200.jpg"],
    ["itc07", "itc", "Bingo!", "Bingo! Mad Angles Achaari Masti", "₹10 pack", 10, 60, "chips", "8901725198558", "off:890/172/519/8558/front.4.200.jpg"],
    ["itc09", "itc", "Yippee!", "Yippee! Magic Masala Noodles", "60 g", 15, 96, "noodles", "8901725012830", "off:890/172/501/2830/front_en.3.200.jpg"],
    ["itc10", "itc", "B Natural", "B Natural Mixed Fruit", "1 L", 120, 12, "juice", "8901725100025", "off:890/172/510/0025/front_en.18.200.jpg"],

    // Nestlé
    ["nes01", "nestle", "Maggi", "Maggi 2-Minute Masala Noodles", "70 g", 15, 96, "noodles", "8901058905441", "off:890/105/890/5441/front_en.3.200.jpg"],
    ["nes02", "nestle", "Maggi", "Maggi Masala Noodles 4-pack", "280 g", 56, 24, "noodles", "8901058000306", "off:890/105/800/0306/front_en.10.200.jpg"],
    ["nes03", "nestle", "Maggi", "Maggi Masala-ae-Magic", "₹5 sachet", 5, 240, "spice", "0041056003003", "off:004/105/600/3003/front_en.3.200.jpg"],
    ["nes04", "nestle", "KitKat", "KitKat 2 Finger", "₹10", 10, 144, "choco", "7613035221390", "off:761/303/522/1390/front_en.3.200.jpg"],
    ["nes05", "nestle", "Munch", "Munch", "₹10", 10, 144, "choco", "8901058010701", "off:890/105/801/0701/front_en.3.200.jpg"],
    ["nes06", "nestle", "Milkybar", "Milkybar Choo", "₹5", 5, 240, "choco", "8901058859331", "off:890/105/885/9331/front_en.4.200.jpg"],
    ["nes07", "nestle", "Nescafé", "Nescafé Classic", "50 g jar", 180, 48, "coffee", "9556001140159", "off:955/600/114/0159/front_en.5.200.jpg"],
    ["nes08", "nestle", "Everyday", "Nestlé Everyday Dairy Whitener", "200 g", 105, 48, "milkpowder", "8901058869453", "off:890/105/886/9453/front_en.3.200.jpg"],
    ["nes09", "nestle", "Cerelac", "Cerelac Wheat Apple", "300 g", 225, 24, "babyfood", "6294017129012", "off:629/401/712/9012/front_en.3.200.jpg"],

    // Britannia
    ["bri01", "brit", "Good Day", "Good Day Cashew", "₹10 pack", 10, 72, "biscuit", "8901063093089", "off:890/106/309/3089/front_en.10.200.jpg"],
    ["bri02", "brit", "Good Day", "Good Day Butter", "₹5 pack", 5, 144, "biscuit", "0027407900016", "off:002/740/790/0016/front_en.3.200.jpg"],
    ["bri03", "brit", "Marie Gold", "Marie Gold", "₹10 pack", 10, 72, "biscuit", "8901063162365", "off:890/106/316/2365/front_en.3.200.jpg"],
    ["bri04", "brit", "Bourbon", "Britannia Bourbon", "₹10 pack", 10, 72, "biscuit", "8901063136915", "off:890/106/313/6915/front_en.3.200.jpg"],
    ["bri05", "brit", "Tiger", "Tiger Glucose", "₹5 pack", 5, 144, "biscuit", "8901063163287", "off:890/106/316/3287/front_en.3.200.jpg"],
    ["bri06", "brit", "50-50", "50-50 Maska Chaska", "₹10 pack", 10, 72, "biscuit", "8901063017481", "off:890/106/301/7481/front_en.4.200.jpg"],
    ["bri07", "brit", "Milk Bikis", "Milk Bikis", "₹10 pack", 10, 72, "biscuit", "8901063012516", "off:890/106/301/2516/front_en.3.200.jpg"],
    ["bri08", "brit", "Treat", "Treat Jim Jam", "₹10 pack", 10, 72, "biscuit", "8901063029217", "off:890/106/302/9217/front_en.14.200.jpg"],
    ["bri09", "brit", "NutriChoice", "NutriChoice Digestive", "250 g", 55, 30, "biscuit", "8901063142022", "off:890/106/314/2022/front_en.4.200.jpg"],
    ["bri10", "brit", "Britannia Cake", "Britannia Fruit Cake", "₹20 pack", 20, 48, "biscuit", "8901063362857", "off:890/106/336/2857/front_en.7.200.jpg"],
    ["bri11", "brit", "Toastea", "Toastea Premium Bake Rusk", "200 g", 40, 30, "biscuit", "8901063325746", "off:890/106/332/5746/front_en.4.200.jpg"],
    ["bri12", "brit", "Britannia Cheese", "Britannia Cheese Slices", "200 g", 140, 20, "cheese", "8901063401457", "off:890/106/340/1457/front_en.4.200.jpg"],

    // Parle Products
    ["par01", "parle", "Parle-G", "Parle-G", "₹5 pack", 5, 144, "biscuit", "8901719100956", "off:890/171/910/0956/front_en.8.200.jpg"],
    ["par02", "parle", "Parle-G", "Parle-G", "₹10 pack", 10, 72, "biscuit", "8901719100956", "off:890/171/910/0956/front_en.8.200.jpg"],
    ["par03", "parle", "Parle-G", "Parle-G Family Pack", "800 g", 100, 12, "biscuit", "8901719100956", "off:890/171/910/0956/front_en.8.200.jpg"],
    ["par04", "parle", "Monaco", "Monaco Classic", "₹10 pack", 10, 72, "biscuit", "8901719121432", "off:890/171/912/1432/front_en.14.200.jpg"],
    ["par05", "parle", "Krackjack", "Krackjack", "₹10 pack", 10, 72, "biscuit", "8901719122187", "off:890/171/912/2187/front_en.3.200.jpg"],
    ["par06", "parle", "Hide & Seek", "Hide & Seek Choco Chip", "₹10 pack", 10, 72, "biscuit", "3948719127465", "off:394/871/912/7465/front_en.3.200.jpg"],
    ["par07", "parle", "20-20", "20-20 Cashew Cookies", "₹10 pack", 10, 72, "biscuit", "8901719131141", "off:890/171/913/1141/front_en.3.200.jpg"],
    ["par08", "parle", "Milano", "Milano Chocolate Chip", "75 g", 40, 48, "biscuit", "8901719125768", "off:890/171/912/5768/front_en.9.200.jpg"],
    ["par09", "parle", "Parle Rusk", "Parle Rusk", "200 g", 40, 30, "biscuit", "8901719128554", "off:890/171/912/8554/front_en.3.200.jpg"],
    ["par10", "parle", "Melody", "Melody Chocolaty (100 pcs)", "bag", 100, 12, "sweets", "8901719127786", "off:890/171/912/7786/front_en.6.200.jpg"],
    ["par12", "parle", "Poppins", "Poppins", "₹5", 5, 240, "sweets", "8901719127144", "off:890/171/912/7144/front_en.3.200.jpg"],

    // Mondelez (Cadbury)
    ["mdz01", "mdlz", "Dairy Milk", "Cadbury Dairy Milk", "₹10", 10, 144, "choco", "7622201443290", "off:762/220/144/3290/front_en.3.200.jpg"],
    ["mdz02", "mdlz", "Dairy Milk", "Cadbury Dairy Milk", "₹20", 20, 96, "choco", "7622201443290", "off:762/220/144/3290/front_en.3.200.jpg"],
    ["mdz03", "mdlz", "Dairy Milk Silk", "Cadbury Dairy Milk Silk", "60 g", 90, 48, "choco", "8901233034300", "off:890/123/303/4300/front_en.6.200.jpg"],
    ["mdz04", "mdlz", "5 Star", "Cadbury 5 Star", "₹10", 10, 144, "choco", "7622201494476", "off:762/220/149/4476/front_en.3.200.jpg"],
    ["mdz05", "mdlz", "5 Star", "Cadbury 5 Star", "₹5", 5, 240, "choco", "7622201494476", "off:762/220/149/4476/front_en.3.200.jpg"],
    ["mdz06", "mdlz", "Perk", "Cadbury Perk", "₹5", 5, 240, "choco", "8901233024042", "off:890/123/302/4042/front_en.3.200.jpg"],
    ["mdz07", "mdlz", "Gems", "Cadbury Gems", "₹10", 10, 144, "choco", "7622201798260", "off:762/220/179/8260/front_en.47.200.jpg"],
    ["mdz08", "mdlz", "Oreo", "Oreo Vanilla Creme", "₹10 pack", 10, 72, "biscuit", "7622210137234", "off:762/221/013/7234/front_en.62.200.jpg"],
    ["mdz09", "mdlz", "Bournvita", "Cadbury Bournvita", "500 g jar", 245, 12, "healthdrink", "7622202026423", "off:762/220/202/6423/front_en.3.200.jpg"],
    ["mdz10", "mdlz", "Bournvita", "Cadbury Bournvita refill", "1 kg", 420, 8, "healthdrink", "7622202026423", "off:762/220/202/6423/front_en.3.200.jpg"],

    // PepsiCo
    ["pep01", "pepsi", "Lay's", "Lay's India's Magic Masala", "₹10 pack", 10, 60, "chips", "8901491502023", "off:890/149/150/2023/front_en.6.200.jpg"],
    ["pep02", "pepsi", "Lay's", "Lay's Classic Salted", "₹20 pack", 20, 40, "chips", "8901491101837", "off:890/149/110/1837/front_en.14.200.jpg"],
    ["pep03", "pepsi", "Kurkure", "Kurkure Masala Munch", "₹10 pack", 10, 60, "namkeen", "5000328314907", "off:500/032/831/4907/front_en.3.200.jpg"],
    ["pep04", "pepsi", "Kurkure", "Kurkure Masala Munch", "₹20 pack", 20, 40, "namkeen", "5000328314907", "off:500/032/831/4907/front_en.3.200.jpg"],
    ["pep05", "pepsi", "Uncle Chipps", "Uncle Chipps Spicy Treat", "₹10 pack", 10, 60, "chips", "8901491435109", "off:890/149/143/5109/front_en.3.200.jpg"],
    ["pep06", "pepsi", "Doritos", "Doritos Nacho Cheese", "₹20 pack", 20, 40, "chips", "6281036008305", "off:628/103/600/8305/front_en.3.200.jpg"],
    ["pep08", "pepsi", "Pepsi", "Pepsi", "250 ml", 20, 24, "softdrink", "87156836", "off:87156836/front_en.9.200.jpg"],
    ["pep09", "pepsi", "Pepsi", "Pepsi", "750 ml", 40, 24, "softdrink", "87156836", "off:87156836/front_en.9.200.jpg"],
    ["pep10", "pepsi", "Pepsi", "Pepsi", "2.25 L", 99, 6, "softdrink", "87156836", "off:87156836/front_en.9.200.jpg"],
    ["pep11", "pepsi", "7UP", "7UP", "750 ml", 40, 24, "softdrink", "0065400000968", "off:006/540/000/0968/front.3.200.jpg"],

    // Coca-Cola
    ["coc01", "coke", "Thums Up", "Thums Up", "250 ml", 20, 24, "softdrink", "8901764042911", "off:890/176/404/2911/front_en.41.200.jpg"],
    ["coc02", "coke", "Thums Up", "Thums Up", "750 ml", 40, 24, "softdrink", "8901764042911", "off:890/176/404/2911/front_en.41.200.jpg"],
    ["coc03", "coke", "Thums Up", "Thums Up", "2 L", 95, 9, "softdrink", "8901764042911", "off:890/176/404/2911/front_en.41.200.jpg"],
    ["coc04", "coke", "Coca-Cola", "Coca-Cola", "750 ml", 40, 24, "softdrink", "57045399", "off:57045399/front_en.9.200.jpg"],
    ["coc05", "coke", "Sprite", "Sprite", "250 ml", 20, 24, "softdrink", "8901764032905", "off:890/176/403/2905/front_en.28.200.jpg"],
    ["coc06", "coke", "Sprite", "Sprite", "750 ml", 40, 24, "softdrink", "8901764032905", "off:890/176/403/2905/front_en.28.200.jpg"],
    ["coc07", "coke", "Fanta", "Fanta Orange", "750 ml", 40, 24, "softdrink", "5000112647815", "off:500/011/264/7815/front_en.17.200.jpg"],
    ["coc08", "coke", "Limca", "Limca", "750 ml", 40, 24, "softdrink", "89000601", "off:89000601/front_en.3.200.jpg"],
    ["coc09", "coke", "Maaza", "Maaza", "250 ml", 20, 30, "juice", "3948764175022", "off:394/876/417/5022/front_en.12.200.jpg"],
    ["coc10", "coke", "Maaza", "Maaza", "600 ml", 40, 24, "juice", "3948764175022", "off:394/876/417/5022/front_en.12.200.jpg"],
    ["coc11", "coke", "Kinley", "Kinley Water", "500 ml", 10, 24, "water", "89000724", "off:89000724/front_en.15.200.jpg"],
    ["coc12", "coke", "Kinley", "Kinley Water", "1 L", 20, 12, "water", "89000724", "off:89000724/front_en.15.200.jpg"],

    // Parle Agro
    ["pag01", "pagro", "Frooti", "Frooti", "₹10 tetra", 10, 40, "juice", "8902579103354", "off:890/257/910/3354/front_en.6.200.jpg"],
    ["pag02", "pagro", "Frooti", "Frooti", "600 ml", 40, 24, "juice", "8902579103354", "off:890/257/910/3354/front_en.6.200.jpg"],
    ["pag03", "pagro", "Appy Fizz", "Appy Fizz", "250 ml", 20, 24, "softdrink", "8902579002039", "off:890/257/900/2039/front_en.3.200.jpg"],
    ["pag04", "pagro", "Smoodh", "Smoodh Chocolate", "₹10", 10, 30, "healthdrink", "8902579002664", "off:890/257/900/2664/front_en.3.200.jpg"],

    // Amul
    ["amu01", "amul", "Amul Butter", "Amul Butter", "100 g", 58, 40, "dairy", "8901262010153", "off:890/126/201/0153/front_en.3.200.jpg"],
    ["amu02", "amul", "Amul Butter", "Amul Butter", "500 g", 275, 20, "dairy", "8901262010153", "off:890/126/201/0153/front_en.3.200.jpg"],
    ["amu03", "amul", "Amul Ghee", "Amul Pure Ghee", "1 L", 610, 12, "dairy", "0656846560460", "off:065/684/656/0460/front_en.3.200.jpg"],
    ["amu04", "amul", "Amul Ghee", "Amul Pure Ghee", "500 ml", 305, 20, "dairy", "0656846560460", "off:065/684/656/0460/front_en.3.200.jpg"],
    ["amu05", "amul", "Amul Cheese", "Amul Cheese Slices", "200 g", 140, 20, "cheese", "2000000136641", "off:200/000/013/6641/front_en.4.200.jpg"],
    ["amu06", "amul", "Amul Taaza", "Amul Taaza Toned Milk (UHT)", "1 L", 75, 12, "milk", "8901262260121", "off:890/126/226/0121/front_en.28.200.jpg"],
    ["amu07", "amul", "Amul Masti", "Amul Masti Buttermilk", "200 ml", 15, 30, "milk", "8901262200233", "off:890/126/220/0233/front_en.3.200.jpg"],
    ["amu08", "amul", "Amul Kool", "Amul Kool Kesar", "180 ml", 25, 30, "healthdrink", "8901262152211", "off:890/126/215/2211/front_en.6.200.jpg"],
    ["amu09", "amul", "Amul Chocolate", "Amul Dark Chocolate", "150 g", 120, 24, "choco", "8901262070454", "off:890/126/207/0454/front_en.4.200.jpg"],

    // Tata Consumer
    ["tat01", "tata", "Tata Salt", "Tata Salt", "1 kg", 28, 25, "salt", "8904043901015", "off:890/404/390/1015/front_en.34.200.jpg"],
    ["tat02", "tata", "Tata Salt", "Tata Salt Lite", "1 kg", 45, 25, "salt", "8904043901077", "off:890/404/390/1077/front_en.9.200.jpg"],
    ["tat03", "tata", "Tata Tea", "Tata Tea Premium", "250 g", 140, 40, "tea", "8901052000722", "off:890/105/200/0722/front_en.3.200.jpg"],
    ["tat04", "tata", "Tata Tea", "Tata Tea Premium", "₹10 pack", 10, 200, "tea", "8901052000722", "off:890/105/200/0722/front_en.3.200.jpg"],
    ["tat05", "tata", "Tata Tea", "Tata Tea Gold", "250 g", 180, 40, "tea", "8901052003723", "off:890/105/200/3723/front_en.3.200.jpg"],
    ["tat06", "tata", "Tata Tea", "Tata Tea Agni", "250 g", 90, 40, "tea", "8901052003839", "off:890/105/200/3839/front_en.5.200.jpg"],
    ["tat07", "tata", "Tetley", "Tetley Green Tea", "25 bags", 150, 24, "tea", "8901052087808", "off:890/105/208/7808/front_en.4.200.jpg"],
    ["tat08", "tata", "Tata Sampann", "Tata Sampann Chana Dal", "500 g", 75, 20, "dal", "8904043926629", "off:890/404/392/6629/front_en.5.200.jpg"],
    ["tat09", "tata", "Tata Sampann", "Tata Sampann Besan", "500 g", 70, 20, "atta", "8904043926728", "off:890/404/392/6728/front_en.3.200.jpg"],
    ["tat10", "tata", "Ching's", "Ching's Schezwan Chutney", "250 g", 95, 24, "sauce", "8901595862962", "off:890/159/586/2962/front_en.24.200.jpg"],
    ["tat11", "tata", "Ching's", "Ching's Hakka Noodles", "150 g", 40, 48, "noodles", "8901595972258", "off:890/159/597/2258/front_en.3.200.jpg"],

    // Dabur
    ["dab01", "dabur", "Dabur Red", "Dabur Red Paste", "150 g", 110, 48, "toothpaste", "8901207027383", "off:890/120/702/7383/front_en.4.200.jpg"],
    ["dab03", "dabur", "Dabur Amla", "Dabur Amla Hair Oil", "275 ml", 135, 24, "hairoil", "8901207038389", "off:890/120/703/8389/front_en.3.200.jpg"],
    ["dab04", "dabur", "Vatika", "Vatika Shampoo", "180 ml", 145, 24, "shampoo", "6291069208221", "off:629/106/920/8221/front_en.3.200.jpg"],
    ["dab05", "dabur", "Dabur Honey", "Dabur Honey", "500 g", 225, 24, "jam", "8901207047473", "off:890/120/704/7473/front_en.5.200.jpg"],
    ["dab06", "dabur", "Real", "Real Fruit Power Mixed Fruit", "1 L", 125, 12, "juice", "8901207043185", "off:890/120/704/3185/front_en.3.200.jpg"],
    ["dab07", "dabur", "Chyawanprash", "Dabur Chyawanprash", "500 g", 225, 24, "healthdrink", "8901207006241", "off:890/120/700/6241/front_en.5.200.jpg"],
    ["dab08", "dabur", "Hajmola", "Hajmola Regular", "120 tablets", 65, 48, "sweets", "89004869", "off:89004869/front_en.4.200.jpg"],
    ["dab09", "dabur", "Odomos", "Odomos Cream", "50 g", 85, 48, "repellent", "8901207500053", "off:890/120/750/0053/front_en.3.200.jpg"],

    // Marico
    ["mar01", "marico", "Parachute", "Parachute Coconut Oil", "100 ml", 55, 72, "hairoil", "0856408005013", "off:085/640/800/5013/front_en.3.200.jpg"],
    ["mar02", "marico", "Parachute", "Parachute Coconut Oil", "200 ml", 105, 36, "hairoil", "0856408005013", "off:085/640/800/5013/front_en.3.200.jpg"],
    ["mar04", "marico", "Livon", "Livon Hair Serum", "50 ml", 170, 48, "hairoil", "8901088200073", "off:890/108/820/0073/front_en.3.200.jpg"],
    ["mar05", "marico", "Saffola", "Saffola Gold Oil", "1 L", 205, 12, "oil", "8901088017411", "off:890/108/801/7411/front_en.3.200.jpg"],
    ["mar06", "marico", "Saffola", "Saffola Masala Oats", "₹15 pack", 15, 72, "cereal", "8901088194839", "off:890/108/819/4839/front_en.3.200.jpg"],
    ["mar07", "marico", "Saffola", "Saffola Oats", "1 kg", 190, 12, "cereal", "8901088050562", "off:890/108/805/0562/front_en.3.200.jpg"],

    // AWL Agri (Fortune)
    ["awl01", "awl", "Fortune", "Fortune Sunlite Sunflower Oil", "1 L pouch", 155, 10, "oil", "8906007280280", "off:890/600/728/0280/front_en.3.200.jpg"],
    ["awl02", "awl", "Fortune", "Fortune Kachi Ghani Mustard Oil", "1 L", 170, 12, "oil", "8906007280952", "off:890/600/728/0952/front_en.4.200.jpg"],
    ["awl03", "awl", "Fortune", "Fortune Soya Health Oil", "1 L pouch", 140, 10, "oil", "8906007280037", "off:890/600/728/0037/front_en.3.200.jpg"],
    ["awl04", "awl", "Fortune", "Fortune Chakki Fresh Atta", "5 kg", 255, 4, "atta", "0892786120030", "off:089/278/612/0030/front_en.3.200.jpg"],
    ["awl05", "awl", "Fortune", "Fortune Rozana Basmati Rice", "5 kg", 450, 4, "atta", "8906007287883", "off:890/600/728/7883/front_en.4.200.jpg"],

    // Patanjali
    ["pat02", "patanjali", "Kesh Kanti", "Kesh Kanti Shampoo", "200 ml", 100, 24, "shampoo", "8904100018816", "off:890/410/001/8816/front_en.14.200.jpg"],
    ["pat03", "patanjali", "Patanjali", "Patanjali Cow Ghee", "1 L", 650, 12, "dairy", "8904109490545", "off:890/410/949/0545/front_en.4.200.jpg"],
    ["pat04", "patanjali", "Patanjali", "Patanjali Honey", "500 g", 180, 24, "jam", "8904109401589", "off:890/410/940/1589/front_en.3.200.jpg"],

    // Haldiram's
    ["hal01", "haldiram", "Haldiram's", "Haldiram's Aloo Bhujia", "₹10 pack", 10, 60, "namkeen", "8904063214331", "off:890/406/321/4331/front_en.3.200.jpg"],
    ["hal02", "haldiram", "Haldiram's", "Haldiram's Aloo Bhujia", "200 g", 55, 30, "namkeen", "8904063214331", "off:890/406/321/4331/front_en.3.200.jpg"],
    ["hal03", "haldiram", "Haldiram's", "Haldiram's Moong Dal", "200 g", 55, 30, "namkeen", "8904063200136", "off:890/406/320/0136/front_en.27.200.jpg"],
    ["hal04", "haldiram", "Haldiram's", "Haldiram's Navrattan", "200 g", 55, 30, "namkeen", "8904063230126", "off:890/406/323/0126/front_en.3.200.jpg"],
    ["hal05", "haldiram", "Haldiram's", "Haldiram's Khatta Meetha", "₹10 pack", 10, 60, "namkeen", "8904063200952", "off:890/406/320/0952/front_en.3.200.jpg"],
    ["hal06", "haldiram", "Haldiram's", "Haldiram's Soan Papdi", "250 g", 85, 24, "sweets", "8904004405316", "off:890/400/440/5316/front_en.19.200.jpg"],
    ["hal07", "haldiram", "Haldiram's", "Haldiram's Rasgulla tin", "1 kg", 190, 12, "sweets", "8904004405729", "off:890/400/440/5729/front_en.7.200.jpg"],

    // Bikaji
    ["bik01", "bikaji", "Bikaji", "Bikaji Bikaneri Bhujia", "₹10 pack", 10, 60, "namkeen", "8906005500090", "off:890/600/550/0090/front_en.4.200.jpg"],
    ["bik02", "bikaji", "Bikaji", "Bikaji Bikaneri Bhujia", "200 g", 55, 30, "namkeen", "8906005500090", "off:890/600/550/0090/front_en.4.200.jpg"],
    ["bik04", "bikaji", "Bikaji", "Bikaji Rasgulla tin", "1 kg", 180, 12, "sweets", "8906005502063", "off:890/600/550/2063/front_en.3.200.jpg"],

    // Balaji Wafers
    ["bal03", "balaji", "Balaji", "Balaji Chataka Pataka", "₹10 pack", 10, 60, "namkeen", "8906010505424", "off:890/601/050/5424/front_en.3.200.jpg"],

    // Colgate-Palmolive
    ["col03", "colgate", "Colgate", "Colgate MaxFresh", "150 g", 105, 48, "toothpaste", "8901314543653", "off:890/131/454/3653/front_en.6.200.jpg"],

    // Procter & Gamble
    ["png01", "pg", "Tide", "Tide Detergent Bar", "250 g", 25, 40, "detergent", "4987176099921", "opf:498/717/609/9921/front_en.3.200.jpg"],
    ["png03", "pg", "Head & Shoulders", "Head & Shoulders Anti-Dandruff", "180 ml", 200, 24, "shampoo", "4987176073099", "off:498/717/607/3099/front_en.3.200.jpg"],
    ["png06", "pg", "Vicks", "Vicks VapoRub", "10 ml", 50, 96, "ohc", "4987176244987", "off:498/717/624/4987/front_en.3.200.jpg"],

    // Reckitt
    ["rkt01", "reckitt", "Dettol", "Dettol Antiseptic Liquid", "125 ml", 80, 48, "ohc", "8901396350200", "off:890/139/635/0200/front_en.3.200.jpg"],
    ["rkt02", "reckitt", "Dettol", "Dettol Original Soap", "75 g", 38, 72, "soap", "50158980", "off:50158980/front_en.3.200.jpg"],
    ["rkt03", "reckitt", "Harpic", "Harpic Power Plus", "500 ml", 99, 24, "cleaner", "8901396152002", "off:890/139/615/2002/front_en.3.200.jpg"],
    ["rkt04", "reckitt", "Harpic", "Harpic Power Plus", "1 L", 190, 12, "cleaner", "8901396152002", "off:890/139/615/2002/front_en.3.200.jpg"],

    // Godrej Consumer
    ["god01", "godrej", "Godrej No.1", "Godrej No.1 Sandal & Turmeric", "100 g", 28, 72, "soap", "8901023028670", "off:890/102/302/8670/front_en.3.200.jpg"],
    ["god02", "godrej", "Cinthol", "Cinthol Original", "100 g", 42, 72, "soap", "8901023020353", "off:890/102/302/0353/front_en.3.200.jpg"],
    ["god03", "godrej", "Good Knight", "Good Knight Gold Flash Refill", "45 ml", 85, 48, "repellent", "8901023022968", "off:890/102/302/2968/front_en.3.200.jpg"],

    // Wipro Consumer
    ["wip01", "wipro", "Santoor", "Santoor Sandal & Turmeric", "100 g", 34, 72, "soap", "8901399005305", "off:890/139/900/5305/front_en.4.200.jpg"],
    ["wip02", "wipro", "Santoor", "Santoor Soap", "₹10 bar", 10, 144, "soap", "8901399049101", "off:890/139/904/9101/front_en.3.200.jpg"],
    ["wip03", "wipro", "Chandrika", "Chandrika Ayurvedic Soap", "75 g", 32, 72, "soap", "8901370000015", "off:890/137/000/0015/front_en.5.200.jpg"],

    // Jyothy Labs
    ["jyo01", "jyothy", "Ujala", "Ujala Supreme Liquid Whitener", "75 ml", 30, 96, "detergent", "8902102194910", "off:890/210/219/4910/front_en.3.200.jpg"],

    // Emami
    ["ema03", "emami", "Zandu", "Zandu Balm", "8 ml", 40, 144, "ohc", "8901248701488", "off:890/124/870/1488/front_en.3.200.jpg"],

    // MDH
    ["mdh01", "mdh", "MDH", "MDH Deggi Mirch", "100 g", 90, 48, "spice", "8902167000034", "off:890/216/700/0034/front_en.3.200.jpg"],
    ["mdh02", "mdh", "MDH", "MDH Kitchen King", "100 g", 88, 48, "spice", "8902167000102", "off:890/216/700/0102/front_en.17.200.jpg"],
    ["mdh04", "mdh", "MDH", "MDH Garam Masala", "100 g", 90, 48, "spice", "6291103750167", "off:629/110/375/0167/front_en.5.200.jpg"],

    // Everest
    ["eve01", "everest", "Everest", "Everest Tikhalal Chilli Powder", "100 g", 55, 48, "spice", "8901786392018", "off:890/178/639/2018/front_en.4.200.jpg"],
    ["eve02", "everest", "Everest", "Everest Kitchen King", "100 g", 85, 48, "spice", "8901786121007", "off:890/178/612/1007/front_en.3.200.jpg"],
    ["eve04", "everest", "Everest", "Everest Pav Bhaji Masala", "100 g", 80, 48, "spice", "8901786070503", "off:890/178/607/0503/front_en.5.200.jpg"],
    ["eve05", "everest", "Everest", "Everest Garam Masala", "100 g", 85, 48, "spice", "8901786101009", "off:890/178/610/1009/front_en.3.200.jpg"],

    // Bisleri
    ["bis01", "bisleri", "Bisleri", "Bisleri Water", "500 ml", 10, 24, "water", "8906017290026", "off:890/601/729/0026/front_en.23.200.jpg"],
    ["bis02", "bisleri", "Bisleri", "Bisleri Water", "1 L", 20, 12, "water", "8906017290026", "off:890/601/729/0026/front_en.23.200.jpg"],
    ["bis03", "bisleri", "Bisleri", "Bisleri Water", "2 L", 30, 9, "water", "8906017290026", "off:890/601/729/0026/front_en.23.200.jpg"],

    // Himalaya
    ["him01", "himalaya", "Himalaya", "Himalaya Purifying Neem Face Wash", "100 ml", 170, 48, "skincare", "8901138851248", "off:890/113/885/1248/front_en.3.200.jpg"],

    // Mother Dairy
    ["mdy01", "mdairy", "Dhara", "Dhara Kachi Ghani Mustard Oil", "1 L", 165, 12, "oil", "8906004620256", "off:890/600/462/0256/front_en.3.200.jpg"],
    ["mdy02", "mdairy", "Mother Dairy", "Mother Dairy Cow Ghee", "1 L", 600, 12, "dairy", "8901648031147", "off:890/164/803/1147/front_en.4.200.jpg"],

    // Kellogg's
    ["kel01", "kelloggs", "Kellogg's", "Kellogg's Corn Flakes", "475 g", 185, 16, "cereal", "6154000101022", "off:615/400/010/1022/front_en.10.200.jpg"],
    ["kel02", "kelloggs", "Kellogg's", "Kellogg's Chocos", "375 g", 190, 16, "cereal", "8901499006936", "off:890/149/900/6936/front_en.6.200.jpg"],
    ["kel03", "kelloggs", "Kellogg's", "Kellogg's Chocos", "₹10 pack", 10, 60, "cereal", "8901499006936", "off:890/149/900/6936/front_en.6.200.jpg"],

    // Shree Renuka (Madhur)
    ["ren01", "renuka", "Madhur", "Madhur Pure Sugar", "1 kg", 55, 25, "sugar", "8906026900046", "off:890/602/690/0046/front_en.3.200.jpg"],
    ["ren02", "renuka", "Madhur", "Madhur Pure Sugar", "5 kg", 270, 4, "sugar", "8906026900046", "off:890/602/690/0046/front_en.3.200.jpg"],
  ];

  const items = rows.map(function (r) {
    const p = r[9].split(":");
    return { id: r[0], company: r[1], brand: r[2], name: r[3], pack: r[4], mrp: r[5], caseQty: r[6], cat: r[7], barcode: r[8], img: PHOTO[p[0]] + p.slice(1).join(":") };
  });

  const catalogue = {
    version: "2026-09-26c",
    note: "MRPs are indicative (check on pack). GST by category under the GST 2.0 slabs from 22 Sep 2025; confirm with your accountant.",
    credit: "Product photos: Open Food Facts, Open Beauty Facts, Open Products Facts contributors (CC BY-SA)",
    categories: categories,
    companies: companies,
    items: items,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = catalogue;
  else root.SB_CATALOGUE = catalogue;
})(typeof window !== "undefined" ? window : globalThis);
