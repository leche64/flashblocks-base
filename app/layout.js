import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react"
import { NavBar } from "@/components/NavBar";
const DepatureMono = localFont({
  src: "./fonts/DepartureMono-Regular.woff",
  variable: "--font-depature-mono",
  weight: "400",
});

export const metadata = {
  title: "Flashblocks",
  description: "The Fastest EVM Chain",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${DepatureMono.className} antialiased`}
      >
          <NavBar />
          {children}
          <Analytics />
      </body>
    </html>
  );
}
