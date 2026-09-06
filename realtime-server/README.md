# FluidTalk Realtime Server

A tiny Socket.IO server for live messages, typing indicators and presence.

## Deploy to Railway

1. Create a new Railway project from this `realtime-server/` directory.
2. Add these environment variables in Railway:
   - `NEON_JWKS_URL` — the JWKS endpoint for your Neon Auth deployment, e.g.
     `https://ep-lingering-flower-axe7t37v.neonauth.c-4.us-east-2.aws.neon.tech/fluiddb/auth/.well-known/jwks.json`
   - `CORS_ORIGIN` — your Lovable preview URL, e.g.
     `https://id-preview--484a72eb-4b90-4800-934a-e9660118c8fe.lovable.app`
   - `PORT` — Railway sets this automatically; leave it blank or use `3000`.
3. Deploy. Railway will run `npm start`.
4. Copy the deployed domain (e.g. `wss://fluidtalk-realtime.up.railway.app`) into the main app's `.env` as:
   ```env
   VITE_REALTIME_URL=wss://fluidtalk-realtime.up.railway.app
   ```
5. Redeploy/preview the main app so the new environment variable is picked up.

## Local development

```bash
cd realtime-server
npm install
NEON_JWKS_URL=... CORS_ORIGIN=http://localhost:8080 npm run dev
```

## Protocol

- `room:join` / `room:leave` — join/leave a conversation room.
- `message:send` — broadcast a message the sender already persisted via the Data API.
- `message:new` — received when someone else sends a message to a room you're in.
- `typing` — broadcast/receive typing indicators.
- `presence` — global online/offline events.
