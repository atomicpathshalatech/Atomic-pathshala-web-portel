# Classroom media relay (WHIP → RTMP)

Deliberately separate from the main Next.js app. It exists only because:

- The teacher's browser can publish camera/mic via **WHIP** (plain WebRTC —
  no OBS, no LiveKit) directly from a browser tab, which is what "in-browser
  camera, no external encoder" (`ClassroomStreamMethod.BROWSER_RELAY`)
  requires.
- Browsers cannot speak **RTMP**, which is what YouTube Live's ingest needs.
- This app is on **Vercel** (serverless) and cannot run a persistent
  FFmpeg/relay process to bridge the two.
- Cloudflare Stream's own WHIP product was evaluated and does **not** support
  restreaming a WHIP-ingested input to an external RTMP destination
  (confirmed against Cloudflare's docs, Sep 2026) — so it can't do this job.

[MediaMTX](https://github.com/bluenviron/mediamtx) is a single static binary
that accepts WHIP in and can push RTMP out via a per-path `runOnReady` hook
(an `ffmpeg -c copy` remux, triggered the instant the teacher starts
publishing). This directory holds its config plus an nginx reverse proxy
that terminates TLS and bearer-gates the control API.

Sessions using `ClassroomStreamMethod.EXTERNAL_ENCODER` (teacher's own OBS/
phone app) never touch this relay at all — they push straight to YouTube.

## Before deploying

1. **Pin and verify the MediaMTX version.** `docker-compose.yml` pins an
   exact tag on purpose. MediaMTX's hook field names have changed across
   releases — before going live, check that pinned version's own docs for
   the hook that fires "a publisher has started sending this path" (this
   config assumes it's called `runOnReady`; some versions call the
   equivalent `runOnAvailable`). If it differs, update the field name in
   both `mediamtx.yml`'s comments and `RUN_ON_READY_FIELD` in
   `src/lib/classroom/media-relay.ts`.
2. Generate a strong random value for `CHANGE_ME_MEDIA_RELAY_API_TOKEN` in
   `nginx.conf` and set the same value as `MEDIA_RELAY_API_TOKEN` in the
   main app's environment.
3. Get a TLS certificate for your relay hostname (e.g. via `certbot`) and
   place it where `nginx.conf` expects it, or swap in your platform's
   managed TLS if deploying to something like Fly.io (which terminates TLS
   for you — in that case, drop the nginx TLS block and just proxy the
   bearer check).

## Deploying (example: a small VPS)

```bash
scp -r infra/media-relay user@your-vps:/opt/classroom-relay
ssh user@your-vps
cd /opt/classroom-relay
# edit nginx.conf: set server_name and the real API token
# place TLS certs under ./certs, matching nginx.conf's paths
docker compose up -d
```

## Deploying (example: Fly.io)

Fly.io terminates TLS for you, so you only need to run MediaMTX + a thin
auth check in front of its API port; adapt `nginx.conf`'s bearer-check
`location /v3/` block into a Fly.io app (or keep nginx as a sidecar) and
expose port 8889 (WHIP) publicly plus 9997 (API) only through the
bearer-checked path. `fly launch` from this directory using
`docker-compose.yml` as the source, then `fly deploy`.

## Env vars the main app needs

- `MEDIA_RELAY_BASE_URL` — e.g. `https://relay.yourdomain.com`
- `MEDIA_RELAY_API_TOKEN` — must match the token baked into `nginx.conf`
- `MEDIA_RELAY_WHIP_ORIGIN` — usually the same as `MEDIA_RELAY_BASE_URL`,
  used to build the WHIP publish URL handed to the teacher's browser

## What the app does at runtime (no manual per-class steps)

`src/lib/classroom/media-relay.ts` calls this relay's control API to add a
path named after the session (`ClassroomSession.relayPath`) with a
`runOnReady` hook that shells out to `ffmpeg` and pushes to the YouTube
ingest URL/key already created for that session — all triggered
automatically when the teacher clicks "Go Live" in the Classroom teacher UI.
Nothing here needs to be touched per-lecture; this directory is only
infrastructure setup, done once.
