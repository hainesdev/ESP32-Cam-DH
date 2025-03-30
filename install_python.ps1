# Run as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run this script as Administrator"
    Break
}

Write-Host "Starting Python installation process..." -ForegroundColor Green

# Create a temporary directory for downloads
$TempDir = Join-Path $env:TEMP "PythonInstall"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

# Download Python installer
$PythonUrl = "https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe"
$InstallerPath = Join-Path $TempDir "python-installer.exe"

Write-Host "Downloading Python installer..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $PythonUrl -OutFile $InstallerPath

# Install Python with recommended settings
Write-Host "Installing Python..." -ForegroundColor Cyan
Start-Process -FilePath $InstallerPath -ArgumentList "/quiet", "InstallAllUsers=1", "PrependPath=1", "Include_test=0" -Wait

# Clean up
Write-Host "Cleaning up..." -ForegroundColor Cyan
Remove-Item -Path $TempDir -Recurse -Force

Write-Host "`nPython installation completed!" -ForegroundColor Green
Write-Host "Please restart your computer to complete the installation." -ForegroundColor Yellow
Write-Host "After restart, you can verify the installation by running 'python --version' in a new terminal." -ForegroundColor Yellow 