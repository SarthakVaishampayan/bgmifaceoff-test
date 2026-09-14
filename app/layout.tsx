import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import Navbar from '@/components/Navbar'
import ConditionalFooter from '@/components/ConditionalFooter'
import PageLoader from '@/components/PageLoader'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111111',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://battlegroundsfaceoffseries.in'),
  title: 'BGFS | Battlegrounds Faceoff Series',
  description: 'India\'s premier BGMI mobile tournament. Compete in weekly league slots, climb the leaderboard, and fight for glory in the Grand Finals.',
  keywords: 'BGMI tournament, BGFS, Battlegrounds Faceoff Series, mobile gaming tournament India',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png' },
    ],
  },
  openGraph: {
    title: 'BGFS | Battlegrounds Faceoff Series',
    description: 'India\'s premier BGMI mobile tournament. Weekly league slots, ₹50 entry, cash prizes every slot.',
    url: 'https://battlegroundsfaceoffseries.in',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        {/* Preload hero wallpaper so it appears instantaneously */}
        <link rel="preload" as="image" href="/images/homepagewallpaper.jpg" />
      </head>
      <body>
        <PageLoader />
        <Navbar />
        {children}
        <ConditionalFooter />
      </body>
    </html>
  )
}
