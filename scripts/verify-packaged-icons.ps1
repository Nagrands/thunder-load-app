param(
  [Parameter(Mandatory = $true)][string]$DistDir,
  [Parameter(Mandatory = $true)][string]$SourceIco
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

function Assert-ThunderIcon {
  param([string]$Executable)

  $embeddedIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($Executable)
  if ($null -eq $embeddedIcon) {
    throw "No embedded icon found in $Executable"
  }

  try {
    $sourceIcon = [System.Drawing.Icon]::new(
      $SourceIco,
      $embeddedIcon.Width,
      $embeddedIcon.Height
    )
    try {
      $embeddedBitmap = $embeddedIcon.ToBitmap()
      $sourceBitmap = $sourceIcon.ToBitmap()
      try {
        if ((Get-BitmapHash $embeddedBitmap) -ne (Get-BitmapHash $sourceBitmap)) {
          throw "Embedded icon in $Executable does not match the Thunder ICO"
        }
      } finally {
        $embeddedBitmap.Dispose()
        $sourceBitmap.Dispose()
      }
    } finally {
      $sourceIcon.Dispose()
    }
  } finally {
    $embeddedIcon.Dispose()
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

foreach ($executable in $executables) {
  Assert-ThunderIcon -Executable $executable.FullName
}

Write-Host "Verified Thunder ICO in $($executables.Count) packaged Windows executable(s)."
