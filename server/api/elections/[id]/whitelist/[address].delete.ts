import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const { id, address } = event.context.params
  const db = useDB(event)

  // Get current whitelist
  const current = await db.select({ whitelist: tables.elections.whitelist })
    .from(tables.elections)
    .where(eq(tables.elections.id, id))
    .get()

  if (!current) throw createError({ statusCode: 404, statusMessage: 'Election not found' })

  // Remove address
  const updatedWhitelist = current.whitelist.filter(a => a !== address)

  return await db.update(elections)
    .set({ whitelist: updatedWhitelist })
    .where(eq(elections.id, id))
    .returning()
    .get()
})
