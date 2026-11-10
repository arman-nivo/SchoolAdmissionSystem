using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace SchoolAdmission.Tests;

/// <summary>
/// Starts the real backend in memory, pointed at a real PostgreSQL database.
/// Each factory gets its own fresh database (unless one is passed in, which lets
/// two "backend instances" share a database for the multi-process test).
///
/// PostgreSQL location: env TEST_DB_CONNECTION
/// (default Host=localhost;Port=5432;Username=postgres;Password=postgres).
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    public static string BaseConnection =>
        Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
        ?? "Host=localhost;Port=5432;Username=postgres;Password=postgres";

    public string DatabaseName { get; }
    private readonly int _holdSeconds;
    private readonly bool _ownsDatabase;

    public ApiFactory(int holdSeconds = 600, string? sharedDatabase = null)
    {
        _holdSeconds = holdSeconds;
        _ownsDatabase = sharedDatabase is null;
        DatabaseName = sharedDatabase ?? $"admission_test_{Guid.NewGuid():N}";
    }

    public string ConnectionString => new NpgsqlConnectionStringBuilder(BaseConnection)
    {
        Database = DatabaseName,
        MaxPoolSize = 40, // extra requests wait for a free connection instead of failing
    }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        builder.UseSetting("HOLD_DURATION_SECONDS", _holdSeconds.ToString());
        builder.UseSetting("EXPIRY_SWEEP_SECONDS", "1");
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && _ownsDatabase) DropDatabase(DatabaseName);
    }

    public static void DropDatabase(string name)
    {
        try
        {
            NpgsqlConnection.ClearAllPools();
            using var conn = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(BaseConnection) { Database = "postgres" }.ConnectionString);
            conn.Open();
            using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", conn);
            cmd.ExecuteNonQuery();
        }
        catch
        {
            // Cleanup is best effort; a leftover test database does no harm.
        }
    }
}
