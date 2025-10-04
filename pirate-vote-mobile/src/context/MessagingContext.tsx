import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { encryptMessage, decryptMessage, generateEphemeralKeyPair, deriveSharedSecret, hkdfDeriveKey } from '../utils/crypto';
import { addMessageToIpfs, IpfsPointer } from '../utils/storage';

export type Contact = {
  address: string;
  publicKey: Uint8Array; // X25519 public key
};

export type EncryptedMessage = {
  from: string;
  to: string;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  pointer?: IpfsPointer;
};

export type MessagingContextValue = {
  contacts: Contact[];
  messages: EncryptedMessage[];
  addContact: (contact: Contact) => void;
  sendMessage: (to: Contact, plaintext: string) => Promise<EncryptedMessage>;
  receiveMessage: (msg: EncryptedMessage) => Promise<string>;
};

const MessagingContext = createContext<MessagingContextValue | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<EncryptedMessage[]>([]);

  const addContact = useCallback((contact: Contact) => {
    setContacts((prev) => [...prev, contact]);
  }, []);

  const sendMessage = useCallback(async (to: Contact, plaintext: string) => {
    // For scaffold, we generate ephemeral sender keys each message
    const { publicKey: ephPub, secretKey: ephPriv } = await generateEphemeralKeyPair();
    const shared = deriveSharedSecret(ephPriv, to.publicKey);
    const aesKey = await hkdfDeriveKey(shared, 'pirate-vote-messaging');
    const { nonce, ciphertext } = await encryptMessage(aesKey, new TextEncoder().encode(plaintext));
    const pointer = await addMessageToIpfs({ from: 'me', to: to.address, nonce, ciphertext });
    const msg: EncryptedMessage = { from: 'me', to: to.address, nonce, ciphertext, pointer };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const receiveMessage = useCallback(async (_msg: EncryptedMessage) => {
    // Placeholder: In a real implementation, we'd use the recipient's static private key
    // to derive the shared secret and decrypt. Here we just return a mock string.
    return 'Decryption placeholder (supply recipient key to decrypt)';
  }, []);

  const value: MessagingContextValue = useMemo(() => ({ contacts, messages, addContact, sendMessage, receiveMessage }), [contacts, messages, addContact, sendMessage, receiveMessage]);

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
};

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}
