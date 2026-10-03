# Arc Receipt Desk

A dependency-free, read-only Arc Mainnet invoice receipt checker by DevX. Enter a transaction hash, recipient and expected USDC amount. The app verifies chain 5042, receipt status and its block, decodes only the official unified USDC Transfer events, and exports CSV/JSON.

Native sends and ERC-20 transfers share the same USDC events. Never add transaction.value to the event totals. USDC event amounts use six decimals; integer arithmetic preserves precision. This utility reports gross incoming non-self transfers within one transaction, not net balances or earned revenue. Review payer and invoice context separately. Failed, unavailable, malformed and wrong-network receipts do not appear as payment matches. Refunds, internal transfers and deposits are not automatically income.

## Run

Serve this directory with any static HTTP server. Open index.html over HTTP(S); browser module imports may not work from a file:// URL. No install, backend, API key, wallet connection, transaction signing or gas required. Modules use relative paths and work below a hosting subdirectory.

Tests run from the parent delivery folder: `node --test receipt.test.mjs`.

The browser sends the transaction hash to https://rpc.mainnet.arc.io. Invoice reference and recipient/expected comparison stay in the browser. No analytics, storage, cookies or backend collection. RPC availability and CORS are external dependencies. Public chain data is used; no private keys or customer documents are needed. A response comes from one RPC provider; this is not an independent cryptographic proof or an audit.

## Official references

- https://docs.arc.io/arc/references/connect-to-arc
- https://docs.arc.io/integrate/infrastructure/indexing-events

USDC contract 0x3600000000000000000000000000000000000000, Transfer decimals 6. Mainnet decimals independently probed on October 3, 2026. Native gas display uses 18 decimals and is not added to invoice events.

Created for the Arc Microgrants application. No award, approval or earnings are claimed. This independent experiment lives in its own directory/branch of an existing DevX earning fork; unrelated parent repository code is not our deliverable.

License: MIT; see LICENSE. No third-party runtime dependencies, assets, fonts or copied application code.
