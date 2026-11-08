import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FirebaseAuthBoot from "./firebase-auth-boot";
import LanguageToggle from "./language-toggle";
import FloatingSupportButton from "./floating-support-button";
import AtmosphericEffects from "./atmospheric-effects";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sakuradeveloper.github.io/sakura.github.io"),
  title: "Sakura — Приватный софт для Dota 2",
  description:
    "Приватный софт для Dota 2 с безопасным Humanizer-обходом: отдаление камеры, мана и кулдауны врагов, скрипты на комбо, переключение Armlet и чистый оверлей без просадок FPS.",
  keywords: [
    "приватный софт дота 2",
    "приватный чит дота 2",
    "чит на доту 2",
    "дота 2 скрипты",
    "отдаление камеры дота 2",
    "sakura dota 2",
    "sakura cheat",
    "dota 2 software",
    "humanizer dota 2",
  ],
  openGraph: {
    title: "Sakura — Приватный софт для Dota 2",
    description:
      "Приватный софт нового поколения для Dota 2: безопасный Humanizer-шлюз, отдаление камеры, отображение кулдаунов и маны врагов, комбо-скрипты и авто-армлет.",
    url: "https://sakuradeveloper.github.io/sakura.github.io",
    siteName: "Sakura",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "https://sakuradeveloper.github.io/sakura.github.io/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sakura — Приватный софт для Dota 2",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sakura — Приватный софт для Dota 2",
    description:
      "Приватный софт для Dota 2: Humanizer-защита, отдаление камеры, кулдауны способностей, авто-комбо и чистый оверлей.",
    images: ["https://sakuradeveloper.github.io/sakura.github.io/og-image.png"],
  },
  icons: {
    icon: [
      {
        url: "/sakura.github.io/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/sakura.github.io/favicon.ico",
        type: "image/x-icon",
      },
    ],
    shortcut: "/sakura.github.io/icon.svg",
    apple: "/sakura.github.io/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AtmosphericEffects />
        {children}
        <LanguageToggle />
        <FloatingSupportButton />
        <FirebaseAuthBoot />
      </body>
    </html>
  );
}
