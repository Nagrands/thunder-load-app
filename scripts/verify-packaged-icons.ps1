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

function Get-NormalizedBitmap {
  param(
    [System.Drawing.Icon]$Icon,
    [int]$Size = 64
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawIcon($Icon, [System.Drawing.Rectangle]::new(0, 0, $Size, $Size))
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function Get-BitmapSimilarity {
  param(
    [System.Drawing.Bitmap]$Actual,
    [System.Drawing.Bitmap]$Expected
  )

  [double]$difference = 0
  [double]$maximumDifference = 255 * 3 * $Actual.Width * $Actual.Height
  for ($y = 0; $y -lt $Actual.Height; $y++) {
    for ($x = 0; $x -lt $Actual.Width; $x++) {
      $actualPixel = $Actual.GetPixel($x, $y)
      $expectedPixel = $Expected.GetPixel($x, $y)
      $difference += [Math]::Abs($actualPixel.R - $expectedPixel.R)
      $difference += [Math]::Abs($actualPixel.G - $expectedPixel.G)
      $difference += [Math]::Abs($actualPixel.B - $expectedPixel.B)
    }
  }
  return 1 - ($difference / $maximumDifference)
}

function Assert-ThunderIcon {
  param(
    [string]$Executable,
    [bool]$AllowNsisRendering = $false
  )

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
      $embeddedBitmap = if ($AllowNsisRendering) {
        Get-NormalizedBitmap -Icon $embeddedIcon
      } else {
        $embeddedIcon.ToBitmap()
      }
      $sourceBitmap = if ($AllowNsisRendering) {
        Get-NormalizedBitmap -Icon $sourceIcon
      } else {
        $sourceIcon.ToBitmap()
      }
      try {
        if ($AllowNsisRendering) {
          $similarity = Get-BitmapSimilarity -Actual $embeddedBitmap -Expected $sourceBitmap
          Write-Host "NSIS icon similarity for $Executable`: $($similarity.ToString('P2'))"
          if ($similarity -lt 0.95) {
            throw "Embedded icon in $Executable does not visually match the Thunder ICO"
          }
        } elseif ((Get-BitmapHash $embeddedBitmap) -ne (Get-BitmapHash $sourceBitmap)) {
          throw "Embedded icon in $Executable does not exactly match the Thunder ICO"
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
  Assert-ThunderIcon `
    -Executable $executable.FullName `
    -AllowNsisRendering ($executable.Name -like "Thunder Setup*.exe")
}

Write-Host "Verified Thunder ICO in $($executables.Count) packaged Windows executable(s)."
