# Installs Superpowers skills/hooks into .cursor/superpowers
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dest = Join-Path $root '.cursor\superpowers'
if (Test-Path $dest) {
  Write-Host "Updating Superpowers at $dest"
  Push-Location $dest
  git pull --ff-only
  Pop-Location
} else {
  New-Item -ItemType Directory -Force -Path (Join-Path $root '.cursor') | Out-Null
  git clone --depth 1 https://github.com/obra/superpowers.git $dest
}
Write-Host "Superpowers installed. Optional: /add-plugin superpowers in Cursor Agent chat for marketplace updates."
