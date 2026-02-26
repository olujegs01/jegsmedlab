import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedLab AI — Understand Your Lab Results in Plain English",
  description:
    "AI-powered lab result interpretation. Upload lab reports, check symptoms, and get personalized health insights powered by Claude Opus 4.6.",
  keywords: "lab results interpreter, blood test AI, symptom checker, medical AI, health insights",
  authors: [{ name: "MedLab AI" }],
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
  manifest: "/manifest.json",
  openGraph: {
    title: "MedLab AI — Understand Your Lab Results in Plain English",
    description: "Upload your lab reports and get instant AI-powered interpretations in plain English.",
    type: "website",
    siteName: "MedLab AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "MedLab AI",
    description: "AI-powered lab result interpretation and symptom checker.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
