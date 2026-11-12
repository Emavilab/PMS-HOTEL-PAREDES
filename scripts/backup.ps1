[CmdletBinding()]
param(
    [string]$DatabaseUrl,
    [string]$BackendPath = (Join-Path $PSScriptRoot "..\backend"),
    [string]$BackupPath = (Join-Path $PSScriptRoot "..\backups"),
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if ($RetentionDays -lt 1) {
    throw "RetentionDays debe ser mayor que cero."
}

$resolvedBackendPath = (Resolve-Path $BackendPath).Path
$resolvedBackupPath = [IO.Path]::GetFullPath($BackupPath)
$envFile = Join-Path $resolvedBackendPath ".env"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    if (-not (Test-Path $envFile)) {
        throw "No se encontró $envFile y no se proporcionó -DatabaseUrl."
    }

    $databaseLine = Get-Content $envFile |
        Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } |
        Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($databaseLine)) {
        throw "DATABASE_URL no está configurada en $envFile."
    }

    $DatabaseUrl = ($databaseLine -replace "^\s*DATABASE_URL\s*=\s*", "").Trim()
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl) -or $DatabaseUrl -match "^\*+$") {
    throw "DATABASE_URL no contiene una conexión válida."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($null -eq $pgDump) {
    throw "No se encontró pg_dump. Instala PostgreSQL o agrega su carpeta bin al PATH."
}

$uploadsPath = Join-Path $resolvedBackendPath "uploads"
if (-not (Test-Path $uploadsPath)) {
    throw "No se encontró la carpeta de archivos: $uploadsPath"
}

New-Item -ItemType Directory -Force -Path $resolvedBackupPath | Out-Null
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$stagingPath = Join-Path $resolvedBackupPath ".staging_$timestamp"
$databaseDump = Join-Path $stagingPath "database.dump"
$uploadsArchive = Join-Path $stagingPath "uploads.zip"
$manifestPath = Join-Path $stagingPath "manifest.txt"
$finalArchive = Join-Path $resolvedBackupPath "hotel_paredes_$timestamp.zip"

try {
    New-Item -ItemType Directory -Force -Path $stagingPath | Out-Null
    & $pgDump.Source --dbname=$DatabaseUrl --format=custom --file=$databaseDump --no-owner --no-acl
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump terminó con código $LASTEXITCODE."
    }

    Compress-Archive -Path $uploadsPath -DestinationPath $uploadsArchive -CompressionLevel Optimal
    @(
        "CreatedAt=$([DateTime]::UtcNow.ToString("o"))"
        "DatabaseDump=database.dump"
        "UploadsArchive=uploads.zip"
    ) | Set-Content -Path $manifestPath -Encoding utf8

    Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $finalArchive -CompressionLevel Optimal
    Write-Output "Respaldo creado: $finalArchive"
}
finally {
    if (Test-Path $stagingPath) {
        Remove-Item -Path $stagingPath -Recurse -Force
    }
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $resolvedBackupPath -Filter "hotel_paredes_*.zip" -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force

Write-Output "Respaldos conservados: $((Get-ChildItem -Path $resolvedBackupPath -Filter "hotel_paredes_*.zip" -File).Count)"
