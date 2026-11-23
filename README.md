# a little coffee timer

A cozy focus timer. A 3D coffee mug made entirely of ASCII characters spins slowly on a saucer, with steam drifting up. The coffee drains as the timer runs. A "today's list" to-do card sits beside or below it.

- **GitHub Pages:** https://ribbit56.github.io/coffee-timer/ (public, served straight from `main` / repo root)
- **claude.ai artifact:** https://claude.ai/artifact/BcBPnQ7xmwjFXdRjqfNBmp (private to Ben). Slug `55e4d2c6-ac4c-473c-9be4-e2778a3e2bb7`
- **Source:** everything is in `index.html`. There is no build step and no dependencies at runtime.

The same `index.html` runs in both places. The only difference is where the to-do list is saved:

| Where | To-do list saved in | Syncs across devices? |
|---|---|---|
| GitHub Pages | This browser's localStorage | No |
| claude.ai artifact | Ben's private artifact database (localStorage as cache) | Yes |
| Opening the file locally | This browser's localStorage | No |

The lists in the two places are separate, and nothing copies tasks between them.

---

## Features

### Timer
- Presets of 5, 15, 25 and 50 minutes. The − and + buttons change the time by 1 minute (range 1–120). The last duration is remembered.
- Start / Pause / Resume / Again, and **Refill**, which resets the timer and animates the mug back to full.
- The coffee level goes linearly from full to empty over the session. When the timer ends, the steam stops, a soft three-note chime plays (WebAudio, can be turned off), and the status line changes.
- The browser tab title shows the countdown while it runs.
- The spacebar starts and pauses it, except while typing in an input.
- It asks for a screen wake lock while running. The sandbox may refuse this; the page carries on either way.
- The status line cycles through gentle phrases every ~75 s while running.

### Mug
- You can drag the mug to spin it. It keeps that momentum for a moment, then eases back to the idle spin speed of 0.42 rad/s.
- It is drawn at 30 fps into a `<pre>` with one colored `<span>` per run of characters that share a color.
- A steel spoon rests on the saucer directly opposite the handle. Whenever the mug hides one, the other is in view, so you can always tell which way it faces, even once the coffee and its swirl are gone.

### Light mode
- The "lights: low / lights: up" button switches between the dark espresso theme (default) and a light latte theme. The choice is saved in `ct-theme` and applied by a tiny `<head>` script before first paint, so there is no flash.
- Both themes use the same warm browns. Light mode swaps the roles (dark ink on a pale page), uses bold glyphs for the art, and draws the spoon in a cool slate so it stands out from the saucer.

### To-do list ("today's list")
- Add a task (max 200 chars), check it off with `[ ]`/`[x]`, delete it with ×, and remove finished tasks with "clear done".
- Open tasks are listed first and finished ones last. Within each group, tasks keep the order they were added.
- **Brewing:** tapping a task's text makes it the current focus. It is highlighted, gets a "brewing" tag, and shows under the timer as "brewing: …". Only one task brews at a time. Checking that task off un-brews it.
- **Cups:** each time a timer finishes while a task is brewing, that task gets +1 cup, shown as `c[_]×N`.
- A "today's list (N) ↓" link under the timer scrolls to the list on mobile.

---

## Architecture

`index.html` has three `<script>` blocks, in this order:

| Block | Global | What it does |
|---|---|---|
| `<script id="engine">` | functions + constants | Pure 3D/ASCII renderer. It has no DOM access, so Node can load it (`module.exports` is guarded at the bottom). |
| 2nd script | `Todos` (IIFE) | To-do state, rendering, and saving. Exposes only `{ addCup }`. |
| 3rd script | (IIFE) | Timer state, UI wiring, drag-to-spin, font sizing, and the animation loop. Calls `Todos.addCup()` when the timer finishes. |

