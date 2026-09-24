import Link from "next/link";
import { getExplorerPosts } from "@/lib/community";
import { ExplorerGallery } from "@/components/community/ExplorerGallery";
import { chapters } from "@/lib/chapters";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

function chapterName(slug: string) {
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

export default async function CommunityPage() {
  const posts = await getExplorerPosts();

  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
              Explorers
            </p>
            <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
              Real People. Real Journeys.
            </h1>
            <p className="mt-4 max-w-md text-body text-secondary-text">
              Travaholic is built by Explorers — real adventures, real photography. No
              manufactured influencer culture, just people wearing a story.
            </p>
          </div>

          <Link
            href="/community/add-your-chapter"
            className="whitespace-nowrap border border-ink bg-ink px-6 py-3 font-sans text-body-s font-bold uppercase tracking-[0.1em] text-cream transition-colors duration-300 hover:bg-cream hover:text-ink"
          >
            Add Your Chapter
          </Link>
        </div>

        {posts.length > 0 ? (
          <ExplorerGallery
            posts={posts.map((post) => ({
              file: post.file,
              src: post.src,
              testimonial: post.testimonial,
              chapters: post.chapterSlugs.map((slug) => ({ slug, name: chapterName(slug) })),
            }))}
          />
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
