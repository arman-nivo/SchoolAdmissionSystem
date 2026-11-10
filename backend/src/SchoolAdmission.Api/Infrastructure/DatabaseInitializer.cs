using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.Infrastructure;

public static class DatabaseInitializer
{
    // Any fixed number; all backend instances use the same one.
    private const long MigrationLockKey = 72_2026_1108;

    /// <summary>
    /// Creates/updates the tables on startup (EF Core migrations).
    /// - Retries while PostgreSQL is still starting (common with docker compose).
    /// - Takes a PostgreSQL advisory lock so two backend instances starting at
    ///   the same time do not both try to run the same migration.
    /// </summary>
    public static async Task MigrateAsync(IServiceProvider services, ILogger logger, int maxAttempts = 30)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var scope = services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AdmissionDbContext>();

                // Create the empty database itself if it does not exist yet
                // (docker compose creates it via POSTGRES_DB; local runs may not).
                var creator = db.GetService<IRelationalDatabaseCreator>();
                if (!await creator.ExistsAsync())
                    await creator.CreateAsync();

                await db.Database.OpenConnectionAsync();
                try
                {
                    await db.Database.ExecuteSqlRawAsync($"SELECT pg_advisory_lock({MigrationLockKey})");
                    await db.Database.MigrateAsync();
                    await db.Database.ExecuteSqlRawAsync($"SELECT pg_advisory_unlock({MigrationLockKey})");
                }
                finally
                {
                    await db.Database.CloseConnectionAsync();
                }
                logger.LogInformation("Database is ready");
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                logger.LogWarning("Database not ready (attempt {Attempt}/{Max}): {Message}", attempt, maxAttempts, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }
    }
}
