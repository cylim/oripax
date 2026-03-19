import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db'
import { getEnv, hasDb } from './env'
import {
  getActiveOripas,
  getOripaById,
  getPoolStatus,
  getUserDraws,
  getGlobalStats,
  getRecentDraws,
} from './oripa.server'

export const fetchActiveOripas = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!hasDb()) return []
    const env = getEnv()
    const db = getDb(env.DB)
    return getActiveOripas(db)
  }
)

export const fetchOripaDetail = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    if (!hasDb()) throw new Error('Database not available')
    const env = getEnv()
    const db = getDb(env.DB)
    const oripa = await getOripaById(db, parseInt(data.id))
    if (!oripa) throw new Error('Oripa not found')
    return oripa
  })

export const fetchPoolStatus = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    if (!hasDb()) return null
    const env = getEnv()
    const db = getDb(env.DB)
    return getPoolStatus(db, parseInt(data.id))
  })

export const fetchUserDraws = createServerFn({ method: 'GET' })
  .inputValidator((input: { address: string }) => input)
  .handler(async ({ data }) => {
    if (!hasDb()) return []
    const env = getEnv()
    const db = getDb(env.DB)
    return getUserDraws(db, data.address)
  })

export const fetchGlobalStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!hasDb()) return { totalDraws: 0, totalLastOneWins: 0, lastOneWinners: [] }
    const env = getEnv()
    const db = getDb(env.DB)
    return getGlobalStats(db)
  }
)

export const fetchRecentDraws = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!hasDb()) return []
    const env = getEnv()
    const db = getDb(env.DB)
    return getRecentDraws(db, 20)
  }
)
