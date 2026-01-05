param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$ErrorActionPreference = "Stop"

$schemaPath = Join-Path $PSScriptRoot "schema.sql"
if (!(Test-Path $schemaPath)) {
  throw "schema.sql not found at: $schemaPath. Generate it first (see 03-generate-schema.ps1)."
}

if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql not found in PATH. Install Postgres client tools and try again."
}

Write-Host "Applying schema from $schemaPath ..."

& psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $schemaPath
if ($LASTEXITCODE -ne 0) {
  throw "psql failed with exit code $LASTEXITCODE"
}

Write-Host "Done."


