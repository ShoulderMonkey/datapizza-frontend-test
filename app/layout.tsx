import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'DocFact Chat & Citations',
  description: 'Document-grounded NDJSON streaming chat with PDF fact-checking and bounding region visualization.',
  openGraph: {
    title: 'DocFact Chat & Citations',
    description: 'Document-grounded NDJSON streaming chat with PDF fact-checking and bounding region visualization.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DocFact Chat & Citations',
    description: 'Document-grounded NDJSON streaming chat with PDF fact-checking and bounding region visualization.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="it">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
