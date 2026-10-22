# Lookmax AI portable server: serves the built app on http://localhost:4173
# using only Windows PowerShell (no Node.js needed). Listens on localhost only,
# so nothing is exposed to the network.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'app'
$port = 4173

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'
  '.wasm' = 'application/wasm'; '.task' = 'application/octet-stream'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch {
  Write-Host "Khong mo duoc cong $port. Co the Lookmax AI dang chay o cua so khac." -ForegroundColor Yellow
  Start-Process "http://localhost:$port/"
  Read-Host 'Nhan Enter de thoat'
  exit 1
}

Write-Host ''
Write-Host '  Lookmax AI dang chay tai http://localhost:4173' -ForegroundColor Cyan
Write-Host '  Giu cua so nay mo trong khi dung app. Dong cua so de tat.'
Write-Host '  Anh duoc xu ly ngay tren may nay, khong gui di dau ca.'
Write-Host ''
Start-Process "http://localhost:$port/"

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $path = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))
    # Block path traversal outside the app folder.
    if (-not $path.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
      $path = Join-Path $rootFull 'index.html'
    }
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
    if ($ext -eq '.html' -or $rel -eq 'sw.js') { $res.Headers.Add('Cache-Control', 'no-cache') }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
