<#
.SYNOPSIS
  Restaura db/seruna_back.dump en un PostgreSQL 18 local de Windows (alternativa a Docker).
.DESCRIPTION
  Crea una base vacía (template0, UTF8) y ejecuta
  pg_restore --no-owner --no-privileges --exit-on-error (sin -C: el dump trae locale de Windows).
  La contraseña NO se pasa por parámetro: use la variable PGPASSWORD o un archivo pgpass (PGPASSFILE).
.EXAMPLE
  $env:PGPASSWORD = '...'; .\scripts\db-restore.ps1 -DbName seruna_db -Force
#>
param(
    [string]$DbName = 'seruna_db',
    [string]$DbHost = 'localhost',
    [int]$Port = 5432,
    [string]$User = 'postgres',
    [string]$PgBin = $env:PG_BIN,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$dump = Join-Path $raiz 'db\seruna_back.dump'
$verificacion = Join-Path $raiz 'scripts\db\verificar-restauracion.sql'

if ($DbName -notmatch '^[a-z_][a-z0-9_]*$') { throw "Nombre de base inválido: $DbName" }
if (-not (Test-Path $dump)) { throw "No existe $dump" }

if (-not $PgBin) {
    $servicio = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%18%'" | Select-Object -First 1
    if ($servicio -and $servicio.PathName -match '"?([^"]+)\\pg_ctl\.exe') { $PgBin = $Matches[1] }
}
$psql = if ($PgBin) { Join-Path $PgBin 'psql.exe' } else { 'psql' }
$pgRestore = if ($PgBin) { Join-Path $PgBin 'pg_restore.exe' } else { 'pg_restore' }
$conexion = @('-h', $DbHost, '-p', "$Port", '-U', $User, '-w')

function Invoke-Pg([string]$exe, [string[]]$argumentos) {
    & $exe @argumentos
    if ($LASTEXITCODE -ne 0) { throw "$exe terminó con código $LASTEXITCODE" }
}

$existe = & $psql @conexion -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar. Defina PGPASSWORD o PGPASSFILE.' }
if ($existe -eq '1') {
    if (-not $Force) { throw "La base $DbName ya existe. Use -Force para recrearla." }
    Write-Host "==> Eliminando la base existente $DbName"
    Invoke-Pg $psql ($conexion + @('-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', "DROP DATABASE `"$DbName`" WITH (FORCE)"))
}

Write-Host "==> Creando la base vacía $DbName"
Invoke-Pg $psql ($conexion + @('-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', "CREATE DATABASE `"$DbName`" TEMPLATE template0 ENCODING 'UTF8'"))

Write-Host '==> pg_restore --no-owner --no-privileges'
Invoke-Pg $pgRestore ($conexion + @('--no-owner', '--no-privileges', '--exit-on-error', '-d', $DbName, $dump))

Write-Host '==> Verificando'
Invoke-Pg $psql ($conexion + @('-d', $DbName, '-v', 'ON_ERROR_STOP=1', '-f', $verificacion))
Write-Host "==> Restauración de $DbName verificada"
