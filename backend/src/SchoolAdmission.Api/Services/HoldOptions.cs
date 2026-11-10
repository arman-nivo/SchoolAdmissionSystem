namespace SchoolAdmission.Api.Services;

public class HoldOptions
{
    /// <summary>How long a seat stays reserved. Env: HOLD_DURATION_SECONDS (default 600).</summary>
    public int HoldDurationSeconds { get; set; } = 600;

    /// <summary>How often the background sweeper marks timed-out holds as EXPIRED. Env: EXPIRY_SWEEP_SECONDS.</summary>
    public int SweepIntervalSeconds { get; set; } = 5;
}
