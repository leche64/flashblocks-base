import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import localFont from "next/font/local";
import { NavBar } from "@/components/NavBar";
const DepatureMono = localFont({
  src: "./fonts/DepartureMono-Regular.woff",
  variable: "--font-depature-mono",
  weight: "400",
});

export const metadata = {
  title: "Base Flashblocks",
  description: "The Fastest EVM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${DepatureMono.className} antialiased`}
      >
          <NavBar />
          {children}
      </body>
    </html>
  );
}
