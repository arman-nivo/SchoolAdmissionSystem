namespace SchoolAdmission.Api.Domain;

/// <summary>
/// One admission "class". Every shift is its own class with its own seats,
/// e.g. "Class 6 - Morning Shift" and "Class 6 - Day Shift" are two classes.
/// </summary>
public class SchoolClass
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public int TotalSeats { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<Hold> Holds { get; set; } = new();
}
