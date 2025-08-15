# Certificate Store Backup and Restore Script
# Run as Administrator for LocalMachine stores

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Backup", "Restore")]
    [string]$Action,
    
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("CurrentUser", "LocalMachine", "Both")]
    [string]$StoreLocation = "Both",
    
    [Parameter(Mandatory=$false)]
    [string[]]$StoreNames = @("My", "Root", "CA", "TrustedPeople", "TrustedPublisher", "AuthRoot"),
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludePrivateKeys,
    
    [Parameter(Mandatory=$false)]
    [string]$Password = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

function Write-Log {
    param($Message, $Type = "Info")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Type) {
        "Success" { "Green" }
        "Error" { "Red" }
        "Warning" { "Yellow" }
        default { "Cyan" }
    }
    
    Write-Host "[$timestamp] $Message" -ForegroundColor $color
}

function Test-AdminPrivileges {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Backup-CertificateStore {
    param(
        [string]$Location,
        [string]$StoreName,
        [string]$BackupFolder,
        [bool]$IncludePrivateKeys,
        [string]$Password
    )
    
    $storePath = "Cert:\$Location\$StoreName"
    $storeBackupPath = Join-Path $BackupFolder "$Location-$StoreName"
    
    if (-not (Test-Path $storeBackupPath)) {
        New-Item -Path $storeBackupPath -ItemType Directory -Force | Out-Null
    }
    
    try {
        $certificates = Get-ChildItem -Path $storePath -ErrorAction Stop
        $certCount = 0
        $errorCount = 0
        
        Write-Log "Backing up $($certificates.Count) certificates from $Location\$StoreName" "Info"
        
        foreach ($cert in $certificates) {
            try {
                $fileName = "$($cert.Thumbprint).cer"
                $certPath = Join-Path $storeBackupPath $fileName
                
                # Export certificate (public key)
                $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
                [System.IO.File]::WriteAllBytes($certPath, $certBytes)
                
                # Export with private key if requested and available
                if ($IncludePrivateKeys -and $cert.HasPrivateKey) {
                    try {
                        $pfxFileName = "$($cert.Thumbprint).pfx"
                        $pfxPath = Join-Path $storeBackupPath $pfxFileName
                        
                        if ($Password) {
                            $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
                            $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $securePassword)
                        } else {
                            $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12)
                        }
                        
                        [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
                        
                        if ($Verbose) {
                            Write-Log "  Exported with private key: $($cert.Subject)" "Success"
                        }
                    }
                    catch {
                        Write-Log "  Failed to export private key for: $($cert.Subject) - $($_.Exception.Message)" "Warning"
                    }
                } else {
                    if ($Verbose) {
                        Write-Log "  Exported: $($cert.Subject)" "Success"
                    }
                }
                
                # Create metadata file
                $metadata = @{
                    Subject = $cert.Subject
                    Issuer = $cert.Issuer
                    Thumbprint = $cert.Thumbprint
                    SerialNumber = $cert.SerialNumber
                    NotBefore = $cert.NotBefore
                    NotAfter = $cert.NotAfter
                    HasPrivateKey = $cert.HasPrivateKey
                    FriendlyName = $cert.FriendlyName
                    StoreLocation = $Location
                    StoreName = $StoreName
                } | ConvertTo-Json
                
                $metadataPath = Join-Path $storeBackupPath "$($cert.Thumbprint).json"
                $metadata | Out-File -FilePath $metadataPath -Encoding UTF8
                
                $certCount++
            }
            catch {
                Write-Log "  Failed to export certificate: $($cert.Subject) - $($_.Exception.Message)" "Error"
                $errorCount++
            }
        }
        
        Write-Log "Backup completed for $Location\$StoreName - $certCount certificates exported, $errorCount errors" "Success"
        return @{ Success = $certCount; Errors = $errorCount }
    }
    catch {
        Write-Log "Failed to access certificate store $Location\$StoreName - $($_.Exception.Message)" "Error"
        return @{ Success = 0; Errors = 1 }
    }
}

