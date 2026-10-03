import type { Metadata } from "next";
import SiteNavigation from '../components/site-navigation';
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
      <body><SiteNavigation />{children}</body>
    </html>
  );
}
