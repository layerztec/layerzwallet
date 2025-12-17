import { Networks, NETWORK_BITCOIN, NETWORK_CITREA_TESTNET, NETWORK_BOTANIX, NETWORK_ROOTSTOCK } from '../types/networks';
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
    name: 'BTC Map',
    network: NETWORK_BITCOIN,
    url: 'https://btcmap.org/map',
    imgUrl: '',
    description: 'Find places to spend sats wherever you are',
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
    imgUrl: 'https://pbs.twimg.com/profile_images/1787649407963574272/eHYwt7dk_400x400.jpg',
    description: 'Secure Cold Wallet for Effortless Transactions',
  },
  {
    name: 'Check out Botanix Dapps',
    network: NETWORK_BOTANIX,
    url: 'https://botanixlabs.com/use',
    imgUrl: 'https://bridge.botanixlabs.com/images/white-logo.png',
    description: '',
  },
  {
    name: 'Citrea Faucet',
    network: NETWORK_CITREA_TESTNET,
    url: 'https://citrea.xyz/faucet',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Ecosystem',
    network: NETWORK_CITREA_TESTNET,
    url: 'https://citrea.xyz/ecosystem',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Bridge',
    network: NETWORK_BOTANIX,
    url: 'https://bridge.botanixlabs.com',
    imgUrl: 'https://yield.botanixlabs.com/images/white-logo.png',
    description: 'Bridge Bitcoin to Botanix',
  },
  {
    name: 'Yield',
    network: NETWORK_BOTANIX,
    url: 'https://yield.botanixlabs.com/',
    imgUrl: 'https://bridge.botanixlabs.com/images/white-logo.png',
    description: 'Bitcoin in - More Bitcoin out. Backed by economic activity',
  },
  {
    name: 'Oku Trade',
    network: NETWORK_ROOTSTOCK,
    url: 'https://oku.trade/?inputChain=rootstock',
    imgUrl: '',
    description: '',
  },
];

export function getPartnersList(network: Networks): PartnerInfo[] {
  return partnersList.filter((dapp) => dapp.network === network);
}
