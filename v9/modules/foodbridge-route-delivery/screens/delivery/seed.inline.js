/* ==========================================================================
   DELIVERY MANAGEMENT — in-memory seed database

   Ported verbatim from the Route Delivery app's own mock database so the
   prototype shows the same data the real screens do:

     app source   storefront-frontend/src/route-delivery-app/services/mock/db.js

   30 customers, 20 SKUs across 5 categories, 5 routes covering every status
   the dashboard can show (READY, IN_PROGRESS, PENDING_SETTLEMENT, CLOSED),
   their stops, stock loads, settlement steps and activity log.

   Nothing here is fetched. buildDb() deep-clones the frozen seed into a
   mutable db that the services read and write, so a payment collected on one
   screen is visible on the next -- and resetDb() puts it back.

   DATES: the seed is written against a fixed day (SEED_ANCHOR). On load every
   date and timestamp is shifted by the whole number of days to today, so the
   dashboard's "today's routes" always has something in it and the driver's
   "Synced ..." stamp reads minutes old rather than months. Relative spacing is
   preserved: RTE-004 stays yesterday's closed route, RTE-005 tomorrow's.
   ========================================================================== */

(function () {
  "use strict";

  /**
   * db.js — Enterprise in-memory database for the Route Delivery App.
   *
   * Architecture
   * ─────────────
   *  • All seed data is defined as plain constants (never mutated).
   *  • `buildDb()` deep-clones the seed into a mutable `db` object.
   *  • Service methods read/write `db` exclusively.
   *  • `resetDb()` restores factory state (useful for tests / E2E).
   *
   * Data model
   * ──────────
   *  db.driver          DriverSummary
   *  db.routes          RouteSummary[]          ← updated by aggregation
   *  db.routeDetails    { [routeId]: RouteDetail }
   *  db.stockLoads      { [routeId]: StockLoadResponse }
   *  db.stops           { [routeId]: StopSummary[] }    ← mutated by delivery ops
   *  db.stopDetails     { [stopId]:  StopDetail }       ← lazy-generated & cached
   *  db.customers       CustomerRecord[]               ← searchable registry
   *  db.stopNotes       { [stopId]:  Note[] }
   *  db.activityLog     { [routeId]: ActivityEvent[] }
   *  db.settlementSteps { [routeId]: SettlementStep[] }
   *  db.cashCounted     { [routeId]: number }
   *  db.products        Product[]
   */

  // ─── Utilities ────────────────────────────────────────────────────────────────

  const clone = obj => JSON.parse(JSON.stringify(obj));

  let _idSeq = 1000;
  const uid  = prefix => `${prefix}-${(++_idSeq).toString(36).toUpperCase()}`;
  const now  = ()     => new Date().toISOString();
  const ts   = offset => new Date(Date.now() + offset * 60_000).toISOString(); // offset in minutes

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // ─── SEED: Driver ─────────────────────────────────────────────────────────────

  const S_DRIVER = {
    id: 'STF-DRV-001', name: 'Rahul Verma', phone: '9876543210',
    email: 'rahul.verma@foodbridge.io', subRoleId: 'SROL-DRIVER',
    joiningDate: '2024-01-15', syncedAt: '2026-05-24T07:58:00Z',
  };

  // ─── SEED: Products (20 SKUs across 5 categories) ────────────────────────────

  const S_PRODUCTS = [
    // ── NAMKEEN ───────────────────────────────────────────────────────────────
    { _id:'p01', productId:'PRD-001', sku:'MIX-500', articleNo:'A001',
      title:{ en:'Mixture (500g)', hi:'मिक्सचर' }, unit:'Box-Piece', boxes:12,
      prices:{ priceMap:{ Box:960, Piece:80 }, price:'80.00', originalPrice:'80.00', discount:'0.00' },
      stock:480, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','namkeen','bestseller'], status:'show', isCombination:false, variants:[] },

    { _id:'p02', productId:'PRD-002', sku:'CHI-250', articleNo:'A002',
      title:{ en:'Chivda (250g)', hi:'चिवड़ा' }, unit:'Box-Piece', boxes:20,
      prices:{ priceMap:{ Box:900, Piece:45 }, price:'45.00', originalPrice:'45.00', discount:'0.00' },
      stock:360, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','namkeen'], status:'show', isCombination:false, variants:[] },

    { _id:'p03', productId:'PRD-003', sku:'SEV-300', articleNo:'A003',
      title:{ en:'Namkeen Sev (300g)', hi:'नमकीन सेव' }, unit:'Box-Piece', boxes:15,
      prices:{ priceMap:{ Box:825, Piece:55 }, price:'55.00', originalPrice:'55.00', discount:'0.00' },
      stock:225, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','sev'], status:'show', isCombination:false, variants:[] },

    { _id:'p04', productId:'PRD-004', sku:'CHK-400', articleNo:'A004',
      title:{ en:'Chakli (400g)' }, unit:'Box-Piece', boxes:18,
      prices:{ priceMap:{ Box:1260, Piece:70 }, price:'70.00', originalPrice:'70.00', discount:'0.00' },
      stock:180, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','chakli'], status:'show', isCombination:false, variants:[] },

    { _id:'p05', productId:'PRD-005', sku:'BHU-300', articleNo:'A005',
      title:{ en:'Bhujia (300g)', hi:'भुजिया' }, unit:'Box-Piece', boxes:20,
      prices:{ priceMap:{ Box:1000, Piece:50 }, price:'50.00', originalPrice:'50.00', discount:'0.00' },
      stock:400, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','bhujia'], status:'show', isCombination:false, variants:[] },

    { _id:'p06', productId:'PRD-006', sku:'MTH-500', articleNo:'A006',
      title:{ en:'Mathri (500g)' }, unit:'Box-Piece', boxes:16,
      prices:{ priceMap:{ Box:1040, Piece:65 }, price:'65.00', originalPrice:'65.00', discount:'0.00' },
      stock:240, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','mathri'], status:'show', isCombination:false, variants:[] },

    { _id:'p07', productId:'PRD-007', sku:'MRK-250', articleNo:'A007',
      title:{ en:'Murukku (250g)', hi:'मुरुक्कू' }, unit:'Box-Piece', boxes:24,
      prices:{ priceMap:{ Box:960, Piece:40 }, price:'40.00', originalPrice:'40.00', discount:'0.00' },
      stock:480, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','murukku','south-indian'], status:'show', isCombination:false, variants:[] },

    { _id:'p08', productId:'PRD-008', sku:'KHK-400', articleNo:'A008',
      title:{ en:'Rice Khakhra (400g)' }, unit:'Box-Piece', boxes:12,
      prices:{ priceMap:{ Box:1020, Piece:85 }, price:'85.00', originalPrice:'85.00', discount:'0.00' },
      stock:144, tax:5, brand:'FoodBridge Foods', categories:['CAT-NAMKEEN'], category:'CAT-NAMKEEN',
      tags:['snacks','khakhra','gujarati'], status:'show', isCombination:false, variants:[] },

    // ── BISCUITS ──────────────────────────────────────────────────────────────
    { _id:'p09', productId:'PRD-009', sku:'COC-250', articleNo:'B001',
      title:{ en:'Coconut Cookies (250g)' }, unit:'Box-Piece', boxes:24,
      prices:{ priceMap:{ Box:1440, Piece:60 }, price:'60.00', originalPrice:'60.00', discount:'0.00' },
      stock:288, tax:12, brand:'FoodBridge Bakers', categories:['CAT-BISCUITS'], category:'CAT-BISCUITS',
      tags:['biscuits','cookies','coconut'], status:'show', isCombination:false, variants:[] },

    { _id:'p10', productId:'PRD-010', sku:'ATB-200', articleNo:'B002',
      title:{ en:'Atta Biscuit (200g)' }, unit:'Box-Piece', boxes:30,
      prices:{ priceMap:{ Box:1050, Piece:35 }, price:'35.00', originalPrice:'35.00', discount:'0.00' },
      stock:600, tax:12, brand:'FoodBridge Bakers', categories:['CAT-BISCUITS'], category:'CAT-BISCUITS',
      tags:['biscuits','atta','healthy'], status:'show', isCombination:false, variants:[] },

    { _id:'p11', productId:'PRD-011', sku:'GBI-300', articleNo:'B003',
      title:{ en:'Ginger Biscuit (300g)' }, unit:'Box-Piece', boxes:24,
      prices:{ priceMap:{ Box:1200, Piece:50 }, price:'50.00', originalPrice:'55.00', discount:'9.09' },
      stock:360, tax:12, brand:'FoodBridge Bakers', categories:['CAT-BISCUITS'], category:'CAT-BISCUITS',
      tags:['biscuits','ginger'], status:'show', isCombination:false, variants:[] },

    // ── SWEETS ────────────────────────────────────────────────────────────────
    { _id:'p12', productId:'PRD-012', sku:'KBF-500', articleNo:'C001',
      title:{ en:'Kaju Barfi (500g)', hi:'काजू बर्फी' }, unit:'Box-Piece', boxes:6,
      prices:{ priceMap:{ Box:1320, Piece:220 }, price:'220.00', originalPrice:'250.00', discount:'12.00' },
      stock:72, tax:5, brand:'FoodBridge Sweets', categories:['CAT-SWEETS'], category:'CAT-SWEETS',
      tags:['sweets','kaju','premium'], status:'show', isCombination:false, variants:[] },

    { _id:'p13', productId:'PRD-013', sku:'PCK-200', articleNo:'C002',
      title:{ en:'Peanut Chikki (200g)', hi:'मूंगफली चिक्की' }, unit:'Box-Piece', boxes:30,
      prices:{ priceMap:{ Box:900, Piece:30 }, price:'30.00', originalPrice:'30.00', discount:'0.00' },
      stock:900, tax:5, brand:'FoodBridge Sweets', categories:['CAT-SWEETS'], category:'CAT-SWEETS',
      tags:['sweets','chikki','peanut'], status:'ACTIVE', isCombination:false, variants:[] },

    { _id:'p14', productId:'PRD-014', sku:'MHL-500', articleNo:'C003',
      title:{ en:'Moong Dal Halwa (500g)', hi:'मूंग दाल हलवा' }, unit:'Box-Piece', boxes:8,
      prices:{ priceMap:{ Box:1440, Piece:180 }, price:'180.00', originalPrice:'180.00', discount:'0.00' },
      stock:96, tax:5, brand:'FoodBridge Sweets', categories:['CAT-SWEETS'], category:'CAT-SWEETS',
      tags:['sweets','halwa','festive'], status:'show', isCombination:false, variants:[] },

    // ── BEVERAGES ─────────────────────────────────────────────────────────────
    { _id:'p15', productId:'PRD-015', sku:'MNG-500', articleNo:'D001',
      title:{ en:'Mango Panna (500ml)', hi:'आम पन्ना' }, unit:'Box-Piece', boxes:12,
      prices:{ priceMap:{ Box:1020, Piece:85 }, price:'85.00', originalPrice:'85.00', discount:'0.00' },
      stock:144, tax:12, brand:'FoodBridge Beverages', categories:['CAT-BEVERAGES'], category:'CAT-BEVERAGES',
      tags:['beverages','mango','summer'], status:'show', isCombination:false, variants:[] },

    { _id:'p16', productId:'PRD-016', sku:'LEM-500', articleNo:'D002',
      title:{ en:'Lemon Sherbet (500ml)' }, unit:'Box-Piece', boxes:12,
      prices:{ priceMap:{ Box:840, Piece:70 }, price:'70.00', originalPrice:'70.00', discount:'0.00' },
      stock:180, tax:12, brand:'FoodBridge Beverages', categories:['CAT-BEVERAGES'], category:'CAT-BEVERAGES',
      tags:['beverages','lemon','summer'], status:'show', isCombination:false, variants:[] },

    { _id:'p17', productId:'PRD-017', sku:'ROS-750', articleNo:'D003',
      title:{ en:'Rose Sharbat (750ml)', hi:'गुलाब शरबत' }, unit:'Box-Piece', boxes:12,
      prices:{ priceMap:{ Box:1080, Piece:90 }, price:'90.00', originalPrice:'90.00', discount:'0.00' },
      stock:120, tax:12, brand:'FoodBridge Beverages', categories:['CAT-BEVERAGES'], category:'CAT-BEVERAGES',
      tags:['beverages','rose','festive'], status:'show', isCombination:false, variants:[] },

    // ── GRAINS ────────────────────────────────────────────────────────────────
    { _id:'p18', productId:'PRD-018', sku:'PHC-1KG', articleNo:'E001',
      title:{ en:'Poha Chivda (1kg)' }, unit:'Box-Piece', boxes:8,
      prices:{ priceMap:{ Box:1200, Piece:150 }, price:'150.00', originalPrice:'150.00', discount:'0.00' },
      stock:80, tax:5, brand:'FoodBridge Foods', categories:['CAT-GRAINS'], category:'CAT-GRAINS',
      tags:['snacks','poha','1kg'], status:'show', isCombination:false, variants:[] },

    { _id:'p19', productId:'PRD-019', sku:'MDL-400', articleNo:'E002',
      title:{ en:'Moong Dal (400g)', hi:'मूंग दाल' }, unit:'Box-Piece', boxes:15,
      prices:{ priceMap:{ Box:1125, Piece:75 }, price:'75.00', originalPrice:'75.00', discount:'0.00' },
      stock:225, tax:5, brand:'FoodBridge Foods', categories:['CAT-GRAINS'], category:'CAT-GRAINS',
      tags:['dal','moong','staple'], status:'show', isCombination:false, variants:[] },

    { _id:'p20', productId:'PRD-020', sku:'CHN-500', articleNo:'E003',
      title:{ en:'Chana Dal (500g)', hi:'चना दाल' }, unit:'Box-Piece', boxes:12,
      prices:{ priceMap:{ Box:960, Piece:80 }, price:'80.00', originalPrice:'80.00', discount:'0.00' },
      stock:240, tax:5, brand:'FoodBridge Foods', categories:['CAT-GRAINS'], category:'CAT-GRAINS',
      tags:['dal','chana','staple'], status:'show', isCombination:false, variants:[] },
  ];

  const PRODUCT_CATEGORIES = [
    { id:'CAT-NAMKEEN',   name:'Namkeen & Snacks',    icon:'🥜', count:8 },
    { id:'CAT-BISCUITS',  name:'Biscuits & Cookies',  icon:'🍪', count:3 },
    { id:'CAT-SWEETS',    name:'Sweets & Mithai',      icon:'🍬', count:3 },
    { id:'CAT-BEVERAGES', name:'Beverages & Sharbat',  icon:'🥤', count:3 },
    { id:'CAT-GRAINS',    name:'Grains & Dal',         icon:'🌾', count:3 },
  ];

  // ─── SEED: Customer registry ──────────────────────────────────────────────────

  const S_CUSTOMERS = [
    { id:'CST-1001', name:'Ravi General Store',     phone:'9812340001', address:'Shop 1, MG Road, Andheri W', orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:0   },
    { id:'CST-1002', name:'Meena Kirana',            phone:'9812340002', address:'Lane 3, Juhu, Mumbai',       orgType:'RETAILER',    gstType:'regular',      gstNumber:'27AABBC1234C1Z5',  creditAmount:320 },
    { id:'CST-1003', name:'Sharma Provision',        phone:'9812340003', address:'Plot 7, Versova, Andheri',   orgType:'RETAILER',    gstType:'composition',  gstNumber:'27CCCDE5678F2Z3',  creditAmount:0   },
    { id:'CST-1004', name:'Patel Super Mart',        phone:'9812340004', address:'12 Link Rd, Borivali',       orgType:'WHOLESALER',  gstType:'regular',      gstNumber:'27DDDEE9012G3Z1',  creditAmount:480 },
    { id:'CST-1005', name:'Gupta Traders',           phone:'9812340005', address:'44 Market Complex, Malad',   orgType:'DISTRIBUTOR', gstType:'regular',      gstNumber:'27EEFFG3456H4Z2',  creditAmount:0   },
    { id:'CST-1006', name:'Sunita Stores',           phone:'9812340006', address:'Shop 6, SV Road, Kandivali', orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:160 },
    { id:'CST-1007', name:'Ramesh Corner Shop',      phone:'9812340007', address:'Opp Station, Goregaon W',   orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:0   },
    { id:'CST-1008', name:'Anita Fresh Store',       phone:'9812340008', address:'New Market, Jogeshwari',    orgType:'RETAILER',    gstType:'regular',      gstNumber:'27FFGHI7890J5Z4',  creditAmount:640 },
    { id:'CST-1009', name:'Kishore Wholesale',       phone:'9812340009', address:'Warehouse Zone, APMC',      orgType:'WHOLESALER',  gstType:'regular',      gstNumber:'27GHIJK2345K6Z5',  creditAmount:0   },
    { id:'CST-1010', name:'Vijay Cold Drinks Corner',phone:'9812340010', address:'10 Linking Rd, Bandra',     orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:800 },
    { id:'CST-1011', name:'Priya Supermarket',       phone:'9812340011', address:'Near Temple, Mulund W',     orgType:'RETAILER',    gstType:'regular',      gstNumber:'27HIJKL6789L7Z6',  creditAmount:0   },
    { id:'CST-1012', name:'Deepak Namkeen Center',   phone:'9812340012', address:'Food Street, Dahisar',      orgType:'RETAILER',    gstType:'composition',  gstNumber:'27IJKLM1234M8Z7',  creditAmount:200 },
    { id:'CST-1013', name:'Rekha Provision Store',   phone:'9812340013', address:'Plot 22, Mira Road',        orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:0   },
    { id:'CST-1014', name:'Suresh Kirana',           phone:'9812340014', address:'Near Bus Stop, Vasai',      orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:0   },
    { id:'CST-1015', name:'Lata Corner Store',       phone:'9812340015', address:'3 Main St, Nalasopara',     orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:200 },
    { id:'CST-1016', name:'Arun Bakery',             phone:'9812340016', address:'Bakery Lane, Andheri W',    orgType:'RETAILER',    gstType:'regular',      gstNumber:'27JKLMN5678N9Z8',  creditAmount:0   },
    { id:'CST-1017', name:'Kavita General',          phone:'9812340017', address:'G/7 Complex, Borivali E',   orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:360 },
    { id:'CST-1018', name:'Mohan Traders',           phone:'9812340018', address:'Industrial Area, Bhiwandi',  orgType:'WHOLESALER',  gstType:'regular',      gstNumber:'27KLMNO9012O0Z9',  creditAmount:0   },
    { id:'CST-1019', name:'Harish Wholesale',        phone:'9812340019', address:'Godown Complex, Vashi',     orgType:'WHOLESALER',  gstType:'regular',      gstNumber:'27LMNOP3456P1Z0',  creditAmount:0   },
    { id:'CST-1020', name:'Nalini Stores',           phone:'9812340020', address:'Shop 20, Hill Rd, Bandra',  orgType:'RETAILER',    gstType:'composition',  gstNumber:'27MNOPQ7890Q2Z1',  creditAmount:480 },
    { id:'CST-1021', name:'Dinesh Stores',           phone:'9812340021', address:'21 Carter Rd, Borivali',    orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:720 },
    { id:'CST-1022', name:'Freya Sweets',            phone:'9812340022', address:'Sweets Alley, Malad W',     orgType:'RETAILER',    gstType:'regular',      gstNumber:'27NOPQR2345R3Z2',  creditAmount:0   },
    { id:'CST-1023', name:'Geeta Provision',         phone:'9812340023', address:'Near School, Kandivali W',  orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:320 },
    { id:'CST-1024', name:'Himanshu Corner',         phone:'9812340024', address:'24 Aarey Colony, Goregaon', orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:0   },
    { id:'CST-1025', name:'Kapoor Wholesale',        phone:'9812340025', address:'Godown 5, Kurla APMC',      orgType:'WHOLESALER',  gstType:'regular',      gstNumber:'27OPQRS6789S4Z3',  creditAmount:480 },
    { id:'CST-1026', name:'Mukesh Namkeen House',    phone:'9812340026', address:'Food Lane, Ghatkopar',      orgType:'RETAILER',    gstType:'composition',  gstNumber:'27PQRST1234T5Z4',  creditAmount:0   },
    { id:'CST-1027', name:'Nirmala Provisions',      phone:'9812340027', address:'27 LBS Marg, Vikhroli',     orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:200 },
    { id:'CST-1028', name:'Om Sweets & Snacks',      phone:'9812340028', address:'Temple Rd, Chembur',        orgType:'RETAILER',    gstType:'regular',      gstNumber:'27QRSTU5678U6Z5',  creditAmount:0   },
    { id:'CST-1029', name:'Prakash Corner Store',    phone:'9812340029', address:'Station Rd, Thane W',       orgType:'RETAILER',    gstType:'unregistered', gstNumber:null,               creditAmount:240 },
    { id:'CST-1030', name:'Quality Kirana Mart',     phone:'9812340030', address:'30 Pokhran Rd, Thane E',    orgType:'RETAILER',    gstType:'regular',      gstNumber:'27RSTUV9012V7Z6',  creditAmount:0   },
  ];

  // ─── SEED: Routes ─────────────────────────────────────────────────────────────

  const S_ROUTES = [
    { id:'RTE-001', name:'Andheri West Beat',     status:'READY',              totalStops:20, completedStops:0,  estimatedCollectionAmount:18400, outstandingAmount:5640, collectedAmount:0,     scheduledDate:'2026-05-24' },
    { id:'RTE-002', name:'Borivali North',         status:'IN_PROGRESS',        totalStops:30, completedStops:14, estimatedCollectionAmount:27600, outstandingAmount:2080, collectedAmount:14320, scheduledDate:'2026-05-24' },
    { id:'RTE-003', name:'Malad Market Circuit',   status:'PENDING_SETTLEMENT', totalStops:25, completedStops:25, estimatedCollectionAmount:23200, outstandingAmount:1280, collectedAmount:21920, scheduledDate:'2026-05-24' },
    { id:'RTE-004', name:'Vile Parle East Beat',   status:'CLOSED',             totalStops:22, completedStops:22, estimatedCollectionAmount:20400, outstandingAmount:0,    collectedAmount:19800, scheduledDate:'2026-05-23' },
    { id:'RTE-005', name:'Dadar Central Beat',     status:'READY',              totalStops:15, completedStops:0,  estimatedCollectionAmount:14200, outstandingAmount:3800, collectedAmount:0,     scheduledDate:'2026-05-25' },
  ];

  // ─── SEED: Route details ──────────────────────────────────────────────────────

  const mkChecklist = (sl, oc, so) => ({ stockLoad: sl, openingCash: oc, signOff: so });
  const DONE = (extra = {}) => ({ status:'COMPLETED', confirmedAt:'2026-05-24T08:00:00Z', ...extra });
  const PEND = ()             => ({ status:'PENDING',   confirmedAt:null });

  const S_ROUTE_DETAILS = {
    'RTE-001': {
      id:'RTE-001', name:'Andheri West Beat', beatArea:'Andheri West', scheduledDate:'2026-05-24',
      status:'READY', driver:S_DRIVER, totalStops:20, completedStops:0,
      estimatedCollectionAmount:18400, outstandingAmount:5640, collectedAmount:0,
      checklist:mkChecklist(
        DONE({ totalUnits:174, estimatedValue:18400, confirmedAt:'2026-05-24T08:12:00Z' }),
        DONE({ amount:500, confirmedAt:'2026-05-24T08:17:00Z' }),
        PEND()
      ),
      startedAt:null, updatedAt:'2026-05-24T08:17:00Z',
    },
    'RTE-002': {
      id:'RTE-002', name:'Borivali North', beatArea:'Borivali North', scheduledDate:'2026-05-24',
      status:'IN_PROGRESS', driver:S_DRIVER, totalStops:30, completedStops:14,
      estimatedCollectionAmount:27600, outstandingAmount:2080, collectedAmount:14320,
      checklist:mkChecklist(
        DONE({ totalUnits:260, estimatedValue:27600, confirmedAt:'2026-05-24T07:42:00Z' }),
        DONE({ amount:500, confirmedAt:'2026-05-24T07:48:00Z' }),
        DONE({ confirmedAt:'2026-05-24T07:55:00Z' })
      ),
      startedAt:'2026-05-24T07:55:00Z', updatedAt:'2026-05-24T11:02:00Z',
    },
    'RTE-003': {
      id:'RTE-003', name:'Malad Market Circuit', beatArea:'Malad West', scheduledDate:'2026-05-24',
      status:'PENDING_SETTLEMENT', driver:S_DRIVER, totalStops:25, completedStops:25,
      estimatedCollectionAmount:23200, outstandingAmount:1280, collectedAmount:21920,
      checklist:mkChecklist(
        DONE({ totalUnits:218, estimatedValue:23200, confirmedAt:'2026-05-24T07:15:00Z' }),
        DONE({ amount:500, confirmedAt:'2026-05-24T07:20:00Z' }),
        DONE({ confirmedAt:'2026-05-24T07:28:00Z' })
      ),
      startedAt:'2026-05-24T07:28:00Z', updatedAt:'2026-05-24T14:12:00Z',
    },
    'RTE-004': {
      id:'RTE-004', name:'Vile Parle East Beat', beatArea:'Vile Parle East', scheduledDate:'2026-05-23',
      status:'CLOSED', driver:S_DRIVER, totalStops:22, completedStops:22,
      estimatedCollectionAmount:20400, outstandingAmount:0, collectedAmount:19800,
      checklist:mkChecklist(
        DONE({ totalUnits:196, estimatedValue:20400, confirmedAt:'2026-05-23T07:55:00Z' }),
        DONE({ amount:500, confirmedAt:'2026-05-23T08:00:00Z' }),
        DONE({ confirmedAt:'2026-05-23T08:08:00Z' })
      ),
      startedAt:'2026-05-23T08:08:00Z', updatedAt:'2026-05-23T17:45:00Z',
    },
    'RTE-005': {
      id:'RTE-005', name:'Dadar Central Beat', beatArea:'Dadar West', scheduledDate:'2026-05-25',
      status:'READY', driver:S_DRIVER, totalStops:15, completedStops:0,
      estimatedCollectionAmount:14200, outstandingAmount:3800, collectedAmount:0,
      checklist:mkChecklist(PEND(), PEND(), PEND()),
      startedAt:null, updatedAt:'2026-05-25T07:00:00Z',
    },
  };

  // ─── SEED: Stock loads ────────────────────────────────────────────────────────

  const S_STOCK_LOADS = {
    'RTE-001': {
      status:'COMPLETED', confirmedAt:'2026-05-24T08:12:00Z',
      products:[
        { productId:'PRD-001', name:'Mixture (500g)',     unitPrice:80,  planQty:50, loadedQty:50 },
        { productId:'PRD-002', name:'Chivda (250g)',      unitPrice:45,  planQty:30, loadedQty:30 },
        { productId:'PRD-003', name:'Namkeen Sev (300g)', unitPrice:55,  planQty:25, loadedQty:25 },
        { productId:'PRD-004', name:'Chakli (400g)',      unitPrice:70,  planQty:20, loadedQty:20 },
        { productId:'PRD-009', name:'Coconut Cookies',    unitPrice:60,  planQty:18, loadedQty:18 },
        { productId:'PRD-012', name:'Kaju Barfi (500g)',  unitPrice:220, planQty:6,  loadedQty:6  },
        { productId:'PRD-013', name:'Peanut Chikki',      unitPrice:30,  planQty:25, loadedQty:25 },
      ],
      summary:{ totalUnits:174, estimatedValue:18400 },
    },

    'RTE-002': {
      status:'COMPLETED', confirmedAt:'2026-05-24T07:42:00Z',
      products:[
        { productId:'PRD-001', name:'Mixture (500g)',      unitPrice:80,  planQty:80, loadedQty:80 },
        { productId:'PRD-002', name:'Chivda (250g)',       unitPrice:45,  planQty:50, loadedQty:50 },
        { productId:'PRD-005', name:'Bhujia (300g)',       unitPrice:50,  planQty:40, loadedQty:40 },
        { productId:'PRD-006', name:'Mathri (500g)',       unitPrice:65,  planQty:30, loadedQty:30 },
        { productId:'PRD-007', name:'Murukku (250g)',      unitPrice:40,  planQty:30, loadedQty:30 },
        { productId:'PRD-015', name:'Mango Panna (500ml)', unitPrice:85,  planQty:20, loadedQty:20 },
        { productId:'PRD-016', name:'Lemon Sherbet',       unitPrice:70,  planQty:10, loadedQty:10 },
      ],
      summary:{ totalUnits:260, estimatedValue:27600 },
    },

    'RTE-003': {
      status:'COMPLETED', confirmedAt:'2026-05-24T07:15:00Z',
      products:[
        { productId:'PRD-001', name:'Mixture (500g)',    unitPrice:80,  planQty:60, loadedQty:60 },
        { productId:'PRD-004', name:'Chakli (400g)',     unitPrice:70,  planQty:40, loadedQty:40 },
        { productId:'PRD-008', name:'Rice Khakhra',      unitPrice:85,  planQty:20, loadedQty:20 },
        { productId:'PRD-010', name:'Atta Biscuit',      unitPrice:35,  planQty:40, loadedQty:40 },
        { productId:'PRD-012', name:'Kaju Barfi (500g)', unitPrice:220, planQty:8,  loadedQty:8  },
        { productId:'PRD-018', name:'Poha Chivda (1kg)', unitPrice:150, planQty:10, loadedQty:10 },
      ],
      summary:{ totalUnits:218, estimatedValue:23200 },
    },

    'RTE-004': {
      status:'COMPLETED', confirmedAt:'2026-05-23T07:55:00Z',
      products:[
        { productId:'PRD-001', name:'Mixture (500g)',      unitPrice:80,  planQty:55, loadedQty:55 },
        { productId:'PRD-003', name:'Namkeen Sev (300g)',  unitPrice:55,  planQty:35, loadedQty:35 },
        { productId:'PRD-005', name:'Bhujia (300g)',       unitPrice:50,  planQty:30, loadedQty:30 },
        { productId:'PRD-007', name:'Murukku (250g)',      unitPrice:40,  planQty:20, loadedQty:20 },
        { productId:'PRD-011', name:'Ginger Biscuit',      unitPrice:50,  planQty:25, loadedQty:25 },
        { productId:'PRD-017', name:'Rose Sharbat (750ml)',unitPrice:90,  planQty:12, loadedQty:12 },
        { productId:'PRD-019', name:'Moong Dal (400g)',    unitPrice:75,  planQty:19, loadedQty:19 },
      ],
      summary:{ totalUnits:196, estimatedValue:20400 },
    },
  };

  // ─── SEED: Cash counted (supervisor-verified handover) ────────────────────────

  const S_CASH_COUNTED = {
    // RTE-004 (CLOSED): supervisor signed off — cash matched exactly
    'RTE-004': 10400,
  };

  // ─── SEED: Stops ──────────────────────────────────────────────────────────────
  // Row format: [id, seq, custId, status, outstandingAmt, collectedAmt, orderAmt, totalDue, payMethod, skipReason, completedAt]

  const R1 = 'RTE-001';
  const R2 = 'RTE-002';
  const R3 = 'RTE-003';
  const R4 = 'RTE-004';
  const R5 = 'RTE-005';

  function cust(id) {
    const c = S_CUSTOMERS.find(x => x.id === id);
    return { name: c.name, initials: initials(c.name) };
  }

  const S_STOPS_RAW = {
    // ── RTE-001: 20 stops, all PENDING (route READY, checklist done) ───────────
    [R1]: [
      ['STP-0101',  1,'CST-1001','PENDING',    0,  0, 480, 480, null,null,null],
      ['STP-0102',  2,'CST-1002','PENDING',  320,  0, 360, 680, null,null,null],
      ['STP-0103',  3,'CST-1003','PENDING',    0,  0, 560, 560, null,null,null],
      ['STP-0104',  4,'CST-1004','PENDING',  480,  0, 240, 720, null,null,null],
      ['STP-0105',  5,'CST-1005','PENDING',    0,  0, 800, 800, null,null,null],
      ['STP-0106',  6,'CST-1006','PENDING',  160,  0, 400, 560, null,null,null],
      ['STP-0107',  7,'CST-1007','PENDING',    0,  0, 280, 280, null,null,null],
      ['STP-0108',  8,'CST-1008','PENDING',  640,  0, 320, 960, null,null,null],
      ['STP-0109',  9,'CST-1009','PENDING',    0,  0,1200,1200, null,null,null],
      ['STP-0110', 10,'CST-1010','PENDING',  800,  0, 480,1280, null,null,null],
      ['STP-0111', 11,'CST-1011','PENDING',    0,  0, 960, 960, null,null,null],
      ['STP-0112', 12,'CST-1012','PENDING',  200,  0, 360, 560, null,null,null],
      ['STP-0113', 13,'CST-1013','PENDING',    0,  0, 440, 440, null,null,null],
      ['STP-0114', 14,'CST-1014','PENDING',    0,  0, 600, 600, null,null,null],
      ['STP-0115', 15,'CST-1015','PENDING',  200,  0, 200, 400, null,null,null],
      ['STP-0116', 16,'CST-1016','PENDING',    0,  0, 840, 840, null,null,null],
      ['STP-0117', 17,'CST-1017','PENDING',  360,  0, 180, 540, null,null,null],
      ['STP-0118', 18,'CST-1018','PENDING',    0,  0,1440,1440, null,null,null],
      ['STP-0119', 19,'CST-1019','PENDING',    0,  0, 660, 660, null,null,null],
      ['STP-0120', 20,'CST-1020','PENDING',  480,  0, 320, 800, null,null,null],
    ],

    // ── RTE-002: 30 stops — 12 delivered, 2 skipped, 1 CURRENT, 15 PENDING ────
    [R2]: [
      ['STP-0201',  1,'CST-1001','DELIVERED',   0, 520, 520, 520,'CASH',null,'2026-05-24T08:10:00Z'],
      ['STP-0202',  2,'CST-1002','DELIVERED', 320, 640, 320, 640,'CASH',null,'2026-05-24T08:18:00Z'],
      ['STP-0203',  3,'CST-1003','DELIVERED',   0, 800, 800, 800,'UPI', null,'2026-05-24T08:25:00Z'],
      ['STP-0204',  4,'CST-1004','DELIVERED', 160, 460, 300, 460,'CASH',null,'2026-05-24T08:34:00Z'],
      ['STP-0205',  5,'CST-1005','SKIPPED',     0,   0,   0,   0,null,'SHOP_CLOSED','2026-05-24T08:37:00Z'],
      ['STP-0206',  6,'CST-1006','DELIVERED',   0, 420, 420, 420,'CASH',null,'2026-05-24T08:43:00Z'],
      ['STP-0207',  7,'CST-1007','DELIVERED',   0,1440,1440,1440,'UPI', null,'2026-05-24T08:59:00Z'],
      ['STP-0208',  8,'CST-1008','DELIVERED', 480, 480, 480, 960,'CASH',null,'2026-05-24T09:08:00Z'],
      ['STP-0209',  9,'CST-1009','SKIPPED',     0,   0,   0,   0,null,'OWNER_AWAY','2026-05-24T09:11:00Z'],
      ['STP-0210', 10,'CST-1010','DELIVERED',   0, 360, 360, 360,'CASH',null,'2026-05-24T09:19:00Z'],
      ['STP-0211', 11,'CST-1011','DELIVERED',   0, 960, 960, 960,'CREDIT',null,'2026-05-24T09:30:00Z'],
      ['STP-0212', 12,'CST-1012','DELIVERED', 360, 360, 360, 720,'CASH',null,'2026-05-24T09:40:00Z'],
      ['STP-0213', 13,'CST-1013','DELIVERED',   0, 880, 880, 880,'UPI', null,'2026-05-24T09:50:00Z'],
      ['STP-0214', 14,'CST-1014','DELIVERED',   0, 600, 600, 600,'CASH',null,'2026-05-24T10:00:00Z'],
      ['STP-0215', 15,'CST-1021','CURRENT',   720,   0, 480,1200, null,null,null],
      ['STP-0216', 16,'CST-1022','PENDING',     0,   0, 660, 660, null,null,null],
      ['STP-0217', 17,'CST-1023','PENDING',   320,   0, 280, 600, null,null,null],
      // Nothing booked for this one: the driver has to book the order at the
      // shop, which is the state QA shows for every unbooked stop (At Customer
      // in Book Order mode). Without it that whole mode is unreachable here.
      ['STP-0218', 18,'CST-1024','PENDING',     0,   0,   0,   0, null,null,null],
      ['STP-0219', 19,'CST-1025','PENDING',   480,   0, 560,1040, null,null,null],
      ['STP-0220', 20,'CST-1026','PENDING',     0,   0, 440, 440, null,null,null],
      ['STP-0221', 21,'CST-1027','PENDING',     0,   0, 640, 640, null,null,null],
      ['STP-0222', 22,'CST-1028','PENDING',   200,   0, 360, 560, null,null,null],
      ['STP-0223', 23,'CST-1029','PENDING',     0,   0, 920, 920, null,null,null],
      ['STP-0224', 24,'CST-1030','PENDING',   240,   0, 480, 720, null,null,null],
      ['STP-0225', 25,'CST-1001','PENDING',     0,   0, 560, 560, null,null,null],
      ['STP-0226', 26,'CST-1002','PENDING',   160,   0, 240, 400, null,null,null],
      ['STP-0227', 27,'CST-1003','PENDING',     0,   0, 800, 800, null,null,null],
      ['STP-0228', 28,'CST-1004','PENDING',   320,   0, 480, 800, null,null,null],
      ['STP-0229', 29,'CST-1005','PENDING',     0,   0,1080,1080, null,null,null],
      ['STP-0230', 30,'CST-1006','PENDING',     0,   0, 360, 360, null,null,null],
    ],

    // ── RTE-003: 25 stops — 20 delivered, 5 skipped (PENDING_SETTLEMENT) ───────
    [R3]: [
      ['STP-0301',  1,'CST-1001','DELIVERED',   0, 640, 640, 640,'CASH',null,'2026-05-24T07:42:00Z'],
      ['STP-0302',  2,'CST-1002','DELIVERED', 280, 280, 280, 560,'CASH',null,'2026-05-24T07:50:00Z'],
      ['STP-0303',  3,'CST-1003','DELIVERED',   0, 920, 920, 920,'UPI', null,'2026-05-24T07:58:00Z'],
      ['STP-0304',  4,'CST-1004','SKIPPED',     0,   0,   0,   0,null,'FULLY_STOCKED','2026-05-24T08:01:00Z'],
      ['STP-0305',  5,'CST-1005','DELIVERED',   0, 480, 480, 480,'CASH',null,'2026-05-24T08:08:00Z'],
      ['STP-0306',  6,'CST-1006','DELIVERED', 160, 760, 600, 760,'CASH',null,'2026-05-24T08:16:00Z'],
      ['STP-0307',  7,'CST-1007','SKIPPED',     0,   0,   0,   0,null,'OWNER_AWAY','2026-05-24T08:19:00Z'],
      ['STP-0308',  8,'CST-1008','DELIVERED',   0,1080,1080,1080,'UPI', null,'2026-05-24T08:29:00Z'],
      ['STP-0309',  9,'CST-1009','DELIVERED', 320, 320, 320, 640,'CASH',null,'2026-05-24T08:38:00Z'],
      ['STP-0310', 10,'CST-1010','DELIVERED',   0, 800, 800, 800,'CREDIT',null,'2026-05-24T08:47:00Z'],
      ['STP-0311', 11,'CST-1011','DELIVERED',   0, 560, 560, 560,'CASH',null,'2026-05-24T08:55:00Z'],
      ['STP-0312', 12,'CST-1012','DELIVERED', 480, 480, 480, 960,'CASH',null,'2026-05-24T09:04:00Z'],
      ['STP-0313', 13,'CST-1013','SKIPPED',     0,   0,   0,   0,null,'SHOP_CLOSED','2026-05-24T09:07:00Z'],
      ['STP-0314', 14,'CST-1014','DELIVERED',   0, 720, 720, 720,'UPI', null,'2026-05-24T09:15:00Z'],
      ['STP-0315', 15,'CST-1015','DELIVERED',   0,1440,1440,1440,'CASH',null,'2026-05-24T09:28:00Z'],
      ['STP-0316', 16,'CST-1016','DELIVERED', 160, 640, 480, 640,'CASH',null,'2026-05-24T09:36:00Z'],
      ['STP-0317', 17,'CST-1017','DELIVERED',   0, 400, 400, 400,'CASH',null,'2026-05-24T09:44:00Z'],
      ['STP-0318', 18,'CST-1018','DELIVERED',   0, 880, 880, 880,'UPI', null,'2026-05-24T09:52:00Z'],
      ['STP-0319', 19,'CST-1019','DELIVERED', 640, 640, 640,1280,'CASH',null,'2026-05-24T10:03:00Z'],
      ['STP-0320', 20,'CST-1020','DELIVERED',   0, 960, 960, 960,'CREDIT',null,'2026-05-24T10:14:00Z'],
      ['STP-0321', 21,'CST-1021','SKIPPED',     0,   0,   0,   0,null,'REFUSED','2026-05-24T10:17:00Z'],
      ['STP-0322', 22,'CST-1022','DELIVERED',   0, 660, 660, 660,'CASH',null,'2026-05-24T10:25:00Z'],
      ['STP-0323', 23,'CST-1023','DELIVERED', 320, 640, 320, 640,'CASH',null,'2026-05-24T10:33:00Z'],
      ['STP-0324', 24,'CST-1024','SKIPPED',     0,   0,   0,   0,null,'WILL_ORDER_LATER','2026-05-24T10:36:00Z'],
      ['STP-0325', 25,'CST-1025','DELIVERED',   0, 840, 840, 840,'UPI', null,'2026-05-24T10:45:00Z'],
    ],

    // ── RTE-004: 22 stops — 20 delivered, 2 skipped (CLOSED, 2026-05-23) ────────
    // collected total = 19800; CASH=10400, UPI=7780, CREDIT=1620
    [R4]: [
      ['STP-0401',  1,'CST-1001','DELIVERED',   0, 960, 960, 960,'CASH',  null,            '2026-05-23T08:15:00Z'],
      ['STP-0402',  2,'CST-1002','DELIVERED',   0,1000, 680,1000,'CASH',  null,            '2026-05-23T08:23:00Z'],
      ['STP-0403',  3,'CST-1003','DELIVERED',   0,1000,1000,1000,'UPI',   null,            '2026-05-23T08:31:00Z'],
      ['STP-0404',  4,'CST-1004','DELIVERED',   0,1800,1320,1800,'CASH',  null,            '2026-05-23T08:41:00Z'],
      ['STP-0405',  5,'CST-1005','SKIPPED',     0,   0,   0,   0, null,'SHOP_CLOSED',     '2026-05-23T08:44:00Z'],
      ['STP-0406',  6,'CST-1006','DELIVERED',   0, 560, 560, 560,'CASH',  null,            '2026-05-23T08:51:00Z'],
      ['STP-0407',  7,'CST-1007','DELIVERED',   0,2000,2000,2000,'UPI',   null,            '2026-05-23T09:03:00Z'],
      ['STP-0408',  8,'CST-1008','DELIVERED',   0, 960, 320, 960,'CASH',  null,            '2026-05-23T09:12:00Z'],
      ['STP-0409',  9,'CST-1009','DELIVERED',   0,1500,1500,1500,'UPI',   null,            '2026-05-23T09:23:00Z'],
      ['STP-0410', 10,'CST-1010','SKIPPED',     0,   0,   0,   0, null,'OWNER_AWAY',      '2026-05-23T09:26:00Z'],
      ['STP-0411', 11,'CST-1011','DELIVERED',   0, 480, 480, 480,'CASH',  null,            '2026-05-23T09:33:00Z'],
      ['STP-0412', 12,'CST-1012','DELIVERED',   0, 720, 520, 720,'CREDIT',null,            '2026-05-23T09:43:00Z'],
      ['STP-0413', 13,'CST-1013','DELIVERED',   0, 440, 440, 440,'UPI',   null,            '2026-05-23T09:51:00Z'],
      ['STP-0414', 14,'CST-1014','DELIVERED',   0, 600, 600, 600,'CASH',  null,            '2026-05-23T09:59:00Z'],
      ['STP-0415', 15,'CST-1015','DELIVERED',   0,1080, 880,1080,'CASH',  null,            '2026-05-23T10:10:00Z'],
      ['STP-0416', 16,'CST-1016','DELIVERED',   0, 840, 840, 840,'UPI',   null,            '2026-05-23T10:18:00Z'],
      ['STP-0417', 17,'CST-1017','DELIVERED',   0, 720, 360, 720,'CASH',  null,            '2026-05-23T10:27:00Z'],
      ['STP-0418', 18,'CST-1018','DELIVERED',   0,2000,2000,2000,'UPI',   null,            '2026-05-23T10:38:00Z'],
      ['STP-0419', 19,'CST-1019','DELIVERED',   0, 660, 660, 660,'CASH',  null,            '2026-05-23T10:46:00Z'],
      ['STP-0420', 20,'CST-1020','DELIVERED',   0, 900, 420, 900,'CREDIT',null,            '2026-05-23T10:55:00Z'],
      ['STP-0421', 21,'CST-1021','DELIVERED',   0, 480, 480, 480,'CASH',  null,            '2026-05-23T11:03:00Z'],
      ['STP-0422', 22,'CST-1022','DELIVERED',   0,1100,1100,1100,'CASH',  null,            '2026-05-23T11:12:00Z'],
    ],

    // ── RTE-005: 15 stops, all PENDING (READY, no stock load yet) ───────────────
    [R5]: [
      ['STP-0501',  1,'CST-1001','PENDING',    0,  0, 600, 600, null,null,null],
      ['STP-0502',  2,'CST-1002','PENDING',  400,  0, 320, 720, null,null,null],
      ['STP-0503',  3,'CST-1003','PENDING',    0,  0, 480, 480, null,null,null],
      ['STP-0504',  4,'CST-1004','PENDING',  280,  0, 560, 840, null,null,null],
      ['STP-0505',  5,'CST-1005','PENDING',    0,  0, 900, 900, null,null,null],
      ['STP-0506',  6,'CST-1006','PENDING',  160,  0, 440, 600, null,null,null],
      ['STP-0507',  7,'CST-1007','PENDING',    0,  0, 720, 720, null,null,null],
      ['STP-0508',  8,'CST-1008','PENDING',  640,  0, 360,1000, null,null,null],
      ['STP-0509',  9,'CST-1009','PENDING',    0,  0,1080,1080, null,null,null],
      ['STP-0510', 10,'CST-1010','PENDING',  320,  0, 400, 720, null,null,null],
      ['STP-0511', 11,'CST-1011','PENDING',    0,  0, 540, 540, null,null,null],
      ['STP-0512', 12,'CST-1012','PENDING',  480,  0, 280, 760, null,null,null],
      ['STP-0513', 13,'CST-1013','PENDING',    0,  0, 960, 960, null,null,null],
      ['STP-0514', 14,'CST-1014','PENDING',  200,  0, 500, 700, null,null,null],
      ['STP-0515', 15,'CST-1015','PENDING',    0,  0, 620, 620, null,null,null],
    ],
  };

  function buildStop([id, seq, custId, status, outstanding, collected, orderAmt, totalDue, pay, skip, completedAt]) {
    const c = cust(custId);
    return {
      id, sequence: seq, customerId: custId,
      customerName: c.name, customerInitials: c.initials,
      status,
      outstandingAmount: outstanding, collectedAmount: collected,
      todayOrderAmount: orderAmt, totalDue,
      paymentMethod: pay || null, skipReason: skip || null, completedAt: completedAt || null,
    };
  }

  const S_STOPS = Object.fromEntries(
    Object.entries(S_STOPS_RAW).map(([rid, rows]) => [rid, rows.map(buildStop)])
  );

  // ─── SEED: Settlement steps ───────────────────────────────────────────────────

  const mkSteps = () => ([
    { key:'STOCK_COUNT',      label:'Stock Count',      description:'Physically count remaining stock on vehicle', status:'PENDING', unlocked:true  },
    { key:'CASH_HANDOVER',    label:'Cash Handover',    description:'Count collected cash and hand over to supervisor', status:'PENDING', unlocked:false },
    { key:'CUSTOMER_CLOSURE', label:'Customer Closure', description:'Dispatch invoices and log outstanding follow-ups', status:'PENDING', unlocked:false },
  ]);

  const mkCompletedSteps = () => ([
    { key:'STOCK_COUNT',      label:'Stock Count',      description:'Physically count remaining stock on vehicle', status:'COMPLETED', unlocked:true },
    { key:'CASH_HANDOVER',    label:'Cash Handover',    description:'Count collected cash and hand over to supervisor', status:'COMPLETED', unlocked:true },
    { key:'CUSTOMER_CLOSURE', label:'Customer Closure', description:'Dispatch invoices and log outstanding follow-ups', status:'COMPLETED', unlocked:true },
  ]);

  const S_SETTLEMENT_STEPS = {
    'RTE-001': mkSteps(),
    'RTE-002': mkSteps(),
    'RTE-003': mkSteps(),   // PENDING_SETTLEMENT — fresh, driver about to do stock count
    'RTE-004': mkCompletedSteps(), // CLOSED — all settlement done
    'RTE-005': mkSteps(),
  };

  // ─── Activity log builder ─────────────────────────────────────────────────────
  // Generates realistic historical events from seed stop & route data.

  function buildActivityLog(routeId, stops, stockLoad, routeDetail) {
    const events = [];
    let seq = 0;
    const makeId = () => `ACT-S${routeId.replace('RTE-','')}-${String(++seq).padStart(3,'0')}`;

    // Stock load confirmed
    if (stockLoad?.confirmedAt) {
      events.push({
        id: makeId(), type: 'STOCK_LOAD_CONFIRMED',
        payload: {
          totalUnits:     stockLoad.summary.totalUnits,
          estimatedValue: stockLoad.summary.estimatedValue,
        },
        createdAt: stockLoad.confirmedAt,
      });
    }

    // Opening cash recorded
    if (routeDetail.checklist.openingCash.status === 'COMPLETED') {
      events.push({
        id: makeId(), type: 'OPENING_CASH_RECORDED',
        payload: { amount: routeDetail.checklist.openingCash.amount || 500 },
        createdAt: routeDetail.checklist.openingCash.confirmedAt,
      });
    }

    // Route started
    if (routeDetail.startedAt) {
      events.push({
        id: makeId(), type: 'ROUTE_STARTED',
        payload: { startedAt: routeDetail.startedAt, confirmedByDriver: true },
        createdAt: routeDetail.startedAt,
      });
    }

    // Per-stop events (sorted chronologically)
    const completedStops = stops
      .filter(s => s.completedAt)
      .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

    for (const stop of completedStops) {
      if (stop.status === 'DELIVERED') {
        events.push({
          id: makeId(), type: 'PAYMENT_COLLECTED',
          payload: {
            stopId:              stop.id,
            stopName:            stop.customerName,
            amount:              stop.collectedAmount,
            method:              stop.paymentMethod,
            outstandingRemaining: stop.outstandingAmount,
          },
          createdAt: stop.completedAt,
        });
      } else if (stop.status === 'SKIPPED') {
        events.push({
          id: makeId(), type: 'STOP_SKIPPED',
          payload: { stopId: stop.id, stopName: stop.customerName, reason: stop.skipReason },
          createdAt: stop.completedAt,
        });
      }
    }

    return events;
  }

  // ─── Mutable database ─────────────────────────────────────────────────────────

  // ─── Vasu Foods (29 Sep 2026; the beat, 30 Sep 2026) ─────────────────────────
  // In the platform the driver's phone runs on the business's one record — the
  // production store (v7/assets/production/production-api.js, loaded before
  // this file). Every van trip in the store's month is a route here: today's
  // Samana van (loaded, ready to leave), the Patiala van on the road, the
  // Sangrur van still waiting on its stock, yesterday's Samana trip to settle,
  // and every trip before it closed.
  //
  // A trip calls on the whole beat, as a van does: the invoiced drops the
  // office sent with it (each a real dispatch — its tax invoice, packs and
  // amounts, and what the driver records goes back to the store, vasu-sync.js)
  // and, between them, the shops, dhabas and chaap corners on the route, who
  // buy off the van at the counter. Those van sales, what each shop paid and
  // what it still owes, are the delivery app's own record: replayed trip by
  // trip below, so a shop's balance today is what its last visits left.
  //
  // Everything is worked out from the trip, the shop and the day, never at
  // random, so the same day always shows the same business.
  let VASU = null;
  function vasuSeed() {
    const P = window.FB_PRODUCTION;
    if (!P || !P.read) return null;
    return P.read(function (Dm, d) {
      const MIN = 60000, today = localDateStr(new Date()), nowT = Date.now();
      const dayOf = (iso) => localDateStr(new Date(iso));
      const gst = d.business.gstPct / 100;
      const staff = {}; d.team.forEach((m) => { staff[m.id] = m; });
      const route = {}; d.routes.forEach((r) => { route[r.id] = r; });
      const cust = {}; d.customers.forEach((c) => { cust[c.id] = c; });
      const pad2 = (n) => String(n).padStart(2, '0');
      const stamp = (iso) => { const x = new Date(iso); return pad2(x.getDate()) + '/' + pad2(x.getMonth() + 1) + '/' + x.getFullYear() + ' ' + pad2(x.getHours()) + ':' + pad2(x.getMinutes()); };
      // "29 Sep 2026 16:40", as QA names a saved trip (not the locale's "Sept")
      const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const stampLong = (iso) => { const x = new Date(iso); return pad2(x.getDate()) + ' ' + MON[x.getMonth()] + ' ' + x.getFullYear() + ' ' + pad2(x.getHours()) + ':' + pad2(x.getMinutes()); };
      // a steady number in [0, 1) for a key — the same trip, shop and day always land the same
      const hash = (key) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
      const round10 = (n) => Math.round(n / 10) * 10;

      /* A trip is live while any drop on it is still to be delivered — the
         store's state says so, not the calendar (its morning runs relative to
         now, so just after midnight this morning's vans carry yesterday's
         date). Live trips are the driver's today. */
      const isLive = (v) => v.synthetic || v.dispatchIds.some((id) => (Dm.dispatchById(id) || {}).status === 'Dispatch Created');
      const storeTrips = d.deliveries.slice();
      /* Every van runs its beat today. A route the office sent no invoiced drop
         with this morning still goes out for its counters — as the store's
         day has it: Samana's van loaded, Patiala's on the road, Sangrur's
         still waiting on its stock. */
      const DAY_PLAN = { 'rt-samana': 'Vehicle Loading Completed', 'rt-patiala': 'Out for Delivery', 'rt-sangrur': 'Delivery Created' };
      d.routes.forEach((r) => {
        if (storeTrips.some((v) => v.routeId === r.id && isLive(v))) return;
        const made = new Date(nowT - 150 * MIN).toISOString(), plan = DAY_PLAN[r.id] || 'Delivery Created';
        const history = [{ status: 'Delivery Created', at: made }];
        if (plan !== 'Delivery Created') history.push({ status: 'Vehicle Loading Completed', at: new Date(nowT - 125 * MIN).toISOString() });
        if (plan === 'Out for Delivery') history.push({ status: 'Out for Delivery', at: new Date(nowT - 105 * MIN).toISOString() });
        storeTrips.push({ id: 'van-' + r.id, synthetic: true, createdAt: made, status: plan, dispatchIds: [], staffId: r.staffId, routeId: r.id, history });
      });
      const trips = storeTrips.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.routeId < b.routeId ? -1 : 1));
      const todays = trips.filter(isLive);
      const ready = todays.find((v) => v.status === 'Vehicle Loading Completed');
      const me = staff[(ready && ready.staffId) || 'stf-balwinder'] || d.team.find((m) => m.role === 'DRIVER');
      Object.assign(S_DRIVER, { id: 'STF-' + me.id.toUpperCase(), name: me.name, phone: me.phone, email: me.name.toLowerCase().replace(/\s+/g, '.') + '@vasufoods.example', joiningDate: '2023-11-01', syncedAt: new Date().toISOString(), vehicle: me.vehicle });

      PRODUCT_CATEGORIES.splice(0, PRODUCT_CATEGORIES.length,
        { id: 'CAT-MIXVEG', name: 'Mix Veg', icon: '🥕', count: 0 }, { id: 'CAT-PEAS', name: 'Green Peas', icon: '🫛', count: 0 },
        { id: 'CAT-GOLD', name: 'Soya Chaap · Vasu Gold', icon: '🍢', count: 0 });
      const catOf = (k) => (k.recipeId === 'green-peas' ? 'CAT-PEAS' : k.recipeId === 'mix-veg' ? 'CAT-MIXVEG' : 'CAT-GOLD');
      const incl = (p) => Math.round(p * (1 + gst) * 100) / 100;
      S_PRODUCTS.splice(0, S_PRODUCTS.length, ...d.skus.filter((k) => !k.retired).map((k) => {
        PRODUCT_CATEGORIES.find((c) => c.id === catOf(k)).count += 1;
        return { _id: k.id, productId: k.id, sku: k.article, articleNo: k.article, title: { en: k.name }, unit: 'Box-Piece', boxes: k.perCarton,
          prices: { priceMap: { Box: Math.round(incl(k.price) * k.perCarton), Piece: incl(k.price) }, price: incl(k.price).toFixed(2), originalPrice: incl(k.price).toFixed(2), discount: '0.00' },
          stock: Dm.packetsOf(k.id), tax: d.business.gstPct, brand: k.brand || 'Vasu', categories: [catOf(k)], category: catOf(k), tags: [], status: 'show', isCombination: false, variants: [] };
      }));
      const owed = {}; Dm.receivables().forEach((a) => { owed[a.customer.id] = a; });
      const ORG = { COMMISSION_AGENT: 'WHOLESALER', DISTRIBUTOR: 'DISTRIBUTOR', RETAILER: 'RETAILER', HORECA: 'RETAILER', CONSUMER: 'RETAILER' };
      S_CUSTOMERS.splice(0, S_CUSTOMERS.length, ...d.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, address: c.address + ', ' + c.city, orgType: ORG[c.type],
        gstType: c.gstin ? 'regular' : 'unregistered', gstNumber: c.gstin || null, creditAmount: owed[c.id] ? Math.round(owed[c.id].outstanding) : 0 })));
      const custCard = (c, credit) => ({ id: c.id, name: c.name, phone: c.phone, email: '', address: c.address + ', ' + c.city, orgType: ORG[c.type], supplyChainType: 'PUBLIC',
        gstType: c.gstin ? 'regular' : 'unregistered', gstNumber: c.gstin || null, creditAmount: credit });

      /* The beat, in the order the van reaches it: town by town along the
         route, and within a town the counters first, the invoiced drop after. */
      const TOWNS = { 'rt-samana': ['Samana', 'Gajewas', 'Dhanetha'], 'rt-patiala': ['Patiala', 'Rajpura', 'Zirakpur'], 'rt-sangrur': ['Patran', 'Ghagga', 'Sangrur'] };
      const beatOf = (rid) => d.customers.map((c, i) => ({ c, i })).filter((x) => x.c.routeId === rid && x.c.type !== 'CONSUMER')
        .map((x) => Object.assign(x, { town: (TOWNS[rid] || []).indexOf(x.c.city), drop: x.c.every > 0 ? 1 : 0 }))
        .sort((a, b) => (a.town - b.town) || (a.drop - b.drop) || (a.i - b.i)).map((x) => x.c);
      const isCounter = (c) => c.every === 0 && c.type !== 'CONSUMER';

      /* What a counter takes off the van: small packs at a shop, kilo packs at
         a dhaba or a chaap corner. List price with GST — the van's price. */
      const SHOP_PACKS = ['fg-p01', 'fg-p02', 'fg-p11', 'fg-p05', 'fg-p07', 'fg-p08', 'fg-p13'];
      const KITCHEN_PACKS = ['fg-p09', 'fg-p15', 'fg-p03', 'fg-p06', 'fg-p14'];
      const line = (skuId, qty) => { const k = Dm.sku(skuId), up = incl(k.price); return { productId: skuId, productName: k.name, qty, orderingUnit: 'Piece', unitPrice: up, lineTotal: Math.round(up * qty * 100) / 100 }; };
      const basket = (c, key) => {
        const packs = (c.type === 'HORECA' ? KITCHEN_PACKS : SHOP_PACKS).filter((id) => { const k = Dm.sku(id); return k && !k.retired; });
        if (!packs.length) return [];
        const n = 2 + Math.floor(hash(key + '|n') * 2), start = Math.floor(hash(key + '|s') * packs.length), out = [];
        for (let j = 0; j < n && out.length < packs.length; j++) {
          const id = packs[(start + j * 2) % packs.length];
          if (out.some((o) => o.productId === id)) continue;
          const base = c.type === 'HORECA' ? 2 : Dm.sku(id).grams <= 250 ? 6 : 4;
          out.push(line(id, base + Math.floor(hash(key + '|' + id) * base)));
        }
        return out;
      };
      const sum = (items) => Math.round(items.reduce((t, it) => t + it.lineTotal, 0));
      /* the van's usual load for the counters of a route: what they take on a
         usual day and a sixth over, in sixes */
      const counterLoad = (rid) => {
        const need = {};
        beatOf(rid).filter(isCounter).forEach((c) => basket(c, rid + '|' + c.id + '|usual').forEach((it) => { need[it.productId] = (need[it.productId] || 0) + it.qty; }));
        Object.keys(need).forEach((id) => { need[id] = Math.ceil(need[id] * 1.15 / 6) * 6; });
        return need;
      };

      /* The route templates New Delivery starts from: the three beats, and the
         last few trips as the office saved them — newest first, as QA lists them. */
      const TEMPLATES = d.routes.map((r, i) => ({ _id: 'TPL-' + r.id, name: r.name, customers: beatOf(r.id).map((c) => c.id), staffs: [r.staffId], storeRouteId: r.id, created: new Date(nowT - (200 + i) * 86400000).toISOString() }));

      /* Which trip is what today. The newest finished trip on the driver's own
         route waits to be settled; every other finished trip is closed. */
      const pastTrips = trips.filter((v) => !isLive(v));
      const settleTrip = pastTrips.slice().reverse().find((v) => v.staffId === me.id) || pastTrips[pastTrips.length - 1];
      const statusOf = (v) => {
        if (!isLive(v)) return v === settleTrip ? 'PENDING_SETTLEMENT' : 'CLOSED';
        return v.status === 'Out for Delivery' ? 'IN_PROGRESS' : v.status === 'Vehicle Loading Completed' ? 'READY' : 'STOCK_REQUESTED';
      };

      const details = {}, counterOwes = {}, routeIds = [];
      // skip reasons by how often a beat meets them: [reason, below this draw]
      const SKIPS = [['FULLY_STOCKED', 0.12], ['WILL_ORDER_LATER', 0.17], ['SHOP_CLOSED', 0.21], ['OWNER_AWAY', 0.24]], SKIP_AT = 0.24;
      S_ROUTES.splice(0, S_ROUTES.length);
      [S_ROUTE_DETAILS, S_STOCK_LOADS, S_CASH_COUNTED, S_STOPS, S_SETTLEMENT_STEPS].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));

      trips.forEach((v, n) => {
        const rid = 'RTE-' + String(n + 1).padStart(3, '0');
        const status = statusOf(v), done = status === 'PENDING_SETTLEMENT' || status === 'CLOSED';
        const rt = route[v.routeId] || { id: v.routeId, name: 'Route' }, drv = staff[v.staffId] || me;
        const at = (min) => new Date(new Date(v.createdAt).getTime() + min * MIN).toISOString();
        const outAt = ((v.history || []).find((h) => h.status === 'Out for Delivery') || {}).at || at(45);
        const drops = {}; v.dispatchIds.map((id) => Dm.dispatchById(id)).filter(Boolean).forEach((x) => { drops[x.customerId] = x; });
        const beat = beatOf(v.routeId).filter((c) => drops[c.id] || isCounter(c));
        const code = rt.name.replace(/[^A-Z]/g, '').slice(0, 3) || 'VAN';
        const ymd = dayOf(v.createdAt).replace(/-/g, '').slice(2);

        /* on the road today: the counters before the first drop are done, as
           many as the van has had time for since it left */
        const firstDrop = beat.findIndex((c) => drops[c.id]);
        const onRoad = status === 'IN_PROGRESS' ? Math.max(0, Math.min(firstDrop < 0 ? beat.length : firstDrop, Math.floor((nowT - new Date(outAt).getTime()) / (11 * MIN)), beat.length - 1)) : 0;

        const sold = {};
        const stops = beat.map((c, i) => {
          const stopId = 'STP-' + rid.slice(4) + '-' + String(i + 1).padStart(2, '0');
          const when = new Date(new Date(outAt).getTime() + (i + 1) * 11 * MIN).toISOString();
          const x = drops[c.id];
          if (x) {
            const inv = x.invoice;
            const got = d.payments.filter((p) => p.kind === 'in' && p.allocations.some((a) => a.no === inv.no) && /Collected by/.test(p.ref || ''));
            const collected = Math.round(got.reduce((t, p) => t + p.amount, 0));
            const before = owed[c.id] ? Math.max(0, Math.round(owed[c.id].outstanding - Math.max(0, inv.amount - (inv.paid || 0)))) : 0;
            const items = x.items.map((it) => { const k = Dm.sku(it.skuId), up = incl(it.price); return { productId: it.skuId, productName: k ? k.name : it.skuId, qty: it.qty, orderingUnit: 'Piece', unitPrice: up, lineTotal: Math.round(up * it.qty * 100) / 100 }; });
            const st = done || x.status === 'Delivered' ? 'DELIVERED' : status === 'IN_PROGRESS' && i === onRoad ? 'CURRENT' : 'PENDING';
            details[stopId] = { id: stopId, sequence: i + 1, customerId: c.id, customerInitials: initials(c.name), invoiceNumber: inv.no, dispatchId: x.id, dispatchNumber: x.number,
              customer: custCard(c, before), orderItems: items, orderTotal: inv.amount };
            return { id: stopId, sequence: i + 1, customerId: c.id, customerName: c.name, customerInitials: initials(c.name), status: st,
              outstandingAmount: done ? 0 : before, collectedAmount: done ? collected : 0, todayOrderAmount: inv.amount, totalDue: (done ? 0 : before) + inv.amount,
              paymentMethod: done ? (collected ? 'CASH' : 'CREDIT') : null, skipReason: null, completedAt: done ? when : null, dispatchId: x.id };
          }
          /* a counter: sold off the van on a trip that has run, still to call on otherwise */
          const prev = counterOwes[c.id] || 0, key = v.id + '|' + c.id;
          const visited = done || (status === 'IN_PROGRESS' && i < onRoad);
          const base = { id: stopId, sequence: i + 1, customerId: c.id, customerName: c.name, customerInitials: initials(c.name) };
          if (!visited) {
            details[stopId] = { id: stopId, sequence: i + 1, customerId: c.id, customerInitials: initials(c.name), invoiceNumber: '', customer: custCard(c, prev), orderItems: [], orderTotal: 0 };
            return Object.assign(base, { status: status === 'IN_PROGRESS' && i === onRoad ? 'CURRENT' : 'PENDING', outstandingAmount: prev, collectedAmount: 0, todayOrderAmount: 0, totalDue: prev,
              paymentMethod: null, skipReason: null, completedAt: null });
          }
          /* a daily beat: most days a counter buys; some days it still has
             stock, will call later, or is shut */
          const r = hash(key + '|pay');
          if (r < SKIP_AT) {
            details[stopId] = { id: stopId, sequence: i + 1, customerId: c.id, customerInitials: initials(c.name), invoiceNumber: '', customer: custCard(c, prev), orderItems: [], orderTotal: 0 };
            return Object.assign(base, { status: 'SKIPPED', outstandingAmount: prev, collectedAmount: 0, todayOrderAmount: 0, totalDue: prev,
              paymentMethod: null, skipReason: SKIPS.find((s) => r < s[1])[0], completedAt: when });
          }
          const q = (r - SKIP_AT) / (1 - SKIP_AT);
          const items = basket(c, key), order = sum(items), due = prev + order;
          items.forEach((it) => { sold[it.productId] = (sold[it.productId] || 0) + it.qty; });
          /* dhabas, chaap corners and sweet shops pay cash on the spot; a shop
             pays in full, part now and the rest next visit, or takes it on credit */
          const cashOnly = !c.creditDays;
          const method = cashOnly ? 'CASH' : q < 0.55 ? 'CASH' : q < 0.72 ? 'UPI' : q < 0.9 ? 'CASH' : 'CREDIT';
          const paid = cashOnly || q < 0.72 ? due : q < 0.9 ? Math.min(due, round10(order * 0.6 + prev * 0.5)) : 0;
          counterOwes[c.id] = Math.max(0, due - paid);
          details[stopId] = { id: stopId, sequence: i + 1, customerId: c.id, customerInitials: initials(c.name), invoiceNumber: 'VS/' + ymd + '/' + code + '/' + String(i + 1).padStart(2, '0'),
            customer: custCard(c, prev), orderItems: items, orderTotal: order,
            items: items.map((it) => ({ productId: it.productId, name: it.productName, qty: it.qty, unitPrice: it.unitPrice, amount: it.lineTotal })) };
          return Object.assign(base, { status: 'DELIVERED', outstandingAmount: counterOwes[c.id], collectedAmount: paid, todayOrderAmount: order, totalDue: due,
            paymentMethod: method, skipReason: null, completedAt: when });
        });

        /* the load: the invoiced drops as the store packed them, and the van's
         stock for the counters — the usual load, or more if the day sold more */
        const load = {};
        const add = (id, name, unitPrice, qty) => { const l = load[id] || (load[id] = { productId: id, name, unitPrice, planQty: 0, loadedQty: 0 }); l.planQty += qty; l.loadedQty += qty; };
        Object.values(drops).forEach((x) => x.items.forEach((it) => { const k = Dm.sku(it.skuId); add(it.skuId, k ? k.name : it.skuId, incl(it.price), it.qty); }));
        const usual = counterLoad(v.routeId);
        Object.keys(Object.assign({}, usual, sold)).forEach((id) => { const k = Dm.sku(id); if (k) add(id, k.name, incl(k.price), Math.max(usual[id] || 0, Math.ceil(((sold[id] || 0) + 2) / 6) * 6)); });
        const loadList = Object.values(load);
        const dropValue = Math.round(Object.values(drops).reduce((t, x) => t + x.invoice.amount, 0));
        const counterValue = Math.round(Object.keys(usual).reduce((t, id) => t + usual[id] * incl(Dm.sku(id).price), 0));
        const est = dropValue + counterValue;
        const units = loadList.reduce((t, l) => t + l.loadedQty, 0), value = Math.round(loadList.reduce((t, l) => t + l.loadedQty * l.unitPrice, 0));
        const loaded = status !== 'STOCK_REQUESTED';
        const done2 = (extra) => Object.assign({ status: 'COMPLETED', confirmedAt: at(20) }, extra || {});
        const detail = { id: rid, name: rt.name + ' ' + stamp(v.createdAt), beatArea: rt.name.split(' – ')[0], scheduledDate: isLive(v) ? today : dayOf(v.createdAt), status,
          driver: Object.assign({}, S_DRIVER, { id: 'STF-' + drv.id.toUpperCase(), name: drv.name, phone: drv.phone, vehicle: drv.vehicle }),
          totalStops: stops.length, completedStops: stops.filter((s2) => s2.status === 'DELIVERED' || s2.status === 'SKIPPED').length, estimatedCollectionAmount: est,
          outstandingAmount: stops.filter((s2) => s2.status !== 'DELIVERED' && s2.status !== 'SKIPPED').reduce((t, s2) => t + s2.outstandingAmount, 0), collectedAmount: stops.reduce((t, s2) => t + s2.collectedAmount, 0),
          checklist: mkChecklist(loaded ? done2({ totalUnits: units, estimatedValue: value }) : PEND(), loaded ? done2({ amount: 1000 }) : PEND(), status === 'IN_PROGRESS' || done ? done2({ confirmedAt: outAt }) : PEND()),
          startedAt: status === 'IN_PROGRESS' || done ? outAt : null, updatedAt: done ? stops.reduce((t, s2) => (s2.completedAt && s2.completedAt > t ? s2.completedAt : t), outAt) : at(60),
          vasuDelivery: v.synthetic ? null : v.id, routeTemplateId: 'TPL-' + v.routeId };
        S_ROUTE_DETAILS[rid] = detail;
        S_ROUTES.push({ id: rid, name: detail.name, status, totalStops: detail.totalStops, completedStops: detail.completedStops, estimatedCollectionAmount: est, outstandingAmount: detail.outstandingAmount, collectedAmount: detail.collectedAmount, scheduledDate: detail.scheduledDate });
        S_STOCK_LOADS[rid] = { status: loaded ? 'COMPLETED' : 'PENDING', confirmedAt: loaded ? at(20) : null, products: loadList, summary: { totalUnits: units, estimatedValue: value } };
        S_STOPS[rid] = stops;
        S_SETTLEMENT_STEPS[rid] = status === 'CLOSED' ? mkCompletedSteps() : mkSteps();
        if (status === 'CLOSED') S_CASH_COUNTED[rid] = stops.reduce((t, s2) => t + (s2.paymentMethod === 'CASH' ? s2.collectedAmount : 0), 0) + 1000;
        routeIds.push(rid);
      });

      /* what each counter owes now is what its last visits left */
      S_CUSTOMERS.forEach((c) => { if (counterOwes[c.id] != null) c.creditAmount = counterOwes[c.id]; });

      /* the last trips the office saved as templates, newest first, with the
         beats themselves at the bottom where their older dates put them */
      const recent = routeIds.slice(-6).map((rid) => { const v = trips[routeIds.indexOf(rid)], rt = route[v.routeId] || { name: 'Route' };
        return { _id: 'TPL-' + rid, name: rt.name + ' - ' + stampLong(v.createdAt), customers: S_STOPS[rid].map((s2) => s2.customerId), staffs: [v.staffId], storeRouteId: v.routeId, created: v.createdAt }; });
      const templates = TEMPLATES.concat(recent).sort((a, b) => (a.created < b.created ? 1 : -1));
      return { details, routeIds, templates, closedIds: routeIds.filter((rid) => S_ROUTE_DETAILS[rid].status === 'CLOSED') };
    });
  }

  function buildDb() {
    VASU = vasuSeed();
    // Pre-generate activity logs from immutable seed data
    const activityLog = {};
    const allRouteIds = VASU ? VASU.routeIds : ['RTE-001', 'RTE-002', 'RTE-003', 'RTE-004', 'RTE-005'];

    for (const routeId of allRouteIds) {
      const rd  = S_ROUTE_DETAILS[routeId];
      const sl  = S_STOCK_LOADS[routeId];
      const sts = S_STOPS[routeId] || [];
      activityLog[routeId] = rd ? buildActivityLog(routeId, sts, sl, rd) : [];
    }

    // Vasu: every closed trip was counted, handed over and closed that evening.
    if (VASU) VASU.closedIds.forEach(function (rid) {
      const rd = S_ROUTE_DETAILS[rid], stops = S_STOPS[rid] || [];
      const end = new Date(new Date(rd.updatedAt).getTime() + 40 * 60000);
      const t = function (min) { return new Date(end.getTime() + min * 60000).toISOString(); };
      const cash = S_CASH_COUNTED[rid] || 0;
      activityLog[rid].push(
        { id: 'ACT-' + rid + '-SC', type: 'STOCK_COUNT_SUBMITTED', payload: { discrepancyCount: 0, note: '' }, createdAt: t(0) },
        { id: 'ACT-' + rid + '-CH', type: 'CASH_HANDOVER_SUBMITTED', payload: { actualCounted: cash, expectedHandOver: cash, difference: 0, supervisorName: 'Mohan Lal' }, createdAt: t(25) },
        { id: 'ACT-' + rid + '-RC', type: 'ROUTE_CLOSED', payload: { closedAt: t(40), stops: stops.length }, createdAt: t(40) },
      );
    });

    // RTE-004 (CLOSED): append settlement & closure events
    if (!VASU && activityLog['RTE-004']) activityLog['RTE-004'].push(
      {
        id: 'ACT-S4-SC', type: 'STOCK_COUNT_SUBMITTED',
        payload: { discrepancyCount: 1, note: VASU ? '2 packets short at the count — possible loading error' : '2 units Murukku unaccounted — possible loading error' },
        createdAt: '2026-05-23T13:58:00Z',
      },
      {
        id: 'ACT-S4-CH', type: 'CASH_HANDOVER_SUBMITTED',
        payload: {
          actualCounted:    10400,
          expectedHandOver: 10400,
          difference:       0,
          supervisorName:   VASU ? 'Mohan Lal' : 'Manoj Sharma',
        },
        createdAt: '2026-05-23T14:32:00Z',
      },
      {
        id: 'ACT-S4-RC', type: 'ROUTE_CLOSED',
        payload: { closedAt: '2026-05-23T17:45:00Z' },
        createdAt: '2026-05-23T17:45:00Z',
      },
    );

    // A couple of customers carry an advance (they over-paid on an earlier
    // visit). QA has several of these and they drive two branches the screens
    // must handle: the queue's "Over Paid" subtitle, and At Customer showing
    // Total Due ₹0 while an order exists because the advance covers it.
    const S_STOPS_BUILT = clone(S_STOPS);
    // Applied to the 2nd and 4th still-pending stop of each route rather than to
    // fixed ids, so the branch stays reachable however the seed is edited.
    const ADVANCE_AMOUNTS = [1200, 450];
    if (!VASU) Object.keys(S_STOPS_BUILT).forEach(function (rid) {
      const pending = S_STOPS_BUILT[rid].filter(function (st) {
        return st.status !== 'DELIVERED' && st.status !== 'SKIPPED';
      });
      [1, 3].forEach(function (idx, n) {
        const st = pending[idx];
        if (!st) return;
        st.advanceAmount = ADVANCE_AMOUNTS[n];
        st.outstandingAmount = 0;
        st.totalDue = st.todayOrderAmount || 0;
      });
    });

    return {
      driver:          clone(S_DRIVER),
      products:        clone(S_PRODUCTS),
      customers:       clone(S_CUSTOMERS),
      routes:          clone(S_ROUTES),
      // What New Delivery offers (NewDeliverySheet): each template's customers
      // become the new route's stops. Off the store, a route is its own template.
      routeTemplates:  VASU ? clone(VASU.templates) : S_ROUTES.map(function (r) {
        return { _id: 'TPL-' + r.id, name: r.name, customers: (S_STOPS[r.id] || []).map(function (s) { return s.customerId; }), staffs: [S_DRIVER.id] };
      }),
      routeDetails:    clone(S_ROUTE_DETAILS),
      stockLoads:      clone(S_STOCK_LOADS),
      stops:           S_STOPS_BUILT,
      stopDetails:     VASU ? clone(VASU.details) : {},
      stopNotes:       {},
      activityLog,
      settlementSteps: clone(S_SETTLEMENT_STEPS),
      cashCounted:     clone(S_CASH_COUNTED),
      // Written during the route, read back by Route Intelligence.
      assetMovements:  {},
      settlements:     {},
      returns:         {},
    };
  }


  // ─── Date rebasing (offline mock build only) ──────────────────────────────────
  /**
   * The seed is written against a fixed day, 2026-05-24, which is what makes it
   * reviewable and what the service tests assert against. But the dashboard asks
   * for *today's* routes (todayLocalDateStr()), so against a fixed seed it shows
   * an empty list on every day except that one, and the driver's "Synced …" stamp
   * reads thousands of hours old.
   *
   * When the app is built for offline demo (VITE_MOCK_MODE), every date and
   * timestamp in the db is shifted by the whole number of days between the seed
   * anchor and today. Relative spacing is preserved exactly — RTE-004 stays the
   * day before RTE-001/2/3, RTE-005 stays the day after — so "yesterday's closed
   * route" and "tomorrow's route" keep meaning what they meant.
   *
   * Gated deliberately: tests never set VITE_MOCK_MODE, so they still see the
   * fixed 2026-05-24 seed and keep asserting against it.
   */
  const SEED_ANCHOR = '2026-05-24';

  // Always on in this module: the static cut has no other mode to be in.
  const IS_OFFLINE_DEMO = true;

  function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Whole days between the anchor and today, computed on the local calendar so it
  // agrees with todayLocalDateStr() — a UTC-based diff lands a day out for anyone
  // west of Greenwich in the evening.
  function dayShift() {
    const [ay, am, ad] = SEED_ANCHOR.split('-').map(Number);
    const anchor = new Date(ay, am - 1, ad);
    const today  = new Date();
    const t      = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((t - anchor) / 86_400_000);
  }

  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(.*)$/;

  function shiftDateString(value, days) {
    if (DATE_ONLY.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return localDateStr(new Date(y, m - 1, d + days));
    }
    const dt = value.match(DATE_TIME);
    if (dt) {
      const [y, m, d] = dt[1].split('-').map(Number);
      return `${localDateStr(new Date(y, m - 1, d + days))}T${dt[2]}`;
    }
    return value;
  }

  function rebaseDates(node, days) {
    if (typeof node === 'string') return shiftDateString(node, days);
    if (Array.isArray(node)) return node.map(v => rebaseDates(v, days));
    if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) node[k] = rebaseDates(node[k], days);
      return node;
    }
    return node;
  }

  let db = makeDb();

  function makeDb() {
    const fresh = buildDb();
    if (!IS_OFFLINE_DEMO || VASU) return fresh;   // Vasu's trips are dated already
    const days = dayShift();
    return days === 0 ? fresh : rebaseDates(fresh, days);
  }

  function resetDb() { db = makeDb(); }

  // ─── DB helpers ───────────────────────────────────────────────────────────────

  function requireRoute(routeId) {
    const d = db.routeDetails[routeId];
    if (!d) { const e = new Error(`Route ${routeId} not found`); e.code = 'NOT_FOUND'; throw e; }
    return d;
  }

  function getStops(routeId) { return db.stops[routeId] || []; }

  function requireStop(routeId, stopId) {
    const s = getStops(routeId).find(x => x.id === stopId);
    if (!s) { const e = new Error(`Stop ${stopId} not found`); e.code = 'NOT_FOUND'; throw e; }
    return s;
  }

  /* One van, one place: a stop finished out of turn (the driver tapped a
     later one in the queue) leaves the current stop current. Only when
     nothing is current does the next pending stop become it. */
  function advanceToNextStop(routeId) {
    const cur = getStops(routeId).find(s => s.status === 'CURRENT');
    if (cur) return cur;
    const next = getStops(routeId).find(s => s.status === 'PENDING');
    if (next) next.status = 'CURRENT';
    return next ?? null;
  }

  function syncRouteAggregates(routeId) {
    const stops   = getStops(routeId);
    const done    = stops.filter(s => s.status === 'DELIVERED' || s.status === 'SKIPPED').length;
    const col     = stops.reduce((a, s) => a + (s.collectedAmount || 0), 0);
    const out     = stops.filter(s => s.status !== 'DELIVERED' && s.status !== 'SKIPPED')
                         .reduce((a, s) => a + (s.outstandingAmount || 0), 0);
    const detail  = db.routeDetails[routeId];
    const summary = db.routes.find(r => r.id === routeId);
    [detail, summary].filter(Boolean).forEach(obj => {
      obj.completedStops   = done;
      obj.collectedAmount  = col;
      obj.outstandingAmount = out;
    });
  }

  function logActivity(routeId, type, payload) {
    if (!db.activityLog[routeId]) db.activityLog[routeId] = [];
    db.activityLog[routeId].push({ id: uid('ACT'), type, payload, createdAt: now() });
  }

  /**
   * Lazily generates and caches a StopDetail from the live stop summary.
   * Re-syncs mutable fields on every call.
   *
   * Order items are derived from the route's actual stock load (if available),
   * so items shown to the driver match products they physically loaded.
   */
  function resolveStopDetail(routeId, stopId) {
    const live = requireStop(routeId, stopId);

    if (!db.stopDetails[stopId]) {
      const custRecord = db.customers.find(c => c.id === live.customerId) || {
        id: live.customerId, name: live.customerName, phone: '9800000000',
        address: 'Mumbai', orgType: 'RETAILER', gstType: 'unregistered',
        gstNumber: null, creditAmount: 0, supplyChainType: 'PUBLIC',
      };

      const customer = {
        id:              custRecord.id,
        name:            custRecord.name,
        phone:           custRecord.phone,
        email:           `${custRecord.name.toLowerCase().replace(/\s+/g, '.')}.stores@gmail.com`,
        address:         custRecord.address,
        orgType:         custRecord.orgType,
        supplyChainType: 'PUBLIC',
        gstType:         custRecord.gstType,
        gstNumber:       custRecord.gstNumber,
        creditAmount:    custRecord.creditAmount,
      };

      // Use route-specific products from the stock load (so items match what was loaded)
      // Fall back to full product catalog for routes with no stock load yet
      const routeProds = db.stockLoads[routeId]?.products?.length
        ? db.stockLoads[routeId].products.map(sp => ({
            productId: sp.productId,
            title:     { en: sp.name },
            prices:    { priceMap: { Piece: sp.unitPrice } },
          }))
        : db.products;

      const target    = live.todayOrderAmount || 0;
      const itemCount = 1 + (live.sequence % 4); // 1–4 items per stop
      const items     = [];
      let remaining   = target;

      for (let i = 0; i < itemCount && remaining > 0; i++) {
        const p       = routeProds[(live.sequence * 3 + i) % routeProds.length];
        const price   = p.prices.priceMap.Piece;
        const isLast  = i === itemCount - 1;
        const qty     = isLast
          ? Math.max(1, Math.round(remaining / price))
          : Math.max(1, Math.floor((remaining / price) * 0.55));
        const lineTotal = qty * price;
        items.push({
          productId:    p.productId,
          productName:  p.title.en,
          qty,
          orderingUnit: 'Piece',
          unitPrice:    price,
          lineTotal,
        });
        remaining -= lineTotal;
      }

      // Deterministic invoice number per route+stop
      const routeDate = (db.routeDetails[routeId]?.scheduledDate || '2026-05-24').replace(/-/g, '');
      const routeNum  = routeId.replace('RTE-', '');
      const seqPad    = String(live.sequence).padStart(3, '0');

      db.stopDetails[stopId] = {
        id: live.id, sequence: live.sequence, customerId: live.customerId,
        customerInitials: live.customerInitials,
        invoiceNumber: `FB/${routeDate}/${routeNum}/${seqPad}`,
        customer,
        orderItems: items,
        orderTotal: items.reduce((s, it) => s + it.lineTotal, 0),
        // live fields — overwritten below on every call
        status: live.status, customerName: live.customerName,
        outstandingAmount: live.outstandingAmount, collectedAmount: live.collectedAmount,
        todayOrderAmount: live.todayOrderAmount, totalDue: live.totalDue,
        paymentMethod: live.paymentMethod, skipReason: live.skipReason, completedAt: live.completedAt,
      };
    }

    // Always reflect current live state
    const d = db.stopDetails[stopId];
    Object.assign(d, {
      status:            live.status,
      customerName:      live.customerName,
      outstandingAmount: live.outstandingAmount,
      collectedAmount:   live.collectedAmount,
      todayOrderAmount:  live.todayOrderAmount,
      totalDue:          live.totalDue,
      paymentMethod:     live.paymentMethod,
      skipReason:        live.skipReason,
      completedAt:       live.completedAt,
    });
    return d;
  }

  window.RD_DB = {
    db: null,            // replaced below -- `db` is reassigned by resetDb()
    get current() { return db; },
    resetDb, requireRoute, getStops, requireStop,
    advanceToNextStop, syncRouteAggregates, logActivity, resolveStopDetail,
    uid, now, ts, PRODUCT_CATEGORIES,
  };
  // `db` is a live binding reassigned by resetDb(); expose it through a getter
  // so callers always see the current object rather than the first one.
  Object.defineProperty(window.RD_DB, "db", { get: function () { return db; } });
})();
