param(
    [string]$SourcePath = "C:\Users\user\.gemini\antigravity-ide\brain\e9963b9c-dc7b-4f39-914d-4d223e250a99\.user_uploaded\media_1793126192088.jpg",
    [string]$DestDir = "public"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourcePath)) {
    Write-Error "Source image not found at $SourcePath"
    exit 1
}

$destFull = [System.IO.Path]::GetFullPath($DestDir)
if (-not (Test-Path $destFull)) {
    New-Item -ItemType Directory -Path $destFull -Force | Out-Null
}

$srcImage = [System.Drawing.Image]::FromFile($SourcePath)
Write-Output "Source Image Loaded: $($srcImage.Width) x $($srcImage.Height)"

# Function to resize with highest quality Bicubic interpolation
function Resize-Image($image, [int]$width, [int]$height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($image, 0, 0, $width, $height)
    $g.Dispose()
    return $bmp
}

function Save-Png($bmp, [string]$outPath) {
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Generated: $outPath ($($bmp.Width)x$($bmp.Height))"
}

function Save-Jpg($bmp, [string]$outPath) {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]95)
    $bmp.Save($outPath, $codec, $encParams)
    Write-Output "Generated: $outPath ($($bmp.Width)x$($bmp.Height))"
}

# 1. logo.png and logo.jpg (High resolution original aspect)
$fullBmp = Resize-Image $srcImage $srcImage.Width $srcImage.Height
Save-Png $fullBmp (Join-Path $destFull "logo.png")
Save-Jpg $fullBmp (Join-Path $destFull "logo.jpg")

# 2. og-image.png and og-image.jpg (Social link previews for WhatsApp, Twitter, Facebook, LinkedIn, Discord)
$ogBmp = Resize-Image $srcImage 1200 1200
Save-Png $ogBmp (Join-Path $destFull "og-image.png")
Save-Jpg $ogBmp (Join-Path $destFull "og-image.jpg")
$ogBmp.Dispose()

# 3. Android Chrome icons for PWA & mobile home screen shortcuts
$c512 = Resize-Image $srcImage 512 512
Save-Png $c512 (Join-Path $destFull "android-chrome-512x512.png")
$c512.Dispose()

$c192 = Resize-Image $srcImage 192 192
Save-Png $c192 (Join-Path $destFull "android-chrome-192x192.png")
$c192.Dispose()

# 4. Apple Touch Icon for iOS Safari bookmarks & home screen shortcuts (180x180)
$apple = Resize-Image $srcImage 180 180
Save-Png $apple (Join-Path $destFull "apple-touch-icon.png")
$apple.Dispose()

# 5. Browser Tab Favicons
$f48 = Resize-Image $srcImage 48 48
Save-Png $f48 (Join-Path $destFull "favicon-48x48.png")

$f32 = Resize-Image $srcImage 32 32
Save-Png $f32 (Join-Path $destFull "favicon-32x32.png")

$f16 = Resize-Image $srcImage 16 16
Save-Png $f16 (Join-Path $destFull "favicon-16x16.png")

# 6. Multi-resolution favicon.ico embedding 16x16, 32x32, 48x48
$icoPath = Join-Path $destFull "favicon.ico"
$iconSizes = @(
    @{ Bmp = $f16; W = 16; H = 16 },
    @{ Bmp = $f32; W = 32; H = 32 },
    @{ Bmp = $f48; W = 48; H = 48 }
)

$pngBytesList = @()
foreach ($entry in $iconSizes) {
    $ms = New-Object System.IO.MemoryStream
    $entry.Bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $pngBytesList += ,$bytes
}

$icoStream = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($icoStream)

# ICONHEADER: reserved (0), type (1 = icon), count (3)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$iconSizes.Count)

$offset = 6 + ($iconSizes.Count * 16)
for ($i = 0; $i -lt $iconSizes.Count; $i++) {
    $w = [byte]$iconSizes[$i].W
    $h = [byte]$iconSizes[$i].H
    $bw.Write($w) # Width (0 = 256)
    $bw.Write($h) # Height (0 = 256)
    $bw.Write([byte]0) # Color count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32) # Bits per pixel
    $bw.Write([uint32]$pngBytesList[$i].Length) # Image size in bytes
    $bw.Write([uint32]$offset) # Offset
    $offset += $pngBytesList[$i].Length
}

for ($i = 0; $i -lt $iconSizes.Count; $i++) {
    $bw.Write($pngBytesList[$i])
}

$bw.Flush()
$bw.Dispose()
$icoStream.Dispose()
Write-Output "Generated multi-resolution ICO: $icoPath (16x16, 32x32, 48x48)"

$f16.Dispose()
$f32.Dispose()
$f48.Dispose()
$fullBmp.Dispose()
$srcImage.Dispose()
Write-Output "Favicon generation complete."
