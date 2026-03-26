import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const cards = sqliteTable('cards', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  rarity: text('rarity').notNull(),
  element: text('element').notNull(),
  attack: integer('attack').notNull(),
  defense: integer('defense').notNull(),
  imageUri: text('image_uri').notNull(),
  description: text('description').notNull().default(''),
  setName: text('set_name').notNull().default('Genesis'),
})

export const oripas = sqliteTable('oripas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  totalSlots: integer('total_slots').notNull(),
  pricePerDraw: real('price_per_draw').notNull(),
  lastOnePrize: text('last_one_prize').notNull(), // JSON string
  status: text('status').notNull().default('active'), // active | sold_out
  createdAt: text('created_at').notNull().default(''),
})

export const oripaSlots = sqliteTable(
  'oripa_slots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    oripaId: integer('oripa_id')
      .notNull()
      .references(() => oripas.id),
    slotIndex: integer('slot_index').notNull(),
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id),
    rarity: text('rarity').notNull(),
    pulledBy: text('pulled_by'),
    pulledAt: text('pulled_at'),
  },
  (table) => [
    uniqueIndex('oripa_slot_idx').on(table.oripaId, table.slotIndex),
  ]
)

export const draws = sqliteTable(
  'draws',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    oripaId: integer('oripa_id')
      .notNull()
      .references(() => oripas.id),
    slotId: integer('slot_id')
      .notNull()
      .references(() => oripaSlots.id),
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id),
    rarity: text('rarity').notNull(),
    userAddress: text('user_address').notNull(),
    txHash: text('tx_hash'),
    paymentTxHash: text('payment_tx_hash'),
    isLastOne: integer('is_last_one', { mode: 'boolean' }).notNull().default(false),
    mintedTokenId: integer('minted_token_id'),
    status: text('status').notNull().default('kept'), // pending | kept | bought_back
    decidedAt: text('decided_at'),
    buybackTxHash: text('buyback_tx_hash'),
    buybackAmount: real('buyback_amount'),
    createdAt: text('created_at').notNull().default(''),
  },
  (table) => [
    uniqueIndex('payment_tx_hash_idx').on(table.paymentTxHash),
  ]
)
