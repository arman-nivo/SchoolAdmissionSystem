namespace SchoolAdmission.Api.Domain;

public enum HoldStatus
{
    Held,
    Confirmed,
    Expired,
    Cancelled
}

public static class HoldStatusExtensions
{
    /// <summary>API and database spelling: HELD, CONFIRMED, EXPIRED, CANCELLED.</summary>
    public static string ToApi(this HoldStatus status) => status.ToString().ToUpperInvariant();

    public static HoldStatus FromApi(string value) => Enum.Parse<HoldStatus>(value, ignoreCase: true);
}
