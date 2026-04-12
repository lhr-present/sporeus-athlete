# open-wearables — Self-hosted Docker Setup

Self-hosted [open-wearables](https://github.com/open-wearables/open-wearables) instance
that normalizes Garmin / Polar / Suunto / COROS / Wahoo / Oura / Whoop data into a unified
REST API consumed by the Sporeus device-sync edge function.

## Quick start

```bash
cp .env.example .env   # fill in OAuth credentials for each provider you need
docker compose up -d
```

Instance is available at `http://localhost:3100`.

## Registering with Sporeus

In the Sporeus Athlete app → Profile → **Wearable Devices**:

- Provider: select your device brand
- Instance URL: `https://ow.yourdomain.com` (must be HTTPS if hosted remotely)
- API Token: set if your open-wearables instance requires authentication

Click **Sync Now** to pull the last 7 days of activities.

## API endpoints used by Sporeus

| Endpoint | Description |
|---|---|
| `GET /api/v1/activities?since=<ISO>` | Activities since timestamp |
| `GET /api/v1/recovery?since=<ISO>` | HRV / recovery data since timestamp |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GARMIN_CONSUMER_KEY` | Garmin only | Garmin Health API consumer key |
| `GARMIN_CONSUMER_SECRET` | Garmin only | Garmin Health API consumer secret |
| `POLAR_CLIENT_ID` | Polar only | Polar Flow OAuth client ID |
| `POLAR_CLIENT_SECRET` | Polar only | Polar Flow OAuth client secret |
| `SUUNTO_CLIENT_ID` | Suunto only | Suunto API client ID |
| `SUUNTO_CLIENT_SECRET` | Suunto only | Suunto API client secret |

## Security notes

- Deploy behind HTTPS (nginx + certbot or Caddy)
- Sporeus encrypts API tokens at rest using pgcrypto in Supabase
- Tokens are never returned to the client