### Renderer (`engine`)
- **Grid:** `W = 66` columns × `H = 44` rows. Each cell has a character code, a color class index and a depth value (z-buffer). These are stored in typed arrays made by `makeFrame()`.
- **Geometry** (`buildGeo()`, built once): about 63k sample points, 8 floats each: `x, y, z, nx, ny, nz, kind, extra`. The `kind`s are:
  - `MUG`: the outside wall, radius 1, y from −1 to 1.
  - `IN`: the inside wall, radius 0.86. `extra` is a parameter from 0 to 1, and y is worked out each frame from the coffee level.
  - `RIM`: the ring at y = 1.
  - `COF`: the coffee surface disc at y = coffee level. `extra` is the radius, plus 10 if that point is foam (the 3-arm latte spiral, `sin(3θ + 9.5r) > 0.45`).
  - `SAU`: the saucer, a shallow dish with a raised edge, radius about 0.92–1.52, plus its outer edge band.
  - `HAN`: the handle, part of a torus (center x = 0.98, major radius 0.46, minor radius 0.125, u from −1.8 to 1.8).
  - `SPN`: the spoon, a flat oval bowl (slightly dished) plus a handle that widens to a round tip. It lies along a line tangent to the mug at radius 1.23, at angle π (opposite the handle), lifted 0.05 above the saucer surface.
- **Camera:** spins around Y by the angle `A`, then tilts around X by `TILT = 0.8` so you see into the cup. Perspective uses `ooz = 1/(z + DIST)` with `DIST = 6`. Screen position is `col = COLC + KX·x·ooz` and `row = ROWC − KY·y·ooz`, with `KX = 92` and `KY = 50`; `KX/KY` makes up for characters being taller than they are wide. Surfaces facing away (`nz > 0.04`) are skipped, and the z-buffer handles the rest.
- **Shading:** Lambert lighting, with the light direction `(-0.62, 0.5, -0.6)` normalized and given in camera space. The brightness is mapped onto the ramp `.,-~:;=!*#$@`. With `renderMug(..., inv = true)` (light mode) the ramp is reversed and squeezed into `;`…`@`, because dense glyphs look dark on a pale page; the spoon is kept at the dense end. Each kind adds its own ambient light and scaling. The coffee gets a gentle ripple, `0.07·sin(16r − 1.6t)`.
- **Coffee level:** runs from `FULL = 0.72` to `EMPTY = −0.9`. The main loop eases the shown level toward its target, faster when draining than when refilling.
- **Steam:** particles kept in grid coordinates. They are spawned above the rim (`ROWC − 12`) at a rate set by `heat`, which is 1 unless the timer has finished. Each one sways sideways along a sine wave, and its character (`( ) ~ ' \``) depends on the direction of the sway and its age. Particles are only drawn into empty cells, with 3 fading color classes (`t1/t2/t3`).
- **Color classes:** `CLS = ["", "m", "md", "c", "f", "s", "t1", "t2", "t3", "sp"]`, which is empty, mug, mug dim (inside), coffee, foam, saucer, steam ×3, and spoon.

### Sizing
`fit()` measures the actual width of a monospace character, then sets the `<pre>`'s font size so the whole grid fits both the stage width and `innerHeight − 360`. It runs on resize and again once the fonts have loaded.

### Layout
- **Mobile:** `.timer-col` is a full screen tall, and the to-do card sits below it.
- **≥ 940px:** the two columns sit side by side (`.layout` flex row).
- **Fonts:** Fraunces (serif UI) and JetBrains Mono (the art, checkboxes, cups), both from Google Fonts.
- **Palette:** CSS variables in `:root` (dark) and `:root[data-theme="light"]`. Translucent tints use rgb triples, `--ink` and `--acc`, as `rgba(var(--ink), .16)`, so each theme only redefines variables.

---

## Data and persistence

### localStorage (per browser, conveniences only)
| Key | Value |
|---|---|
| `ct-min` | Last chosen duration in minutes |
| `ct-chime` | `"1"` / `"0"` |
| `ct-theme` | `"dark"` / `"light"` |
| `ct-todos-v1` | Local cache or fallback copy of the to-do doc (same shape as below) |

All access is wrapped in try/catch, because storage can be missing or throw in the sandbox.

### Artifact database (the real home of the to-do list)
The artifact declares the capabilities `{ db: {}, user: {} }` (runtime contract 0.2.98).

