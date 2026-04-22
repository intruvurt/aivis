$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetPath = Join-Path $repoRoot 'docs\landing-ai-mismatch-brief.md'

$brief = @'
# AiVIS Landing: AI Mismatch UI

This brief defines the core landing surface as a machine interpretation debugger.

## Mental Model
- Left: ground truth from source content
- Right: AI interpretation output
- Center: distortion layer showing mismatch status and impact

## Root Structure
- AIMismatchPanel
- MismatchHeader
- MismatchSummaryBar
- MismatchSplitView
- MismatchTimeline

## Required Contract
```ts
MismatchData {
  entities: [
    {
      name
      sourceMentions[]
      aiMentions[]
      status
      similarity
      impactScore
    }
  ]
}
```

## Interaction Rules
- Hover entity: highlight left + right + mismatch row
- Click entity: lock comparison and open detail drawer
- Timeline: replay ingestion -> detection -> mismatch -> scoring

## Visual Rules
- Motion only on events
- No idle animation
- Status colors:
  - correct: green
  - weak: yellow
  - missing: red
  - distorted: violet

## MVP Priority
1. Split view left/right with center entity status rows
2. Linked highlighting behavior
3. Entity detail drawer with source and AI excerpts
4. Timeline scrub/replay

AiVIS is not a dashboard; it is a forensic comparison surface for divergence between reality and AI interpretation.
'@

$targetDir = Split-Path -Parent $targetPath
if (-not (Test-Path $targetDir)) {
  New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
}

Set-Content -Path $targetPath -Value $brief -Encoding UTF8

if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
  Set-Clipboard -Value $brief
}

Write-Host "Updated landing brief:" -ForegroundColor Cyan
Write-Host "  $targetPath" -ForegroundColor Gray
Write-Host "Brief copied to clipboard." -ForegroundColor Green
