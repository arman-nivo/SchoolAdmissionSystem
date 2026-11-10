# Assumptions and decisions

Things the brief left open, what I chose, and why.

## Seats and concurrency

- **Seat rule enforcement.** Creating a hold locks the class row with
  `SELECT ... FOR UPDATE` inside a transaction, then counts `HELD` + `CONFIRMED`
  rows and inserts only if a seat is free. Requests for the same class are
  serialised; different classes run in parallel. I picked a row lock over
  `SERIALIZABLE` isolation (needs retry logic) and over a seat counter column
  (two sources of truth to keep in sync).
- **Two backend processes (bonus).** The lock is taken in PostgreSQL, not in
  .NET memory, so any number of backend processes sharing the database are
  safe. A test runs two in-memory backend instances against one database to
  prove it. Startup migrations take a PostgreSQL advisory lock so two instances
  starting together do not both migrate.
- **Expired holds stop counting right away.** A `HELD` row whose `expiresAt` has
  passed is treated as `EXPIRED` by every read and is not counted as held, even
  before the background job updates the row. The job (`HoldExpiryWorker`) marks
  such rows `EXPIRED` every 5 s (`EXPIRY_SWEEP_SECONDS`). Creating a hold also
  expires that class's overdue holds inside the locked transaction.
- **Hold time** comes from `HOLD_DURATION_SECONDS` (default 600) and is fixed
  when the hold is created. Timestamps are UTC, whole seconds.

## Applications (holds)

- **One active application per student per class.** A second hold for the same
  class while one is `HELD` returns `409 ALREADY_APPLIED`; when one is
  `CONFIRMED`, `409 ALREADY_ADMITTED`. After a hold expires or is cancelled the
  student may apply again. Enforced in code and by a partial unique index.
- **Different classes are allowed.** The brief limits one active application
  *per class*, so a student may hold seats in several classes (e.g. both shifts)
  at once.
- **Confirm** is allowed only for the owner (`403` otherwise), only while `HELD`
  and not expired (`409 HOLD_EXPIRED` / `409 HOLD_CANCELLED`). Confirming an
  already confirmed hold returns `200` with the same body and does not change
  anything, so `confirmedSeats` grows once. Implemented as one conditional
  `UPDATE ... WHERE status = 'HELD' AND expires_at > now`, so confirm vs. expiry
  races are settled by PostgreSQL.
- **Cancel** (`DELETE`) is allowed only for the owner and only while `HELD`.
  Cancelling a `CONFIRMED` admission returns `409`: a paid admission would need
  a refund process, which is out of scope. Cancelling twice returns `204`.
- **`GET /holds/{holdId}`** does not require `X-Student-Id` (the spec shows no
  header). Hold IDs are random, so they are hard to guess. The UI only lets the
  owner pay or cancel.
- **Payment** is simulated: pressing "Pay admission fee" calls confirm.

## Classes

- Each shift is a separate class (as the brief says). Class names are unique
  (case-insensitive) to avoid two identical rows in the list; duplicates get
  `409`.
- `totalSeats` must be 1-100000; name is required, max 200 characters.
- No update/delete endpoints for classes (not in the brief).

## Identity and validation

- `X-Student-Id` must be exactly 17 digits. Missing or invalid gives `400` with
  a clear message. There is no login, as the brief says.
- IDs look like `c_xxxxxxxxxxxx` / `h_xxxxxxxxxxxx` (random, 12 hex characters).

## Errors

- Every error is JSON: `{ "error": "CODE", "message": "..." }`. Validation errors
  add `details`. Database outages return `503`, other crashes `500`, never an
  HTML page.
- Responses keep every field from the spec and add a few (`className`,
  `studentId`, `createdAt`, `confirmedAt`), which the brief allows.

## UI

- Seat counts, application status and "My applications" refresh every 3 s by
  polling. Polling is simple and enough at this scale; SignalR/WebSockets would
  be the next step.
- The countdown uses the server clock (every response has an `X-Server-Time`
  header) so a wrong clock on the user's computer does not mislead them. At 0 the
  page shows `EXPIRED` and disables the pay button immediately.
- The birth registration number is stored in `localStorage`; applications are
  always loaded from the server, so they survive refresh and browser restart.
- A small hash router (`#/classes`, `#/holds/{id}`, `#/me`, `#/admin`) keeps the
  current page across refresh without extra libraries.
- The admin screen is not protected, because the brief has no login.
- UI text is in English, to match the API error messages.

## Running

- Ports: backend `8080`, frontend `3000`, PostgreSQL only inside the compose
  network (not published, to avoid clashing with a local PostgreSQL).
- The backend creates/migrates the schema on startup and retries until the
  database is ready.
- PostgreSQL runs with `max_connections=300` so the concurrency tests have room.