function Restore-CertificateStore {
    param(
        [string]$Location,
        [string]$StoreName,
        [string]$BackupFolder,
        [string]$Password
    )
    
    $storeBackupPath = Join-Path $BackupFolder "$Location-$StoreName"
    
    if (-not (Test-Path $storeBackupPath)) {
        Write-Log "Backup folder not found: $storeBackupPath" "Warning"
        return @{ Success = 0; Errors = 0; Skipped = 1 }
    }
    
    try {
        # Open the certificate store
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($StoreName, $Location)
        $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        
        $certFiles = Get-ChildItem -Path $storeBackupPath -Filter "*.cer"
        $pfxFiles = Get-ChildItem -Path $storeBackupPath -Filter "*.pfx"
        
        Write-Log "Restoring certificates to $Location\$StoreName" "Info"
        Write-Log "Found $($certFiles.Count) certificate files and $($pfxFiles.Count) PFX files" "Info"
        
        $certCount = 0
        $errorCount = 0
        $skippedCount = 0
        
        # Restore PFX files first (they contain both public and private keys)
        foreach ($pfxFile in $pfxFiles) {
            try {
                $thumbprint = [System.IO.Path]::GetFileNameWithoutExtension($pfxFile.Name)
                
                # Check if certificate already exists
                $existingCert = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumbprint }
                if ($existingCert) {
                    if ($Verbose) {
                        Write-Log "  Certificate already exists, skipping: $thumbprint" "Warning"
                    }
                    $skippedCount++
                    continue
                }
                
                # Load metadata
                $metadataPath = Join-Path $storeBackupPath "$thumbprint.json"
                $metadata = $null
                if (Test-Path $metadataPath) {
                    $metadata = Get-Content $metadataPath | ConvertFrom-Json
                }
                
                # Import PFX
                if ($Password) {
                    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
                    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxFile.FullName, $securePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)
                } else {
                    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfxFile.FullName, "", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)
                }
                
                # Restore friendly name if available
                if ($metadata -and $metadata.FriendlyName) {
                    $cert.FriendlyName = $metadata.FriendlyName
                }
                
                $store.Add($cert)
                
                if ($Verbose) {
                    Write-Log "  Restored with private key: $($cert.Subject)" "Success"
                }
                $certCount++
            }
            catch {
                Write-Log "  Failed to restore PFX: $($pfxFile.Name) - $($_.Exception.Message)" "Error"
                $errorCount++
            }
        }
        
        # Restore certificate files (public keys only)
        foreach ($certFile in $certFiles) {
            try {
                $thumbprint = [System.IO.Path]::GetFileNameWithoutExtension($certFile.Name)
                
                # Skip if we already imported this as PFX
                $pfxExists = $pfxFiles | Where-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $thumbprint }
                if ($pfxExists) {
                    continue
                }
                
                # Check if certificate already exists
                $existingCert = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumbprint }
                if ($existingCert) {
                    if ($Verbose) {
                        Write-Log "  Certificate already exists, skipping: $thumbprint" "Warning"
                    }
                    $skippedCount++
                    continue
                }
                
                # Load metadata
                $metadataPath = Join-Path $storeBackupPath "$thumbprint.json"
                $metadata = $null
                if (Test-Path $metadataPath) {
                    $metadata = Get-Content $metadataPath | ConvertFrom-Json
                }
                
                # Import certificate
                $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certFile.FullName)
                
                # Restore friendly name if available
                if ($metadata -and $metadata.FriendlyName) {
                    $cert.FriendlyName = $metadata.FriendlyName
                }
                
                $store.Add($cert)
                
                if ($Verbose) {
                    Write-Log "  Restored: $($cert.Subject)" "Success"
                }
                $certCount++
            }
            catch {
                Write-Log "  Failed to restore certificate: $($certFile.Name) - $($_.Exception.Message)" "Error"
                $errorCount++
            }
        }
        
        $store.Close()
        Write-Log "Restore completed for $Location\$StoreName - $certCount certificates restored, $skippedCount skipped, $errorCount errors" "Success"
        return @{ Success = $certCount; Errors = $errorCount; Skipped = $skippedCount }
    }
    catch {
        Write-Log "Failed to access certificate store $Location\$StoreName - $($_.Exception.Message)" "Error"
        return @{ Success = 0; Errors = 1; Skipped = 0 }
    }
}

# Main execution
Write-Host "Certificate Store Backup & Restore Tool" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Green
Write-Host ""

