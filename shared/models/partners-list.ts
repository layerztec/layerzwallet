import { Networks, NETWORK_BITCOIN, NETWORK_BOTANIXTESTNET, NETWORK_CITREATESTNET, NETWORK_ARKMUTINYNET, NETWORK_BOTANIX } from '../types/networks';
import { PartnerInfo } from '../types/partner-info';

const partnersList: PartnerInfo[] = [
  {
    name: 'HodlHodl',
    network: NETWORK_BITCOIN,
    url: 'https://hodlhodl.com/join/NPH2J',
    imgUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRAejGlNwvmchVooYPpUquqzQ7z0KahArwSVw&s',
    description: 'Buy & sell bitcoin non-custodially, p2p',
  },
  {
    name: 'Bitrefill',
    network: NETWORK_BITCOIN,
    url: 'https://bitrefill.com',
    imgUrl: 'https://pbs.twimg.com/media/GgHHK5GWkAAp_6z.png',
    description: 'Buy gift cards with Bitcoin',
  },
  {
    name: 'Keystone',
    network: NETWORK_BITCOIN,
    url: 'https://bit.ly/3Q6Rz5m',
    imgUrl: '',
    description: 'Secure Cold Wallet for Effortless Transactions',
  },
  {
    name: 'Check out Botanix Dapps',
    network: NETWORK_BOTANIXTESTNET,
    url: 'https://botanixlabs.xyz/en/testnet',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Citrea Faucet',
    network: NETWORK_CITREATESTNET,
    url: 'https://citrea.xyz/faucet',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Ecosystem',
    network: NETWORK_CITREATESTNET,
    url: 'https://citrea.xyz/ecosystem',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Arkade',
    network: NETWORK_ARKMUTINYNET,
    url: 'https://arkade.money/',
    imgUrl: '',
    description: 'Progressive web-app to manage Ark bitcoins on the go',
  },
  {
    name: 'Bridge',
    network: NETWORK_BOTANIX,
    url: 'https://bridge.botanixlabs.com',
    imgUrl: '',
    description: 'Bridge Bitcoin to Botanix',
  },
];

export function getPartnersList(network: Networks): PartnerInfo[] {
  return partnersList.filter((dapp) => dapp.network === network);
}
