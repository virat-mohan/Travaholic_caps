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
  /** Which magazine-style Issue this article belongs to. */
  issue: number;
};

export type JournalIssue = {
  number: number;
  name: string;
  theme: string;
};

export const journalIssues: JournalIssue[] = [
  {
    number: 1,
    name: "Issue No. 01 — First Light",
    theme: "Origins, deserts at dawn, and the first few Chapters worth writing down.",
  },
  {
    number: 2,
    name: "Issue No. 02 — Thin Air & Bright Colour",
    theme: "Altitude, patch design up close, and a weekend in Jaipur.",
  },
];

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
    issue: 1,
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
    issue: 1,
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
    issue: 1,
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
    issue: 1,
  },
  {
    slug: "view-that-quiets-your-legs",
    title: "The View That Finally Quiets Your Legs",
    subtitle: "On altitude, thin air, and why the last switchback is always the one that gets you.",
    category: "Photography",
    readingTime: 5,
    publishedAt: "2026-07-28",
    heroImage: chapterHero("peaking"),
    excerpt:
      "Nobody warns you that the hardest part of a summit isn't the climb — it's the twenty minutes before the climb, when your legs already know.",
    body: [
      "There's a specific kind of quiet that only shows up above a certain altitude — thinner air, fewer birds, your own breathing suddenly the loudest thing around. Peaking was sketched from exactly that moment: not the summit photo everyone takes, but the switchback right before it, the one where you stop talking because talking costs oxygen you'd rather spend on the next step.",
      "Every mountain trail has a version of this. The view doesn't actually arrive all at once — it leaks in, ridge by ridge, until you're far enough up that turning around feels like the harder option. That's usually the exact point where a cap starts mattering more than you expected: sun at altitude is meaner than sun at sea level, and squinting through the last hour of a climb is its own kind of miserable.",
      "> The camera never quite gets it. Thin light, cold hands, a view that's more felt than seen — Peaking exists because a sketch could hold what a photo kept losing.",
      "Travaholic Snow came from the same range, a season later — the version of altitude that isn't about climbing anymore, just about being there once the snow's settled in and the whole mountain's gone quiet in a different way. Breath showing before your coffee does. Fewer people. The same thin light, colder.",
      "If you're planning a trip that involves any real altitude — a trek, a pass, a viewpoint that requires actual effort to reach — the gear advice is boring but true: layers you can shed fast, a cap with a real brim for the glare, and a phone you're willing to leave in your bag for the last hour. The view has never once been improved by someone checking their notifications first.",
    ],
    relatedChapterSlugs: ["peaking", "travaholic-snow"],
    issue: 2,
  },
  {
    slug: "jaipur-two-shades-of-blue",
    title: "Jaipur, In Two Shades Of Blue",
    subtitle: "A weekend at the Hawa Mahal, and the two Chapters that ended up in every photo.",
    category: "Travel Guides",
    readingTime: 4,
    publishedAt: "2026-08-04",
    heroImage: "/images/lifestyle/DSCF5311.jpg",
    excerpt:
      "Jaipur gives you pink sandstone against a blue sky often enough that packing anything but blue felt wrong.",
    body: [
      "The Hawa Mahal doesn't need much help — a five-storey wall of pink sandstone and 953 tiny windows, built so the palace women could watch the street below without being seen themselves. Mornings there are quiet in a way the rest of Jaipur isn't, and the light does something specific: the sandstone goes almost orange, and everything else — sky, shadow, the caps we happened to be wearing — reads bluer by comparison.",
      "We hadn't planned it, but Travaholic Ocean and Travaholic Sky ended up in almost every photo from that weekend. Ocean is the deeper of the two, the blue you'd associate with open water. Sky is a shade lighter, closer to the actual colour of a clear Rajasthan afternoon. Side by side against pink sandstone, they read like they were designed for exactly this, even though the sketch for both happened nowhere near a desert.",
      "> Same brand, same circular patch, two different blues — the kind of detail that only matters once you see them next to each other in real light.",
      "Jaipur rewards slow mornings and even slower food breaks — this isn't a city to rush through on a checklist. Hawa Mahal before 9 a.m., the City Palace once the light gets harder, and then however many hours it takes to get properly lost in the lanes around Bapu Bazaar. Bring a cap that can handle full sun for most of the day, because shade is not a guarantee here.",
      "If a trip is mostly going to happen in front of pink sandstone and blue sky, it turns out the cap you pick matters more than you'd think. We didn't plan the colour story. Jaipur just kept handing it to us.",
    ],
    relatedChapterSlugs: ["travaholic-ocean", "travaholic-sky"],
    issue: 2,
  },
  {
    slug: "patch-before-the-patch",
    title: "The Patch Before The Patch",
    subtitle: "Design Notes — what a Chapter's graphic looks like before it's ever stitched.",
    category: "Design Notes",
    readingTime: 4,
    publishedAt: "2026-08-08",
    heroImage: "/images/brand/travaholic-lines-sketch-hero.png",
    excerpt:
      "Every patch spends longer as a coloured-pencil sketch than it ever does as a charcoal drawing — this is the stage nobody outside the studio usually sees.",
    body: [
      "Most people who've heard how a Travaholic patch gets made know the first step: charcoal, paper, a real place. Fewer know the middle step, the one that actually takes the longest — a coloured-pencil pass, done after the digital render, that exists purely to test whether a colour combination survives being looked at slowly.",
      "It sounds redundant. It isn't. A digital mockup can lie — screens render colour with a confidence thread never has. Coloured pencil is slower and more honest; you can see exactly where a shade is doing too much work, where a line is thinner than the embroidery machine will actually manage, where two colours that looked fine on-screen are fighting each other on paper.",
      "> The line-art version — no colour, just the shapes — is the real test. If a patch still reads clearly in pure black outline, the design underneath is solid. If it needs colour to make sense, it needs more work.",
      "Travaholic Orange exists almost entirely as that line-art test, kept deliberately uncoloured — a mountain, a sun, a wave, stitched straight onto the panel with no patch material at all. It's the one Chapter where the middle step became the whole point instead of a checkpoint on the way to something busier.",
      "None of this is visible in the final product photo, and that's sort of the idea. A cap either feels considered or it doesn't, and most of what makes it feel that way happened in a sketchbook weeks before a single thread got involved.",
    ],
    relatedChapterSlugs: ["travaholic-orange"],
    issue: 2,
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

export function issuesSorted() {
  return [...journalIssues].sort((a, b) => b.number - a.number);
}

export function articlesForIssue(issueNumber: number) {
  return journalArticles
    .filter((a) => a.issue === issueNumber)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
}
