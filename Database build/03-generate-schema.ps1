param(
  # Optional: override the Prisma schema path (defaults to repo's backend schema)
  [string]$PrismaSchemaPath = (Join-Path $PSScriptRoot "..\backend\prisma\schema.prisma")
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $PrismaSchemaPath)) {
  throw "Prisma schema not found at: $PrismaSchemaPath"
}

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node not found in PATH. Install Node.js to regenerate schema.sql."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $repoRoot "backend"
if (!(Test-Path $backendDir)) {
  throw "backend directory not found at: $backendDir"
}

# Prisma will try to read DATABASE_URL from the schema datasource.
# For this diff we don't need a live DB connection, but Prisma still expects the env var to exist.
if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://healthcheck:healthcheck_dev@localhost:5432/healthcheck?schema=public"
}

$outputPath = Join-Path $PSScriptRoot "schema.sql"

Write-Host "Generating schema.sql from $PrismaSchemaPath ..."

Push-Location $backendDir
try {
  # Output as ASCII to avoid PowerShell 5.1 UTF-16 redirection issues with psql.
  & npx prisma migrate diff --from-empty --to-schema-datamodel $PrismaSchemaPath --script |
    Out-File -FilePath $outputPath -Encoding ascii

  if ($LASTEXITCODE -ne 0) {
    throw "prisma migrate diff failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

Write-Host "Wrote: $outputPath"


