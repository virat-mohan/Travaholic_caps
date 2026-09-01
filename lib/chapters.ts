import type { Chapter } from "@/types/chapter";

/**
 * Static Chapter catalogue sourced from public/images/chapters.
 * Pricing/specs per travaholic-build-brief.md: flat ₹1,399, no discount gimmicks.
 * Temporary — Phase 6 replaces this with Sanity-driven content.
 */
export const chapters: Chapter[] = [
  {
    slug: "travaholic-black",
    name: "Travaholic Black",
    series: "The Essentials",
    folder: "Travaholic Black",
    images: [
      "_MG_0160 final.jpg",
      "_MG_0161 final.jpg",
      "_MG_0164 final.jpg",
      "_MG_0166 final.jpg",
      "_MG_0185 final.jpg",
    ],
    primary: "_MG_0164 final.jpg",
    sideImage: "_MG_0164 final.jpg",
    story:
      "The one cap that goes with literally everything you own. No print, no gimmick — just certified drip for whatever the day throws at you. Main character energy, monochrome edition.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "travaholic-ocean",
    name: "Travaholic Ocean",
    series: "Blue Horizon",
    folder: "Travaholic Ocean",
    images: ["IMG_0203.JPG", "IMG_0205.JPG", "IMG_0206.JPG", "IMG_0207.JPG", "IMG_0209.JPG"],
    primary: "IMG_0205.JPG",
    sideImage: "IMG_0205.JPG",
    story:
      "For the ones who are low-key obsessed with that ocean-meets-sky blue. Put this on and you're instantly built different — beach brain, boat hair, zero notes.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "travaholic-sky",
    name: "Travaholic Sky",
    series: "Blue Horizon",
    folder: "Travaholic Sky",
    images: [
      "_MG_0167 final.jpg",
      "_MG_0168 final.jpg",
      "_MG_0170 final.jpg",
      "_MG_0172 final.jpg",
      "_MG_0184 final.jpg",
    ],
    primary: "_MG_0170 final.jpg",
    sideImage: "_MG_0170 final.jpg",
    story:
      "Head in the clouds, energy immaculate. Sky's for staring out of plane windows and pretending you're the main character of your own travel montage. Somewhere above the noise, literally.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "beachn",
    name: "Beach'n",
    series: "Summer Escape",
    folder: "Beach_n",
    images: [
      "_MG_0129 final.jpg",
      "_MG_0130 final.jpg",
      "_MG_0131 final.jpg",
      "_MG_0132 final.jpg",
      "_MG_0194 final.jpg",
    ],
    primary: "_MG_0131 final.jpg",
    sideImage: "_MG_0131 final.jpg",
    story:
      "Sun's down, vibes up. Beach'n is golden-hour main-character energy and zero plans for tomorrow. Certified beach brain, no cap.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "sunshine",
    name: "Sunshine",
    series: "Summer Escape",
    folder: "Travaholic Sunshine",
    images: [
      "IMG_0262-final-1024x1024.jpg.webp",
      "IMG_0269-final-1024x1024.jpg.webp",
      "IMG_0272-final-1024x1024.jpg.webp",
      "IMG_0273-final-1024x1024.jpg.webp",
      "IMG_0275-final-1024x1024.jpg.webp",
    ],
    primary: "IMG_0262-final-1024x1024.jpg.webp",
    sideImage: "IMG_0262-final-1024x1024.jpg.webp",
    story:
      "There's a version of a day with absolutely nothing on it — no itinerary, no overthinking, just sun on your face and a main-character walk to nowhere in particular. Sunshine is that day, worn as a cap.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "tropical-blue",
    name: "Tropical Blue",
    series: "Summer Escape",
    folder: "Tropical Blue",
    images: [
      "_MG_0155 final.jpg",
      "_MG_0156 final.jpg",
      "_MG_0157 final.jpg",
      "_MG_0159 final.jpg",
      "_MG_0186 final.jpg",
    ],
    primary: "_MG_0157 final.jpg",
    sideImage: "_MG_0157 final.jpg",
    story:
      "Too warm, too green, too good to be real — that's the energy. Put this on and unlock instant vacation brain, wherever you actually are.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "tropical-pink",
    name: "Tropical Pink",
    series: "Summer Escape",
    folder: "Tropical Pink",
    images: ["IMG_0195.JPG", "IMG_0196.JPG", "IMG_0197.JPG", "IMG_0198.JPG", "IMG_0200.JPG"],
    primary: "IMG_0198.JPG",
    sideImage: "IMG_0198.JPG",
    story:
      "Same tropical energy, dialled up. This one's giving sunset-that-lived-in-your-head-rent-free. Wear it like you mean it.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "dunes-maroon",
    name: "Dunes Maroon",
    series: "Desert Trails",
    folder: "Dunes Maroon",
    images: [
      "_MG_0146 final.jpg",
      "_MG_0147 final.jpg",
      "_MG_0148 final.jpg",
      "_MG_0149 final.jpg",
      "_MG_0189 final.jpg",
    ],
    primary: "_MG_0148 final.jpg",
    sideImage: "_MG_0148 final.jpg",
    story:
      "Golden hour, but make it desert. Dunes Maroon is for the ones who go quiet when the sand turns the colour of rust — moody, main character, a little mysterious.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "dunes-yellow",
    name: "Dunes Yellow",
    series: "Desert Trails",
    folder: "Dunes Yellow",
    images: [
      "_MG_0150 final.jpg",
      "_MG_0151 final.jpg",
      "_MG_0153 final.jpg",
      "_MG_0154 final.jpg",
      "_MG_0187 final.jpg",
    ],
    primary: "_MG_0153 final.jpg",
    sideImage: "_MG_0153 final.jpg",
    story:
      "Same dunes, earlier in the day, when the sand is still throwing gold light back at you and the heat hasn't won yet. I wanted a cap that felt like the last good hour before noon in the desert.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "peaking",
    name: "Peaking",
    series: "Above The Clouds",
    folder: "Peaking",
    images: [
      "_MG_0173 final.jpg",
      "_MG_0175 final.jpg",
      "_MG_0178 final.jpg",
      "_MG_0179 final.jpg",
      "_MG_0183 final.jpg",
    ],
    primary: "_MG_0178 final.jpg",
    sideImage: "_MG_0178 final.jpg",
    story:
      "There's a moment on every mountain trail where you stop complaining about your legs because the view finally shuts you up. Peaking is that moment, sketched from a summit I definitely should have trained more for.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "travaholic-snow",
    name: "Travaholic Snow",
    series: "Above The Clouds",
    folder: "Travaholic Snow",
    images: ["IMG_8855.JPG", "IMG_8859.JPG", "IMG_8861.JPG", "IMG_8862.JPG", "IMG_8863.JPG"],
    primary: "IMG_8859.JPG",
    sideImage: "IMG_8859.JPG",
    story:
      "White on white, because at altitude everything else disappears and it's just you, the cold, and the quiet. This one's for the mornings your breath shows before your coffee does.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "wildling",
    name: "Wildling",
    series: "Into The Wild",
    folder: "Wildling",
    images: ["IMG_1812.jpg", "IMG_1814.jpg", "IMG_1815.jpg", "IMG_1818.jpg", "IMG_1826.jpg"],
    primary: "IMG_1812.jpg",
    sideImage: "IMG_1812.jpg",
    story:
      "A wolf on a rock, mountains behind, the last bit of light before the forest goes properly dark. Wildling's for the part of a trip when your phone has no signal and you stop checking it anyway.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "junglee",
    name: "Junglee",
    series: "Into The Wild",
    folder: "Junglee",
    images: ["IMG_1820.jpg", "IMG_1821.jpg", "IMG_1822.jpg", "IMG_1823.jpg", "IMG_1825.jpg"],
    primary: "IMG_1820.jpg",
    sideImage: "IMG_1820.jpg",
    story:
      "Junglee means wild in a way that doesn't quite translate — a little feral, a little free. This one came from a trek where we got properly, gloriously lost for an afternoon and didn't mind at all.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "city-slicker",
    name: "City Slicker",
    series: "Urban Nomad",
    folder: "City Slicker Black",
    images: ["IMG_7229.jpg", "IMG_7230.jpg", "IMG_7231.jpg", "IMG_7232.jpg", "IMG_7233.jpg"],
    primary: "IMG_7229.jpg",
    sideImage: "IMG_7229.jpg",
    story:
      "Not every trip needs a mountain. Some of the best ones are just a new skyline and a coffee you haven't tried yet. City Slicker is for the traveller who's just as at home lost in a new city as lost on a trail.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "city-slicker-black",
    name: "City Slicker Black",
    series: "Urban Nomad",
    folder: "City Slicker Black Grey",
    images: [
      "_MG_0139 final.jpg",
      "_MG_0141 final.jpg",
      "_MG_0144 final.jpg",
      "_MG_0145 final.jpg",
      "_MG_0190 final.jpg",
    ],
    primary: "_MG_0144 final.jpg",
    sideImage: "_MG_0144 final.jpg",
    story:
      "Same city, later at night. Black, because that's what the skyline turns into once the sun's fully down and the lights take over the sketch instead.",
    price: 1399,
    verifiedOnSite: true,
  },
  {
    slug: "travaholic-orange",
    name: "Travaholic Orange",
    series: "The Essentials",
    folder: "Travaholic Orange",
    images: [
      "_MG_0133 final.jpg",
      "_MG_0134 final.jpg",
      "_MG_0135 final.jpg",
      "_MG_0137 final.jpg",
      "_MG_0191 final.jpg",
    ],
    primary: "_MG_0135 final.jpg",
    sideImage: "_MG_0135 final.jpg",
    story:
      "Every trail has those little markers that tell you you're still going the right way. Orange is that — a small, stubborn flash of colour that says keep going, you're close.",
    price: 1399,
    verifiedOnSite: true,
  },
];

