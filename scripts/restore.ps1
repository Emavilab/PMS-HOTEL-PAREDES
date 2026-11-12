[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$DatabaseUrl,
    [string]$BackendPath = (Join-Path $PSScriptRoot "..\backend"),
    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmRestore) {
    throw "La restauración reemplaza datos. Ejecuta nuevamente con -ConfirmRestore."
}

$resolvedBackupFile = (Resolve-Path $BackupFile).Path
$resolvedBackendPath = (Resolve-Path $BackendPath).Path
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

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if ($null -eq $pgRestore) {
    throw "No se encontró pg_restore. Instala PostgreSQL o agrega su carpeta bin al PATH."
}

$tempPath = Join-Path ([IO.Path]::GetTempPath()) "hotel_paredes_restore_$([Guid]::NewGuid().ToString("N"))"
$uploadsPath = Join-Path $resolvedBackendPath "uploads"

try {
    New-Item -ItemType Directory -Force -Path $tempPath | Out-Null
    Expand-Archive -Path $resolvedBackupFile -DestinationPath $tempPath

    $databaseDump = Join-Path $tempPath "database.dump"
    $uploadsArchive = Join-Path $tempPath "uploads.zip"
    if (-not (Test-Path $databaseDump) -or -not (Test-Path $uploadsArchive)) {
        throw "El archivo no contiene database.dump y uploads.zip."
    }

    & $pgRestore.Source --dbname=$DatabaseUrl --clean --if-exists --no-owner --no-acl $databaseDump
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore terminó con código $LASTEXITCODE."
    }

    $uploadsBackupPath = Join-Path $tempPath "uploads_restore"
    Expand-Archive -Path $uploadsArchive -DestinationPath $uploadsBackupPath
    if (Test-Path $uploadsPath) {
        Remove-Item -Path $uploadsPath -Recurse -Force
    }
    Move-Item -Path (Join-Path $uploadsBackupPath "uploads") -Destination $uploadsPath
    Write-Output "Restauración completada desde: $resolvedBackupFile"
}
finally {
    if (Test-Path $tempPath) {
        Remove-Item -Path $tempPath -Recurse -Force
    }
}
