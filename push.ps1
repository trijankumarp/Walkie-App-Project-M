# Auto push script for Social App Project-M
# Run this after edits:
#   1. Commits + pushes to GitHub
#   2. GitHub Action automatically deploys to Firebase Hosting
#
# Usage:
#   .\push.ps1 "your commit message"
#   or via npm:  npm run push "your message"

param(
    [string]$Message = "chore: update from local"
)

# Make sure we're on main
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Write-Host "⚠️  You are on branch '$branch'. Auto-deploy only triggers on 'main'." -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y") { exit 1 }
}

Write-Host "📦 Adding all changes..." -ForegroundColor Cyan
git add .

# Check if there is anything to commit
$status = git status --porcelain
if (-not $status) {
    Write-Host "✅ No changes to commit. Pulling latest and exiting." -ForegroundColor Green
    git pull --rebase
    exit 0
}

Write-Host "📝 Committing with message: $Message" -ForegroundColor Cyan
git commit -m $Message

Write-Host "🚀 Pushing to GitHub (this will trigger Firebase auto-deploy via GitHub Actions)..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "✅ Pushed successfully!" -ForegroundColor Green
Write-Host "🔄 GitHub Actions will now deploy to Firebase Hosting." -ForegroundColor Green
Write-Host ""
Write-Host "Check status: https://github.com/trijankumarp/Social-App-Project-M/actions" -ForegroundColor Yellow
Write-Host "Live site:    https://social-app-projectm.web.app  (hard refresh / Ctrl+Shift+R after ~1 min)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Tip: You can also run 'npm run deploy' for an immediate direct deploy (bypasses GitHub)." -ForegroundColor DarkGray
