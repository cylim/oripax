import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response(
          JSON.stringify({
            status: 'ok',
            chain: 'X Layer',
            chainId: 196,
            timestamp: new Date().toISOString(),
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      },
    },
  },
})
