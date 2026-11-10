using System.Net;
using System.Net.Http.Json;

namespace SchoolAdmission.Tests;

public class AdmissionRulesTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _http;

    public AdmissionRulesTests() => _http = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Create_class_returns_201_and_it_appears_in_the_list_with_seat_counts()
    {
        var res = await _http.PostAsJsonAsync("/classes", new { name = "Class 6 - Morning Shift", totalSeats = 120 });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var created = await res.ReadAsync<ClassDto>();
        Assert.StartsWith("c_", created.Id);
        Assert.Equal("Class 6 - Morning Shift", created.Name);
        Assert.Equal(120, created.TotalSeats);

        var list = await _http.GetFromJsonAsync<List<ClassDto>>("/classes", ApiClient.Json);
        var row = Assert.Single(list!);
        Assert.Equal((120, 0, 0, 120), (row.TotalSeats, row.HeldSeats, row.ConfirmedSeats, row.AvailableSeats));
    }

    [Theory]
    [InlineData("", 10)]
    [InlineData("Class 7", 0)]
    [InlineData("Class 7", -5)]
    public async Task Invalid_class_input_returns_400(string name, int seats)
    {
        var res = await _http.PostAsJsonAsync("/classes", new { name, totalSeats = seats });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Hold_then_confirm_moves_the_seat_from_held_to_confirmed()
    {
        var cls = await _http.CreateClassAsync(3);
        var student = ApiClient.Student(1);

        var holdRes = await _http.HoldAsync(cls.Id, student);
        Assert.Equal(HttpStatusCode.Created, holdRes.StatusCode);
        var hold = await holdRes.ReadAsync<HoldDto>();
        Assert.Equal("HELD", hold.Status);
        Assert.Equal(student, hold.StudentId);
        Assert.True(hold.ExpiresAt > DateTime.UtcNow.AddSeconds(590));

        Assert.Equal((1, 0, 2), Counts(await _http.GetClassAsync(cls.Id)));

        var confirm = await _http.ConfirmAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        Assert.Equal("CONFIRMED", (await confirm.ReadAsync<HoldDto>()).Status);

        Assert.Equal((0, 1, 2), Counts(await _http.GetClassAsync(cls.Id)));
    }

    [Fact]
    public async Task Full_class_returns_409()
    {
        var cls = await _http.CreateClassAsync(1);
        Assert.Equal(HttpStatusCode.Created, (await _http.HoldAsync(cls.Id, ApiClient.Student(1))).StatusCode);

        var res = await _http.HoldAsync(cls.Id, ApiClient.Student(2));
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal("NO_SEATS_AVAILABLE", (await res.ReadAsync<ErrorDto>()).Error);
    }

    [Fact]
    public async Task Student_cannot_hold_twice_in_the_same_class_but_can_in_another()
    {
        var a = await _http.CreateClassAsync(5);
        var b = await _http.CreateClassAsync(5);
        var student = ApiClient.Student(1);

        Assert.Equal(HttpStatusCode.Created, (await _http.HoldAsync(a.Id, student)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await _http.HoldAsync(a.Id, student)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await _http.HoldAsync(b.Id, student)).StatusCode);
    }

    [Fact]
    public async Task Only_the_owner_can_confirm_or_cancel()
    {
        var cls = await _http.CreateClassAsync(2);
        var hold = await (await _http.HoldAsync(cls.Id, ApiClient.Student(1))).ReadAsync<HoldDto>();

        Assert.Equal(HttpStatusCode.Forbidden, (await _http.ConfirmAsync(hold.HoldId, ApiClient.Student(2))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _http.CancelAsync(hold.HoldId, ApiClient.Student(2))).StatusCode);
        Assert.Equal(1, (await _http.GetClassAsync(cls.Id)).HeldSeats);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("123")]
    [InlineData("1234567890123456A")]
    [InlineData("123456789012345678")]
    public async Task Missing_or_malformed_student_id_returns_400(string? studentId)
    {
        var cls = await _http.CreateClassAsync(2);
        var req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{cls.Id}/holds");
        if (studentId is not null) req.Headers.Add("X-Student-Id", studentId);

        var res = await _http.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Cancel_returns_204_frees_the_seat_and_lets_the_student_apply_again()
    {
        var cls = await _http.CreateClassAsync(1);
        var student = ApiClient.Student(1);
        var hold = await (await _http.HoldAsync(cls.Id, student)).ReadAsync<HoldDto>();

        var res = await _http.CancelAsync(hold.HoldId, student);
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        var after = await _http.GetFromJsonAsync<HoldDto>($"/holds/{hold.HoldId}", ApiClient.Json);
        Assert.Equal("CANCELLED", after!.Status);
        Assert.Equal(1, (await _http.GetClassAsync(cls.Id)).AvailableSeats);
        Assert.Equal(HttpStatusCode.Created, (await _http.HoldAsync(cls.Id, student)).StatusCode);
    }

    [Fact]
    public async Task Me_holds_lists_only_this_students_applications_with_class_name()
    {
        var cls = await _http.CreateClassAsync(5, name: "Class 6 - Day Shift");
        await _http.HoldAsync(cls.Id, ApiClient.Student(1));
        await _http.HoldAsync(cls.Id, ApiClient.Student(2));

        var req = new HttpRequestMessage(HttpMethod.Get, "/me/holds");
        req.Headers.Add("X-Student-Id", ApiClient.Student(1));
        var mine = await (await _http.SendAsync(req)).ReadAsync<List<HoldDto>>();

        var only = Assert.Single(mine);
        Assert.Equal("Class 6 - Day Shift", only.ClassName);
        Assert.Equal(ApiClient.Student(1), only.StudentId);
    }

    [Fact]
    public async Task Unknown_ids_return_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _http.GetAsync("/classes/c_missing")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.GetAsync("/holds/h_missing")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _http.HoldAsync("c_missing", ApiClient.Student(1))).StatusCode);
    }

    private static (int Held, int Confirmed, int Available) Counts(ClassDto c) => (c.HeldSeats, c.ConfirmedSeats, c.AvailableSeats);
}
