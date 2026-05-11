# Disable Microsoft Defender for DevOps Workflow
# This script temporarily disables Windows Defender for development

param(
    [Parameter(Mandatory=$false)]
    [string]$Scope = "development"
)

Write-Host "🛡️ Disabling Microsoft Defender for DevOps workflow..." -ForegroundColor Yellow

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsBuiltInRole]::Administrator).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green

# Disable Real-time Protection
try {
    Write-Host "🔄 Disabling Real-time Protection..." -ForegroundColor Yellow
    
    # Set registry values to disable real-time protection
    Set-MpPreference -DisableRealtimeMonitoring $true -Force
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableRealtimeMonitoring" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableBehaviorMonitoring" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableIOAVProtection" -Value 1 -Type DWord -Force
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableScriptScanning" -Value 1 -Type DWord -Force
    
    Write-Host "✅ Real-time Protection disabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to disable Real-time Protection: $($_.Exception.Message)" -ForegroundColor Red
}

# Add DevOps directories to exclusions
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

Write-Host "📁 Adding DevOps directories to exclusions..." -ForegroundColor Yellow

foreach ($path in $devopsPaths) {
    if (Test-Path $path) {
        try {
            # Add folder exclusion
            Add-MpPreference -ExclusionPath $path -Force
            Write-Host "✅ Added exclusion: $path" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Could not add exclusion for $path: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️ Path does not exist: $path" -ForegroundColor Yellow
    }
}

# Add file type exclusions for development
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

Write-Host "📄 Adding file type exclusions..." -ForegroundColor Yellow

foreach ($extension in $devopsExtensions) {
    try {
        Add-MpPreference -ExclusionExtension $extension -Force
        Write-Host "✅ Added extension exclusion: $extension" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not add extension exclusion for $extension: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Add process exclusions for development tools
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

Write-Host "⚙️ Adding process exclusions..." -ForegroundColor Yellow

foreach ($process in $devopsProcesses) {
    try {
        Add-MpPreference -ExclusionProcess $process -Force
        Write-Host "✅ Added process exclusion: $process" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not add process exclusion for $process: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Disable Windows Defender scheduled scans
try {
    Write-Host "🔄 Disabling scheduled scans..." -ForegroundColor Yellow
    
    # Disable scheduled scan
    Set-MpPreference -DisableScheduledScan $true -Force
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableScheduledScan" -Value 1 -Type DWord -Force
    
    Write-Host "✅ Scheduled scans disabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to disable scheduled scans: $($_.Exception.Message)" -ForegroundColor Red
}

# Disable cloud protection
try {
    Write-Host "☁️ Disabling cloud protection..." -ForegroundColor Yellow
    
    Set-MpPreference -DisableBlockAtFirstSeen $true -Force
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "DisableBlockAtFirstSeen" -Value 1 -Type DWord -Force
    
    Write-Host "✅ Cloud protection disabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to disable cloud protection: $($_.Exception.Message)" -ForegroundColor Red
}

# Configure Windows Defender services
Write-Host "🔧 Configuring Windows Defender services..." -ForegroundColor Yellow

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
            Write-Host "⏸️ Stopping service: $serviceName" -ForegroundColor Yellow
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            Set-Service -Name $serviceName -StartupType Disabled -ErrorAction SilentlyContinue
            Write-Host "✅ Service stopped and disabled: $serviceName" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Could not configure service $serviceName: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Create DevOps configuration file
$configPath = "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\.defender-config.json"
$config = @{
    scope = $Scope
    disabledAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    exclusions = @{
        paths = $devopsPaths | Where-Object { Test-Path $_ }
        extensions = $devopsExtensions
        processes = $devopsProcesses
    }
    services = $defenderServices
    notes = "Microsoft Defender disabled for DevOps workflow"
}

try {
    $config | ConvertTo-Json -Depth 3 | Out-File -FilePath $configPath -Encoding UTF8
    Write-Host "💾 Configuration saved to: $configPath" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to save configuration: $($_.Exception.Message)" -ForegroundColor Red
}

# Display current status
Write-Host "`n📊 Current Windows Defender Status:" -ForegroundColor Cyan
try {
    $preferences = Get-MpPreference
    
    Write-Host "  Real-time Protection: $(if ($preferences.DisableRealtimeMonitoring) { 'Disabled' } else { 'Enabled' })" -ForegroundColor $(if ($preferences.DisableRealtimeMonitoring) { 'Green' } else { 'Red' })
    Write-Host "  Scheduled Scans: $(if ($preferences.DisableScheduledScan) { 'Disabled' } else { 'Enabled' })" -ForegroundColor $(if ($preferences.DisableScheduledScan) { 'Green' } else { 'Red' })
    Write-Host "  Cloud Protection: $(if ($preferences.DisableBlockAtFirstSeen) { 'Disabled' } else { 'Enabled' })" -ForegroundColor $(if ($preferences.DisableBlockAtFirstSeen) { 'Green' } else { 'Red' })
    Write-Host "  Exclusion Paths: $($preferences.ExclusionPath.Count)" -ForegroundColor White
    Write-Host "  Exclusion Extensions: $($preferences.ExclusionExtension.Count)" -ForegroundColor White
    Write-Host "  Exclusion Processes: $($preferences.ExclusionProcess.Count)" -ForegroundColor White
} catch {
    Write-Host "❌ Could not retrieve current preferences: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Microsoft Defender has been configured for DevOps workflow!" -ForegroundColor Green
Write-Host "⚠️ Remember to re-enable Defender after development:" -ForegroundColor Yellow
Write-Host "   Run: .\scripts\enable-defender.ps1" -ForegroundColor Cyan
Write-Host "   Or restart your computer to restore default settings" -ForegroundColor Cyan

# Create re-enable script reminder
$reminderScript = @"
# Reminder to re-enable Windows Defender
Write-Host "⚠️ Don't forget to re-enable Windows Defender!" -ForegroundColor Yellow
Write-Host "Run: .\scripts\enable-defender.ps1" -ForegroundColor Cyan
"@

$reminderPath = "C:\Users\kayon\OneDrive\Desktop\waze\tam-app\tam\scripts\re-enable-defender-reminder.ps1"
New-Item -ItemType Directory -Force -Path (Split-Path $reminderPath) | Out-Null
$reminderScript | Out-File -FilePath $reminderPath -Encoding UTF8

Write-Host "📝 Reminder script created: $reminderPath" -ForegroundColor Green