/**
 * One combined list for every Chapter's product-details + craftsmanship
 * section, in the specific order the brand wants it read in. Made In India
 * stays last on purpose.
 */
export const SHARED_SPECS = [
  "One Size Fits All — 52cm To 60cm",
  "Snap Backstrap",
  "Hand-Sketched Patch Graphic",
  "Poly-Blend Cotton Twill Fabric",
  "Featherlight, All-Day Wear",
  "Structured To Hold Its Shape",
  "Curved Brim For Real Sun Coverage",
  "Premium Stitch Reinforcement",
  "Made In India",
];

/**
 * Original photography was replaced in place by transparent cutouts named
 * "<original stem>_no_bg.png" (e.g. "IMG_1812.jpg" -> "IMG_1812_no_bg.png").
 * Chapter data still stores the original filenames as stable identifiers —
 * this resolves them to the actual file on disk.
 */
export function chapterImageSrc(folder: string, file: string) {
  // Admin-added Chapters and hero overrides can point straight at a full
  // Storage URL — pass those through unchanged instead of treating them as
  // an on-disk filename.
  if (/^https?:\/\//.test(file)) return file;

  const dot = file.lastIndexOf(".");
  const stem = dot === -1 ? file : file.slice(0, dot);
  const resolved = `${stem}_no_bg.png`;
  return `/images/chapters/${encodeURIComponent(folder)}/${encodeURIComponent(resolved)}`;
}
