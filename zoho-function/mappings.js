/* ==========================================================================
   FoodBridge → Zoho Books mappings.  EDIT THIS FILE for the PMF customer.

   FoodBridge ids (c05, p01) are NOT Zoho ids. There is no lookup service and
   no database here on purpose: for one customer, in a PMF experiment, two
   literal objects are the honest amount of machinery.

   Everything below is EMPTY until someone pastes in the real ids from the
   customer's own Zoho Books organisation. Nothing is invented, and an unmapped
   customer or product fails loudly rather than guessing — an order raised
   against the wrong contact is worse than no order at all.

   WHERE THE IDS COME FROM
     Customer  Zoho Books → Sales → Customers → open the customer. The
               contact_id is the long number in the browser URL.
               Or: GET /books/v3/contacts?organization_id=…
     Item      Zoho Books → Items → open the item. The item_id is in the URL.
               Or: GET /books/v3/items?organization_id=…
   ========================================================================== */

/** FoodBridge customer id → Zoho Books contact_id (string). */
export const ZOHO_CUSTOMER_MAP = {
  // 40 customers, written by seed-catalogue.js on 2026-08-26.
  // Ids read back from the live Zoho org — none of them typed by hand.
  "c01": "4057002000000038001",
  "c02": "4057002000000046001",
  "c03": "4057002000000042008",
  "c04": "4057002000000047001",
  "c05": "4057002000000044010",
  "c06": "4057002000000048001",
  "c07": "4057002000000049001",
  "c08": "4057002000000037002",
  "c09": "4057002000000042015",
  "c10": "4057002000000047008",
  "c11": "4057002000000050001",
  "c12": "4057002000000051001",
  "c13": "4057002000000052001",
  "c14": "4057002000000053001",
  "c15": "4057002000000054001",
  "c16": "4057002000000039011",
  "c17": "4057002000000050008",
  "c18": "4057002000000055001",
  "c19": "4057002000000056001",
  "c20": "4057002000000043008",
  "c21": "4057002000000053008",
  "c22": "4057002000000046008",
  "c23": "4057002000000038008",
  "c24": "4057002000000040019",
  "c25": "4057002000000050015",
  "c26": "4057002000000045010",
  "c27": "4057002000000051008",
  "c28": "4057002000000057001",
  "c29": "4057002000000043015",
  "c30": "4057002000000054008",
  "c31": "4057002000000037009",
  "c32": "4057002000000042022",
  "c33": "4057002000000058001",
  "c34": "4057002000000050022",
  "c35": "4057002000000059001",
  "c36": "4057002000000055008",
  "c37": "4057002000000056008",
  "c38": "4057002000000060001",
  "c39": "4057002000000061001",
  "c40": "4057002000000034190",
};

/**
 * FoodBridge product id → the Zoho item, and how its quantity is expressed.
 *
 *   itemId  Zoho Books item_id.
 *   unit    OPTIONAL. Only set this if the Zoho item's own unit differs from
 *           the FoodBridge unit and you have checked what Zoho expects.
 *   factor  OPTIONAL, default 1. How many Zoho units make ONE FoodBridge unit.
 *
 *           factor 1  → "19 Box" in FoodBridge becomes quantity 19 against an
 *                       item Zoho also sells by the box. This is the normal
 *                       case and what you want when the customer's Zoho item
 *                       is already set up per box.
 *           factor 12 → the Zoho item is sold in pieces and one FoodBridge Box
 *                       is 12 of them, so 19 Box becomes quantity 228.
 *
 *   Getting this wrong is the difference between 19 boxes and 19 jars, so it
 *   is stated per product rather than derived by any rule.
 */
