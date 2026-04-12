import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StackCount PRO",
  description: "AI-Powered Inventory Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className="bg-[#07070f]">{children}</body>
    </html>
  );
}
