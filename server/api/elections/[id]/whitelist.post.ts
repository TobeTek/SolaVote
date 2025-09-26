import { useValidatedBody, z } from 'h3-zod'
import { eq, sql } from 'drizzle-orm'


const schema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
})

export default eventHandler(async (event) => {
  const { id } = event.context.params
  const { address } = await useValidatedBody(event, schema)
  const db = useDB()

  // Get current whitelist
  const current = await db.select({ whitelist: tables.elections.whitelist })
    .from(tables.elections)
    .where(eq(tables.elections.id, id))
    .get()

  if (!current) throw createError({ statusCode: 404, statusMessage: 'Election not found' })

  // Append new address
  const updatedWhitelist = [...(current.whitelist || []), address]

  return await db.update(tables.elections)
    .set({ whitelist: updatedWhitelist })
    .where(eq(tables.elections.id, id))
    .returning()
    .get()
})
