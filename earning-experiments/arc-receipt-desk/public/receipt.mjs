export const RPC = 'https://rpc.mainnet.arc.io';
export const USDC = '0x3600000000000000000000000000000000000000';
export const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const addressPattern = /^0x[0-9a-f]{40}$/i;
const hashPattern = /^0x[0-9a-f]{64}$/i;
export function units(value, decimals = 6) {
  const n = BigInt(value), base = 10n ** BigInt(decimals);
  return `${n / base}.${(n % base).toString().padStart(decimals, '0')}`;
}
export function parseAmount(value) {
  if (!/^\d{1,24}(\.\d{1,6})?$/.test(value)) throw new Error('Expected amount must be positive USDC with at most six decimals.');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (result <= 0n) throw new Error('Expected amount must be greater than zero.');
  return result;
}
export function reconcile(receipt, recipient, expected) {
  if (!addressPattern.test(recipient)) throw new Error('Enter a valid recipient address.');
  const wanted = parseAmount(expected);
  if (!receipt) return { status: 'unconfirmed', explanation: 'No mined receipt. Pending and unknown hashes cannot be distinguished here.', paid: '0.000000', expected: units(wanted), transfers: [] };
  if (!['0x0', '0x1'].includes(receipt.status)) throw new Error('Unexpected receipt status. No payment conclusion produced.');
  if (receipt.status === '0x0') return { status: 'failed', explanation: 'Transaction failed. This receipt does not satisfy the invoice.', paid: '0.000000', expected: units(wanted), transfers: [] };
  const transfers = [];
  const seen = new Set();
  for (const log of receipt.logs ?? []) {
    if (log.removed || log.address?.toLowerCase() !== USDC || log.topics?.[0]?.toLowerCase() !== TRANSFER) continue;
    if (log.topics.length !== 3 || !hashPattern.test(log.topics[1]) || !hashPattern.test(log.topics[2]) || !hashPattern.test(log.data)) throw new Error('Malformed USDC event. No payment conclusion produced.');
    const from = '0x' + log.topics[1].slice(-40).toLowerCase();
    const to = '0x' + log.topics[2].slice(-40).toLowerCase();
    if (to !== recipient.toLowerCase() || from === to) continue;
    if (!/^0x[0-9a-f]+$/i.test(log.logIndex ?? '')) throw new Error('USDC event has no valid log index.');
    const key = log.logIndex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    transfers.push({ from, to, amount: units(log.data), raw: BigInt(log.data).toString(), logIndex: key });
  }
  // Unified USDC logs include native sends: never add transaction.value again.
  const paid = transfers.reduce((sum, transfer) => sum + BigInt(transfer.raw), 0n);
  const status = paid === wanted ? 'matched' : paid === 0n ? 'no-payment' : paid < wanted ? 'underpaid' : 'overpaid';
  return { status, paid: units(paid), expected: units(wanted), transfers, explanation: 'Gross non-self USDC transfers to this recipient in this transaction. Verify payer and invoice context; this is not proof of business revenue or a net balance change.' };
}
export async function inspect({ hash, recipient, expected, fetcher = fetch }) {
  if (!hashPattern.test(hash)) throw new Error('Enter a 0x transaction hash with 64 hexadecimal characters.');
  if (!addressPattern.test(recipient)) throw new Error('Enter a valid recipient address.');
  parseAmount(expected);
  let id = 0;
  async function rpc(method, params) {
    const requestId = ++id;
    const response = await fetcher(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}. Try again later.`);
    const body = await response.json();
    if (body.id !== requestId || body.jsonrpc !== '2.0' || body.error || !Object.hasOwn(body, 'result')) throw new Error('Arc RPC did not return a valid matching response.');
    return body.result;
  }
  if (BigInt(await rpc('eth_chainId', [])) !== 5042n) throw new Error('Wrong network: Arc Mainnet 5042 required.');
  const receipt = await rpc('eth_getTransactionReceipt', [hash]);
  if (receipt && receipt.transactionHash?.toLowerCase() !== hash.toLowerCase()) throw new Error('Receipt hash does not match request.');
  const result = reconcile(receipt, recipient, expected);
  let timestamp = null;
  if (receipt) {
    if (!/^0x[0-9a-f]+$/i.test(receipt.blockNumber ?? '') || !hashPattern.test(receipt.blockHash ?? '')) throw new Error('Receipt block metadata missing.');
    const block = await rpc('eth_getBlockByHash', [receipt.blockHash, false]);
    if (!block || block.hash?.toLowerCase() !== receipt.blockHash.toLowerCase() || block.number !== receipt.blockNumber) throw new Error('Receipt block could not be independently verified.');
    timestamp = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString();
  }
  return { ...result, chainId: 5042, transactionHash: hash.toLowerCase(), recipient: recipient.toLowerCase(), blockNumber: receipt ? BigInt(receipt.blockNumber).toString() : null, timestamp, checkedAt: new Date().toISOString(), source: RPC };
}
export function csv(report, invoice = '') {
  const safe = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const headers = ['invoice', 'chain_id', 'transaction_hash', 'recipient', 'expected_usdc', 'gross_received_usdc', 'status', 'block_number', 'block_time_utc', 'checked_at_utc'];
  const row = [invoice, report.chainId, report.transactionHash, report.recipient, report.expected, report.paid, report.status, report.blockNumber, report.timestamp, report.checkedAt];
  return headers.map(safe).join(',') + '\r\n' + row.map(safe).join(',') + '\r\n';
}
