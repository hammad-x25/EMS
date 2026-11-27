import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AegisExam", template: "%s | AegisExam" },
  description: "Secure, fair, and resilient institutional examination management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
