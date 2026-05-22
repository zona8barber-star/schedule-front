[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipTypecheck,
  [ValidateSet("prod", "qa", "dev", "all")]
  [string]$BuildMode = "prod"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  Write-Host "[verify-frontend] $Name" -ForegroundColor Cyan
  & $Action
  Write-Host "[verify-frontend] OK: $Name" -ForegroundColor Green
}

Push-Location $projectRoot

try {
  if (-not $SkipInstall) {
    Invoke-Step -Name "npm ci" -Action {
      npm ci
    }
  }

  if (-not $SkipTypecheck) {
    Invoke-Step -Name "npm run typecheck" -Action {
      npm run typecheck
    }
  }

  switch ($BuildMode) {
    "dev" {
      Invoke-Step -Name "npm run build:dev" -Action { npm run build:dev }
    }
    "qa" {
      Invoke-Step -Name "npm run build:qa" -Action { npm run build:qa }
    }
    "prod" {
      Invoke-Step -Name "npm run build:prod" -Action { npm run build:prod }
    }
    "all" {
      Invoke-Step -Name "npm run build:dev" -Action { npm run build:dev }
      Invoke-Step -Name "npm run build:qa" -Action { npm run build:qa }
      Invoke-Step -Name "npm run build:prod" -Action { npm run build:prod }
    }
  }

  Write-Host "[verify-frontend] Completed." -ForegroundColor Green
} finally {
  Pop-Location
}
