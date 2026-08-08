param(
  [Parameter(Mandatory = $true)][string]$DistDir,
  [Parameter(Mandatory = $true)][string]$ElectronExecutable
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Get-BitmapHash {
  param([System.Drawing.Bitmap]$Bitmap)

  $stream = [System.IO.MemoryStream]::new()
  try {
    $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      return [BitConverter]::ToString(
        $sha256.ComputeHash($stream.ToArray())
      ).Replace("-", "")
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-EmbeddedIconHash {
  param([string]$Executable)

  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($Executable)
  if ($null -eq $icon) {
    throw "No embedded icon found in $Executable"
  }
  try {
    $bitmap = $icon.ToBitmap()
    try { return Get-BitmapHash -Bitmap $bitmap }
    finally { $bitmap.Dispose() }
  } finally {
    $icon.Dispose()
  }
}
function Assert-ThunderIcon {
  param([string]$Executable, [string]$ExpectedHash)

  if ((Get-EmbeddedIconHash -Executable $Executable) -ne $ExpectedHash) {
    throw "Embedded icon in $Executable does not match packaged Thunder.exe"
  }
}

$executables = @(
  Get-ChildItem -Path $DistDir -Filter "*.exe" -Recurse -File |
    Where-Object {
      $_.Name -eq "Thunder.exe" -or $_.Name -like "Thunder Setup*.exe"
    }
)

if (-not ($executables | Where-Object Name -eq "Thunder.exe")) {
  throw "Packaged Thunder.exe was not found under $DistDir"
}
if (-not ($executables | Where-Object Name -like "Thunder Setup*.exe")) {
  throw "Thunder NSIS installer was not found under $DistDir"
}

$applicationExecutable = $executables | Where-Object Name -eq "Thunder.exe" | Select-Object -First 1
$expectedIconHash = Get-EmbeddedIconHash -Executable $applicationExecutable.FullName
$electronIconHash = Get-EmbeddedIconHash -Executable $ElectronExecutable
if ($expectedIconHash -eq $electronIconHash) {
  throw "Packaged Thunder.exe still contains the Electron icon"
}
foreach ($executable in $executables) {
  Assert-ThunderIcon -Executable $executable.FullName -ExpectedHash $expectedIconHash
}

Write-Host "Verified Thunder ICO in $($executables.Count) packaged Windows executable(s)."
