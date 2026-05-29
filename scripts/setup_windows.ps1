$ErrorActionPreference = "Stop"

Write-Host "Checking Python..." -ForegroundColor Cyan
python --version

Write-Host "Checking Node..." -ForegroundColor Cyan
node --version
npm --version

Write-Host "Install/pull Ollama model manually if needed:" -ForegroundColor Yellow
Write-Host "  winget install Ollama.Ollama"
Write-Host "  ollama pull qwen3:8b"

Write-Host "Backend setup:" -ForegroundColor Cyan
Push-Location .\backend
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env" }
if (!(Test-Path ".venv")) { python -m venv .venv }
. .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Pop-Location

Write-Host "Plugin setup:" -ForegroundColor Cyan
Push-Location .\openclaw-plugin
npm install
npm run build
Pop-Location

Write-Host "Done. Next run backend/run.ps1, then install plugin with openclaw plugins install --link .\openclaw-plugin" -ForegroundColor Green
