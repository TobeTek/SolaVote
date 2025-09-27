import { eq } from 'drizzle-orm'
import { z, useValidatedQuery } from 'h3-zod'

export default eventHandler(async (event) => {
  const { id } = event.context.params
  const db = useDB()

  if (!id) {
    throw createError({
      status: 400,
      message: 'Election id was not provided',
    })
  }

  // Fetch all votes for this election
  const votes = await db.select().from(tables.votes).where(eq(tables.votes.electionId, id)).all()

  // Extract unique voter addresses
  const voters = [...new Set(votes.map((v) => v.voterAddress))]

  return { voters }
})
