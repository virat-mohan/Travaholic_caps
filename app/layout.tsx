import type { Metadata } from "next";
import { Archivo_Black, Manrope } from "next/font/google";
import { Navbar } from "@/components/navigation/Navbar";
import { SplashIntro } from "@/components/hero/SplashIntro";
import { MetaPixelTracker } from "@/components/tracking/MetaPixel";
import { CartProvider } from "@/lib/cart";
import { getSetting } from "@/lib/settings";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: ["400"],
});

const SITE_URL = "https://travaholic.in";
const DESCRIPTION =
  "Travaholic makes premium trucker caps in India, each one inspired by a real place or journey. Flat ₹1,399 pricing, ships across India. Shop the full Collection at travaholic.in.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Travaholic — Stories You Can Wear",
    template: "%s — Travaholic",
  },
  description: DESCRIPTION,
  keywords: ["trucker caps India", "premium caps", "travel inspired caps", "Travaholic"],
  openGraph: {
    type: "website",
    siteName: "Travaholic",
    title: "Travaholic — Stories You Can Wear",
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/images/brand/og-image.jpg", width: 1200, height: 630, alt: "Travaholic" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Travaholic — Stories You Can Wear",
    description: DESCRIPTION,
    images: ["/images/brand/og-image.jpg"],
  },
  alternates: { canonical: SITE_URL },
};

// Organization schema — the baseline fact-anchor answer engines (Google's
// AI Overviews, ChatGPT, Perplexity) use to know who's actually behind the
// site before trusting anything else it says.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Travaholic",
  url: SITE_URL,
  logo: `${SITE_URL}/images/brand/travaholic-logo-color-v2.png`,
  description: DESCRIPTION,
  address: {
    "@type": "PostalAddress",
    streetAddress: "C-152, Industrial Phase-1, Okhla",
    addressLocality: "South Delhi",
    addressRegion: "Delhi",
    postalCode: "110020",
    addressCountry: "IN",
  },
  sameAs: [
    "https://instagram.com/travaholiccaps",
    "https://facebook.com/profile.php?id=100080234022161",
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pixelId = await getSetting("META_PIXEL_ID");

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          // Prevents a flash of the homepage before the splash overlay mounts.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.location.pathname==="/"&&!sessionStorage.getItem("travaholic-splash-shown")){document.documentElement.classList.add("splash-pending");}}catch(e){}})();`,
          }}
        />
        <MetaPixelTracker pixelId={pixelId} />
        <CartProvider>
          <SplashIntro />
          <Navbar />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
