param(
    [ValidateSet("all", "bom", "fixed", "usage", "packaging")]
    [string] $Sheet = "all",

    [string] $Workbook = "./BOM.xlsx",

    [switch] $Remote
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

$sheetMap = @{
    "all" = "all"
    "bom" = "bom"
    "fixed" = "fixed"
    "usage" = "usage"
    "packaging" = "packaging"
}

$sheetKey = $sheetMap[$Sheet]
$outputMap = @{
    "all" = "./data/bom_seed.sql"
    "bom" = "./data/bom_only_seed.sql"
    "fixed" = "./data/fixed_only_seed.sql"
    "usage" = "./data/usage_only_seed.sql"
    "packaging" = "./data/packaging_only_seed.sql"
}

$output = $outputMap[$sheetKey]
$python = $env:PYTHON
if ([string]::IsNullOrWhiteSpace($python)) {
    $python = "python"
}

& $python ./scripts/export_bom_to_sql.py --workbook $Workbook --sheet $sheetKey --output $output
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$mode = "--local"
if ($Remote) {
    $mode = "--remote"
}

& npx wrangler d1 execute smt-pcb-search-db $mode --file $output
exit $LASTEXITCODE
