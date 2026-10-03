import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JEVON | Статус заказов",
  description: "Статусы заказов мебельного цеха JEVON.",
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
      <body>{children}</body>
    </html>
  );
}
