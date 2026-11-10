# Образец локального запуска помощника Словолупы.
# Скопируйте его в extension\Start-Explanation.local.ps1, заполните значения и не добавляйте копию в Git.

$ErrorActionPreference = 'Stop'
$extensionId = 'jdopdppjlhhpabcjdgjkdenekfgcobkd'
$env:DARKAPI_API_KEY = 'tc_live_fc2d53a06850ade56a5c1f45906c6c4603ea6f3a5fe7299d'
$env:DARKAPI_BASE_URL = 'https://darkapi.shop/v1'
$env:DARKAPI_MODEL = 'gpt-6-luna'
$env:YANDEX_SPEECHKIT_API_KEY = 'AQVNxBVJ8r0reAIHLDLZ-qwZe1x6NusSm0b6wNeI'
$env:YANDEX_SPEECHKIT_VOICE = 'marina'

if ($extensionId -notmatch '^[a-p]{32}$') { throw 'Fill in the 32-letter extension ID.' }
if ($env:DARKAPI_API_KEY -like 'PASTE_*' -or $env:DARKAPI_MODEL -like 'PASTE_*' -or $env:YANDEX_SPEECHKIT_API_KEY -like 'PASTE_*') {
    throw 'Fill in the API keys and DarkAPI model ID in Start-Explanation.local.ps1.'
}

$node = Get-Command node -ErrorAction Stop
& $node.Source (Join-Path $PSScriptRoot 'explain-server.mjs') $extensionId
