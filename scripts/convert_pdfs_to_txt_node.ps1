# convert_pdfs_to_txt_node.ps1
# Spawn a child Node process per PDF with increased max-old-space-size to avoid OOM during pdf-parse.
# Usage: .\scripts\convert_pdfs_to_txt_node.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = Join-Path $scriptDir ".." | Resolve-Path
$datasets = Join-Path $root "datasets"

Write-Host "Scanning $datasets for PDFs..."
$pdfs = Get-ChildItem -Path $datasets -Recurse -Include *.pdf -File -ErrorAction SilentlyContinue
if (-not $pdfs) { Write-Host "No PDFs found"; exit }

foreach ($p in $pdfs) {
    $pdfPath = $p.FullName
    Write-Host "Converting (node subprocess): $pdfPath"
    $node = 'node'
    $worker = Join-Path $scriptDir '_pdf_to_text_worker.js'
    $args = "--max-old-space-size=4096 `"$worker`" `"$pdfPath`""
    # Start the process and wait
    $proc = Start-Process -FilePath $node -ArgumentList $args -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
    if ($proc -and $proc.ExitCode -eq 0) {
        Write-Host "Converted OK: $pdfPath"
    } else {
        Write-Host "Worker failed for $pdfPath (exit $($proc.ExitCode))"
    }
}

Write-Host "Done."