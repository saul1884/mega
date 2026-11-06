export type Meal = {
  id: string;
  name: string;
  tags: string[];
  ingredients: string[];
  stars: number;
  tried: boolean;
  lastMade: string | null; // YYYY-MM-DD
  obie: "Lunch" | "Dinner" | null;
  photoUrl: string | null;
};

export type PlanItem = { mealId: string; day: number | null; made: boolean };

export type Extra = { id: number; name: string };

export type AppState = {
  household: string;
  categories: string[];
  meals: Meal[];
  startDate: string | null; // YYYY-MM-DD
  plan: PlanItem[];
  have: string[]; // name keys ticked as "already got"
  extras: Extra[];
};

export type Idea = {
  name: string;
  blurb: string;
  ingredients: string[];
  tags: string[];
  obie?: "Lunch" | "Dinner" | null;
};

export type PhotoResult = {
  isRecipe: boolean;
  name: string;
  ingredients: string[];
  tags: string[];
  photoUrl: string | null;
};
