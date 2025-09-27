import { eq } from 'drizzle-orm'
import { z, useValidatedQuery } from 'h3-zod'
import { decryptVote } from '~/utils/crypto'

export default eventHandler(async (event) => {
  const { id } = event.context.params
  const db = useDB()

  if (!id) {
    throw createError({
      status: 400,
      message: 'Election id was not provided',
    })
  }

  const election = await db.query.elections.findFirst({
    where: and(eq(tables.elections.id, id)),
  })
  if (!election) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Active election not found',
    })
  }

  const allVotes = await db.select().from(tables.votes).where(eq(tables.votes.electionId, id)).all()
  const tally: Record<string, number> = {}
  const decryptedVotes = []

  for (const vote of allVotes) {
    try {
      const rawKeyBuffer = Buffer.from(election.privateKey, 'base64')
      const hexPrivateKey = rawKeyBuffer.toString('hex')
      const decrypted = decryptVote(JSON.parse(vote.encryptedVote), hexPrivateKey)
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

  const electionResult = {
    electionId: id,
    totalVotes,
    candidates: results,
    winners: winners.map((w) => w.candidate),
    closedAt: new Date(),
    decryptedVotes: decryptedVotes,
    decryptedVotesCount: decryptedVotes.length,
  }

  //   const electionResult = await db
  //     .select()
  //     .from(tables.results)
  //     .where(eq(tables.results.electionId, id))
  //     .get()
  return { ...electionResult }
})
