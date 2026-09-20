# apps

Frontends for the two tools. Both call the shared scanner at `POST /scan`.

- `consent/` — the consent banner generator (static: scan → configure → live demo). Port from the existing kit's `web/public`.
- `gap/` — the gap-assessment report (port the React `Wizard` + `ReportView` + scoring from the marketing repo's `lib/gap-assessment`).

Coming after the scanner is verified.
