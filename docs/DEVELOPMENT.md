# 🛠️ Development / Ontwikkeling

This edition is provided for source viewing. The commands below are for the
rights holder and others with separate written permission to run the software;
they do not extend the [licence](../LICENSE).

## Source layout

| Path | Purpose |
| --- | --- |
| `src/routes` | Application routes and server rendering |
| `src/components` | UI components |
| `src/lib` | Shared logic and server-side modules |
| `worker` | Background processing and provider integrations |
| `public` | Public website assets |

Authorised development uses Node.js 24, npm and a separate development backend.
Do not use production accounts, customer data or production credentials.

```sh
npm ci
npm run typecheck
npm run build
```

These commands check the included source. The full private release suite and
operational tooling are not part of this viewing edition. Passing a build does
not configure a database, provision mail, activate payment accounts or deploy
the application. Backend setup requires separately authorised instructions.

`.env.example` contains synthetic placeholders only. Never commit filled-in
environment files, private keys, database exports or customer records.

## Nederlands

Alleen de eigenaar en anderen met afzonderlijke toestemming mogen deze code
uitvoeren. Gebruik voor ontwikkeling eigen testdiensten en fictieve gegevens.
De bouwopdrachten installeren of configureren geen productieomgeving. De
inzagelicentie geeft geen aanvullende gebruiksrechten.
