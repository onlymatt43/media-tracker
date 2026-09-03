import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteLocale, siteMetadata } from "@/lib/site-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Read at module-import time from the environment; unset values are omitted
// from <head> (see src/lib/site-config.js).
export const metadata = siteMetadata();

export default function RootLayout({ children }) {
  return (
    <html
      lang={siteLocale()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
