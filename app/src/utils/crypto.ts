// All message-layer crypto (X25519/HKDF/AES-GCM) has been removed.
// XMTP now handles end-to-end encryption, key exchange, and delivery.
// This file retains only wallet/private-key helpers used by WalletContext.

export function parseMaybeHex(input: string): string {
  const trimmed = input.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return '0x' + trimmed;
  throw new Error('Invalid private key format');
}

export function getSignerFromPrivateKey(privateKeyHex: string) {
  // Returned hex is consumed by WalletContext to build an ethers Wallet.
  return privateKeyHex;
}
