// lib/demo/catalog.ts
// WHAT IT'S FOR: the made-up demo shops: names, people, services, prices, hours and pay.
// Everything here is fictional. Everyone is shown by first name only, to keep the demo professional. Emails are @example.com and phone numbers are in the 555-01xx
// range, which is reserved for fiction, so nothing here can reach a real person.
// WHO USES IT: lib/demo/seed.ts. The catalog was approved before it was first seeded.
// WHY THE NAME: the demo "catalog"; ".ts" = no screen code.

export type DemoService = { name: string; description: string; durationMin: number; priceCents: number };
export type DemoPro = {
  name: string;
  title: string;
  email: string;
  phone: string;
  station: string;
  payType: "chair_rent" | "commission";
  payAmount: number; // cents per month (chair rent) or percent (commission)
  customPrices?: Record<string, number>; // service name -> cents; makes this pro "custom" priced
  bio: string;
};
export type DemoShop = {
  slug: string;
  name: string;
  businessType: "barbershop" | "nail_salon" | "lash_studio";
  timezone: string;
  owner: { name: string; email: string; phone: string };
  pros: DemoPro[];
  clients: Array<{ name: string; phone: string; email: string }>;
  services: DemoService[];
  // Open days (0 = Sunday) and hours in local time, plus a short break.
  openDays: number[];
  hours: { start: string; end: string; breakStart: string; breakEnd: string };
  // Style-card preference keys that make sense for this kind of shop, with sample values.
  preferences: Array<Record<string, string>>;
};

export const DEMO_SUPER_ADMIN = { name: "Alex", email: "alex.admin@example.com" };