export const ZOHO_ITEM_MAP = {
  // 86 products, written by seed-catalogue.js on 2026-08-26.
  // unit is what ZOHO holds for the item; factor 1 means the two systems
  // count the same thing, which was checked rather than assumed.
  "p01": { itemId: "4057002000000039002", unit: "Box", factor: 1 },
  "p02": { itemId: "4057002000000050029", unit: "Box", factor: 1 },
  "p03": { itemId: "4057002000000045017", unit: "Box", factor: 1 },
  "p04": { itemId: "4057002000000051015", unit: "Box", factor: 1 },
  "p05": { itemId: "4057002000000052009", unit: "Crate", factor: 1 },
  "p06": { itemId: "4057002000000057008", unit: "Box", factor: 1 },
  "p07": { itemId: "4057002000000054015", unit: "Box", factor: 1 },
  "p08": { itemId: "4057002000000037016", unit: "Box", factor: 1 },
  "p09": { itemId: "4057002000000042029", unit: "Box", factor: 1 },
  "p10": { itemId: "4057002000000047015", unit: "Box", factor: 1 },
  "p11": { itemId: "4057002000000040001", unit: "Box", factor: 1 },
  "p12": { itemId: "4057002000000040010", unit: "Box", factor: 1 },
  "p13": { itemId: "4057002000000050038", unit: "Box", factor: 1 },
  "p14": { itemId: "4057002000000051024", unit: "Box", factor: 1 },
  "p15": { itemId: "4057002000000056015", unit: "Box", factor: 1 },
  "p16": { itemId: "4057002000000057017", unit: "Box", factor: 1 },
  "p17": { itemId: "4057002000000049008", unit: "Crate", factor: 1 },
  "p18": { itemId: "4057002000000054024", unit: "Box", factor: 1 },
  "p19": { itemId: "4057002000000034197", unit: "Box", factor: 1 },
  "p20": { itemId: "4057002000000040026", unit: "Box", factor: 1 },
  "p21": { itemId: "4057002000000045026", unit: "Box", factor: 1 },
  "p22": { itemId: "4057002000000048008", unit: "Box", factor: 1 },
  "p23": { itemId: "4057002000000052018", unit: "Box", factor: 1 },
  "p24": { itemId: "4057002000000061008", unit: "Box", factor: 1 },
  "p25": { itemId: "4057002000000062001", unit: "Box", factor: 1 },
  "p26": { itemId: "4057002000000042038", unit: "Box", factor: 1 },
  "p27": { itemId: "4057002000000058008", unit: "Box", factor: 1 },
  "p28": { itemId: "4057002000000044001", unit: "Box", factor: 1 },
  "p29": { itemId: "4057002000000063001", unit: "Box", factor: 1 },
  "p30": { itemId: "4057002000000055015", unit: "Box", factor: 1 },
  "p31": { itemId: "4057002000000064001", unit: "Box", factor: 1 },
  "p32": { itemId: "4057002000000057026", unit: "Box", factor: 1 },
  "p33": { itemId: "4057002000000061017", unit: "Box", factor: 1 },
  "p34": { itemId: "4057002000000037025", unit: "Box", factor: 1 },
  "p35": { itemId: "4057002000000039018", unit: "Box", factor: 1 },
  "p36": { itemId: "4057002000000047024", unit: "Box", factor: 1 },
  "p37": { itemId: "4057002000000063010", unit: "Box", factor: 1 },
  "p38": { itemId: "4057002000000048017", unit: "Box", factor: 1 },
  "p39": { itemId: "4057002000000057035", unit: "Box", factor: 1 },
  "p40": { itemId: "4057002000000049017", unit: "Box", factor: 1 },
  "p41": { itemId: "4057002000000037034", unit: "Box", factor: 1 },
  "p42": { itemId: "4057002000000038015", unit: "Box", factor: 1 },
  "p43": { itemId: "4057002000000042047", unit: "Box", factor: 1 },
  "p44": { itemId: "4057002000000047033", unit: "Box", factor: 1 },
  "p45": { itemId: "4057002000000059008", unit: "Box", factor: 1 },
  "p46": { itemId: "4057002000000055024", unit: "Box", factor: 1 },
  "p47": { itemId: "4057002000000064010", unit: "Box", factor: 1 },
  "p48": { itemId: "4057002000000043022", unit: "Box", factor: 1 },
  "p49": { itemId: "4057002000000054033", unit: "Box", factor: 1 },
  "p50": { itemId: "4057002000000046015", unit: "Box", factor: 1 },
  "p51": { itemId: "4057002000000058017", unit: "Box", factor: 1 },
  "p52": { itemId: "4057002000000040035", unit: "Box", factor: 1 },
  "p53": { itemId: "4057002000000045001", unit: "Box", factor: 1 },
  "p54": { itemId: "4057002000000063019", unit: "Box", factor: 1 },
  "p55": { itemId: "4057002000000055033", unit: "Box", factor: 1 },
  "p56": { itemId: "4057002000000048026", unit: "Box", factor: 1 },
  "p57": { itemId: "4057002000000064019", unit: "Box", factor: 1 },
  "p58": { itemId: "4057002000000060008", unit: "Box", factor: 1 },
  "p59": { itemId: "4057002000000054042", unit: "Box", factor: 1 },
  "p60": { itemId: "4057002000000046024", unit: "Box", factor: 1 },
  "p61": { itemId: "4057002000000058026", unit: "Box", factor: 1 },
  "p62": { itemId: "4057002000000047042", unit: "Box", factor: 1 },
  "p63": { itemId: "4057002000000063028", unit: "Box", factor: 1 },
  "p64": { itemId: "4057002000000055042", unit: "Box", factor: 1 },
  "p65": { itemId: "4057002000000052027", unit: "Box", factor: 1 },
  "p66": { itemId: "4057002000000043031", unit: "Box", factor: 1 },
  "p67": { itemId: "4057002000000061026", unit: "Box", factor: 1 },
  "p68": { itemId: "4057002000000062010", unit: "Box", factor: 1 },
  "p69": { itemId: "4057002000000034206", unit: "Box", factor: 1 },
  "p70": { itemId: "4057002000000039027", unit: "Box", factor: 1 },
  "p71": { itemId: "4057002000000050047", unit: "Box", factor: 1 },
  "p72": { itemId: "4057002000000063037", unit: "Box", factor: 1 },
  "p73": { itemId: "4057002000000051034", unit: "Pp bag", factor: 1 },
  "p74": { itemId: "4057002000000052036", unit: "Pp bag", factor: 1 },
  "p75": { itemId: "4057002000000043040", unit: "Pp bag", factor: 1 },
  "p76": { itemId: "4057002000000053015", unit: "Pp bag", factor: 1 },
  "p77": { itemId: "4057002000000062019", unit: "Box", factor: 1 },
  "p78": { itemId: "4057002000000046033", unit: "Box", factor: 1 },
  "p79": { itemId: "4057002000000039036", unit: "Box", factor: 1 },
  "p80": { itemId: "4057002000000047051", unit: "Pp bag", factor: 1 },
  "p81": { itemId: "4057002000000059017", unit: "Box", factor: 1 },
  "p82": { itemId: "4057002000000063046", unit: "Box", factor: 1 },
  "p83": { itemId: "4057002000000051043", unit: "Box", factor: 1 },
  "p84": { itemId: "4057002000000056024", unit: "Box", factor: 1 },
  "p85": { itemId: "4057002000000043049", unit: "Box", factor: 1 },
  "p86": { itemId: "4057002000000049026", unit: "Box", factor: 1 },
};

export const isMapped = () =>
  Object.keys(ZOHO_CUSTOMER_MAP).length > 0 && Object.keys(ZOHO_ITEM_MAP).length > 0;
