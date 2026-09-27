# Atomic Pathshala Teacher (Windows)

Desktop app for teachers. It opens the normal Atomic teacher portal in a
locked-down window and adds what a browser can't do: sending the class to
YouTube with a built-in encoder, so teachers never touch OBS, RTMP URLs or
stream keys.

## Status

| Part | State |
| --- | --- |
| Secure shell (one trusted origin, sandboxed page, camera/mic only for Atomic) | done |
| `window.atomicDesktop` bridge (info, encoder API) | done |
| Stage compositor in the teacher room (board + slide + camera → 1920×1080 video) | done — `src/lib/live-class/stage-compositor.ts` |
| Built-in encoder (FFmpeg) → YouTube | step 9 — `encoder.probe()` reports "not installed" until then |
| Signed installer | needs a code-signing certificate |

## Run locally

```bash
cd desktop/teacher
npm install
node node_modules/electron/install.js   # only if npm's script policy skipped Electron's binary download
npm start                                # opens the production portal
```

Point it at another Atomic site (e.g. a local dev server):

```bash
ATOMIC_APP_URL=http://localhost:3217 npm start
```

Only that origin is trusted; any other link opens in the system browser.

## Checks

```bash
ATOMIC_APP_URL=http://localhost:3217 npx electron . --smoke            # bridge present on the Atomic origin
ATOMIC_APP_URL=http://localhost:3217 npx electron . --smoke-untrusted  # bridge absent anywhere else
```

## Build the installer

```bash
npm run dist   # → dist/ (NSIS). Unsigned builds trigger Windows SmartScreen warnings.
```
