import { Address } from '@solana/kit'
import { eq } from 'drizzle-orm'
import { useValidatedBody, z } from 'h3-zod'
import { MerkleTree } from 'merkletreejs'
import { sha256 } from '@noble/hashes/sha2.js'
import { getAddressBytes } from '~~/common'

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const schema = z.object({
  address: z.string()
    .min(32, 'Solana address must be at least 32 characters long.')
    .max(44, 'Solana address cannot be more than 44 characters long.')
    .regex(
      SOLANA_ADDRESS_REGEX, 
      'Invalid Base58 characters. Solana addresses use a specific set of alphanumeric characters.'
    )
});

export default eventHandler(async (event) => {
  const { id } = event.context.params
  const { address } = await useValidatedBody(event, schema)
  const db = useDB()

  const election = await db.select().from(tables.elections).where(eq(tables.elections.id, id)).get()

  if (!election) throw createError({ statusCode: 404, statusMessage: 'Election not found' })
  if (!election.isPrivate)
    throw createError({ statusCode: 400, statusMessage: 'Not a private election' })
  if (!election.merkleTree)
    throw createError({ statusCode: 400, statusMessage: 'Merkle tree not generated' })

  // Verify address is in whitelist
  if (!election.whitelist?.includes(address)) {
    throw createError({ statusCode: 403, statusMessage: 'Address not whitelisted' })
  }

  // Reconstruct tree from stored data
  const leaves = election.merkleTree.leaves.map((l: string) => Buffer.from(l, 'hex'))
  const tree = new MerkleTree(leaves, sha256, { sortPairs: true })

  // Get proof for this address
  const leaf = sha256(getAddressBytes(address as Address)).toString()
  const proof = tree.getProof(leaf)

  return {
    merkleRoot: election.merkleTree.root,
    proof: proof,
    address: address,
  }
})
