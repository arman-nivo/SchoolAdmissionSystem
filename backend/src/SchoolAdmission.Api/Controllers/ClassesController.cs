using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[Route("classes")]
public class ClassesController : ApiControllerBase
{
    private readonly AdmissionService _service;

    public ClassesController(AdmissionService service) => _service = service;

    /// <summary>1. POST /classes — create a class (admin).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ClassResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateClassRequest request, CancellationToken ct)
    {
        var result = await _service.CreateClassAsync(request, ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(Get), new { classId = result.Value!.Id }, result.Value)
            : Problem(result.Error!);
    }

    /// <summary>2. GET /classes — all classes with seat counts.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ClassResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _service.ListClassesAsync(ct));

    /// <summary>3. GET /classes/{classId} — seat counts for one class.</summary>
    [HttpGet("{classId}")]
    [ProducesResponseType(typeof(ClassResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(string classId, CancellationToken ct)
    {
        var result = await _service.GetClassAsync(classId, ct);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error!);
    }

    /// <summary>4. POST /classes/{classId}/holds — apply (reserve a seat). 409 if no seat.</summary>
    [HttpPost("{classId}/holds")]
    [ProducesResponseType(typeof(HoldResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateHold(string classId, CancellationToken ct)
    {
        if (!StudentIdHeader.TryRead(Request, out var studentId, out var error)) return error!;

        var result = await _service.CreateHoldAsync(classId, studentId, ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(HoldsController.Get), "Holds", new { holdId = result.Value!.HoldId }, result.Value)
            : Problem(result.Error!);
    }
}
