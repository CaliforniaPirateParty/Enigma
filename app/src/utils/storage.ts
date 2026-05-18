import Constants from 'expo-constants';
import { PinataSDK } from 'pinata';

export type IpfsPointer = { cid: string };

let client: PinataSDK | undefined;

function getClient(): PinataSDK {
  if (!client) {
    const extra = (Constants.expoConfig?.extra as { pinataJwt?: string; pinataGateway?: string }) || {};
    if (!extra.pinataJwt) {
      throw new Error('PINATA_JWT not configured — set it in .env');
    }
    client = new PinataSDK({
      pinataJwt: extra.pinataJwt,
      pinataGateway: extra.pinataGateway || 'https://gateway.pinata.cloud'
    });
  }
  return client;
}

/** Pin arbitrary JSON (proposal bodies, org metadata) to IPFS via Pinata. */
export async function pinJson(payload: unknown, name?: string): Promise<IpfsPointer> {
  const c = getClient();
  const res = await c.upload.json(payload as Record<string, unknown>, {
    metadata: name ? { name } : undefined
  });
  return { cid: res.cid };
}

/** Fetch JSON previously pinned via {@link pinJson} (or any CID). */
export async function fetchJson<T = unknown>(cid: string): Promise<T> {
  const extra = (Constants.expoConfig?.extra as { pinataGateway?: string }) || {};
  const gateway = extra.pinataGateway || 'https://gateway.pinata.cloud';
  const res = await fetch(`${gateway}/ipfs/${cid}`);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return (await res.json()) as T;
}
