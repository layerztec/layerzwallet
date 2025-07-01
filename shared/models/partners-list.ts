import { Networks } from '../types/networks';
import { PartnerInfo } from '../types/partner-info';
import { hexToDec } from '../modules/string-utils';
import { getChainIdByNetwork } from './network-getters';

const partnersList: PartnerInfo[] = [
  {
    name: 'HodlHodl',
    chainId: 0,
    url: 'https://hodlhodl.com/join/NPH2J',
    imgUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRAejGlNwvmchVooYPpUquqzQ7z0KahArwSVw&s',
    description: 'Buy & sell bitcoin non-custodially, p2p',
  },
  {
    name: 'Bitrefill',
    chainId: 0,
    url: 'https://bitrefill.com',
    imgUrl: 'https://pbs.twimg.com/media/GgHHK5GWkAAp_6z.png',
    description: 'Buy gift cards with Bitcoin',
  },
  {
    name: 'Keystone',
    chainId: 0,
    url: 'https://bit.ly/3Q6Rz5m',
    imgUrl: '',
    description: 'Secure Cold Wallet for Effortless Transactions',
  },
  {
    name: 'Check out Botanix Dapps',
    chainId: 3636,
    url: 'https://botanixlabs.xyz/en/testnet',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Citrea Faucet',
    chainId: 5115,
    url: 'https://citrea.xyz/faucet',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Ecosystem',
    chainId: 5115,
    url: 'https://citrea.xyz/ecosystem',
    imgUrl: '',
    description: '',
  },
  {
    name: 'Arkade',
    chainId: -1,
    url: 'https://arkade.money/',
    imgUrl: '',
    description: 'Progressive web-app to manage Ark bitcoins on the go',
  },
  {
    name: 'Bridge',
    chainId: 3637,
    url: 'https://bridge.botanixlabs.com',
    imgUrl: '',
    description: 'Bridge Bitcoin to Botanix',
  },
];

export function getPartnersList(network: Networks): PartnerInfo[] {
  return partnersList.filter((dapp) => dapp.chainId === hexToDec(getChainIdByNetwork(network)));
}
