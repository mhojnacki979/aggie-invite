import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Roboto_Slab, Work_Sans } from 'next/font/google'
import { SiteHeader } from './components/site-header'
import './globals.css'

// Headings and the wordmark.
const robotoSlab = Roboto_Slab({
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-slab',
})

// Body copy and scores.
const workSans = Work_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-work',
})

// A plain maroon tile with a gold A, inline so the browser's /favicon.ico request isn't a 404.
const ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23500000'/><text x='16' y='23' font-family='Georgia,serif' font-size='20' font-weight='700' text-anchor='middle' fill='%23d9a521'>A</text></svg>"

export const metadata: Metadata = {
  icons: { icon: `data:image/svg+xml,${ICON_SVG}` },
  title: 'Aggie Invitational live scores',
  description: 'Live scores, podiums and results for the Aggie Invitational archery tournament in College Station, Texas.',
}

export const viewport: Viewport = {
  themeColor: '#500000',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${robotoSlab.variable} ${workSans.variable}`}>
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <footer className="site-footer">Scores by Eyes on Score</footer>
      </body>
    </html>
  )
}
