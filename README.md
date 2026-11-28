# Knitting Counter

**Live app: https://audreyhou.github.io/KnittingCounter/**. Open it on your phone and choose “Add to Home Screen” (or “Install app” on desktop) to use it like an app, even offline.

A free, installable web app (PWA) for knitting and crochet that works on phones and desktops. It keeps your rows on track with multiple counters, row reminders and a project timer, and gives you a pattern viewer with highlighters, a row bar, chart tracking, notes, drawing and pinned bookmarks.

Everything is stored **in your browser** (IndexedDB). There is no account and no server. Use **Tools → Export backup** to move your data to another device.

## Features

**Projects & counters**
- As many counters per project as you need, each with a progress ring, target and color.
- **Linked counters** (🔗) move forward and back with the main row counter.
- **Repeat counters** go back to 1 after reaching their target and count completed repeats, for example a 4-row pattern repeat.
- **Reminders** pop up (with vibration) when you reach a row. **Comments** stay visible while you work the row. Both can repeat every N rows until a given row.
- A **project timer** that keeps running across reloads, plus a progress bar when the main counter has a target.
- **Voice control**: say “next”, “back”, “start” or “stop”. This works in browsers that support the Web Speech API.
- Keeps the screen awake while a project is open.

**Pattern library & viewer**
- Import **PDFs** or **images**. Photos picked together become one multi-page pattern. You can drag and drop files onto the library on desktop. An installed desktop app can also open PDFs directly.
- **Row bar**: a highlight bar that moves line by line and snaps to text lines in PDFs. It stays on its line as you scroll, and you can drag it (even onto another page) or tap a line to move it there. It can fade the rest of the page.
- **Highlighter**: drag over an area, or select text in a PDF, to highlight it in several colors.
- **Smart highlights**: pick your size (e.g. `M` from `XS (S) M (L) …`) and every `31 (31) 33 (33)…` number group is highlighted for that size. You can also highlight every occurrence of a word such as `MM1` or `ssk`.
- **Chart tracker**: drag a box around a chart. Rows are detected from the row numbers and columns from the chart symbols. Follow the chart row by row or stitch by stitch, with flat or in-the-round reading direction, faded or shaded rows, and fine-tuning of the grid edges. A chart can follow a project counter, so it repeats automatically.
- **Notes** pinned to the pattern, a **pen** and a freehand **marker**, all in different colors. Includes an eraser and undo (Ctrl+Z).
- **Bookmarks**: drag around sizes, abbreviations or any other section to pin it on screen while you scroll.
- Pinch or Ctrl+scroll to zoom. The viewer remembers where you were reading.
- Keyboard shortcuts: ↑/↓ move the row bar, ←/→ step the chart, +/- zoom.

On a desktop, the project page shows the counters and the pattern side by side. On a phone, a project with a pattern opens straight to the pattern, with a compact counter at the bottom and a **Counters** button to switch to the full counters. The bottom bar also lists the project's other counters and has a **+ Counter** button to add a new one without leaving the pattern. Each counter there has a clear button (↺) that sets it back to 0 after you confirm.

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev       # start the dev server
npm test          # unit tests (vitest)
npm run lint      # oxlint
npm run build     # type-check + production build with service worker (dist/)
npm run preview   # serve the production build
npm run icons     # regenerate PWA icons from public/logo.svg
```

The build copies pdf.js CMaps, standard fonts and wasm decoders into `public/pdfjs/` (git-ignored), and the service worker precaches them so patterns open offline.

The app uses hash routing and relative asset paths, so the contents of `dist/` can be hosted from any static host or sub-folder.

### Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages. You can also run it manually from the **Actions** tab. Installed copies of the app pick up the new version automatically the next time they are opened online.

### Project structure

| Path | Purpose |
| --- | --- |
| `src/db.ts` | IndexedDB stores: projects, patterns, pattern files and markup. Also backup export and import. |
| `src/lib/` | Pure logic: counters, reminders and timer (`counters.ts`), size and word matching (`sizes.ts`), chart geometry (`chart.ts`), importing (`importer.ts`). |
| `src/pages/` | Projects, project, library, pattern and tools pages. |
| `src/viewer/` | Pattern viewer: page rendering and text layer (`PageView.tsx`), tools and panels, markup persistence with undo. |
| `src/components/` | Counters, modals, icons, toasts. |
