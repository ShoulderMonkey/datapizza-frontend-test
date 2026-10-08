import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Datapizza — Test tecnico Frontend',
  description: 'Document-grounded NDJSON streaming chat with PDF fact-checking and bounding region visualization.',
  openGraph: {
    title: 'Datapizza — Test tecnico Frontend',
    description: 'Document-grounded NDJSON streaming chat with PDF fact-checking and bounding region visualization.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Datapizza — Test tecnico Frontend',
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
