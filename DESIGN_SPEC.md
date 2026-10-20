# Pocket Table Tennis — Courtlight Broadcast

## 1. Direction

**Courtlight Broadcast** is a friendly geometric game interface inside a precise television-broadcast frame. The court is the hero. Typography is warm and rounded rather than technical. Player and opponent are always readable as cyan and rose. The interface should feel like a small, beautifully produced studio match — not a generic arcade panel.

This is a **visual overhaul**:
- Start screen, broadcast strip, Settings, controls, buttons, court, paddles, ball, and background are redesigned.
- Physics, scoring, serve rules, online play, 60 Hz networking, and game logic stay intact.
- All UI icons remain Iconoir at `1.8` stroke width.
- The same studio set is used in dark and light modes; only lighting and surrounding surfaces change.

### Design Read

| Dial | Value | Why |
|---|---:|---|
| Artifact | Mobile-first game UI + court concept | Portrait phone is primary; tablet/desktop stays centered |
| Audience | Casual players, quick solo or private online matches | One-thumb use, fast entry, clear scoring |
| Visual language | Friendly geometric broadcast | Rounded type, disciplined grid, studio court |
| Mode | Overhaul · preserve mechanics | No gameplay or networking changes |
| Visual variance | 6/10 | Characterful but not chaotic |
| Motion intensity | 3/10 | Restrained fades, sweeps, and sheet transitions |
| Information density | 6/10 | Full broadcast telemetry, adapted on narrow phones |
| Asset dependence | 5/10 | Canvas-drawn court art; one new brand mark |
| Brand fidelity | 7/10 | Keep the name; refine the mark and wordmark |

## 2. Brand

- **Name:** Pocket Table Tennis
- **Tagline:** Fast hands. Small table.
- **Mark:** Refined paddle-and-ball monogram inside a soft-cornered court tile. The paddle handle forms the stem of a geometric **P**; the ball becomes the counter. Must read at 24 px and work in one color.
- **Wordmark:** Title case, geometric, confident. `Pocket` can carry more weight than `Table Tennis`.
- **Remove:** WTT references from the start screen, HUD, court apron, metadata, and share copy.
- **Tone:** Inviting competition. Short, human labels. No hype copy.

The current `icon-192.png` is the reference asset, not the final mark. The replacement will be a vector asset under `assets/brand/`.

## 3. Design Tokens

### Color

Both themes share the same table blue and team colors. Theme changes lighting, surfaces, and text contrast — not the identity of the table.

| Role | Dark · Arena | Light · Daylight |
|---|---|---|
| Page base | `#050912` | `#F2F6FC` |
| Raised background | `#0A1220` | `#FFFFFF` |
| Surface | `#0E182A` | `#FFFFFF` |
| Surface raised | `#131F35` | `#EAF0F9` |
| Hairline | `rgba(170,196,235,.14)` | `#D9E4F2` |
| Hairline strong | `rgba(170,196,235,.24)` | `#BDCDE3` |
| Text strong | `#F5F8FF` | `#0A172B` |
| Text | `#D7E2F5` | `#243A58` |
| Muted | `#92A6C6` | `#5C708E` |
| Faint | `#647A9C` | `#7E90A9` |
| Player cyan | `#2DD4E8` | `#078AA5` |
| Player soft | `#A5F3FC` | `#CFFAFE` |
| Opponent rose | `#FB7185` | `#D92D55` |
| Opponent soft | `#FECDD3` | `#FFE4E8` |
| Serve amber | `#F4C15D` | `#A16207` |
| Online emerald | `#34D399` | `#047857` |
| Table blue | `#1D5FD6` | `#1F63D6` |
| Table line | `#F8FBFF` | `#FFFFFF` |
| Studio floor | `#07101D` | `#DCE6F4` |
| Primary action | `#F4F8FF` | `#0B1B34` |
| Primary ink | `#071120` | `#FFFFFF` |

Rules:
- Cyan is the player. Rose is the opponent. Amber is serve. Emerald is online. Do not reuse these for decoration.
- Primary buttons use the high-contrast neutral action color, not a team color.
- No purple-pink gradients, no rainbow glow, no color-only state.
- Glass is allowed for the floating HUD rail, but most surfaces are solid or lightly translucent.

### Typography

