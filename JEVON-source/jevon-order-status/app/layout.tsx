import type { Metadata } from "next";
import Link from 'next/link';
import "./globals.css";

export const metadata: Metadata = {
  title: "JEVON | Заказы и посещаемость",
  description: "Заказы, сотрудники и посещаемость мебельного цеха JEVON.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body><nav style={{height:40,display:'flex',gap:24,alignItems:'center',padding:'0 16px',background:'#0e3a5a',color:'white',position:'relative',zIndex:100}}><Link href="/">Заказы</Link><Link href="/attendance">Приход / уход</Link><Link href="/employees">Сотрудники и журнал</Link></nav>{children}</body>
    </html>
  );
}
