$ErrorActionPreference = "Stop"

if (!(Test-Path ".venv")) {
  py -3 -m venv .venv
}

. .\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

if (!(Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created backend\.env from .env.example. Edit BANK_AGENT_SHARED_SECRET before serious demos." -ForegroundColor Yellow
}

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
