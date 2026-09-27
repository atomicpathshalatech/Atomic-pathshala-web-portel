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
| Built-in encoder (FFmpeg) → YouTube | done — `src/encoder.js`, `src/lib/live-class/desktop-streamer.ts` |
| Signed installer | needs a code-signing certificate |

## Run locally

```bash
cd desktop/teacher
npm install
node node_modules/electron/install.js   # only if npm's script policy skipped Electron's binary download
npm run fetch-ffmpeg                     # LGPL FFmpeg → vendor/ffmpeg (SHA-256 verified, gitignored)
npm start                                # opens the production portal
```

Point it at another Atomic site (e.g. a local dev server):

```bash
ATOMIC_APP_URL=http://localhost:3217 npm start
```

Only that origin is trusted; any other link opens in the system browser.

## How a class reaches YouTube

```
teacher room (board + slide + camera + mic)
  → StageCompositor, 1920×1080 @ 30 fps
  → MediaRecorder (WebM, 250 ms chunks) → IPC
  → FFmpeg: H.264 CBR 4.5 Mbps, keyframe every 2 s, no B-frames, AAC 48 kHz stereo
  → rtmp(s) → this class's own YouTube stream slot
```

- When the teacher presses **Start class**, the app fetches the class's stream key
  itself; the teacher never sees OBS, a URL or a key. In a plain browser the
  OBS panel is shown instead.
- The encoder is chosen by a test encode at startup:
  NVENC (NVIDIA) → QSV (Intel) → AMF (AMD) → Media Foundation → openh264 (CPU).
- A dropped connection is retried with a 2/4/8/15/30 s back-off, and a stalled
  FFmpeg is restarted after 20 s. The YouTube broadcast has auto-stop off, so
  it picks straight back up. A page refresh mid-class resumes sending too.
- No camera or mic? The class still goes out: board only, with silent audio,
  and a warning in the header.
- The stream key is redacted from every log and status message.
- The PC is kept awake while a class is being sent.

### FFmpeg licence

The bundled FFmpeg is the BtbN **LGPL v3** build (`--enable-version3`, no GPL
parts). There's no fee, and shipping it is allowed as long as it stays a
separate `ffmpeg.exe` (it does) and its `LICENSE.txt` + `SOURCE.txt` go
with it (the installer copies them to `resources/ffmpeg`).

## Checks

```bash
ATOMIC_APP_URL=http://localhost:3217 npx electron . --smoke            # bridge present on the Atomic origin
ATOMIC_APP_URL=http://localhost:3217 npx electron . --smoke-untrusted  # bridge absent anywhere else
npm run test:encoder   # encoder → local RTMP ingest: format, keyframes, drop + reconnect, key redaction
npm run test:e2e       # real app + real streamer → local RTMP ingest; camera/mic denied, board checked in the video
```

Neither test touches YouTube or the real webcam/mic.

## Build the installer

```bash
npm run dist   # fetches FFmpeg if missing, then → dist/ (NSIS). Unsigned builds trigger Windows SmartScreen warnings.
```
