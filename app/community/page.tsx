import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

function getCommunityPhotos() {
  const communityDir = path.join(process.cwd(), "public/images/community");
  const lifestyleDir = path.join(process.cwd(), "public/images/lifestyle");

  const fromDir = (dir: string, urlBase: string) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
          .map((f) => `${urlBase}/${encodeURIComponent(f)}`)
      : [];

  return [
    ...fromDir(communityDir, "/images/community"),
    ...fromDir(lifestyleDir, "/images/lifestyle"),
  ];
}

export default function CommunityPage() {
  const photos = getCommunityPhotos();

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
          Explorers
        </p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Real People. Real Journeys.
        </h1>
        <p className="mt-4 max-w-md text-body text-secondary-text">
          Travaholic is built by Explorers — real adventures, real photography. No manufactured
          influencer culture, just people wearing a story.
        </p>

        {photos.length > 0 ? (
          <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((src) => (
              <div key={src} className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                <Image src={src} alt="" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-16 border-t border-divider py-24 text-center">
            <p className="font-display text-heading-m uppercase text-ink">
              This trail hasn&apos;t been photographed yet.
            </p>
            <p className="mt-3 text-body-s text-secondary-text">
              Explorer stories are on their way — check back soon.
            </p>
          </div>
        )}
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
