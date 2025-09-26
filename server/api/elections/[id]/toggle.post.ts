import { eq } from 'drizzle-orm'
import { MerkleTree } from 'merkletreejs'

import { sha256 } from '@noble/hashes/sha2.js'
import { Address } from '@solana/kit'
import { getAddressBytes } from '~~/common'

export default eventHandler(async (event) => {
  const { id } = event.context.params
  const db = useDB()

  const election = await db.select().from(tables.elections).where(eq(tables.elections.id, id)).get()

  if (!election) throw createError({ statusCode: 404, statusMessage: 'Election not found' })

  // If activating a private election, generate Merkle tree
  if (
    !election.isActive &&
    election.isPrivate &&
    election.whitelist &&
    election.whitelist.length > 0
  ) {
    // Create leaves (hash each address)
    const leaves = election.whitelist?.map((addr) =>
      sha256(getAddressBytes(addr as Address))
    ) as any[]
    // Create tree
    const tree = new MerkleTree(leaves, sha256, { sortPairs: true })

    // Store the entire tree structure
    const merkleTreeData = {
      root: tree.getRoot().toString('hex'),
      leaves: leaves.map((l) => l.toString()),
      layers: tree.getLayers().map((layer) => layer.map((l) => l.toString('hex'))),
    }

    await db
      .update(tables.elections)
      .set({
        isActive: true,
        merkleTree: merkleTreeData,
      })
      .where(eq(tables.elections.id, id))
  } else {
    await db
      .update(tables.elections)
      .set({ isActive: !election.isActive })
      .where(eq(tables.elections.id, id))
  }

  return await db.select().from(tables.elections).where(eq(tables.elections.id, id)).get()
})