export const DEMO_SHOPS: DemoShop[] = [
  {
    slug: "fade-factory",
    name: "Fade Factory",
    businessType: "barbershop",
    timezone: "America/New_York",
    owner: { name: "Ben", email: "ben.fadefactory@example.com", phone: "+12125550101" },
    pros: [
      {
        name: "Ray", title: "Master barber", email: "ray.fadefactory@example.com", phone: "+12125550102", station: "1",
        payType: "chair_rent", payAmount: 120000, customPrices: { "Skin fade": 5000, "Cut + beard": 6500 },
        bio: "Fifteen years behind the chair. Fades and hot towel shaves.",
      },
      { name: "Tia", title: "Barber", email: "tia.fadefactory@example.com", phone: "+12125550103", station: "2", payType: "commission", payAmount: 45, bio: "Tapers, textured cuts and kids' cuts." },
      { name: "Leo", title: "Barber", email: "leo.fadefactory@example.com", phone: "+12125550104", station: "3", payType: "commission", payAmount: 40, bio: "Sharp line-ups and beard work." },
    ],
    clients: [
      { name: "Chris", phone: "+12125550111", email: "chris.fadefactory@example.com" },
      { name: "Tyler", phone: "+12125550112", email: "tyler.fadefactory@example.com" },
      { name: "Marcus", phone: "+12125550113", email: "marcus.fadefactory@example.com" },
      { name: "Daniel", phone: "+12125550114", email: "daniel.fadefactory@example.com" },
      { name: "Andre", phone: "+12125550115", email: "andre.fadefactory@example.com" },
      { name: "Owen", phone: "+12125550116", email: "owen.fadefactory@example.com" },
    ],
    services: [
      { name: "Classic cut", description: "Scissor or clipper cut, shaped and finished.", durationMin: 30, priceCents: 3000 },
      { name: "Skin fade", description: "Sides faded down to the skin, blended into the top.", durationMin: 45, priceCents: 4000 },
      { name: "Beard trim & line-up", description: "Beard shaped and edged with a clean line.", durationMin: 20, priceCents: 2000 },
      { name: "Cut + beard", description: "Any haircut plus a beard trim and line-up.", durationMin: 60, priceCents: 5500 },
      { name: "Hot towel shave", description: "Straight-razor shave with hot towels.", durationMin: 30, priceCents: 3500 },
      { name: "Kids cut (12 and under)", description: "A haircut for kids 12 and under.", durationMin: 25, priceCents: 2200 },
      { name: "Edge-up", description: "Hairline and edges cleaned up between cuts.", durationMin: 15, priceCents: 1500 },
    ],
    openDays: [2, 3, 4, 5, 6],
    hours: { start: "09:00", end: "18:00", breakStart: "13:00", breakEnd: "13:30" },
    preferences: [
      { guard: "#2 on the sides, #4 on top", neckline: "tapered", beard: "lined up, short" },
      { guard: "skin fade, scissors on top", part: "hard part on the left" },
      { guard: "#1 all over", beard: "full, trimmed to a #3" },
    ],
  },
  {
    slug: "gloss-and-tips",
    name: "Gloss & Tips",
    businessType: "nail_salon",
    timezone: "America/New_York",
    owner: { name: "Paula", email: "paula.glossandtips@example.com", phone: "+13055550101" },
    pros: [
      {
        name: "Annie", title: "Senior nail tech", email: "annie.glossandtips@example.com", phone: "+13055550102", station: "1",
        payType: "chair_rent", payAmount: 100000, customPrices: { "Acrylic full set": 7500, "Acrylic fill": 5500 },
        bio: "Acrylic sets and sculpted nails.",
      },
      { name: "Gina", title: "Nail tech", email: "gina.glossandtips@example.com", phone: "+13055550103", station: "2", payType: "commission", payAmount: 45, bio: "Gel manicures and nail art." },
      { name: "Penny", title: "Nail tech", email: "penny.glossandtips@example.com", phone: "+13055550104", station: "3", payType: "commission", payAmount: 40, bio: "Pedicures and natural nail care." },
    ],
    clients: [
      { name: "Rachel", phone: "+13055550111", email: "rachel.glossandtips@example.com" },
      { name: "Nicole", phone: "+13055550112", email: "nicole.glossandtips@example.com" },
      { name: "Diana", phone: "+13055550113", email: "diana.glossandtips@example.com" },
      { name: "Faith", phone: "+13055550114", email: "faith.glossandtips@example.com" },
      { name: "Grace", phone: "+13055550115", email: "grace.glossandtips@example.com" },
      { name: "Hannah", phone: "+13055550116", email: "hannah.glossandtips@example.com" },
    ],
    services: [
      { name: "Classic manicure", description: "Shape, cuticle care and regular polish.", durationMin: 30, priceCents: 2500 },
      { name: "Gel manicure", description: "Manicure with gel polish that lasts two to three weeks.", durationMin: 45, priceCents: 4000 },
      { name: "Acrylic full set", description: "A full set of acrylic nail extensions.", durationMin: 75, priceCents: 6000 },
      { name: "Acrylic fill", description: "Fills in acrylic grown out from the cuticle.", durationMin: 60, priceCents: 4500 },
      { name: "Classic pedicure", description: "Soak, shape, cuticle care and regular polish for toes.", durationMin: 45, priceCents: 4000 },
      { name: "Gel pedicure", description: "Pedicure finished with long-lasting gel polish.", durationMin: 60, priceCents: 5500 },
      { name: "Nail art (per set)", description: "Hand-painted designs added to a set.", durationMin: 20, priceCents: 1500 },
      { name: "Gel removal", description: "Safe soak-off removal of gel polish.", durationMin: 15, priceCents: 1000 },
    ],
    openDays: [1, 2, 3, 4, 5, 6],
    hours: { start: "10:00", end: "19:00", breakStart: "14:00", breakEnd: "14:30" },
    preferences: [
      { shape: "almond", length: "medium", color: "nude pink" },
      { shape: "square", length: "short", color: "classic red" },
      { shape: "coffin", length: "long", art: "chrome tips" },
    ],
  },
  {
    slug: "flutter-lash-lounge",
    name: "Flutter Lash Lounge",
    businessType: "lash_studio",
    timezone: "America/New_York",
    owner: { name: "Lana", email: "lana.flutter@example.com", phone: "+14155550101" },
    pros: [
      {
        name: "Vera", title: "Lead lash artist", email: "vera.flutter@example.com", phone: "+14155550102", station: "1",
        payType: "chair_rent", payAmount: 110000, customPrices: { "Volume full set": 21000, "Volume fill": 9500 },
        bio: "Volume and mega-volume sets.",
      },
      { name: "Cleo", title: "Lash artist", email: "cleo.flutter@example.com", phone: "+14155550103", station: "2", payType: "commission", payAmount: 45, bio: "Natural classic and hybrid sets." },
      { name: "Lou", title: "Lash artist", email: "lou.flutter@example.com", phone: "+14155550104", station: "3", payType: "commission", payAmount: 40, bio: "Lash lifts, tints and brows." },
    ],
    clients: [
      { name: "Whitney", phone: "+14155550111", email: "whitney.flutter@example.com" },
      { name: "Bianca", phone: "+14155550112", email: "bianca.flutter@example.com" },
      { name: "Fiona", phone: "+14155550113", email: "fiona.flutter@example.com" },
      { name: "Monica", phone: "+14155550114", email: "monica.flutter@example.com" },
      { name: "Tessa", phone: "+14155550115", email: "tessa.flutter@example.com" },
      { name: "Lauren", phone: "+14155550116", email: "lauren.flutter@example.com" },
    ],
    services: [
      { name: "Classic full set", description: "One extension on each natural lash for a natural look.", durationMin: 120, priceCents: 12000 },
      { name: "Hybrid full set", description: "A mix of classic and volume lashes for texture.", durationMin: 135, priceCents: 15000 },
      { name: "Volume full set", description: "Several fine extensions on each lash for a full look.", durationMin: 150, priceCents: 18000 },
      { name: "Classic fill (2–3 weeks)", description: "Refills a classic set two to three weeks after it was applied.", durationMin: 60, priceCents: 6500 },
      { name: "Volume fill", description: "Refills a volume set.", durationMin: 75, priceCents: 8500 },
      { name: "Lash lift & tint", description: "Curls and darkens natural lashes, no extensions.", durationMin: 60, priceCents: 8500 },
      { name: "Brow tint", description: "Tints the brows to fill and define them.", durationMin: 15, priceCents: 2000 },
      { name: "Lash removal", description: "Safe removal of lash extensions.", durationMin: 20, priceCents: 2500 },
    ],
    openDays: [2, 3, 4, 5, 6],
    hours: { start: "10:00", end: "18:00", breakStart: "13:30", breakEnd: "14:00" },
    preferences: [
      { style: "cat eye", curl: "C", length: "10–13 mm" },
      { style: "doll eye", curl: "D", length: "9–12 mm" },
      { style: "natural", curl: "CC", note: "sensitive to adhesive, use the gentle glue" },
    ],
  },
];
