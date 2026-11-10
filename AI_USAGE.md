# AI usage

## Tool

**Claude Code** (Anthropic's AI coding agent).

## What it was used for

- Reading the assignment and proposing the plan (backend, frontend, Docker, docs).
- Writing most of the code: the .NET API, EF Core model and migration, the
  React pages, Dockerfiles, docker-compose, tests, and first drafts of
  README / ASSUMPTIONS / this file.
- Explaining the .NET, EF Core, PostgreSQL locking and Docker concepts so I
  could understand and defend each decision.

I reviewed the code, ran it, and checked each rule in the brief against it.

## Where the AI got things wrong, and how it was caught

1. **Database not created on first run.** The first startup code opened a
   connection before running migrations, which fails when the database does not
   exist yet (`3D000: database "school_admission" does not exist`). Caught by
   actually running the API. Fixed by creating the database first, then migrating.
2. **Concurrency test failed inside Docker but passed locally.** The test fired
   150 requests at once; each test server could open up to 200 connections, and
   the Docker PostgreSQL allows only 100 by default, so some requests got
   "too many clients" errors instead of `409`. Seats were still never
   overbooked, but the expected counts were wrong. Fixed by capping the test
   connection pool (extra requests wait) and raising `max_connections`.
3. **Checking that the concurrency test really tests something.** To be sure the
   lock is what prevents overbooking, the `FOR UPDATE` was removed on purpose
   and the tests were run again: the overbooking tests failed (more holds than
   seats). With the lock restored they pass.
4. **Small things:** default template files (WeatherForecast, Vite demo) had to
   be removed; a validation message was duplicated; raw JSON parser errors were
   replaced with a clear "body is not valid JSON" message.
