import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Izzy Shen",
  description: "Personal portfolio",
  icons: { icon: "/logo.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
