using System.Net;
using Npgsql;

namespace SchoolAdmission.Tests;

/// <summary>
/// The rule that matters most: no matter how many requests arrive at once,
/// held + confirmed must never exceed totalSeats.
/// </summary>
public class ConcurrencyTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _http;

    public ConcurrencyTests() => _http = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Many_students_applying_at_the_same_time_never_overbook_a_class()
    {
        const int seats = 10;
        const int students = 150;
        var cls = await _http.CreateClassAsync(seats);

        // Fire all requests together; the barrier releases them at the same moment.
        using var gate = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(1, students).Select(async i =>
        {
            await gate.WaitAsync();
            return await _http.HoldAsync(cls.Id, ApiClient.Student(i));
        }).ToList();
        gate.Release(students);
        var responses = await Task.WhenAll(tasks);

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(students - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var after = await _http.GetClassAsync(cls.Id);
        Assert.Equal(seats, after.HeldSeats);
        Assert.Equal(0, after.AvailableSeats);

        // Double-check straight in the database, not only through the API.
        Assert.Equal(seats, await CountActiveRowsAsync(_factory.ConnectionString, cls.Id));
    }

    [Fact]
    public async Task Same_student_sending_many_requests_at_once_gets_only_one_hold()
    {
        var cls = await _http.CreateClassAsync(50);
        var student = ApiClient.Student(1);

        using var gate = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(0, 30).Select(async _ =>
        {
            await gate.WaitAsync();
            return await _http.HoldAsync(cls.Id, student);
        }).ToList();
        gate.Release(30);
        var responses = await Task.WhenAll(tasks);

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(1, (await _http.GetClassAsync(cls.Id)).HeldSeats);
    }

    [Fact]
    public async Task Confirming_the_same_hold_many_times_at_once_counts_one_seat()
    {
        var cls = await _http.CreateClassAsync(5);
        var student = ApiClient.Student(7);
        var hold = await (await _http.HoldAsync(cls.Id, student)).ReadAsync<HoldDto>();

        var responses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => _http.ConfirmAsync(hold.HoldId, student)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var after = await _http.GetClassAsync(cls.Id);
        Assert.Equal(1, after.ConfirmedSeats);
        Assert.Equal(0, after.HeldSeats);
    }

    /// <summary>
    /// Bonus: two separate backend instances (as if on two ports) sharing one
    /// database still cannot overbook, because the lock is held by PostgreSQL.
    /// </summary>
    [Fact]
    public async Task Two_backend_instances_on_one_database_never_overbook()
    {
        using var second = new ApiFactory(sharedDatabase: _factory.DatabaseName);
        var http2 = second.CreateClient();

        const int seats = 8;
        var cls = await _http.CreateClassAsync(seats);

        using var gate = new SemaphoreSlim(0);
        var tasks = Enumerable.Range(1, 100).Select(async i =>
        {
            await gate.WaitAsync();
            var client = i % 2 == 0 ? _http : http2;
            return await client.HoldAsync(cls.Id, ApiClient.Student(i));
        }).ToList();
        gate.Release(100);
        var responses = await Task.WhenAll(tasks);

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(seats, await CountActiveRowsAsync(_factory.ConnectionString, cls.Id));
    }

    private static async Task<long> CountActiveRowsAsync(string connectionString, string classId)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT COUNT(*) FROM holds WHERE class_id = @id AND status IN ('HELD','CONFIRMED')", conn);
        cmd.Parameters.AddWithValue("id", classId);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }
}
