import type { Metadata } from "next";
import { brand } from "@/lib/retail-os-brand";
import CartClient from "./CartClient";

const SITE_URL = brand.profile.siteUrl;

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const items = typeof resolved?.items === "string" ? resolved.items : "";
  const ogImageUrl = items
    ? `${SITE_URL}/api/og/cart?items=${encodeURIComponent(items)}`
    : `${SITE_URL}/api/og/cart`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `Your Cart — ${brand.profile.brandName}`,
    description:
      "Complete your Travaholic order securely with Free Express Delivery across India.",
    openGraph: {
      type: "website",
      siteName: brand.profile.brandName,
      title: `Your Cart is Ready — ${brand.profile.brandName}`,
      description:
        "Complete your Travaholic order securely with Free Express Delivery across India.",
      url: `${SITE_URL}/cart${items ? `?items=${encodeURIComponent(items)}` : ""}`,
      images: [
        {
          url: ogImageUrl,
          width: 800,
          height: 800,
          alt: `${brand.profile.brandName} Cart`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `Your Cart is Ready — ${brand.profile.brandName}`,
      description:
        "Complete your Travaholic order securely with Free Express Delivery across India.",
      images: [ogImageUrl],
    },
  };
}

export default function CartPage() {
  return <CartClient />;
}
