// import { defineEventHandler } from 'h3'
import { eq, and } from 'drizzle-orm'
import { decryptVote } from '~/utils/crypto'
import { useValidatedBody, z } from 'h3-zod'

export default eventHandler(async (event) => {
  const { id } = event.context.params
  const { userAddress } = await useValidatedBody(
    event,
    z.object({
      userAddress: z.string(),
    })
  )

  const db = useDB()
  const election = await db.query.elections.findFirst({
    where: and(eq(tables.elections.id, id), eq(tables.elections.isActive, true)),
  })

  if (!election) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Active election not found',
    })
  }

  // Verify the user is the election creator
  if (election.creatorAddress !== userAddress) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the election creator can close the election',
    })
  }

  // Get all votes for this election
  const allVotes = await db.query.votes.findMany({
    where: (votes, { eq }) => eq(tables.votes.electionId, id),
  })

  if (allVotes.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No votes have been cast in this election',
    })
  }

  // Decrypt votes and tally results
  const tally: Record<string, number> = {}
  const decryptedVotes = []

  for (const vote of allVotes) {
    try {
      // Decrypt the vote
      const decrypted = decryptVote(JSON.parse(vote.encryptedVote), election.privateKey)
      const voteData = JSON.parse(decrypted)

      // Store decrypted vote for audit
      decryptedVotes.push({
        ...voteData,
        voterAddress: vote.voterAddress,
        votedAt: vote.votedAt,
      })

      // Count the vote
      const candidate = voteData.candidate
      tally[candidate] = (tally[candidate] || 0) + 1
    } catch (error) {
      console.error(`Failed to decrypt vote ${vote.id}:`, error)
      // Skip votes that can't be decrypted
      continue
    }
  }

  // Calculate results
  const candidates = election.candidates.map((c) => c.name)
  const results = candidates.map((candidate) => ({
    candidate,
    votes: tally[candidate] || 0,
    percentage: 0,
  }))

  // Calculate total valid votes
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0)

  // Calculate percentages
  results.forEach((r) => {
    r.percentage = totalVotes > 0 ? (r.votes / totalVotes) * 100 : 0
  })

  // Sort by votes (descending)
  results.sort((a, b) => b.votes - a.votes)

  // Determine winners (could be ties)
  const maxVotes = results[0]?.votes || 0
  const winners = results.filter((r) => r.votes === maxVotes)

  // Store results in database
  await db.transaction(async (tx) => {
    await tx.update(tables.elections).set({ isActive: false }).where(eq(tables.elections.id, id))

    await tx.insert(tables.results).values({
      id: crypto.randomUUID(),
      electionId: id,
      totalVotes,
      results: results,
      winners: winners.map((w) => w.candidate),
      closedAt: new Date(),
      decryptedVotes: JSON.stringify(decryptedVotes),
    })
  })

  return {
    success: true,
    message: 'Election closed and results calculated successfully',
    results: {
      totalVotes,
      candidates: results,
      winners: winners.map((w) => w.candidate),
      decryptedVotesCount: decryptedVotes.length,
    },
  }
})
