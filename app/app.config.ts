import 'dotenv/config';

const isProd = process.env.ENIGMA_NETWORK === 'mainnet';

export default {
  name: 'Enigma',
  slug: 'enigma',
  scheme: 'enigma',
  version: '0.1.0',
  orientation: 'portrait',
  extra: {
    walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
    chainId: isProd ? 8453 : 84532,
    chainName: isProd ? 'base' : 'base-sepolia',
    rpcUrl:
      process.env.RPC_URL ||
      (isProd ? 'https://mainnet.base.org' : 'https://sepolia.base.org'),
    xmtpEnv: isProd ? 'production' : 'dev',
    pinataJwt: process.env.PINATA_JWT || '',
    pinataGateway: process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud',
    subgraphUrl: process.env.SUBGRAPH_URL || '',
    paymasterAddress: process.env.PAYMASTER_ADDRESS || '',
    orgFactoryAddress: process.env.ORG_FACTORY_ADDRESS || '',
    recoveryRegistryAddress: process.env.RECOVERY_REGISTRY_ADDRESS || '',
    signerServiceUrl: process.env.SIGNER_SERVICE_URL || ''
  }
};
