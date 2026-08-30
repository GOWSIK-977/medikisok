# kiosk-frontend (Person 3)

Next.js 14 app covering the patient kiosk, the doctor dashboard, and the
integration glue between Person 1 (conversation-engine, :4000) and
Person 2 (document-engine, :4001).

## Run it

```bash
cd medikiosk/kiosk-frontend
npm install
cp .env.local.example .env.local   # edit if your APIs run elsewhere
npm run dev                        # http://localhost:3000
```

Person 1 and Person 2 must both be running (`npm run dev`/`node server.js`
in their own folders, ports 4000 and 4001) for the kiosk and dashboard to
work — this app is a pure client for their APIs, it doesn't run any logic
itself.

## What's built

**Patient kiosk** (`/kiosk`): welcome + language select → identify (mock
ABHA ID + name/age/gender, starts a session via Person 1) → consent →
interview (chat-style adaptive Q&A against Person 1, surfaces red flags
live) → documents (upload against Person 2, or "use demo sample" if you
don't have a scanned file handy) → review (fetches Person 1's full summary,
posts it to Person 2's merge endpoint, shows the doctor-facing summary,
hands off to the queue).

**Doctor dashboard** (`/dashboard`): queue view (patients with unconfirmed
red flags float to the top) → patient detail (red-flag banner, full
structured history rendered generically from whatever the schema contains,
extracted documents, editable AI summary, Confirm & Submit / Send back to
interview).

**Integration glue**: `src/lib/api.js` wraps both backends'
endpoints exactly as documented in the project summary. `src/lib/fhir.js`
builds a clearly-labeled mock FHIR bundle when a doctor confirms — no real
network call, per the agreed scope cut.

## The one deliberate hack: `src/lib/registry.js`

Neither backend exposes a "list all sessions" endpoint, and wiring real
persistence is out of scope for the demo. So the kiosk writes a row to
`localStorage` the moment a session starts, and the dashboard reads that
to build the queue. **This only works when the kiosk and dashboard run in
the same browser** — which matches the normal single-laptop hackathon demo
setup. If you need it to work across two separate devices/browsers for the
actual demo, the fix is either:

1. Add a real `GET /api/sessions` endpoint to Person 1 or Person 2
   (`registry.js`'s shape is a small, deliberate target to migrate to), or
2. Just make sure the kiosk flow and dashboard are opened in the same
   browser during rehearsal.

Decide this with the team before hour 26 — don't discover it mid-demo.

## Known gaps / next steps

- **Voice input** isn't wired up — the interview screen is currently
  touch/typed only. If AI voice is a must-have for the pitch, the
  interview page (`src/app/kiosk/interview/page.js`) is the place to add
  the Web Speech API or a recording widget; the chat state management is
  already there.
- **Physician edits** currently only cover the free-text
  `clinical_summary_text` field, not the structured sections — matches
  hackathon scope, but call this out explicitly in the pitch if asked.
- **OCR mock**: the "Use demo sample" button on the documents step sends a
  1×1 placeholder image, which is fine against Person 2's mock OCR
  provider (keyed off `documentType`, not image content) but will break if
  `OCR_PROVIDER=tesseract` is ever turned on for the demo — swap in a real
  demo-scenario photo file if that switch happens.
- Doctor "Send back to interview" just resets queue status — it doesn't
  currently jump the kiosk back into interview mode for that same session.
  Fine for the demo narrative (patient re-does intake at the kiosk), but
  worth a one-line mention on stage rather than clicking it live.
