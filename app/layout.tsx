import type { Metadata, Viewport } from "next";
import { Golos_Text, Russo_One } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const display = Russo_One({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-display" });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "СильченкоДроп",
  description: "Кейсы CS2 для своих",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // чтобы нижняя панель учитывала «чёлку» и полоску жестов
  themeColor: "#171a16", // цвет адресной строки на телефоне
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">{children}</main>
        <footer className="border-t border-line pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm muted">
            СильченкоДроп — для своих. Скины не выводятся, деньги ненастоящие.
          </div>
        </footer>
      </body>
    </html>
  );
}
