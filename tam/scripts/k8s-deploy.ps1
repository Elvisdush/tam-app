# TAM App — Kubernetes deploy helper (local / minikube / kind)
param(
  [Parameter(Position = 0)]
  [ValidateSet('build', 'secrets', 'apply', 'status', 'delete', 'all')]
  [string]$Action = 'all',

  [string]$Overlay = 'local',
  [string]$ImageName = 'tam-backend:latest',
  [string]$ClusterType = 'minikube'  # minikube | kind | docker-desktop
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $Root

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

switch ($Action) {
  'build' {
    Write-Step "Building Docker image: $ImageName"
    docker build -f Dockerfile.k8s -t $ImageName .
    if ($ClusterType -eq 'minikube') {
      Write-Step "Loading image into minikube"
      minikube image load $ImageName
    }
    elseif ($ClusterType -eq 'kind') {
      Write-Step "Loading image into kind"
      kind load docker-image $ImageName
    }
  }
  'secrets' {
    $secretsFile = Join-Path $Root "k8s\base\secrets.yaml"
    if (-not (Test-Path $secretsFile)) {
      Write-Step "Creating secrets.yaml from example — edit passwords before production"
      Copy-Item (Join-Path $Root "k8s\base\secrets.example.yaml") $secretsFile
    }
    kubectl apply -f (Join-Path $Root "k8s\base\namespace.yaml")
    kubectl apply -f $secretsFile
  }
  'apply' {
    Write-Step "Applying Kustomize overlay: $Overlay"
    kubectl apply -k (Join-Path $Root "k8s\overlays\$Overlay")
  }
  'status' {
    kubectl -n tam-app get pods,svc,ingress,pvc
  }
  'delete' {
    kubectl delete -k (Join-Path $Root "k8s\overlays\$Overlay") --ignore-not-found
    kubectl delete -f (Join-Path $Root "k8s\base\secrets.yaml") -n tam-app --ignore-not-found 2>$null
  }
  'all' {
    & $PSCommandPath build -ImageName $ImageName -ClusterType $ClusterType
    & $PSCommandPath secrets
    & $PSCommandPath apply -Overlay $Overlay
    & $PSCommandPath status
    Write-Host "`nAPI (NodePort): http://localhost:30080/health" -ForegroundColor Green
    Write-Host "Ingress (if configured): http://api.tam.local/health" -ForegroundColor Green
  }
}
