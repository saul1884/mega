# M.E.G.A — Make Eating Great Again

Meal planning for the household: our favourite meals, AI ideas by category or mood,
this week's basket and days, and a shared shopping list. Works as an iPhone home-screen
app and in any desktop browser.

## Deploy on Vercel

1. **Import** this repo at vercel.com/new (framework: Next.js, no settings to change).
2. **Storage** tab on the project:
   - Add a **Neon Postgres** database and connect it. This sets `DATABASE_URL`.
   - Add a **Blob** store and connect it. This sets `BLOB_READ_WRITE_TOKEN` (used for meal photos).
3. **Settings → Environment Variables**, add:
   - `SESSION_SECRET`: any long random string (e.g. run `openssl rand -base64 32`).
   - `ANTHROPIC_API_KEY`: from console.anthropic.com → API keys.
4. **Redeploy** so the new variables are picked up. Tables are created automatically on first use.
5. On each iPhone, open the site in Safari → Share → **Add to Home Screen**.
6. Set up the household on the login screen ("Set one up"), then both log in with the same name and password.

## AI

Ideas, "in the mood for" and recipe-photo reading use Claude (`claude-opus-5-5`) via the
Anthropic API, with server-side fallback enabled so a request that the main model declines can be
retried on a fallback model. Idea lists are cached per category, so you only pay when you ask for
new ones.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

Needs a Postgres database (`DATABASE_URL`). Without `BLOB_READ_WRITE_TOKEN` photos are read but not stored.
