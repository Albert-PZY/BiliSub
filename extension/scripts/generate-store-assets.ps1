Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$extensionRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $extensionRoot "..")
$iconDir = Join-Path $extensionRoot "public/icons"
$publishingAssetDir = Join-Path $repoRoot "docs/publishing/assets"

New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
New-Item -ItemType Directory -Force -Path $publishingAssetDir | Out-Null

function New-Color([string] $hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-RoundedRectanglePath(
  [float] $x,
  [float] $y,
  [float] $width,
  [float] $height,
  [float] $radius
) {
  $diameter = $radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Use-Graphics([System.Drawing.Bitmap] $bitmap) {
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return $graphics
}

function Save-Png([System.Drawing.Bitmap] $bitmap, [string] $path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Draw-WorkbenchMotif(
  [System.Drawing.Graphics] $graphics,
  [float] $x,
  [float] $y,
  [float] $width,
  [float] $height
) {
  $panelFill = New-Color "#132338"
  $panelBorder = New-Color "#1D7FB3"
  $lineColor = New-Color "#F5FBFF"
  $accentColor = New-Color "#14C7DD"
  $sparkColor = New-Color "#FF8A3D"

  $panelPath = New-RoundedRectanglePath $x $y $width $height ($height * 0.18)
  $panelBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.RectangleF($x, $y, $width, $height)),
    $panelFill,
    (New-Color "#0E4A71"),
    55
  )
  $graphics.FillPath($panelBrush, $panelPath)
  $panelPen = New-Object System.Drawing.Pen($panelBorder, [Math]::Max(2, $width * 0.02))
  $graphics.DrawPath($panelPen, $panelPath)

  $topBarHeight = $height * 0.18
  $barPath = New-RoundedRectanglePath ($x + ($width * 0.08)) ($y + ($height * 0.09)) ($width * 0.52) $topBarHeight ($topBarHeight * 0.45)
  $barBrush = New-Object System.Drawing.SolidBrush($accentColor)
  $graphics.FillPath($barBrush, $barPath)

  $lineBrush = New-Object System.Drawing.SolidBrush($lineColor)
  $lineWidth = $width * 0.72
  $lineHeight = [Math]::Max(3, $height * 0.08)
  for ($index = 0; $index -lt 3; $index++) {
    $lineY = $y + ($height * 0.38) + ($index * $height * 0.17)
    $linePath = New-RoundedRectanglePath ($x + ($width * 0.12)) $lineY $lineWidth $lineHeight ($lineHeight * 0.5)
    $graphics.FillPath($lineBrush, $linePath)
    $linePath.Dispose()
  }

  $summaryWidth = $width * 0.28
  $summaryHeight = $height * 0.46
  $summaryX = $x + $width - $summaryWidth - ($width * 0.08)
  $summaryY = $y + ($height * 0.28)
  $summaryPath = New-RoundedRectanglePath $summaryX $summaryY $summaryWidth $summaryHeight ($summaryHeight * 0.16)
  $summaryBrush = New-Object System.Drawing.SolidBrush((New-Color "#F6FBFF"))
  $graphics.FillPath($summaryBrush, $summaryPath)

  for ($index = 0; $index -lt 3; $index++) {
    $chipY = $summaryY + ($summaryHeight * 0.12) + ($index * $summaryHeight * 0.22)
    $chipPath = New-RoundedRectanglePath ($summaryX + ($summaryWidth * 0.12)) $chipY ($summaryWidth * (0.72 - ($index * 0.08))) ($summaryHeight * 0.12) ($summaryHeight * 0.06)
    $chipColor = if ($index -eq 0) { New-Color "#14C7DD" } else { New-Color "#9EDCE7" }
    $chipBrush = New-Object System.Drawing.SolidBrush($chipColor)
    $graphics.FillPath($chipBrush, $chipPath)
    $chipBrush.Dispose()
    $chipPath.Dispose()
  }

  $sparkBrush = New-Object System.Drawing.SolidBrush($sparkColor)
  $sparkSize = [Math]::Max(4, $width * 0.12)
  $graphics.FillEllipse($sparkBrush, $x + $width - $sparkSize - ($width * 0.02), $y + ($height * 0.04), $sparkSize, $sparkSize)

  $panelBrush.Dispose()
  $panelPen.Dispose()
  $barBrush.Dispose()
  $lineBrush.Dispose()
  $summaryBrush.Dispose()
  $sparkBrush.Dispose()
  $panelPath.Dispose()
  $barPath.Dispose()
  $summaryPath.Dispose()
}

function New-Icon([int] $size, [string] $path) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = Use-Graphics $bitmap
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $margin = $size * 0.08
  Draw-WorkbenchMotif $graphics $margin $margin ($size - ($margin * 2)) ($size - ($margin * 2))

  if ($size -ge 48) {
    $fontSize = [Math]::Max(7, $size * 0.12)
    $font = New-Object System.Drawing.Font("Segoe UI Semibold", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush((New-Color "#F6FBFF"))
    $graphics.DrawString("AI", $font, $textBrush, $size * 0.58, $size * 0.62)
    $textBrush.Dispose()
    $font.Dispose()
  }

  $graphics.Dispose()
  Save-Png $bitmap $path
}

function New-StorePanel([int] $width, [int] $height, [string] $path) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = Use-Graphics $bitmap
  $graphics.Clear((New-Color "#F3FAFD"))

  $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, $width, $height)),
    (New-Color "#F7FCFF"),
    (New-Color "#D7F4FB"),
    25
  )
  $graphics.FillRectangle($backgroundBrush, 0, 0, $width, $height)

  $haloBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36, 20, 199, 221))
  $graphics.FillEllipse($haloBrush, -($width * 0.08), -($height * 0.18), $width * 0.55, $height * 0.78)
  $graphics.FillEllipse($haloBrush, $width * 0.60, $height * 0.16, $width * 0.34, $height * 0.44)

  $cardWidth = $width * 0.64
  $cardHeight = $height * 0.74
  $cardX = $width * 0.08
  $cardY = $height * 0.13
  $cardPath = New-RoundedRectanglePath $cardX $cardY $cardWidth $cardHeight ($height * 0.08)
  $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
  $cardBorder = New-Object System.Drawing.Pen((New-Color "#B8E6F0"), [Math]::Max(2, $width * 0.005))
  $graphics.FillPath($cardBrush, $cardPath)
  $graphics.DrawPath($cardBorder, $cardPath)

  Draw-WorkbenchMotif $graphics ($cardX + ($cardWidth * 0.06)) ($cardY + ($cardHeight * 0.10)) ($cardWidth * 0.84) ($cardHeight * 0.80)

  $summaryBadgePath = New-RoundedRectanglePath ($width * 0.58) ($height * 0.16) ($width * 0.26) ($height * 0.18) ($height * 0.06)
  $summaryBadgeBrush = New-Object System.Drawing.SolidBrush((New-Color "#132338"))
  $summaryBadgeBorder = New-Object System.Drawing.Pen((New-Color "#14C7DD"), [Math]::Max(2, $width * 0.004))
  $graphics.FillPath($summaryBadgeBrush, $summaryBadgePath)
  $graphics.DrawPath($summaryBadgeBorder, $summaryBadgePath)

  $lineBrush = New-Object System.Drawing.SolidBrush((New-Color "#F6FBFF"))
  for ($index = 0; $index -lt 4; $index++) {
    $chipWidth = ($width * 0.17) - ($index * $width * 0.015)
    $chipY = ($height * 0.20) + ($index * $height * 0.03)
    $chipPath = New-RoundedRectanglePath ($width * 0.62) $chipY $chipWidth ($height * 0.018) ($height * 0.009)
    $graphics.FillPath($lineBrush, $chipPath)
    $chipPath.Dispose()
  }

  $accentBrush = New-Object System.Drawing.SolidBrush((New-Color "#FF8A3D"))
  $graphics.FillEllipse($accentBrush, $width * 0.80, $height * 0.68, $width * 0.10, $width * 0.10)

  $backgroundBrush.Dispose()
  $haloBrush.Dispose()
  $cardBrush.Dispose()
  $cardBorder.Dispose()
  $cardPath.Dispose()
  $summaryBadgeBrush.Dispose()
  $summaryBadgeBorder.Dispose()
  $summaryBadgePath.Dispose()
  $lineBrush.Dispose()
  $accentBrush.Dispose()
  $graphics.Dispose()
  Save-Png $bitmap $path
}

New-Icon 16 (Join-Path $iconDir "icon16.png")
New-Icon 32 (Join-Path $iconDir "icon32.png")
New-Icon 48 (Join-Path $iconDir "icon48.png")
New-Icon 128 (Join-Path $iconDir "icon128.png")

New-Icon 300 (Join-Path $publishingAssetDir "store-logo-300x300.png")
New-StorePanel 440 280 (Join-Path $publishingAssetDir "store-small-promo-440x280.png")
New-StorePanel 1280 800 (Join-Path $publishingAssetDir "store-screenshot-frame-1280x800.png")
New-StorePanel 1400 560 (Join-Path $publishingAssetDir "store-marquee-1400x560.png")

Write-Host "Generated icons in $iconDir"
Write-Host "Generated publishing assets in $publishingAssetDir"
