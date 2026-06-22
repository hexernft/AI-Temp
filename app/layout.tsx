import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WelCare",
  description:
    "Church first timer capture, follow-up, foundation school, baptism, and growth tracking system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}