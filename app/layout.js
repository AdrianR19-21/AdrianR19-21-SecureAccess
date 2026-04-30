import { Space_Grotesk, Syne } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body'
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-heading'
});

export const metadata = {
  title: 'Antigravity Vault',
  description: 'Registro, enlaces, credenciales e imágenes guardadas localmente con Next.js y Prisma',
  icons: {
    icon: '/candado.png'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${syne.variable}`}>{children}</body>
    </html>
  );
}
