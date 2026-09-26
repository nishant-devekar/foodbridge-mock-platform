/* Store Builder · words on screen, Hindi and English.
   Plain words a shopkeeper uses: "shop", "goods", "credit (udhaar)".
   Never: SKU, catalogue, GSTIN, entity, sync. Every key exists in both.
   A third language is one more block below with the same keys. */

(function (root) {
  "use strict";

  const en = {
    appName: "Store Builder",
    next: "Next", back: "Back", done: "Done", save: "Save", cancel: "Cancel", yes: "Yes", no: "No",
    add: "Add", remove: "Remove", change: "Change", more: "More", home: "Home", search: "Search",
    stepOf: "Step {n} of {total}", added: "Added", listen: "Listen", papers: "Photo / voice",
    chooseLang: "Choose your language",

    wTitle: "Let's make your FoodBridge store",
    wSub: "Just tap and choose. About 30 minutes. Everything saves by itself.",
    wStart: "Start", wHaveFile: "I have a setup file",

    hTitle: "Your store", hProgress: "{n} of {total} done", hContinue: "Continue", hGoSend: "Send the file",
    menuOpen: "Open a setup file", menuFresh: "Start again (delete all)", menuLang: "हिंदी में देखें",

    title_store: "Your shop", q_store: "Tell us about your shop.",
    title_companies: "Companies", q_companies: "Which companies' goods do you sell? Tap them.",
    title_rates: "Your rates", q_rates: "On goods of 100 rupees MRP, what do you pay, and what do you sell to shops for?",
    title_items: "Products", q_items: "Tap the products you sell.",
    title_people: "Phone contacts", q_people: "Add your shops, suppliers and staff from your phone.",
    title_shops: "Shops", q_shops: "Which day do you deliver to each shop? Tap the star for big shops.",
    title_staff: "Staff", q_staff: "Who works with you? Tap their job.",
    title_suppliers: "Suppliers", q_suppliers: "Who gives you the goods? Tap their companies.",
    title_usual: "Usual orders", q_usual: "What do your big shops usually take?",
    title_stock: "Godown stock", q_stock: "How much stock do you have now? Count the main products.",
    title_rules: "How you work", q_rules: "A few questions about how you work.",
    title_finish: "Send", q_finish: "All done. Save the file and send it to FoodBridge.",

    sNone: "Not started", sSkipped: "Later", sCompanies: "{n} companies", sItems: "{n} products", sPeople: "{n} sorted",
    sShops: "{n} shops", sStaff: "{n} staff", sSup: "{n} suppliers", sUsual: "{n} shops", sStock: "{n} counted", sRules: "{n} of 8 answered",
    /* English singulars: t() uses key_1 when n is 1. Hindi needs none here. */
    sCompanies_1: "1 company", sItems_1: "1 product", sShops_1: "1 shop", sSup_1: "1 supplier", sUsual_1: "1 shop",
    uItems_1: "1 product · {amt}", pAdded_1: "1 added", pDup_1: "1 was already added", pLeft_1: "1 left",

    fShopName: "Shop name (what shops call you)", fOwner: "Your name", fMobile: "Your mobile number",
    fMobileHint: "You will log in with this number", fGst: "GST number", fGstHint: "15 letters and numbers, printed on your bill",
    fGstOk: "Looks correct", fGstBad: "Please check, 15 letters needed",
    fType: "What is your business?", tDistributor: "Distributor", tSuperstockist: "Super stockist", tWholesaler: "Wholesaler",
    tCnf: "C&F agent", tRetailer: "Retailer",
    fMakes: "Do you make or pack anything yourself?",
    fLoc: "Shop location", fLocBtn: "Use my location", fLocSaved: "Location saved", fLocWait: "Finding location…",
    fLocFail: "Could not get location. Turn on GPS and try again.", fAddress: "Shop address",
    fGodown: "Your godown", gSame: "Same place as shop", gOther: "Different place", fGodownAddr: "Godown address",
    fAreas: "Areas you supply to", fAreaPh: "Area name, e.g. Kurla", fShopPhoto: "Photo of your shop", takePhoto: "Take photo",

    cSearch: "Search company or brand", cNotHere: "My company is not here", cSelected: "{n} chosen",
    cNewName: "Company name", cAdd: "Add company",

    rOn100: "On goods of ₹100 MRP", rYouBuy: "You buy at", rYouSell: "You sell to shops at",
    rYouEarn: "You earn ₹{n}", rShopEarns: "Shop earns ₹{n}", rNone: "First choose companies.", rGoCompanies: "Choose companies",
    rHint: "Same for all products of this company. You can change one product later.",

    iAll: "All", iSearch: "Search product", iScan: "Scan", iNew: "New product", iAddAll: "Add all {n}",
    iMrp: "MRP", iShopPrice: "Shop price", iCaseOf: "Case of {n}", iChosen: "{n} chosen",
    iNoCompanies: "Choose companies first to see their products.", iEmpty: "Nothing found. Add it as a new product.",
    isMrp: "MRP (printed on pack)", isSell: "Your price to shop, 1 piece", isBuy: "Your buying price, 1 piece",
    isUnit: "You sell by", uPiece: "Piece", uCase: "Case", isCaseQty: "Pieces in one case",
    isSpeed: "How fast does it sell?", spFast: "Fast", spMed: "Normal", spSlow: "Slow",
    isGst: "GST %", isBarcode: "Barcode number", isRemove: "Remove this product",
    isName: "Product name", isPack: "Pack size, e.g. 500 g", isCompany: "Company", isCategory: "Type of product",
    isPhoto: "Photo of pack", isCheckMrp: "Check MRP on the pack", isCaseTotal: "1 case = ₹{n}",
    otherCompany: "Other",

    scTitle: "Show the barcode to the camera", scNotSupported: "Scanning does not work on this phone. Search by name instead.",
    scFound: "Found: {name}", scNew: "New barcode. Add the product.", scNoCamera: "Camera did not open. Allow camera and try again.",

    pPick: "Pick from phone contacts", pFile: "Open contacts file", pType: "Type name and number",
    pWho: "Who is this?", pShop: "Shop", pSupplier: "Supplier", pStaff: "Staff", pSkip: "Not needed",
    pLeft: "{n} left", pUndo: "Undo", pAdded: "{n} added", pDup: "{n} were already added",
    pNoPicker: "This phone cannot open contacts here. Type them, or open a contacts file.",
    pSkippedList: "Not needed", pName: "Name", pPhone: "Mobile number", pSaveNext: "Save and add another", pIsA: "This is a",
    pAllSorted: "All sorted. Add more, or press Next.",

    shAdd: "Add a shop", shEmpty: "No shops yet. Add them from phone contacts or type them.",
    shArea: "Area", shAreaAdd: "New area", shPay: "Payment", payCash: "Cash", payDays: "{n} days credit",
    shRate: "Rate list", rtNormal: "Normal", rtWholesale: "Wholesale", rtSpecial: "Special",
    shHow: "How do they order?", howSalesman: "Salesman visit", howPhone: "Phone call", howWhatsapp: "WhatsApp", howSelf: "By themselves",
    shOwes: "How much do they owe you now? (₹)", shOwesHint: "From memory is fine. We will confirm it.",
    shNote: "Note", shBig: "Big shop", shDays: "Delivery days", shOwesShow: "owes ₹{n}",

    stAdd: "Add staff", stEmpty: "No staff yet.", stNone: "I have no staff",
    roleSalesman: "Salesman", roleDelivery: "Delivery", roleSupervisor: "Supervisor", roleOffice: "Office",
    stDays: "Days they go out", stVehicle: "Vehicle number", stCash: "Collects cash?",

    suAdd: "Add supplier", suEmpty: "No suppliers yet.", suNone: "Add later", suCompanies: "Which companies?",
    suCode: "Your distributor code with them", suGst: "Their GST number", suLead: "Goods come in how many days?",
    suOwe: "How much do you owe them now? (₹)", daysN: "{n} days",

    uTomorrow: "First delivery day ({day}) · orders ready: {n}", uNoShops: "Add shops first.",
    uNoItems: "Choose products first.", uAdd: "Add usual order", uItems: "{n} products · {amt}",
    uStarHint: "Tap the star for big shops, then fill their usual order.", uTotal: "Total", uSearch: "Search your products",

    skCases: "Cases", skLoose: "Loose", skNotCounted: "Not counted", skLater: "Count later", skNoItems: "Choose products first.",

    ruPay: "How do shops pay you?", mCash: "Cash", mUpi: "UPI", mCheque: "Cheque", mCredit: "Credit (udhaar)",
    ruRoutes: "Do you deliver on fixed days by route?", ruSelf: "Should shops order by themselves from their phone?",
    ruPart: "Can shops pay part now and the rest later?", ruReturns: "Damaged or returned goods?",
    retCredit: "Take back, give credit", retReplace: "Replace", retNone: "Don't take back",
    ruSteps: "Order steps", stepsSimple: "Order → Delivered", stepsDispatch: "Order → Sent → Delivered",
    ruBatches: "Do you track expiry dates?", ruMorning: "What do you check first every morning?",
    mnOrders: "Orders", mnMoney: "Money to collect", mnStock: "Stock", mnTrucks: "Trucks", ruVoice: "Anything else? Say it",

    paTitle: "Photos and voice notes", paPhoto: "Take photo of paper", paPhotoHint: "Bills, khata, rate list, route chart",
    paVoice: "Record voice note", paStop: "Stop", paRecording: "Recording… {s}s", paNone: "Nothing yet",
    paDelete: "Delete", paSaved: "Saved", paNoMic: "Microphone did not open. Allow it and try again.",

    tProducts: "Products", tShops: "Shops", tSuppliers: "Suppliers", tStaff: "Staff", tOrders: "First orders", tPapers: "Photos & voice",
    fiMissing: "Still to fill (can be done later)", fiNoMissing: "Nothing missing. Well done!",
    fiSave: "Save file", fiShare: "Send on WhatsApp", fiExcel: "Excel only",
    fiHow: "How to send", fiHow1: "Tap “Save file”", fiHow2: "Open WhatsApp, open the FoodBridge chat",
    fiHow3: "Tap 📎 → Document → choose the FoodBridge file", fiSaved: "File saved: {name}", fiShareFail: "Could not share. Use “Save file”.",
    fiWorking: "Making the file…",

    cfFresh: "Delete everything and start again?", cfFreshYes: "Yes, delete all",
    cfReplace: "Open this file? What is on this phone now will be replaced.", cfOpen: "Open file",
    fileBad: "This is not a FoodBridge setup file.", fileOk: "Setup opened",
    micUnsupported: "Speaking to type does not work on this phone.", listening: "Speak now…",

    gap_noName: "Shop name", gap_noMobile: "Your mobile number", gap_noGst: "GST number", gap_noLocation: "Shop location",
    gap_noItems: "No products chosen", gap_noMrp: "Products without MRP", gap_unsorted: "Contacts not sorted",
    gap_noShops: "No shops added", gap_shopNoDay: "Shops without delivery day", gap_shopNoPhone: "Shops without mobile number",
    gap_shopNoArea: "Shops without area", gap_shopNoPay: "Shops without cash / credit", gap_noDelivery: "No delivery person",
    gap_staffNoRole: "Staff without a job", gap_noSuppliers: "No suppliers", gap_supNoCompany: "Suppliers without company",
    gap_starNoUsual: "Big shops without usual order", gap_noStars: "No big shops marked", gap_notCounted: "Products not counted",
    gap_rulesOpen: "Questions not answered",

    d_mon: "Mon", d_tue: "Tue", d_wed: "Wed", d_thu: "Thu", d_fri: "Fri", d_sat: "Sat", d_sun: "Sun",
  };

  const hi = {
    appName: "स्टोर बिल्डर",
    next: "आगे", back: "पीछे", done: "हो गया", save: "सेव करें", cancel: "रहने दें", yes: "हाँ", no: "नहीं",
    add: "जोड़ें", remove: "हटाएँ", change: "बदलें", more: "और", home: "होम", search: "खोजें",
    stepOf: "{total} में से {n}", added: "जुड़ गया", listen: "सुनें", papers: "फ़ोटो / आवाज़",
    chooseLang: "अपनी भाषा चुनें",

    wTitle: "चलिए आपकी FoodBridge दुकान बनाते हैं",
    wSub: "बस टैप करें और चुनें। लगभग 30 मिनट। सब अपने आप सेव होता है।",
    wStart: "शुरू करें", wHaveFile: "मेरे पास सेटअप फ़ाइल है",

    hTitle: "आपकी दुकान", hProgress: "{total} में से {n} पूरे", hContinue: "आगे बढ़ें", hGoSend: "फ़ाइल भेजें",
    menuOpen: "सेटअप फ़ाइल खोलें", menuFresh: "फिर से शुरू करें (सब मिटाएँ)", menuLang: "View in English",

    title_store: "आपकी दुकान", q_store: "अपनी दुकान के बारे में बताइए।",
    title_companies: "कंपनियाँ", q_companies: "आप किन कंपनियों का माल बेचते हैं? उन पर टैप करें।",
    title_rates: "आपका रेट", q_rates: "सौ रुपये MRP के माल पर, आप कितने में खरीदते हैं, और दुकान को कितने में बेचते हैं?",
    title_items: "सामान", q_items: "जो सामान आप बेचते हैं, उस पर टैप करें।",
    title_people: "फ़ोन के नंबर", q_people: "अपने फ़ोन से दुकानदार, सप्लायर और स्टाफ़ जोड़ें।",
    title_shops: "दुकानें", q_shops: "हर दुकान पर माल किस दिन जाता है? बड़ी दुकान के लिए स्टार दबाएँ।",
    title_staff: "स्टाफ़", q_staff: "आपके साथ कौन काम करता है? उनका काम चुनें।",
    title_suppliers: "सप्लायर", q_suppliers: "आपको माल कौन देता है? उनकी कंपनी चुनें।",
    title_usual: "रोज़ का ऑर्डर", q_usual: "आपकी बड़ी दुकानें आमतौर पर क्या लेती हैं?",
    title_stock: "गोदाम का माल", q_stock: "अभी गोदाम में कितना माल है? मुख्य सामान गिनें।",
    title_rules: "आपका काम", q_rules: "आपके काम के बारे में कुछ सवाल।",
    title_finish: "भेजें", q_finish: "सब हो गया। फ़ाइल सेव करें और FoodBridge को भेजें।",

    sNone: "शुरू नहीं हुआ", sSkipped: "बाद में", sCompanies: "{n} कंपनियाँ", sItems: "{n} सामान", sPeople: "{n} छाँटे",
    sShops: "{n} दुकानें", sStaff: "{n} स्टाफ़", sSup: "{n} सप्लायर", sUsual: "{n} दुकानें", sStock: "{n} गिने", sRules: "8 में से {n} जवाब",

    fShopName: "दुकान का नाम (जिस नाम से लोग जानते हैं)", fOwner: "आपका नाम", fMobile: "आपका मोबाइल नंबर",
    fMobileHint: "इसी नंबर से आप लॉगिन करेंगे", fGst: "GST नंबर", fGstHint: "15 अक्षर और अंक, आपके बिल पर छपा होता है",
    fGstOk: "सही लग रहा है", fGstBad: "कृपया जाँचें, 15 अक्षर चाहिए",
    fType: "आपका काम क्या है?", tDistributor: "डिस्ट्रीब्यूटर", tSuperstockist: "सुपर स्टॉकिस्ट", tWholesaler: "होलसेलर",
    tCnf: "C&F एजेंट", tRetailer: "रिटेलर",
    fMakes: "क्या आप ख़ुद कुछ बनाते या पैक करते हैं?",
    fLoc: "दुकान की जगह", fLocBtn: "मेरी लोकेशन लें", fLocSaved: "लोकेशन सेव हो गई", fLocWait: "लोकेशन ढूँढ रहे हैं…",
    fLocFail: "लोकेशन नहीं मिली। GPS चालू करके फिर कोशिश करें।", fAddress: "दुकान का पता",
    fGodown: "आपका गोदाम", gSame: "दुकान वाली जगह", gOther: "दूसरी जगह", fGodownAddr: "गोदाम का पता",
    fAreas: "किन इलाकों में माल देते हैं", fAreaPh: "इलाके का नाम, जैसे कुर्ला", fShopPhoto: "दुकान की फ़ोटो", takePhoto: "फ़ोटो लें",

    cSearch: "कंपनी या ब्रांड खोजें", cNotHere: "मेरी कंपनी यहाँ नहीं है", cSelected: "{n} चुनी",
    cNewName: "कंपनी का नाम", cAdd: "कंपनी जोड़ें",

    rOn100: "₹100 MRP के माल पर", rYouBuy: "आप खरीदते हैं", rYouSell: "दुकान को बेचते हैं",
    rYouEarn: "आपकी कमाई ₹{n}", rShopEarns: "दुकान की कमाई ₹{n}", rNone: "पहले कंपनी चुनें।", rGoCompanies: "कंपनी चुनें",
    rHint: "इस कंपनी के सब सामान पर यही रेट। किसी एक सामान का रेट बाद में बदल सकते हैं।",

    iAll: "सब", iSearch: "सामान खोजें", iScan: "स्कैन", iNew: "नया सामान", iAddAll: "सब {n} जोड़ें",
    iMrp: "MRP", iShopPrice: "दुकान का रेट", iCaseOf: "पेटी में {n}", iChosen: "{n} चुने",
    iNoCompanies: "सामान देखने के लिए पहले कंपनी चुनें।", iEmpty: "कुछ नहीं मिला। नया सामान जोड़ें।",
    isMrp: "MRP (पैकेट पर छपा)", isSell: "दुकान को आपका रेट, 1 पीस", isBuy: "आपका खरीद रेट, 1 पीस",
    isUnit: "आप बेचते हैं", uPiece: "पीस", uCase: "पेटी", isCaseQty: "एक पेटी में कितने पीस",
    isSpeed: "कितनी जल्दी बिकता है?", spFast: "जल्दी", spMed: "ठीक-ठाक", spSlow: "धीरे",
    isGst: "GST %", isBarcode: "बारकोड नंबर", isRemove: "यह सामान हटाएँ",
    isName: "सामान का नाम", isPack: "पैक साइज़, जैसे 500 ग्राम", isCompany: "कंपनी", isCategory: "सामान का प्रकार",
    isPhoto: "पैकेट की फ़ोटो", isCheckMrp: "पैकेट पर MRP देख लें", isCaseTotal: "1 पेटी = ₹{n}",
    otherCompany: "दूसरी",

    scTitle: "बारकोड कैमरे के सामने रखें", scNotSupported: "इस फ़ोन पर स्कैन नहीं होता। नाम से खोजें।",
    scFound: "मिल गया: {name}", scNew: "नया बारकोड। सामान जोड़ें।", scNoCamera: "कैमरा नहीं खुला। कैमरा की इजाज़त देकर फिर कोशिश करें।",

    pPick: "फ़ोन के नंबरों से चुनें", pFile: "कॉन्टैक्ट फ़ाइल खोलें", pType: "नाम और नंबर लिखें",
    pWho: "यह कौन है?", pShop: "दुकानदार", pSupplier: "सप्लायर", pStaff: "स्टाफ़", pSkip: "ज़रूरत नहीं",
    pLeft: "{n} बाकी", pUndo: "वापस", pAdded: "{n} जुड़े", pDup: "{n} पहले से जुड़े थे",
    pNoPicker: "इस फ़ोन पर यहाँ से नंबर नहीं खुलते। नाम लिखें, या कॉन्टैक्ट फ़ाइल खोलें।",
    pSkippedList: "ज़रूरत नहीं", pName: "नाम", pPhone: "मोबाइल नंबर", pSaveNext: "सेव करें और अगला जोड़ें", pIsA: "यह है",
    pAllSorted: "सब छँट गए। और जोड़ें, या आगे दबाएँ।",

    shAdd: "दुकान जोड़ें", shEmpty: "अभी कोई दुकान नहीं। फ़ोन के नंबरों से जोड़ें या लिखें।",
    shArea: "इलाका", shAreaAdd: "नया इलाका", shPay: "पेमेंट", payCash: "नकद", payDays: "{n} दिन उधार",
    shRate: "रेट लिस्ट", rtNormal: "सामान्य", rtWholesale: "होलसेल", rtSpecial: "ख़ास",
    shHow: "ऑर्डर कैसे देते हैं?", howSalesman: "सेल्समैन जाता है", howPhone: "फ़ोन पर", howWhatsapp: "WhatsApp पर", howSelf: "ख़ुद से",
    shOwes: "अभी आपके कितने पैसे बाकी हैं? (₹)", shOwesHint: "याद से बताइए। हम बाद में पक्का कर लेंगे।",
    shNote: "नोट", shBig: "बड़ी दुकान", shDays: "माल जाने के दिन", shOwesShow: "₹{n} बाकी",

    stAdd: "स्टाफ़ जोड़ें", stEmpty: "अभी कोई स्टाफ़ नहीं।", stNone: "मेरे पास स्टाफ़ नहीं है",
    roleSalesman: "सेल्समैन", roleDelivery: "डिलीवरी", roleSupervisor: "सुपरवाइज़र", roleOffice: "ऑफ़िस",
    stDays: "किन दिनों बाहर जाते हैं", stVehicle: "गाड़ी नंबर", stCash: "पैसे लेते हैं?",

    suAdd: "सप्लायर जोड़ें", suEmpty: "अभी कोई सप्लायर नहीं।", suNone: "बाद में जोड़ेंगे", suCompanies: "कौन सी कंपनियाँ?",
    suCode: "उनके पास आपका डिस्ट्रीब्यूटर कोड", suGst: "उनका GST नंबर", suLead: "माल कितने दिन में आता है?",
    suOwe: "अभी आपको उन्हें कितना देना है? (₹)", daysN: "{n} दिन",

    uTomorrow: "पहली डिलीवरी ({day}) · तैयार ऑर्डर: {n}", uNoShops: "पहले दुकानें जोड़ें।",
    uNoItems: "पहले सामान चुनें।", uAdd: "रोज़ का ऑर्डर भरें", uItems: "{n} सामान · {amt}",
    uStarHint: "बड़ी दुकानों पर स्टार दबाएँ, फिर उनका रोज़ का ऑर्डर भरें।", uTotal: "कुल", uSearch: "अपना सामान खोजें",

    skCases: "पेटी", skLoose: "खुले पीस", skNotCounted: "गिना नहीं", skLater: "बाद में गिनेंगे", skNoItems: "पहले सामान चुनें।",

    ruPay: "दुकानें पैसे कैसे देती हैं?", mCash: "नकद", mUpi: "UPI", mCheque: "चेक", mCredit: "उधार",
    ruRoutes: "क्या माल तय दिनों पर रूट से जाता है?", ruSelf: "क्या दुकानें अपने फ़ोन से ख़ुद ऑर्डर करें?",
    ruPart: "क्या दुकान अभी थोड़ा और बाकी बाद में दे सकती है?", ruReturns: "ख़राब या वापस आया माल?",
    retCredit: "वापस लेकर क्रेडिट देते हैं", retReplace: "बदल कर देते हैं", retNone: "वापस नहीं लेते",
    ruSteps: "ऑर्डर के कदम", stepsSimple: "ऑर्डर → पहुँचा", stepsDispatch: "ऑर्डर → भेजा → पहुँचा",
    ruBatches: "क्या आप एक्सपायरी तारीख़ देखते हैं?", ruMorning: "रोज़ सुबह सबसे पहले क्या देखते हैं?",
    mnOrders: "ऑर्डर", mnMoney: "वसूली", mnStock: "माल", mnTrucks: "गाड़ियाँ", ruVoice: "और कुछ? बोल कर बताइए",

    paTitle: "फ़ोटो और आवाज़", paPhoto: "कागज़ की फ़ोटो लें", paPhotoHint: "बिल, खाता, रेट लिस्ट, रूट चार्ट",
    paVoice: "आवाज़ रिकॉर्ड करें", paStop: "रोकें", paRecording: "रिकॉर्ड हो रहा है… {s} सेकंड", paNone: "अभी कुछ नहीं",
    paDelete: "मिटाएँ", paSaved: "सेव हो गया", paNoMic: "माइक नहीं खुला। इजाज़त देकर फिर कोशिश करें।",

    tProducts: "सामान", tShops: "दुकानें", tSuppliers: "सप्लायर", tStaff: "स्टाफ़", tOrders: "पहले ऑर्डर", tPapers: "फ़ोटो / आवाज़",
    fiMissing: "अभी बाकी है (बाद में भी भर सकते हैं)", fiNoMissing: "कुछ बाकी नहीं। शाबाश!",
    fiSave: "फ़ाइल सेव करें", fiShare: "WhatsApp पर भेजें", fiExcel: "सिर्फ़ Excel",
    fiHow: "कैसे भेजें", fiHow1: "“फ़ाइल सेव करें” दबाएँ", fiHow2: "WhatsApp खोलें, FoodBridge वाली चैट खोलें",
    fiHow3: "📎 दबाएँ → Document → FoodBridge वाली फ़ाइल चुनें", fiSaved: "फ़ाइल सेव हुई: {name}", fiShareFail: "भेज नहीं पाए। “फ़ाइल सेव करें” दबाएँ।",
    fiWorking: "फ़ाइल बन रही है…",

    cfFresh: "सब मिटा कर फिर से शुरू करें?", cfFreshYes: "हाँ, सब मिटाएँ",
    cfReplace: "यह फ़ाइल खोलें? इस फ़ोन पर अभी जो है, वह बदल जाएगा।", cfOpen: "फ़ाइल खोलें",
    fileBad: "यह FoodBridge की सेटअप फ़ाइल नहीं है।", fileOk: "सेटअप खुल गया",
    micUnsupported: "इस फ़ोन पर बोल कर लिखना नहीं चलता।", listening: "अब बोलिए…",

    gap_noName: "दुकान का नाम", gap_noMobile: "आपका मोबाइल नंबर", gap_noGst: "GST नंबर", gap_noLocation: "दुकान की जगह",
    gap_noItems: "कोई सामान नहीं चुना", gap_noMrp: "बिना MRP के सामान", gap_unsorted: "नंबर छाँटने बाकी",
    gap_noShops: "कोई दुकान नहीं", gap_shopNoDay: "दुकानें जिनका दिन नहीं चुना", gap_shopNoPhone: "दुकानें बिना मोबाइल नंबर",
    gap_shopNoArea: "दुकानें बिना इलाका", gap_shopNoPay: "दुकानें बिना नकद / उधार", gap_noDelivery: "कोई डिलीवरी वाला नहीं",
    gap_staffNoRole: "स्टाफ़ बिना काम", gap_noSuppliers: "कोई सप्लायर नहीं", gap_supNoCompany: "सप्लायर बिना कंपनी",
    gap_starNoUsual: "बड़ी दुकानें बिना रोज़ का ऑर्डर", gap_noStars: "कोई बड़ी दुकान नहीं चुनी", gap_notCounted: "सामान गिना नहीं",
    gap_rulesOpen: "सवाल बाकी",

    d_mon: "सोम", d_tue: "मंगल", d_wed: "बुध", d_thu: "गुरु", d_fri: "शुक्र", d_sat: "शनि", d_sun: "रवि",
  };

  const I18N = { en: en, hi: hi };
  if (typeof module !== "undefined" && module.exports) module.exports = I18N;
  else root.SB_I18N = I18N;
})(typeof window !== "undefined" ? window : globalThis);
