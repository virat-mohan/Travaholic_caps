import type { Metadata } from "next";
import { Archivo_Black, IBM_Plex_Mono } from "next/font/google";
import { Navbar } from "@/components/navigation/Navbar";
import { SplashIntro } from "@/components/hero/SplashIntro";
import { MetaPixelTracker } from "@/components/tracking/MetaPixel";
import { CartProvider } from "@/lib/cart";
import { getSetting } from "@/lib/settings";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Travaholic — Stories You Can Wear",
  description:
    "Premium trucker caps inspired by journeys, landscapes and moments worth remembering.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const pixelId = await getSetting("META_PIXEL_ID");

  return (
    <html
      lang="en"
      className={`${plexMono.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
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
