# AI usage

## Tools

- **Claude Code** (Anthropic) was used for the initial implementation.
- **OpenAI Codex** was used later for the UI redesign, a review against the
  assignment, a fix to application polling when switching students, and a
  usability and code clarity pass.

## What it was used for

- Claude Code: reading the assignment and proposing the plan (backend,
  frontend, Docker, docs).
- Claude Code: writing most of the initial code: the .NET API, EF Core model
  and migration, React pages, Dockerfiles, docker-compose, tests, and first
  drafts of README / ASSUMPTIONS / this file.
- Claude Code: explaining the .NET, EF Core, PostgreSQL locking and Docker
  concepts so I could understand and defend each decision.
- Codex: redesigning the navigation, class list, forms, and application pages;
  adding class search and availability filters; adding frontend tests; checking
  the PDF requirements against the code; and correcting stale polling responses
  after a student identity change. A later pass added direct links to existing
  applications from class cards, deadline ordering and a summary on the
  application page, a compact mobile layout, and clear demo payment wording.
  The student identity context, provider, and hook were split into small files
  so their responsibilities are easier to follow and lint runs without warnings.

The changes were checked with frontend tests, lint, and a production build.

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
5. **Previous student's applications could briefly appear after switching IDs.**
   Codex found that an earlier polling request could finish after the new
   student's request. The polling hook now ignores responses from an older
   student or an older request. A test resolves requests in the wrong order to
   check that only the selected student's applications remain visible.
