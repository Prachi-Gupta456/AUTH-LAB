import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = { title: 'Auth Lab' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}