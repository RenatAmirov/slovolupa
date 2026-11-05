if (-not $env:MIRAI_MODEL) { $env:MIRAI_MODEL = 'gpt-5.6-luna' }
$ErrorActionPreference = 'Stop'
$extensionId = (Read-Host 'Slovolupa extension ID (see chrome://extensions)').Trim()
if ($extensionId -notmatch '^[a-p]{32}$') { throw 'Enter the 32-letter Chrome extension ID.' }
$node = Get-Command node -ErrorAction Stop
$previousKey = $env:MIRAI_API_KEY
try {
    if (-not $previousKey) {
        $key = Read-Host 'MiraiAPI key' -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)
        try { $env:MIRAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            $key.Dispose()
        }
    }
    & $node.Source (Join-Path $PSScriptRoot 'explain-server.mjs') $extensionId
} finally {
    $env:MIRAI_API_KEY = $previousKey
}
