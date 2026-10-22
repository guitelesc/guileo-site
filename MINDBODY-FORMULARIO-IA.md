# Playlist / Mindbody — AI Integration Information Form (rascunho, 2026-10-08)

Formulário: https://playlist.notion.site/321dda30e231801193c7e75bf0da2801 (pré-requisito do "Go Live" da conta de desenvolvedor — ver ATIVACOES.md, item 1).
Respostas tiradas do código (`functions/lib/mindbodyApi.js`, `functions/api/mindbody.js`, `db/mindbody_v2.sql`) e da configuração do agente da Lilian na ElevenLabs (lida em 2026-10-08).
**⚠ = depende de decisão do Luis antes de enviar.**

---

**Business Name associated with your Developer Account:** GUILEO AI

**Email associated with your Developer Account:** admguileo@gmail.com

**1. Describe exactly what your integration does**

Guileo is an AI front-desk platform for appointment-based small businesses. Our first Mindbody customer is Natura Spa + Salon (New York; Site IDs 767008 and 5734109). After the business owner activates our source on their site, the integration:
- reads the site's locations, staff, session types and bookable items so our AI receptionist (phone and website chat) quotes real availability;
- books, reschedules or cancels ONE appointment when a client explicitly asks for it and confirms it in the conversation;
- finds (or adds, if new) the client record needed for that single booking;
- runs an hourly, read-only sync of staff appointments so our front-desk screen and reminders match Mindbody;
- optionally imports the client list (name, email, phone) once, only when the owner clicks "Import", so returning clients are recognized.
It does not process payments, sales, packages or memberships through the API.

**2. Will your application use any AI/LLM, chatbot, voice AI, or autonomous agent capability?**

Yes. A voice AI receptionist (phone) and a website chat, both built on ElevenLabs Conversational AI; the language model is OpenAI GPT-4o, accessed through ElevenLabs. The AI agent never calls the Mindbody API directly and never holds any credential: it calls our own server tools ("check availability", "book", "cancel/reschedule"), and our server is the only component that talks to Mindbody, with fixed, validated parameters.

**3. Will any API derived data be sent to a third party AI provider or model?**

Yes, a minimal amount, only inside a live conversation: the tool results returned to the AI during a call or chat contain the open time slots, service/staff/location names and, for that caller only, their own first name and their own upcoming appointment. We never send lists of other clients, bulk exports, payment data or credentials to any AI provider.

**4. Will any API derived data be used for training, fine-tuning, analytics improvement, or benchmarking?**

No. We do not use API-derived data to train, fine-tune or benchmark any model, and we have not enabled any provider option that would allow it.

**5. What exact data fields and endpoints do you need, and why?**

- `POST /usertoken/issue` — staff token per site (cached ~23 h so we don't request one per call).
- `GET /site/sites`, `GET /site/activationcode` — show the owner the activation link (owner consent).
- `GET /site/locations`, `GET /site/sessiontypes`, `GET /staff/staff`, `GET /client/requiredclientfields` — map the business's services, staff and locations once (Id, Name, duration, location).
- `GET /appointment/bookableitems`, `GET /appointment/activesessiontimes` — real availability for a requested service/date.
- `GET /appointment/staffappointments` — hourly read-only sync and double-booking check (Id, StartDateTime, EndDateTime, StaffId, LocationId, SessionTypeId, ClientId, Status).
- `GET /client/clients`, `GET /client/clientduplicates`, `POST /client/addclient` — find or create the client for a booking (Id, FirstName, LastName, Email, MobilePhone); also the optional owner-triggered import.
- `POST /appointment/addappointment`, `POST /appointment/updateappointment` — book, reschedule or cancel one appointment.
We do not need sales, payment, contract, package, class or financial-report endpoints.

**6. Will your app create, modify, or cancel bookings or other records automatically?**

Only on an explicit client request, one appointment at a time: the AI repeats service, date, time and staff and books only after the client confirms. Reschedule/cancel is limited to the caller's own appointment. A new client record is created only when needed for that booking. There is no batch or scheduled write job. Writes stay off until the owner activates the site and saves the service mapping, and the owner can turn the integration off at any time.

**7. What controls prevent bulk extraction, scraping, runaway automation, or excessive API calls?**

- The AI can only call our fixed tools; it cannot issue arbitrary API requests or export lists.
- No endpoint of ours returns bulk Mindbody data to the public; the only list read (client import) is owner-triggered and paginated at 200 per page with a hard cap of 25 pages per run.
- Staff tokens are cached (~23 h); every request has a 9-second timeout.
- 429 and 5xx responses stop the operation and are reported to us and to the owner; we do not retry in loops.
- Rate limits per business and per IP on our public endpoints; the booking engine locks each time slot so one request can't loop into duplicate bookings.
- The background sync runs once per hour and is bounded.

**8. How do you segregate data between customers and protect credentials?**

- Multi-tenant by business account: every record carries the business ID; database row-level security is on and data is reached only through server-side functions scoped to that business.
- Each business has its own AI agent; agents receive no credentials.
- The site staff login is stored server-side in our database, readable only by our server's service role (never by browsers), and is never returned in any response or log (redacted in errors).
- Our Mindbody API key is stored as an encrypted secret in Cloudflare, never in code or in the browser.

**9. What is your retention/deletion policy for API derived data, prompts, logs, and transcripts?**

- Appointment and client data synced from Mindbody: kept only while the business uses Guileo; deleted within 30 days after the business ends the service, or sooner on the owner's request.
- Call/chat transcripts and recordings (ElevenLabs): retained for 90 days, then deleted automatically.
- Error logs never contain credentials or full client lists.
- Staff tokens expire within 24 h and are cached only in memory/short-lived cache.

> ✅ 2026-10-08: retenção de 90 dias LIGADA no agente da Lilian (versão agtvrsn_2601m4eyy9n3fty8p2bsh7eqdc1f; telefone conferido depois). Vale para conversas novas — as anteriores não foram apagadas (apagar exige OK do Luis). Os "30 dias depois de sair" é compromisso nosso (hoje feito à mão).

**10. List all subprocessors and AI/model providers that will process API-derived data.**

- Cloudflare — hosting, serverless functions, short-lived cache.
- Supabase — PostgreSQL database.
- ElevenLabs — voice and chat AI platform (conversation processing, transcripts).
- OpenAI — language model (GPT-4o), accessed through ElevenLabs.
- Twilio — telephone calls and SMS (booking confirmations/reminders).
- Resend — transactional email (booking confirmations/reminders).
- Meta (WhatsApp Business) — only if the business enables WhatsApp messages.
No other AI provider processes Mindbody data.
