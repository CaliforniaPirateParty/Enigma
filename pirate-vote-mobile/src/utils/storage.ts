import { create } from 'ipfs-http-client';

export type IpfsPointer = { cid: string };

let client: ReturnType<typeof create> | undefined;

function getClient() {
  if (!client) {
    client = create({ url: 'https://ipfs.io/api/v0' });
  }
  return client;
}

export async function addMessageToIpfs(payload: unknown): Promise<IpfsPointer> {
  const c = getClient();
  const { cid } = await c.add(JSON.stringify(payload));
  return { cid: cid.toString() };
}
