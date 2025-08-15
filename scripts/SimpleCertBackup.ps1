# Simple Certificate Backup and Restore Script
# Usage: .\SimpleCertBackup.ps1 -Action Backup|Restore -Path C:\CertBackup

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Backup", "Restore")]
    [string]$Action,
    
    [Parameter(Mandatory=$true)]
    [string]$Path,
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "DefaultPassword123!",
    
    [Parameter(Mandatory=$false)]
    [switch]$CurrentUserOnly
)

function Write-Status {
    param($Message, $Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Test-IsAdmin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Backup-Certificates {
    param($BackupPath)
    
    Write-Status "Starting certificate backup..." "Green"
    
    # Create backup directory
    if (!(Test-Path $BackupPath)) {
        New-Item -Path $BackupPath -ItemType Directory -Force | Out-Null
    }
    
    $stores = @()
    
    # Add CurrentUser stores
    $stores += @{Location = "CurrentUser"; Name = "My"; Path = "Cert:\CurrentUser\My"}
    $stores += @{Location = "CurrentUser"; Name = "Root"; Path = "Cert:\CurrentUser\Root"}
    $stores += @{Location = "CurrentUser"; Name = "CA"; Path = "Cert:\CurrentUser\CA"}
    $stores += @{Location = "CurrentUser"; Name = "TrustedPeople"; Path = "Cert:\CurrentUser\TrustedPeople"}
    
    # Add LocalMachine stores if admin
    if (!$CurrentUserOnly -and (Test-IsAdmin)) {
        $stores += @{Location = "LocalMachine"; Name = "My"; Path = "Cert:\LocalMachine\My"}
        $stores += @{Location = "LocalMachine"; Name = "Root"; Path = "Cert:\LocalMachine\Root"}
        $stores += @{Location = "LocalMachine"; Name = "CA"; Path = "Cert:\LocalMachine\CA"}
        $stores += @{Location = "LocalMachine"; Name = "TrustedPeople"; Path = "Cert:\LocalMachine\TrustedPeople"}
    }
    elseif (!$CurrentUserOnly) {
        Write-Status "Not running as admin - skipping LocalMachine stores" "Yellow"
    }
    
    $totalCerts = 0
    
    foreach ($store in $stores) {
        try {
            Write-Status "Processing $($store.Location)\$($store.Name)..." "Cyan"
            
            $certs = Get-ChildItem -Path $store.Path -ErrorAction SilentlyContinue
            if (!$certs) {
                Write-Status "  No certificates found" "Yellow"
                continue
            }
            
            $storeFolder = Join-Path $BackupPath "$($store.Location)_$($store.Name)"
            if (!(Test-Path $storeFolder)) {
                New-Item -Path $storeFolder -ItemType Directory -Force | Out-Null
            }
            
            $certCount = 0
            foreach ($cert in $certs) {
                try {
                    # Export public certificate
                    $certFile = Join-Path $storeFolder "$($cert.Thumbprint).cer"
                    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
                    [System.IO.File]::WriteAllBytes($certFile, $certBytes)
                    
                    # Export with private key if available
                    if ($cert.HasPrivateKey) {
                        try {
                            $pfxFile = Join-Path $storeFolder "$($cert.Thumbprint).pfx"
                            $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
                            $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $securePassword)
                            [System.IO.File]::WriteAllBytes($pfxFile, $pfxBytes)
                        }
                        catch {
                            Write-Status "    Warning: Could not export private key for $($cert.Subject)" "Yellow"
                        }
                    }
                    
                    # Save certificate info
                    $info = @{
                        Subject = $cert.Subject
                        Issuer = $cert.Issuer
                        Thumbprint = $cert.Thumbprint
                        NotBefore = $cert.NotBefore.ToString()
                        NotAfter = $cert.NotAfter.ToString()
                        HasPrivateKey = $cert.HasPrivateKey
                        FriendlyName = $cert.FriendlyName
                    }
                    $infoFile = Join-Path $storeFolder "$($cert.Thumbprint).json"
                    $info | ConvertTo-Json | Out-File $infoFile -Encoding UTF8
                    
                    $certCount++
                }
                catch {
                    Write-Status "    Error exporting $($cert.Subject): $($_.Exception.Message)" "Red"
                }
            }
            
            Write-Status "  Exported $certCount certificates" "Green"
            $totalCerts += $certCount
        }
        catch {
            Write-Status "  Error accessing store: $($_.Exception.Message)" "Red"
        }
    }
    
    # Save backup manifest
    $manifest = @{
        BackupDate = (Get-Date).ToString()
        ComputerName = $env:COMPUTERNAME
        UserName = $env:USERNAME
        TotalCertificates = $totalCerts
        PasswordProtected = $true
    }
    $manifestFile = Join-Path $BackupPath "manifest.json"
    $manifest | ConvertTo-Json | Out-File $manifestFile -Encoding UTF8
    
    Write-Status "Backup completed! $totalCerts certificates backed up to $BackupPath" "Green"
}

function Restore-Certificates {
    param($BackupPath)
    
    Write-Status "Starting certificate restore..." "Green"
    
    if (!(Test-Path $BackupPath)) {
        Write-Status "Backup path not found: $BackupPath" "Red"
        return
    }
    
    # Read manifest
    $manifestFile = Join-Path $BackupPath "manifest.json"
    if (Test-Path $manifestFile) {
        $manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
        Write-Status "Restoring backup from $($manifest.ComputerName) created on $($manifest.BackupDate)" "Cyan"
    }
    
    $storeFolders = Get-ChildItem -Path $BackupPath -Directory | Where-Object { $_.Name -match "^(CurrentUser|LocalMachine)_" }
    $totalRestored = 0
    
    foreach ($storeFolder in $storeFolders) {
        try {
            # Parse store location and name
            $parts = $storeFolder.Name -split "_", 2
            $location = $parts[0]
            $storeName = $parts[1]
            
            # Skip LocalMachine if not admin
            if ($location -eq "LocalMachine" -and !(Test-IsAdmin)) {
                Write-Status "Skipping $($storeFolder.Name) - requires admin privileges" "Yellow"
                continue
            }
            
            Write-Status "Processing $($storeFolder.Name)..." "Cyan"
            
            # Open certificate store
            $storeLocation = if ($location -eq "CurrentUser") { 
                [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser 
            } else { 
                [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine 
            }
            
            $x509Store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, $storeLocation)
            $x509Store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
            
            $pfxFiles = Get-ChildItem -Path $storeFolder.FullName -Filter "*.pfx"
            $cerFiles = Get-ChildItem -Path $storeFolder.FullName -Filter "*.cer"
            
            $restoredCount = 0
            
            # Restore PFX files first (with private keys)
            foreach ($pfxFile in $pfxFiles) {
                try {
                    $thumbprint = [System.IO.Path]::GetFileNameWithoutExtension($pfxFile.Name)
                    
                    # Check if already exists
                    $existing = $x509Store.Certificates | Where-Object { $_.Thumbprint -eq $thumbprint }
                    if ($existing) {
                        Write-Status "    Certificate already exists: $thumbprint" "Yellow"
                        continue
                    }
                    
                    # Import PFX
                    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
                    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
                    $cert.Import($pfxFile.FullName, $securePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)
                    
                    # Restore friendly name
                    $infoFile = Join-Path $storeFolder.FullName "$thumbprint.json"
                    if (Test-Path $infoFile) {
                        $info = Get-Content $infoFile -Raw | ConvertFrom-Json
                        if ($info.FriendlyName) {
                            $cert.FriendlyName = $info.FriendlyName
                        }
                    }
                    
                    $x509Store.Add($cert)
                    $restoredCount++
                    Write-Status "    Restored with private key: $($cert.Subject)" "Green"
                }
                catch {
                    Write-Status "    Error importing $($pfxFile.Name): $($_.Exception.Message)" "Red"
                }
            }
            
            # Restore CER files (public keys only) for certificates without PFX
            foreach ($cerFile in $cerFiles) {
                try {
                    $thumbprint = [System.IO.Path]::GetFileNameWithoutExtension($cerFile.Name)
                    
                    # Skip if we already imported the PFX version
                    $pfxExists = $pfxFiles | Where-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $thumbprint }
                    if ($pfxExists) { continue }
                    
                    # Check if already exists
                    $existing = $x509Store.Certificates | Where-Object { $_.Thumbprint -eq $thumbprint }
                    if ($existing) {
                        Write-Status "    Certificate already exists: $thumbprint" "Yellow"
                        continue
                    }
                    
                    # Import certificate
                    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cerFile.FullName)
                    
                    # Restore friendly name
                    $infoFile = Join-Path $storeFolder.FullName "$thumbprint.json"
                    if (Test-Path $infoFile) {
                        $info = Get-Content $infoFile -Raw | ConvertFrom-Json
                        if ($info.FriendlyName) {
                            $cert.FriendlyName = $info.FriendlyName
                        }
                    }
                    
                    $x509Store.Add($cert)
                    $restoredCount++
                    Write-Status "    Restored: $($cert.Subject)" "Green"
                }
                catch {
                    Write-Status "    Error importing $($cerFile.Name): $($_.Exception.Message)" "Red"
                }
            }
            
            $x509Store.Close()
            Write-Status "  Restored $restoredCount certificates" "Green"
            $totalRestored += $restoredCount
        }
        catch {
            Write-Status "  Error processing $($storeFolder.Name): $($_.Exception.Message)" "Red"
        }
    }
    
    Write-Status "Restore completed! $totalRestored certificates restored" "Green"
    Write-Status "You may need to restart applications or services that use these certificates" "Yellow"
}

# Main execution
Write-Host "Simple Certificate Backup & Restore Tool" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if ($Action -eq "Backup") {
    Backup-Certificates -BackupPath $Path
}
elseif ($Action -eq "Restore") {
    Restore-Certificates -BackupPath $Path
}

Write-Host "Done!" -ForegroundColor Green