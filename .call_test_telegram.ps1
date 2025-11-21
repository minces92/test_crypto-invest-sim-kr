try {  = Invoke-RestMethod -Uri " http://localhost:3000/api/test-telegram\ -Method Get; | ConvertTo-Json -Depth 5 } catch { .Exception.Message }
