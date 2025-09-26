import { eq } from 'drizzle-orm'
import { useValidatedQuery, z } from 'h3-zod'

export default eventHandler(async (event) => {
  const { creatorAddress } = await useValidatedQuery(
    event,
    z.object({
      creatorAddress: z.string().optional(),
    })
  )
  const db = useDB()

  if (!!creatorAddress) {
    return await db
      .select()
      .from(tables.elections)
      .where(eq(tables.elections.creatorAddress, creatorAddress))
      .all()
  }
  return await db.select().from(tables.elections).all()
})
