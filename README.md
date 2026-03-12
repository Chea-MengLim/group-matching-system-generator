## Group Matching Generator

This project is a **web-based group / pair matching generator** built with **Next.js** and **React**.  
It helps you quickly create **fair, random pairs or matchups** for any event or activity (class groups, tournaments, team-building, etc.).

There is a short demo video in the `public` folder (`result.mp4`) that shows the matching flow and animations.

---

## Getting started

### 1. Requirements

- **Node.js** 18+ (recommended)  
- **npm** (comes with Node)

### 2. Install dependencies

In the project root:

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

By default, the app will be available at `http://localhost:3000`.

### 4. Build for production

```bash
npm run build
npm start
```

---

## How to use the Group Matching Generator

1. **Open the app** in your browser (`http://localhost:3000`).
2. **Add teams / participants**:
   - Use the **"Add a team"** input to add names one by one, or
   - Paste multiple names in the textarea (**one per line or comma-separated**) and click **"Add all"**.
3. Make sure you have **an even number of teams** (the UI will warn you if it’s odd).
4. Click **"Start drawing"** to go to the matching screen.
5. Use the **"Draw"** button to:
   - Select the first team (if none is selected yet).
   - Spin the reel and draw a random opponent from the remaining pool.
6. Each completed pair is added to the **Matches** list on the right.
7. When all pairs are drawn, the app will indicate that **all pairs are done**.
8. Use the **"Reset"** button to clear the current draw and go back to the input screen.

---

## Demo video

- The file `public/result.mp4` contains a **demo of the final interaction**, animations, and matching flow.
[Watch the demo video](./public/result.mp4)

---

## Tech stack

- **Framework**: Next.js (`next dev`, `next build`, `next start`)
- **UI**: React + Tailwind-style utility classes
- **Animation / Logic**:
  - Custom reel-style spinner for randomly selecting opponents
  - Web Audio API for simple sound effects on draw / reveal

---

## Scripts (from `package.json`)

- `npm run dev` – Run the development server.
- `npm run build` – Build the app for production.
- `npm start` – Start the production server (after `npm run build`).
- `npm run lint` – Run ESLint checks.

---

## Customization tips

- **Change the background image**: Edit the `backgroundImage` URL in `src/app/page.js`.
- **Change wording / labels**: Update the header and helper texts in `src/app/page.js` to match your specific event or use case.
- **Change styling**: Adjust classes or Tailwind utilities in the JSX to fit your brand or design system.

# Group Matching

A web app for drawing teams one by one to form match pairs—perfect for sports events, football group draws, or any activity where you need to randomly pair participants fairly.

![Group match draw](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js) ![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react) ![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwind-css)

---

## What it does

- **Add teams** — Enter names one at a time or paste a list (one per line or comma-separated).
- **Draw pairs** — Click "Draw" to pick the first team, then again to pick its opponent. A slot-machine style reel animates the selection with sound.
- **Match list** — All drawn pairs appear in a side panel. When only two teams remain, they’re shown in the main box and you can click **Match last 2 teams** to complete the draw.
- **Reset** — Start over anytime during the draw phase.

You need an **even number** of teams; the app will warn you until the list is even.

---

## Features

- **Slot-style draw** — Animated reel with easing slowdown and a clear selection line.
- **Sound feedback** — Web Audio API sounds for spin, pick, reveal, and tick (no external audio files).
- **Responsive layout** — Works on desktop and mobile; match list stacks or sits beside the draw area.
- **Simple UX** — Single page, no login; add teams → start drawing → see matches.
- **Ordinal display** — Fixes common typos like "1th" → "1st", "2th" → "2nd", "3th" → "3rd" in team names.

---

## Tech stack

| Layer      | Technology        |
| ---------- | ------------------ |
| Framework  | Next.js 16 (App Router) |
| UI         | React 19           |
| Styling    | Tailwind CSS 4     |
| Fonts      | Geist Sans / Geist Mono (Google Fonts) |
| Audio      | Web Audio API (no external files) |

---

## Getting started

### Prerequisites

- **Node.js** 18.x or later (recommended: 20.x LTS)
- **npm** (or yarn / pnpm)

### Install and run

```bash
# Clone the repository (or navigate to the project folder)
cd reunion-group-matching

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other scripts

| Command        | Description                |
| -------------- | -------------------------- |
| `npm run dev`  | Start dev server (hot reload) |
| `npm run build`| Production build           |
| `npm run start`| Run production server      |
| `npm run lint` | Run ESLint                 |

---

## Project structure

```
reunion-group-matching/
├── src/
│   └── app/
│       ├── layout.js      # Root layout, fonts, metadata
│       ├── page.js        # Main UI and draw logic
│       └── globals.css    # Global styles, Tailwind, animations
├── package.json
└── README.md
```

- **`page.js`** — Single-page flow: team input, draw phase (reel animation, pair display, match list), and reset. Contains all state and Web Audio logic.
- **`globals.css`** — Tailwind setup, CSS variables, and keyframe animations (e.g. draw-in, rolling).

---

## How the draw works

1. Teams are shuffled when you click **Start drawing**.
2. For each pair, the app first selects **Team 1** (with animation and sound), then **Team 2** (opponent) the same way.
3. The reel uses a fixed item height and visible row count; the selected name is the one aligned with the center line when the animation stops.
4. When only two teams are left, both are shown in the main box and **Match last 2 teams** completes the final pair.

---

## License

Private project. Use and modify as needed for your event or organization.
