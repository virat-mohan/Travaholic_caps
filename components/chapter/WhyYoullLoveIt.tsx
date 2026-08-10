import Image from "next/image";
import { craftsmanshipPinsFor } from "@/lib/craftsmanshipPins";

export function WhyYoullLoveIt({ slug, name }: { slug: string; name: string }) {
  const pins = craftsmanshipPinsFor(slug);
  const image = `/images/craftsmanship/${slug}.png`;
  const leftPins = pins.filter((_, i) => i % 2 === 0);
  const rightPins = pins.filter((_, i) => i % 2 === 1);

  return (
    <section className="px-6 py-12 md:px-12 md:py-16">
      <p className="text-center font-display text-heading-m uppercase text-ink">
        Travaholic Craftsmanship
      </p>

      {/* Desktop: annotated diagram with connector lines. Doesn't translate to
          narrow screens — labels need real horizontal room either side of the image. */}
      <div className="relative mx-auto mt-12 hidden h-[420px] max-w-[720px] md:block md:h-[480px]">
        <div className="absolute left-1/2 top-1/2 h-[85%] w-[46%] -translate-x-1/2 -translate-y-1/2">
          <Image src={image} alt={name} fill sizes="360px" className="object-contain" />
        </div>

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {leftPins.map((c, i) => {
            const labelY = 18 + i * 32;
            const labelX = 22;
            return (
              <path
                key={c.label}
                d={`M ${labelX} ${labelY} H ${(labelX + c.x) / 2} V ${c.y} H ${c.x}`}
                fill="none"
                stroke="var(--color-secondary-text)"
                strokeWidth="0.12"
              />
            );
          })}
          {rightPins.map((c, i) => {
            const labelY = 18 + i * 32;
            const labelX = 78;
            return (
              <path
                key={c.label}
                d={`M ${labelX} ${labelY} H ${(labelX + c.x) / 2} V ${c.y} H ${c.x}`}
                fill="none"
                stroke="var(--color-secondary-text)"
                strokeWidth="0.12"
              />
            );
          })}
          {pins.map((c) => (
            <circle key={`${c.label}-dot`} cx={c.x} cy={c.y} r="0.8" fill="var(--color-ink)" />
          ))}
        </svg>

        {leftPins.map((c, i) => (
          <p
            key={c.label}
            className="absolute left-0 max-w-[150px] text-right font-sans text-caption font-bold uppercase leading-tight text-ink"
            style={{ top: `${18 + i * 32}%`, transform: "translateY(-50%)" }}
          >
            {c.label}
          </p>
        ))}
        {rightPins.map((c, i) => (
          <p
            key={c.label}
            className="absolute right-0 max-w-[150px] text-left font-sans text-caption font-bold uppercase leading-tight text-ink"
            style={{ top: `${18 + i * 32}%`, transform: "translateY(-50%)" }}
          >
            {c.label}
          </p>
        ))}
      </div>

      {/* Mobile: image full-width, features as a simple stacked list below. */}
      <div className="mt-10 md:hidden">
        <div className="relative mx-auto aspect-square w-full max-w-[320px]">
          <Image src={image} alt={name} fill sizes="320px" className="object-contain" />
        </div>
        <ul className="mx-auto mt-8 grid max-w-[320px] grid-cols-2 gap-x-6 gap-y-4">
          {pins.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink" />
              <span className="font-sans text-caption font-bold uppercase leading-tight text-ink">
                {c.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
