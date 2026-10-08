import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oral Exam Partner",
  description: "Listen to each question and hear the model answer only when it does not match.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${noto.variable} h-full`}>
      <body className="min-h-dvh bg-[#f4efe6] text-[#1f1a17] antialiased">{children}</body>
    </html>
  );
}
