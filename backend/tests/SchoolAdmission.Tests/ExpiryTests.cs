using System.Net;
using System.Net.Http.Json;

namespace SchoolAdmission.Tests;

/// <summary>Runs the backend with HOLD_DURATION_SECONDS = 2 so expiry can be observed quickly.</summary>
public class ExpiryTests : IDisposable
{
    private readonly ApiFactory _factory = new(holdSeconds: 2);
    private readonly HttpClient _http;

    public ExpiryTests() => _http = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Hold_expires_by_itself_and_the_seat_returns_without_any_api_call()
    {
        var cls = await _http.CreateClassAsync(1);
        var student = ApiClient.Student(1);
        var hold = await (await _http.HoldAsync(cls.Id, student)).ReadAsync<HoldDto>();
        Assert.Equal(0, (await _http.GetClassAsync(cls.Id)).AvailableSeats);

        await Task.Delay(TimeSpan.FromSeconds(4));

        var after = await _http.GetFromJsonAsync<HoldDto>($"/holds/{hold.HoldId}", ApiClient.Json);
        Assert.Equal("EXPIRED", after!.Status);
        Assert.Equal(1, (await _http.GetClassAsync(cls.Id)).AvailableSeats);

        // Paying after the deadline is refused...
        var confirm = await _http.ConfirmAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);
        Assert.Equal("HOLD_EXPIRED", (await confirm.ReadAsync<ErrorDto>()).Error);

        // ...and someone else can now take the seat.
        Assert.Equal(HttpStatusCode.Created, (await _http.HoldAsync(cls.Id, ApiClient.Student(2))).StatusCode);
    }
}
