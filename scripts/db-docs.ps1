<#
.SYNOPSIS
  Regenera docs/db a partir del catálogo real de la base (PostgreSQL local de Windows).
.DESCRIPTION
  1) Exporta el catálogo con scripts/db/catalogo.sql a docs/db/catalogo.json
  2) Ejecuta node scripts/db/generar-docs.mjs
  La contraseña se toma de PGPASSWORD o PGPASSFILE.
#>
param(
    [string]$DbName = 'seruna_db',
    [string]$DbHost = 'localhost',
    [int]$Port = 5432,
    [string]$User = 'postgres',
    [string]$PgBin = $env:PG_BIN
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
if (-not $PgBin) {
    $servicio = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%18%'" | Select-Object -First 1
    if ($servicio -and $servicio.PathName -match '"?([^"]+)\\pg_ctl\.exe') { $PgBin = $Matches[1] }
}
$psql = if ($PgBin) { Join-Path $PgBin 'psql.exe' } else { 'psql' }
$catalogo = Join-Path $raiz 'docs\db\catalogo.json'
New-Item -ItemType Directory -Force (Split-Path $catalogo) | Out-Null

$env:PGCLIENTENCODING = 'UTF8'
& $psql -h $DbHost -p $Port -U $User -w -d $DbName -v ON_ERROR_STOP=1 -At -f (Join-Path $raiz 'scripts\db\catalogo.sql') -o $catalogo
if ($LASTEXITCODE -ne 0) { throw "psql terminó con código $LASTEXITCODE" }
node (Join-Path $raiz 'scripts\db\generar-docs.mjs') $catalogo (Join-Path $raiz 'docs\db')
if ($LASTEXITCODE -ne 0) { throw "generar-docs terminó con código $LASTEXITCODE" }
