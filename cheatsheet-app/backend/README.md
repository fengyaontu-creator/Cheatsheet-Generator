# Backend

Run locally:

PowerShell:
```powershell
./run.ps1
```

Then test export:
```bash
curl -X POST http://localhost:8000/api/export/latex -H "Content-Type: application/json" --data @sample/example_project.json -o out.pdf
```
