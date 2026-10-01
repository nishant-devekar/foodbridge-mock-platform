/* Store Builder · the desktop page (1 Oct 2026).

   Not the phone page made wider. On a computer the store is built at one
   desk, not in six trips:
   - a start screen that is the Shop step, beside "start from what you already
     have": drop a contacts file, an Excel customer list or photos of paper;
   - one desk: the sections down the left (no steps list, no Save and back),
     the work in the middle, and the store as it grows on the right, with
     Build my store always one click away;
   - what is a list of taps on the phone is a sheet here: tick products in a
     grid while they collect beside it, sort contacts with 1 2 3 0, paint
     delivery days across a week, type stock counts down a column.

   The same answers as the phone page (model.js, the same localStorage key,
   photos and builds through outbox.js), the same export, both languages. */

(function () {
  "use strict";

  /* Where Store Builder lives (its folder), whichever address loaded this script: the one address
     that flips with the screen (store-builder/) or the old desktop/ one. */
  const BASE = new URL("../", (document.currentScript && document.currentScript.src) || location.href).href;
  const CAT = window.SB_CATALOGUE, M = window.SB_MODEL, X = window.SB_EXPORT, I18N = window.SB_I18N, IMP = window.SB_IMPORT;
  const OB = window.SB_OUTBOX, DB = OB.DB, OUTBOX = OB.OUTBOX;
  const ic = window.SB_ICON;
  const KEY = "fb.storebuilder.v1";   // the phone page's key: one store, either page
  const SECS = M.STEPS.filter(function (x) { return x !== "finish"; });   // the steps not hidden (model.js HIDDEN_STEPS)
  const ICON = { store: "store", items: "box", people: "contacts", stock: "warehouse", rules: "rules", finish: "send" };
  const canRecord = "MediaRecorder" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const $app = document.getElementById("app");
  const $dlg = document.getElementById("dlg");
  const $toast = document.getElementById("toast");
  const $drop = document.getElementById("drop");

  /* Words only this page says; everything else comes from i18n.js. */
  const DT = {
    en: {
      dkSaved: "Saved", dkSavedAt: "Saved {t}", dkPhone: "Phone version",
      pgSend: "Send", ctaContinue: "Continue", stTitle10: "Let's make your store in 10 minutes", rlT: "How does your day run?", phMobile: "98200 11223", phGst: "27ABCDE1234F1Z5",
      lsd_store: "Mobile, GST and business", lsd_items: "What you sell, and prices", lsd_people: "Customers, staff, suppliers",
      lsd_stock: "What's in your warehouse", lsd_rules: "How your day runs", lsd_send: "Check it, send it to FoodBridge",
      pkT: "Which products do you sell?", pkL: "Tick the ones you sell. Search by name, brand or kind.", pkAll: "All", pkNew: "Can't find one? Add it yourself",
      prT: "Check your prices", prAll: "Every product has a price",
      adT: "Who do you work with?", adL: "Bring in your contacts or customer list, or type a few names. You sort them next.",
      adFile: "Bring in a file", adFileS: "A contacts file, an Excel list, or a photo of your register",
      adType: "Type names", adTypeS: "Name and mobile, one by one", sumPeople: "{n} people", sumPeople_1: "1 person",
      pgFiles: "Files", flT: "Anything else that helps?", flN: "{n} files", flN_1: "1 file",
      fkRoute: "Route chart", fkBills: "Bills", fkKhata: "Khata page", fkRates: "Rate list",
      dzF1: "Rate list.pdf", dzF2: "Bills.xlsx", dzF3: "Route chart.pdf", dzHere: "Store Builder", dzAdded: "Added", dzMore: "Drag more files here",
      dzWaFrom: "Parle Agencies", dzWaMsg: "New rates from 1st", dzMail: "Inbox", dzMailFrom: "Suresh (salesman)", dzMailSub: "Route chart for October",
      hpT: "Paper? Snap it with your phone", hpStep2: "Snap", hpGot: "{n} photos came from your phone", hpGot_1: "1 photo came from your phone", hpOpen: "Phone connected. Take your photos",
      dzDrag: "Drag your files here",
      icLink: "iPhone? Bring them from iCloud", icT: "Your iPhone contacts, from iCloud",
      ic1: "Open iCloud Contacts and sign in with your Apple ID", ic1b: "Open iCloud Contacts",
      ic2: "Select all, then Export vCard", ic2s: "Press Ctrl+A (⌘A on a Mac), open the ⋯ menu, and choose Export vCard. One file downloads.",
      ic3: "Drop that file here", ic3d: "Drop the vCard file here",
      hoDone: "{n} contacts added", hoDone_1: "1 contact added", hoMark: "Mark who is who", hoMore: "Scan to add more", ctaMark: "Next: Mark who is who",
      adPhone: "Sync contacts from your phone", hoTag: "Fastest", orWord: "or", adPhoneS: "Scan this with your phone's camera, pick your customers and suppliers, and tap Send. They come straight here.",
      adStep1: "Scan", adStep2: "Pick contacts", adStep3: "Send",
      hoWait: "Waiting for your phone", hoOpen: "Phone connected. Pick your contacts", hoGot: "{n} came from your phone", hoGot_1: "1 came from your phone",
      hoOff: "Can't reach FoodBridge right now. Use a list or paste instead.", hoAgain: "Show the code again", hoSleep: "The code went to sleep",
      adList: "Tally or Excel list", adListS: "Customers and suppliers get sorted for you", adListFrom: "Tally · Busy · Marg · Vyapar · Excel · Google Contacts",
      adPaste: "Paste a list", adPasteS: "Copy rows from Excel or WhatsApp, then press", adOr: "or type names one by one",
      pasteNone: "Nothing with a name or number in what you pasted", pasted: "{n} added from what you pasted", pasted_1: "1 added from what you pasted",
      pasteHow: "Press {k} to paste", micSpeakDk: "Speak instead of typing", micStop: "Stop", micListening: "Listening… click to stop",
      micRecDk: "Record a voice note for the team", micGoneDk: "This browser can't turn speech into words. The mic now records a voice note for the team.", pRemovedOne: "{name} removed",
      edu1b: "Export from Tally or Excel", edu2b: "Or a photo of your register", edu3b: "Attach it here",
      evTally: "Tally", evCam: "Camera", evExport: "Export", evExcel: "Excel", evFile: "Party list.xlsx",
      evDrop: "Attach here", evOkA: "42 customers · 6 suppliers", evOkB: "Photo sent to the team",
      adGoogle: "No phone handy? Sync Google Contacts", gotGoogle: "{n} came from Google Contacts", gotGoogle_1: "1 came from Google Contacts",
      googleFail: "Google didn't send the contacts. Try again.",
      srT: "Who is who?", srL: "Mark each one: 1 customer, 2 staff, 3 supplier, 0 not needed. Arrow keys move, U undoes.",
      dyT: "When do you deliver to each customer?", dyLeft: "{n} without a day", dyLeft_1: "1 without a day",
      tmT: "Your staff and suppliers", tmL: "What each person on your team does, and your suppliers.",
      stT: "How much stock do you have now?",
      rvT: "All set? Send it to FoodBridge", rvL: "This is what goes to FoodBridge. Anything missing is followed up later.",
      menuSampleStep: "Fill {s} with sample data",
      stTitle: "Let's make your store", stSub: "About 10 minutes. Everything saves as you go.",
      stSample: "Try it with sample data", nextTo: "Next: {s}", nextBuild: "Check and build",
      stepsTitle: "Steps", sendStep: "Send to FoodBridge",
      rqSub: "Fills in as you go. Send it when you're ready; anything missing is followed up later.",
      pvLabel: "Preview", pvTitle: "Your FoodBridge store", pvEmpty: "Your store takes shape here as you go.", pvNoName: "Your store",
      pvReady: "{p}% ready to send", pvRoutes: "Fixed route days", pvSelf: "Orders on phone", pvPart: "Bills paid in parts", pvStock: "Warehouse stock",
      pvDaily: "Daily work", pvFiles: "Files", pvPrices: "Change prices here", colMrp: "MRP", colCust: "Your price to customer", prPh: "Price", atDrop: "You can also drop files anywhere on this page.",
      fdSub: "Photos, screenshots, Excel sheets, PDFs, contact lists: the FoodBridge team gets every file as it came.",
      fdDrop: "Drop it here", fdOr: "or", fdBrowse: "choose from this computer", fdKinds: "Photos · Screenshots · Excel · PDF · Contacts · Anything",
      fdContacts: "{n} contacts found", fdContacts_1: "1 contact found", fdDup: "{n} already there", fdAttached: "Goes to FoodBridge as it is",
      fdRemove: "Remove", fdVoice: "Voice note", fdPhoto: "Photo",
      tPapers: "Your files", dropHere: "Drop files here", dropSub: "Photos, screenshots, Excel, PDFs, contacts: anything",
      secStore: "Shop", secItems: "Products", secPeople: "Contacts", secStock: "Stock", secRules: "Daily work",
      readyN: "{n} of {total} sections done", buildLater: "Anything missing is followed up later.",
      ypHint: "Prices start at the usual margin. Change any that differ.", ypEmpty: "Tick products in the grid. They collect here.",
      ypPiece: "/ pc", allProducts: "All products", searchKey: "/",
      pickHint: "Shift-click ticks a run · arrow keys move · Space ticks", foundN: "{n} products", foundN_1: "1 product",
      importFile: "Import file", addPerson: "Add person", addPersonGo: "Add", tNot: "Not needed",
      keysSort: "1 customer · 2 staff · 3 supplier · 0 not needed · ↑ ↓ move · U undo",
      colName: "Name", colNumber: "Mobile", colLooks: "Looks like", colArea: "Area", colPays: "Pays",
      colJob: "Job", colDays: "Days out", colVehicle: "Vehicle", colCash: "Collects cash", colCompanies: "Companies", colCode: "Your code",
      colLead: "Goods come in", colOwe: "You owe ₹", colProduct: "Product", colCount: "Count", colIn: "In", colPrice: "Your price",
      paintHint: "Drag across a row, or down a column, to set days.", starHint: "Click ★ for big customers.", sameArea: "Give {area}'s {days} to {n} more in {area}",
      sortEmptyT: "Bring your contacts in", sortEmptyS: "Import a contacts file or an Excel list, or type names. On a phone, the phone page picks from phone contacts.",
      stockAdd: "Add a product to the count", stockLegend: "Blank is not counted. 0 is looked, none there.",
      stockNoItems: "Choose your products first, then count them here.", goProducts: "Choose products", stockMore: "Add my other {n} products",
      menuSample: "Fill every section with sample data", menuPhone: "Open the phone version",
      narrow: "Made for a computer screen.", narrowLink: "Open the phone version", close: "Close",
      sampleAllBody: "Fills what is still empty in every section with sample answers. What you entered stays.",
      fiWaitingWhy: "No internet right now. It goes by itself when this computer is online.",
      noArea: "area?", notePh: "Anything about your day we should know", edit: "Edit", pickOne: "—", fiReview: "Check it once, then build your store.",
    },
    hi: {
      dkSaved: "सेव हो गया", dkSavedAt: "{t} पर सेव हुआ", dkPhone: "फ़ोन वाला",
      pgSend: "भेजें", ctaContinue: "आगे बढ़ें", stTitle10: "10 मिनट में अपनी दुकान बनाएँ", rlT: "आपका दिन कैसे चलता है?", phMobile: "98200 11223", phGst: "27ABCDE1234F1Z5",
      lsd_store: "मोबाइल, GST और कारोबार", lsd_items: "क्या बेचते हैं, और दाम", lsd_people: "ग्राहक, स्टाफ़, सप्लायर",
      lsd_stock: "गोदाम में क्या है", lsd_rules: "आपका दिन कैसे चलता है", lsd_send: "देखें, और FoodBridge को भेजें",
      pkT: "आप कौन-सा सामान बेचते हैं?", pkL: "जो बेचते हैं उन पर टिक करें। नाम, ब्रांड या किस्म से खोजें।", pkAll: "सब", pkNew: "नहीं मिला? खुद जोड़ें",
      prT: "अपने दाम देख लें", prAll: "हर सामान का दाम है",
      adT: "आप किन-किन के साथ काम करते हैं?", adL: "अपने कॉन्टैक्ट या ग्राहकों की लिस्ट लाएँ, या कुछ नाम लिखें। अगले चरण में छाँटेंगे।",
      adFile: "फ़ाइल लाएँ", adFileS: "कॉन्टैक्ट फ़ाइल, Excel लिस्ट, या रजिस्टर की फ़ोटो",
      adType: "नाम लिखें", adTypeS: "नाम और मोबाइल, एक-एक करके", sumPeople: "{n} लोग",
      pgFiles: "फ़ाइलें", flT: "और कुछ जो काम आए?", flN: "{n} फ़ाइलें",
      fkRoute: "रूट चार्ट", fkBills: "बिल", fkKhata: "खाता पेज", fkRates: "रेट लिस्ट",
      dzF1: "Rate list.pdf", dzF2: "Bills.xlsx", dzF3: "Route chart.pdf", dzHere: "Store Builder", dzAdded: "जुड़ गई", dzMore: "और फ़ाइलें यहाँ खींचकर लाएँ",
      dzWaFrom: "Parle Agencies", dzWaMsg: "1 तारीख से नए रेट", dzMail: "Inbox", dzMailFrom: "सुरेश (सेल्समैन)", dzMailSub: "अक्टूबर का रूट चार्ट",
      hpT: "कागज़ है? फ़ोन से फ़ोटो भेजें", hpStep2: "फ़ोटो", hpGot: "{n} फ़ोटो फ़ोन से आईं", hpOpen: "फ़ोन जुड़ गया। फ़ोटो खींचें",
      dzDrag: "अपनी फ़ाइलें यहाँ खींचकर लाएँ",
      icLink: "iPhone है? iCloud से लाएँ", icT: "iPhone के कॉन्टैक्ट, iCloud से",
      ic1: "iCloud Contacts खोलें और Apple ID से साइन इन करें", ic1b: "iCloud Contacts खोलें",
      ic2: "सब चुनें, फिर Export vCard", ic2s: "Ctrl+A (Mac पर ⌘A) दबाएँ, ⋯ मेनू खोलें, और Export vCard चुनें। एक फ़ाइल डाउनलोड होगी।",
      ic3: "वह फ़ाइल यहाँ छोड़ें", ic3d: "vCard फ़ाइल यहाँ छोड़ें",
      hoDone: "{n} कॉन्टैक्ट जुड़ गए", hoMark: "कौन क्या है, चुनें", hoMore: "और जोड़ने के लिए स्कैन करें", ctaMark: "आगे: कौन क्या है",
      adPhone: "फ़ोन से कॉन्टैक्ट सिंक करें", hoTag: "सबसे तेज़", orWord: "या", adPhoneS: "फ़ोन के कैमरे से इसे स्कैन करें, ग्राहक और सप्लायर चुनें, और भेजें दबाएँ। वे सीधे यहाँ आ जाएँगे।",
      adStep1: "स्कैन", adStep2: "कॉन्टैक्ट चुनें", adStep3: "भेजें",
      hoWait: "आपके फ़ोन का इंतज़ार", hoOpen: "फ़ोन जुड़ गया। कॉन्टैक्ट चुनें", hoGot: "{n} फ़ोन से आए",
      hoOff: "अभी FoodBridge से जुड़ नहीं पा रहे। लिस्ट या पेस्ट से जोड़ें।", hoAgain: "कोड फिर दिखाएँ", hoSleep: "कोड सो गया",
      adList: "Tally या Excel लिस्ट", adListS: "ग्राहक और सप्लायर अपने-आप छँट जाते हैं", adListFrom: "Tally · Busy · Marg · Vyapar · Excel · Google Contacts",
      adPaste: "लिस्ट पेस्ट करें", adPasteS: "Excel या WhatsApp से कॉपी करें, फिर दबाएँ", adOr: "या एक-एक करके नाम लिखें",
      pRemovedOne: "{name} हटाया गया", micSpeakDk: "लिखने की जगह बोलें", micStop: "रोकें", micListening: "सुन रहे हैं… रोकने के लिए दबाएँ",
      micRecDk: "टीम के लिए आवाज़ रिकॉर्ड करें", micGoneDk: "यह ब्राउज़र बोली को शब्दों में नहीं बदलता। अब माइक टीम के लिए आवाज़ रिकॉर्ड करेगा।", pasteNone: "पेस्ट में कोई नाम या नंबर नहीं मिला", pasted: "पेस्ट से {n} जुड़े", pasteHow: "पेस्ट के लिए {k} दबाएँ",
      edu1b: "Tally या Excel से export करें", edu2b: "या रजिस्टर की फ़ोटो", edu3b: "यहाँ जोड़ें",
      evTally: "Tally", evCam: "कैमरा", evExport: "Export", evExcel: "Excel", evFile: "Party list.xlsx",
      evDrop: "यहाँ जोड़ें", evOkA: "42 ग्राहक · 6 सप्लायर", evOkB: "फ़ोटो टीम को गई",
      adGoogle: "फ़ोन पास नहीं? Google Contacts से जोड़ें", gotGoogle: "Google Contacts से {n} आए", googleFail: "Google से कॉन्टैक्ट नहीं आए। फिर कोशिश करें।",
      srT: "कौन क्या है?", srL: "हर एक को चुनें: 1 ग्राहक, 2 स्टाफ़, 3 सप्लायर, 0 ज़रूरत नहीं। तीर से ऊपर-नीचे, U से वापस।",
      dyT: "किस ग्राहक को किस दिन माल देते हैं?", dyLeft: "{n} बिना दिन के",
      tmT: "आपका स्टाफ़ और सप्लायर", tmL: "आपकी टीम में कौन क्या करता है, और आपके सप्लायर।",
      stT: "अभी आपके पास कितना स्टॉक है?",
      rvT: "सब ठीक? FoodBridge को भेजें", rvL: "यही FoodBridge को जाएगा। जो छूटा है, वह बाद में पूछा जाएगा।",
      menuSampleStep: "{s} में नमूना डेटा भरें",
      stTitle: "चलिए आपकी दुकान बनाते हैं", stSub: "लगभग 10 मिनट। सब अपने आप सेव होता है।",
      stSample: "नमूना डेटा से देखें", nextTo: "आगे: {s}", nextBuild: "देखें और बनाएँ",
      stepsTitle: "चरण", sendStep: "FoodBridge को भेजें",
      rqSub: "जैसे-जैसे आप भरते हैं, यह भरता जाता है। तैयार हों तब भेजें; जो छूटा, वह बाद में पूछा जाएगा।",
      pvLabel: "झलक", pvTitle: "आपकी FoodBridge दुकान", pvEmpty: "जैसे-जैसे आप भरते हैं, आपकी दुकान यहाँ बनती जाती है।", pvNoName: "आपकी दुकान",
      pvReady: "भेजने के लिए {p}% तैयार", pvRoutes: "तय रूट के दिन", pvSelf: "फ़ोन पर ऑर्डर", pvPart: "बिल किस्तों में", pvStock: "गोदाम का स्टॉक",
      pvDaily: "रोज़ का काम", pvFiles: "फ़ाइलें", pvPrices: "दाम यहाँ बदलें", colMrp: "MRP", colCust: "ग्राहक के लिए आपका दाम", prPh: "दाम", atDrop: "फ़ाइलें इस पेज पर कहीं भी छोड़ भी सकते हैं।",
      fdSub: "फ़ोटो, स्क्रीनशॉट, Excel, PDF, कॉन्टैक्ट लिस्ट: हर फ़ाइल FoodBridge टीम तक वैसी ही पहुँचेगी।",
      fdDrop: "यहाँ छोड़ें", fdOr: "या", fdBrowse: "कंप्यूटर से चुनें", fdKinds: "फ़ोटो · स्क्रीनशॉट · Excel · PDF · कॉन्टैक्ट · कुछ भी",
      fdContacts: "{n} कॉन्टैक्ट मिले", fdDup: "{n} पहले से थे", fdAttached: "FoodBridge को वैसी ही जाएगी",
      fdRemove: "हटाएँ", fdVoice: "आवाज़ नोट", fdPhoto: "फ़ोटो",
      tPapers: "आपकी फ़ाइलें", dropHere: "फ़ाइलें यहाँ छोड़ें", dropSub: "फ़ोटो, स्क्रीनशॉट, Excel, PDF, कॉन्टैक्ट: कुछ भी",
      secStore: "दुकान", secItems: "सामान", secPeople: "कॉन्टैक्ट", secStock: "स्टॉक", secRules: "रोज़ का काम",
      readyN: "{total} में से {n} हिस्से पूरे", buildLater: "जो छूटा है, उसके लिए बाद में पूछा जाएगा।",
      ypHint: "दाम आम मार्जिन से शुरू होते हैं। जो अलग हो, बदल दें।", ypEmpty: "ग्रिड में सामान पर टिक करें। वह यहाँ जुड़ता जाएगा।",
      ypPiece: "/ पीस", allProducts: "सारा सामान", searchKey: "/",
      pickHint: "Shift-क्लिक से एक साथ कई · तीर से आगे-पीछे · Space से टिक", foundN: "{n} सामान",
      importFile: "फ़ाइल से लाएँ", addPerson: "नाम जोड़ें", addPersonGo: "जोड़ें", tNot: "ज़रूरत नहीं",
      keysSort: "1 ग्राहक · 2 स्टाफ़ · 3 सप्लायर · 0 ज़रूरत नहीं · ↑ ↓ ऊपर-नीचे · U वापस",
      colName: "नाम", colNumber: "मोबाइल", colLooks: "लगता है", colArea: "इलाका", colPays: "पेमेंट",
      colJob: "काम", colDays: "किन दिनों", colVehicle: "गाड़ी", colCash: "पैसे लाता है", colCompanies: "कंपनियाँ", colCode: "आपका कोड",
      colLead: "माल कितने दिन में", colOwe: "आपको देना ₹", colProduct: "सामान", colCount: "गिनती", colIn: "में", colPrice: "आपका दाम",
      paintHint: "दिन चुनने के लिए लाइन पर या कॉलम में नीचे खींचें।", starHint: "बड़े ग्राहकों के लिए ★ दबाएँ।", sameArea: "{area} के {days} वही {n} और ग्राहकों को दें",
      sortEmptyT: "अपने कॉन्टैक्ट लाइए", sortEmptyS: "कॉन्टैक्ट फ़ाइल या Excel लिस्ट लाएँ, या नाम टाइप करें। फ़ोन पर, फ़ोन वाला पेज फ़ोन के कॉन्टैक्ट खोलता है।",
      stockAdd: "गिनती में सामान जोड़ें", stockLegend: "खाली मतलब गिना नहीं। 0 मतलब देखा, नहीं है।",
      stockNoItems: "पहले अपना सामान चुनें, फिर यहाँ गिनें।", goProducts: "सामान चुनें", stockMore: "मेरा बाकी {n} सामान जोड़ें",
      menuSample: "हर हिस्से में नमूना डेटा भरें", menuPhone: "फ़ोन वाला खोलें",
      narrow: "यह कंप्यूटर की स्क्रीन के लिए है।", narrowLink: "फ़ोन वाला खोलें", close: "बंद करें",
      sampleAllBody: "हर हिस्से में जो खाली है, वहाँ नमूना जवाब भरता है। आपका भरा हुआ वैसा ही रहता है।",
      fiWaitingWhy: "अभी इंटरनेट नहीं है। कंप्यूटर ऑनलाइन होते ही अपने आप चली जाएगी।",
      noArea: "इलाका?", notePh: "आपके दिन के बारे में कुछ और", edit: "बदलें", pickOne: "—", fiReview: "एक बार देख लें, फिर अपनी दुकान बनाएँ।",
    },
  };

  let S = load();
  let view = "desk";
  let dlg = null;
  const ui = {
    scr: "store", by: "co", group: null, itemsQ: "", lastPick: null, shown: [],
    tab: null, peopleQ: "", sortFocus: null, sortedHere: [], lastSorted: [], adding: false, paint: null,
    stQ: "", stOpen: false, needMobile: false, outbox: [], building: false, sending: false, rec: null, dragN: 0,
  };
  const urls = {};

  /* ─────────────────────────────────────────────────────── storage ── */

  function load() {
    try { return M.migrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return M.blank(); }
  }
  function save() {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("⚠ " + e.message); }
    const el = document.getElementById("saved");
    if (el) el.innerHTML = savedHTML();
  }
  function syncSave() { M.syncCompanies(CAT, S); save(); }

  /* The phone page open in another tab of this browser: its answers show here too. */
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    S = load();
    render();
  });

  function deliver(b) { return OB.deliver(X, b, function () { if (view === "thanks") render(); }); }
  async function sendAll() {
    if (ui.sending) return;
    ui.sending = true;
    let list = [];
    try { list = await OUTBOX.all(); } catch (e) { list = []; }
    for (const b of list.sort(function (x, y) { return x.at - y.at; })) {
      if (!(await deliver(b))) break;   // the bridge is not there: try the rest later
    }
    try { ui.outbox = await OUTBOX.all(); } catch (e) { ui.outbox = []; }
    ui.sending = false;
    render();
  }
  window.addEventListener("online", function () { sendAll(); });

  /* ─────────────────────────────────────────────────────── helpers ── */

  function t(k, v) {
    const lang = S.lang === "hi" ? "hi" : "en";
    const D = DT[lang], L = I18N[lang] || I18N.en;
    if (v && v.n === 1 && (D[k + "_1"] != null || L[k + "_1"] != null)) k = k + "_1";
    let s = D[k] != null ? D[k] : L[k] != null ? L[k] : DT.en[k] != null ? DT.en[k] : I18N.en[k] != null ? I18N.en[k] : k;
    if (v) Object.keys(v).forEach(function (x) { s = s.split("{" + x + "}").join(v[x]); });
    return s;
  }
  function h(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function rupee(n) { return n == null || n === "" || isNaN(n) ? "" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function catName(c) { const x = CAT.categories[c] || CAT.categories.other; return S.lang === "en" ? x.en : x.hi; }
  function dayName(d) { return t("d_" + d); }
  function secName(s) { return t("sec" + s[0].toUpperCase() + s.slice(1)); }
  function nm(it) { return S.lang !== "en" && it.hi ? it.hi : it.name; }
  function packLabel(it) { return it.loose ? t("per_" + it.per) : it.pack; }
  function payLabel(v) { return v === "cash" ? t("payCash") : v ? t("payDays", { n: v }) : ""; }
  function typing(el) { return el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable); }

  function getPath(path) {
    const r = path[0] === "@" ? [dlg, path.slice(1)] : [S, path];
    return r[1].split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, r[0]);
  }
  function setPath(path, v) {
    const r = path[0] === "@" ? [dlg, path.slice(1)] : [S, path];
    const ks = r[1].split(".");
    let o = r[0];
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = v;
  }

  function toast(msg, act) {
    $toast.innerHTML = "<span>" + h(msg) + "</span>" + (act ? act : "");
    $toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.classList.remove("show"); }, act ? 6000 : 2800);
  }

  function when(ms) {
    const d = new Date(ms), loc = S.lang === "en" ? "en-IN" : "hi-IN";
    return d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  }
  function whenLong(ms) {
    const d = new Date(ms), loc = S.lang === "en" ? "en-IN" : "hi-IN";
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  }
  /* A small tick by the name; the time is in its tooltip (the header is the card's top edge, and short). */
  function savedHTML() { return S.updatedAt ? '<span title="' + h(t("dkSavedAt", { t: when(S.updatedAt) })) + '" aria-label="' + h(t("dkSavedAt", { t: when(S.updatedAt) })) + '">' + ic("circleCheck", 15) + "</span>" : ""; }

  /* ─────────────────────────────────────────────── bits of screen ── */

  const LOGO = '<img class="dk-logo" src="' + BASE + 'foodbridge-mark-green.png?v=1" alt="FoodBridge" width="28" height="28">';

  function chips(opts, isOn, attrs, cls) {
    return '<div class="chips' + (cls ? " " + cls : "") + '">' + opts.map(function (o) {
      const on = isOn(o.v);
      return '<button type="button" class="chip' + (on ? " on" : "") + '" ' + attrs + ' data-v="' + h(o.v) + '" aria-pressed="' + on + '">' + (on ? ic("check", 14) : "") + h(o.label) + "</button>";
    }).join("") + "</div>";
  }
  function setChips(path, kind, opts, cls) {
    const cur = getPath(path);
    return chips(opts, function (v) {
      if (kind === "arr") return (cur || []).map(String).indexOf(String(v)) >= 0;
      if (kind === "bool") return cur === (v === "1");
      return cur != null && String(cur) === String(v);
    }, 'data-act="set" data-path="' + h(path) + '" data-kind="' + kind + '"', cls);
  }
  function seg(path) {
    const v = getPath(path);
    const b = function (on, key, val) {
      return '<button type="button" class="' + (on ? "on" : "") + '" data-act="set" data-path="' + path + '" data-kind="bool" data-v="' + val + '" aria-pressed="' + on + '">' + h(t(key)) + "</button>";
    };
    return '<span class="seg">' + b(v === true, "yes", "1") + b(v === false, "no", "0") + "</span>";
  }

  /* A bound box. kind: num | upper; touch: the path that marks it as his own; rerender: redraw on change. */
  function inp(path, o) {
    o = o || {};
    const v = getPath(path);
    const tag = o.area ? "textarea" : "input";
    const attrs = ' data-bind="' + h(path) + '"' + (o.kind ? ' data-kind="' + o.kind + '"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") +
      (o.rerender ? " data-rerender" : "") + (o.ph ? ' placeholder="' + h(o.ph) + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") +
      (o.max ? ' maxlength="' + o.max + '"' : "") + (o.list ? ' list="' + o.list + '"' : "") + (o.label ? ' aria-label="' + h(o.label) + '"' : "") +
      ' class="' + ["in", o.cls || "", o.upper ? "upper" : ""].join(" ").trim() + '" autocomplete="' + (o.ac || "off") + '"';
    return tag === "textarea" ? "<textarea rows=\"3\"" + attrs + ">" + h(v) + "</textarea>" : "<input type=\"" + (o.type || "text") + '"' + attrs + ' value="' + h(v == null ? "" : v) + '">';
  }

  /* Speak instead of typing (owner, 1 Oct 2026). Chrome, Edge and Safari turn speech into words as he
     talks (Web Speech, en-IN or hi-IN with the page); where they can't (Firefox), the same button
     records a voice note for the team instead (recStart), so the mic always does something. */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function micBtn(path) {
    if (SR && !ui.micOff) {
      const on = ui.dict && ui.dict.path === path;
      return '<button type="button" class="mic' + (on ? " on" : "") + '" data-act="dictate" data-path="' + h(path) + '" aria-pressed="' + !!on + '" title="' + h(t(on ? "micStop" : "micSpeakDk")) + '">' +
        ic(on ? "stop" : "mic", 16) + (on ? "<span>" + h(t("micListening")) + "</span>" : "") + "</button>";
    }
    if (!canRecord) return "";
    return ui.rec ? '<button type="button" class="mic on" data-act="recStop">' + ic("stop", 16) + '<span id="recT">' + h(t("paRecording", { s: Math.round((Date.now() - ui.rec.started) / 1000) })) + "</span></button>"
      : '<button type="button" class="mic" data-act="recStart" title="' + h(t("micRecDk")) + '">' + ic("mic", 16) + "</button>";
  }
  /* The voice notes he recorded here (the mic where speech can't become words), each with a remove. */
  function voiceChips() {
    const step = dropStep();
    const vs = S.papers.filter(function (p) { return p.kind === "voice" && p.step === step; });
    return vs.length ? '<div class="vchips">' + vs.map(function (p) {
      return '<i class="fx-f">' + ic("mic", 14) + "<span>" + h(t("fdVoice")) + "</span><small>" + (p.secs ? p.secs + "s" : "") + "</small>" +
        '<button type="button" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '">' + ic("x", 13) + "</button></i>";
    }).join("") + "</div>" : "";
  }
  /* A note box that starts as one line and grows with what he says, up to four. */
  function growArea(el) { el.rows = 1; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight + 2, 112) + "px"; }
  document.addEventListener("input", function (e) { if (e.target.matches && e.target.matches("textarea.grow")) growArea(e.target); });
  function withMic(path, html) { return '<div class="inx-mic">' + html + micBtn(path) + "</div>" + voiceChips(); }

  function dictate(path) {
    if (ui.dict) { const same = ui.dict.path === path; stopDictate(); if (same) return; }
    let r;
    try { r = new SR(); } catch (e) { micGone(); return; }
    r.lang = S.lang === "en" ? "en-IN" : "hi-IN";
    r.continuous = true;
    r.interimResults = true;
    const d = ui.dict = { r: r, path: path, base: String(getPath(path) || "").trim(), fin: "", heard: false };
    r.onresult = function (e) {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i], said = x[0] ? x[0].transcript.trim() : "";
        if (!said) continue;
        if (x.isFinal) d.fin = d.fin ? d.fin + " " + said : said; else interim += (interim ? " " : "") + said;
      }
      d.heard = d.heard || !!(d.fin || interim);
      const v = [d.base, d.fin].filter(Boolean).join(" ");
      setPath(path, v);
      save();
      /* What he is still saying shows as he says it; only what is settled is kept. */
      const el = document.querySelector('[data-bind="' + path + '"]');
      if (el) { el.value = interim ? (v ? v + " " : "") + interim : v; if (el.classList.contains("grow")) growArea(el); el.scrollTop = el.scrollHeight; }
    };
    r.onerror = function (e) { if (e.error !== "aborted") d.err = e.error; };
    r.onend = function () {
      if (ui.dict !== d) return;
      ui.dict = null;
      render();
      if (d.err === "service-not-allowed" || d.err === "language-not-supported") micGone();
      else if (d.err && d.err !== "no-speech") toast(t({ "not-allowed": "micBlocked", "audio-capture": "micNone", network: "micNet" }[d.err] || "micFail"));
      else if (!d.heard && !d.stopped) toast(t("micNoSpeech"));
    };
    try { r.start(); } catch (e) { ui.dict = null; toast(t("micFail")); return; }
    render();
    const el = document.querySelector('[data-bind="' + path + '"]');
    if (el) el.focus({ preventScroll: true });
  }
  function stopDictate() {
    const d = ui.dict;
    if (!d) return;
    d.stopped = true;
    try { d.r.stop(); } catch (e) { /* not started */ }
  }
  /* No speech service here after all: the mic becomes the voice-note recorder. */
  function micGone() { ui.dict = null; ui.micOff = true; render(); toast(t("micGoneDk")); }

  function field(label, inner, hint) {
    return '<div class="fld"><label class="fld-l">' + h(label) + "</label>" + inner + (hint ? '<p class="hint">' + hint + "</p>" : "") + "</div>";
  }

  function stepper(path, o) {
    o = o || {};
    const own = getPath(path);
    const v = own == null && o.base != null ? o.base : own;
    const a = ' data-path="' + h(path) + '"' + (o.base != null ? ' data-base="' + o.base + '"' : "") + (o.min != null ? ' data-min="' + o.min + '"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "");
    return '<span class="stepper"><button type="button" data-act="step" data-d="-1"' + a + ' aria-label="−">' + ic("minus", 16) + "</button>" +
      '<input data-bind="' + h(path) + '" data-kind="num" data-rerender inputmode="decimal" value="' + h(v == null ? "" : v) + '" placeholder="0"' + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") + ">" +
      '<button type="button" data-act="step" data-d="1"' + a + ' aria-label="+">' + ic("plus", 16) + "</button></span>";
  }

  function avatar(name) {
    const w = String(name || "").trim().split(/\s+/).filter(Boolean);
    const s = w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "?").slice(0, 2);
    return '<span class="avatar">' + h(s.toUpperCase()) + "</span>";
  }

  /* His photo, else the pack photo, else the picture; the picture shows if a photo fails. */
  function pickImg(it) {
    const img = it.photo ? '<img data-paper="' + h(it.photo) + '" alt="">'
      : it.img ? '<img src="' + h(it.img) + '" alt=""' + (it.loose ? ' class="is-fresh"' : "") + ' loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : "";
    return img + '<span class="emoji">' + it.icon + "</span>";
  }

  /* ─────────────────────────────────────────────── the start screen ── */

  /* One form system (1 Oct 2026, owner: "make the form UI consistent"): a label above each field,
     one filled control under it. The login mobile's label says Required, a green tick once it is. */
  function shopFields() {
    const st = S.store, ok = M.storeReady(S), bad = ui.needMobile && !ok;
    return '<div class="fld is-mob"><label class="fld-l"><span>' + h(t("fMobile")) + '</span><span class="req' + (ok ? " is-ok" : "") + '">' + (ok ? ic("check", 13) : h(t("required"))) + "</span></label>" +
        '<label class="inx' + (bad ? " is-bad" : "") + '">' + ic("mobile", 18) + inp("store.mobile", { ph: t("phMobile"), type: "tel", mode: "tel", max: 14, ac: "tel-national", label: t("fMobile") }) + "</label>" +
        '<p class="err"' + (bad ? "" : " hidden") + ">" + ic("alert", 15) + "<span>" + h(t("mobNeed")) + "</span></p></div>" +
      '<div class="fld"><label class="fld-l">' + h(t("fGst")) + "</label>" +
        '<label class="inx">' + ic("receipt", 18) + inp("store.gst", { ph: t("phGst"), kind: "upper", upper: true, max: 15, label: t("fGst") }) + "</label></div>" +
      field(t("fType"), setChips("store.type", "str", [
        { v: "distributor", label: t("tDistributor") }, { v: "superstockist", label: t("tSuperstockist") },
        { v: "wholesaler", label: t("tWholesaler") }, { v: "retailer", label: t("tRetailer") },
        { v: "manufacturer", label: t("tManufacturer") }, { v: "other", label: t("tOther") }]) +
        (st.type === "other" ? inp("store.typeOther", { ph: t("fTypeOther"), cls: "wide" }) : "")) +
      field(t("fWarehouses"), stepper("store.warehouses", { min: 0 }));
  }

  /* ── Your files: whatever he drops in goes to FoodBridge as it came (1 Oct 2026, owner) ── */

  function kindOf(p) {
    const n = String(p.name || p.file || "").toLowerCase(), m = String(p.mime || "");
    if (p.kind === "photo" || /^image\//.test(m) || /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/.test(n)) return "image";
    if (p.kind === "voice" || /^audio\//.test(m)) return "voice";
    if (/\.(vcf|vcard)$/.test(n)) return "contacts";
    if (/\.(xlsx?|xlsm|csv|tsv|ods)$/.test(n)) return "sheet";
    if (/\.pdf$/.test(n) || m === "application/pdf") return "pdf";
    return "file";
  }
  const KIND_IC = { image: "image", voice: "mic", contacts: "contacts", sheet: "list", pdf: "file", file: "file" };
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB"; }

  /* The drop area: three files fall into a tray, over and over, to show what to do. */
  function dump(big) {
    return '<label class="dump' + (big ? " is-big" : "") + '">' +
      '<span class="dump-art" aria-hidden="true">' +
        '<i class="doc d1">' + ic("image", 18) + '</i><i class="doc d2">' + ic("list", 18) + '</i><i class="doc d3">' + ic("file", 18) + "</i>" +
        '<i class="tray"></i></span>' +
      "<b>" + h(t("fdDrop")) + "</b><span>" + h(t("fdOr")) + " <u>" + h(t("fdBrowse")) + "</u></span>" +
      (big ? "<small>" + h(t("fdKinds")) + "</small>" : "") +
      '<input type="file" class="sr" data-files multiple></label>';
  }

  function fileRow(p) {
    const k = kindOf(p);
    const pic = k === "image" ? '<img data-paper="' + h(p.id) + '" alt="" onerror="this.remove()">' : "";
    const what = p.kind === "voice" ? t("fdVoice") : p.contacts ? t("fdContacts", { n: p.contacts }) + (p.dup ? " · " + t("fdDup", { n: p.dup }) : "") : t("fdAttached");
    return '<li class="fl"><span class="fl-ic k-' + k + '">' + pic + ic(KIND_IC[k], 18) + "</span>" +
      '<span class="fl-m"><b>' + h(p.name || (p.kind === "voice" ? t("fdVoice") : t("fdPhoto")) + " · " + whenLong(p.at)) + "</b><small>" + (p.size ? h(kb(p.size)) + " · " : "") + h(what) + "</small></span>" +
      (p.kind === "voice" ? '<audio controls preload="none" data-paper-audio="' + h(p.id) + '"></audio>' : "") +
      '<button class="icbtn" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '" title="' + h(t("fdRemove")) + '">' + ic("x", 16) + "</button></li>";
  }
  function fileList(all) {
    const list = S.papers.filter(function (p) { return all || p.kind === "file"; }).slice().reverse();
    return list.length ? '<ul class="fls">' + list.map(fileRow).join("") + "</ul>" : "";
  }

  /* Files go along with a step (1 Oct 2026, owner): he fills the step, part of it or none of it,
     and attaches what he has -- a rate list, a customer list, a photo of the register. At the end
     of each step, before Next, a card asks for that step's paper and lists what is attached; the
     step's header has Attach files too, and a drop anywhere lands on the step in view. On
     Products, Contacts and Stock an attached file lets the team finish the step (M.fromFile). */
  function attachBtn(step, label, cls) {
    return '<label class="btn ' + (cls || "") + '">' + ic("clip", 16) + h(label) + '<input type="file" multiple class="sr" data-fx="' + step + '"></label>';
  }
  /* A Tally list's people arrive already sorted (import.js): then the note does not send him to To sort. */
  function sortedAll(papers) {
    const ids = [].concat.apply([], papers.map(function (p) { return p.people || []; }));
    return ids.length > 0 && ids.every(function (id) { return !S.people[id] || S.people[id].type; });
  }
  /* Contacts, before any file (owner, 1 Oct 2026): what to bring and how, beside a short looping
     clip of it being done -- a party list exported from Tally and attached, a photo of the register
     attached. The step on the left lights up with the clip. Pure CSS (desk.css .ev-*), 10 s a loop. */
  function attachEdu(step) {
    const li = function (n, icon) { return '<li class="e' + n + '"><i>' + ic(icon, 16) + "</i><b>" + h(t("edu" + n + "b")) + "</b></li>"; };
    const rows = [72, 56, 64, 48, 60].map(function (w) { return '<i style="width:' + w + '%"></i>'; }).join("");
    return '<section class="att att-edu"><div class="edu-l"><b class="edu-t">' + h(t("at_" + step + "_t")) + "</b>" +
        '<ol class="edu-steps">' + li(1, "table") + li(2, "camera") + "</ol>" +   // step three is the button, lit with the clip
        attachBtn(step, t("atBtn"), "is-up") + "</div>" +
      '<div class="edu-v" aria-hidden="true">' +
        '<div class="ev-bar"><span></span><span></span><span></span><em class="ev-ta">' + h(t("evTally")) + '</em><em class="ev-tb">' + h(t("evCam")) + "</em></div>" +
        '<div class="ev-a"><div class="ev-rows">' + rows + '</div><div class="ev-menu"><span>' + h(t("evExport")) + "</span><b>" + ic("table", 12) + h(t("evExcel")) + "</b></div>" +
          '<svg class="ev-cur" viewBox="0 0 16 16" width="16" height="16"><path d="M2 1l11 6.5-4.6 1.2L6.5 13z" fill="#10281b" stroke="#fff" stroke-width="1.2"/></svg>' +
          '<div class="ev-file">' + ic("table", 12) + h(t("evFile")) + "</div></div>" +
        '<div class="ev-b"><div class="ev-phone"><div class="ev-page">' + rows + rows + '</div></div><div class="ev-flash"></div><div class="ev-photo"><div class="ev-page">' + rows + "</div></div></div>" +
        '<div class="ev-drop"><span class="ev-d0">' + ic("clip", 13) + h(t("evDrop")) + '</span><span class="ev-da">' + ic("check", 13) + h(t("evOkA")) + '</span><span class="ev-db">' + ic("check", 13) + h(t("evOkB")) + "</span></div>" +
      "</div></section>";
  }
  function attach(step) {
    const mine = M.filesFor(S, step);
    if (step === "people" && !mine.length) return attachEdu(step);
    const found = mine.reduce(function (n, p) { return n + (p.contacts || 0); }, 0);
    return '<section class="att' + (mine.length ? " has" : "") + '">' +
      '<div class="att-h"><span class="att-ic">' + ic("clip", 18) + '</span><div class="att-m"><b>' + h(t("at_" + step + "_t")) + "</b></div>" +
        attachBtn(step, mine.length ? t("atMore") : t("atBtn"), mine.length ? "is-quiet" : "is-g") + "</div>" +
      (mine.length ? '<div class="att-files">' + mine.map(function (p) {
          return '<i class="fx-f k-' + kindOf(p) + '">' + ic(KIND_IC[kindOf(p)], 14) + "<span>" + h(p.name || t("fdPhoto")) + "</span><small>" + (p.size ? h(kb(p.size)) : "") + "</small>" +
            '<button type="button" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '" title="' + h(t("fdRemove")) + '">' + ic("x", 13) + "</button></i>";
        }).join("") + "</div>" +
        (found ? '<p class="att-note">' + ic("contacts", 14) + h(t(sortedAll(mine) ? "atSorted" : "atFound", { n: found })) + "</p>" : M.fromFile(S, step) ? '<p class="att-note">' + ic("circleCheck", 14) + h(t("fxDone_" + step)) + "</p>" : "")
        : "") +   // no sub-text (owner, 1 Oct 2026): the title and the button say it; a drop still works anywhere
      "</section>";
  }

  /* ────────────────────────────────────────────────────── the desk ── */

  /* ── The flow (1 Oct 2026, owner: "very clean, one thing at a time, no cognitive load") ──
     One canvas, one question per screen, one way on. A thin progress line across the top is also
     the way around; the footer holds Back, a running count, and Continue. Heavy steps are split
     into small screens, and a screen that does not apply is not shown (no prices before any
     product; no sorting when nobody is waiting). The store preview waits for the last screen. */
  const FLOW = [
    { id: "store", step: "store" },
    { id: "items.pick", step: "items" },
    { id: "items.prices", step: "items", show: function () { return Object.keys(S.items).length > 0; } },
    { id: "people.add", step: "people" },
    /* One screen to mark who is who, everyone on it, for as long as there is anyone (owner, 1 Oct 2026).
       The days and team screens after it are hidden with their questions (model.js HIDDEN_ASKS). */
    { id: "people.sort", step: "people", show: function () { return S.order.length > 0; } },
    { id: "people.days", step: "people", show: function () { return M.asked("days") && M.peopleOf(S, "shop").length > 0; } },
    { id: "people.team", step: "people", show: function () { return M.asked("team") && S.order.length > 0; } },
    { id: "stock", step: "stock" },
    { id: "rules", step: "rules" },
    /* Files are a step of their own, just before Send (owner, 1 Oct 2026): one place to drop whatever
       helps -- a route chart, bills, a khata page. They are kept as the build's "finish" papers. */
    { id: "files", step: "files" },
    { id: "review", step: "send" },
  ];
  const STEPS6 = SECS.concat(["files", "send"]);
  /* The screens that apply now; the one he is on stays, even if it just stopped applying. */
  function flow() { return FLOW.filter(function (f) { return (f.step === "send" || M.shown(f.step)) && (!f.show || f.id === ui.scr || f.show()); }); }
  function stepOf(id) { const f = FLOW.find(function (x) { return x.id === id; }); return f ? f.step : "store"; }
  function stepName(s) { return s === "send" ? t("pgSend") : s === "files" ? t("pgFiles") : secName(s); }

  /* The steps column (1 Oct 2026, owner, from a reference design): the six steps down the card's
     right side -- an icon tile each, its name, and one line: what it asks while it is to do, what
     he gave once it is done. Done steps are ticked in green, the one he is on is dark, the ones
     ahead are faded. It is also the way around. */
  const STEP_IC = { store: "store", items: "box", people: "contacts", stock: "warehouse", rules: "rules", files: "clip", send: "send" };
  function stepLine(s, P) {
    const p = P[s];
    if (s !== "send" && p.done) {
      if (s === "store") return M.phoneShow(S.store.mobile);
      if (s === "items") return p.n ? t("sItems", { n: p.n }) : t("sFromFile");
      if (s === "people") return [p.shops ? t("sShops", { n: p.shops }) : "", p.staff ? t("sStaff", { n: p.staff }) : ""].filter(Boolean).join(" · ") || t("sFromFile");
      if (s === "stock") return p.n ? t("sStock", { n: p.n }) : t("sFromFile");
      if (s === "rules") return t("sRules", { n: p.n, total: M.RULES_N });
    }
    return t("lsd_" + s);
  }
  /* The white panel's own top row: the logo on the left, language and the menu on the right. */
  function mainTop() {
    const en = S.lang === "en";
    return '<div class="mt"><div class="mt-l">' + LOGO + "<b>" + h(t("appName")) + '</b><span class="saved" id="saved">' + savedHTML() + "</span></div>" +
      '<div class="mt-r"><span class="seg langs" role="group" aria-label="भाषा · Language">' +
        '<button class="' + (en ? "" : "on") + '" data-act="lang" data-v="hi" aria-pressed="' + !en + '">हिंदी</button>' +
        '<button class="' + (en ? "on" : "") + '" data-act="lang" data-v="en" aria-pressed="' + en + '">English</button></span>' +
        '<button class="icbtn" data-act="menu" aria-label="' + h(t("menu")) + '">' + ic("more", 20) + "</button></div></div>";
  }
  /* The steps, in the grey column on the right, centred top to bottom. */
  function sidePanel() {
    return '<aside class="lp"><ol class="lp-steps" id="prog" aria-label="' + h(t("stepsTitle")) + '">' + progressHTML() + "</ol></aside>";
  }

  function progressHTML() {
    const P = M.progress(CAT, S), cur = stepOf(ui.scr);
    return STEPS6.map(function (s) {
      const on = s === cur, d = s === "files" ? M.filesFor(S, "finish").length > 0 : s !== "send" && P[s].done;
      return '<li class="' + (on ? "on" : "") + (d ? " is-done" : "") + '"><button class="ls" data-act="goStep" data-to="' + s + '"' + (on ? ' aria-current="step"' : "") + ">" +
        '<span class="ls-ic">' + ic(d && !on ? "check" : STEP_IC[s], 18) + '</span><span class="ls-m"><b>' + h(stepName(s)) + "</b></span></button></li>";   // the name only (owner, 1 Oct 2026); stepLine kept for later
    }).join("");
  }

  function screenHTML() {
    const id = SCR[ui.scr] ? ui.scr : "store", d = SCR[id];
    const step = stepOf(id);
    return '<main class="canvas" id="main" data-keep="main-' + id + '"><div class="cv">' +
        "<h1>" + h(d.t()) + "</h1>" +   // one title, nothing above or under it (owner, 1 Oct 2026)
        '<div class="cv-b">' + d.b() + "</div></div></main>" +
      '<footer class="foot"><div class="foot-in" id="foot">' + footHTML() + "</div></footer>";
  }
  /* The footer: Back, a running count, and the one way on -- named for where it goes. */
  function footHTML() {
    const id = SCR[ui.scr] ? ui.scr : "store", d = SCR[id], step = stepOf(id);
    const f = flow(), i = f.findIndex(function (x) { return x.id === id; }), next = f[i + 1];
    const cta = id === "review"
      ? '<button class="cta" data-act="build"' + (ui.building ? " disabled" : "") + ">" + ic("send", 18) + h(t(ui.building ? "fiWorking" : "fiBuild")) + "</button>"
      : '<button class="cta" data-act="next">' + h(next && next.step !== step ? t("nextTo", { s: stepName(next.step) }) : next && SCR[next.id] && SCR[next.id].go ? SCR[next.id].go() : t("ctaContinue")) + ic("chev", 18) + "</button>";
    /* Not on Contacts once real contacts are in: the footer's room goes to the count and the way on. */
    const sample = M.SAMPLE_STEPS.indexOf(step) >= 0 && !(step === "people" && S.order.length)   // sample data for the step in view, on every step (owner, 1 Oct 2026)
      ? '<button class="link foot-sample" data-act="sampleAsk" data-step="' + step + '">' + ic("sparkle", 15) + h(t("stSample")) + "</button>" : "";
    return '<span class="foot-l">' + (i > 0 ? '<button class="btn is-quiet" data-act="back">' + ic("back", 16) + h(t("back")) + "</button>" : "") +
        '<span class="foot-sum">' + h(d.s ? d.s() : "") + "</span></span>" +
      '<span class="foot-r">' + sample + cta + "</span>";   // sample data beside the button (owner, 1 Oct 2026)
  }

  /* The whole app is one card of a fixed size (owner, 1 Oct 2026), after a reference design: a white
     work panel on the left -- the logo and language along its top, the footer along its bottom, only
     the screen between them scrolling -- and the steps in a grey column on the right. Short screens
     keep a centred column; the grid and the tables use the panel's width. */
  function deskView() {
    const d = SCR[ui.scr] || SCR.store;
    return '<div class="shell"><div class="app-card' + (d.wide ? " is-wide" : "") + '">' + '<div class="app-main">' + mainTop() + screenHTML() + "</div>" + sidePanel() + "</div></div>";
  }

  /* After a change that doesn't redraw the screen: the progress line and the footer's count. */
  function refreshChrome() {
    const p = document.getElementById("prog"); if (p) p.innerHTML = progressHTML();
    const f = document.getElementById("foot"); if (f) f.innerHTML = footHTML();
  }
  function refreshSide() { refreshChrome(); }
  function refreshRail() { refreshChrome(); }
  function refreshReady() { refreshChrome(); }

  const SCR = {};

  SCR.store = {
    t: function () { return t("stTitle10"); },
    b: function () {
      return '<div class="form">' + shopFields() + "</div>";   // no attach card, and sample data is in the footer (owner, 1 Oct 2026)
    },
  };

  /* ── Products: groups | grid, and what he chose collecting on the right ── */

  function allIds() {
    return CAT.items.map(function (x) { return x.id; }).concat(Object.keys(S.customItems));
  }
  function groupIds(by, id) {
    const all = CAT.items.concat(Object.keys(S.customItems).map(function (k) { return Object.assign({ id: k }, S.customItems[k]); }));
    if (id === "mine") return Object.keys(S.items);
    if (id === "all") return allIds();
    if (by === "co") return all.filter(function (x) { return x.company === id; }).map(function (x) { return x.id; });
    const a = (CAT.aisles || []).find(function (x) { return x.id === id; });
    return a ? all.filter(function (x) { return a.cats.indexOf(x.cat) >= 0; }).map(function (x) { return x.id; }) : [];
  }
  function chosenIn(ids) { return ids.filter(function (id) { return S.items[id]; }).length; }

  function groups() {
    if (ui.by === "co") return M.companyList(CAT, S).map(function (c) {
      const ids = groupIds("co", c.id);
      return ids.length ? { id: c.id, name: c.short, ids: ids } : null;
    }).filter(Boolean);
    return CAT.aisles.filter(function (a) { return a.fresh; }).concat(CAT.aisles.filter(function (a) { return !a.fresh; })).map(function (a) {
      return { id: a.id, name: S.lang === "en" ? a.en : a.hi, ids: groupIds("aisle", a.id), fresh: !!a.fresh };
    });
  }
  function curGroup() {
    const gs = groups();
    if (ui.group === "mine" || ui.group === "all") return ui.group;
    return gs.some(function (g) { return g.id === ui.group; }) ? ui.group : gs[0] ? gs[0].id : "all";
  }

  /* The groups as one row of chips: brand or category, and each chip's count of what he chose. */
  function chipsHTML() {
    const cur = ui.itemsQ.trim() ? "" : curGroup();
    const chip = function (id, name, ids) {
      const n = chosenIn(ids);
      return '<button class="gchip' + (cur === id ? " on" : "") + '" data-act="group" data-id="' + h(id) + '">' + h(name) + (n ? "<i>" + n + "</i>" : "") + "</button>";
    };
    return '<span class="seg by">' +
        '<button class="' + (ui.by === "co" ? "on" : "") + '" data-act="by" data-v="co">' + h(t("iByCompany")) + "</button>" +
        '<button class="' + (ui.by === "aisle" ? "on" : "") + '" data-act="by" data-v="aisle">' + h(t("iByType")) + "</button></span>" +
      '<div class="gchips" data-keep="chips">' + chip("all", t("pkAll"), allIds()) + groups().map(function (g) { return chip(g.id, g.name, g.ids); }).join("") + "</div>";
  }

  function shownIds() {
    const q = ui.itemsQ.trim();
    if (q) return M.search(CAT, S, q, null);
    return groupIds(ui.by, curGroup());
  }

  function pickCard(it) {
    const price = it.loose ? (it.sell != null ? rupee(it.sell) + " " + t("per_" + it.per) : t("per_" + it.per)) : it.mrp ? "MRP " + rupee(it.mrp) : "";
    return '<button class="pick' + (it.on ? " on" : "") + '" data-act="pick" data-id="' + h(it.id) + '" aria-pressed="' + it.on + '">' +
      '<span class="pick-img">' + pickImg(it) + '<span class="tick">' + ic("check", 13) + "</span></span>" +
      '<span class="pick-n">' + h(nm(it)) + '</span><span class="pick-s">' + h(it.loose ? (S.lang === "en" && it.hi ? it.hi : "") : it.pack) + (price ? " · " + h(price) : "") + "</span></button>";
  }

  function pickBarHTML(ids) {
    const n = chosenIn(ids);
    return "<span>" + h(t("foundN", { n: ids.length })) + (n ? " · " + h(t("iChosen", { n: n })) : "") + "</span>" +
      (ids.length ? '<button class="link" data-act="pickAll">' + h(n === ids.length ? t("iClearAll") : t("iSelectAll")) + "</button>" : "");
  }

  function gridHTML() {
    const ids = shownIds().slice(0, 240);
    ui.shown = ids;
    if (!ids.length) {
      return '<div class="empty"><p>' + h(ui.group === "mine" && !ui.itemsQ.trim() ? t("ypEmpty") : t("iEmpty")) + "</p>" +
        (ui.itemsQ.trim() ? '<button class="btn" data-act="newItem">' + ic("plus", 16) + h(t("iNew")) + "</button>" : "") + "</div>";
    }
    return '<div class="picks">' + ids.map(function (id) { return M.item(CAT, S, id); }).filter(Boolean).map(pickCard).join("") + "</div>";
  }

  /* Your products, as a price list: what he chose, the MRP, and his price to the customer, typed
     in place. What still needs a price comes first. (Until 1 Oct 2026 this list sat on the right.) */
  function priceTable() {
    const its = M.chosenItems(CAT, S).reverse();
    const need = function (it) { return it.sell == null ? 0 : 1; };
    its.sort(function (a, b) { return need(a) - need(b); });
    if (!its.length) return '<div class="empty"><p>' + h(t("ypEmpty")) + "</p></div>";
    return '<table class="tbl prices"><thead><tr><th></th><th>' + h(t("colProduct")) + '</th><th class="r">' + h(t("colMrp")) + '</th><th class="r">' + h(t("colCust")) + "</th><th></th></tr></thead><tbody>" +
      its.map(function (it) {
        const p = "items." + it.id + ".";
        return '<tr class="pr-r' + (it.sell == null ? " is-need" : "") + '"><td class="im"><span class="pick-img sm">' + pickImg(it) + "</span></td>" +
          '<td class="nm"><button class="nm-b" data-act="item" data-id="' + h(it.id) + '"><b>' + h(nm(it)) + "</b><small>" + h(packLabel(it)) + "</small></button></td>" +
          '<td class="r num">' + (it.mrp ? h(rupee(it.mrp)) : "—") + "</td>" +
          '<td class="r"><label class="price-in"><span>₹</span><input class="in num" data-bind="' + p + 'sell" data-kind="num" data-touch="' + p + 'touched.sell" inputmode="decimal" value="' + h(it.sell == null ? "" : it.sell) + '" placeholder="' + h(t("prPh")) + '" aria-label="' + h(t("iShopPrice")) + " · " + h(nm(it)) + '"><small>' + h(it.loose ? t("per_" + it.per).replace(/^per /, "/ ") : t("ypPiece")) + "</small></label></td>" +
          '<td class="x"><button class="icbtn" data-act="pick" data-id="' + h(it.id) + '" aria-label="' + h(t("remove")) + '" title="' + h(t("remove")) + '">' + ic("x", 15) + "</button></td></tr>";
      }).join("") + "</tbody></table>";
  }

  SCR["items.pick"] = {
    wide: true,
    t: function () { return t("pkT"); }, l: function () { return t("pkL"); },
    s: function () { const n = Object.keys(S.items).length; return n ? t("iChosen", { n: n }) : ""; },
    b: function () {
      return '<label class="search big">' + ic("search", 18) +
          '<input type="search" id="itemsQ" data-q="itemsQ" value="' + h(ui.itemsQ) + '" placeholder="' + h(t("iSearch")) + '" aria-label="' + h(t("iSearch")) + '" autocomplete="off"><kbd>/</kbd></label>' +
        '<div class="chipbar" id="chips">' + chipsHTML() + "</div>" +
        '<div class="pickline" id="pickbar">' + pickBarHTML(shownIds()) + "</div>" +
        '<div id="grid">' + gridHTML() + "</div>" +
        '<p class="more-l"><button class="link" data-act="newItem">' + ic("plus", 15) + h(t("pkNew")) + "</button></p>" + attach("items");
    },
  };
  SCR["items.prices"] = {
    wide: true,
    t: function () { return t("prT"); }, l: function () { return t("ypHint"); },
    s: function () { const n = M.chosenItems(CAT, S).filter(function (it) { return it.sell == null; }).length; return n ? t("iNeedPrice", { n: n }) : t("prAll"); },
    b: function () { return priceTable(); },
  };

  /* After a tick: the card, the counts, the list on the right -- in place, so the pictures don't reload. */
  function afterPick(ids) {
    ids.forEach(function (id) {
      const card = document.querySelector('.pick[data-id="' + CSS.escape(id) + '"]');
      if (card) { const on = !!S.items[id]; card.classList.toggle("on", on); card.setAttribute("aria-pressed", on); }
    });
    const g = document.getElementById("chips");
    if (g) { const k = g.querySelector(".gchips"), left = k ? k.scrollLeft : 0; g.innerHTML = chipsHTML(); const k2 = g.querySelector(".gchips"); if (k2) k2.scrollLeft = left; }
    const pb = document.getElementById("pickbar");
    if (pb) pb.innerHTML = pickBarHTML(shownIds());
    if (ui.scr === "items.prices") { const gr = document.getElementById("main"); if (gr) render(); }
    refreshSide();
    refreshRail();
    hydrate();
  }

  /* ── Contacts ── */

  const TAGS = [["shop", "pShop", "1"], ["staff", "pStaff", "2"], ["supplier", "pSupplier", "3"]];

  function matchQ(p) {
    const q = (ui.peopleQ || "").toLowerCase().trim();
    return !q || (p.name + " " + p.phone).toLowerCase().indexOf(q) >= 0 || M.phone10(p.phone).indexOf(q.replace(/\D/g, "") || "~") >= 0;
  }
  function sortList() {
    /* Everyone, marked or not: this is the only place he says who is who, so he can change any of it. */
    return S.order.map(function (id) { return S.people[id]; }).filter(Boolean).filter(matchQ);
  }

  /* Just the three marks, in the owner's order, and a way to take the contact off (1 Oct 2026).
     No key badges and no "not needed" mark: a contact he doesn't want, he removes. The keys 1-3
     still work, unshown. */
  const MARKS = [["shop", "pShop"], ["supplier", "pSupplier"], ["staff", "pStaff"]];
  function tagBtns(p) {
    return '<span class="tags">' + MARKS.map(function (x) {
      const on = p.type === x[0];
      return '<button class="tag ' + x[0] + (on ? " on" : "") + '" data-act="sort" data-id="' + h(p.id) + '" data-v="' + x[0] + '" aria-pressed="' + on + '">' + h(t(x[1])) + "</button>";
    }).join("") + "</span>";
  }
  function rmBtn(p) {
    return '<button class="icbtn rm" data-act="rmPerson" data-id="' + h(p.id) + '" aria-label="' + h(t("pRemove")) + '" title="' + h(t("pRemove")) + '">' + ic("trash", 16) + "</button>";
  }

  function nameCell(p, sub, warn) {
    return '<td class="nm"><button class="nm-b" data-act="person" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b>" +
      (sub != null ? '<small class="' + (warn ? "warn" : "") + '">' + h(sub) + "</small>" : "") + "</button></td>";
  }

  function addRow(type) {
    if (!ui.adding) return "";
    return '<div class="addrow">' + ic("user", 16) +
      '<input id="addName" class="in" placeholder="' + h(t("pName")) + '" autocomplete="off">' +
      '<input id="addPhone" class="in" placeholder="' + h(t("pPhone")) + '" inputmode="tel" autocomplete="off">' +
      '<select id="addType" class="in">' + [["", t("pTabSort")], ["shop", t("pShop")], ["staff", t("pStaff")], ["supplier", t("pSupplier")]].map(function (o) {
        return '<option value="' + o[0] + '"' + ((type || "") === o[0] ? " selected" : "") + ">" + h(o[1]) + "</option>";
      }).join("") + "</select>" +
      '<button class="btn is-g" data-act="addPerson">' + ic("plus", 16) + h(t("addPersonGo")) + "</button>" +
      '<button class="icbtn" data-act="addClose" aria-label="' + h(t("close")) + '">' + ic("x", 16) + "</button></div>";
  }

  function sortTable() {
    const rows = sortList();
    const left = M.unsorted(S).length;
    if (!rows.length) {
      if (S.order.length && !ui.peopleQ) return '<div class="callout">' + ic("circleCheck", 18) + "<p>" + h(t("pAllSorted")) + "</p></div>";
      if (ui.peopleQ) return '<div class="empty"><p>' + h(t("gsNoFound")) + "</p></div>";
      return '<div class="empty big">' + ic("contacts", 28) + "<h3>" + h(t("sortEmptyT")) + "</h3><p>" + h(t("sortEmptyS")) + "</p>" + '<label class="btn is-g">' + ic("file", 16) + h(t("importFile")) + '<input type="file" class="sr" data-files multiple accept=".vcf,.vcard,.csv,.tsv,.txt,.xlsx"></label> ' +
        '<button class="btn" data-act="addOpen">' + ic("pen", 16) + h(t("pType")) + "</button></div>";
    }
    if (!ui.sortFocus || !rows.some(function (p) { return p.id === ui.sortFocus; })) {
      const first = rows.find(function (p) { return !p.type; }) || rows[0];
      ui.sortFocus = first.id;
    }
    return '<div class="sortbar">' +
        (left > 1 ? '<button class="btn is-g" data-act="sortAll">' + ic("users", 16) + h(t("pRestCustomers", { n: left })) + "</button>" : "") +
        (ui.lastSorted.length ? '<button class="btn is-quiet" data-act="undoSort">' + ic("undo", 16) + h(t("pUndo")) + "</button>" : "") + "</div>" +
      '<table class="tbl sort"><thead><tr><th>' + h(t("colName")) + "</th><th>" + h(t("colNumber")) + "</th><th></th><th></th></tr></thead><tbody>" +
      rows.map(function (p) {
        return '<tr class="' + (p.id === ui.sortFocus ? "focus" : "") + (p.type ? " is-tagged" : "") + '" data-row="' + h(p.id) + '">' +
          nameCell(p, null) + '<td class="num">' + h(M.phoneShow(p.phone)) + "</td>" +
          /* No "looks like" (owner, 1 Oct 2026): no guess column and no hinted tag; he marks, plainly. */
          '<td class="r">' + tagBtns(p) + '</td><td class="rmc">' + rmBtn(p) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function dayCells(p) {
    return M.DAYS.map(function (d) {
      const on = (p.days || []).indexOf(d) >= 0;
      return '<td class="dc"><button class="day' + (on ? " on" : "") + '" data-day="' + d + '" data-pid="' + h(p.id) + '" aria-pressed="' + on + '" aria-label="' + h(dayName(d)) + '"></button></td>';
    }).join("");
  }
  function dayHeads() { return M.DAYS.map(function (d) { return '<th class="dc">' + h(dayName(d)) + "</th>"; }).join(""); }

  function sel(path, opts, cur) {
    return '<select class="in" data-bind="' + h(path) + '" data-kind="auto">' + '<option value="">' + h(t("pickOne")) + "</option>" + opts.map(function (o) {
      return '<option value="' + h(o.v) + '"' + (cur != null && String(cur) === String(o.v) ? " selected" : "") + ">" + h(o.label) + "</option>";
    }).join("") + "</select>";
  }

  function areas() {
    const set = {};
    (S.store.areas || []).forEach(function (a) { if (a) set[a] = 1; });
    M.peopleOf(S, "shop").forEach(function (p) { if (p.area) set[p.area] = 1; });
    return Object.keys(set).sort();
  }

  /* "Same area, same days": an area where some customers have days and some don't. */
  function areaHints() {
    const shops = M.peopleOf(S, "shop");
    return areas().map(function (a) {
      const inA = shops.filter(function (p) { return p.area === a; });
      const withD = inA.filter(function (p) { return (p.days || []).length; });
      const without = inA.filter(function (p) { return !(p.days || []).length; });
      if (!withD.length || !without.length) return null;
      const tally = {};
      withD.forEach(function (p) { const k = M.DAYS.filter(function (d) { return p.days.indexOf(d) >= 0; }).join(","); tally[k] = (tally[k] || 0) + 1; });
      const days = Object.keys(tally).sort(function (x, y) { return tally[y] - tally[x]; })[0].split(",");
      return { area: a, days: days, n: without.length };
    }).filter(Boolean);
  }

  function custTable() {
    const shops = M.peopleOf(S, "shop").filter(matchQ);
    if (!shops.length) return '<div class="empty"><p>' + h(t("shEmpty")) + "</p></div>";
    const pays = [{ v: "cash", label: t("payCash") }, { v: 7, label: t("payDays", { n: 7 }) }, { v: 15, label: t("payDays", { n: 15 }) }, { v: 30, label: t("payDays", { n: 30 }) }];
    const hints = areaHints();
    return '<datalist id="areaList">' + areas().map(function (a) { return '<option value="' + h(a) + '">'; }).join("") + "</datalist>" +
      '<table class="tbl cust"><thead><tr><th class="stc"></th><th>' + h(t("colName")) + "</th><th>" + h(t("colArea")) + "</th>" + dayHeads() +
        "<th>" + h(t("colPays")) + "</th></tr></thead><tbody>" +
      shops.map(function (p) {
        return "<tr>" +
          '<td class="stc"><button class="star' + (p.big ? " on" : "") + '" data-act="set" data-path="people.' + h(p.id) + '.big" data-kind="flip" aria-pressed="' + !!p.big + '" aria-label="' + h(t("shBig")) + '">' + ic("star", 16) + "</button></td>" +
          nameCell(p, M.phoneShow(p.phone) || t("gap_shopNoPhone"), M.phone10(p.phone).length !== 10) +
          '<td class="ar">' + inp("people." + p.id + ".area", { list: "areaList", ph: t("noArea"), cls: "area", label: t("colArea") }) + "</td>" +
          dayCells(p) +
          '<td class="py">' + sel("people." + p.id + ".pay", pays, p.pay) + "</td></tr>";   // what they owe, and the rest: the name opens them
      }).join("") + "</tbody></table>" +
      (hints.length ? '<div class="hints">' + hints.map(function (x) {
        return '<button class="btn is-quiet" data-act="sameArea" data-area="' + h(x.area) + '" data-days="' + x.days.join(",") + '">' + ic("calendar", 15) +
          h(t("sameArea", { area: x.area, days: x.days.map(dayName).join(", "), n: x.n })) + "</button>";
      }).join("") + "</div>" : "");
  }

  function roleOpts() {
    return [{ v: "salesman", label: t("roleSalesman") }, { v: "delivery", label: t("roleDelivery") }, { v: "supervisor", label: t("roleSupervisor") }, { v: "office", label: t("roleOffice") }];
  }

  function staffTable() {
    const staff = M.peopleOf(S, "staff").filter(matchQ);
    if (!staff.length) {
      return '<div class="empty"><p>' + h(t("stEmpty")) + "</p>" +
        (S.skipped.staff ? '<p class="ok">' + ic("check", 16) + h(t("stNone")) + "</p>" : '<button class="btn" data-act="skip" data-step="staff">' + h(t("stNone")) + "</button>") + "</div>";
    }
    return '<table class="tbl staff"><thead><tr><th>' + h(t("colName")) + "</th><th>" + h(t("colJob")) + "</th>" + dayHeads() + "<th>" + h(t("colVehicle")) + '</th><th class="c">' + h(t("colCash")) + "</th></tr></thead><tbody>" +
      staff.map(function (p) {
        return "<tr>" + nameCell(p, M.phoneShow(p.phone)) +
          "<td>" + sel("people." + p.id + ".role", roleOpts(), p.role) + "</td>" + dayCells(p) +
          "<td>" + inp("people." + p.id + ".vehicle", { kind: "upper", upper: true, ph: "MH 02 AB 1234", cls: "veh", label: t("colVehicle") }) + "</td>" +
          '<td class="c"><input type="checkbox" class="cb" data-act="flipCash" data-id="' + h(p.id) + '"' + (p.cash ? " checked" : "") + ' aria-label="' + h(t("colCash")) + '"></td></tr>';
      }).join("") + "</tbody></table>";
  }

  function companyOpts() {
    let cos = M.companyList(CAT, S).filter(function (c) { return S.companies[c.id]; });
    if (!cos.length) cos = M.companyList(CAT, S);
    return cos.map(function (c) { return { v: c.id, label: c.short }; });
  }

  function supTable() {
    const sups = M.peopleOf(S, "supplier").filter(matchQ);
    if (!sups.length) {
      return '<div class="empty"><p>' + h(t("suEmpty")) + "</p>" +
        (S.skipped.suppliers ? '<p class="ok">' + ic("check", 16) + h(t("suNone")) + "</p>" : '<button class="btn" data-act="skip" data-step="suppliers">' + h(t("suNone")) + "</button>") + "</div>";
    }
    const leads = [1, 2, 3, 7].map(function (n) { return { v: n, label: t("daysN", { n: n }) }; });
    /* Companies and his code with them are not asked (owner, 1 Oct 2026). */
    return '<table class="tbl sup"><thead><tr><th>' + h(t("colName")) + "</th><th>" + h(t("colLead")) + '</th><th class="r">' + h(t("colOwe")) + "</th></tr></thead><tbody>" +
      sups.map(function (p) {
        return "<tr>" + nameCell(p, M.phoneShow(p.phone)) +
          "<td>" + sel("people." + p.id + ".lead", leads, p.lead) + "</td>" +
          '<td class="r ow">' + inp("people." + p.id + ".owe", { kind: "num", mode: "numeric", ph: "₹", cls: "num", label: t("colOwe") }) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  /* Bring people in: a file (contacts, Excel, a photo of the register) or names typed. */
  function filesChips(step) {
    const mine = M.filesFor(S, step);
    return mine.length ? '<div class="att-files">' + mine.map(function (p) {
      return '<i class="fx-f k-' + kindOf(p) + '">' + ic(KIND_IC[kindOf(p)], 14) + "<span>" + h(p.name || t("fdPhoto")) + "</span><small>" + (p.size ? h(kb(p.size)) : "") + "</small>" +
        '<button type="button" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '" title="' + h(t("fdRemove")) + '">' + ic("x", 13) + "</button></i>";
    }).join("") + "</div>" : "";
  }
  function peopleSum() {
    const P = M.progress(CAT, S).people;
    return [S.order.length ? t("sumPeople", { n: S.order.length }) : "", P.left ? t("pToSort", { n: P.left }) : ""].filter(Boolean).join(" · ");
  }

  /* ── His phone's contacts, over a QR code (1 Oct 2026) ──
     The code is fresh for each visit and only on this screen. The phone page (../send/) posts
     what he picks to the bridge under it (zoho-function/handoff.js); this page asks every few
     seconds while the screen is open and in view, and stops after a quiet quarter of an hour. */
  const GG = window.SB_GOOGLE;   // Google Contacts, when switched on (gcontacts.js): no phone needed
  if (GG) GG.preload();
  /* Two phone links, each with its own code: contacts on Contacts, photos on Files (1 Oct 2026). HO is
     the one for the screen in view; each polls only while its screen is open, in view, and awake. */
  function newHo(mode) { return { mode: mode, code: "", opened: false, got: 0, off: 0, since: 0, timer: null, busy: false }; }
  const HOS = { "people.add": newHo("contacts"), files: newHo("photos") };
  let HO = HOS["people.add"];
  function hoPick() { HO = HOS[ui.scr] || HO; return HO; }
  function hoCode(o) {
    o = o || hoPick();
    if (!o.code) {
      const a = new Uint8Array(12);
      crypto.getRandomValues(a);
      o.code = Array.from(a, function (b) { return "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]; }).join("");
      o.since = Date.now();
    }
    return o.code;
  }
  function phoneUrl() {
    const o = hoPick();
    return new URL("send/#c=" + hoCode(o) + (o.mode === "photos" ? "&m=photos" : "") + (S.lang === "hi" ? "&l=hi" : ""), BASE).href;
  }
  function qrSvg(text) {
    if (!window.SB_QR) return "";
    const q = window.SB_QR.create(text, { errorCorrectionLevel: "Q" }).modules, n = q.size;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.data[y * n + x]) d += "M" + x + " " + y + "h1v1h-1z";
    /* The FoodBridge mark in the middle: Q-level correction reads through it. */
    const m = Math.round(n * 0.22), o = (n - m) / 2;
    return '<svg viewBox="-2 -2 ' + (n + 4) + " " + (n + 4) + '" shape-rendering="crispEdges"><path d="' + d + '" fill="#10281b"/>' +
      '<rect x="' + (o - 0.6) + '" y="' + (o - 0.6) + '" width="' + (m + 1.2) + '" height="' + (m + 1.2) + '" rx="1.4" fill="#fff"/>' +
      '<image href="' + BASE + 'foodbridge-mark-green.png?v=1" x="' + o + '" y="' + o + '" width="' + m + '" height="' + m + '"/></svg>';
  }
  function hoActive(o) { return view === "desk" && HOS[ui.scr] === o && !document.hidden && Date.now() - o.since < 15 * 60e3; }
  function hoStatus() {
    const o = hoPick(), pics = o.mode === "photos";
    if (Date.now() - o.since >= 15 * 60e3 && o.since) return '<span class="ho-dot is-off"></span>' + h(t("hoSleep")) + ' <button class="link" data-act="hoWake">' + h(t("hoAgain")) + "</button>";
    if (o.off >= 2) return '<span class="ho-dot is-off"></span>' + h(t("hoOff"));
    if (o.got) return '<span class="ho-dot is-ok"></span><b>' + h(t(pics ? "hpGot" : "hoGot", { n: o.got })) + "</b>";
    if (o.opened) return '<span class="ho-dot is-live"></span>' + h(t(pics ? "hpOpen" : "hoOpen"));
    return '<span class="ho-dot is-live"></span>' + h(t("hoWait"));
  }
  function hoPaint() { const el = document.getElementById("hoSt"); if (el && HOS[ui.scr]) el.innerHTML = hoStatus(); }
  function b64File(f) {
    const bin = atob(f.data || ""), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new File([a], f.name || "photo.jpg", { type: f.type || "image/jpeg" });
  }
  async function hoTick(o) {
    if (!hoActive(o)) { clearInterval(o.timer); o.timer = null; hoPaint(); return; }
    if (o.busy) return;
    o.busy = true;
    try {
      let more = true;
      while (more) {
        const r = await fetch(OB.bridge() + "/api/handoff?code=" + hoCode(o), { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        more = !!j.more;
        o.off = 0;
        if (j.opened && !o.opened) { o.opened = true; o.since = Date.now(); }
        if (j.people && j.people.length) {
          o.since = Date.now();
          const n = addList(j.people, "contact");
          o.got += n.added;
          render();
          toast(t("hoGot", { n: n.added }) + (n.dup ? " · " + t("pDup", { n: n.dup }) : ""));
        }
        /* Photos from his phone land in Files, kept as they came, like a file dropped here. */
        if (j.files && j.files.length) {
          o.since = Date.now();
          o.got += j.files.length;
          await takeFiles(j.files.map(b64File), "finish");
        }
      }
    } catch (e) { o.off++; }
    o.busy = false;
    hoPaint();
  }
  function hoSync() {
    const o = HOS[ui.scr];
    if (o && hoActive(o) && !o.timer) { o.timer = setInterval(function () { hoTick(o); }, 3000); hoTick(o); }
  }
  document.addEventListener("visibilitychange", hoSync);

  /* People from a list (the phone, a paste): new ones wait to be sorted, ones he has are skipped. */
  function addList(list, src) {
    let added = 0, dup = 0;
    list.forEach(function (c) {
      if (!c.name && !c.phone) return;
      const r = M.addPerson(S, { name: c.name || c.phone, phone: M.phone10(c.phone) || c.phone || "", src: src, type: c.type || null });
      if (r.dup) dup++; else added++;
    });
    save();
    return { added: added, dup: dup };
  }
  function takePaste(text) {
    const list = IMP.fromText(text);
    if (!list.length) { toast(t("pasteNone")); return; }
    const n = addList(list, "paste");
    render();
    toast(t("pasted", { n: n.added }) + (n.dup ? " · " + t("pDup", { n: n.dup }) : ""));
  }

  /* Files: what kind of paper helps, a big drop area that shows how, a voice note if that is easier,
     and every file he has added anywhere -- each removable. */
  /* The drop area teaches where files come from and what to do with them (owner, 1 Oct 2026: "help,
     not look fancy"; "Downloads" was nobody's starting point). Three beats of 4 s: a rate list a company
     sent on WhatsApp, bills exported from Tally, a route chart that came by email -- each dragged into
     Store Builder, which says Added. Paper (khata, the wall chart) is the phone card above it. CSS only. */
  function dropScene() {
    const cur = '<svg class="dz-cur" viewBox="0 0 16 16" width="15" height="15"><path d="M2 1l11 6.5-4.6 1.2L6.5 13z" fill="#10281b" stroke="#fff" stroke-width="1.2"/></svg>';
    const g = function (n, icon, name) { return '<span class="dz-g g' + n + '">' + ic(icon, 13) + "<em>" + h(name) + "</em>" + cur + "</span>"; };
    return '<label class="dump is-big is-scene"><span class="dz" aria-hidden="true">' +
        /* WhatsApp: a company's message with its rate list */
        '<span class="dz-src s1"><span class="dz-wa-h">' + h(t("dzWaFrom")) + '</span><span class="dz-wa-b"><span class="dz-wa-m">' + h(t("dzWaMsg")) + "</span>" +
          '<span class="dz-wa-doc">' + ic("file", 14) + "<em>" + h(t("dzF1")) + "</em></span></span><i class=\"dz-tag\">WhatsApp</i></span>" +
        /* Tally: Export › Excel */
        '<span class="dz-src s2"><span class="dz-bar"><i></i><i></i><i></i><em>Tally</em></span><span class="dz-rows"><i></i><i></i><i></i><i></i></span>' +
          '<span class="dz-menu"><span>' + h(t("evExport")) + "</span><b>" + ic("table", 12) + "Excel</b></span>" +
          '<span class="dz-out">' + ic("table", 13) + "<em>" + h(t("dzF2")) + "</em></span></span>" +
        /* Email: a message with the route chart attached */
        '<span class="dz-src s3"><span class="dz-bar"><i></i><i></i><i></i><em>' + h(t("dzMail")) + '</em></span><span class="dz-mail"><b>' + h(t("dzMailFrom")) + "</b><small>" + h(t("dzMailSub")) + "</small></span>" +
          '<span class="dz-att">' + ic("map", 13) + "<em>" + h(t("dzF3")) + "</em></span></span>" +
        '<span class="dz-tray"><span class="dz-t0">' + ic("clip", 14) + h(t("dzHere")) + '</span><span class="dz-t1">' + ic("check", 14) + h(t("dzAdded")) + "</span></span>" +
        g(1, "file", t("dzF1")) + g(2, "table", t("dzF2")) + g(3, "map", t("dzF3")) +
      "</span>" +
      "<b>" + h(t("dzDrag")) + "</b><span>" + h(t("fdOr")) + " <u>" + h(t("fdBrowse")) + "</u></span>" +
      '<input type="file" class="sr" data-files multiple></label>';
  }

  /* Files: what helps; paper by the phone (a photo straight from its camera, through the same kind of
     QR as Contacts); files on this computer dropped; a voice note; and everything he has added. */
  SCR.files = {
    t: function () { return t("flT"); },
    s: function () { return S.papers.length ? t("flN", { n: S.papers.length }) : ""; },
    b: function () {
      const kinds = [["note", "fkKhata"], ["map", "fkRoute"], ["receipt", "fkBills"], ["list", "fkRates"]];
      return '<p class="fkinds">' + kinds.map(function (k) { return "<span>" + ic(k[0], 15) + h(t(k[1])) + "</span>"; }).join("") + "</p>" +
        '<div class="ho is-photo"><div class="ho-qr" aria-hidden="true" data-url="' + h(phoneUrl()) + '">' + qrSvg(phoneUrl()) + "</div>" +
          '<div class="ho-m"><b>' + h(t("hpT")) + "</b>" +
            '<ol class="ho-steps"><li><i>1</i>' + h(t("adStep1")) + "</li><li><i>2</i>" + h(t("hpStep2")) + "</li><li><i>3</i>" + h(t("adStep3")) + "</li></ol>" +
            '<div class="ho-st" id="hoSt">' + hoStatus() + "</div></div></div>" +
        '<div class="or-div"><span>' + h(t("orWord")) + "</span></div>" +
        /* Once files are in, the lesson has done its job: one line to drop more, and the files as chips,
           so the card still fits without scrolling. */
        (S.papers.length ? '<label class="dump is-line">' + ic("clip", 16) + "<b>" + h(t("dzMore")) + "</b><span>" + h(t("fdOr")) + " <u>" + h(t("fdBrowse")) + "</u></span>" +
            '<input type="file" class="sr" data-files multiple></label>' : dropScene()) +
        (canRecord ? '<p class="fl-voice">' + (ui.rec ? '<button class="btn is-bad" data-act="recStop">' + ic("stop", 16) + '<span id="recT">' + h(t("paRecording", { s: Math.round((Date.now() - ui.rec.started) / 1000) })) + "</span></button>"
          : '<button class="link" data-act="recStart">' + ic("mic", 15) + h(t("paVoice")) + "</button>") + "</p>" : "") +
        (S.papers.length ? '<div class="fl-chips">' + S.papers.slice().reverse().map(function (p) {
          const k = kindOf(p);
          return '<i class="fx-f k-' + k + '">' + ic(KIND_IC[k], 14) + "<span>" + h(p.name || (p.kind === "voice" ? t("fdVoice") : t("fdPhoto"))) + "</span><small>" + (p.size ? h(kb(p.size)) : p.secs ? p.secs + "s" : "") + "</small>" +
            '<button type="button" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '">' + ic("x", 13) + "</button></i>";
        }).join("") + "</div>" : "");
    },
  };

  SCR["people.add"] = {
    t: function () { return t("adT"); }, l: function () { return t("adL"); }, s: peopleSum,
    /* Nobody types a customer list (owner, 1 Oct 2026): his phone's contacts over a QR code (the
       phone page's picker, sent across), and below it the same attach card every step ends with
       (owner: keep it consistent). A Tally or Excel list attached there comes in sorted (import.js);
       Ctrl+V of copied rows still works on this screen, with nothing on it to explain. */
    b: function () {
      /* Whose numbers to bring (owner, 1 Oct 2026): the three kinds, in the colours they are marked with next. */
      const who = '<p class="who3" aria-label="' + h([t("tShops"), t("tSuppliers"), t("tStaff")].join(", ")) + '">' +
        '<span class="w-shop">' + ic("store", 15) + h(t("tShops")) + '</span><span class="w-sup">' + ic("truck", 15) + h(t("tSuppliers")) + "</span>" +
        '<span class="w-staff">' + ic("staff", 15) + h(t("tStaff")) + "</span></p>";
      /* Once people are in, the card says so plainly and points on (owner, 1 Oct 2026: it wasn't clear
         the contacts had come in): a green tick, how many, who, and Mark who is who. The code shrinks
         to the side, still there to send more. */
      if (S.order.length) {
        const ppl = S.order.slice(-5).reverse().map(function (id) { return S.people[id]; }).filter(Boolean);
        return who + '<div class="ho is-done">' +
            '<span class="ho-ok">' + ic("check", 30) + "</span>" +
            '<div class="ho-m"><b>' + h(t("hoDone", { n: S.order.length })) + "</b>" +
              '<span class="ho-av">' + ppl.map(function (p) { return avatar(p.name); }).join("") + (S.order.length > 5 ? "<i>+" + (S.order.length - 5) + "</i>" : "") + "</span>" +
              '<button class="ho-go" data-act="next">' + h(t("hoMark")) + ic("chev", 16) + "</button></div>" +
            '<div class="ho-more"><div class="ho-qr" aria-hidden="true" data-url="' + h(phoneUrl()) + '">' + qrSvg(phoneUrl()) + "</div><small>" + h(t("hoMore")) + "</small>" +
              '<span class="ho-st" id="hoSt"></span></div>' +
          "</div>" + attach("people");
      }
      return who + '<div class="ho">' +
          '<div class="ho-qr" aria-hidden="true" data-url="' + h(phoneUrl()) + '">' + qrSvg(phoneUrl()) + "</div>" +
          '<div class="ho-m"><span class="ho-tag">' + ic("smartphone", 13) + h(t("hoTag")) + "</span><b>" + h(t("adPhone")) + "</b>" +   // no sub-text (owner): the 1-2-3 says how
            '<ol class="ho-steps"><li><i>1</i>' + h(t("adStep1")) + "</li><li><i>2</i>" + h(t("adStep2")) + "</li><li><i>3</i>" + h(t("adStep3")) + "</li></ol>" +
            '<div class="ho-st" id="hoSt">' + hoStatus() + "</div>" +
            '<span class="ho-alt"><button class="link ho-g" data-act="icloud">' + ic("smartphone", 14) + h(t("icLink")) + "</button>" +
            (GG && GG.ready() ? '<button class="link ho-g" data-act="googleSync">' + GG.logo + h(t("adGoogle")) + "</button>" : "") + "</span></div></div>" +
        /* No "so far" strip (owner: the card must not scroll): the footer counts them, Who is who lists them. */
        (M.filesFor(S, "people").length ? "" : '<div class="or-div"><span>' + h(t("orWord")) + "</span></div>") + attach("people");
    },
  };
  SCR["people.sort"] = {
    wide: true, go: function () { return t("ctaMark"); }, t: function () { return t("srT"); }, l: function () { return t("srL"); }, s: peopleSum,
    b: function () { return '<div id="plist">' + sortTable() + "</div>"; },
  };
  SCR["people.days"] = {
    wide: true, t: function () { return t("dyT"); }, l: function () { return t("paintHint") + " " + t("starHint"); },
    s: function () { const n = M.peopleOf(S, "shop").filter(function (p) { return !(p.days || []).length; }).length; return n ? t("dyLeft", { n: n }) : ""; },
    b: function () { return custTable(); },
  };
  SCR["people.team"] = {
    wide: true, t: function () { return t("tmT"); }, l: function () { return t("tmL"); },
    b: function () { return "<h3>" + h(t("tStaff")) + "</h3>" + staffTable() + "<h3>" + h(t("tSuppliers")) + "</h3>" + supTable(); },
  };

  /* ── Stock: a count sheet ── */

  function stockItems() { return M.stockSel(CAT, S).map(function (id) { return M.item(CAT, S, id); }).filter(Boolean); }
  function stockMissing() { const s = M.stockSel(CAT, S); return Object.keys(S.items).filter(function (id) { return s.indexOf(id) < 0; }); }
  function unitLabel(it, k) { return it.loose ? t("u_" + k) : k === "case" ? t("uCase") : t("uPiece"); }

  function stockDrop() {
    if (!ui.stOpen || !ui.stQ.trim()) return "";
    const s = M.stockSel(CAT, S);
    const ids = M.search(CAT, S, ui.stQ.trim(), null).filter(function (id) { return s.indexOf(id) < 0; })
      .sort(function (a, b) { return (S.items[b] ? 1 : 0) - (S.items[a] ? 1 : 0); }).slice(0, 8);
    if (!ids.length) return '<div class="drop-l"><p class="hint">' + h(t("gsNoFound")) + '</p><button class="btn" data-act="newItem" data-count="1">' + ic("plus", 16) + h(t("iNew")) + "</button></div>";
    return '<div class="drop-l">' + ids.map(function (id, i) {
      const it = M.item(CAT, S, id);
      return '<button class="drop-r' + (i === 0 ? " first" : "") + '" data-act="stAdd" data-id="' + h(id) + '"><span class="pick-img sm">' + pickImg(it) + "</span><span><b>" + h(nm(it)) + "</b><small>" + h(packLabel(it)) + "</small></span>" + ic("plus", 16) + "</button>";
    }).join("") + "</div>";
  }

  function stockRow(it, i) {
    const c = M.countOf(it), k = M.lineUnit(S, it);
    const price = it.sell == null ? null : M.round2(it.sell * M.unitPer(it, k));
    const co = it.company && M.companyById(CAT, S, it.company);
    return '<tr class="' + (c ? "done" : "") + '"><td class="im"><span class="pick-img sm">' + pickImg(it) + "</span></td>" +
      '<td class="nm"><b>' + h(nm(it)) + "</b><small>" + h([packLabel(it), co ? co.short : ""].filter(Boolean).join(" · ")) + "</small></td>" +
      '<td class="cnt"><input class="in num" data-count="' + h(it.id) + '" data-i="' + i + '" inputmode="numeric" autocomplete="off" value="' + (c ? c.qty : "") + '" placeholder="–" aria-label="' + h(nm(it)) + '"></td>' +
      "<td>" + (M.countUnits(it).length > 1 ? '<select class="in" data-unit="' + h(it.id) + '">' + M.countUnits(it).map(function (u) {
        return '<option value="' + u.k + '"' + (u.k === k ? " selected" : "") + ">" + h(unitLabel(it, u.k)) + (u.per > 1 ? " · " + u.per : "") + "</option>";
      }).join("") + "</select>" : '<span class="unit">' + h(unitLabel(it, k)) + "</span>") + "</td>" +
      '<td class="r price">' + (price == null ? '<span class="warn">' + h(t("iAddPrice")) + "</span>" : h(rupee(price)) + ' <small>/ ' + h(unitLabel(it, k).toLowerCase()) + "</small>") + "</td>" +
      '<td class="x"><button class="icbtn" data-act="stRemove" data-id="' + h(it.id) + '" aria-label="' + h(t("gsRemove")) + '" title="' + h(t("gsRemove")) + '">' + ic("x", 15) + "</button></td></tr>";
  }

  function stockCounted() {
    const its = stockItems();
    return t("gsCounted", { n: its.filter(function (it) { return M.countOf(it); }).length, total: its.length });
  }

  SCR.stock = {
    wide: true, t: function () { return t("stT"); }, l: function () { return t("stockLegend"); },
    s: function () { return stockItems().length ? stockCounted() : ""; },
    b: function () {
      const its = stockItems(), miss = stockMissing().length;
      return '<div class="bar"><div class="st-add"><label class="search">' + ic("search", 16) +
          '<input type="search" id="stQ" value="' + h(ui.stQ) + '" placeholder="' + h(t("stockAdd")) + '" autocomplete="off"><kbd>/</kbd></label><div id="stDrop">' + stockDrop() + "</div></div>" +
          (miss ? '<button class="btn" data-act="stAll">' + ic("plus", 16) + h(t("stockMore", { n: miss })) + "</button>" : "") + "</div>" +
        (its.length
          ? '<table class="tbl stock"><thead><tr><th></th><th>' + h(t("colProduct")) + "</th><th>" + h(t("colCount")) + "</th><th>" + h(t("colIn")) + '</th><th class="r">' + h(t("colPrice")) + "</th><th></th></tr></thead><tbody>" +
            its.map(stockRow).join("") + "</tbody></table>"
          : '<div class="empty"><p>' + h(t("stockNoItems")) + '</p><button class="btn is-g" data-act="goStep" data-to="items">' + ic("box", 16) + h(t("goProducts")) + "</button></div>") + attach("stock");
    },
  };

  /* ── Daily work: every question on one page ── */

  function otherBox(path) {
    const v = getPath(path), on = Array.isArray(v) ? v.indexOf("other") >= 0 : v === "other";
    return on ? inp(path + "Other", { ph: t("otherPh"), cls: "wide" }) : "";
  }

  /* Daily work fits its card without scrolling (owner, 1 Oct 2026: "be creative"): the three yes/no
     questions are three tiles side by side, each with its picture; each choice is one row, its
     question on the left and its answers on the right; "anything else" is one line that grows as
     he types or speaks. The same questions, half the height. */
  SCR.rules = {
    wide: true, t: function () { return t("rlT"); },
    s: function () { const n = M.progress(CAT, S).rules.n; return n ? t("sRules", { n: n, total: M.RULES_N }) : ""; },
    b: function () {
      const other = { v: "other", label: t("tOther") };
      const tile = function (icon, label, path) {
        const v = getPath(path);
        return '<div class="ynt' + (v != null ? " is-set" : "") + '"><span class="ynt-q"><span class="ynt-ic">' + ic(icon, 17) + "</span><b>" + h(t(label)) + "</b></span>" + seg(path) + "</div>";
      };
      const row = function (label, inner) { return '<div class="rowf"><span class="rowf-l">' + h(t(label)) + '</span><div class="rowf-r">' + inner + "</div></div>"; };
      return '<div class="yn3">' + tile("map", "ruRoutes", "rules.routes") + tile("phone", "ruSelf", "rules.selfOrder") + tile("divide", "ruPart", "rules.partPay") + "</div>" +
        '<div class="rows">' +
          row("ruPay", setChips("rules.payMethods", "arr", [{ v: "cash", label: t("mCash") }, { v: "upi", label: t("mUpi") }, { v: "cheque", label: t("mCheque") }, { v: "credit", label: t("mCredit") }, other]) + otherBox("rules.payMethods")) +
          row("ruReturns", setChips("rules.returns", "str", [{ v: "credit", label: t("retCredit") }, { v: "replace", label: t("retReplace") }, { v: "none", label: t("retNone") }, other]) + otherBox("rules.returns")) +
          row("ruMorning", setChips("rules.morning", "str", [{ v: "orders", label: t("mnOrders") }, { v: "money", label: t("mnMoney") }, { v: "stock", label: t("mnStock") }, { v: "trucks", label: t("mnTrucks") }, other]) + otherBox("rules.morning")) +
          row("ruNote", withMic("rules.note", inp("rules.note", { area: true, ph: t("notePh"), cls: "grow" }))) +
        "</div>";   // its files go on the Files step now (owner, 1 Oct 2026)
    },
  };


  function gapsHTML(open) {
    const gaps = M.missing(CAT, S);
    if (!gaps.length) return '<div class="callout">' + ic("circleCheck", 16) + "<p>" + h(t("fiNoMissing")) + "</p></div>";
    return '<details class="gaps"' + (open ? " open" : "") + "><summary>" + ic("info", 16) + "<span>" + h(t("fiLater", { n: gaps.length })) + "</span>" + ic("chev", 14) + "</summary>" +
      gaps.map(function (g) {
        return '<button class="gap" data-act="goStep" data-to="' + g.step + '"' + (g.tab ? ' data-tab="' + g.tab + '"' : "") + "><span>" + h(t("gap_" + g.key)) + "</span>" + (g.n > 1 ? '<i class="pill">' + g.n + "</i>" : "") + ic("chev", 14) + "</button>";
      }).join("") + "</details>";
  }

  function buildState() {
    const last = S.lastBuild;
    if (!last) return "";
    const wait = (ui.outbox || []).find(function (b) { return b.id === last.id; });
    if (!wait) return '<p class="sent">' + ic("circleCheck", 15) + h(t("fiSent")) + " · " + h(whenLong(last.at)) + "</p>";
    return '<p class="sent is-wait">' + ic("clock", 15) + h(t("fiWaiting")) + " · " + h(t("fiWaitingSub", { n: wait.sent, total: wait.total })) + "</p>";
  }

  /* Right: a preview of the store itself (1 Oct 2026, owner: a list of the same steps as the left
     read as a repeat). Not the process -- the result: his number and business on top, the packs he
     picked, his customers' initials, what he counted, how his day runs, his files. It starts as a
     faded outline and fills in as he works. Below: how ready it is, and Build my store. */
  function typeLabel() {
    const st = S.store, k = { distributor: "tDistributor", superstockist: "tSuperstockist", wholesaler: "tWholesaler", retailer: "tRetailer", manufacturer: "tManufacturer" }[st.type];
    return k ? t(k) : st.type === "other" ? st.typeOther || t("tOther") : "";
  }
  const skel = function (n) { return '<span class="skel">' + Array.from({ length: n }, function () { return "<i></i>"; }).join("") + "</span>"; };

  function pvBlock(sec, label, count, body) {
    return '<button class="pv-b" data-act="' + (sec === "papers" ? "papers" : "goStep") + '" data-to="' + sec + '"><span class="pv-bh"><b>' + h(label) + "</b>" +
      (count ? "<i>" + count + "</i>" : "") + "</span>" + body + "</button>";
  }

  function previewHTML() {
    const P = M.progress(CAT, S), st = S.store;
    const its = M.chosenItems(CAT, S).reverse(), shops = M.peopleOf(S, "shop");
    const fileName = function (sec) { const f = M.filesFor(S, sec)[0]; return f ? '<span class="pv-file">' + ic("file", 13) + h(f.name || t("fdPhoto")) + "</span>" : ""; };
    const top = '<div class="pv-top"><span class="pv-av">' + ic("store", 20) + "</span><div><b>" + h(st.name || t("pvNoName")) + "</b>" +
      (M.storeReady(S) ? "<small>" + h([M.phoneShow(st.mobile), typeLabel(), st.gst].filter(Boolean).join(" · ")) + "</small>" : skel(1)) + "</div></div>";
    const products = its.length
      ? '<span class="pv-ths">' + its.slice(0, 5).map(function (it) { return '<span class="pick-img pv-th">' + pickImg(it) + "</span>"; }).join("") +
        (its.length > 5 ? '<span class="pv-more">+' + (its.length - 5) + "</span>" : "") + "</span>"
      : fileName("items") || '<span class="skel is-sq"><i></i><i></i><i></i><i></i></span>';
    const people = shops.length
      ? '<span class="pv-avs">' + shops.slice(0, 6).map(function (p) { return avatar(p.name); }).join("") + (shops.length > 6 ? '<span class="pv-more">+' + (shops.length - 6) + "</span>" : "") + "</span>" +
        ((P.people.staff || P.people.suppliers) ? "<small>" + h([P.people.staff ? t("sStaff", { n: P.people.staff }) : "", P.people.suppliers ? t("sSup", { n: P.people.suppliers }) : ""].filter(Boolean).join(" · ")) + "</small>" : "")
      : fileName("people") || '<span class="skel is-av"><i></i><i></i><i></i></span>';
    const stock = P.stock.n ? '<span class="pv-txt">' + h(t("sStock", { n: P.stock.n })) + "</span>" : fileName("stock") || skel(1);
    const r = S.rules, pay = { cash: "mCash", upi: "mUpi", cheque: "mCheque", credit: "mCredit" };
    const daily = (r.payMethods || []).map(function (m) { return pay[m] ? t(pay[m]) : r.payMethodsOther || t("tOther"); })
      .concat(r.routes ? [t("pvRoutes")] : [], r.selfOrder ? [t("pvSelf")] : [], r.partPay ? [t("pvPart")] : []);
    const dailyBody = daily.length ? '<span class="pv-chips">' + daily.map(function (x) { return "<i>" + h(x) + "</i>"; }).join("") + "</span>" : skel(2);
    const files = S.papers.length ? '<span class="pv-chips">' + S.papers.slice(-3).reverse().map(function (p) { return "<i>" + ic("file", 11) + h(p.name || (p.kind === "voice" ? t("fdVoice") : t("fdPhoto"))) + "</i>"; }).join("") +
      (S.papers.length > 3 ? "<i>+" + (S.papers.length - 3) + "</i>" : "") + "</span>" : skel(1);
    const empty = !its.length && !shops.length && !M.storeReady(S) && !S.papers.length;
    return '<div class="pv-card' + (empty ? " is-empty" : "") + '">' + top +
        (empty ? '<p class="pv-empty">' + h(t("pvEmpty")) + "</p>" : "") +
        (M.shown("items") ? pvBlock("items", t("tProducts"), its.length, products) : "") +
        pvBlock("people", t("tShops"), shops.length, people) +
        (M.shown("stock") ? pvBlock("stock", t("pvStock"), P.stock.n, stock) : "") +
        pvBlock("rules", t("pvDaily"), "", dailyBody) +
        (S.papers.length ? pvBlock("papers", t("pvFiles"), S.papers.length, files) : "") +   // no files: no row (an empty bar read as loading)
      "</div>";
  }

  SCR.review = {
    wide: true, t: function () { return t("rvT"); },
    b: function () {
      return '<div class="review"><div>' + previewHTML() + "</div>" +
        '<div class="rv-side">' + gapsHTML(true) + buildState() + "</div></div>";
    },
  };

  /* ──────────────────────────────────────────────────────── dialogs ── */

  function dlgWrap(title, body, foot, cls) {
    return '<div class="scrim" data-act="closeDlg"></div><div class="dlg' + (cls ? " " + cls : "") + '" role="dialog" aria-modal="true" aria-label="' + h(title.replace(/<[^>]+>/g, "")) + '">' +
      '<div class="dlg-h"><h2>' + title + '</h2><button class="icbtn" data-act="closeDlg" aria-label="' + h(t("close")) + '">' + ic("x", 18) + "</button></div>" +
      '<div class="dlg-b">' + body + "</div>" + (foot ? '<div class="dlg-f">' + foot + "</div>" : "") + "</div>";
  }
  const done = function () { return '<button class="cta" data-act="closeDlg">' + h(t("done")) + "</button>"; };

  const DIALOGS = {};

  /* What left the screen lives here: files, sample data, the phone page, start again. */
  DIALOGS.menu = function () {
    const row = function (act, icon, label, attrs, cls) { return '<button class="mrow' + (cls ? " " + cls : "") + '" data-act="' + act + '"' + (attrs || "") + ">" + ic(icon, 18) + "<span>" + h(label) + "</span></button>"; };
    return dlgWrap(h(t("menu")),
      row("papers", "folder", t("tPapers") + (S.papers.length ? " · " + S.papers.length : "")) +
      row("sampleAll", "sparkle", t("menuSample")) +
      row("lang", "langs", t("menuLang"), ' data-v="' + (S.lang === "en" ? "hi" : "en") + '"') +
      row("confirm", "trash", t("menuFresh"), "", "is-bad") +
      '<p class="hint">' + h(CAT.note) + '</p><p class="hint">' + h(CAT.credit) + "</p>", "", "is-sm");
  };

  DIALOGS.confirm = function () {
    return dlgWrap(h(t("cfTitle")), '<div class="callout is-bad">' + ic("alert", 18) + "<p>" + h(t("cfFresh")) + "</p></div>",
      '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta is-bad" data-act="fresh">' + h(t("cfFreshYes")) + "</button>", "is-sm");
  };

  DIALOGS.sample = function (d) {
    const all = d.step === "all";
    const needItems = d.step === "stock" && !Object.keys(S.items).length;
    return dlgWrap(h(t("sampleTitle")),
      '<div class="callout">' + ic("sparkle", 18) + "<p>" + h(all ? t("sampleAllBody") : t("sampleBody", { step: secName(d.step) })) + (needItems ? " " + h(t("sampleItemsToo")) : "") + "</p></div>",
      '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta" data-act="sampleFill" data-step="' + d.step + '">' + ic("sparkle", 16) + h(t("sampleYes")) + "</button>", "is-sm");
  };

  function priceIn(p, key, val) {
    return inp(p + key, { kind: "num", mode: "decimal", ph: "₹", touch: p + "touched." + key, rerender: true, cls: "num" });
  }

  DIALOGS.item = function (d) {
    const id = d.id, it = M.item(CAT, S, id);
    if (!it) return dlgWrap("", "");
    const p = "items." + id + ".";
    const head = '<div class="item-h"><span class="pick-img lg">' + pickImg(it) + "</span><div><b>" + h(nm(it)) + "</b><small>" + h(packLabel(it)) + " · " + h(catName(it.cat)) + "</small>" +
      (it.loose || it.custom || it.touched.mrp ? "" : '<small class="warn">' + ic("alert", 13) + h(t("isCheckMrp")) + "</small>") + "</div></div>";
    const speed = field(t("isSpeed"), setChips(p + "speed", "str", [{ v: "fast", label: t("spFast") }, { v: "med", label: t("spMed") }, { v: "slow", label: t("spSlow") }]));
    const foot = '<button class="btn is-bad" data-act="removeItem" data-id="' + h(id) + '">' + ic("trash", 16) + h(t("isRemove")) + "</button>" + done();
    if (it.loose) {
      return dlgWrap(h(nm(it)), head + '<div class="two">' +
        field(t("isSellPer", { per: t("per_" + it.per) }), priceIn(p, "sell", it.sell), it.sell == null ? h(t("isLooseHint")) : "") +
        field(t("isBuyPer", { per: t("per_" + it.per) }), priceIn(p, "buy", it.buy)) + "</div>" + speed, foot);
    }
    return dlgWrap(h(nm(it)), head +
      '<div class="two">' +
        field(t("isMrp"), stepper(p + "mrp", { min: 0, base: it.mrp, touch: p + "touched.mrp" })) +
        field(t("isGst"), chips([0, 5, 18, 40].map(function (g) { return { v: g, label: g + "%" }; }), function (g) { return Number(g) === it.gst; }, 'data-act="set" data-path="' + p + 'gst" data-kind="num"')) +
        field(t("isSell"), priceIn(p, "sell", it.sell), [it.touched.sell || it.touched.buy || (S.companies[it.company] || {}).seen ? "" : h(t("isStdPrice")),
          it.unit === "case" ? h(t("isCaseTotal", { n: M.unitPrice(it, "sell") })) : ""].filter(Boolean).join(" ")) +
        field(t("isBuy"), priceIn(p, "buy", it.buy)) +
        field(t("isUnit"), setChips(p + "unit", "str", [{ v: "piece", label: t("uPiece") }, { v: "case", label: t("uCase") }])) +
        field(t("isCaseQty"), stepper(p + "caseQty", { min: 1, base: it.caseQty })) +
      "</div>" + speed +
      field(t("isBarcode"), inp(p + "barcode", { mode: "numeric", ph: it.barcode || "" })), foot, "is-md");
  };

  const PERS = ["kg", "dozen", "piece", "bunch", "litre", "pack"];
  const LOOSE_CATS = ["veg", "fruit", "eggs", "meat", "milk", "freshdairy", "grains", "dryfruit", "spice", "other"];

  DIALOGS.newItem = function (d) {
    const dr = d.draft, loose = !!dr.loose;
    const cats = (loose ? LOOSE_CATS : Object.keys(CAT.categories)).map(function (k) { return '<option value="' + k + '"' + (dr.cat === k ? " selected" : "") + ">" + CAT.categories[k].icon + " " + h(catName(k)) + "</option>"; }).join("");
    const kind = field(t("isKind"), setChips("@draft.loose", "bool", [{ v: "0", label: t("kPacked") }, { v: "1", label: t("kLoose") }]));
    const name = field(t("isName"), inp("@draft.name", { cls: "wide" }));
    const category = field(t("isCategory"), '<select class="in" data-bind="@draft.cat">' + cats + "</select>");
    const foot = '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta" data-act="saveItem">' + h(t("save")) + "</button>";
    if (loose) {
      return dlgWrap(h(t("iNew")), kind + name + field(t("isPer"), setChips("@draft.per", "str", PERS.map(function (x) { return { v: x, label: t("per_" + x) }; }))) +
        '<div class="two">' + field(t("isSellPer", { per: t("per_" + (dr.per || "kg")) }), inp("@draft.sell", { kind: "num", mode: "decimal", ph: "₹", cls: "num" })) + category + "</div>", foot, "is-md");
    }
    const cos = '<select class="in" data-bind="@draft.company" data-rerender><option value="">' + h(t("otherCompany")) + "</option>" + M.companyList(CAT, S).map(function (c) {
      return '<option value="' + h(c.id) + '"' + (dr.company === c.id ? " selected" : "") + ">" + h(c.short) + "</option>";
    }).join("") + "</select>";
    return dlgWrap(h(t("iNew")), kind + name +
      '<div class="two">' +
        field(t("isCompany"), cos + (dr.company ? "" : inp("@draft.companyName", { ph: t("cNewName"), cls: "mt" }))) +
        field(t("isPack"), inp("@draft.pack")) +
        field(t("isMrp"), inp("@draft.mrp", { kind: "num", mode: "decimal", ph: "₹", cls: "num" })) +
        field(t("isCaseQty"), stepper("@draft.caseQty", { min: 1 })) +
        category + (dr.barcode ? field(t("isBarcode"), '<p class="strong">' + h(dr.barcode) + "</p>") : "") +
      "</div>", foot, "is-md");
  };

  DIALOGS.person = function (d) {
    const p = S.people[d.id];
    if (!p) return dlgWrap("", "");
    const b = "people." + p.id + ".";
    let body = '<div class="two">' + field(t("pName"), inp(b + "name", { cls: "wide" })) + field(t("pPhone"), inp(b + "phone", { mode: "tel", max: 14 })) + "</div>";
    if (p.type === "shop") {
      body += field(t("shDays"), setChips(b + "days", "arr", M.DAYS.map(function (x) { return { v: x, label: dayName(x) }; }))) +
        '<div class="two">' +
          field(t("shArea"), inp(b + "area", { list: "areaListD", cls: "wide" }) + '<datalist id="areaListD">' + areas().map(function (a) { return '<option value="' + h(a) + '">'; }).join("") + "</datalist>") +
          field(t("shOwes"), inp(b + "owes", { kind: "num", mode: "numeric", ph: "₹", cls: "num" }), h(t("shOwesHint"))) + "</div>" +
        field(t("shPay"), setChips(b + "pay", "auto", [{ v: "cash", label: t("payCash") }, { v: 7, label: t("payDays", { n: 7 }) }, { v: 15, label: t("payDays", { n: 15 }) }, { v: 30, label: t("payDays", { n: 30 }) }])) +
        field(t("shRate"), setChips(b + "rate", "str", [{ v: "normal", label: t("rtNormal") }, { v: "wholesale", label: t("rtWholesale") }, { v: "special", label: t("rtSpecial") }])) +
        field(t("shHow"), setChips(b + "how", "str", [{ v: "salesman", label: t("howSalesman") }, { v: "phone", label: t("howPhone") }, { v: "whatsapp", label: t("howWhatsapp") }, { v: "self", label: t("howSelf") }])) +
        field(t("shBig"), setChips(b + "big", "bool", [{ v: "1", label: t("yes") }, { v: "0", label: t("no") }])) +
        field(t("shNote"), inp(b + "note", { area: true }));
    } else if (p.type === "staff") {
      body += field(t("pStaff"), setChips(b + "role", "str", roleOpts())) + field(t("stDays"), setChips(b + "days", "arr", M.DAYS.map(function (x) { return { v: x, label: dayName(x) }; }))) +
        '<div class="two">' + field(t("stVehicle"), inp(b + "vehicle", { upper: true, kind: "upper" })) + field(t("stCash"), setChips(b + "cash", "bool", [{ v: "1", label: t("yes") }, { v: "0", label: t("no") }])) + "</div>";
    } else if (p.type === "supplier") {
      body += '<div class="two">' + field(t("suGst"), inp(b + "gst", { upper: true, kind: "upper", max: 15 })) +
        field(t("suLead"), setChips(b + "lead", "num", [1, 2, 3, 7].map(function (n) { return { v: n, label: t("daysN", { n: n }) }; }))) +
        field(t("suOwe"), inp(b + "owe", { kind: "num", mode: "numeric", ph: "₹", cls: "num" }), h(t("shOwesHint"))) + "</div>";
    }
    body += field(t("pIsA"), setChips(b + "type", "str", [{ v: "shop", label: t("pShop") }, { v: "staff", label: t("pStaff") }, { v: "supplier", label: t("pSupplier") }, { v: "skip", label: t("pSkip") }]));
    return dlgWrap(h(p.name), body, '<button class="btn is-bad" data-act="delPerson" data-id="' + h(p.id) + '">' + ic("trash", 16) + h(t("pRemove")) + "</button>" + done(), "is-md");
  };

  /* iPhone contacts, from the computer (owner, 1 Oct 2026): Safari keeps the contact picker switched
     off, so an iPhone can't hand its contacts to a web page in one tap. But an iPhone keeps them in
     iCloud, and iCloud.com exports them all as one vCard, which import.js reads. Three steps here,
     no phone and no setting; the file is kept raw for the team like any other. */
  DIALOGS.icloud = function () {
    const step = function (n, body) { return '<li><i>' + n + "</i><div>" + body + "</div></li>"; };
    return dlgWrap(h(t("icT")),
      '<ol class="ic-steps">' +
        step(1, "<b>" + h(t("ic1")) + '</b><a class="btn is-up" href="https://www.icloud.com/contacts/" target="_blank" rel="noopener">' + ic("share", 15) + h(t("ic1b")) + "</a>") +
        step(2, "<b>" + h(t("ic2")) + "</b><small>" + h(t("ic2s")) + "</small>") +
        step(3, "<b>" + h(t("ic3")) + "</b>" +
          '<label class="dump is-line">' + ic("contacts", 16) + "<b>" + h(t("ic3d")) + "</b><span>" + h(t("fdOr")) + " <u>" + h(t("fdBrowse")) + "</u></span>" +
          '<input type="file" class="sr" data-fx="people" data-close accept=".vcf,.vcard,text/vcard"></label>') +
      "</ol>", "", "is-md");
  };

  DIALOGS.papers = function () {
    return dlgWrap(h(t("tPapers")),
      '<p class="sub">' + h(t("fdSub")) + "</p>" + dump(false) +
      (canRecord ? '<div class="row">' + (ui.rec ? '<button class="btn is-bad" data-act="recStop">' + ic("stop", 16) + h(t("paStop")) + ' · <span id="recT">' + h(t("paRecording", { s: 0 })) + "</span></button>"
        : '<button class="btn" data-act="recStart">' + ic("mic", 16) + h(t("paVoice")) + "</button>") + "</div>" : "") +
      (S.papers.length ? fileList(true) : ""), done(), "is-md");
  };

  /* After Build my store, a whole page, as on the phone: thank you, and the FoodBridge team will reach out. */
  function thanksView() {
    const last = S.lastBuild;
    const wait = last && (ui.outbox || []).find(function (b) { return b.id === last.id; });
    let mark, title, sub, act = "";
    if (!wait) { mark = '<span class="ty-mark">' + ic("check", 44) + "</span>"; title = t("tyTitle"); sub = t("tySub"); }
    else if (ui.sending) { mark = '<span class="ty-mark is-busy">' + ic("send", 38) + "</span>"; title = t("fiSending"); sub = t("fiWaitingSub", { n: wait.sent, total: wait.total }); }
    else {
      mark = '<span class="ty-mark is-wait">' + ic("clock", 40) + "</span>"; title = t("fiWaiting"); sub = t("fiWaitingWhy");
      act = '<button class="cta" data-act="sendNow">' + ic("repeat", 18) + h(t("fiSendNow")) + "</button>";
    }
    return '<main class="ty"><div class="ty-top">' + LOGO + "<span>FoodBridge</span></div>" + mark + "<h1>" + h(title) + '</h1><p class="sub">' + h(sub) + "</p>" + act + "</main>";
  }

  /* ───────────────────────────────────────────────────────── render ── */

  function focusKey(a) {
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return null;
    if (a.id) return "#" + a.id;
    if (a.dataset.bind) return '[data-bind="' + a.dataset.bind + '"]';
    if (a.dataset.count) return '[data-count="' + a.dataset.count + '"]';
    return null;
  }

  function render() {
    const a = document.activeElement;
    const fk = focusKey(a);
    const caret = fk && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null;
    const loose = fk && a.id ? a.value : null;
    const keep = {};
    document.querySelectorAll("[data-keep]").forEach(function (el) { keep[el.dataset.keep] = el.scrollTop; });
    document.documentElement.lang = S.lang === "en" ? "en" : "hi";
    $app.className = "is-" + view;
    $app.innerHTML = view === "thanks" ? thanksView() : deskView();
    if (dlg && DIALOGS[dlg.kind]) {
      const still = ui.shownDlg === dlg ? " is-still" : "";
      ui.shownDlg = dlg;
      $dlg.innerHTML = DIALOGS[dlg.kind](dlg);
      if (still) $dlg.querySelectorAll(".dlg, .scrim").forEach(function (x) { x.classList.add("is-still"); });
    } else { $dlg.innerHTML = ""; ui.shownDlg = null; }
    document.body.classList.toggle("has-dlg", !!dlg);
    document.querySelectorAll("[data-keep]").forEach(function (el) { if (keep[el.dataset.keep] != null) el.scrollTop = keep[el.dataset.keep]; });
    if (fk) {
      const n = document.querySelector(fk);
      if (n) {
        if (loose != null) n.value = loose;
        n.focus({ preventScroll: true });
        if (caret) try { n.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text box */ }
      }
    }
    hydrate();
    hoSync();
    document.querySelectorAll("textarea.grow").forEach(growArea);
  }

  function paperUrl(id) {
    if (urls[id]) return Promise.resolve(urls[id]);
    return DB.get(id).then(function (b) { if (!b) return ""; urls[id] = URL.createObjectURL(b); return urls[id]; }).catch(function () { return ""; });
  }
  function hydrate() {
    document.querySelectorAll("img[data-paper]:not([src])").forEach(function (img) { paperUrl(img.dataset.paper).then(function (u) { if (u) img.src = u; }); });
    document.querySelectorAll("audio[data-paper-audio]:not([src])").forEach(function (a) { paperUrl(a.dataset.paperAudio).then(function (u) { if (u) a.src = u; }); });
  }

  function hashFor() { return "#" + (view === "desk" ? ui.scr : view); }
  function go(v) {
    view = v;
    dlg = null;
    history.pushState({ v: view, scr: ui.scr }, "", hashFor());
    render();
    const m = document.getElementById("main");
    if (m) m.scrollTop = 0;
  }
  /* To a screen: what a screen keeps for itself (sorted-here, the add row) starts fresh. */
  function goScr(id) {
    if (id !== ui.scr) { ui.sortedHere = []; ui.adding = false; ui.sortFocus = null; }
    if (id === "stock" && !M.stockSel(CAT, S).length && Object.keys(S.items).length) { const sel = M.stockSel(CAT, S); stockMissing().forEach(function (x) { sel.push(x); }); save(); }
    ui.scr = id;
    go("desk");
  }
  /* A step's first screen that applies; a gap names the screen that fixes it. */
  function firstOf(step, tab) {
    if (step === "people" && tab) return tab === "shop" && M.asked("days") ? "people.days" : (tab === "staff" || tab === "supplier") && M.asked("team") ? "people.team" : "people.sort";
    const f = flow().find(function (x) { return x.step === step; });
    return f ? f.id : "store";
  }
  function openDlg(d) { dlg = d; render(); const f = $dlg.querySelector("input:not([type=file]), textarea"); if (f && (d.kind === "newItem")) f.focus(); }
  function closeDlg() { stopRec(); dlg = null; render(); }

  window.addEventListener("popstate", function (e) {
    const st = e.state || {};
    dlg = null;
    view = st.v || "desk";
    if (st.scr) ui.scr = st.scr;
    render();
  });

  /* ──────────────────────────────────────────────── files and voice ── */

  function compress(file) {
    return new Promise(function (res) {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = function () {
        const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  }

  /* Anything dropped or chosen is kept as it came, for raw/ (outbox.js take). A drop lands on
     the section in view, or on Build while its dialog is open; a contacts file or a list is also
     read, and its people wait in Contacts to sort. */
  function dropStep() { const st = stepOf(ui.scr); return view !== "desk" ? "store" : st === "send" || st === "files" ? "finish" : st; }
  async function takeFiles(files, step) {
    step = step || dropStep();
    let n = 0, found = 0;
    const notes = [];
    for (const f of files) {
      if (!f.size) continue;
      let p;
      try { p = await OB.take(X, M, IMP, S, f, step); } catch (e) { notes.push("⚠ " + f.name); continue; }
      if (p.error) { notes.push(t("fxTooBig", { file: f.name })); continue; }
      n++;
      found += p.contacts || 0;
    }
    save();
    render();
    if (n) notes.unshift(t("fxAdded", { n: n }) + (found ? " · " + t("fxContacts", { n: found }) : ""));
    if (notes.length) toast(notes.join(" · "));
  }

  async function recStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [], started = Date.now(), step = dropStep();
      ui.rec = { mr: mr, started: started };
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        clearInterval(ui.rec && ui.rec.tick);
        ui.rec = null;
        if (chunks.length) {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          const id = M.uid("vn");
          await DB.put(id, blob);
          S.papers.push({ id: id, kind: "voice", step: step, at: Date.now(), mime: blob.type, secs: Math.max(1, Math.round((Date.now() - started) / 1000)) });
          save();
          toast("✓ " + t("paSaved"));
        }
        render();
      };
      mr.start();
      ui.rec.tick = setInterval(function () {
        const el = document.getElementById("recT");
        if (el) el.textContent = t("paRecording", { s: Math.round((Date.now() - started) / 1000) });
      }, 500);
      render();
    } catch (e) { toast(t("paNoMic")); }
  }
  function stopRec() { if (ui.rec && ui.rec.mr.state !== "inactive") ui.rec.mr.stop(); }

  /* ──────────────────────────────────────────────────────── actions ── */

  function toggle(id, on) {
    if (on === undefined) on = !S.items[id];
    if (on && !S.items[id]) S.items[id] = { unit: "case" };
    if (!on) delete S.items[id];
  }

  function nextUnsorted(fromId) {
    const rows = sortList();
    const i = rows.findIndex(function (p) { return p.id === fromId; });
    const after = rows.slice(i + 1).find(function (p) { return !p.type; }) || rows.find(function (p) { return !p.type; });
    return after ? after.id : fromId;
  }
  function tagPerson(id, v) {
    const p = S.people[id];
    if (!p) return;
    p.type = p.type === v ? null : v;
    if (ui.sortedHere.indexOf(p.id) < 0) ui.sortedHere.push(p.id);
    ui.lastSorted.push(p.id);
    save();
    if (p.type) ui.sortFocus = nextUnsorted(p.id);
  }
  function showSortFocus() {
    const r = document.querySelector('tr[data-row="' + CSS.escape(ui.sortFocus || "") + '"]');
    if (r) r.scrollIntoView({ block: "nearest" });
  }

  function stockWrite(id, qty) {
    const it = M.item(CAT, S, id);
    if (!it) return;
    M.setCount(S, it, qty, M.lineUnit(S, it));
    save();
    const input = document.querySelector('[data-count="' + CSS.escape(id) + '"]');
    if (input) input.closest("tr").classList.toggle("done", qty != null);
    const c = document.getElementById("stCounted");
    if (c) c.textContent = stockCounted();
    refreshRail();
    refreshSide();
  }
  function stockAdd(id) {
    if (!S.items[id]) { S.items[id] = { unit: "case" }; M.syncCompanies(CAT, S); }   // counted in his godown, so he sells it
    const s = M.stockSel(CAT, S);
    if (s.indexOf(id) < 0) s.unshift(id);
    ui.stQ = ""; ui.stOpen = false;
    save();
    render();
    const f = document.querySelector('[data-count="' + CSS.escape(id) + '"]');
    if (f) f.focus();
  }

  const ACT = {
    /* Continue: the next screen that applies. Shop waits for the login mobile, and says why. */
    next: function () {
      if (ui.scr === "store" && !M.storeReady(S)) {
        ui.needMobile = true;
        render();
        const box = document.querySelector('[data-bind="store.mobile"]');
        if (box) box.focus();
        return;
      }
      const f = flow(), i = f.findIndex(function (x) { return x.id === ui.scr; });
      if (f[i + 1]) goScr(f[i + 1].id);
    },
    back: function () {
      const f = flow(), i = f.findIndex(function (x) { return x.id === ui.scr; });
      if (i > 0) goScr(f[i - 1].id);
    },
    goStep: function (el) {
      if (el.dataset.to === "papers") { openDlg({ kind: "papers" }); return; }
      goScr(el.dataset.to === "send" ? "review" : firstOf(el.dataset.to, el.dataset.tab));
    },
    lang: function (el) { S.lang = el.dataset.v; save(); if (dlg && dlg.kind === "menu") dlg = null; render(); },
    menu: function () { openDlg({ kind: "menu" }); },
    closeDlg: closeDlg,
    confirm: function () { openDlg({ kind: "confirm" }); },
    fresh: function () {
      S = M.blank();
      S.lang = "en";
      save();
      DB.clear().catch(function () {});
      S.startedAt = Date.now();
      goScr("store");
    },
    sampleAsk: function (el) { openDlg({ kind: "sample", step: el.dataset.step }); },
    sampleAll: function () { openDlg({ kind: "sample", step: "all" }); },
    sampleFill: function (el) {
      const step = el.dataset.step;
      (step === "all" ? M.SAMPLE_STEPS : [step]).forEach(function (s) { M.fillSample(CAT, S, s); });
      ui.needMobile = false;
      ui.sortedHere = [];
      syncSave();
      dlg = null;
      if (step === "all" && ui.scr === "store") goScr("items.pick");
      else render();
      toast("✓ " + t("sampleDone"));
    },
    papers: function () { openDlg({ kind: "papers" }); },
    recStart: recStart,
    recStop: stopRec,
    dictate: function (el) { dictate(el.dataset.path); },
    delPaper: function (el) {
      OB.drop(M, S, el.dataset.id);   // and the contacts it brought, if still unsorted
      save();
      render();
    },

    set: function (el) {
      const path = el.dataset.path, kind = el.dataset.kind || "str", raw = el.dataset.v;
      if (kind === "flip") setPath(path, !getPath(path));
      else if (kind === "arr") {
        const arr = (getPath(path) || []).slice();
        const i = arr.map(String).indexOf(raw);
        if (i >= 0) arr.splice(i, 1); else arr.push(raw);
        if (/\.days$/.test(path)) arr.sort(function (a, b) { return M.DAYS.indexOf(a) - M.DAYS.indexOf(b); });
        setPath(path, arr);
      } else setPath(path, kind === "bool" ? raw === "1" : kind === "num" ? Number(raw) : kind === "auto" ? (/^\d+$/.test(raw) ? Number(raw) : raw) : raw);
      if (path[0] !== "@") save();
      render();
      if (raw === "other") { const box = document.querySelector('[data-bind="' + (path === "store.type" ? "store.typeOther" : path + "Other") + '"]'); if (box) box.focus(); }
    },
    step: function (el) {
      const path = el.dataset.path, d = Number(el.dataset.d);
      const min = el.dataset.min != null ? Number(el.dataset.min) : 0;
      const cur = getPath(path), base = el.dataset.base != null ? Number(el.dataset.base) : null;
      let v = cur == null || cur === "" ? (base != null ? base + d : d > 0 ? d : 0) : Number(cur) + d;
      v = Math.max(min, Math.round(v * 100) / 100);
      setPath(path, v);
      if (el.dataset.touch) setPath(el.dataset.touch, true);
      if (path[0] !== "@") save();
      render();
    },
    skip: function (el) { S.skipped[el.dataset.step] = true; save(); render(); },

    /* Products */
    by: function (el) { ui.by = el.dataset.v; ui.group = null; ui.itemsQ = ""; render(); },
    group: function (el) { ui.group = el.dataset.id; ui.itemsQ = ""; render(); const m = document.getElementById("grid"); if (m) m.scrollIntoView({ block: "nearest" }); },
    pick: function (el, e) {
      const id = el.dataset.id;
      const inGrid = el.classList.contains("pick");
      if (inGrid && e && e.shiftKey && ui.lastPick && ui.shown.indexOf(ui.lastPick) >= 0) {
        const a = ui.shown.indexOf(ui.lastPick), b = ui.shown.indexOf(id);
        const on = !S.items[id];
        const range = ui.shown.slice(Math.min(a, b), Math.max(a, b) + 1);
        range.forEach(function (x) { toggle(x, on); });
        syncSave();
        afterPick(range);
      } else {
        toggle(id);
        syncSave();
        afterPick([id]);
      }
      if (inGrid) ui.lastPick = id;
    },
    pickAll: function () {
      const ids = shownIds();
      const all = ids.every(function (id) { return S.items[id]; });
      ids.forEach(function (id) { toggle(id, !all); });
      syncSave();
      afterPick(ids);
    },
    item: function (el) { openDlg({ kind: "item", id: el.dataset.id }); },
    removeItem: function (el) { delete S.items[el.dataset.id]; syncSave(); closeDlg(); },
    newItem: function (el) {
      const q = ui.scr === "stock" ? ui.stQ : ui.itemsQ;
      const code = /^\d{8,14}$/.test(q.trim()) ? q.trim() : "";
      openDlg({ kind: "newItem", toCount: !!(el && el.dataset.count), draft: { name: code ? "" : q.trim(), company: "", cat: "other", caseQty: 1, loose: false, per: "kg", barcode: code } });
    },
    saveItem: function () {
      const d = dlg.draft;
      if (!(d.name || "").trim()) { toast(t("isName")); const f = $dlg.querySelector('[data-bind="@draft.name"]'); if (f) f.focus(); return; }
      if (!d.company && (d.companyName || "").trim()) {
        const cid = M.uid("co");
        S.customCompanies.push({ id: cid, name: d.companyName.trim(), short: d.companyName.trim(), color: "#6B7280" });
        d.company = cid;
      }
      const id = M.uid("new");
      if (d.loose) {
        S.customItems[id] = { name: d.name.trim(), brand: "", company: "", pack: d.per || "kg", per: d.per || "kg", loose: true, mrp: null, caseQty: 1, cat: d.cat || "other", photo: null, barcode: "" };
        S.items[id] = { unit: "piece", sell: d.sell != null ? d.sell : undefined, touched: d.sell != null ? { sell: true } : {} };
      } else {
        S.customItems[id] = { name: d.name.trim(), brand: "", company: d.company || "", pack: d.pack || "", mrp: d.mrp || null, caseQty: d.caseQty || 1, cat: d.cat || "other", photo: null, barcode: d.barcode || "" };
        S.items[id] = { unit: "case", barcode: d.barcode || "", touched: { mrp: true } };
      }
      if (dlg.toCount) { M.stockSel(CAT, S).unshift(id); ui.stQ = ""; ui.stOpen = false; }
      syncSave();
      dlg = null;
      render();
      toast("✓ " + d.name.trim());
    },

    /* Contacts */
    sort: function (el) { tagPerson(el.dataset.id, el.dataset.v); render(); },
    sortAll: function () {
      const ids = M.unsorted(S).map(function (p) { return p.id; });
      ids.forEach(function (id) { S.people[id].type = "shop"; });
      ui.lastSorted.push(ids);
      save();
      render();
      toast("✓ " + t("pSortedAll", { n: ids.length }));
    },
    undoSort: function () {
      const last = ui.lastSorted.pop();
      [].concat(last || []).forEach(function (id) { if (S.people[id]) S.people[id].type = null; });
      if (last) { save(); if (!Array.isArray(last)) ui.sortFocus = last; }
      render();
      showSortFocus();
    },
    person: function (el) { openDlg({ kind: "person", id: el.dataset.id }); },
    delPerson: function (el) { M.removePerson(S, el.dataset.id); save(); closeDlg(); },
    /* Off the list from its row, with a moment to take it back. */
    rmPerson: function (el) {
      const id = el.dataset.id, p = S.people[id];
      if (!p) return;
      const at = S.order.indexOf(id), usual = S.usual[id];
      M.removePerson(S, id);
      ui.removed = { p: p, at: at, usual: usual };
      save();
      render();
      toast(t("pRemovedOne", { name: p.name }), '<button class="link" data-act="unRemove">' + h(t("pUndo")) + "</button>");
    },
    unRemove: function () {
      const r = ui.removed;
      if (!r || S.people[r.p.id]) return;
      S.people[r.p.id] = r.p;
      S.order.splice(Math.max(0, r.at), 0, r.p.id);
      if (r.usual) S.usual[r.p.id] = r.usual;
      ui.removed = null;
      save();
      render();
      $toast.classList.remove("show");
    },
    googleSync: function () {
      GG.read().then(function (list) {
        const n = addList(list, "google");
        render();
        toast(t("gotGoogle", { n: n.added }) + (n.dup ? " · " + t("pDup", { n: n.dup }) : ""));
      }, function (e) { if (!/closed|denied/.test(e.message)) toast(t("googleFail")); });
    },
    icloud: function () { openDlg({ kind: "icloud" }); },
    hoWake: function () { const o = hoPick(); o.code = ""; o.opened = false; o.off = 0; render(); },
    pasteList: async function () {
      const k = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ V" : "Ctrl V";
      try { takePaste(await navigator.clipboard.readText()); } catch (e) { toast(t("pasteHow", { k: k })); }
    },
    addOpen: function () {
      ui.adding = true;
      render();
      const f = document.getElementById("addName");
      if (f) f.focus();
    },
    addClose: function () { ui.adding = false; render(); },
    addPerson: function () {
      const n = document.getElementById("addName"), p = document.getElementById("addPhone"), ty = document.getElementById("addType");
      const name = (n.value || "").trim(), phone = (p.value || "").trim();
      if (!name && !phone) { n.focus(); return; }
      const r = M.addPerson(S, { name: name || phone, phone: M.phone10(phone) || phone, type: ty.value || null, src: "typed" });
      save();
      if (r.dup) toast(t("pDup", { n: 1 }));
      const keepType = ty.value;
      render();
      const n2 = document.getElementById("addName"), t2 = document.getElementById("addType");
      if (t2) t2.value = keepType;
      if (n2) n2.focus();
    },
    flipCash: function (el) { const p = S.people[el.dataset.id]; if (p) { p.cash = !p.cash; save(); } },
    sameArea: function (el) {
      const days = el.dataset.days.split(",");
      M.peopleOf(S, "shop").forEach(function (p) { if (p.area === el.dataset.area && !(p.days || []).length) p.days = days.slice(); });
      save();
      render();
    },
    day: function (el) {
      const p = S.people[el.dataset.pid];
      if (!p) return;
      const d = el.dataset.day, days = (p.days || []).slice(), i = days.indexOf(d);
      if (i >= 0) days.splice(i, 1); else days.push(d);
      p.days = days.sort(function (a, b) { return M.DAYS.indexOf(a) - M.DAYS.indexOf(b); });
      save();
      render();
    },

    /* Stock */
    stAll: function () {
      const s = M.stockSel(CAT, S);
      stockMissing().forEach(function (id) { s.push(id); });
      save();
      if (ui.scr === "stock") render();
    },
    stAdd: function (el) { stockAdd(el.dataset.id); },
    stRemove: function (el) {
      const it = M.item(CAT, S, el.dataset.id);
      if (it) M.setCount(S, it, null, M.lineUnit(S, it));
      S.stockSel = M.stockSel(CAT, S).filter(function (x) { return x !== el.dataset.id; });
      save();
      render();
    },

    /* Build */
    buildAsk: function () { goScr("review"); },
    build: async function () {
      if (ui.building) return;
      ui.building = true;
      render();
      try {
        const b = await OB.make(CAT, X, S);
        ui.outbox = (ui.outbox || []).concat([b]);
        S.lastBuild = { id: b.id, at: b.at };
        save();
        ui.building = false;
        go("thanks");
        sendAll();
      } catch (e) {
        ui.building = false;
        render();
        toast("⚠ " + e.message);
      }
    },
    sendNow: function () { sendAll(); render(); },
  };

  /* ───────────────────────────────────────────────────────── events ── */

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    /* A day cell is set on mousedown (so a drag paints); a click from the keyboard still sets it. */
    if (el.dataset.day != null) { if (e.detail === 0) ACT.day(el); return; }
    const a = ACT[el.dataset.act];
    if (!a) return;
    if (el.type !== "checkbox") e.preventDefault();
    a(el, e);
  });

  /* Painting days: press on a day, drag across the row or down the column, let go. */
  document.addEventListener("mousedown", function (e) {
    const el = e.target.closest("[data-day]");
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const p = S.people[el.dataset.pid];
    if (!p) return;
    ui.paint = { on: (p.days || []).indexOf(el.dataset.day) < 0 };
    paintDay(el);
  });
  document.addEventListener("mouseover", function (e) {
    if (!ui.paint) return;
    const el = e.target.closest("[data-day]");
    if (el) paintDay(el);
  });
  window.addEventListener("mouseup", function () {
    if (!ui.paint) return;
    ui.paint = null;
    save();
    render();
  });
  function paintDay(el) {
    const p = S.people[el.dataset.pid];
    if (!p) return;
    const d = el.dataset.day, days = (p.days || []).filter(function (x) { return x !== d; });
    if (ui.paint.on) days.push(d);
    p.days = days.sort(function (a, b) { return M.DAYS.indexOf(a) - M.DAYS.indexOf(b); });
    el.classList.toggle("on", ui.paint.on);
    el.setAttribute("aria-pressed", ui.paint.on);
  }

  document.addEventListener("input", function (e) {
    const el = e.target;
    if (el.dataset.bind) {
      let v = el.value;
      const kind = el.dataset.kind;
      if (kind === "num") { v = v.replace(/[^\d.]/g, ""); v = v === "" ? null : Number(v); }
      if (kind === "upper") v = v.toUpperCase();
      if (el.tagName === "SELECT" && kind === "auto") v = v === "" ? null : /^\d+$/.test(v) ? Number(v) : v;
      setPath(el.dataset.bind, v);
      if (el.dataset.touch) setPath(el.dataset.touch, true);
      if (el.dataset.bind[0] === "@") return;
      save();
      if (el.dataset.bind === "store.mobile") syncMobile();
      refreshRail();
      refreshReady();
      if (/^items\..*\.sell$/.test(el.dataset.bind)) { const r = el.closest(".pr-r"); if (r) r.classList.toggle("is-need", v == null); }
      if (/\.area$/.test(el.dataset.bind) && v) { /* the area list grows as he types new ones; kept on change */ }
    } else if (el.dataset.q) {
      ui[el.dataset.q] = el.value;
      if (el.dataset.q === "itemsQ") {
        document.getElementById("grid").innerHTML = gridHTML();
        document.getElementById("pickbar").innerHTML = pickBarHTML(shownIds());
        const g = document.getElementById("chips");
        if (g) g.innerHTML = chipsHTML();
        hydrate();
      }
    } else if (el.id === "stQ") {
      ui.stQ = el.value;
      ui.stOpen = true;
      document.getElementById("stDrop").innerHTML = stockDrop();
      hydrate();
    } else if (el.dataset.count != null) {
      const raw = el.value.replace(/\D/g, "");
      if (el.value !== raw) el.value = raw;
      stockWrite(el.dataset.count, raw === "" ? null : parseInt(raw, 10));
    }
  });

  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.dataset.files != null || el.dataset.fx) {
      const close = el.dataset.close != null;   // the iCloud panel shuts once its file is in
      if (el.files.length) takeFiles(Array.from(el.files), el.dataset.fx).then(function () { if (close && dlg) closeDlg(); });
      el.value = ""; return;
    }
    if (el.dataset.unit != null) {
      const it = M.item(CAT, S, el.dataset.unit);
      if (!it) return;
      const c = M.countOf(it);
      M.setCount(S, it, c ? c.qty : null, el.value);
      save();
      render();
      return;
    }
    if (el.dataset.bind) {
      if (/\.area$/.test(el.dataset.bind) && el.value.trim() && S.store.areas.indexOf(el.value.trim()) < 0) { S.store.areas.push(el.value.trim()); save(); }
      if (el.dataset.rerender !== undefined || el.tagName === "SELECT" || /\.area$/.test(el.dataset.bind)) setTimeout(render, 0);
    }
  });

  function syncMobile() {
    const ok = M.storeReady(S);
    if (ok) ui.needMobile = false;
    const tag = document.querySelector(".fld.is-mob .req");
    if (tag) { tag.classList.toggle("is-ok", ok); tag.innerHTML = ok ? ic("check", 13) : h(t("required")); }
    const box = document.querySelector(".fld.is-mob .inx");
    if (box) box.classList.toggle("is-bad", !!ui.needMobile && !ok);
    const err = document.querySelector(".fld.is-mob .err");
    if (err) err.hidden = !ui.needMobile || ok;
  }


  document.addEventListener("focusin", function (e) {
    if (e.target.id === "stQ" && ui.stQ.trim() && !ui.stOpen) { ui.stOpen = true; document.getElementById("stDrop").innerHTML = stockDrop(); hydrate(); }
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.id !== "stQ") return;
    setTimeout(function () {
      if (document.activeElement && document.activeElement.id === "stQ") return;
      ui.stOpen = false;
      const d = document.getElementById("stDrop");
      if (d) d.innerHTML = "";
    }, 180);
  });

  /* Arrow keys across the product grid: the row above or below is one column count away. */
  function gridMove(el, key) {
    const cards = Array.from(document.querySelectorAll("#grid .pick"));
    const i = cards.indexOf(el);
    if (i < 0) return;
    const top = cards[0].offsetTop;
    let cols = cards.findIndex(function (c) { return c.offsetTop !== top; });
    if (cols < 0) cols = cards.length;
    const j = key === "ArrowRight" ? i + 1 : key === "ArrowLeft" ? i - 1 : key === "ArrowDown" ? i + cols : i - cols;
    if (cards[j]) { cards[j].focus(); cards[j].scrollIntoView({ block: "nearest" }); }
  }

  document.addEventListener("keydown", function (e) {
    const tg = e.target;
    if (e.key === "Escape") {
      if (dlg) { closeDlg(); return; }
      if (tg.id === "stQ") { ui.stQ = ""; ui.stOpen = false; tg.value = ""; document.getElementById("stDrop").innerHTML = ""; return; }
      if (ui.adding && tg.closest && tg.closest(".addrow")) { ACT.addClose(); return; }
    }
    if (dlg) return;
    /* Enter in the boxes that act. */
    if (e.key === "Enter") {
      if (tg.id === "addName" || tg.id === "addPhone") { e.preventDefault(); ACT.addPerson(); return; }
      if (tg.id === "itemsQ") {
        /* A USB barcode scanner types the code and presses Enter. */
        const code = tg.value.trim();
        if (/^\d{8,14}$/.test(code)) {
          e.preventDefault();
          const id = M.findBarcode(CAT, S, code);
          if (id) { toggle(id, true); syncSave(); ui.itemsQ = ""; render(); toast(t("scFound", { name: M.item(CAT, S, id).name })); }
          else { toast(t("scNew")); ACT.newItem(); }
        }
        return;
      }
      if (tg.id === "stQ") {
        e.preventDefault();
        const code = tg.value.trim();
        const hit = /^\d{8,14}$/.test(code) ? M.findBarcode(CAT, S, code) : null;
        const first = hit || (document.querySelector("#stDrop .drop-r") || {}).dataset && document.querySelector("#stDrop .drop-r").dataset.id;
        if (first) stockAdd(first);
        return;
      }
    }
    /* Down the count sheet: Enter or ↓ to the next box, ↑ back. */
    if (tg.dataset && tg.dataset.count != null && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const boxes = Array.from(document.querySelectorAll("[data-count]"));
      const j = boxes.indexOf(tg) + (e.key === "ArrowUp" ? -1 : 1);
      if (boxes[j]) { boxes[j].focus(); boxes[j].select(); }
      return;
    }
    if (tg.classList && tg.classList.contains("pick") && /^Arrow/.test(e.key)) { e.preventDefault(); gridMove(tg, e.key); return; }
    if (typing(tg) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/" && view === "desk") {
      const box = document.getElementById(ui.scr === "items.pick" ? "itemsQ" : ui.scr === "stock" ? "stQ" : "");
      if (box) { e.preventDefault(); box.focus(); box.select(); }
      return;
    }
    /* Sorting contacts from the keyboard. */
    if (view === "desk" && ui.scr === "people.sort" && ui.sortFocus) {
      const map = { 1: "shop", 2: "supplier", 3: "staff" };   // the marks' order on screen
      const rows = sortList();
      const i = rows.findIndex(function (p) { return p.id === ui.sortFocus; });
      if (map[e.key]) { e.preventDefault(); tagPerson(ui.sortFocus, map[e.key]); render(); showSortFocus(); return; }
      if (e.key === "Enter") { const p = S.people[ui.sortFocus], g = p && M.guessType(p.name); if (g && !p.type) { e.preventDefault(); tagPerson(p.id, g); render(); showSortFocus(); } return; }
      if ((e.key === "ArrowDown" || e.key === "j") && rows[i + 1]) { e.preventDefault(); ui.sortFocus = rows[i + 1].id; render(); showSortFocus(); return; }
      if ((e.key === "ArrowUp" || e.key === "k") && rows[i - 1]) { e.preventDefault(); ui.sortFocus = rows[i - 1].id; render(); showSortFocus(); return; }
      if (e.key === "u" || e.key === "U") { e.preventDefault(); ACT.undoSort(); return; }
    }
  });

  /* Drop files anywhere: the whole window takes them. */
  function hasFiles(e) { return e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf("Files") >= 0; }
  /* On the files step its own drop area lights up; elsewhere the whole window says what it takes. */
  function dragging(on) {
    document.body.classList.toggle("is-dragging", on);
    $drop.classList.toggle("show", on && view !== "thanks");
  }
  window.addEventListener("dragenter", function (e) { if (!hasFiles(e)) return; e.preventDefault(); ui.dragN++; dragging(true); });
  window.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
  /* Ctrl+V on the contacts screens: copied rows become people; a pasted screenshot is kept as a file. */
  document.addEventListener("paste", function (e) {
    if (view !== "desk" || dlg || typing(e.target) || (ui.scr !== "people.add" && ui.scr !== "people.sort")) return;
    const cd = e.clipboardData;
    if (!cd) return;
    const files = Array.from(cd.files || []);
    const text = cd.getData("text/plain");
    if (text && text.trim()) { e.preventDefault(); takePaste(text); }
    else if (files.length) { e.preventDefault(); takeFiles(files, "people"); }
  });
  window.addEventListener("dragleave", function (e) { if (!hasFiles(e)) return; ui.dragN = Math.max(0, ui.dragN - 1); if (!ui.dragN) dragging(false); });
  window.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    ui.dragN = 0;
    dragging(false);
    if (view === "thanks") return;
    takeFiles(Array.from(e.dataTransfer.files || []));
  });

  /* ─────────────────────────────────────────────────────────── start ── */

  $drop.innerHTML = '<div class="drop-in">' + ic("folder", 36) + "<b></b><small></small></div>";
  const dropWords = function () { $drop.querySelector("b").textContent = t("dropHere"); $drop.querySelector("small").textContent = t("dropSub"); };
  dropWords();
  window.addEventListener("dragenter", dropWords);

  M.tidy(CAT, S);
  const hash = location.hash.slice(1).split("/");   // "#items.pick"
  /* One layout from the first second: a first visit opens the desk on the shop; a return, on the
     first section still to do. (Until 1 Oct 2026 a separate start screen came first.) */
  if (!S.startedAt) S.startedAt = Date.now();   // saved with his first answer
  if (hash[0] === "thanks" && S.lastBuild) view = "thanks";
  else {
    view = "desk";
    /* A first visit opens on the shop; a return, on the first step still to do. */
    ui.scr = SCR[hash[0]] && (stepOf(hash[0]) === "send" || M.shown(stepOf(hash[0]))) ? hash[0] : firstOf(SECS.find(function (x) { return !M.progress(CAT, S)[x].done; }) || "send");
    if (ui.scr === "send") ui.scr = "review";
  }
  history.replaceState({ v: view, scr: ui.scr }, "", hashFor());
  render();
  OUTBOX.all().then(function (list) { ui.outbox = list || []; if (ui.outbox.length) sendAll(); else render(); }).catch(function () { ui.outbox = []; });
})();
