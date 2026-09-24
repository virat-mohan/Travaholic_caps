import { getShareCardProductPool } from "@/lib/share-card-pool";
import { getBrandProfile } from "@/lib/brand";
import { ShareCardPreviewGrid } from "@/components/checkout/ShareCardPreviewGrid";

/**
 * Admin-only gallery of what a Pay With A Post share card looks like across
 * the live catalogue — the exact same canvas renderer the barterer sees,
 * so copy/layout changes can be checked here before a real customer ever
 * generates one. Codes are minted the same way lib/post-barter.ts does:
 * first name + a rotating theme word.
 */
export default async function ShareCardPreviewPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  const [pool, brand] = await Promise.all([getShareCardProductPool(), getBrandProfile()]);
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-28 pb-24 md:px-12">
      <h1 className="font-display text-heading-l uppercase text-ink">Pay With A Post — sample creatives</h1>
      <p className="mt-2 max-w-2xl text-body-s text-secondary-text">
        One card per Chapter, rendered by the same code a customer&apos;s Share button uses. Add <code>?name=Anun</code> to the URL to
        preview someone else&apos;s code.
      </p>
      <ShareCardPreviewGrid pool={pool} siteUrl={brand.siteUrl} firstName={(name || "Virat").trim()} />
    </main>
  );
}
