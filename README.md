# PA Stack

A full-screen generative animation built with [Paper.js](http://paperjs.org/),
[anime.js](https://animejs.com/) and [Vite](https://vitejs.dev/).

A vertical stack of 1–3 parallelograms fills the screen. In timed rounds the
stack redistributes its height, each parallelogram changes width and slant,
and parallelograms enter (growing up from the bottom) or exit (shrinking
down). A parallelogram stays on for at least three rounds before it may exit.
Each parallelogram's long diagonal always touches both sides of the canvas,
and adjacent parallelograms always share part of their horizontal edge, so
the stack reads as one folded black ribbon.

Design spec: `docs/superpowers/specs/2026-06-10-pa-stack-animation-design.md`

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — dev server with hot reload
- `npm run build` — production build into `dist/`
- `npm run preview` — preview the production build
- `node --test "tests/*.test.js"` — run unit tests for the pure modules

## GitHub Pages

Pushes to `main` deploy automatically via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. Push this repo to GitHub (the repository name becomes the URL path, e.g. `https://<user>.github.io/tsu/`).
2. In the repo **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually under **Actions**).

To preview the production build locally with the same base path GitHub Pages uses:

```bash
BASE_PATH=/tsu/ npm run build
BASE_PATH=/tsu/ npm run preview
```

Replace `tsu` with your repository name if it differs.

## Structure

- `src/config.js` — all tunables (counts, durations, size constraints, colors)
- `src/rounds.js` — pure round generator; all geometry constraints enforced here
- `src/geometry.js` — pure projection from fractional state to pixel corners
- `src/main.js` — Paper.js rendering + anime.js tween driving
- `tests/` — `node:test` unit tests for `rounds.js` and `geometry.js`
