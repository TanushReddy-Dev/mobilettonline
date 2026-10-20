# Pocket Table Tennis — Prioritized Audit

- **Reviewed:** 20 October 2026
- **Scope:** start screen, HUD, dialogs, navigation, settings, solo AI, physics, online P2P play, PWA metadata, CI/deploy.
- **Method:** code review, Playwright smoke/server suite, opt-in two-browser PeerJS E2E, scripted layout/fullscreen checks, and targeted physics/protocol inspection.
- **Baseline:** no known P0 blocker in normal solo or online play after this pass.

## 1. Fixed in this pass

### Controls and layout

- **Start-screen sound/fullscreen icons are centered.** Both utilities are `44×44`; the visible Iconoir glyphs measure `dx=0`, `dy=0` at 320 px and 390 px widths.
- **Fullscreen is feature-detected.** Unsupported browsers hide the control and remove it from the tab order. Enter/exit Iconoir icons, `aria-pressed`, the accessible label, and resize handling now update on `fullscreenchange`.
- **Narrow-phone layout holds.** At 320×568 all start-menu controls remain reachable, serve badges are hidden on phone-width HUDs, and the HUD has no horizontal overflow. HUD action targets remain at least `44×44`; pause actions are `46 px` high.
- **HUD geometry is stable during rallies.** Serve badges reserve a fixed slot on wider HUDs, and online/streak telemetry is overlaid rather than added to the layout. The score digits, scoreboard, and canvas no longer move when service changes or a streak badge appears.
- **Short-screen start menu compacts instead of shrinking controls.** The 320×568 menu has a small internal scroll area, but no controls are lost.
- **Reduced-motion tokens, Apple/Emil motion refinements, and the Iconoir audit are in place.** No non-Iconoir UI glyphs were introduced.

### Physics and game feel

- **Second bounce now follows a natural table-tennis rhythm.** Shared restitution is `0.68`, with a vertical clamp of `2.4–4.1`, horizontal friction `0.94`, and a unified spin kick of `0.3`. A typical second bounce follows the first by about **0.34 s**.
- **The point window stays forgiving.** The AI-side out threshold is `TABLE.bottom + 82`, so a deep second bounce is still scored naturally rather than clipping early.
- **Online and solo use the same table-bounce helper.** Guest prediction and host authority share the same bounce timing, sound, and ring behavior.
- **Online fairness no longer depends on the saved solo difficulty.** Both peers use the same online paddle easing (`0.90`) and hit assist (`10`); solo retains difficulty-specific assist.

### Online correctness and resilience

- **Host is authoritative for serves, returns, scores, and state.** Guest returns must arrive while playing, after the ball has reached the guest side, and from the current host-side hitter. Serves require the correct serve state and server.
- **Race-free connection setup.** Already-open incoming PeerJS connections are handled synchronously; superseded/closed connections and stale `onlineRequestId` callbacks are ignored.
- **Malformed and late packets are contained.** `S`, `P`, and `HIT` payloads are shape/state/finite-number validated; `netConn.send` is replaced by guarded `sendNet`; packets after disconnect are ignored.
- **Guest serving and receiving start from authoritative state.** The guest may serve only after a host snapshot confirms the host is waiting for that guest's serve.
- **Background tabs auto-pause instead of dropping the match.** This applies to host and guest, including a peer that connects while already hidden. `RESUME_REQ` is ignored while the host is hidden.
- **Pause, rematch, and disconnect flows are coherent.** Disconnect closes pause/settings/controls overlays. Rematch requests appear in both pause and result dialogs. Closing the online lobby cancels a pending session.
- **Guest result correction is in place.** A late authoritative `GAME_OVER` snapshot reopens/resets the result modal if the predicted winner title disagreed with authoritative scores.
- **Guest point language is corrected.** Host-authored `PLAYER`/`AI` reasons are mirrored for the guest, and online banners now use `YOU`/`GUEST` (host view) or `YOU`/`OPPONENT` (guest view) instead of solo AI wording.
- **Online labels and copy are consistent.** The service banner says `OPPONENT SERVICE`; Copy Code resets correctly; narrow phones hide redundant serve badges.

