namespace SchoolAdmission.Api.Domain;

/// <summary>
/// An application. Applying reserves ("holds") one seat for a limited time.
/// Paying the admission fee inside that time confirms it; otherwise it expires
/// and the seat goes back to the pool.
/// </summary>
public class Hold
{
    public string Id { get; set; } = default!;
    public string ClassId { get; set; } = default!;
    public SchoolClass? Class { get; set; }

    /// <summary>17-digit birth registration number sent in the X-Student-Id header.</summary>
    public string StudentId { get; set; } = default!;

    public HoldStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    /// <summary>
    /// The status as of <paramref name="now"/>. A HELD row whose time is up is
    /// reported as EXPIRED even if the background sweeper has not updated it yet.
    /// </summary>
    public HoldStatus EffectiveStatus(DateTime now) =>
        Status == HoldStatus.Held && ExpiresAt <= now ? HoldStatus.Expired : Status;
}
