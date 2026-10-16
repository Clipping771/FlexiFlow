Add-Type -AssemblyName System.Drawing

function Create-RoundedRectPath($rect, $radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Create-SparklePath($cx, $cy, $size) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $s = $size
    $thin = $size * 0.28
    $pts = @(
        [System.Drawing.PointF]::new($cx, $cy - $s),
        [System.Drawing.PointF]::new($cx + $thin, $cy - $thin),
        [System.Drawing.PointF]::new($cx + $s, $cy),
        [System.Drawing.PointF]::new($cx + $thin, $cy + $thin),
        [System.Drawing.PointF]::new($cx, $cy + $s),
        [System.Drawing.PointF]::new($cx - $thin, $cy + $thin),
        [System.Drawing.PointF]::new($cx - $s, $cy),
        [System.Drawing.PointF]::new($cx - $thin, $cy - $thin)
    )
    $path.AddPolygon($pts)
    return $path
}

function Generate-Icon($size, $filename) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    $margin = [Math]::Max(1.0, $size * 0.03)
    $rect = New-Object System.Drawing.RectangleF $margin, $margin, ($size - 2 * $margin), ($size - 2 * $margin)
    $radius = ($size - 2 * $margin) * 0.225
    $bgPath = Create-RoundedRectPath $rect $radius

    # Premium vibrant gradient: #2563EB (electric royal blue) to #4338CA (deep indigo)
    $c1 = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)  # #2563EB
    $c2 = [System.Drawing.Color]::FromArgb(255, 67, 56, 202)  # #4338CA
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.PointF]::new(0, 0), [System.Drawing.PointF]::new($size, $size), $c1, $c2)
    $g.FillPath($brush, $bgPath)

    # Subtle inner border for polish on larger icons
    if ($size -ge 48) {
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 1.0)
        $g.DrawPath($borderPen, $bgPath)
    }

    # Proportional L Pen
    $strokeWidth = if ($size -le 16) { $size * 0.17 } elseif ($size -le 48) { $size * 0.15 } else { $size * 0.14 }
    $lPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 255, 255), $strokeWidth)
    $lPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $lPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $lPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $x1 = $size * 0.33
    $y1 = $size * 0.28
    $y2 = $size * 0.72
    $x2 = $size * 0.69

    $lPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $lPath.AddLine($x1, $y1, $x1, $y2)
    $lPath.AddLine($x1, $y2, $x2, $y2)
    $g.DrawPath($lPen, $lPath)

    # Proportional Sparkle
    $sparkleX = $size * 0.66
    $sparkleY = $size * 0.30
    $sparkleSize = if ($size -le 16) { $size * 0.12 } else { $size * 0.10 }
    
    $sparkleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $spPath = Create-SparklePath $sparkleX $sparkleY $sparkleSize
    $g.FillPath($sparkleBrush, $spPath)

    $bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Saved $filename ($size x $size)"
}

Generate-Icon 16 "assets/icon16.png"
Generate-Icon 32 "assets/icon32.png"
Generate-Icon 48 "assets/icon48.png"
Generate-Icon 128 "assets/icon128.png"