- **Display and numerals:** Outfit, weights 500–800.
- **UI and body:** Manrope, weights 400–700.
- Two families maximum. Self-host WOFF2 for production; use `font-display: swap`.
- Fallbacks: `ui-rounded, "Avenir Next", "Segoe UI", sans-serif`.
- Scores use `font-variant-numeric: tabular-nums`.
- Display tracking: `-0.02em`. Label tracking: `0.12em`, uppercase.
- CTA labels: uppercase, `0.08em`, 12 px, weight 700.
- Body copy: 14–15 px, line-height 1.5. No text below 10 px except the legal disclaimer.

| Token | Size | Use |
|---|---|---|
| `display` | `clamp(2rem, 9vw, 2.75rem)` | Brand and hero moments |
| `h1` | `1.75rem` | Settings/page title |
| `h2` | `1.25rem` | Sheet section titles |
| `h3` | `1rem` | Card titles |
| `body` | `0.9375rem` | Descriptions, body |
| `small` | `0.8125rem` | Supporting copy |
| `label` | `0.6875rem` | Uppercase labels |
| `score` | `clamp(2.25rem, 10vw, 2.75rem)` | Match scores |

### Spacing and shape

- 4 px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Phone inset: 20 px. Compact phone (≤360): 16 px.
- Card padding: 16 px. Sheet padding: 20 px.
- Radii: `8` small, `12` chip, `16` button/input, `20` card, `28` bottom sheet, `999` pill.
- Primary button height: 52 px. Secondary: 48 px. Icon control: 44 px.
- Borders are 1 px hairlines; avoid thick outlines and stacked card borders.
- Shadow hierarchy:
  1. Hairline + soft ambient shadow.
  2. Floating HUD rail and bottom sheet.
  3. Dialog/settings surface.

### Motion

- Easing: `cubic-bezier(.22,1,.36,1)`.
- Press: 120 ms. Standard UI: 180 ms. Sheet: 320 ms. Score sweep: 280 ms.
- Start screen: one staged entrance — brand, court light, then sheet. No looping parallax.
- Theme switch: 220 ms crossfade of surfaces and lighting; no white flash.
- Score change: subtle underline sweep and a restrained 1.04 pulse. No bounce.
- Respect `prefers-reduced-motion` and the existing Reduced Motion setting; remove transforms and non-essential loops.

## 4. Surfaces

### Start screen

- Full-bleed studio court as the hero; table positioned in the upper-middle of the screen.
- Top bar: new Pocket mark and wordmark on the left; sound, theme, and fullscreen icon controls on the right. All 44 px.
- Bottom sheet: soft-rounded top corners, solid/translucent studio surface, with a clear hierarchy:
  1. **Play Solo** — dominant primary action, with a Relaxed / Casual / Pro segmented control.
  2. **Play Online** — secondary row with room code / join action.
  3. **Practice**, **How to Play**, **Settings** — three tertiary icon-plus-label controls.
  4. Small legal line: `Unofficial fan project. Not affiliated with World Table Tennis.`
- The court must remain visible above the sheet on 390×844 and still show a recognizable table on 320×568. The sheet may scroll internally on short screens; the primary action must remain first.
- Dark mode: arena lighting, cyan/rose rim light, deep navy floor.
- Light mode: same set with bright neutral studio light, soft shadows, and a white sheet. Table stays blue.

### Broadcast strip

A single fixed-height rail, not a row of cards.

- **Main line:** player name and score on the left, set pips and serve state in the center, opponent name and score on the right.
- **Telemetry line:** shots, speed, and online status/ping in a quieter second line inside the same rail.
- Player side uses a cyan dot and small accent rule; opponent uses rose. Scores are the largest elements.
- Serve state uses an amber ball icon and text; no bulky serve badge.
- Online state uses an emerald dot. Offline hides it without shifting layout.
- Sound and pause live in a separate floating 44 px control rail at the top-right of the court, not inside the score data.
- At ≤360 px: score, serve, and sets remain visible; telemetry condenses into compact icon/value chips. The strip reserves its height so the court never moves.
- Score updates animate inside fixed slots. No layout reflow.

### Settings

A full-screen sheet over a dimmed studio.