## 2. Remaining findings

### P1 — High

| ID | Finding | Impact | Recommended change |
|---|---|---|---|
| P1-1 | **Strict-NAT connectivity is not solved by default.** The app ships STUN-only ICE; TURN is available only through `window.WTT_TURN_SERVERS`. | Some mobile, corporate, and symmetric-NAT pairs cannot connect at all. | Deploy a managed TURN pool (or a lightweight relay), select servers by health/latency, and surface connection diagnostics. Keep the override documented. |
| P1-2 | **No reconnect or session resume.** A 15 s watchdog, refresh, back navigation, or a long OS interruption ends the match. | Mobile players lose a match to a transient network/background event. | Add reconnect tokens, a host-side grace period, state rehydration, and a full snapshot resync. At minimum, offer a clear **Reconnect** path before showing “opponent left.” |
| P1-3 | **One reliable, ordered DataChannel carries everything** — control, 60 Hz snapshots, and paddles. | A lost snapshot can head-of-line block a score/serve event; loss can feel like rubber-banding. | Use an unreliable/unordered channel for high-rate snapshots and paddles with sequence numbers and interpolation; keep pause/point/rematch events on the reliable channel. |
| P1-4 | **The online E2E is not part of CI, and deploy can publish before CI passes.** It runs only with `RUN_ONLINE_TESTS=1`; the Pages workflow uploads immediately on push. | Online regressions can reach production without a failing check. | Run the two-browser suite in a nightly (or gated) workflow, and make deploy depend on the test workflow or merge both into one pipeline. |

### P2 — Medium

| ID | Finding | Impact | Recommended change |
|---|---|---|---|
| P2-1 | **No connection timeout or cancel state for host/join.** A failed PeerJS open can leave the lobby waiting indefinitely. | Players cannot tell whether to retry or change networks. | Add a 10–15 s connect timer, abort/cleanup on expiry, and an actionable error with retry. |
| P2-2 | **Late-hit fairness and anti-cheat are trust-based.** The host accepts a guest `HIT` based on game state and bounce count; it does not verify paddle proximity, a shot timestamp, or maximum travel. | A modified guest can return from anywhere; high latency can create disputed hits. | Add shot timestamps with an RTT-aware grace window, validate distance to the last known guest paddle, clamp target coordinates, and document that P2P play is not cheat-proof. |
| P2-3 | **Guest result stats can diverge.** Scores are authoritative, but aces, faults, winners, longest rally, and smashes are partly local/predicted; only the winner title is corrected. | The guest can see different final statistics from the host. | Send a complete authoritative stat block in the `GAME_OVER` snapshot and replace all guest values at match end. |
| P2-4 | **PWA metadata exists, but there is no service worker/offline cache.** | Installability and offline launch are unreliable; a versioned asset update mechanism is absent. | Add a minimal versioned service worker with precached shell/assets, an update prompt, and cache busting. |
| P2-5 | **PeerJS is loaded from a public CDN without SRI or CSP.** | CDN compromise or unexpected version drift becomes code execution in the game origin. | Vendor/pin PeerJS, add integrity metadata where compatible, and add a CSP (accounting for the inline game script, or extract it). |
| P2-6 | **Modal stack and keyboard accessibility are incomplete.** The start modal can remain open under pause/settings/how-to-play, all with `aria-modal="true"`; online tabs lack `role="tablist"/"tab"` and `aria-selected`; closing a stacked dialog does not restore focus to its opener. | Screen-reader users get conflicting modal boundaries; keyboard users can land on a hidden card. | Centralize modal open/close, mark underlying dialogs `inert`/`aria-hidden`, add tab semantics, and save/restore the invoking focus target. |
| P2-7 | **Practice mode is sticky and weakly signposted.** It persists into a later “Play Solo Match” and has no persistent in-game badge; only a short banner announces it. | Players can unknowingly play a non-scoring practice session. | Reset practice on normal solo start, or show a persistent `PRACTICE` badge and a clear exit toggle. |
| P2-8 | **The waiting host room stays live while the Join tab is open.** Opening Online auto-creates a room; switching to Join does not cancel it. | A friend can join and start a match while the host is looking at the Join form. | Cancel the room on switching to Join, or create the room only after an explicit **Create Room** action. |

