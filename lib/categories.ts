export type Category = {
  name: string;
  description: string;
  /** Meals for children: split into Lunch and Dinner, kept out of the grown-ups' "All" list. */
  kids?: boolean;
};

export const DEFAULT_CATEGORIES: Category[] = [
  { name: "Slow cooker", description: "Prep in the morning, ready by dinner. Stews, curries and pulled meats that cook low and slow." },
  { name: "BBQ", description: "Food for the barbecue or a hot grill: burgers, kebabs, marinated meats, sides and salads." },
  { name: "Healthy AF", description: "Lighter, veg-packed meals that still taste great. Good protein, not much stodge." },
  { name: "Vegetarian", description: "No meat or fish. Proper filling dinners where the veg, beans and cheese are the stars." },
  { name: "Kids", description: "Simple, mild meals for the children, split into lunches and dinners.", kids: true },
];

// Descriptions for the categories households had before descriptions existed.
const LEGACY: Record<string, Omit<Category, "name">> = {
  "slow cooker specials": { description: "Prep ahead, cook low and slow, ready when you are." },
  "one pan weekday": { description: "Quick weeknight dinners made in one pan or tray, with little washing up." },
  "healthy af": { description: "Lighter, veg-packed meals that still taste great." },
  "a little bit fancy": { description: "For when there's a bit more time: more effort than a stir fry, worth it." },
  "weekend specials": { description: "Treats and bigger cooks for a relaxed weekend." },
  bbq: { description: "Food for the barbecue or a hot grill." },
  "solo night in": { description: "Dinner for one, quick and a little bit indulgent." },
  "obie meals": { description: "Meals for Obie, our 4-year-old, split into lunches and dinners.", kids: true },
};

export function catKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Accepts the stored jsonb (old households stored plain names) and returns full categories. */
export function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  const out: Category[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const legacy = LEGACY[catKey(item)];
      out.push({ name: item, description: legacy?.description ?? "", ...(legacy?.kids ? { kids: true } : {}) });
    } else if (item && typeof item === "object" && typeof (item as Category).name === "string") {
      const c = item as Category;
      out.push({ name: c.name, description: c.description ?? "", ...(c.kids ? { kids: true } : {}) });
    }
  }
  return out;
}

/** One line per category, for the AI prompts. */
export function describeCategories(cats: Category[]): string {
  return cats.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`).join("\n");
}
