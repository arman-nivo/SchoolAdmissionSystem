using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// All admission rules live here. Controllers only translate HTTP to these calls.
///
/// How overbooking is prevented (the most important rule):
///   Creating a hold opens a transaction and locks the class row with
///   SELECT ... FOR UPDATE. Any other request trying to hold a seat in the same
///   class waits at that line until the first transaction commits. So the
///   "count seats, then insert" steps run one at a time per class, and
///   held + confirmed can never exceed totalSeats. The lock lives in PostgreSQL,
///   so it also works when several backend processes share the database.
/// </summary>
public class AdmissionService
{
    private readonly AdmissionDbContext _db;
    private readonly TimeProvider _clock;
    private readonly HoldOptions _options;

    public AdmissionService(AdmissionDbContext db, TimeProvider clock, IOptions<HoldOptions> options)
    {
        _db = db;
        _clock = clock;
        _options = options.Value;
    }

    /// <summary>Current UTC time rounded down to whole seconds (keeps JSON timestamps tidy).</summary>
    private DateTime Now()
    {
        var now = _clock.GetUtcNow().UtcDateTime;
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
    }

    // ---------------------------------------------------------------- classes

    public async Task<ServiceResult<ClassResponse>> CreateClassAsync(CreateClassRequest request, CancellationToken ct)
    {
        var name = request.Name!.Trim();
        if (await _db.Classes.AnyAsync(c => c.Name.ToLower() == name.ToLower(), ct))
            return ServiceResult<ClassResponse>.Fail(ErrorKind.Conflict, "CLASS_EXISTS", $"A class named \"{name}\" already exists.");

        var entity = new SchoolClass
        {
            Id = NewId("c"),
            Name = name,
            TotalSeats = request.TotalSeats!.Value,
            CreatedAt = Now(),
        };
        _db.Classes.Add(entity);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Two admins created the same name at the same moment.
            return ServiceResult<ClassResponse>.Fail(ErrorKind.Conflict, "CLASS_EXISTS", $"A class named \"{name}\" already exists.");
        }

