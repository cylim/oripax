import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Navbar } from '~/components/Navbar'
import { WalletProvider } from '~/lib/wallet'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
    },
  },
})

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'OripaX — On-Chain Gacha on X Layer' },
      { name: 'description', content: 'Japanese-style Oripa gacha with x402 micropayments on X Layer' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-pachinko-bg text-white font-display antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-6xl mb-4">🎰</div>
      <h1 className="text-3xl font-bold text-pachinko-gold neon-glow mb-2">404</h1>
      <p className="text-white/50 mb-6">This page doesn't exist</p>
      <Link
        to="/"
        className="px-6 py-2 bg-pachinko-gold/10 border border-pachinko-gold/50 rounded-lg text-pachinko-gold text-sm font-semibold hover:bg-pachinko-gold/20 transition-all"
      >
        Back to Lobby
      </Link>
    </div>
  )
}

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-6">
            <Outlet />
          </main>
          {/* Fixed demo footer */}
          <div className="fixed bottom-0 inset-x-0 z-50 bg-pachinko-gold/10 border-t border-pachinko-gold/30 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 py-1.5 px-4 cursor-default select-none">
              <span className="text-pachinko-gold font-bold text-[10px] sm:text-xs tracking-widest uppercase">Demo</span>
              <span className="text-white/40 text-[9px] sm:text-[10px] text-center">Test phase only, no real cards are drawn</span>
            </div>
          </div>
          {/* Spacer to prevent content from being hidden behind fixed footer */}
          <div className="h-12 sm:h-10" />
        </WalletProvider>
      </QueryClientProvider>
    </RootDocument>
  )
}
