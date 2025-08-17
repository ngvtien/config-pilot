param(
    [string]$RootCAName = "Dev Local Root CA",
    [string]$ServerCN = "*.dev.local",
    [string]$ClientCN = "Dev Client",
    [string]$PfxPassword = "DevCertPass123",
    [switch]$Force = $false
)

function Test-CertificateExists {
    param(
        [string]$Subject,
        [string]$StoreLocation = "Cert:\CurrentUser\My",
        [string]$StoreName = "My"
    )
    
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store $StoreName, $StoreLocation
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
    $certs = $store.Certificates.Find("FindBySubjectName", $Subject, $false)
    $store.Close()
    
    return $certs.Count -gt 0
}

function Remove-ExistingCertificate {
    param(
        [string]$Subject,
        [string]$StoreLocation = "Cert:\CurrentUser\My",
        [string]$StoreName = "My"
    )
    
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store $StoreName, $StoreLocation
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $certs = $store.Certificates.Find("FindBySubjectName", $Subject, $false)
    
    foreach ($cert in $certs) {
        $store.Remove($cert)
        Write-Host "Removed existing certificate: $Subject"
    }
    
    $store.Close()
}

# Check for existing Root CA
$rootCAExists = Test-CertificateExists -Subject $RootCAName -StoreName "Root"
if ($rootCAExists -and -not $Force) {
    Write-Host "Root CA '$RootCAName' already exists in Trusted Root store. Use -Force to recreate."
} else {
    if ($rootCAExists -and $Force) {
        Remove-ExistingCertificate -Subject $RootCAName -StoreName "Root"
    }

    Write-Host "=== Generating Dev Root CA ==="
    $rootCA = New-SelfSignedCertificate `
        -Type Custom `
        -KeySpec Signature `
        -Subject "CN=$RootCAName" `
        -KeyExportPolicy Exportable `
        -KeyLength 2048 `
        -HashAlgorithm sha256 `
        -KeyUsage CertSign, CRLSign, DigitalSignature `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -TextExtension @("2.5.29.19={text}CA=true")

    # Trust the Root CA locally
    $rootCAPath = "$PSScriptRoot\DevRootCA.cer"
    Export-Certificate -Cert $rootCA -FilePath $rootCAPath | Out-Null
    Import-Certificate -FilePath $rootCAPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
}

# Check for existing Server Cert
$serverCertExists = Test-CertificateExists -Subject $ServerCN
if ($serverCertExists -and -not $Force) {
    Write-Host "Server certificate '$ServerCN' already exists. Use -Force to recreate."
} else {
    if ($serverCertExists -and $Force) {
        Remove-ExistingCertificate -Subject $ServerCN
    }

    Write-Host "=== Generating Server Cert ($ServerCN) ==="
    $rootCA = Get-ChildItem -Path "Cert:\CurrentUser\My" | Where-Object { $_.Subject -eq "CN=$RootCAName" } | Select-Object -First 1
    if (-not $rootCA) {
        throw "Root CA not found. Cannot create server certificate."
    }

    $serverCert = New-SelfSignedCertificate `
        -Type Custom `
        -DnsName $ServerCN `
        -KeySpec Signature `
        -Subject "CN=$ServerCN" `
        -Signer $rootCA `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyExportPolicy Exportable `
        -KeyLength 2048 `
        -HashAlgorithm sha256 `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")  # Server Authentication OID

    # Export PFX even if cert existed (in case password changed or file was deleted)
    Export-PfxCertificate -Cert $serverCert -FilePath "$PSScriptRoot\ServerCert.pfx" -Password (ConvertTo-SecureString $PfxPassword -AsPlainText -Force) | Out-Null
}

# Check for existing Client Cert
$clientCertExists = Test-CertificateExists -Subject $ClientCN
if ($clientCertExists -and -not $Force) {
    Write-Host "Client certificate '$ClientCN' already exists. Use -Force to recreate."
} else {
    if ($clientCertExists -and $Force) {
        Remove-ExistingCertificate -Subject $ClientCN
    }

    Write-Host "=== Generating Client Cert ($ClientCN) ==="
    $rootCA = Get-ChildItem -Path "Cert:\CurrentUser\My" | Where-Object { $_.Subject -eq "CN=$RootCAName" } | Select-Object -First 1
    if (-not $rootCA) {
        throw "Root CA not found. Cannot create client certificate."
    }

    $clientCert = New-SelfSignedCertificate `
        -Type Custom `
        -Subject "CN=$ClientCN" `
        -KeySpec Signature `
        -Signer $rootCA `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyExportPolicy Exportable `
        -KeyLength 2048 `
        -HashAlgorithm sha256 `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.2")  # Client Authentication OID

    # Export PFX even if cert existed (in case password changed or file was deleted)
    Export-PfxCertificate -Cert $clientCert -FilePath "$PSScriptRoot\ClientCert.pfx" -Password (ConvertTo-SecureString $PfxPassword -AsPlainText -Force) | Out-Null
}

Write-Host "=== Setup Complete ==="
Write-Host "Root CA installed to CurrentUser\Trusted Root Certification Authorities"
Write-Host "Server and Client certs installed to CurrentUser\Personal"