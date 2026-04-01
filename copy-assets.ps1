$items = 'c:\Users\Ma\Downloads\ai-visible-engine\dist\intruvurtlabs-logo.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\intruvurt-master-agent.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\og-image.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\og-image2.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\reports.jpeg', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\score-fix.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\security-icon.svg', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\structured.jpeg', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\tech-support-agent.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\text-logo.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\assets', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\cards', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\images', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\404.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\adaptive-icons.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\aitools.PNG', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\aivis-avatar-588x588.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\aivis-pfp-circle-392x392.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\align.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\analyze.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\android-chrome-192x192.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\android-chrome-512x512.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\apple-app-icon - Copy (2).png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\apple-app-icon - Copy (3).png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\apple-app-icon - Copy.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\apple-app-icon.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\black-logo.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\favicon-16x16.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\favicon-48x48.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\favicon-58x58.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\feature-locked.png', 'c:\Users\Ma\Downloads\ai-visible-engine\dist\gear.jpeg'
foreach ($item in $items) {
    if (Test-Path $item) {
        $itemName = Split-Path $item -Leaf
        if ($itemName -match '^favicon|^android|^apple|^adaptive|^manifest') {
            Copy-Item -Path $item -Destination client\public -Recurse -Force
        } elseif ((Get-Item $item).PSIsContainer) {
            if (-not (Test-Path "client\public\$itemName")) { New-Item -ItemType Directory -Force -Path "client\public\$itemName" | Out-Null }
            Copy-Item -Path "$item\*" -Destination "client\public\$itemName" -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            Copy-Item -Path $item -Destination client\public\images -Force
        }
    }
}
