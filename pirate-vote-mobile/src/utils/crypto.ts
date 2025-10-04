import nacl from 'tweetnacl';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

export function parseMaybeHex(input: string): string {
  const trimmed = input.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return '0x' + trimmed;
  throw new Error('Invalid private key format');
}

export type AesKey = CryptoKey;

export async function generateEphemeralKeyPair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> {
  // X25519 key pair for nacl.box
  const kp = nacl.box.keyPair();
  return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

export function deriveSharedSecret(mySecretKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  // X25519 ECDH
  return nacl.box.before(theirPublicKey, mySecretKey);
}

export async function hkdfDeriveKey(sharedSecret: Uint8Array, info: string): Promise<AesKey> {
  const prk = hkdf(sha256, sharedSecret, new Uint8Array(32), new TextEncoder().encode(info), 32);
  return crypto.subtle.importKey('raw', prk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptMessage(key: AesKey, plaintext: Uint8Array): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext));
  return { nonce, ciphertext: ct };
}

export async function decryptMessage(key: AesKey, nonce: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext));
  return pt;
}

export function getSignerFromPrivateKey(privateKeyHex: string) {
  // Placeholder to construct an ethers Wallet signer elsewhere
  return privateKeyHex;
}
