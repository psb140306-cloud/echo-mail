# SMS Test Script (PowerShell)
# Usage: .\test-sms.ps1 -ApiKey "your-debug-api-key"

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "SMS Test Starting..." -ForegroundColor Cyan
Write-Host "=================================="

$headers = @{
    "Authorization" = "Bearer $ApiKey"
}

$url = "https://echo-mail-blush.vercel.app/api/debug/test-sms"

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

    Write-Host "SUCCESS: Request completed" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "=================================="

    # Analyze result
    if ($response.env.testMode -eq $true) {
        Write-Host "WARNING: Test mode - SMS not actually sent" -ForegroundColor Yellow
        Write-Host "To enable real sending: Set ENABLE_REAL_NOTIFICATIONS=true" -ForegroundColor Yellow
    } else {
        Write-Host "INFO: Real SMS sending mode" -ForegroundColor Cyan
        if ($response.smsResult.success -eq $true) {
            Write-Host "SUCCESS: SMS sent successfully" -ForegroundColor Green
            Write-Host "Message ID: $($response.smsResult.messageId)" -ForegroundColor Green
        } else {
            Write-Host "ERROR: SMS sending failed" -ForegroundColor Red
            Write-Host "Error: $($response.smsResult.error)" -ForegroundColor Red
        }
    }

} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "ERROR: Request failed (HTTP $statusCode)" -ForegroundColor Red
    Write-Host ""

    if ($statusCode -eq 401) {
        Write-Host "Auth header required. Check your API key." -ForegroundColor Yellow
    } elseif ($statusCode -eq 403) {
        Write-Host "Invalid API key." -ForegroundColor Yellow
    } else {
        $errorMessage = $_.Exception.Message
        Write-Host "Error: $errorMessage" -ForegroundColor Red
    }
}
