#!/usr/bin/env node
/*
  node serve.mjs  — keep the oracle and the prototype running, side by side, until Ctrl-C.

    production (oracle)   http://localhost:4190/      real module, fed this prototype's dataset
    prototype             http://127.0.0.1:4292/index.html?chrome=none

  Open both at the same window size to compare by eye; `run.mjs` does it by pixel. Note that
  :4190 is on Chrome's unsafe-port list — start Chrome with --explicitly-allowed-ports=4190, or use
  the Playwright browser the harness launches.
*/
import path from 'node:path';
import { startServers, MOCKUP } from './lib/servers.mjs';

const REACT_SALES_ORDERS = process.env.REACT_SALES_ORDERS
  || path.resolve(MOCKUP, '../../../../foodbridge-module-route-delivery/development/sales-orders');
const NOW = Number(process.env.PARITY_NOW || Date.parse('2026-09-25T11:00:00+05:30'));

const servers = await startServers({ reactSalesOrders: REACT_SALES_ORDERS, now: NOW, log: process.argv.includes('--verbose') ? (s) => process.stdout.write(s) : () => {} });
console.log(`\n  production (oracle)  ${servers.reactUrl}`);
console.log(`  prototype            ${servers.htmlUrl}?chrome=none\n`);
const stop = async () => { await servers.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
