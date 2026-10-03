import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JEVON | Ҳасту нест",
  description: "Системаи қайди омадан ва рафтани кормандони JEVON",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JEVON | Ҳасту нест",
  },
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
    <html lang="tg" className="bg-[#0e3a5a]">
      <head><script dangerouslySetInnerHTML={{__html: `try{var m=navigator.userAgent.match(/(?:Chrome|CriOS)\\/(\\d+)/);if(m&&Number(m[1])<99&&location.pathname!=="/legacy.html")location.replace("/legacy.html");}catch(e){}`}} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
