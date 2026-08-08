import { chapters, chapterImageSrc } from "@/lib/chapters";

export type JournalCategory =
  | "Road Trips"
  | "Weekend Escapes"
  | "Camping"
  | "Coffee"
  | "Photography"
  | "Behind The Craft"
  | "Design Notes"
  | "Explorer Stories"
  | "Travel Guides"
  | "Playlists"
  | "Packing Lists"
  | "Collaborations";

export type JournalArticle = {
  slug: string;
  title: string;
  subtitle: string;
  category: JournalCategory;
  readingTime: number;
  publishedAt: string;
  heroImage: string;
  excerpt: string;
  /** Paragraphs in reading order. A paragraph starting with "> " renders as a pull quote. */
  body: string[];
  /** At most two Chapters per article, per brand rule — this is a story, not a catalogue. */
  relatedChapterSlugs: string[];
};

function chapterHero(slug: string) {
  const chapter = chapters.find((c) => c.slug === slug);
  if (!chapter) return "/images/team/ishan-seth.png";
  return chapterImageSrc(chapter.folder, chapter.primary);
}

export const journalArticles: JournalArticle[] = [
  {
    slug: "charcoal-sketch-becomes-a-cap",
    title: "How A Charcoal Sketch Becomes A Cap",
    subtitle: "Behind The Craft — the long road from a trail memory to an embroidered patch.",
    category: "Behind The Craft",
    readingTime: 6,
    publishedAt: "2026-06-02",
    heroImage: "/images/team/ishan-seth.png",
    excerpt:
      "Every Travaholic patch starts the same unglamorous way: charcoal, paper, and a memory that won't leave you alone.",
    body: [
      "Ishan Seth sketches with charcoal, not a tablet. Old-school, on purpose. \"There's something about the resistance of paper,\" he says. \"A stylus never fights back. Charcoal does — it smudges, it argues, it makes you slow down and actually look at what you're drawing instead of what you remember it looking like.\"",
      "Every Chapter begins here, at a desk with a smudged hand, months before a single thread goes into a machine. Not with a mood board or a trend report — with a specific place, seen at a specific hour. Dunes Yellow started as three lines scratched out at 6 a.m. in the Thar, trying to catch the exact minute before the sand goes from gold to white-hot. Wildling started as a wolf on a rock that Ishan swears he actually saw, though nobody else on that trek did.",
      "> The art has to survive being wrong twice before it's right once.",
      "The charcoal sketch is the easy part, relatively speaking. What follows is a slow, humbling translation: from paper to a digital render, then to a colour-separated file a machine can actually stitch, then to a physical thread sample that almost never matches the screen. \"Digital colour lies to you,\" Ishan says. \"A blue that looks perfect on a monitor comes out flat and lifeless in 3D embroidery. You have to keep sending it back.\"",
      "That back-and-forth is where most of a Chapter's development time actually goes — not in the drawing, but in the arguing with thread. A tech pack gets marked up, a sample patch comes back, someone holds it next to the original sketch under real daylight and says no, warmer, and it goes back again. Border thickness has to match across an entire Series so the patches feel like a family, not a grab-bag. Height and width get measured to the tenth of an inch. None of this shows up in the final product description. All of it shows up if you get it wrong.",
      "By the time a patch is small enough to sit on the front of a five-panel trucker — usually somewhere around 2.3 by 2.7 inches — it has been redrawn, rejected, and re-approved more times than anyone involved would like to admit. What's left is a compressed version of a real place and a real hour, stitched down so it survives rain, sun, and several hundred wears.",
      "That's the part we think gets lost when a cap becomes just \"merch.\" Nothing on a Travaholic cap is a stock graphic dropped onto a template. It's a sketch that had to earn its way onto your head — one revision at a time.",
    ],
    relatedChapterSlugs: ["dunes-yellow", "wildling"],
  },
  {
    slug: "desert-trails-packing-list",
    title: "The Last Good Hour Before Noon: A Desert Packing List",
    subtitle: "Everything worth carrying into the Thar, and the one thing everyone forgets.",
    category: "Packing Lists",
    readingTime: 5,
    publishedAt: "2026-06-16",
    heroImage: chapterHero("dunes-maroon"),
    excerpt:
      "Desert mornings are generous and desert afternoons are not. Pack like you know the difference.",
    body: [
      "There's a specific window in the desert — roughly 6 to 10 a.m. — when the light is doing something it won't repeat for the rest of the day, and the heat hasn't shown up to ruin it yet. Everything worth photographing, everything worth remembering, tends to happen inside that window. The rest of the day is mostly about surviving until the next one.",
      "Pack for the window, and pack for the survival, separately.",
      "For the good hour: a light layer you can shed fast, since the temperature swing from sunrise to mid-morning is bigger than you'll expect. A cap with an actual bill — not a beanie, not a bandana, something with a brim that keeps the low-angle sun out of your eyes while you're trying to get the shot. This is the entire reason Dunes Maroon and Dunes Yellow exist as two separate Chapters instead of one: the maroon reads right in the last light before sunset, the yellow reads right in the first light after sunrise. Same dunes, different hour, different cap.",
      "> The thing everyone forgets is a second layer for your lips and the back of your neck. Sunburn in the desert doesn't announce itself until it's too late to undo.",
      "For the survival: more water than feels reasonable, salt of some kind — electrolyte tabs, namkeen, whatever you'll actually eat — and sunglasses that block glare off sand, which is meaner than glare off water. A buff or light scarf for when the wind picks up in the afternoon and starts moving sand at ankle height. Closed shoes, not sandals, unless you enjoy vacuuming your footwear every twenty minutes.",
      "What you don't need: anything heavy, anything black that isn't actively being worn on your head, and a strict itinerary. The desert rewards people who get up early and otherwise let the day happen to them. Bring a cap that can take the sun, bring enough water for the boredom in between the good hours, and let the rest sort itself out.",
    ],
    relatedChapterSlugs: ["dunes-maroon", "dunes-yellow"],
  },
  {
    slug: "urban-nomad-weekend-guide",
    title: "Lost In A New City, On Purpose",
    subtitle: "A weekend guide for the traveller who treats a skyline like a trail.",
    category: "Weekend Escapes",
    readingTime: 5,
    publishedAt: "2026-06-30",
    heroImage: "/images/lifestyle/City Slicker in NYC.jpg",
    excerpt:
      "Not every trip needs a mountain. Some of the best weekends are just a new skyline and a coffee you haven't tried yet.",
    body: [
      "There's a kind of traveller who feels a little guilty about loving cities. Like the real trip is supposed to involve a tent, a summit, or at minimum some visible discomfort. We'd like to push back on that, gently, from underneath a City Slicker cap somewhere on a Manhattan sidewalk at 7 a.m., before the crowds and with the light doing something nice off the glass towers.",
      "A weekend in a new city is its own kind of trail — you just navigate by coffee shops and cross streets instead of ridgelines. The rules of a good one are roughly the same as a good hike: start early, carry less than you think you need, and don't over-plan the middle of the day.",
      "Morning is for walking without a destination. Pick a direction, put on a cap that can handle wind off the water and a full day outside, and go until something stops you — a bakery, a bookstore, a bridge you didn't know was there. This is when a city gives up its actual character, before it's fully awake and performing for tourists.",
      "> City Slicker Black exists for exactly this — the same skyline, hours later, once the sun's fully down and the lights have taken over the sketch instead.",
      "Afternoon is for one deliberate thing — a museum, a market, a neighbourhood you specifically wanted to see — and then getting comfortably lost on the walk back. Evening is for the version of the city that only shows up after dark: rooftop lit windows, a skyline that reads completely differently in black than it did in grey daylight. That shift is the whole reason City Slicker comes in two moods instead of one.",
      "You don't need a car, a plan, or a mountain to have a real trip. You need a weekend, a cap, and the willingness to treat an unfamiliar subway map the way you'd treat a trailhead — as something to figure out as you go.",
    ],
    relatedChapterSlugs: ["city-slicker", "city-slicker-black"],
  },
  {
    slug: "no-signal-into-the-wild",
    title: "No Signal, No Problem",
    subtitle: "Notes from the hours your phone stops working and you stop minding.",
    category: "Explorer Stories",
    readingTime: 4,
    publishedAt: "2026-07-14",
    heroImage: chapterHero("wildling"),
    excerpt:
      "The best part of most trips is the part with no bars, no maps, and no idea what's around the next bend.",
    body: [
      "Somewhere on a forest trail, without much warning, your phone goes from four bars to one to a small crossed-out triangle, and something in your shoulders finally lets go. It's a strange thing to look forward to — the exact moment you become uncontactable — but if you've spent any real time in the wild, you know the feeling. It's not about the view yet. It's about the quiet before the view.",
      "Wildling came out of an afternoon like that — light going, trail narrowing, and then a wolf on a rock that only one person on the trek actually saw, watching the group pass without much interest in being watched back. Nobody could get a photo. The signal was long gone. So it became a sketch instead, and then a cap, which might be a more honest record of the moment than a photo would have been anyway — photos can be faked, a memory this specific mostly can't.",
      "> Junglee means wild in a way that doesn't quite translate to English — a little feral, a little free, entirely unbothered by your schedule.",
      "Junglee, its sibling Chapter, came from the same general chaos a few hours later — properly, gloriously lost for an afternoon on a trek that had a route plan nobody was following anymore. Nobody minded. That's the part that's hard to explain to someone who hasn't done it: getting lost in the wild, with the right company and enough daylight left, doesn't feel like a mistake. It feels like the trip actually starting.",
      "If you're planning time off signal — actually off, not just doom-scrolling in airplane mode — bring less than you think, tell someone roughly where you'll be, and let a few hours go unplanned. The best stories from Into The Wild were never the ones on the itinerary.",
    ],
    relatedChapterSlugs: ["wildling", "junglee"],
  },
];

export function getJournalArticle(slug: string) {
  return journalArticles.find((a) => a.slug === slug);
}

export function allJournalArticlesSorted() {
  return [...journalArticles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function relatedChaptersFor(article: JournalArticle) {
  return chapters.filter((c) => article.relatedChapterSlugs.includes(c.slug));
}
