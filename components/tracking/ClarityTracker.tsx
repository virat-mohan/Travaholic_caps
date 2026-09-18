import Script from "next/script";

/**
 * Microsoft Clarity — session recordings + rage/dead-click heatmaps, free
 * with no session cap. Clarity masks all text input by default (payment and
 * address fields included) unless explicitly unmasked, so no extra work is
 * needed to keep captured sessions from including what customers type.
 */
export function ClarityTracker({ projectId }: { projectId: string | null }) {
  if (!projectId) return null;

  return (
    <Script id="clarity-tracker" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${projectId}");`}
    </Script>
  );
}
