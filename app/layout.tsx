import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { SWRProvider } from '@/components/SWRProvider';

export const metadata: Metadata = {
  title: 'Session Dashboard',
  description: 'Browse and monitor AI coding tool sessions',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('theme');
            if(t === 'light') document.documentElement.classList.remove('dark');
            else document.documentElement.classList.add('dark');
          })();
        `}} />
      </head>
      <body className="antialiased bg-background text-foreground">
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
