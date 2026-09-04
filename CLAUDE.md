@AGENTS.md

# Deploying to production

"Deploy to production" / "deploy to my docker" means: rebuild the image and
recreate the `vanessas-cakes-web` container from this repo's `docker-compose.yml`.

    docker compose --env-file .env.docker up -d --build

Notes:
- `.env.docker` (gitignored) holds the **live** production config: real
  Supabase project (separate from the `.env.local` dev project), LIVE-mode
  Stripe keys, and the Cloudflare Tunnel token that exposes the container at
  vanessascake.com. There's no root `.env` file, so `--env-file .env.docker`
  is required — otherwise the `NEXT_PUBLIC_*` build args and
  `CLOUDFLARE_TUNNEL_TOKEN` in `docker-compose.yml` resolve empty.
- The container runs DB migrations against production on startup (check
  `docker logs vanessas-cakes-web` for `[db] migrations applied`) — no
  separate migrate step needed.
- The `tunnel` service (cloudflared) usually doesn't need to restart; only
  `web` gets recreated by the command above.
- After deploying, sanity-check with `docker ps` (both containers `Up`) and
  `curl -o /dev/null -w "%{http_code}" http://localhost:5000/` (expect 200).
- This is live infra with real payment processing — treat it accordingly
  (brief downtime during recreate; no destructive DB actions without asking).
