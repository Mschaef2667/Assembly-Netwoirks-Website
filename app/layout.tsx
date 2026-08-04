import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/ga";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase is required for Next.js to emit absolute URLs for the
  // opengraph image. Without it, LinkedIn and iMessage receive a relative path
  // and render a blank card.
  metadataBase: new URL("https://www.assemblyai.net"),
  title: {
    default: "Assembly AI — Go-to-Market Strategy Built on Buyer Truth",
    template: "%s — Assembly AI",
  },
  description:
    "Assembly AI is an AI-native go-to-market operating system built on the C3 Method. We ask your buyers the right questions, then turn what they say into your positioning, messaging, and action plan.",
  applicationName: "Assembly AI",
  openGraph: {
    type: "website",
    siteName: "Assembly AI",
    url: "https://www.assemblyai.net",
    title: "Assembly AI — Go-to-Market Strategy Built on Buyer Truth",
    description:
      "Your buyers already told you how to win. Assembly AI turns what they said into positioning, messaging, and a 30/60/90 day plan.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Assembly AI — Go-to-Market Strategy Built on Buyer Truth",
    description:
      "Your buyers already told you how to win. Assembly AI turns what they said into positioning, messaging, and a 30/60/90 day plan.",
  },
  // app/opengraph-image.png, app/icon.png, app/apple-icon.png, and
  // app/favicon.ico are picked up automatically by the Next.js file
  // conventions, so the image tags do not need to be declared here.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}

        {/*
          Google Analytics 4. `afterInteractive` lets the page paint first, so
          analytics never delays first render. This is the SAME measurement ID
          the marketing site uses, which is what makes cross-domain measurement
          possible. The domain pairing itself is configured in the GA4 admin.
        */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
