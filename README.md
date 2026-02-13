# Expense Tracker (INR)

A fast daily-use expense tracker built with HTML, CSS, and JavaScript.

## Stack

- Vite
- Vanilla JavaScript (ES Modules)
- Supabase (Auth + Postgres)
- ESLint
- Prettier

## Features

- Quick add (Expense/Income toggle + one-tap amount chips)
- Add, edit, delete transactions
- Filter and search transactions
- Monthly overview and budget tracking
- India locale defaults (`en-IN`, `INR`, `Asia/Kolkata`)
- Local mode with browser `localStorage`
- Cloud mode with Supabase login/signup/logout and per-user data isolation
- Auth session sync across refresh/tabs
- GitHub Pages ready build output in `docs/`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Then fill values in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. In Supabase SQL Editor, run:

- `supabase/schema.sql`

4. In Supabase Auth settings:

- Enable Email auth provider.
- If you want instant signup login in development, disable email confirmation.
- Add your production app URL in Auth URL configuration before deploying.

## Run locally

```bash
npm run dev
```

Then open the local URL printed by Vite.

## Quality checks

```bash
npm run lint
npm run build
npm run check-format
```

## Production Checklist

1. Run `supabase/schema.sql` in your Supabase project.
2. Build the GitHub Pages version:
   ```bash
   npm run build:pages
   ```
3. Push to `main`.
4. In GitHub repo settings:
   - `Settings -> Pages -> Build and deployment`
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
5. Configure Supabase auth URL settings with your deployed URL:
   - `https://ashbin124.github.io/expence/`

## Live URL

After GitHub Pages deploy succeeds, your app will be available at:

`https://ashbin124.github.io/expence/`

## Project structure

```text
.
├─ index.html
├─ src/
│  ├─ main.js      # app orchestration and event handlers
│  ├─ ui.js        # renderers for summary/list/monthly UI
│  ├─ budget.js    # budget and timezone/date utilities
│  ├─ storage.js   # localStorage helpers
│  ├─ supabase.js  # Supabase client bootstrap
│  ├─ cloud.js     # cloud auth + CRUD operations
│  └─ styles.css
├─ supabase/
│  └─ schema.sql   # tables and RLS policies
├─ docs/           # production build served by GitHub Pages
├─ .env.example
├─ eslint.config.js
├─ .prettierrc
└─ vite.config.js
```

## Data isolation (shared app URL)

All users can use the same deployed app URL. Data is isolated by `user_id` and Row Level Security policies, so each authenticated user sees only their own transactions and budget.
