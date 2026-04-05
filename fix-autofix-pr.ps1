#!/usr/bin/env pwsh
# Fix broken find-and-replace: AutoFix PR → scorefix/ScoreFix
# Ordered from most specific to least specific pattern

$root = $PSScriptRoot
$extensions = @('*.ts', '*.tsx', '*.json', '*.md', '*.html')

$files = Get-ChildItem -Path $root -Recurse -Include $extensions | Where-Object {
    $p = $_.FullName
    ($p -notmatch 'node_modules') -and ($p -notmatch '[\\/]dist[\\/]') -and ($p -notmatch '[\\/]\.git[\\/]') -and ($p -notmatch '[\\/]coverage[\\/]')
}

$fixCount = 0
foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    if ($content -match 'AutoFix PR') {
        $original = $content

        # 1. Doubled compound patterns (AutoScoreFix became AutoAutoFix PR)
        $content = $content -replace '_AUTOAutoFix PR', '_AUTOSCOREFIX'
        $content = $content -replace 'AutoAutoFix PR', 'AutoScoreFix'
        $content = $content -replace 'autoAutoFix PR', 'autoScoreFix'

        # 2. Component/function names (ScoreFix became AutoFix PR)
        $content = $content -replace 'AutoFix PRIcon', 'ScoreFixIcon'
        $content = $content -replace 'AutoFix PRPage', 'ScoreFixPage'
        $content = $content -replace 'AutoFix PRFaq', 'scoreFixFaq'
        $content = $content -replace 'AutoFix PRJsonLd', 'scoreFixJsonLd'
        $content = $content -replace 'AutoFix PRSeo', 'scoreFixSeo'
        $content = $content -replace 'AutoFix PRPercent', 'scorefixPercent'

        # 3. Constant/env var patterns
        $content = $content -replace 'STRIPE_AutoFix PR_', 'STRIPE_SCOREFIX_'
        $content = $content -replace 'AutoFix PR_AI', 'SCOREFIX_AI'
        $content = $content -replace 'AutoFix PR_mode', 'scorefix_mode'
        $content = $content -replace 'AutoFix PR_monthly', 'scorefix_monthly'
        $content = $content -replace 'AutoFix PR_scans', 'scorefix_scans'

        # 4. Catch-all: remaining AutoFix PR -> scorefix
        $content = $content -replace 'AutoFix PR', 'scorefix'

        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($f.FullName, $content)
            $fixCount++
            $rel = $f.FullName.Substring($root.Length + 1)
            Write-Host "Fixed: $rel"
        }
    }
}
Write-Host ""
Write-Host "=== Fixed $fixCount files ==="
