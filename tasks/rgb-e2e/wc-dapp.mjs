// CLI test-dApp for the WebRGB/WalletConnect E2E:
// prints a wc: URI, waits for wallet approval, then drives the session.
// Run from mobile/ (uses its node_modules):
//   node <this file> <projectId> [amountBaseUnits]
import signClientPkg from '@walletconnect/sign-client';
const SignClient = signClientPkg.default ?? signClientPkg.SignClient ?? signClientPkg;
import { connectWalletConnect } from '@utexo/webrgb-walletconnect';

const projectId = process.argv[2];
const amount = Number(process.argv[3] ?? 5000000);
if (!projectId) throw new Error('usage: node wc-dapp.mjs <projectId> [amount]');

const client = await SignClient.init({
  projectId,
  metadata: {
    name: 'Layerz E2E dApp',
    description: 'WebRGB pairing test driver',
    url: 'https://layerzwallet.com',
    icons: [],
  },
});

const connection = await connectWalletConnect({
  client,
  network: 'utexo',
  methods: ['enable', 'getInfo', 'getAddress', 'listAssets', 'blindReceive'],
});

console.log('WC_URI_BEGIN');
console.log(connection.uri);
console.log('WC_URI_END');
console.log('waiting for wallet approval...');

const provider = await connection.approval();
console.log('SESSION_APPROVED topic=' + provider.topic + ' chain=' + provider.chainId);

await provider.enable();
console.log('ENABLED');

const info = await provider.getInfo();
console.log('GETINFO ' + JSON.stringify(info));

const assets = await provider.listAssets();
console.log('ASSETS ' + JSON.stringify(assets).slice(0, 400));

const list = Array.isArray(assets) ? assets : (assets.nia ?? assets.assets ?? []);
const nia = list.find?.((a) => a.ticker === 'USDT') ?? null;
const assetId = nia?.id ?? nia?.assetId ?? undefined;
console.log('USDT_ASSET ' + assetId);

console.log('requesting blindReceive (wallet will prompt)...');
const durationSeconds = Number(process.env.DURATION ?? 86400);
const inv = await provider.blindReceive({ assetId, amount, durationSeconds, minConfirmations: 3 });
console.log('INVOICE_BEGIN');
console.log(JSON.stringify(inv));
console.log('INVOICE_END');

await provider.disconnect();
console.log('DISCONNECTED');
process.exit(0);
