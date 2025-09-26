import { eq } from 'drizzle-orm'
import { createError } from 'h3'; // You may need this depending on your setup

export default eventHandler(async (event) => {
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

  // Now TypeScript/JavaScript knows 'election' is a valid object
  return {
    ...election,
    merkleRoot: election.merkleTree?.root,
    // You can now safely access properties on 'election'
    startTime: election.startTime ? new Date(election.startTime).toISOString() : '',
    endTime: election.endTime ? new Date(election.endTime).toISOString() : '',
  }
})
