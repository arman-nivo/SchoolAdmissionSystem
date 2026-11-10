using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Infrastructure;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------------------------------------------------------------- settings
// Environment variables override appsettings.json:
//   ConnectionStrings__Default  -> database connection
//   HOLD_DURATION_SECONDS       -> seat hold time (default 600)
//   CORS_ORIGINS                -> comma separated frontend origins (default: any)
var connectionString = config.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is missing. Set ConnectionStrings__Default.");

builder.Services.Configure<HoldOptions>(o =>
{
    o.HoldDurationSeconds = config.GetValue("HOLD_DURATION_SECONDS", 600);
    o.SweepIntervalSeconds = config.GetValue("EXPIRY_SWEEP_SECONDS", 5);
});

// ---------------------------------------------------------------- services (dependency injection)
builder.Services.AddDbContext<AdmissionDbContext>(o => o.UseNpgsql(connectionString));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<AdmissionService>();
builder.Services.AddHostedService<HoldExpiryWorker>();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)
    .ConfigureApiBehaviorOptions(o =>
    {
        // Invalid / missing JSON fields -> 400 with our own simple error shape.
        o.InvalidModelStateResponseFactory = ctx =>
        {
            // Body is not JSON at all (or a field has the wrong type).
            if (ctx.ModelState.Keys.Any(k => k.StartsWith('$')))
                return new BadRequestObjectResult(new ErrorResponse("INVALID_JSON",
                    "The request body is not valid JSON, or a field has the wrong type."));

            var details = ctx.ModelState
                .Where(kv => kv.Value?.Errors.Count > 0)
                .ToDictionary(
                    kv => string.IsNullOrEmpty(kv.Key) ? "body" : JsonNamingPolicy.CamelCase.ConvertName(kv.Key),
                    kv => kv.Value!.Errors.Select(e => string.IsNullOrEmpty(e.ErrorMessage) ? "Invalid value." : e.ErrorMessage).ToArray());
            var first = details.Values.SelectMany(v => v).FirstOrDefault() ?? "Invalid request.";
            return new BadRequestObjectResult(new ErrorResponse("VALIDATION_ERROR", first, details));
        };
    });

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    var origins = config["CORS_ORIGINS"]?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (origins is { Length: > 0 }) p.WithOrigins(origins); else p.AllowAnyOrigin();
    p.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Server-Time");
}));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ---------------------------------------------------------------- HTTP pipeline (middleware, in order)
app.UseExceptionHandler(errorApp => errorApp.Run(async ctx =>
{
    // Any unexpected crash becomes JSON, never an HTML error page.
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    var dbDown = ex is Npgsql.NpgsqlException or TimeoutException || ex?.InnerException is Npgsql.NpgsqlException;
    ctx.Response.StatusCode = dbDown ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status500InternalServerError;
    await ctx.Response.WriteAsJsonAsync(dbDown
        ? new ErrorResponse("SERVICE_UNAVAILABLE", "The server cannot reach the database right now. Please try again shortly.")
        : new ErrorResponse("INTERNAL_ERROR", "Something went wrong on the server. Please try again."));
}));

// Lets the UI correct for a wrong clock on the user's computer when showing the countdown.
app.Use(async (ctx, next) =>
{
    ctx.Response.OnStarting(() =>
    {
        ctx.Response.Headers["X-Server-Time"] = DateTime.UtcNow.ToString("O");
        return Task.CompletedTask;
    });
    await next();
});

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).ExcludeFromDescription();

await DatabaseInitializer.MigrateAsync(app.Services, app.Logger);

app.Run();

// Makes Program visible to the test project (WebApplicationFactory<Program>).
public partial class Program { }
