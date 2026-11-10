using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>Turns a service error into the matching HTTP status + JSON body.</summary>
    protected IActionResult Problem(ServiceError error)
    {
        var body = new ErrorResponse(error.Code, error.Message);
        return error.Kind switch
        {
            ErrorKind.NotFound => NotFound(body),
            ErrorKind.Forbidden => StatusCode(StatusCodes.Status403Forbidden, body),
            ErrorKind.Conflict => Conflict(body),
            _ => StatusCode(StatusCodes.Status500InternalServerError, body),
        };
    }
}
