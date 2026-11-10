# ---------- 1. build: compile the API with the full .NET SDK ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files first and restore packages; this layer is cached
# until a .csproj changes, which makes rebuilds much faster.
COPY SchoolAdmission.sln ./
COPY src/SchoolAdmission.Api/SchoolAdmission.Api.csproj src/SchoolAdmission.Api/
COPY tests/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj tests/SchoolAdmission.Tests/
RUN dotnet restore

COPY . .
RUN dotnet publish src/SchoolAdmission.Api -c Release -o /app/publish --no-restore

# ---------- 2. test: used by `docker compose --profile test run backend-tests` ----------
FROM build AS test
ENTRYPOINT ["dotnet", "test", "tests/SchoolAdmission.Tests", "--no-restore", "--logger", "console;verbosity=normal"]

# ---------- 3. runtime: small image with only the ASP.NET runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
