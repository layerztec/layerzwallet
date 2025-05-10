import { BreezWallet } from '@shared/class/wallets/breez-wallet';

export const initBreez = async () => {
  try {
    const w = new BreezWallet('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'mainnet');
    const info = await w.getInfo();
    console.log('Breez info', info);
  } catch (e) {
    console.error('Breez error', e);
  }
};
