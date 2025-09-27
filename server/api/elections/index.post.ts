import { generateKeyPairSync } from 'crypto'
import { useValidatedBody, z } from 'h3-zod'
import nacl from 'tweetnacl';

const schema = z.object({
  creatorAddress: z.string(),
  title: z.string().min(1).max(100),
  candidates: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        picture: z.string().nullable(),
        manifesto: z.string().max(1000),
      })
    )
    .min(1),
  isPrivate: z.boolean(),
  startTime: z.string().datetime().nullable(),
  endTime: z.string().datetime().nullable(),
  idCardTemplate: z.string(),
})

export default eventHandler(async (event) => {
  const { creatorAddress, title, candidates, isPrivate, startTime, endTime, idCardTemplate } =
    await useValidatedBody(event, schema)
  const db = useDB()

  // Generate key pair
  const keyPair = nacl.box.keyPair();
  const encryptionPrivateKey = Buffer.from(keyPair.secretKey).toString('base64');
  const encryptionPublicKey = Buffer.from(keyPair.publicKey).toString('base64');

  const election = await db
    .insert(tables.elections)
    .values({
      id: Date.now().toString(),
      title,
      creatorAddress,
      startTime: startTime,
      endTime: endTime,
      isPrivate,
      isActive: false,
      publicKey: encryptionPublicKey,
      privateKey: encryptionPrivateKey,
      idCardTemplate,
      candidates,
      whitelist: [],
      voters: [],
    })
    .returning()
    .get()

  return election
})

export function get25519KeyPair(privateKey: string) {
    const rawPrivateKeyHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    const privateKeyBytes = Buffer.from(rawPrivateKeyHex, 'hex');
    const keyPair = nacl.box.keyPair.fromSecretKey(privateKeyBytes);
    const publicKeyBase64 = Buffer.from(keyPair.publicKey).toString('base64');

    return { ...keyPair, publicKeyBase64 };
}