using System.ComponentModel.DataAnnotations;

namespace SchoolAdmission.Api.Contracts;

public record CreateClassRequest
{
    [Required(ErrorMessage = "Class name is required.")]
    [MaxLength(200, ErrorMessage = "Class name can be at most 200 characters.")]
    public string? Name { get; init; }

    [Required(ErrorMessage = "totalSeats is required.")]
    [Range(1, 100000, ErrorMessage = "totalSeats must be between 1 and 100000.")]
    public int? TotalSeats { get; init; }
}

public record ClassResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);

/// <summary>
/// One shape for every hold endpoint. The spec lists a subset of these fields per
/// endpoint; extra fields are allowed, missing/renamed ones are not.
/// </summary>
public record HoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string StudentId,
    string Status,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    DateTime? ConfirmedAt);

/// <summary>Body of every non-2xx response: a machine code and a human message.</summary>
public record ErrorResponse(string Error, string Message, IDictionary<string, string[]>? Details = null);
