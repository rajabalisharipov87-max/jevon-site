import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JEVON | Мой заказ",
  description: "Ход выполнения вашего заказа в JEVON",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
