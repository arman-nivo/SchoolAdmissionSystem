using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

public class HoldsController : ApiControllerBase
{
    private readonly AdmissionService _service;

    public HoldsController(AdmissionService service) => _service = service;

    /// <summary>5. GET /holds/{holdId} — current state of one application.</summary>
    [HttpGet("holds/{holdId}")]
    [ProducesResponseType(typeof(HoldResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(string holdId, CancellationToken ct)
    {
        var result = await _service.GetHoldAsync(holdId, ct);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error!);
    }

    /// <summary>6. POST /holds/{holdId}/confirm — pay the fee, admission confirmed.</summary>
    [HttpPost("holds/{holdId}/confirm")]
    [ProducesResponseType(typeof(HoldResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Confirm(string holdId, CancellationToken ct)
    {
        if (!StudentIdHeader.TryRead(Request, out var studentId, out var error)) return error!;

        var result = await _service.ConfirmHoldAsync(holdId, studentId, ct);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error!);
    }

    /// <summary>7. DELETE /holds/{holdId} — cancel the application. 204 on success.</summary>
    [HttpDelete("holds/{holdId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(string holdId, CancellationToken ct)
    {
        if (!StudentIdHeader.TryRead(Request, out var studentId, out var error)) return error!;

        var result = await _service.CancelHoldAsync(holdId, studentId, ct);
        return result.IsSuccess ? NoContent() : Problem(result.Error!);
    }

    /// <summary>8. GET /me/holds — every application of the student in X-Student-Id.</summary>
    [HttpGet("me/holds")]
    [ProducesResponseType(typeof(List<HoldResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        if (!StudentIdHeader.TryRead(Request, out var studentId, out var error)) return error!;
        return Ok(await _service.ListStudentHoldsAsync(studentId, ct));
    }
}
