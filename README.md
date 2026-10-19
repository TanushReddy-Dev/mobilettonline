# 🏓 WTT Arena Pro — Pocket Table Tennis Online

> ### 🎮 **Play Live Now**: [https://tanushreddy-dev.github.io/mobilettonline/](https://tanushreddy-dev.github.io/mobilettonline/)

A fast, mobile-first 3D table tennis game. Play solo against the AI or challenge a friend to a private peer-to-peer match over WebRTC. No account and no game server: the entire game is a static site.

> **Disclaimer:** This is an independent fan project. It is not affiliated with, endorsed by, or sponsored by World Table Tennis (WTT).

## 🌐 Online Multiplayer

- **Private match codes** — create a room, share a 6-character code or invite link, and play from two browsers.
- **Peer-to-peer WebRTC** — direct browser-to-browser DataChannel play via PeerJS, with client-side prediction and throttled 30 Hz snapshots.
- **Reliable transport** — all online messages use a single reliable, ordered DataChannel; snapshots and paddle updates are throttled to 30 Hz so critical events are not silently dropped.
- **Symmetrical 3D perspective** — both players play from behind their own paddle at the bottom baseline.
- **Physics** — spin, topspin, backspin, sidespin/Magnus, net cords, smashes and drop shots.
- **Zero server setup** — the game is a single static `index.html`.

### Network requirements

Online play uses STUN by default, which works for most home networks. Some restrictive or symmetric NATs require a TURN relay. To supply one, define `window.WTT_TURN_SERVERS` **before** the game script runs:

```html
<script>
  window.WTT_TURN_SERVERS = [
    { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
  ];
</script>
```

WebRTC requires a secure context: use HTTPS (GitHub Pages is HTTPS) or `http://localhost`.

## 🚀 GitHub Pages Deployment

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Push to `main` (or run the deploy workflow manually). The included `.github/workflows/deploy.yml` publishes the repository root.

The game is published at `https://<username>.github.io/<repository>/`. If you prefer branch-based Pages hosting instead, select **Deploy from a branch → `main` → `/ (root)`**; do not use both deployment methods at once.

## 🛠️ Local Development

Requires Node.js 20 or newer for the build and test tooling. The game itself needs only a browser.

```bash
npm install
npm run serve          # http://localhost:3000 (auto-increments if busy)
```

The local server only serves the app's public files and rejects path traversal attempts.

### Build and checks

```bash
npm run build:css      # regenerate the inline Tailwind bundle from src/tailwind.css
npm run validate       # validate index.html and the inline JavaScript
npx playwright install chromium   # first run only
npm test               # Playwright smoke tests + server security tests
```

Tailwind classes are scanned from `index.html`. After adding or removing utility classes, rerun `npm run build:css`; the generated CSS is injected into the `<style id="tailwind-bundle">` block so the game stays a single portable file.

The Playwright config uses the bundled Chromium by default. To use an installed Chrome instead:

```bash
PW_CHANNEL=chrome npm test
# Windows PowerShell:
$env:PW_CHANNEL="chrome"; npm test
```

The regular suite is offline and deterministic. An end-to-end two-browser online test is included but skipped by default because it uses the public PeerJS signaling service:

```bash
RUN_ONLINE_TESTS=1 npm test
# Windows PowerShell:
$env:RUN_ONLINE_TESTS="1"; npm test
```

## 📁 Project Layout

| Path | Purpose |
| --- | --- |
| `index.html` | The complete game: markup, design system CSS, and game/network logic. |
| `server.js` | Dependency-free local development server. |
| `src/tailwind.css` | Tailwind source used to generate the inline utility bundle. |
| `scripts/inject-tailwind.mjs` | Injects generated CSS into `index.html`. |
| `tests/` | Playwright smoke, modal-structure, preference and server tests. |
| `icon.svg`, `manifest.webmanifest` | Favicon and installable web-app metadata. |

## 📜 License

MIT — see [LICENSE](LICENSE).
