import { eq } from 'drizzle-orm'
import { z, useValidatedQuery } from 'h3-zod'

export default eventHandler(async (event) => {
  const { userAddress } = await useValidatedQuery(
    event,
    z.object({
      userAddress: z.string().optional(),
    })
  )
  const { id } = event.context.params
  const db = useDB()
  const elections = tables.elections

  const election = await db
    .select({
      id: elections.id,
      title: elections.title,
      creatorAddress: elections.creatorAddress,
      startTime: elections.startTime,
      endTime: elections.endTime,
      isPrivate: elections.isPrivate,
      isActive: elections.isActive,
      publicKey: elections.publicKey,
      idCardTemplate: elections.idCardTemplate,
      merkleTree: elections.merkleTree,
      candidates: elections.candidates,
    })
    .from(elections)
    .where(eq(elections.id, id))
    .get()

  // 💡 THE FIX: Check for null/undefined before continuing
  if (!election) {
    throw createError({ statusCode: 404, statusMessage: 'Election not found' })
  }

  // Check if the current user has already voted in this election
  if (!!userAddress) {
    const hasVoted = await db
      .select({ id: tables.votes.id })
      .from(tables.votes)
      .where(and(eq(tables.votes.electionId, id), eq(tables.votes.voterAddress, userAddress)))
      .limit(1)
      .then((res) => res.length > 0)

    return {
      ...election,
      hasVoted,
      voterAddress: userAddress,
      merkleRoot: election.merkleTree?.root,
      startTime: election.startTime ? new Date(election.startTime).toISOString() : '',
      endTime: election.endTime ? new Date(election.endTime).toISOString() : '',
    }
  }

  return {
    ...election,
    merkleRoot: election.merkleTree?.root,
    startTime: election.startTime ? new Date(election.startTime).toISOString() : '',
    endTime: election.endTime ? new Date(election.endTime).toISOString() : '',
  }
})
