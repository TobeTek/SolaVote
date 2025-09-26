import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').notNull(), // GitHub Id
  title: text('title').notNull(),
  completed: integer('completed').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const elections = sqliteTable('elections', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  creatorAddress: text('creator_address').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  isPrivate: integer('is_private', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  idCardTemplate: text('id_card_template').notNull(),
  whitelist: text('whitelist', { mode: 'json' }).$type<string[]>().default([]),
  voters: text('voters', { mode: 'json' }).$type<string[]>().default([]),
  candidates: text('candidates', { mode: 'json' })
    .$type<
      {
        name: string
        picture: string
        manifesto: string
      }[]
    >()
    .notNull(),
  merkleTree: text('merkle_tree', { mode: 'json' }).$type<{
    root: string
    leaves: string[]
    layers: string[][]
  }>(), // Store entire Merkle tree
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
})
