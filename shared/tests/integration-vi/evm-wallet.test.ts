import assert from 'assert';
import { describe, it } from 'vitest';
import { EvmWallet } from '../../class/evm-wallet';
import { NETWORK_ROOTSTOCK } from '../../types/networks';
import { AllNetworkInfos } from '../../models/all-network-infos';

const tokentx = [
  {
    value: '1000000000000000000',
    blockHash: '0x19d382c2a97f5368613b71663f5dc6d66a2fc2386a9027e7b1336201d258eac1',
    blockNumber: '7883072',
    confirmations: '58',
    contractAddress: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
    cumulativeGasUsed: '184884',
    from: '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb',
    functionName: 'transfer(address _to, uint256 _value)',
    gas: '250000',
    gasPrice: '26065600',
    gasUsed: '59592',
    hash: '0x54b0fb3b46e3bef31ba5f90f10fe7d7cc1461f2a041a922184df67d63c8e1f7a',
    input: '0xa9059cbb00000000000000000000000062174765444ddf44ee2058f593d0267e387090920000000000000000000000000000000000000000000000000de0b6b3a7640000',
    methodId: 'a9059cbb',
    nonce: '1',
    timeStamp: '1755081546',
    to: '0x62174765444ddf44ee2058f593d0267e38709092',
    tokenDecimal: '18',
    tokenName: 'rUSDT',
    tokenSymbol: 'rUSDT',
    transactionIndex: '2',
  },
  {
    value: '1000000000000000000',
    blockHash: '0xfdc5a3e08d8c6cb28883cffde6f5be7412156990489e218bb284fa5f13120cde',
    blockNumber: '7883083',
    confirmations: '47',
    contractAddress: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
    cumulativeGasUsed: '877679',
    from: '0x62174765444ddf44ee2058f593d0267e38709092',
    functionName: 'transfer(address _to, uint256 _value)',
    gas: '250000',
    gasPrice: '26302629',
    gasUsed: '29592',
    hash: '0x13454c93cb2e8789d71aa38ecd23ec0d838de4df8e2eb7d40d2c0268cb00e299',
    input: '0xa9059cbb000000000000000000000000a8b89335f7133e94440a40e5eef96f5213b5b3fb0000000000000000000000000000000000000000000000000de0b6b3a7640000',
    methodId: 'a9059cbb',
    nonce: '0',
    timeStamp: '1755081845',
    to: '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb',
    tokenDecimal: '18',
    tokenName: 'rUSDT',
    tokenSymbol: 'rUSDT',
    transactionIndex: '1',
  },
];

const txlist = [
  {
    blockHash: '0xeaa75b22a5e177ea624ca102e4c98753db9a099eaf8ea73835c1d37127ca209c',
    blockNumber: '7883063',
    confirmations: '71',
    contractAddress: '',
    cumulativeGasUsed: '67028',
    from: '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb',
    gas: '21000',
    gasPrice: '26065600',
    gasUsed: '21000',
    hash: '0x27309296f66f705ced55707025b73c9d359741045996c61a0a637a15e7bd3b6a',
    input: '0x',
    isError: '0',
    nonce: '0',
    timeStamp: '1755081380',
    to: '0x62174765444ddf44ee2058f593d0267e38709092',
    transactionIndex: '1',
    txreceipt_status: '1',
    value: '10000000000000',
  },
  {
    blockHash: '0x19d382c2a97f5368613b71663f5dc6d66a2fc2386a9027e7b1336201d258eac1',
    blockNumber: '7883072',
    confirmations: '62',
    contractAddress: '',
    cumulativeGasUsed: '184884',
    from: '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb',
    gas: '250000',
    gasPrice: '26065600',
    gasUsed: '59592',
    hash: '0x54b0fb3b46e3bef31ba5f90f10fe7d7cc1461f2a041a922184df67d63c8e1f7a',
    input: '0xa9059cbb00000000000000000000000062174765444ddf44ee2058f593d0267e387090920000000000000000000000000000000000000000000000000de0b6b3a7640000',
    isError: '0',
    nonce: '1',
    timeStamp: '1755081546',
    to: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
    transactionIndex: '2',
    txreceipt_status: '1',
    value: '0',
  },
  {
    blockHash: '0xc914b0e23c948c24d27612ab015f234c4784cf6bedd4f588e150e30d1656dad6',
    blockNumber: '7883106',
    confirmations: '28',
    contractAddress: '',
    cumulativeGasUsed: '51332',
    from: '0x62174765444ddf44ee2058f593d0267e38709092',
    gas: '21000',
    gasPrice: '26314443',
    gasUsed: '21000',
    hash: '0xea34f46b7270bd2fc059e9934ffd0785ea3397a058ea3bb5ce1b7744f604c3e2',
    input: '0x',
    isError: '0',
    nonce: '1',
    timeStamp: '1755082434',
    to: '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb',
    transactionIndex: '1',
    txreceipt_status: '1',
    value: '8660000000000',
  },
];

const txlistinternal = [
  {
    blockNumber: '7638124',
    callType: 'call',
    contractAddress: '',
    errCode: '',
    from: '0x3d607b13c8ce127f15bb983589e5797cc9ad235a',
    gas: '2300',
    gasUsed: '0',
    index: '9',
    input: '0x',
    isError: '0',
    timeStamp: '1749156212',
    to: '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb',
    transactionHash: '0x91efda92ddab6a703e7ccb80ff23f55c34bdc78c5952570f74ea6a1fea5c9fea',
    type: 'call',
    value: '486774660064000',
  },
];

