# convert_pdfs_to_txt.ps1
# Convert all PDFs in the datasets/ folder to text files using pdftotext (part of Poppler).
# Usage (PowerShell):
#   .\scripts\convert_pdfs_to_txt.ps1
# Optional: pass a single file path to convert only that file.
# Requires: pdftotext installed and available on PATH. On Windows, install Poppler for Windows and add its bin folder to PATH.

param(
    [string]$file = ''
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$datasets = Join-Path $scriptDir "..\datasets" | Resolve-Path

function Convert-File($pdfPath) {
    $pdfPath = (Resolve-Path $pdfPath).ProviderPath
    if (-not (Test-Path $pdfPath)) { Write-Host "File not found: $pdfPath"; return }
    $txtPath = [System.IO.Path]::ChangeExtension($pdfPath, '.txt')
    Write-Host "Converting:`n  $pdfPath`n -> $txtPath"
    $pdftotext = 'pdftotext'
    $proc = Start-Process -FilePath $pdftotext -ArgumentList @('-layout', '"' + $pdfPath + '"', '"' + $txtPath + '"') -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
    if ($proc.ExitCode -eq 0) {
        Write-Host "Converted: $txtPath"
    } else {
        Write-Host "pdftotext failed or not found. Please install Poppler and make pdftotext available on PATH."
        Write-Host "On Windows, download from: https://github.com/oschwartz10612/poppler-windows/releases"
    }
}

if ($file -ne '') {
    Convert-File $file
    return
}

$pdfs = Get-ChildItem -Path $datasets -Recurse -Include *.pdf -File -ErrorAction SilentlyContinue
if (-not $pdfs) { Write-Host "No PDF files found in $datasets"; exit }
foreach ($p in $pdfs) {
    Convert-File $p.FullName
}

Write-Host "Done. Converted $($pdfs.Count) PDFs to text (if pdftotext available)."