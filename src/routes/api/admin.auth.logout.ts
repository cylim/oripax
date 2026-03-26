import { createFileRoute } from '@tanstack/react-router'
import { clearCookieResponse } from '~/server/response'

export const Route = createFileRoute('/api/admin/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        return clearCookieResponse({ success: true }, 'admin_token')
      },
    },
  },
})
