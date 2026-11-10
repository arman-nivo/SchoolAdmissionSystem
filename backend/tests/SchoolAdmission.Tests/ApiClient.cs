using System.Net.Http.Json;
using System.Text.Json;

namespace SchoolAdmission.Tests;

public record ClassDto(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);
public record HoldDto(string HoldId, string ClassId, string ClassName, string StudentId, string Status, DateTime ExpiresAt);
public record ErrorDto(string Error, string Message);

/// <summary>Small helpers so tests read like the API spec.</summary>
public static class ApiClient
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>A valid 17-digit birth registration number, unique per n.</summary>
    public static string Student(int n) => $"2015{n:D13}";

    public static async Task<ClassDto> CreateClassAsync(this HttpClient http, int seats, string? name = null)
    {
        var res = await http.PostAsJsonAsync("/classes", new { name = name ?? $"Class {Guid.NewGuid():N}", totalSeats = seats });
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ClassDto>(Json))!;
    }

    public static Task<HttpResponseMessage> HoldAsync(this HttpClient http, string classId, string studentId) =>
        Send(http, HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    public static Task<HttpResponseMessage> ConfirmAsync(this HttpClient http, string holdId, string studentId) =>
        Send(http, HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    public static Task<HttpResponseMessage> CancelAsync(this HttpClient http, string holdId, string studentId) =>
        Send(http, HttpMethod.Delete, $"/holds/{holdId}", studentId);

    public static async Task<ClassDto> GetClassAsync(this HttpClient http, string classId) =>
        (await http.GetFromJsonAsync<ClassDto>($"/classes/{classId}", Json))!;

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage res) =>
        (await res.Content.ReadFromJsonAsync<T>(Json))!;

    private static Task<HttpResponseMessage> Send(HttpClient http, HttpMethod method, string url, string? studentId)
    {
        var req = new HttpRequestMessage(method, url);
        if (studentId is not null) req.Headers.Add("X-Student-Id", studentId);
        return http.SendAsync(req);
    }
}
