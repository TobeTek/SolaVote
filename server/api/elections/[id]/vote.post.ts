// server/api/elections/[id]/vote.post.ts
import { useValidatedBody, z } from 'h3-zod'
import { defineEventHandler, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { decryptVote } from '~/utils/crypto'
import MerkleTree from 'merkletreejs'

export default defineEventHandler(async (event) => {
    // Parse request body
    const { electionId, encryptedVote, voterAddress, merkleProof } = await useValidatedBody(
      event,
      z.object({
        electionId: z.string(),
        encryptedVote: z.string(),
        voterAddress: z.string(),
        merkleProof: z.string().array(),
      })
    )

    // Get NuxtHub services
    const db = useDB()

    // Verify election exists and is active
    const election = await db.query.elections.findFirst({
      where:  and(eq(tables.elections.id, electionId), eq(tables.elections.isActive, true)),
      columns: {
        id: true,
        title: true,
        isPrivate: true,
        publicKey: true,
        privateKey: true,
        merkleTree: true,
      },
    })

    if (!election) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Election not found or not active',
      })
    }

    // For private elections, verify merkle proof if provided
    if (election.isPrivate) {
      if (!merkleProof || !election.merkleTree) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Merkle proof required for private elections',
        })
      }


      // In a real implementation, you would verify the merkle proof here
      // This is a simplified check - implement proper merkle verification
      if (!verifyMerkleProof(voterAddress, merkleProof, election.merkleTree.root)) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Invalid merkle proof - not whitelisted',
        })
      }
    }

    // Check if voter has already voted
    const existingVote = await db.query.votes.findFirst({
      where: (votes, { eq, and }) =>
        and(eq(votes.electionId, electionId), eq(votes.voterAddress, voterAddress)),
    })

    if (existingVote) {
      throw createError({
        statusCode: 400,
        statusMessage: 'You have already voted in this election',
      })
    }

    // Store the encrypted vote
    const voteId = await db
      .insert(tables.votes)
      .values({
        id: crypto.randomUUID(),
        electionId,
        voterAddress,
        encryptedVote,
        merkleProof: election.isPrivate ? merkleProof : null,
        votedAt: new Date(),
      })
      .returning({ id: tables.votes.id })

    // In a real system, you might want to store the encrypted vote in secure storage
    // For audit purposes, we'll store it in our database

    return {
      success: true,
      voteId: voteId[0].id,
      message: 'Vote submitted successfully',
    }
  
})

// Helper function to verify merkle proof (simplified - implement proper verification)
function verifyMerkleProof(address: string, proof: string[], root: string): boolean {
  // In a real implementation, you would:
  // 1. Hash the address
  // 2. Compute the root from the proof
  // 3. Compare with the stored root
  // This is a placeholder that should be replaced with actual verification

  // For demo purposes, we'll just return true
  return true
}
