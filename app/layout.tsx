import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#111111',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://battlegroundsfaceoffseries.com'),
  title: 'BGFS | Battlegrounds Faceoff Series',
  description: 'India\'s premier BGMI mobile tournament. Compete in weekly league slots, climb the leaderboard, and fight for glory in the Grand Finals.',
  keywords: 'BGMI tournament, BGFS, Battlegrounds Faceoff Series, mobile gaming tournament India',
  openGraph: {
    title: 'BGFS | Battlegrounds Faceoff Series',
    description: 'India\'s premier BGMI mobile tournament. Weekly league slots, ₹50 entry, cash prizes every slot.',
    url: 'https://battlegroundsfaceoffseries.com',
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
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  )
}
