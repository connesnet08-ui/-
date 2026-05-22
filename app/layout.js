import "./globals.css";

export const metadata = {
  title: "互联网黑话翻译器",
  description: "把互联网黑话翻译成听得懂的大白话",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