- Top app bar with back/close, title, and a small icon.
- Four content groups:
  1. **Gameplay** — Practice Mode and current match preferences.
  2. **Display & Sound** — Theme (System / Light / Dark), Sound Effects, Haptic Feedback, Speed Unit, Reduced Motion.
  3. **Online** — Connection status, how online play works, and a link to the online lobby. Read-only informational rows; no new networking behavior.
  4. **About** — Version, How to Play, reset preferences, and the disclaimer.
- Grouped surfaces with dividers, not a separate card per row.
- Rows are at least 56 px tall; all controls have 44 px targets.
- Theme selector is a three-state segmented control. The start-screen sun/moon button is a quick light/dark switch and sets an explicit preference.
- Descriptions stay visible; do not rely on icons alone.

### Buttons and controls

| Variant | Shape | Use |
|---|---|---|
| Primary | 52 px, radius 16 | Start Solo, Resume, Save |
| Secondary | 48 px, surface + hairline | Play Online, Restart, Settings |
| Tertiary | 44 px icon + label | Practice, How to Play, Settings |
| Icon | 44 px circular/rounded square | Sound, theme, fullscreen, pause |
| Segmented | 44 px, radius 12 | Difficulty, theme mode |
| Toggle | pill, 44 px | On/off preferences |
| Danger | secondary shape, rose text/border | Exit match, destructive actions |

States: default, hover (pointer devices only), focus-visible ring, pressed scale `0.98`, disabled opacity + icon. Focus ring: 2 px cyan with 2 px offset. All icons: Iconoir, 1.8 stroke, 18–20 px.

### Court and equipment

- **Camera:** fixed top-down; no perspective tilt and no camera movement. A slightly pulled-back static lens keeps the near return zone visible behind the baseline.
- **Table:** ITTF-style blue top, white boundary and center lines, graphite net with a white tape edge, slim dark legs/apron. Small `POCKET / STUDIO 01` apron text replaces WTT branding.
- **Paddles:** top-down silhouettes with classic red forehand and black backhand rubber, a warm wood handle, and a charcoal blade edge. Player and opponent remain identified by the HUD's cyan/rose accents. Subtle rubber grain, not photorealistic.
- **Ball:** warm white, small specular highlight, soft contact shadow, thin white trail. Impact ring uses the hitter's accent color.
- **Studio:** same set in both themes. Dark is a deep arena with controlled light pools and faint vertical banners; light is a bright neutral hall with soft floor shadows. No crowd faces, no busy scenery, no extra text.
- **Court floor:** subtle seams and a soft circular light pool. Keep the ball and paddles the highest-contrast objects.
- Keep the current physics and collision geometry; art changes must not alter play feel.

## 5. Responsive Behavior

| Viewport | Behavior |
|---|---|
| 320×568 | 16 px inset; smaller display type; compact telemetry; bottom sheet scrolls internally; primary action first; no horizontal overflow |
| 390×844 | Reference composition; 20 px inset; full broadcast strip; hero court visible above sheet |
| 430×932 | More breathing room; same hierarchy |
| ≥521 px | Centered app frame max 520 px with ambient studio backdrop; no separate desktop layout |
| Safe areas | Top HUD and bottom sheet respect `env(safe-area-inset-*)` |

## 6. Accessibility and Constraints

- Body text contrast ≥ 4.5:1; large scores and labels ≥ 3:1.
- Never use color alone to identify player/opponent; pair with names and position.
- Preserve 44 px touch targets, focus trapping, Escape behavior, and `aria-pressed`.
- Theme preference: System by default, with explicit Light/Dark overrides. Persist it.
- Keep Iconoir for every UI icon. No emoji as icons.
- Preserve fullscreen feature detection, reduced motion, haptics, and sound preferences.
- No changes to gameplay physics, scoring, serves, networking, or the 60 Hz loop.
- The concept is static. Production implementation starts only after the visual concept is approved.

## 7. Concept Deliverable

The next artifact will be a static design board showing:

1. Start screen — dark and light.
2. In-game court + broadcast strip — dark and light.
3. Settings sheet — dark and light.
4. Buttons, chips, toggles, and focus states.
5. The 320 px adaptive broadcast strip detail.
6. Color and type specimen with the new mark direction.

The board is for visual approval only. It will not replace `index.html` until the direction is signed off.
