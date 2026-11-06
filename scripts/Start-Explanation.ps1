$ErrorActionPreference = 'Stop'
$extensionId = (Read-Host 'Slovolupa extension ID (see chrome://extensions)').Trim()
if ($extensionId -notmatch '^[a-p]{32}$') { throw 'Enter the 32-letter Chrome extension ID.' }
$node = Get-Command node -ErrorAction Stop
$previousKey = $env:DARKAPI_API_KEY
$previousBaseUrl = $env:DARKAPI_BASE_URL
$previousModel = $env:DARKAPI_MODEL
try {
    if (-not $previousKey) {
        $key = Read-Host 'DarkAPI key' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)
        try { $env:DARKAPI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            $key.Dispose()
        }
    }
    if (-not $previousBaseUrl) { $env:DARKAPI_BASE_URL = (Read-Host 'DarkAPI Base URL from Quick Start (ordinary API)').Trim() }
    if ($env:DARKAPI_BASE_URL -notmatch '^https://') { throw 'Enter the HTTPS Base URL from DarkAPI Quick Start.' }
    if (-not $previousModel) { $env:DARKAPI_MODEL = (Read-Host 'DarkAPI model ID from Models').Trim() }
    if (-not $env:DARKAPI_MODEL) { throw 'Enter the DarkAPI model ID.' }
    & $node.Source (Join-Path $PSScriptRoot 'explain-server.mjs') $extensionId
} finally {
    $env:DARKAPI_API_KEY = $previousKey
    $env:DARKAPI_BASE_URL = $previousBaseUrl
    $env:DARKAPI_MODEL = $previousModel
}
