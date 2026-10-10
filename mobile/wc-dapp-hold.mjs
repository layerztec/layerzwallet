// Variant of wc-dapp.mjs for the restart-persistence check: approves the
// session, calls enable + getInfo, then HOLDS the session open (no
// disconnect) so the wallet can be force-stopped and relaunched while the
// session is alive. Run from mobile/ (uses its node_modules):
//   node wc-dapp-hold.mjs <projectId>
// After the wallet relaunch it polls getInfo every 20s so a dead session
// shows up as an error instead of silence; a session_delete from the
// wallet's Disconnect button ends the process.
import signClientPkg from '@walletconnect/sign-client';
const SignClient = signClientPkg.default ?? signClientPkg.SignClient ?? signClientPkg;
import { connectWalletConnect } from '@utexo/webrgb-walletconnect';

const projectId = process.argv[2];
if (!projectId) throw new Error('usage: node wc-dapp-hold.mjs <projectId>');

const client = await SignClient.init({
  projectId,
  metadata: { name: 'Layerz E2E dApp (hold)', description: 'WebRGB restart-persistence driver', url: 'https://layerzwallet.com', icons: [] },
});

client.on('session_delete', (e) => {
  console.log('SESSION_DELETE ' + JSON.stringify(e));
  process.exit(0);
});

const connection = await connectWalletConnect({
  client,
  network: 'utexo',
  methods: ['enable', 'getInfo', 'getAddress', 'listAssets', 'blindReceive'],
});

console.log('WC_URI_BEGIN');
console.log(connection.uri);
console.log('WC_URI_END');

const provider = await connection.approval();
console.log('SESSION_APPROVED topic=' + provider.topic);
await provider.enable();
console.log('ENABLED');
console.log('GETINFO ' + JSON.stringify(await provider.getInfo()));
console.log('HOLDING (wallet may be killed/relaunched now)');

// After a wallet restart the provider's enable-state is gone (per-process
// consent); a well-behaved dApp re-enables, which makes the wallet show its
// "Reconnect website?" prompt — exercised here on NOT_ENABLED.
let reenabling = false;
setInterval(async () => {
  try {
    const info = await provider.getInfo();
    console.log('POLL_OK ' + new Date().toISOString() + ' ready=' + info.ready);
  } catch (e) {
    console.log('POLL_ERR ' + new Date().toISOString() + ' ' + (e?.code ?? '') + ' ' + (e?.message ?? e));
    if (e?.code === 'NOT_ENABLED' && !reenabling) {
      reenabling = true;
      console.log('RE_ENABLE requesting (wallet should prompt "Reconnect website?")...');
      try {
        await provider.enable();
        console.log('RE_ENABLED');
      } catch (err) {
        console.log('RE_ENABLE_ERR ' + (err?.code ?? '') + ' ' + (err?.message ?? err));
      } finally {
        reenabling = false;
      }
      // Hypothesis check: the SDK's dApp-side `enable()` short-circuits on its
      // stale local `enabled` flag after a wallet restart and never re-sends
      // rgb_enable. Send it raw via SignClient to prove the wallet side is
      // healthy (expect `[wc-trace] enable enter` on the wallet, then POLL_OK).
      if (process.env.RAW_ENABLE === '1') {
        try {
          const r = await client.request({ topic: provider.topic, chainId: provider.chainId, request: { method: 'rgb_enable', params: [] } });
          console.log('RAW_ENABLE_OK ' + JSON.stringify(r));
        } catch (err) {
          console.log('RAW_ENABLE_ERR ' + (err?.code ?? '') + ' ' + (err?.message ?? err));
        }
      }
    }
  }
}, 20000);
