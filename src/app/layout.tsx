import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "酒单 Wine List",
  description: "精选葡萄酒酒单 - 556款来自世界各地的优质葡萄酒",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#F5F0EB] text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