# Check admin privileges for LocalMachine operations
if (($StoreLocation -eq "LocalMachine" -or $StoreLocation -eq "Both") -and -not (Test-AdminPrivileges)) {
    Write-Log "Warning: Administrator privileges required for LocalMachine certificate stores" "Warning"
    Write-Log "Run as Administrator or use -StoreLocation CurrentUser" "Warning"
    
    $continue = Read-Host "Continue with CurrentUser stores only? (Y/N)"
    if ($continue -ne "Y" -and $continue -ne "y") {
        exit 1
    }
    $StoreLocation = "CurrentUser"
}

# Determine store locations to process
$storeLocations = switch ($StoreLocation) {
    "CurrentUser" { @("CurrentUser") }
    "LocalMachine" { @("LocalMachine") }
    "Both" { @("CurrentUser", "LocalMachine") }
}

$totalStats = @{ Success = 0; Errors = 0; Skipped = 0 }

if ($Action -eq "Backup") {
    Write-Log "Starting certificate backup to: $BackupPath" "Info"
    
    # Create backup directory
    if (-not (Test-Path $BackupPath)) {
        New-Item -Path $BackupPath -ItemType Directory -Force | Out-Null
        Write-Log "Created backup directory: $BackupPath" "Info"
    }
    
    # Create backup info file
    $backupInfo = @{
        Timestamp = Get-Date
        SourceComputer = $env:COMPUTERNAME
        SourceUser = $env:USERNAME
        WindowsVersion = (Get-WmiObject -Class Win32_OperatingSystem).Caption
        StoreLocations = $storeLocations
        StoreNames = $StoreNames
        IncludePrivateKeys = $IncludePrivateKeys.IsPresent
    } | ConvertTo-Json
    
    $backupInfoPath = Join-Path $BackupPath "backup-info.json"
    $backupInfo | Out-File -FilePath $backupInfoPath -Encoding UTF8
    
    foreach ($location in $storeLocations) {
        foreach ($storeName in $StoreNames) {
            Write-Log "Processing $location\$storeName..." "Info"
            $result = Backup-CertificateStore -Location $location -StoreName $storeName -BackupFolder $BackupPath -IncludePrivateKeys $IncludePrivateKeys.IsPresent -Password $Password
            $totalStats.Success += $result.Success
            $totalStats.Errors += $result.Errors
        }
    }
    
    Write-Log "Backup completed! Total: $($totalStats.Success) certificates backed up, $($totalStats.Errors) errors" "Success"
}
elseif ($Action -eq "Restore") {
    Write-Log "Starting certificate restore from: $BackupPath" "Info"
    
    if (-not (Test-Path $BackupPath)) {
        Write-Log "Backup path does not exist: $BackupPath" "Error"
        exit 1
    }
    
    # Read backup info if available
    $backupInfoPath = Join-Path $BackupPath "backup-info.json"
    if (Test-Path $backupInfoPath) {
        $backupInfo = Get-Content $backupInfoPath | ConvertFrom-Json
        Write-Log "Backup created: $($backupInfo.Timestamp) on $($backupInfo.SourceComputer)" "Info"
        Write-Log "Source Windows version: $($backupInfo.WindowsVersion)" "Info"
    }
    
    foreach ($location in $storeLocations) {
        foreach ($storeName in $StoreNames) {
            Write-Log "Processing $location\$storeName..." "Info"
            $result = Restore-CertificateStore -Location $location -StoreName $storeName -BackupFolder $BackupPath -Password $Password
            $totalStats.Success += $result.Success
            $totalStats.Errors += $result.Errors
            $totalStats.Skipped += $result.Skipped
        }
    }
    
    Write-Log "Restore completed! Total: $($totalStats.Success) certificates restored, $($totalStats.Skipped) skipped, $($totalStats.Errors) errors" "Success"
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Success: $($totalStats.Success)" -ForegroundColor Green
if ($totalStats.Skipped -gt 0) {
    Write-Host "  Skipped: $($totalStats.Skipped)" -ForegroundColor Yellow
}
if ($totalStats.Errors -gt 0) {
    Write-Host "  Errors: $($totalStats.Errors)" -ForegroundColor Red
}