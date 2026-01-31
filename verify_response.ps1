$ErrorActionPreference = "Stop"

try {
    Write-Host "Logging in..."
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post -Body '{"email":"admin@example.com", "password":"adminpassword"}' -ContentType "application/json"
    $token = $loginResponse.accessToken
    Write-Host "Login successful. Token obtained."

    Write-Host "Fetching Users..."
    try {
        $usersResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/users" -Method Get -Headers @{ Authorization = "Bearer $token" }
        
        Write-Host "Response Type: $($usersResponse.GetType().Name)"
        if ($usersResponse -is [Array]) {
             Write-Host "Response is an Array. Length: $($usersResponse.Count)"
             Write-Host "First item: $($usersResponse[0] | ConvertTo-Json -Depth 1)"
        } else {
             Write-Host "Response is NOT an Array!"
             Write-Host "Content: $($usersResponse | ConvertTo-Json -Depth 2)"
        }
    } catch {
        Write-Host "Failed to fetch users."
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)"
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd();
        Write-Host "Response Body: $responseBody"
    }

} catch {
    Write-Host "An error occurred: $_"
}
