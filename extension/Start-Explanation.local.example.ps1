# Образец локального запуска помощника Словолупы.
# Скопируйте его в extension\Start-Explanation.local.ps1, заполните значения и не добавляйте копию в Git.

$ErrorActionPreference = 'Stop'
$extensionId = 'PASTE_32_LETTER_EXTENSION_ID_HERE'
$env:DARKAPI_API_KEY = 'PASTE_DARKAPI_KEY_HERE'
$env:DARKAPI_BASE_URL = 'https://darkapi.shop/v1'
$env:DARKAPI_MODEL = 'PASTE_DARKAPI_MODEL_ID_HERE'
$env:YANDEX_SPEECHKIT_API_KEY = 'PASTE_YANDEX_SPEECHKIT_KEY_HERE'
$env:YANDEX_SPEECHKIT_VOICE = 'marina'

if ($extensionId -notmatch '^[a-p]{32}$') { throw 'Fill in the 32-letter extension ID.' }
if ($env:DARKAPI_API_KEY -like 'PASTE_*' -or $env:DARKAPI_MODEL -like 'PASTE_*' -or $env:YANDEX_SPEECHKIT_API_KEY -like 'PASTE_*') {
    throw 'Fill in the API keys and DarkAPI model ID in Start-Explanation.local.ps1.'
}

$node = Get-Command node -ErrorAction Stop
& $node.Source (Join-Path $PSScriptRoot 'explain-server.mjs') $extensionId
