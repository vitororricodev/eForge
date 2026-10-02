param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packagePath = Join-Path $projectRoot 'package.json'
if (!(Test-Path -LiteralPath $packagePath)) { throw 'Execute dentro do pacote atualizado do eForge.' }
$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
if ($package.name -ne 'eforge' -or !(Test-Path -LiteralPath (Join-Path $projectRoot 'src/lib/owned-gif-manifest.ts')) -or !(Test-Path -LiteralPath (Join-Path $projectRoot 'supabase/migrations/20261002200000_owned_gif_library.sql'))) {
  throw 'Copie primeiro o pacote completo da biblioteca propria eForge.'
}
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'ARQUIVOS-LEGADOS.json') -Raw | ConvertFrom-Json
$rootPrefix = $projectRoot + [System.IO.Path]::DirectorySeparatorChar
$backupRoot = Join-Path (Split-Path $projectRoot -Parent) ('eforge-legado-backup-' + [guid]::NewGuid().ToString('N'))
$moved = 0
foreach ($relative in $manifest.removed_files) {
  if ([System.IO.Path]::IsPathRooted($relative) -or $relative -match '(^|[\\/])\.\.([\\/]|$)') { throw 'Caminho invalido no manifesto de limpeza.' }
  $source = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
  if (!$source.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho fora do projeto.' }
  if (Test-Path -LiteralPath $source -PathType Leaf) {
    if ($DryRun) {
      Write-Output ('Moveria para backup: ' + $relative)
    } else {
      $destination = Join-Path $backupRoot $relative
      New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
      Move-Item -LiteralPath $source -Destination $destination
      Write-Output ('Movido: ' + $relative)
    }
    $moved++
  }
}
if ($DryRun) { Write-Output ('Arquivos antigos encontrados: ' + $moved) }
elseif ($moved -gt 0) { Write-Output ('Arquivos preservados no backup: ' + $backupRoot) }
else { Write-Output 'Nenhum arquivo antigo da lista foi encontrado.' }
