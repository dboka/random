# ASTORIJA salon website

Full stack Latvian salon website built with Vinext, Cloudflare Workers and D1. New Sites are owner private until the owner explicitly changes access.

## Features

- Responsive salon pages with services, prices, gallery, Google Maps reviews, contact details and opening hours.
- Live appointment availability in the Europe/Riga timezone, with 30 minute slot locks. A D1 unique primary key prevents overlapping bookings even under concurrent requests.
- Name and phone collection with validation, rate limiting, cancellation token, and optional SMS notification through Twilio.
- Password protected admin page at `/admin` for appointments, SMS retries, staff and service management.
- Privacy notice, no marketing tracking, and deletion of bookings 90 days after their appointment when the next data operation runs.

## Production configuration

Set the following values through the native Sites environment variable tool. Mark credentials as secrets:

| Key | Purpose |
| --- | --- |
| `ADMIN_PASSWORD_HASH` | SHA-256 hexadecimal hash of a high entropy administrator password. |
| `ADMIN_SESSION_SECRET` | Random, high entropy secret for signed admin cookies. |
| `SALON_SMS_NUMBER` | Salon recipient number, currently `+37126134453`. |
| `TWILIO_ACCOUNT_SID` | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | Twilio auth token. |
| `TWILIO_FROM_NUMBER` | Twilio SMS-enabled sender number in E.164 format. |

SMS is recorded as `unconfigured` until all Twilio values exist. A booking remains confirmed in the database and the client sees a warning to call the salon. The admin can retry SMS after configuration.

Before opening the website to customers, the salon owner should add real services, prices and individual master names in the admin page, verify the legal controller name and processor agreements, and supply properly licensed photos of this salon. The single initial bookable item is a general consultation with the salon team; this avoids publishing invented offerings.

## Local development

```text
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_silly_freak.sql
npm run dev
```

`/api/bookings` requires a same-origin browser `Origin` header. Production D1 migration is applied by Sites during deployment.
