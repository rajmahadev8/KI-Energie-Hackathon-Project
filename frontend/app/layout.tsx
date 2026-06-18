import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI PV Assistant — source-based guidance for energy projects",
  description:
    "Independent, source-based AI assistant for PV, battery storage, wallbox and heat pump. Rules, funding and location data brought together clearly.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
