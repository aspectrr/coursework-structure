import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coursework',
  description: 'Daily consistency for self-paced courses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-ink-200 bg-ink-50/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6">
            <a href="/" className="font-serif text-xl tracking-tight">
              coursework
            </a>
            <nav className="flex gap-4 text-sm text-ink-700">
              <a href="/" className="hover:text-accent">
                Today
              </a>
              <a href="/courses" className="hover:text-accent">
                Courses
              </a>
              <a href="/calendar" className="hover:text-accent">
                Calendar
              </a>
            </nav>
            <div className="ml-auto text-xs text-ink-500">
              <a href="/admin" className="hover:text-accent">
                admin
              </a>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
