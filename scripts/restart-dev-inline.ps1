$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$aiPort = 8787
$vitePort = 5173
$orchestratorProc = $null

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

try {
  Write-Host "Restarting mtUp dev services in current terminal from $repoRoot"
  Write-Host "Stopping existing orchestrator/Vite processes..."

  Stop-ProcessesOnPort -Port $aiPort
  Stop-ProcessesOnPort -Port $vitePort
  Stop-RepoNodeProcesses -RepoRoot $repoRoot

  Start-Sleep -Milliseconds 600

  Write-Host "Starting AI orchestrator in background (same terminal)..."
  $orchestratorProc = Start-Process npm.cmd `
    -ArgumentList @('run', 'ai:dev') `
    -WorkingDirectory $repoRoot `
    -NoNewWindow `
    -PassThru

  Start-Sleep -Milliseconds 800

  Write-Host "Starting Vite app in foreground..."
  Push-Location $repoRoot
  try {
    & npm.cmd run dev
  } finally {
    Pop-Location
  }
} finally {
  if ($orchestratorProc -and -not $orchestratorProc.HasExited) {
    Write-Host "Stopping background AI orchestrator (PID $($orchestratorProc.Id))..."
    Stop-ProcessByIdSafe -ProcessId $orchestratorProc.Id
  }
}
