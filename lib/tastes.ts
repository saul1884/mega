export type Diet = "none" | "vegetarian" | "pescatarian" | "vegan";
export type WeeknightTime = "quick" | "medium" | "relaxed";
export type Adventure = "familiar" | "mix" | "surprise";

export type Tastes = {
  adults: number;
  kidAges: number[]; // one entry per child, 0 = under 1
  diet: Diet;
  dietExtras: string[]; // e.g. "No pork", "Gluten-free"
  never: string[]; // foods to avoid
  time: WeeknightTime;
  adventure?: Adventure;
  notes: string;
  skipped?: boolean; // they chose "not now"; ask again only from the Home link
};

export const DIET_OPTIONS: { value: Diet; label: string }[] = [
  { value: "none", label: "We eat everything" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "vegan", label: "Vegan" },
];
export const DIET_EXTRAS = ["No pork", "Halal", "Gluten-free", "Dairy-free", "Nut allergy", "Low carb"];
export const NEVER_OPTIONS = [
  "Mushrooms", "Olives", "Coriander", "Aubergine", "Blue cheese", "Goat's cheese",
  "Oily fish", "Prawns & shellfish", "Lamb", "Offal", "Tofu", "Beetroot", "Very spicy food",
];
export const TIME_OPTIONS: { value: WeeknightTime; label: string; hint: string }[] = [
  { value: "quick", label: "20 minutes, max", hint: "Weeknights are hectic" },
  { value: "medium", label: "30 to 40 minutes", hint: "A bit of time to cook" },
  { value: "relaxed", label: "Happy to cook", hint: "We enjoy spending time on it" },
];

export const ADVENTURE_OPTIONS: { value: Adventure; label: string; hint: string }[] = [
  { value: "familiar", label: "Keep it familiar", hint: "Classics you know and love, like lasagne, fajitas or a Sunday roast" },
  { value: "mix", label: "A good mix", hint: "Mostly favourites with something new now and then, like a Thai green curry or shakshuka" },
  { value: "surprise", label: "Surprise us", hint: "Dishes and cuisines you may not have tried, like Georgian khachapuri or Sichuan dan dan noodles" },
];

export const EMPTY_TASTES: Tastes = { adults: 2, kidAges: [], diet: "none", dietExtras: [], never: [], time: "medium", adventure: "mix", notes: "" };

export function hasTastes(t: Tastes | null | undefined): t is Tastes {
  return !!t && !t.skipped;
}

function ageText(a: number) {
  return a === 0 ? "a baby under 1" : `a ${a}-year-old`;
}

/** Plain-English summary of a household for the AI prompts. */
export function householdContext(t: Tastes | null | undefined): string {
  const base =
    "You suggest meals for a UK household. They shop at a UK supermarket, so use ingredients you can buy there and British names (courgette, coriander, aubergine, mince). List main ingredients only: no salt, pepper, oil or water. They want food that is fresh, varied and exciting, not the same few dishes every week.";
  if (!hasTastes(t)) {
    return `${base}\n\nThe household is two adults who are busy, so weekday meals should be easy.`;
  }
  const lines: string[] = [];
  const adults = t.adults === 1 ? "one adult" : `${t.adults} adults`;
  lines.push(
    t.kidAges.length
      ? `Who's eating: ${adults}, plus ${t.kidAges.length === 1 ? "one child" : `${t.kidAges.length} children`} (${t.kidAges.map(ageText).join(", ")}). Grown-up dinner ideas are for the adults; kids' categories are for the children.`
      : `Who's eating: ${adults}.`,
  );
  const diet = DIET_OPTIONS.find((d) => d.value === t.diet);
  if (t.diet !== "none" && diet) lines.push(`Diet: ${diet.label.toLowerCase()}. Every suggestion must fit this strictly.`);
  if (t.dietExtras.length) lines.push(`Also strictly: ${t.dietExtras.join(", ")}.`);
  if (t.never.length) lines.push(`Never suggest dishes that feature: ${t.never.join(", ")}. Leave them out of ingredient lists too.`);
  const time = TIME_OPTIONS.find((o) => o.value === t.time);
  if (time) {
    lines.push(
      t.time === "quick"
        ? "Weeknight time: 20 minutes of hands-on cooking at most. Slow cooker and bake-and-forget meals are fine if the prep is quick."
        : t.time === "medium"
          ? "Weeknight time: about 30 to 40 minutes of cooking."
          : "Weeknight time: they're happy to spend time cooking.",
    );
  }
  if (t.adventure === "familiar") lines.push("Adventure: keep it familiar. Well-known, crowd-pleasing dishes; avoid unusual cuisines or hard-to-find ingredients.");
  else if (t.adventure === "surprise") lines.push("Adventure: surprise them. Favour less common dishes and cuisines from around the world, still makeable from a UK supermarket.");
  else lines.push("Adventure: a good mix, mostly familiar with the odd new dish.");
  if (t.notes.trim()) lines.push(`In their own words: "${t.notes.trim()}"`);
  return `${base}\n\n${lines.join("\n")}`;
}
