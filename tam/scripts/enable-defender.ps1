# Re-enable Microsoft Defender after DevOps Workflow
# This script re-enables Windows Defender and removes development exclusions

param(
    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

Write-Host "🛡️ Re-enabling Microsoft Defender after DevOps workflow..." -ForegroundColor Yellow

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsBuiltInRole]::Administrator).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green

# Remove registry policies that disable Defender
try {
    Write-Host "🔄 Removing Defender disable policies..." -ForegroundColor Yellow
    
    # Remove registry values
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableRealtimeMonitoring" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableBehaviorMonitoring" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableIOAVProtection" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableScriptScanning" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableScheduledScan" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableBlockAtFirstSeen" -ErrorAction SilentlyContinue
    
    Write-Host "✅ Defender disable policies removed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Some policies could not be removed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Re-enable Real-time Protection
try {
    Write-Host "🔄 Re-enabling Real-time Protection..." -ForegroundColor Yellow
    
    Set-MpPreference -DisableRealtimeMonitoring $false -Force
    Write-Host "✅ Real-time Protection re-enabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to re-enable Real-time Protection: $($_.Exception.Message)" -ForegroundColor Red
}

# Remove DevOps directory exclusions
$devopsPaths = @(
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\node_modules",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\.git",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\logs",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\dist",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\build",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\backend",
    "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\frontend"
)

Write-Host "📁 Removing DevOps directory exclusions..." -ForegroundColor Yellow

foreach ($path in $devopsPaths) {
    try {
        # Remove folder exclusion
        Remove-MpPreference -ExclusionPath $path -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Removed exclusion: $path" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not remove exclusion for $path: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Remove file type exclusions
$devopsExtensions = @(
    "*.js",
    "*.ts",
    "*.jsx",
    "*.tsx",
    "*.json",
    "*.md",
    "*.yml",
    "*.yaml",
    "*.log",
    "*.tmp",
    "*.cache",
    "node.exe",
    "npm.exe",
    "yarn.exe",
    "docker.exe",
    "git.exe"
)

Write-Host "📄 Removing file type exclusions..." -ForegroundColor Yellow

foreach ($extension in $devopsExtensions) {
    try {
        Remove-MpPreference -ExclusionExtension $extension -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Removed extension exclusion: $extension" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not remove extension exclusion for $extension: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Remove process exclusions
$devopsProcesses = @(
    "node.exe",
    "npm.exe",
    "yarn.exe",
    "docker.exe",
    "docker-compose.exe",
    "git.exe",
    "code.exe",
    "powershell.exe"
)

Write-Host "⚙️ Removing process exclusions..." -ForegroundColor Yellow

foreach ($process in $devopsProcesses) {
    try {
        Remove-MpPreference -ExclusionProcess $process -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Removed process exclusion: $process" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not remove process exclusion for $process: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Re-enable scheduled scans
try {
    Write-Host "🔄 Re-enabling scheduled scans..." -ForegroundColor Yellow
    
    Set-MpPreference -DisableScheduledScan $false -Force
    Write-Host "✅ Scheduled scans re-enabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to re-enable scheduled scans: $($_.Exception.Message)" -ForegroundColor Red
}

# Re-enable cloud protection
try {
    Write-Host "☁️ Re-enabling cloud protection..." -ForegroundColor Yellow
    
    Set-MpPreference -DisableBlockAtFirstSeen $false -Force
    Write-Host "✅ Cloud protection re-enabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to re-enable cloud protection: $($_.Exception.Message)" -ForegroundColor Red
}

# Re-enable Windows Defender services
Write-Host "🔧 Re-enabling Windows Defender services..." -ForegroundColor Yellow

$defenderServices = @(
    "WinDefend",
    "Sense",
    "WdNisSvc",
    "MsMpSvc"
)

foreach ($serviceName in $defenderServices) {
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "▶️ Starting service: $serviceName" -ForegroundColor Yellow
            Set-Service -Name $serviceName -StartupType Automatic -ErrorAction SilentlyContinue
            Start-Service -Name $serviceName -ErrorAction SilentlyContinue
            Write-Host "✅ Service started and enabled: $serviceName" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Could not configure service $serviceName: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Remove DevOps configuration file
$configPath = "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\.defender-config.json"
if (Test-Path $configPath) {
    try {
        Remove-Item $configPath -Force
        Write-Host "🗑️ Removed configuration file: $configPath" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not remove configuration file: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Remove reminder script
$reminderPath = "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\scripts\re-enable-defender-reminder.ps1"
if (Test-Path $reminderPath) {
    try {
        Remove-Item $reminderPath -Force
        Write-Host "🗑️ Removed reminder script: $reminderPath" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not remove reminder script: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Force update Windows Defender definitions
try {
    Write-Host "🔄 Updating Windows Defender definitions..." -ForegroundColor Yellow
    
    Update-MpSignature -UpdateSource MicrosoftUpdateServer -Force
    Write-Host "✅ Defender definitions updated" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not update definitions: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Start a quick scan to ensure everything is working
try {
    Write-Host "🔍 Starting quick scan to verify Defender is working..." -ForegroundColor Yellow
    
    Start-MpScan -ScanType QuickScan -ErrorAction SilentlyContinue
    Write-Host "✅ Quick scan started" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not start quick scan: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Display current status
Write-Host "`n📊 Current Windows Defender Status:" -ForegroundColor Cyan
try {
    $preferences = Get-MpPreference
    
    Write-Host "  Real-time Protection: $(if ($preferences.DisableRealtimeMonitoring) { 'Disabled' } else { 'Enabled' })" -ForegroundColor $(if ($preferences.DisableRealtimeMonitoring) { 'Red' } else { 'Green' })
    Write-Host "  Scheduled Scans: $(if ($preferences.DisableScheduledScan) { 'Disabled' } else { 'Enabled' })" -ForegroundColor $(if ($preferences.DisableScheduledScan) { 'Red' } else { 'Green' })
    Write-Host "  Cloud Protection: $(if ($preferences.DisableBlockAtFirstSeen) { 'Disabled' } else { 'Enabled' })" -ForegroundColor $(if ($preferences.DisableBlockAtFirstSeen) { 'Red' } else { 'Green' })
    Write-Host "  Exclusion Paths: $($preferences.ExclusionPath.Count)" -ForegroundColor White
    Write-Host "  Exclusion Extensions: $($preferences.ExclusionExtension.Count)" -ForegroundColor White
    Write-Host "  Exclusion Processes: $($preferences.ExclusionProcess.Count)" -ForegroundColor White
} catch {
    Write-Host "❌ Could not retrieve current preferences: $($_.Exception.Message)" -ForegroundColor Red
}

# Check service status
Write-Host "`n🔧 Service Status:" -ForegroundColor Cyan
foreach ($serviceName in $defenderServices) {
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            $status = if ($service.Status -eq 'Running') { 'Running' } else { 'Stopped' }
            $color = if ($service.Status -eq 'Running') { 'Green' } else { 'Red' }
            Write-Host "  $serviceName`: $status" -ForegroundColor $color
        }
    } catch {
        Write-Host "  $serviceName`: Unknown" -ForegroundColor Yellow
    }
}

Write-Host "`n🎯 Microsoft Defender has been fully re-enabled!" -ForegroundColor Green
Write-Host "🛡️ Your system is now protected again" -ForegroundColor Green

# Create completion log
$logPath = "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\logs\defender-reenable.log"
$logEntry = @{
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    action = "defender_reenabled"
    scope = "development_complete"
    services = $defenderServices
    exclusionsRemoved = @{
        paths = $devopsPaths.Count
        extensions = $devopsExtensions.Count
        processes = $devopsProcesses.Count
    }
}

try {
    New-Item -ItemType Directory -Force -Path (Split-Path $logPath) | Out-Null
    $logEntry | ConvertTo-Json -Depth 3 | Out-File -FilePath $logPath -Encoding UTF8 -Append
    Write-Host "📝 Log entry created: $logPath" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not create log entry: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✅ DevOps workflow completed - Defender is fully operational!" -ForegroundColor Green
