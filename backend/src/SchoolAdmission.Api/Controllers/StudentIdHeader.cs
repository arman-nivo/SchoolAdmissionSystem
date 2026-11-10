using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Contracts;

namespace SchoolAdmission.Api.Controllers;

/// <summary>
/// There is no login. The student is identified by the X-Student-Id header,
/// which must be a 17-digit birth registration number.
/// </summary>
public static partial class StudentIdHeader
{
    public const string Name = "X-Student-Id";

    [GeneratedRegex("^[0-9]{17}$")]
    private static partial Regex SeventeenDigits();

    public static bool TryRead(HttpRequest request, out string studentId, out IActionResult? error)
    {
        studentId = request.Headers[Name].ToString().Trim();
        if (string.IsNullOrEmpty(studentId))
        {
            error = new BadRequestObjectResult(new ErrorResponse("STUDENT_ID_REQUIRED",
                "Please enter the student's birth registration number."));
            return false;
        }
        if (!SeventeenDigits().IsMatch(studentId))
        {
            error = new BadRequestObjectResult(new ErrorResponse("INVALID_STUDENT_ID",
                "Birth registration number must be exactly 17 digits."));
            return false;
        }
        error = null;
        return true;
    }
}
