import { useValidatedBody, z } from 'h3-zod'
import { eq, sql } from 'drizzle-orm'

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const schema = z.object({
  address: z.string()
    .min(32, 'Solana address must be at least 32 characters long.')
    .max(44, 'Solana address cannot be more than 44 characters long.')
    .regex(
      SOLANA_ADDRESS_REGEX, 
      'Invalid Base58 characters. Solana addresses use a specific set of alphanumeric characters.'
    )
});

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
