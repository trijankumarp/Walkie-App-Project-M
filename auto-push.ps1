# auto-push.ps1
# Watches the project for changes and automatically commits + pushes to GitHub.
# This triggers the GitHub Action which auto-deploys to Firebase Hosting.
#
# How to use:
#   1. Open a SEPARATE PowerShell window (keep it running in background)
#   2. Run:   npm run auto-push
#      Or:    .\auto-push.ps1
#
# It will detect any file changes (that are not gitignored), auto commit with timestamp,
# and push. Your changes will appear on GitHub and get deployed to Firebase automatically.
#
# Stop it anytime with Ctrl + C.
#
# WARNING: This creates frequent "auto:" commits. Good during active development.
#          You can always rebase/squash history later if needed.

param(
    [int]$CheckIntervalSeconds = 4,
    [string]$CommitPrefix = "auto"
)

$ErrorActionPreference = "Stop"

function Write-Color($Text, $Color = "White") {
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "========================================" "Cyan"
Write-Color "  Social App - Auto Git Push + Firebase Deploy Watcher" "Cyan"
Write-Color "========================================" "Cyan"
Write-Host ""

# Check we are in a git repo
try {
    $null = git rev-parse --is-inside-work-tree
} catch {
    Write-Color "ERROR: This is not a git repository." "Red"
    exit 1
}

$branch = git rev-parse --abbrev-ref HEAD
Write-Color "Current branch: $branch" "Yellow"

if ($branch -ne "main") {
    Write-Color "WARNING: You are not on 'main' branch." "Red"
    Write-Color "Auto-deploy to Firebase only triggers on pushes to 'main'." "Red"
    Write-Host ""
    $answer = Read-Host "Do you want to continue watching anyway? (y/N)"
    if ($answer -ne "y" -and $answer -ne "Y") {
        Write-Color "Exiting." "Gray"
        exit 0
    }
}

Write-Color "Watching for changes every $CheckIntervalSeconds seconds..." "Green"
Write-Color "Any non-ignored file changes will be auto-committed and pushed." "Green"
Write-Color "This will trigger GitHub Actions → Firebase Hosting deploy." "Green"
Write-Host ""
Write-Color "Press Ctrl+C to stop the watcher." "DarkGray"
Write-Host ""

$lastPushTime = Get-Date

while ($true) {
    try {
        # Get list of modified / new / deleted files (respecting .gitignore)
        $changes = git status --porcelain 2>$null

        if ($changes) {
            $changeCount = ($changes | Measure-Object).Count
            Write-Color "[$(Get-Date -Format 'HH:mm:ss')] Detected $changeCount change(s)..." "Yellow"

            # Stage everything
            git add . | Out-Null

            # Create commit message with timestamp
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $commitMessage = "${CommitPrefix}: sync changes at $timestamp"

            # Commit
            git commit -m $commitMessage | Out-Null

            Write-Color "  Committed: $commitMessage" "Gray"

            # Push
            Write-Color "  Pushing to GitHub..." "Cyan"
            git push

            Write-Color "  ✅ Pushed! GitHub Action will deploy to Firebase." "Green"
            Write-Color "     Live: https://social-app-projectm.web.app" "DarkGray"

            $lastPushTime = Get-Date
            Write-Host ""
        }
        else {
            # Optional: show heartbeat every ~30 seconds so user knows it's alive
            $secondsSinceLast = ((Get-Date) - $lastPushTime).TotalSeconds
            if ($secondsSinceLast -gt 45) {
                Write-Color "[$(Get-Date -Format 'HH:mm:ss')] Watching... (no changes)" "DarkGray"
                $lastPushTime = Get-Date
            }
        }
    }
    catch {
        Write-Color "  ⚠️  Error during auto-push: $_" "Red"
        Write-Color "     Will retry in next cycle..." "DarkGray"
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}