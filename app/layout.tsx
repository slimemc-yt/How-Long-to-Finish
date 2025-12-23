import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "How Long to Finish",
  description: "Calculate binge watching and reading times",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <meta name="google-site-verification" content="AEL6lgRikf_Y4eFAEufR-sSsdzfQTOJiSVV_dsQc28I" />
      <body className="antialiased bg-slate-950 text-slate-200">
        {children}
      </body>
    </html>
  );
}