import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '~/server/db'
import { getEnv, initEnv } from '~/server/env'
import { getUserDraws } from '~/server/oripa.server'
import { jsonResponse, errorResponse } from '~/server/response'

export const Route = createFileRoute('/api/draws/user/$address')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          await initEnv()
          const env = getEnv()
          const db = getDb(env.DB)

          if (!params.address || !/^0x[a-fA-F0-9]{40}$/.test(params.address)) {
            return errorResponse('Invalid wallet address', 400)
          }

          return jsonResponse(await getUserDraws(db, params.address))
        } catch (err) {
          console.error('User draws error:', err)
          return errorResponse('Internal server error')
        }
      },
    },
  },
})
