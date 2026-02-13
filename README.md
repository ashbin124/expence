# Expense Tracker (INR)

[![CI](https://github.com/ashbin124/expence/actions/workflows/ci.yml/badge.svg)](https://github.com/ashbin124/expence/actions/workflows/ci.yml)

A fast daily-use expense tracker built with HTML, CSS, and JavaScript.

## Stack

- Vite
- Vanilla JavaScript (ES Modules)
- LocalStorage (browser)
- ESLint
- Prettier

## Features

- Quick add (Expense/Income toggle + one-tap amount chips)
- Add, edit, delete transactions
- Filter and search transactions
- Monthly overview and budget tracking
- India locale defaults (`en-IN`, `INR`, `Asia/Kolkata`)
- Local-only storage in browser `localStorage`
- Backup and restore with JSON export/import
- GitHub Pages ready build output in `docs/`

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open the local URL printed by Vite.

## Quality checks

```bash
npm run lint
npm run test
npm run build
npm run check-format
```

## CI

GitHub Actions runs `npm run ci` on pushes to `main` and pull requests.

## Production checklist

1. Build the GitHub Pages version:

```bash
npm run build:pages
```

2. Push to `main`.
3. In GitHub repo settings:

- `Settings -> Pages -> Build and deployment`
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

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
│  └─ styles.css
├─ docs/           # production build served by GitHub Pages
├─ eslint.config.js
├─ .prettierrc
└─ vite.config.js
```
