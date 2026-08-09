import Image from "next/image";
import Link from "next/link";
import { getExplorerPosts } from "@/lib/community";
import { chapters } from "@/lib/chapters";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

function chapterName(slug: string) {
  return chapters.find((c) => c.slug === slug)?.name ?? slug;
}

export default function CommunityPage() {
  const posts = getExplorerPosts();

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
          <div className="mt-16 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {posts.map((post) => {
              const primarySlug = post.chapterSlugs[0];

              return (
                <div key={post.file}>
                  <Link
                    href={primarySlug ? `/chapter/${primarySlug}` : "/series"}
                    className="group block"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-surface-alt">
                      <Image
                        src={post.src}
                        alt={post.testimonial}
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    </div>
                  </Link>
                  <p className="mt-3 text-caption text-secondary-text">
                    &ldquo;{post.testimonial}&rdquo;
                  </p>
                  {post.chapterSlugs.length > 0 && (
                    <p className="mt-2 text-caption uppercase tracking-[0.05em] text-ink">
                      Worn by Explorer —{" "}
                      {post.chapterSlugs.map((slug, i) => (
                        <span key={slug}>
                          <Link href={`/chapter/${slug}`} className="underline underline-offset-4">
                            {chapterName(slug)}
                          </Link>
                          {i < post.chapterSlugs.length - 1 ? " & " : ""}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              );
            })}
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
