import type { Metadata } from "next";
import { brand } from "@/lib/retail-os-brand";

const SITE_URL = brand.profile.siteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${brand.profile.brandName} — Stories You Can Wear`,
  description:
    "Travaholic makes premium trucker caps in India, each one inspired by a real place or journey. Flat ₹1,399 pricing, ships across India. Shop the full Collection at www.travaholic.in",
  openGraph: {
    type: "website",
    siteName: brand.profile.brandName,
    title: `${brand.profile.brandName} — Stories You Can Wear`,
    description:
      "Travaholic makes premium trucker caps in India, each one inspired by a real place or journey. Flat ₹1,399 pricing, ships across India. Shop the full Collection at www.travaholic.in",
    url: `${SITE_URL}/cart`,
    images: [
      {
        url: "/images/brand/travaholic-logo-square-preview.png",
        width: 800,
        height: 800,
        alt: brand.profile.brandName,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${brand.profile.brandName} — Stories You Can Wear`,
    description:
      "Travaholic makes premium trucker caps in India. Flat ₹1,399 pricing, ships across India. Shop the full Collection at www.travaholic.in",
    images: ["/images/brand/travaholic-logo-square-preview.png"],
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