- **Document:** `data/users/<uid>/todos`, where `<uid>` is the awaited value of `(await claude.use("user")).id()`. The platform keeps everything under `data/users/<id>/` private to that viewer, so not even the owner can read anyone else's.
- **Shape:**
  ```json
  {
    "items": [{ "id": "mwsf32tife990", "text": "Write Q4 summary", "done": false, "cups": 2, "at": 1795387035654 }],
    "focusId": "mwsf32tife990",
    "updated": 1795387036114
  }
  ```
- **Writes:** the whole doc is written with `ref.set()`. Changes are debounced by 450 ms and only one write runs at a time. A failed write is retried on `unavailable` or `resource_exhausted`. Any other error drops to local-only saving and shows a note.
- **Reads:** one `onSnapshot` subscription is opened on load. A snapshot is ignored while this page has writes that haven't finished or been confirmed. A 10 s timer shows a "can't reach your saved list yet" note if nothing confirmed has arrived.
- **Migration:** if the doc doesn't exist yet and the local cache has items, they are written up once.
- **Validation:** `clean()` checks everything that comes in. Text is capped at 200 chars and there are at most 300 items.
- **Fallback:** if `window.claude` is missing, the list works from localStorage alone and shows "your list is saved in this browser". **This is always the case on GitHub Pages and when you open the file locally**, which is expected. If `db`/`id` comes back null, or the subscription errors inside claude.ai, the page shows "saving on this device only" instead.

---

## Hosting constraints (claude.ai artifact sandbox)

These matter for any change:

- It must stay **one self-contained HTML file** starting with `<!DOCTYPE html>`.
- **Scripts** can come from inline code or `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `unpkg.com`. **Stylesheets** can be inline or from `fonts.googleapis.com`. **Fonts** come via `fonts.gstatic.com`.
- **Images** must be `data:`/`blob:` URIs. Remote images and `fetch` to other hosts are blocked.
- **Blocked or ignored:** `alert`/`confirm`/`prompt`, `window.print`, downloads, clipboard reads, camera/mic/location, service workers, iframes of other sites. Build any dialogs into the page itself.
- **Need a user click:** audio playback, fullscreen, and `navigator.clipboard.writeText`. Catch refusals.
- **URL hash:** only a plain `#name` passes through, never `#/path` or `?query`. Don't use the names `settings`, `sidebar`, `customize`, `upgrade`, `downloads` or `comment-*`.
- **`window.claude` capabilities:** these resolve asynchronously. Always branch on `null` and keep the page working without them.

---

## Testing

There's no test framework, just two small Node scripts in `tools/`:

```bash
npm install            # just jsdom, for the smoke test
npm run ascii          # prints 3 frames of the mug as plain text (full / half / empty, different angles)
npm run smoke          # loads index.html in jsdom with a fake window.claude db; adds/focuses/checks tasks, toggles the theme; prints the result
```

To check things by eye, open `index.html` in a browser. The to-do list will be in local-only mode there, as described above.

---

## Deploying

### GitHub Pages
Push to `main`. Pages serves `index.html` from the repo root (Settings → Pages → "Deploy from a branch", `main`, `/ (root)`), and the site updates a minute or so later. `.nojekyll` tells Pages to serve the files as they are.

### claude.ai artifact (optional, keeps the synced list)
Use one of these:

1. **From Claude Code with the claude-artifacts MCP tools:** republish `index.html` to slug `55e4d2c6-ac4c-473c-9be4-e2778a3e2bb7`. Read the artifact's current version first and pass it as `base_version`. The declared capabilities (`db`, `user`) carry over automatically.
2. **From a claude.ai chat:** attach `index.html` and ask Claude to republish it to the "Coffee Timer" artifact.

Adding a new capability (such as `downloads`) means declaring it **before** publishing the code that uses it. Removing one means publishing first, then declaring.

---

## Ideas (not decided, just possibilities)

- Editing a task's text in place, and drag-to-reorder
- A break mode (5-minute "refill" breaks, with a pot or teapot shown during breaks)
- A daily summary: cups finished today, a streak
- Different drinks or themes (tea with a bag string, iced coffee, matcha)
- An optional ambient sound (rain, café murmur) made with WebAudio
- `prefers-reduced-motion` support (slower spin, less steam)
- Pausing the render loop when the tab is hidden, to save battery
