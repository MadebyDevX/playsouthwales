import { inspect, csv } from './receipt.mjs';
const el = id => document.getElementById(id);
let report = null, invoice = '';
el('form').addEventListener('submit', async event => {
  event.preventDefault(); report = null; el('actions').hidden = true; el('details').replaceChildren(); el('transfers').textContent = '';
  el('submit').disabled = true; el('status').className = ''; el('status').textContent = 'Checking Arc…'; el('explanation').textContent = 'Reading the public mainnet receipt and block evidence.';
  try {
    invoice = el('invoice').value.trim();
    report = await inspect({ hash: el('hash').value.trim(), recipient: el('recipient').value.trim(), expected: el('expected').value.trim() });
    el('status').textContent = ({matched:'Amount matched',underpaid:'Amount below invoice',overpaid:'Amount above invoice','no-payment':'No matching payment',failed:'Transaction failed',unconfirmed:'Receipt unavailable'})[report.status];
    el('explanation').textContent = report.explanation;
    for (const [label, value] of [['Received',report.paid + ' USDC'],['Expected',report.expected + ' USDC'],['Block',report.blockNumber ?? '—'],['Block time',report.timestamp ?? '—']]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; el('details').append(dt,dd);
    }
    el('transfers').textContent = report.transfers.map(t => `${t.amount} USDC\nFrom ${t.from}\nTo ${t.to}\nLog ${t.logIndex}`).join('\n\n');
    el('explorer').href = `https://explorer.arc.io/tx/${report.transactionHash}`; el('actions').hidden = false;
  } catch (error) { el('status').textContent = 'Unable to verify'; el('status').className = 'error'; el('explanation').textContent = error.name === 'TimeoutError' ? 'Arc RPC timed out. No payment conclusion was produced.' : error.message; }
  finally { el('submit').disabled = false; }
});
function download(content, mime, extension) {
  const url = URL.createObjectURL(new Blob([content],{type:mime})); const link = document.createElement('a'); link.href = url; link.download = `arc-receipt-${report.transactionHash.slice(2,12)}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
el('csv').addEventListener('click', () => { if(report) download(csv(report,invoice),'text/csv;charset=utf-8','csv'); });
el('json').addEventListener('click', () => { if(report) download(JSON.stringify({...report,invoice},null,2),'application/json','json'); });
