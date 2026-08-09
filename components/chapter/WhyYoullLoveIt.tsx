import Image from "next/image";

type Callout = {
  label: string;
  side: "left" | "right";
  /** Vertical position of the label, top to bottom, as a % of the card height. */
  labelY: number;
  /** Where the connector line points to on the cap image, in % of the image box. */
  targetX: number;
  targetY: number;
};

const CALLOUTS: Callout[] = [
  { label: "Embroidered Patch Graphic", side: "left", labelY: 18, targetX: 44, targetY: 42 },
  { label: "Poly-Blend Cotton Twill", side: "left", labelY: 50, targetX: 40, targetY: 14 },
  { label: "Made In India", side: "left", labelY: 82, targetX: 45, targetY: 90 },
  { label: "One Size — 52 to 60cm", side: "right", labelY: 18, targetX: 62, targetY: 16 },
  { label: "Curved Brim", side: "right", labelY: 50, targetX: 58, targetY: 88 },
  { label: "Reinforced Stitching", side: "right", labelY: 82, targetX: 56, targetY: 44 },
];

export function WhyYoullLoveIt({ image, name }: { image: string; name: string }) {
  return (
    <section className="px-6 py-12 md:px-12 md:py-16">
      <p className="font-display text-heading-m uppercase text-ink">Travaholic Craftsmanship</p>

      <div className="relative mx-auto mt-12 h-[420px] max-w-[720px] md:h-[480px]">
        <div className="absolute left-1/2 top-1/2 h-[85%] w-[46%] -translate-x-1/2 -translate-y-1/2">
          <Image src={image} alt={name} fill sizes="360px" className="object-contain" />
        </div>

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {CALLOUTS.map((c) => {
            const labelX = c.side === "left" ? 22 : 78;
            return (
              <path
                key={c.label}
                d={`M ${labelX} ${c.labelY} H ${(labelX + c.targetX) / 2} V ${c.targetY} H ${c.targetX}`}
                fill="none"
                stroke="var(--color-secondary-text)"
                strokeWidth="0.12"
              />
            );
          })}
          {CALLOUTS.map((c) => (
            <circle key={`${c.label}-dot`} cx={c.targetX} cy={c.targetY} r="0.8" fill="var(--color-ink)" />
          ))}
        </svg>

        {CALLOUTS.map((c) => (
          <p
            key={c.label}
            className={`absolute max-w-[150px] font-sans text-caption font-bold uppercase leading-tight text-ink ${
              c.side === "left" ? "left-0 text-right" : "right-0 text-left"
            }`}
            style={{ top: `${c.labelY}%`, transform: "translateY(-50%)" }}
          >
            {c.label}
          </p>
        ))}
      </div>
    </section>
  );
}
