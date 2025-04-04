import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LogTheBooks - Track Your Reading",
  description: "Log the books you read, rate them, and keep track of your reading journey.",
  icons: {
    // Use an SVG containing the book emoji as the default icon
    icon: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E",
    // You could add other icon types here if needed:
    // apple: '/apple-icon.png',
    // shortcut: '/favicon.ico', 
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
