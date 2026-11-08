import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql; schemaReady?: Promise<void> };

function url(): string {
  const u = process.env.DATABASE_URL || process.env.DATABASE_POSTGRES_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
  if (!u) throw new Error("DATABASE_URL is not set");
  return u;
}

export function sql(): postgres.Sql {
  if (!globalForDb.sql) {
    const u = url();
    const local = /localhost|127\.0\.0\.1|\/var\/run/.test(u);
    globalForDb.sql = postgres(u, {
      ssl: local ? false : "require",
      max: 3,
      idle_timeout: 20,
      prepare: false,
    });
  }
  return globalForDb.sql;
}


export function ensureSchema(): Promise<void> {
  if (!globalForDb.schemaReady) {
    const db = sql();
    globalForDb.schemaReady = (async () => {
      await db`
        create table if not exists households (
          id serial primary key,
          name text not null,
          name_key text not null unique,
          password_hash text not null,
          categories jsonb not null,
          start_date date,
          created_at timestamptz not null default now()
        )`;
      await db`alter table households add column if not exists tastes jsonb`;
      await db`
        create table if not exists meals (
          id uuid primary key default gen_random_uuid(),
          household_id int not null references households(id) on delete cascade,
          name text not null,
          tags jsonb not null default '[]',
          ingredients jsonb not null default '[]',
          stars int not null default 0,
          tried boolean not null default false,
          last_made date,
          obie text,
          photo_url text,
          created_at timestamptz not null default now()
        )`;
      await db`create index if not exists meals_household on meals(household_id)`;
      await db`alter table meals add column if not exists recipe jsonb`;
      await db`
        create table if not exists idea_recipes (
          household_id int not null references households(id) on delete cascade,
          name_key text not null,
          recipe jsonb not null,
          created_at timestamptz not null default now(),
          primary key (household_id, name_key)
        )`;
      await db`
        create table if not exists dismissed (
          household_id int not null references households(id) on delete cascade,
          name_key text not null,
          primary key (household_id, name_key)
        )`;
      await db`
        create table if not exists plan_items (
          household_id int not null references households(id) on delete cascade,
          meal_id uuid not null references meals(id) on delete cascade,
          day int,
          made boolean not null default false,
          added_at timestamptz not null default now(),
          primary key (household_id, meal_id)
        )`;
      await db`
        create table if not exists shop_checks (
          household_id int not null references households(id) on delete cascade,
          name_key text not null,
          primary key (household_id, name_key)
        )`;
      await db`
        create table if not exists shop_extras (
          id serial primary key,
          household_id int not null references households(id) on delete cascade,
          name text not null,
          created_at timestamptz not null default now()
        )`;
      await db`
        create table if not exists idea_cache (
          household_id int not null references households(id) on delete cascade,
          category text not null,
          ideas jsonb not null default '[]',
          seen jsonb not null default '[]',
          updated_at timestamptz not null default now(),
          primary key (household_id, category)
        )`;
    })().catch((e) => {
      globalForDb.schemaReady = undefined;
      throw e;
    });
  }
  return globalForDb.schemaReady;
}

export function nameKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
