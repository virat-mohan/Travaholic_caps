import Image from "next/image";
import Link from "next/link";
import { NewsletterBlock } from "@/components/newsletter/NewsletterBlock";
import { FooterEditorial } from "@/components/footer/FooterEditorial";

export default function AboutPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40">
        <p className="text-caption uppercase tracking-[0.15em] text-secondary-text">
          Our Story
        </p>
        <h1 className="mt-2 font-display text-heading-xl uppercase text-ink md:text-display-m">
          Stories You Can Wear.
        </h1>

        <div className="mx-auto mt-16 max-w-[760px] text-center">
          <p className="font-display text-heading-l text-charcoal md:text-heading-xl">
            My love for caps was inspired by an outdoorsy childhood in Durban — surfing, hiking,
            hanging by the beach, seldom without a cap on my head.
          </p>
          <p className="mt-6 text-body text-secondary-text">
            Every Chapter starts as a sketch, old-school charcoal and paper, before it&apos;s
            digitised and sampled until the colours carry the memory of the place that inspired
            it. A cap has got to be your favourite travel companion — not a product you bought,
            a moment you&apos;re still wearing.
          </p>
          <p className="mt-4 text-caption text-secondary-text">— Ishan Seth, Founder</p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 border-t border-divider pt-16 md:grid-cols-2 md:gap-16">
          <div>
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-alt">
              <Image
                src="/images/team/ishan-seth.png"
                alt="Ishan Seth, Founder of Travaholic"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            </div>
            <p className="mt-3 text-caption uppercase tracking-[0.05em] text-secondary-text">
              Wearing{" "}
              <Link href="/chapter/wildling" className="text-ink underline underline-offset-4">
                Wildling
              </Link>
            </p>
          </div>

          <div>
            <p className="font-display text-heading-m uppercase text-ink">Ishan Seth</p>
            <p className="mt-1 text-caption uppercase tracking-[0.1em] text-secondary-text">
              Founder
            </p>

            <div className="mt-8 space-y-6 text-body text-ink">
              <p>
                My love for caps was inspired by my beautiful childhood in Durban, South Africa.
                With our active and outdoorsy lifestyle that included surfing, hiking, tennis,
                running, or just hanging with friends at the beach — seldom would you find me
                without my trusty cap on my head. As I grew up, I also developed a love for art,
                and sketching became a serious hobby. This combined love of art and adventure
                motivated me to develop high quality trucker caps, for all the different
                landscapes traversed by someone who&apos;s bitten by the travel bug — mountains,
                beaches, deserts and metropolises&hellip;
              </p>
              <p>
                All the art was sketched by me (yes, I&apos;m talking old-school charcoal and
                paper), then digitally rendered and painstakingly sampled to get graphics and
                hues that capture your wanderlust and carry memories of your time in magical
                locales. Travaholic is a travel, adventure and lifestyle company, and a cap has
                got to be your favourite travel accessory on any trip.
              </p>
            </div>
          </div>
        </div>
      </main>

      <NewsletterBlock />
      <FooterEditorial />
    </>
  );
}
