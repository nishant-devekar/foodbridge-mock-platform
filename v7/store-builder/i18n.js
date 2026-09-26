/* Store Builder · words on screen, Hindi and English.
   Plain words a shopkeeper uses: "shop", "goods", "credit (udhaar)".
   Never: SKU, catalogue, GSTIN, entity, sync. Every key exists in both.
   A third language is one more block below with the same keys. */

(function (root) {
  "use strict";

  const en = {
    appName: "Store Builder",
    next: "Next", back: "Back", done: "Done", save: "Save", savedStep: "{step} saved", cancel: "Cancel", yes: "Yes", no: "No",
    add: "Add", remove: "Remove", change: "Change", more: "More", home: "Home", search: "Search", menu: "Menu", cfTitle: "Are you sure?",
    stepOf: "Step {n} of {total}", added: "Added", listen: "Listen", papers: "Photo / voice",
    chooseLang: "Choose your language",

    wTitle: "Let's make your FoodBridge store",
    wStart: "Start",

    hTitle: "Your store", hProgress: "{n} of {total} done",
    menuFresh: "Start again (delete all)", menuLang: "हिंदी में देखें",

    title_store: "Your shop", q_store: "Tell us about your shop.",
    title_companies: "Companies", title_rates: "Your rates",   // steps until 26 Sep 2026; old photos still name them
    title_items: "Products", q_items: "Choose by brand or by category, or search. Tap a picture to choose it.",
    title_people: "Contacts", q_people: "Add people from your phone, then tap who each one is: customer, staff or supplier.",
    title_shops: "Customers", q_shops: "Which day do you deliver to each customer? Tap the star for big customers.",
    title_staff: "Staff",
    title_suppliers: "Suppliers",
    title_usual: "Usual orders",
    title_stock: "Godown stock", q_stock: "How much stock do you have now? Count the main products.",
    title_rules: "How you work", q_rules: "A few questions about how you work.",
    title_finish: "Build your store", q_finish: "Check it once, then build your store.",

    sNone: "Not started", sSkipped: "Later", sItems: "{n} products", sPeople: "{n} sorted",
    sShops: "{n} customers", sStaff: "{n} staff", sSup: "{n} suppliers", sStock: "{n} counted", sRules: "{n} of 7 answered",
    /* English singulars: t() uses key_1 when n is 1. Hindi needs none here. */
    sItems_1: "1 product", sShops_1: "1 customer", sSup_1: "1 supplier",
    pAdded_1: "1 added", pDup_1: "1 was already added", pLeft_1: "1 left",

    fShopName: "Shop name", fOwner: "Your name", fMobile: "Mobile number (to log in)",
    fGst: "GST number",
    fType: "What is your business?", tDistributor: "Distributor", tSuperstockist: "Super stockist", tWholesaler: "Wholesaler",
    tCnf: "C&F agent", tRetailer: "Retailer",
    fMakes: "Do you make or pack anything yourself?",
    fLoc: "Shop location", fLocBtn: "Use my location", fLocSaved: "Location saved", fLocSavedS: "Saved", fLocWait: "Finding location…",
    fLocFail: "Could not get location. Turn on GPS and try again.", fAddress: "Shop address",
    fLocDenied: "Allow location for this page, then tap again.", fAddrWait: "Finding the address…",
    fAddrAdded: "Location and address added. Check the address.", fAddrKept: "Location saved. Your address is kept as you wrote it.",
    fAddrNone: "Please type the address.",
    fGodown: "Your godowns", gShop: "At the shop", gN: "Godown {n}", gAdd: "Add a godown", fGodownAddr: "Godown address",
    fAreaPh: "Area name, e.g. Kurla", takePhoto: "Take photo",

    
    cNewName: "Company name", 

    
    
    

    iSearch: "Search: Maggi, atta, potato…", iScan: "Scan", iNew: "New product",
    iByCompany: "By brand", iByType: "By category", iFresh: "Fresh & loose", iPacked: "Packed",
    iCount: "{n} products", iCount_1: "1 product", iMine: "Your products", iMineSub: "See and change prices",
    iNeedPrice: "{n} need a price", iNeedPrice_1: "1 needs a price", iAddPrice: "Add your price",
    iSelectAll: "Select all", iClearAll: "Remove all", iNotFound: "Can't find it? Add a new product",
    iMore: "Showing {n} of {total}. Type more to find it faster.",
    per_kg: "per kg", per_dozen: "per dozen", per_tray30: "per tray of 30", per_bunch: "per bunch", per_piece: "per piece", per_litre: "per litre", per_pack: "per pack",
    u_kg: "kg", u_dozen: "dozen", u_tray30: "trays", u_bunch: "bunches", u_piece: "pieces", u_litre: "litres", u_pack: "packs",
    iShopPrice: "Customer price", iCaseOf: "Box of {n}", iChosen: "{n} chosen",
    iEmpty: "Nothing found. Add it as a new product.",
    isMrp: "MRP (printed on pack)", isSell: "Your price to customer, 1 piece", isBuy: "Your buying price, 1 piece",
    isSellPer: "Your price to customer, {per}", isBuyPer: "Your buying price, {per}", isLooseHint: "Loose goods have no MRP. Tell us your usual price.",
    isKind: "Packed or loose?", kPacked: "Packed (has MRP)", kLoose: "Loose (by kg, dozen…)", isPer: "How is it sold?",
    isUnit: "You sell by", uPiece: "Piece", uCase: "Box", isCaseQty: "Pieces in one box",
    isSpeed: "How fast does it sell?", spFast: "Fast", spMed: "Normal", spSlow: "Slow",
    isGst: "GST %", isBarcode: "Barcode number", isRemove: "Remove this product",
    isName: "Product name", isPack: "Pack size, e.g. 500 g", isCompany: "Company", isCategory: "Type of product",
    isPhoto: "Photo of pack", isCheckMrp: "Check MRP on the pack", isStdPrice: "Worked out at the usual margin. Change it if yours is different.", isCaseTotal: "1 box = ₹{n}",
    otherCompany: "Other",

    scTitle: "Show the barcode to the camera", scNotSupported: "Scanning does not work on this phone. Search by name instead.",
    scFound: "Found: {name}", scNew: "New barcode. Add the product.", scNoCamera: "Camera did not open. Allow camera and try again.",

    pPick: "Add from phone", pType: "Type name and number",
    pWho: "Who is this?", pShop: "Customer", pSupplier: "Supplier", pStaff: "Staff", pSkip: "Not needed",
    pLeft: "{n} left", pUndo: "Undo", pAdded: "{n} added", pDup: "{n} were already added",
    pNoPicker: "This phone's browser does not let a web page open your contacts.", pNoPickerIos: "The iPhone can open your contacts here, once one Safari setting is on.", pIos1: "Open Settings → Apps → Safari → Advanced → Feature Flags.", pIos2: "Turn on “Contact Picker API”.", pIos3: "Come back and tap “Add from phone contacts” again: your contact list opens. Search, tick many, Add.", pIosOld: "Older iPhones: Settings → Safari → Advanced → Experimental Features.", pAnd1: "Open this page in Chrome (the phone's own browser may not allow it).", pAnd2: "Tap “Add from phone contacts”: your contact list opens. Search, tick many, Add.", pOther1: "A computer has no phone contacts. Open this page on the phone: Android in Chrome, iPhone in Safari.", pNoPicker2: "Or tap below and type the names and numbers.",
    pSkippedList: "Not needed", pName: "Name", pPhone: "Mobile number", pSaveNext: "Save and add another", pIsA: "This is a",
    pAllSorted: "All sorted. Add more, or open a tab to fill details.", pTabSort: "To sort", pShopHint: "Tap ★ for big customers, and the days they get goods.", suNoCo: "Tap to choose their companies", pSearch: "Search name or number", pGuess: "Looks like", pRestCustomers: "The rest are customers ({n})", pSortedAll: "{n} added as customers", pToSort: "{n} to sort", pNone: "No one yet. Add from your phone, a contacts file, or type a name.", pTypeShort: "Type", pRemove: "Remove this contact",

    shAdd: "Add a customer", shEmpty: "No customers yet. Add them from phone contacts or type them.",
    shArea: "Area", shAreaAdd: "New area", shPay: "Payment", payCash: "Cash", payDays: "{n} days credit",
    shRate: "Rate list", rtNormal: "Normal", rtWholesale: "Wholesale", rtSpecial: "Special",
    shHow: "How do they order?", howSalesman: "Salesman visit", howPhone: "Phone call", howWhatsapp: "WhatsApp", howSelf: "By themselves",
    shOwes: "How much do they owe you now? (₹)", shOwesHint: "From memory is fine. We will confirm it.",
    shNote: "Note", shBig: "Big customer", shDays: "Delivery days", shOwesShow: "owes ₹{n}",

    stAdd: "Add staff", stEmpty: "No staff yet.", stNone: "I have no staff",
    roleSalesman: "Salesman", roleDelivery: "Delivery", roleSupervisor: "Supervisor", roleOffice: "Office",
    stDays: "Days they go out", stVehicle: "Vehicle number", stCash: "Collects cash?",

    suAdd: "Add supplier", suEmpty: "No suppliers yet.", suNone: "Add later", suCompanies: "Which companies?",
    suCode: "Your distributor code with them", suGst: "Their GST number", suLead: "Goods come in how many days?",
    suOwe: "How much do you owe them now? (₹)", daysN: "{n} days",

   
   
   

    gsSearch: "Search a product to count", gsList: "Your count", gsEmpty: "Search above and add what is in your godown.",
    gsAllMine: "All my products · {n}", gsShowing: "Showing {n} of {total} — keep typing to find the rest", gsNoFound: "No product found",
    gsCounted: "{n} of {total} counted", gsUnit: "Count in", gsPrice: "Your price: {p} per {u}", gsNoPrice: "No price yet. Add it on Products.",
    gsRemove: "Take off the count",

    ruPay: "Customers pay by", mCash: "Cash", mUpi: "UPI", mCheque: "Cheque", mCredit: "Credit (udhaar)",
    ruRoutes: "Fixed route days?", ruSelf: "Customers order on phone?",
    ruPart: "Part now, rest later?", ruReturns: "Damaged goods come back",
    retCredit: "Give credit", retReplace: "Replace", retNone: "Don't take back",
    ruBatches: "Check expiry dates?", ruMorning: "First thing each morning",
    mnOrders: "Orders", mnMoney: "Money to collect", mnStock: "Stock", mnTrucks: "Trucks", ruNote: "Anything else?", ruNotePh: "Type, or tap the mic and speak",

    paTitle: "Photos and voice notes", paPhoto: "Take photo of paper", paPhotoHint: "Bills, khata, rate list, route chart",
    paVoice: "Record voice note", paStop: "Stop", paRecording: "Recording… {s}s", paNone: "Nothing yet",
    paDelete: "Delete", paSaved: "Saved", paNoMic: "Microphone did not open. Allow it and try again.",

    tProducts: "Products", tShops: "Customers", tSuppliers: "Suppliers", tStaff: "Staff", tPapers: "Photos & voice",
    fiNoMissing: "Nothing missing. Well done!", fiLater: "{n} things to fill later", fiLater_1: "1 thing to fill later", fiStock: "Stock counted",
    fiBuild: "Build my store", fiWorking: "Building your store…", fiBuilt: "Your store is built", fiBuiltSub: "You can close the app now. The FoodBridge team will call you soon to set up your store.",
    fiSent: "FoodBridge has your store", fiSentAt: "Sent {d}", fiSending: "Sending to FoodBridge…",
    fiWaiting: "Waiting to send", fiWaitingSub: "{n} of {total} files sent", fiWaitingWhy: "No internet right now. It goes by itself when the phone is online.",
    fiSendNow: "Send now",

    cfFresh: "Delete everything and start again?", cfFreshYes: "Yes, delete all",
   
   
    micUnsupported: "Speaking to type does not work here. Use the mic key on your keyboard.", listening: "Speak now…",
    micSpeak: "Speak to type", micBlocked: "Allow the microphone for this page, then tap the mic again.",
    micNoSpeech: "Did not hear anything. Tap the mic and speak.", micNone: "No microphone found.",
    micNet: "Speaking to type needs internet.", micFail: "Could not start the mic. Tap it again.",

    gap_noName: "Shop name", gap_noMobile: "Your mobile number", gap_noGst: "GST number", gap_noLocation: "Shop location",
    gap_noItems: "No products chosen", gap_noMrp: "Products without MRP", gap_noPrice: "Loose goods without a price", gap_unsorted: "Contacts not sorted",
    gap_noShops: "No customers added", gap_shopNoDay: "Customers without delivery day", gap_shopNoPhone: "Customers without mobile number",
    gap_shopNoArea: "Customers without area", gap_shopNoPay: "Customers without cash / credit", gap_noDelivery: "No delivery person",
    gap_staffNoRole: "Staff without a job", gap_noSuppliers: "No suppliers", gap_supNoCompany: "Suppliers without company",
    gap_notCounted: "Products not counted",
    gap_rulesOpen: "Questions not answered",

    d_mon: "Mon", d_tue: "Tue", d_wed: "Wed", d_thu: "Thu", d_fri: "Fri", d_sat: "Sat", d_sun: "Sun",
  };

  const hi = {
    appName: "स्टोर बिल्डर",
    next: "आगे", back: "पीछे", done: "हो गया", save: "सेव करें", savedStep: "{step} सेव हो गया", cancel: "रहने दें", yes: "हाँ", no: "नहीं",
    add: "जोड़ें", remove: "हटाएँ", change: "बदलें", more: "और", home: "होम", search: "खोजें", menu: "मेन्यू", cfTitle: "क्या आप पक्का हैं?",
    stepOf: "{total} में से {n}", added: "जुड़ गया", listen: "सुनें", papers: "फ़ोटो / आवाज़",
    chooseLang: "अपनी भाषा चुनें",

    wTitle: "चलिए आपकी FoodBridge दुकान बनाते हैं",
    wStart: "शुरू करें",

    hTitle: "आपकी दुकान", hProgress: "{total} में से {n} पूरे",
    menuFresh: "फिर से शुरू करें (सब मिटाएँ)", menuLang: "View in English",

    title_store: "आपकी दुकान", q_store: "अपनी दुकान के बारे में बताइए।",
    title_companies: "कंपनियाँ", title_rates: "आपका रेट",
    title_items: "सामान", q_items: "ब्रांड या कैटेगरी से चुनें, या खोजें। चुनने के लिए फ़ोटो पर टैप करें।",
    title_people: "फ़ोन के नंबर", q_people: "फ़ोन से लोग जोड़ें, फिर हर एक के लिए चुनें: ग्राहक, स्टाफ़ या सप्लायर।",
    title_shops: "ग्राहक", q_shops: "हर ग्राहक को माल किस दिन जाता है? बड़े ग्राहक के लिए स्टार दबाएँ।",
    title_staff: "स्टाफ़",
    title_suppliers: "सप्लायर",
    title_usual: "रोज़ का ऑर्डर",
    title_stock: "गोदाम का माल", q_stock: "अभी गोदाम में कितना माल है? मुख्य सामान गिनें।",
    title_rules: "आपका काम", q_rules: "आपके काम के बारे में कुछ सवाल।",
    title_finish: "दुकान बनाएँ", q_finish: "एक बार देख लें, फिर अपनी दुकान बनाएँ।",

    sNone: "शुरू नहीं हुआ", sSkipped: "बाद में", sItems: "{n} सामान", sPeople: "{n} छाँटे",
    sShops: "{n} ग्राहक", sStaff: "{n} स्टाफ़", sSup: "{n} सप्लायर", sStock: "{n} गिने", sRules: "7 में से {n} जवाब",

    fShopName: "दुकान का नाम", fOwner: "आपका नाम", fMobile: "मोबाइल नंबर (लॉगिन के लिए)",
    fGst: "GST नंबर",
    fType: "आपका काम क्या है?", tDistributor: "डिस्ट्रीब्यूटर", tSuperstockist: "सुपर स्टॉकिस्ट", tWholesaler: "होलसेलर",
    tCnf: "C&F एजेंट", tRetailer: "रिटेलर",
    fMakes: "क्या आप ख़ुद कुछ बनाते या पैक करते हैं?",
    fLoc: "दुकान की जगह", fLocBtn: "मेरी लोकेशन लें", fLocSaved: "लोकेशन सेव हो गई", fLocSavedS: "सेव हो गई", fLocWait: "लोकेशन ढूँढ रहे हैं…",
    fLocFail: "लोकेशन नहीं मिली। GPS चालू करके फिर कोशिश करें।", fAddress: "दुकान का पता",
    fLocDenied: "इस पेज को लोकेशन की इजाज़त दें, फिर दोबारा दबाएँ।", fAddrWait: "पता ढूँढ रहे हैं…",
    fAddrAdded: "लोकेशन और पता जुड़ गया। पता एक बार देख लें।", fAddrKept: "लोकेशन सेव हो गई। आपका लिखा पता वैसा ही रखा है।",
    fAddrNone: "पता लिख दीजिए।",
    fGodown: "आपके गोदाम", gShop: "दुकान पर ही", gN: "गोदाम {n}", gAdd: "गोदाम जोड़ें", fGodownAddr: "गोदाम का पता",
    fAreaPh: "इलाके का नाम, जैसे कुर्ला", takePhoto: "फ़ोटो लें",

    
    cNewName: "कंपनी का नाम", 

    
    
    

    iSearch: "खोजें: मैगी, आटा, आलू…", iScan: "स्कैन", iNew: "नया सामान",
    iByCompany: "ब्रांड से", iByType: "कैटेगरी से", iFresh: "ताज़ा और खुला सामान", iPacked: "पैकेट वाला सामान",
    iCount: "{n} सामान", iMine: "आपका सामान", iMineSub: "रेट देखें और बदलें",
    iNeedPrice: "{n} का रेट बाकी", iAddPrice: "अपना रेट डालें",
    iSelectAll: "सब चुनें", iClearAll: "सब हटाएँ", iNotFound: "नहीं मिला? नया सामान जोड़ें",
    iMore: "{total} में से {n} दिख रहे हैं। जल्दी ढूँढने के लिए और लिखें।",
    per_kg: "प्रति किलो", per_dozen: "प्रति दर्जन", per_tray30: "प्रति ट्रे (30)", per_bunch: "प्रति गड्डी", per_piece: "प्रति नग", per_litre: "प्रति लीटर", per_pack: "प्रति पैकेट",
    u_kg: "किलो", u_dozen: "दर्जन", u_tray30: "ट्रे", u_bunch: "गड्डी", u_piece: "नग", u_litre: "लीटर", u_pack: "पैकेट",
    iShopPrice: "ग्राहक का रेट", iCaseOf: "पेटी में {n}", iChosen: "{n} चुने",
    iEmpty: "कुछ नहीं मिला। नया सामान जोड़ें।",
    isMrp: "MRP (पैकेट पर छपा)", isSell: "ग्राहक को आपका रेट, 1 पीस", isBuy: "आपका खरीद रेट, 1 पीस",
    isSellPer: "ग्राहक को आपका रेट, {per}", isBuyPer: "आपका खरीद रेट, {per}", isLooseHint: "खुले सामान पर MRP नहीं होता। अपना आम रेट बताइए।",
    isKind: "पैकेट वाला या खुला?", kPacked: "पैकेट (MRP वाला)", kLoose: "खुला (किलो, दर्जन…)", isPer: "किस हिसाब से बिकता है",
    isUnit: "आप बेचते हैं", uPiece: "पीस", uCase: "पेटी", isCaseQty: "एक पेटी में कितने पीस",
    isSpeed: "कितनी जल्दी बिकता है?", spFast: "जल्दी", spMed: "ठीक-ठाक", spSlow: "धीरे",
    isGst: "GST %", isBarcode: "बारकोड नंबर", isRemove: "यह सामान हटाएँ",
    isName: "सामान का नाम", isPack: "पैक साइज़, जैसे 500 ग्राम", isCompany: "कंपनी", isCategory: "सामान का प्रकार",
    isPhoto: "पैकेट की फ़ोटो", isCheckMrp: "पैकेट पर MRP देख लें", isStdPrice: "आम मार्जिन से निकाला है। आपका रेट अलग हो तो बदल दें।", isCaseTotal: "1 पेटी = ₹{n}",
    otherCompany: "दूसरी",

    scTitle: "बारकोड कैमरे के सामने रखें", scNotSupported: "इस फ़ोन पर स्कैन नहीं होता। नाम से खोजें।",
    scFound: "मिल गया: {name}", scNew: "नया बारकोड। सामान जोड़ें।", scNoCamera: "कैमरा नहीं खुला। कैमरा की इजाज़त देकर फिर कोशिश करें।",

    pPick: "फ़ोन से जोड़ें", pType: "नाम और नंबर लिखें",
    pWho: "यह कौन है?", pShop: "ग्राहक", pSupplier: "सप्लायर", pStaff: "स्टाफ़", pSkip: "ज़रूरत नहीं",
    pLeft: "{n} बाकी", pUndo: "वापस", pAdded: "{n} जुड़े", pDup: "{n} पहले से जुड़े थे",
    pNoPicker: "इस फ़ोन का ब्राउज़र वेब पेज को आपके नंबर खोलने नहीं देता।", pNoPickerIos: "iPhone पर Safari की एक सेटिंग चालू करने से यहाँ नंबर खुल जाते हैं।", pIos1: "Settings → Apps → Safari → Advanced → Feature Flags खोलें।", pIos2: "“Contact Picker API” चालू करें।", pIos3: "वापस आकर “फ़ोन के नंबरों से जोड़ें” दबाएँ: आपके नंबर खुल जाएँगे। खोजें, कई चुनें, जोड़ें।", pIosOld: "पुराने iPhone पर: Settings → Safari → Advanced → Experimental Features।", pAnd1: "यह पेज Chrome में खोलें (फ़ोन का अपना ब्राउज़र शायद न खोले)।", pAnd2: "“फ़ोन के नंबरों से जोड़ें” दबाएँ: आपके नंबर खुल जाएँगे। खोजें, कई चुनें, जोड़ें।", pOther1: "कंप्यूटर पर फ़ोन के नंबर नहीं होते। यह पेज फ़ोन पर खोलें: Android में Chrome, iPhone में Safari।", pNoPicker2: "या नीचे दबाकर नाम और नंबर लिखें।",
    pSkippedList: "ज़रूरत नहीं", pName: "नाम", pPhone: "मोबाइल नंबर", pSaveNext: "सेव करें और अगला जोड़ें", pIsA: "यह है",
    pAllSorted: "सब छँट गए। और जोड़ें, या ऊपर से किसी की जानकारी भरें।", pTabSort: "छाँटने बाकी", pShopHint: "बड़े ग्राहक पर ★ दबाएँ, और जिन दिनों माल जाता है।", suNoCo: "उनकी कंपनी चुनने के लिए दबाएँ", pSearch: "नाम या नंबर खोजें", pGuess: "शायद यही", pRestCustomers: "बाकी सब ग्राहक हैं ({n})", pSortedAll: "{n} ग्राहक जुड़ गए", pToSort: "{n} छाँटने बाकी", pNone: "अभी कोई नहीं। फ़ोन से, कॉन्टैक्ट फ़ाइल से, या नाम लिखकर जोड़ें।", pTypeShort: "लिखें", pRemove: "यह नंबर हटाएँ",

    shAdd: "ग्राहक जोड़ें", shEmpty: "अभी कोई ग्राहक नहीं। फ़ोन के नंबरों से जोड़ें या लिखें।",
    shArea: "इलाका", shAreaAdd: "नया इलाका", shPay: "पेमेंट", payCash: "नकद", payDays: "{n} दिन उधार",
    shRate: "रेट लिस्ट", rtNormal: "सामान्य", rtWholesale: "होलसेल", rtSpecial: "ख़ास",
    shHow: "ऑर्डर कैसे देते हैं?", howSalesman: "सेल्समैन जाता है", howPhone: "फ़ोन पर", howWhatsapp: "WhatsApp पर", howSelf: "ख़ुद से",
    shOwes: "अभी आपके कितने पैसे बाकी हैं? (₹)", shOwesHint: "याद से बताइए। हम बाद में पक्का कर लेंगे।",
    shNote: "नोट", shBig: "बड़ा ग्राहक", shDays: "माल जाने के दिन", shOwesShow: "₹{n} बाकी",

    stAdd: "स्टाफ़ जोड़ें", stEmpty: "अभी कोई स्टाफ़ नहीं।", stNone: "मेरे पास स्टाफ़ नहीं है",
    roleSalesman: "सेल्समैन", roleDelivery: "डिलीवरी", roleSupervisor: "सुपरवाइज़र", roleOffice: "ऑफ़िस",
    stDays: "किन दिनों बाहर जाते हैं", stVehicle: "गाड़ी नंबर", stCash: "पैसे लेते हैं?",

    suAdd: "सप्लायर जोड़ें", suEmpty: "अभी कोई सप्लायर नहीं।", suNone: "बाद में जोड़ेंगे", suCompanies: "कौन सी कंपनियाँ?",
    suCode: "उनके पास आपका डिस्ट्रीब्यूटर कोड", suGst: "उनका GST नंबर", suLead: "माल कितने दिन में आता है?",
    suOwe: "अभी आपको उन्हें कितना देना है? (₹)", daysN: "{n} दिन",

   
   
   

    gsSearch: "गिनने के लिए सामान खोजें", gsList: "आपकी गिनती", gsEmpty: "ऊपर खोजें और गोदाम में जो है वो जोड़ें।",
    gsAllMine: "मेरे सारे सामान · {n}", gsShowing: "{total} में से {n} — बाकी के लिए लिखते रहें", gsNoFound: "कोई सामान नहीं मिला",
    gsCounted: "{total} में से {n} गिने", gsUnit: "किसमें गिनें", gsPrice: "आपकी कीमत: {p} प्रति {u}", gsNoPrice: "अभी कीमत नहीं। प्रोडक्ट में डालें।",
    gsRemove: "गिनती से हटाएँ",

    ruPay: "ग्राहक पैसे देते हैं", mCash: "नकद", mUpi: "UPI", mCheque: "चेक", mCredit: "उधार",
    ruRoutes: "तय दिन, तय रूट?", ruSelf: "ग्राहक फ़ोन से ऑर्डर करें?",
    ruPart: "थोड़ा अभी, बाकी बाद में?", ruReturns: "ख़राब माल वापस आए तो",
    retCredit: "क्रेडिट देते हैं", retReplace: "बदल देते हैं", retNone: "वापस नहीं लेते",
    ruBatches: "एक्सपायरी देखते हैं?", ruMorning: "रोज़ सुबह सबसे पहले",
    mnOrders: "ऑर्डर", mnMoney: "वसूली", mnStock: "माल", mnTrucks: "गाड़ियाँ", ruNote: "और कुछ?", ruNotePh: "लिखें, या माइक दबा कर बोलें",

    paTitle: "फ़ोटो और आवाज़", paPhoto: "कागज़ की फ़ोटो लें", paPhotoHint: "बिल, खाता, रेट लिस्ट, रूट चार्ट",
    paVoice: "आवाज़ रिकॉर्ड करें", paStop: "रोकें", paRecording: "रिकॉर्ड हो रहा है… {s} सेकंड", paNone: "अभी कुछ नहीं",
    paDelete: "मिटाएँ", paSaved: "सेव हो गया", paNoMic: "माइक नहीं खुला। इजाज़त देकर फिर कोशिश करें।",

    tProducts: "सामान", tShops: "ग्राहक", tSuppliers: "सप्लायर", tStaff: "स्टाफ़", tPapers: "फ़ोटो / आवाज़",
    fiNoMissing: "कुछ बाकी नहीं। शाबाश!", fiLater: "{n} चीज़ें बाद में भरनी हैं", fiLater_1: "1 चीज़ बाद में भरनी है", fiStock: "गिना माल",
    fiBuild: "मेरी दुकान बनाएँ", fiWorking: "दुकान बन रही है…", fiBuilt: "आपकी दुकान बन गई", fiBuiltSub: "अब आप ऐप बंद कर सकते हैं। FoodBridge की टीम जल्द ही आपको कॉल करके दुकान सेट करेगी।",
    fiSent: "FoodBridge को आपकी दुकान मिल गई", fiSentAt: "भेजी {d}", fiSending: "FoodBridge को भेज रहे हैं…",
    fiWaiting: "भेजना बाकी", fiWaitingSub: "{total} में से {n} फ़ाइलें गईं", fiWaitingWhy: "अभी इंटरनेट नहीं है। फ़ोन ऑनलाइन होते ही अपने आप चली जाएगी।",
    fiSendNow: "अभी भेजें",

    cfFresh: "सब मिटा कर फिर से शुरू करें?", cfFreshYes: "हाँ, सब मिटाएँ",
   
   
    micUnsupported: "यहाँ बोल कर लिखना नहीं चलता। कीबोर्ड वाला माइक दबाएँ।", listening: "अब बोलिए…",
    micSpeak: "बोल कर लिखें", micBlocked: "इस पेज को माइक की इजाज़त दें, फिर माइक दोबारा दबाएँ।",
    micNoSpeech: "कुछ सुनाई नहीं दिया। माइक दबा कर बोलिए।", micNone: "माइक नहीं मिला।",
    micNet: "बोल कर लिखने के लिए इंटरनेट चाहिए।", micFail: "माइक शुरू नहीं हुआ। दोबारा दबाएँ।",

    gap_noName: "दुकान का नाम", gap_noMobile: "आपका मोबाइल नंबर", gap_noGst: "GST नंबर", gap_noLocation: "दुकान की जगह",
    gap_noItems: "कोई सामान नहीं चुना", gap_noMrp: "बिना MRP के सामान", gap_noPrice: "खुले सामान का रेट नहीं", gap_unsorted: "नंबर छाँटने बाकी",
    gap_noShops: "कोई ग्राहक नहीं", gap_shopNoDay: "ग्राहक जिनका दिन नहीं चुना", gap_shopNoPhone: "ग्राहक बिना मोबाइल नंबर",
    gap_shopNoArea: "ग्राहक बिना इलाका", gap_shopNoPay: "ग्राहक बिना नकद / उधार", gap_noDelivery: "कोई डिलीवरी वाला नहीं",
    gap_staffNoRole: "स्टाफ़ बिना काम", gap_noSuppliers: "कोई सप्लायर नहीं", gap_supNoCompany: "सप्लायर बिना कंपनी",
    gap_notCounted: "सामान गिना नहीं",
    gap_rulesOpen: "सवाल बाकी",

    d_mon: "सोम", d_tue: "मंगल", d_wed: "बुध", d_thu: "गुरु", d_fri: "शुक्र", d_sat: "शनि", d_sun: "रवि",
  };

  const I18N = { en: en, hi: hi };
  if (typeof module !== "undefined" && module.exports) module.exports = I18N;
  else root.SB_I18N = I18N;
})(typeof window !== "undefined" ? window : globalThis);
