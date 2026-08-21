import { ExploreGlobe } from "@/components/globe/ExploreGlobe";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function TravelInspirationPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-24 md:px-12 md:pt-32">
        <ExploreGlobe />
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