describe('EvmWallet getHistory', () => {
  it('getCommonTransactions should combine native, token and internal transfers (mocked fetch + deep equal)', async () => {
    const e = new EvmWallet();
    e.address = '0xa8b89335f7133e94440a40e5eef96f5213b5b3fb';
    e.network = NETWORK_ROOTSTOCK;
    e.etherScanApiUrl = AllNetworkInfos[NETWORK_ROOTSTOCK].etherScanApiUrl;

    // Mock fetch to serve txlist, tokentx, txlistinternal by action and page
    (global as any).fetch = (url: string) => {
      const u = new URL(url);
      const action = u.searchParams.get('action');
      const message = 'OK';
      if (action === 'txlist') return Promise.resolve({ json: () => Promise.resolve({ message, result: txlist }) });
      if (action === 'tokentx') return Promise.resolve({ json: () => Promise.resolve({ message, result: tokentx }) });
      if (action === 'txlistinternal') return Promise.resolve({ json: () => Promise.resolve({ message, result: txlistinternal }) });
      return Promise.resolve({ json: () => Promise.resolve({ message: 'No transactions found', result: [] }) });
    };

    // hydrate caches via syncAccountHistorySegment
    await e.fetchTransactions();

    const combined = e.getCommonTransactions();

    // Build exact expected CommonTransaction[] in timestamp desc order
    const expected = [
      {
        amount: 8660000000000,
        blockHeight: 7883106,
        confirmations: 28,
        counterparty: '0x62174765444ddf44ee2058f593d0267e38709092',
        explorerUrl: 'https://rootstock.blockscout.com/tx/0xea34f46b7270bd2fc059e9934ffd0785ea3397a058ea3bb5ce1b7744f604c3e2',
        direction: 'receive',
        network: 'rootstock',
        status: 'confirmed',
        timestamp: 1755082434,
        tokenTransfers: undefined,
        txid: '0xea34f46b7270bd2fc059e9934ffd0785ea3397a058ea3bb5ce1b7744f604c3e2',
      },
      {
        txid: '0x13454c93cb2e8789d71aa38ecd23ec0d838de4df8e2eb7d40d2c0268cb00e299',
        network: NETWORK_ROOTSTOCK,
        timestamp: Number('1755081845'),
        direction: 'receive',
        amount: undefined,
        tokenTransfers: [
          {
            amount: Number('1000000000000000000'),
            address: '0x62174765444ddf44ee2058f593d0267e38709092',
            tokenId: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
          },
        ],
        status: undefined,
        confirmations: Number('47'),
        counterparty: '0x62174765444ddf44ee2058f593d0267e38709092',
        blockHeight: Number('7883083'),
        explorerUrl: 'https://rootstock.blockscout.com/tx/0x13454c93cb2e8789d71aa38ecd23ec0d838de4df8e2eb7d40d2c0268cb00e299',
      },
      {
        txid: '0x54b0fb3b46e3bef31ba5f90f10fe7d7cc1461f2a041a922184df67d63c8e1f7a',
        network: NETWORK_ROOTSTOCK,
        timestamp: Number('1755081546'),
        direction: 'send',
        amount: undefined,
        tokenTransfers: [
          {
            amount: Number('1000000000000000000'),
            address: '0x62174765444ddf44ee2058f593d0267e38709092',
            tokenId: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
          },
        ],
        status: 'confirmed',
        confirmations: Number('58'),
        counterparty: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
        blockHeight: Number('7883072'),
        explorerUrl: 'https://rootstock.blockscout.com/tx/0x54b0fb3b46e3bef31ba5f90f10fe7d7cc1461f2a041a922184df67d63c8e1f7a',
      },
      {
        txid: '0x27309296f66f705ced55707025b73c9d359741045996c61a0a637a15e7bd3b6a',
        network: NETWORK_ROOTSTOCK,
        timestamp: Number('1755081380'),
        direction: 'send',
        amount: Number('10000000000000'),
        tokenTransfers: undefined,
        status: 'confirmed',
        confirmations: Number('71'),
        counterparty: '0x62174765444ddf44ee2058f593d0267e38709092',
        blockHeight: Number('7883063'),
        explorerUrl: 'https://rootstock.blockscout.com/tx/0x27309296f66f705ced55707025b73c9d359741045996c61a0a637a15e7bd3b6a',
      },
      {
        txid: '0x91efda92ddab6a703e7ccb80ff23f55c34bdc78c5952570f74ea6a1fea5c9fea',
        network: NETWORK_ROOTSTOCK,
        timestamp: Number('1749156212'),
        direction: 'receive',
        amount: Number('486774660064000'),
        tokenTransfers: undefined,
        status: undefined,
        confirmations: undefined,
        counterparty: '0x3d607b13c8ce127f15bb983589e5797cc9ad235a',
        blockHeight: Number('7638124'),
        explorerUrl: 'https://rootstock.blockscout.com/tx/0x91efda92ddab6a703e7ccb80ff23f55c34bdc78c5952570f74ea6a1fea5c9fea',
      },
    ];

    assert.deepEqual(combined, expected);
  });
});
