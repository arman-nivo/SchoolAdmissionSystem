namespace SchoolAdmission.Api.Services;

/// <summary>Why an operation failed. Controllers map each kind to an HTTP status.</summary>
public enum ErrorKind
{
    NotFound,      // 404
    Forbidden,     // 403
    Conflict,      // 409
}

public record ServiceError(ErrorKind Kind, string Code, string Message);

/// <summary>Either a value or an error. Avoids using exceptions for normal business outcomes.</summary>
public class ServiceResult<T>
{
    public T? Value { get; }
    public ServiceError? Error { get; }
    public bool IsSuccess => Error is null;

    private ServiceResult(T? value, ServiceError? error) { Value = value; Error = error; }

    public static ServiceResult<T> Ok(T value) => new(value, null);
    public static ServiceResult<T> Fail(ErrorKind kind, string code, string message) => new(default, new ServiceError(kind, code, message));
}