### P3 — Low

- **Dead/legacy controls:** `#online-active-controls`, `elBtnOnlineHud`, and `elBtnHudHome` are unreachable or null; they add maintenance noise.
- **Clipboard feedback:** copy failures are silent, and the host code display itself is not click-to-copy.
- **Rate limiting:** `PAUSE_REQ` and `REMATCH_REQ` are unthrottled; add a short cooldown/debounce and ignore them in invalid states.
- **Target validation:** mirrored `HIT` target coordinates are not clamped to the table; clamp them as defense in depth.
- **Small-screen affordance:** the 320 px start and settings cards have a small internal scroll without a visible “more” cue.
- **Live-region coverage:** the score area and canvas have no accessible live description; consider a short `aria-live` score summary and a text alternative for the table.
- **`P` shortcut:** `P` closes Settings/How-to-Play just like Escape. Prefer Escape-only modal dismissal if the shortcut is meant to be pause-only.
- **Error copy:** raw PeerJS error text can reach the status bar; map common failures (`peer-unavailable`, `network`, `server-error`) to human guidance.
- **Invite URL semantics:** `?room=CODE` pre-fills the join form but does not auto-join; the name “auto-join” in the code is misleading.
- **Fullscreen rejection:** a denied/denied-by-policy fullscreen request leaves the control state unchanged and has no explanation.

## 3. Test coverage gaps

- No committed deterministic test for the **second-bounce timing**, restitution, or out threshold. A scripted physics fixture would guard the feel work.
- `online.spec.js` covers host serve, pause, restart, and disconnect, but not a **guest serve**, a **guest return**, or **match completion**.
- No committed test for **background auto-pause**, reconnect-adjacent behavior, or the connection watchdog.
- No committed test for the **guest result correction** or rematch-request notes beyond their initial hidden state.
- No committed test for **fullscreen enter/exit** (the control state and unsupported fallback were checked manually).
- No committed 320 px start/settings/pause layout test. The HUD geometry regression test toggles telemetry synthetically rather than exercising a live online match.
- No test for **online difficulty normalization** or the `PLAYER`/`AI` → `YOU`/`GUEST`/`OPPONENT` banner translation.

## 4. Validation performed

- `npm run build:css` — generated Tailwind CSS injected successfully.
- `npm run validate` — HTML validation and inline-JS syntax check pass.
- `npm test` — **17 passed, 1 skipped** (the online suite is opt-in).
- `RUN_ONLINE_TESTS=1 npx playwright test tests/online.spec.js` — **1 passed** (24.2 s).
- Scripted UI audit at 320×568 and 390×844 — no console/page errors, no horizontal page overflow, HUD controls inside the app frame, serve-badge collision absent on phone widths, pause actions all 46 px high. HUD height, canvas top, and score positions stayed fixed when serve, online, and streak indicators changed.
- Fullscreen enter/exit — `aria-label`, `aria-pressed`, enter/exit icon visibility, and canvas metrics updated correctly. Unsupported-mode simulation hid the button (`display:none`, `aria-hidden="true"`, `tabIndex=-1`).
- Screenshots: `C:\Users\Tanus\AppData\Local\Temp\wtt-final`.

## 5. Accepted constraints

- Online play is a trusted peer-to-peer match, not a server-refereed competitive service.
- A single ordered reliable channel is intentional for v1; the latency trade-off is documented above for a future transport split.
- iOS Safari does not expose the desktop Fullscreen API consistently; the control is intentionally hidden there.
- 60 Hz snapshot networking and the existing passing CI checks are preserved.
