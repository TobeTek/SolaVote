import { generateKeyPairSync } from 'crypto'
import { useValidatedBody, z } from 'h3-zod'

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
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })

  const encryptionPrivateKey = privateKey.toString('base64')
  const encryptionPublicKey = publicKey.toString('base64')

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