        return ServiceResult<ClassResponse>.Ok(new ClassResponse(entity.Id, entity.Name, entity.TotalSeats, 0, 0, entity.TotalSeats));
    }

    public async Task<List<ClassResponse>> ListClassesAsync(CancellationToken ct)
    {
        var classes = await _db.Classes.AsNoTracking().OrderBy(c => c.CreatedAt).ThenBy(c => c.Name).ToListAsync(ct);
        var counts = await CountActiveHoldsAsync(null, ct);
        return classes.Select(c => ToClassResponse(c, counts)).ToList();
    }

    public async Task<ServiceResult<ClassResponse>> GetClassAsync(string classId, CancellationToken ct)
    {
        var cls = await _db.Classes.AsNoTracking().SingleOrDefaultAsync(c => c.Id == classId, ct);
        if (cls is null)
            return ServiceResult<ClassResponse>.Fail(ErrorKind.NotFound, "CLASS_NOT_FOUND", "Class not found.");

        var counts = await CountActiveHoldsAsync(classId, ct);
        return ServiceResult<ClassResponse>.Ok(ToClassResponse(cls, counts));
    }

    /// <summary>
    /// Held and confirmed seat counts per class. A HELD row whose time is up is not
    /// counted, even if the sweeper has not marked it EXPIRED yet.
    /// </summary>
    private async Task<Dictionary<(string ClassId, HoldStatus Status), int>> CountActiveHoldsAsync(string? classId, CancellationToken ct)
    {
        var now = Now();
        var query = _db.Holds.AsNoTracking()
            .Where(h => h.Status == HoldStatus.Confirmed || (h.Status == HoldStatus.Held && h.ExpiresAt > now));
        if (classId is not null)
            query = query.Where(h => h.ClassId == classId);

        var rows = await query
            .GroupBy(h => new { h.ClassId, h.Status })
            .Select(g => new { g.Key.ClassId, g.Key.Status, Count = g.Count() })
            .ToListAsync(ct);

        return rows.ToDictionary(r => (r.ClassId, r.Status), r => r.Count);
    }

    private static ClassResponse ToClassResponse(SchoolClass c, Dictionary<(string, HoldStatus), int> counts)
    {
        var held = counts.GetValueOrDefault((c.Id, HoldStatus.Held));
        var confirmed = counts.GetValueOrDefault((c.Id, HoldStatus.Confirmed));
        return new ClassResponse(c.Id, c.Name, c.TotalSeats, held, confirmed, Math.Max(0, c.TotalSeats - held - confirmed));
    }

    // ------------------------------------------------------------------ holds

    public async Task<ServiceResult<HoldResponse>> CreateHoldAsync(string classId, string studentId, CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // 1. Lock this class row. Concurrent requests for the same class queue up here.
        var cls = (await _db.Classes
            .FromSqlInterpolated($"SELECT * FROM classes WHERE id = {classId} FOR UPDATE")
            .ToListAsync(ct)).SingleOrDefault();
        if (cls is null)
            return ServiceResult<HoldResponse>.Fail(ErrorKind.NotFound, "CLASS_NOT_FOUND", "Class not found.");

        var now = Now();

        // 2. Release seats whose time ran out, so they can be given to this request.
        await _db.Holds
            .Where(h => h.ClassId == classId && h.Status == HoldStatus.Held && h.ExpiresAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);

        // 3. One active application (or confirmed admission) per student per class.
        var existing = await _db.Holds.AsNoTracking()
            .Where(h => h.ClassId == classId && h.StudentId == studentId
                        && (h.Status == HoldStatus.Held || h.Status == HoldStatus.Confirmed))
            .FirstOrDefaultAsync(ct);
        if (existing is not null)
        {
            return existing.Status == HoldStatus.Confirmed
                ? ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "ALREADY_ADMITTED", "This student is already admitted to this class.")
                : ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "ALREADY_APPLIED", "This student already has an active application for this class.");
        }

        // 4. Seat check. Safe because of the lock taken in step 1.
        var used = await _db.Holds.CountAsync(
            h => h.ClassId == classId && (h.Status == HoldStatus.Held || h.Status == HoldStatus.Confirmed), ct);
        if (used >= cls.TotalSeats)
            return ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "NO_SEATS_AVAILABLE", "Sorry, no seats are available in this class right now.");

        // 5. Reserve the seat.
        var hold = new Hold
        {
            Id = NewId("h"),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.Held,
            CreatedAt = now,
            ExpiresAt = now.AddSeconds(_options.HoldDurationSeconds),
        };
        _db.Holds.Add(hold);

        try
        {
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Unique index caught a duplicate the checks above somehow missed.
            return ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "ALREADY_APPLIED", "This student already has an active application for this class.");
        }

        return ServiceResult<HoldResponse>.Ok(ToHoldResponse(hold, cls.Name, now));
    }

    public async Task<ServiceResult<HoldResponse>> GetHoldAsync(string holdId, CancellationToken ct)
    {
        var hold = await _db.Holds.AsNoTracking().Include(h => h.Class).SingleOrDefaultAsync(h => h.Id == holdId, ct);
        if (hold is null)
            return ServiceResult<HoldResponse>.Fail(ErrorKind.NotFound, "HOLD_NOT_FOUND", "Application not found.");

        return ServiceResult<HoldResponse>.Ok(ToHoldResponse(hold, hold.Class!.Name, Now()));
    }

    public async Task<List<HoldResponse>> ListStudentHoldsAsync(string studentId, CancellationToken ct)
    {
        var now = Now();
        var holds = await _db.Holds.AsNoTracking().Include(h => h.Class)
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(ct);
        return holds.Select(h => ToHoldResponse(h, h.Class!.Name, now)).ToList();
    }

    /// <summary>
    /// Pay the fee. Only the owner can confirm, only before expiry. Confirming an
    /// already confirmed hold again is a no-op that returns success, so the seat
    /// is counted once no matter how many times the button is pressed.
    /// </summary>
    public async Task<ServiceResult<HoldResponse>> ConfirmHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var now = Now();

        // Single atomic UPDATE: succeeds only if the hold is still HELD, still in
        // time and belongs to this student. Races with the expiry sweeper or a
        // cancel are settled by PostgreSQL's row lock.
        var updated = await _db.Holds
            .Where(h => h.Id == holdId && h.StudentId == studentId && h.Status == HoldStatus.Held && h.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s
                .SetProperty(h => h.Status, HoldStatus.Confirmed)
                .SetProperty(h => h.ConfirmedAt, now), ct);

        var hold = await _db.Holds.AsNoTracking().Include(h => h.Class).SingleOrDefaultAsync(h => h.Id == holdId, ct);
        if (hold is null)
            return ServiceResult<HoldResponse>.Fail(ErrorKind.NotFound, "HOLD_NOT_FOUND", "Application not found.");
        if (hold.StudentId != studentId)
            return ServiceResult<HoldResponse>.Fail(ErrorKind.Forbidden, "NOT_YOUR_HOLD", "This application belongs to another student.");

        if (updated == 1 || hold.Status == HoldStatus.Confirmed)
            return ServiceResult<HoldResponse>.Ok(ToHoldResponse(hold, hold.Class!.Name, now));

        return hold.EffectiveStatus(now) switch
        {
            HoldStatus.Expired => ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "HOLD_EXPIRED", "The time to pay has run out. Please apply again if seats are available."),
            HoldStatus.Cancelled => ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "HOLD_CANCELLED", "This application was cancelled."),
            _ => ServiceResult<HoldResponse>.Fail(ErrorKind.Conflict, "HOLD_NOT_CONFIRMABLE", "This application cannot be confirmed."),
        };
    }

    /// <summary>Cancel an application that is still HELD. Cancelling twice is a no-op.</summary>
    public async Task<ServiceResult<bool>> CancelHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var now = Now();

        var updated = await _db.Holds
            .Where(h => h.Id == holdId && h.StudentId == studentId && h.Status == HoldStatus.Held && h.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s
                .SetProperty(h => h.Status, HoldStatus.Cancelled)
                .SetProperty(h => h.CancelledAt, now), ct);
        if (updated == 1)
            return ServiceResult<bool>.Ok(true);

        var hold = await _db.Holds.AsNoTracking().SingleOrDefaultAsync(h => h.Id == holdId, ct);
        if (hold is null)
            return ServiceResult<bool>.Fail(ErrorKind.NotFound, "HOLD_NOT_FOUND", "Application not found.");
        if (hold.StudentId != studentId)
            return ServiceResult<bool>.Fail(ErrorKind.Forbidden, "NOT_YOUR_HOLD", "This application belongs to another student.");

        return hold.EffectiveStatus(now) switch
        {
            HoldStatus.Cancelled => ServiceResult<bool>.Ok(true),
            HoldStatus.Confirmed => ServiceResult<bool>.Fail(ErrorKind.Conflict, "ALREADY_CONFIRMED", "The admission fee is already paid; a confirmed admission cannot be cancelled here."),
            HoldStatus.Expired => ServiceResult<bool>.Fail(ErrorKind.Conflict, "HOLD_EXPIRED", "This application has already expired."),
            _ => ServiceResult<bool>.Fail(ErrorKind.Conflict, "HOLD_NOT_CANCELLABLE", "This application cannot be cancelled."),
        };
    }

    /// <summary>Marks every timed-out HELD row as EXPIRED. Called by the background sweeper.</summary>
    public Task<int> ExpireOverdueHoldsAsync(CancellationToken ct)
    {
        var now = Now();
        return _db.Holds
            .Where(h => h.Status == HoldStatus.Held && h.ExpiresAt <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);
    }

    // ---------------------------------------------------------------- helpers

    private static HoldResponse ToHoldResponse(Hold h, string className, DateTime now) =>
        new(h.Id, h.ClassId, className, h.StudentId, h.EffectiveStatus(now).ToApi(), h.ExpiresAt, h.CreatedAt, h.ConfirmedAt);

    private static string NewId(string prefix) => $"{prefix}_{Guid.NewGuid():N}"[..(prefix.Length + 13)];

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
