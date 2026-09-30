import type { Metadata } from "next";
import { Archivo_Black, Manrope } from "next/font/google";
import { Navbar } from "@/components/navigation/Navbar";
import { ScrollToTop } from "@/components/navigation/ScrollToTop";
import { CouponCapture } from "@/components/tracking/CouponCapture";
import { MetaPixelTracker } from "@/components/tracking/MetaPixel";
import { ClarityTracker } from "@/components/tracking/ClarityTracker";
import { CartProvider } from "@/lib/cart";
import { getSetting } from "@/lib/settings";
import { brand } from "@/lib/retail-os-brand";
import { Analytics } from "@vercel/analytics/next";
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

// Brand identity is now sourced from the canonical Retail OS brand config
// (lib/retail-os-brand.ts). Values are unchanged — this only removes the
// hardcoded duplication so Travaholic is configured, not hand-edited.
const SITE_URL = brand.profile.siteUrl;
const DESCRIPTION = brand.description;
const DEFAULT_TITLE = `${brand.profile.brandName} — ${brand.profile.tagline}`;
const OG_IMAGE = brand.assets.ogImagePath;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s — ${brand.profile.brandName}`,
  },
  description: DESCRIPTION,
  keywords: brand.keywords,
  openGraph: {
    type: "website",
    siteName: brand.profile.brandName,
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: brand.profile.brandName, type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  alternates: { canonical: SITE_URL },
};

// Organization schema — the baseline fact-anchor answer engines (Google's
// AI Overviews, ChatGPT, Perplexity) use to know who's actually behind the
// site before trusting anything else it says.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: brand.profile.brandName,
  url: SITE_URL,
  logo: `${SITE_URL}${brand.assets.orgLogoPath}`,
  description: DESCRIPTION,
  address: {
    "@type": "PostalAddress",
    streetAddress: brand.address.streetAddress,
    addressLocality: brand.address.addressLocality,
    addressRegion: brand.address.addressRegion,
    postalCode: brand.address.postalCode,
    addressCountry: brand.address.addressCountry,
  },
  sameAs: [brand.social.instagram, brand.social.facebook],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [pixelId, clarityProjectId] = await Promise.all([
    getSetting("META_PIXEL_ID"),
    getSetting("CLARITY_PROJECT_ID"),
  ]);

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${archivoBlack.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <MetaPixelTracker pixelId={pixelId} />
        <ClarityTracker projectId={clarityProjectId} />
        <CartProvider>
          <ScrollToTop />
          <CouponCapture />
          <Navbar />
          {children}
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
