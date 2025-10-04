import 'dotenv/config';

export default {
  name: 'Pirate Vote',
  slug: 'pirate-vote-mobile',
  scheme: 'piratevote',
  version: '0.1.0',
  orientation: 'portrait',
  extra: {
    walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
    rpcUrl: process.env.RPC_URL || 'https://ethereum.publicnode.com'
  }
};
