import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'M.I.N.D. — Autonomous QA Engineer',
  description: 'AI-powered autonomous web testing agent. Live (Hybrid) requirement collection, intelligent test planning, and browser automation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased min-h-screen bg-mission-bg text-mission-text">
        {children}
      </body>
    </html>
  );
}
