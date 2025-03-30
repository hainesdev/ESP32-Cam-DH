# Run as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run this script as Administrator"
    Break
}

Write-Host "Starting Python and Conda cleanup process..." -ForegroundColor Green

# Function to safely remove directories
function Remove-DirectoryIfExists {
    param (
        [string]$Path
    )
    if (Test-Path $Path) {
        Write-Host "Removing directory: $Path" -ForegroundColor Yellow
        Remove-Item -Path $Path -Recurse -Force
    }
}

# Function to safely remove registry keys
function Remove-RegistryKeyIfExists {
    param (
        [string]$Path
    )
    if (Test-Path $Path) {
        Write-Host "Removing registry key: $Path" -ForegroundColor Yellow
        Remove-Item -Path $Path -Recurse -Force
    }
}

# Get current user
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$UserProfile = $env:USERPROFILE

# Remove Conda directories
Write-Host "`nRemoving Conda directories..." -ForegroundColor Cyan
Remove-DirectoryIfExists "$UserProfile\Anaconda3"
Remove-DirectoryIfExists "$UserProfile\Miniconda3"
Remove-DirectoryIfExists "$UserProfile\AppData\Local\conda"
Remove-DirectoryIfExists "$UserProfile\AppData\Roaming\conda"

# Remove Python directories
Write-Host "`nRemoving Python directories..." -ForegroundColor Cyan
Remove-DirectoryIfExists "C:\Python*"
Remove-DirectoryIfExists "$UserProfile\AppData\Local\Programs\Python"
Remove-DirectoryIfExists "$UserProfile\AppData\Local\pip"

# Clean up environment variables
Write-Host "`nCleaning up environment variables..." -ForegroundColor Cyan
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$SystemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Remove Python and Conda related paths
$UserPath = ($UserPath.Split(';') | Where-Object { $_ -notmatch 'Python|Anaconda|Conda|pip' }) -join ';'
$SystemPath = ($SystemPath.Split(';') | Where-Object { $_ -notmatch 'Python|Anaconda|Conda|pip' }) -join ';'

[Environment]::SetEnvironmentVariable("Path", $UserPath, "User")
[Environment]::SetEnvironmentVariable("Path", $SystemPath, "Machine")

# Clean up registry
Write-Host "`nCleaning up registry..." -ForegroundColor Cyan
$RegistryPaths = @(
    "HKCU:\Software\Python",
    "HKCU:\Software\Anaconda",
    "HKCU:\Software\Conda",
    "HKLM:\SOFTWARE\Python",
    "HKLM:\SOFTWARE\Anaconda",
    "HKLM:\SOFTWARE\Conda"
)

foreach ($Path in $RegistryPaths) {
    Remove-RegistryKeyIfExists $Path
}

# Uninstall Python and Anaconda from Programs and Features
Write-Host "`nUninstalling Python and Anaconda..." -ForegroundColor Cyan
$UninstallStrings = @(
    "Python",
    "Anaconda",
    "Miniconda"
)

foreach ($Program in $UninstallStrings) {
    $Uninstaller = Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*$Program*" }
    if ($Uninstaller) {
        Write-Host "Uninstalling $Program..." -ForegroundColor Yellow
        $Uninstaller.Uninstall()
    }
}

Write-Host "`nCleanup completed!" -ForegroundColor Green
Write-Host "Please restart your computer to complete the cleanup process." -ForegroundColor Yellow
Write-Host "After restart, you can install a fresh copy of Python from python.org" -ForegroundColor Yellow 