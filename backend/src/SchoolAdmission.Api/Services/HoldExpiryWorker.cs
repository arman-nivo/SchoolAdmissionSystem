using Microsoft.Extensions.Options;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Background job that runs inside the backend every few seconds and marks
/// timed-out HELD applications as EXPIRED. Nobody has to call an API for a seat
/// to come back. (Reads also treat a timed-out hold as expired straight away,
/// so the API is correct even between two sweeps.)
/// </summary>
public class HoldExpiryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<HoldExpiryWorker> _log;
    private readonly TimeSpan _interval;

    public HoldExpiryWorker(IServiceScopeFactory scopes, IOptions<HoldOptions> options, ILogger<HoldExpiryWorker> log)
    {
        _scopes = scopes;
        _log = log;
        _interval = TimeSpan.FromSeconds(Math.Max(1, options.Value.SweepIntervalSeconds));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                // DbContext is "scoped" (one per request), so a long-running service makes its own scope.
                using var scope = _scopes.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<AdmissionService>();
                var expired = await service.ExpireOverdueHoldsAsync(stoppingToken);
                if (expired > 0)
                    _log.LogInformation("Expired {Count} overdue hold(s)", expired);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Database down for a moment? Log and try again next tick.
                _log.LogWarning(ex, "Hold expiry sweep failed");
            }
        }
    }
}
