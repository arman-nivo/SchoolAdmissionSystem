# School Admission System

Online, first-come-first-served school admission. Parents apply for a seat in a
class (each shift is its own class), the seat is **held** for a limited time,
and paying the admission fee inside that time **confirms** it. Unpaid holds
expire on their own and the seat goes back to the pool.

| Part      | Tech                                                    |
|-----------|---------------------------------------------------------|
| Backend   | C# / .NET 8, ASP.NET Core Web API, EF Core, PostgreSQL 16 |
| Frontend  | React 18, TypeScript, Vite (no UI library)              |
| Run       | Docker + docker compose                                 |

## Run it (only Docker needed)

```bash
docker compose up --build
```

First start takes a few minutes (images and packages download). Then open:

| What        | URL                              |
|-------------|----------------------------------|
| **App (UI)**| http://localhost:3000            |
| API         | http://localhost:8080            |
| Swagger UI  | http://localhost:8080/swagger    |

Stop with `Ctrl+C` or `docker compose down`. Data is kept in the `pgdata`
volume, so `docker compose down` followed by `docker compose up` keeps every
class and application. (`docker compose down -v` wipes the data.)

### Using the app

1. **Create a class** in the navigation (admin): add e.g. `Class 6 - Morning Shift` with 120 seats.
2. Type a 17-digit birth registration number in the box at the top and press
   **Use this number**. This is the student's identity (no login).
3. **Browse classes**: search by class name or shift, filter for available seats,
   and see total / on hold / confirmed / available seats (refreshes every 3 s).
   Press **Apply** to reserve a seat.
4. The application page shows the countdown, **Pay admission fee** and **Cancel**.
5. **My applications** lists every application of that student.

## Configuration

All settings are environment variables (set them in `docker-compose.yml` or in
your shell before `docker compose up`).

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `ConnectionStrings__Default` | backend | `Host=db;...` (compose) | PostgreSQL connection string |
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a seat stays held |
| `EXPIRY_SWEEP_SECONDS` | backend | `5` | How often expired holds are marked `EXPIRED` in the DB |
| `CORS_ORIGINS` | backend | *(any)* | Comma-separated allowed frontend origins |
| `API_URL` | frontend container | `http://localhost:8080` | Backend URL the browser calls (applied at container start, no rebuild) |
| `VITE_API_URL` | frontend dev server | `http://localhost:8080` | Same, for `npm run dev` |

Example: shorter holds for a demo

```bash
HOLD_DURATION_SECONDS=60 docker compose up --build
```

## Tests

Backend: 20 integration tests that run the real API against a real PostgreSQL,
including the concurrency tests. Frontend: 8 Vitest + Testing Library tests.

With Docker only:

```bash
docker compose --profile test run --rm backend-tests
docker compose --profile test run --rm frontend-tests
```

Without Docker (needs .NET 8 SDK, Node 20 and a local PostgreSQL):

```bash
# backend; point TEST_DB_CONNECTION at any PostgreSQL user that can create databases
cd backend
TEST_DB_CONNECTION="Host=localhost;Port=5432;Username=postgres;Password=postgres" dotnet test

# frontend
cd frontend
npm ci
npm test
```

Main concurrency tests (`backend/tests/SchoolAdmission.Tests/ConcurrencyTests.cs`):

- 150 students apply to a 10-seat class at the same instant: exactly 10 get `201`, 140 get `409`, and the database holds exactly 10 active rows.
- The same student sends 30 parallel requests: exactly one hold is created.
- 20 parallel confirms of one hold: `confirmedSeats` is 1.
- **Bonus:** two separate backend instances sharing one database, 100 parallel requests split between them on an 8-seat class: exactly 8 succeed.

## Run without Docker (development)

```bash
# backend (needs PostgreSQL on localhost:5432, user/password postgres/postgres;
# the database is created automatically)
cd backend/src/SchoolAdmission.Api
dotnet run            # http://localhost:8080

# frontend
cd frontend
npm install
npm run dev           # http://localhost:5173
```

## API

Base URL `http://localhost:8080`, JSON in and out. The student is identified by
the `X-Student-Id` header (exactly 17 digits).

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 1 | `POST /classes` | Create class `{ name, totalSeats }` | 201 | 400, 409 duplicate name |
| 2 | `GET /classes` | All classes with seat counts | 200 | |
| 3 | `GET /classes/{classId}` | One class with seat counts | 200 | 404 |
| 4 | `POST /classes/{classId}/holds` | Apply (hold a seat) | 201 | 400, 404, **409** no seat / already applied |
| 5 | `GET /holds/{holdId}` | Current state of an application | 200 | 404 |
| 6 | `POST /holds/{holdId}/confirm` | Pay fee, confirm | 200 (also when already confirmed) | 400, 403, 404, 409 expired/cancelled |
| 7 | `DELETE /holds/{holdId}` | Cancel | 204 | 400, 403, 404, 409 |
| 8 | `GET /me/holds` | All applications of this student | 200 | 400 |

Every error body is `{ "error": "MACHINE_CODE", "message": "Human readable text" }`.
Responses contain every field from the spec plus a few extras
(`className`, `studentId`, `createdAt`, `confirmedAt`).

## How overbooking is prevented

Applying runs in one database transaction that first locks the class row
(`SELECT ... FROM classes WHERE id = @id FOR UPDATE`). Every other request for
the same class waits at that line, so "count held + confirmed, compare with
totalSeats, insert" happens one request at a time per class. Different classes
do not block each other. The lock lives in PostgreSQL, so it also works with
several backend processes. A partial unique index
(`one active hold per student per class`) is a second safety net in the database.
Details and other decisions are in [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Project layout

```
backend/
  src/SchoolAdmission.Api/
    Controllers/      HTTP endpoints (thin: read header, call service, map result)
    Services/         AdmissionService (all rules), HoldExpiryWorker (background expiry)
    Domain/           SchoolClass, Hold, HoldStatus
    Data/             AdmissionDbContext + EF Core migrations
    Infrastructure/   Startup migration with retry + advisory lock
  tests/SchoolAdmission.Tests/   integration tests (real PostgreSQL)
  Dockerfile
frontend/
  src/api/          fetch client + friendly error messages
  src/hooks/        polling, countdown clock, student id, hash router
  src/pages/        CreateClass, ClassList, Hold (application), MyHolds
  Dockerfile, nginx.conf, docker-entrypoint.sh
docker-compose.yml
```
