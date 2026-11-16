import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/ui/toast";
import { CLERK_ENABLED } from "@/lib/auth/clerk-config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Saarthi — AI Wellness Companion",
  description:
    "Measured skin and posture analysis from your photos, honest mental check-ins, and a calm plan for every day. Every number tells you how it was made.",
  icons: { icon: "/saarthi-logo.png", shortcut: "/saarthi-logo.png", apple: "/saarthi-logo.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a10" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const page = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );

  if (!CLERK_ENABLED) return page;
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#5b45e0",
          borderRadius: "14px",
          fontFamily: "var(--font-geist-sans)",
        },
      }}
    >
      {page}
    </ClerkProvider>
  );
}
