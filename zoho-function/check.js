import { readFileSync } from "node:fs";
import { config, listSalesOrders, getSalesOrder } from "./zoho.js";
for (const l of readFileSync(".env","utf8").split(/\r?\n/)) { const t=l.trim(); if(!t||t.startsWith("#"))continue; const i=t.indexOf("="); if(i<0)continue; const k=t.slice(0,i).trim(); if(process.env[k]===undefined) process.env[k]=t.slice(i+1).trim(); }
const cfg=config(), ref=process.argv[2];
const rows=(await listSalesOrders(cfg,{reference_number:ref,per_page:200})).filter(o=>String(o.reference_number)===ref);
console.log(`orders with reference ${ref}: ${rows.length}`);
for(const r of rows){const so=await getSalesOrder(cfg,r.salesorder_id);
console.log(`${so.salesorder_number} | ${so.status} | customer: ${so.customer_name} | total ₹${so.total}`);
so.line_items.forEach(l=>console.log(`   ${String(l.quantity).padStart(6)} ${l.unit||''}  @${String(l.rate).padStart(7)}  ${l.name}`));}
