import type { Metadata, Viewport } from 'next';
import {
  Anton,
  Bricolage_Grotesque,
  DM_Mono,
  Heebo,
  Instrument_Sans,
  Instrument_Serif,
  Space_Grotesk,
} from 'next/font/google';
import './globals.css';

/* The deck's two faces. */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

/* Shared: numbers on both the landing and the deck are set in DM Mono. */
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

/* The landing's four. Instrument Serif carries the headlines and needs its
   italic — the design leans on it for every punchline ("He has notes."). */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const anton = Anton({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-anton',
  display: 'swap',
});

/* The landing page is Latin throughout, but a reader's own names come out of
   their export in whatever they were typed in, and Anton ships no Hebrew. This
   is the face `Shell` falls back to for those — without the subset a leaderboard
   of them drops to a system face and the slide loses all its weight. */
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['700', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Yapped — nine years of your group chat, read by Reg',
  description:
    'Drop in your WhatsApp export and Reg turns every message into a 40-slide story: the top yapper, the certified ghost, the night it all went sideways, and awards nobody asked for. Your chat never leaves your device.',
  /* Reg reads the deck, so Reg is the tab. Same asset the slides use. */
  icons: {
    icon: '/reg.png',
    shortcut: '/reg.png',
    apple: '/reg.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#f3eada',
  width: 'device-width',
  initialScale: 1,
  // The deck is a full-screen story; letting it zoom breaks the slide framing.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={[
        bricolage.variable,
        instrument.variable,
        dmMono.variable,
        instrumentSerif.variable,
        spaceGrotesk.variable,
        anton.variable,
        heebo.variable,
      ].join(' ')}
    >
      <body>{children}</body>
    </html>
  );
}
