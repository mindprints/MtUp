$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$aiPort = 8787
$vitePort = 5173

function Stop-ProcessByIdSafe {
  param([int]$ProcessId)

  if ($ProcessId -le 0) { return }
  if ($ProcessId -eq $PID) { return }

  try {
    taskkill /PID $ProcessId /F | Out-Null
    Write-Host "Stopped PID $ProcessId"
  } catch {
    Write-Host "Could not stop PID $ProcessId (may already be gone)"
  }
}

function Stop-ProcessesOnPort {
  param([int]$Port)

  $pids = @()
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    $pids = @()
  }

  foreach ($procId in $pids) {
    Stop-ProcessByIdSafe -ProcessId $procId
  }
}

function Stop-RepoNodeProcesses {
  param([string]$RepoRoot)

  $escapedRoot = [regex]::Escape($RepoRoot)
  $patterns = @(
    'server[\\/]dev-orchestrator\.mjs',
    'vite(\.js)?(\s|$)'
  )

  $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
  foreach ($proc in ($procs | Where-Object { $_.CommandLine })) {
    $cmd = [string]$proc.CommandLine
    if ($cmd -notmatch $escapedRoot) { continue }
    if ($patterns | Where-Object { $cmd -match $_ }) {
      Stop-ProcessByIdSafe -ProcessId ([int]$proc.ProcessId)
    }
  }
}

function Start-RepoCommandWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  $safeRoot = $repoRoot.Replace("'", "''")
  $safeTitle = $Title.Replace("'", "''")
  $psCommand = "Set-Location '$safeRoot'; `$host.UI.RawUI.WindowTitle = '$safeTitle'; $Command"

  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-NoProfile',
    '-Command',
    $psCommand
  ) | Out-Null
}

Write-Host "Restarting mtUp dev services from $repoRoot"
Write-Host "Stopping existing orchestrator/Vite processes..."

Stop-ProcessesOnPort -Port $aiPort
Stop-ProcessesOnPort -Port $vitePort
Stop-RepoNodeProcesses -RepoRoot $repoRoot

Start-Sleep -Milliseconds 600

Write-Host "Starting AI orchestrator..."
Start-RepoCommandWindow -Title 'mtUp AI Orchestrator' -Command 'npm run ai:dev'

Start-Sleep -Milliseconds 800

Write-Host "Starting Vite app..."
Start-RepoCommandWindow -Title 'mtUp Vite Dev' -Command 'npm run dev'

Write-Host "Done. New windows launched for:"
Write-Host " - npm run ai:dev"
Write-Host " - npm run dev"
