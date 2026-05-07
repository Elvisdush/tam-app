# TAM App Docker Deployment Script (Simple Version)
# Automates the complete Docker deployment process

# Configuration
$PROJECT_NAME = "tam-app"
$COMPOSE_FILE = "docker-compose.yml"
$ENV_FILE = ".env.docker"

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    White = "White"
}

# Functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" "Blue"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[WARNING] $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" "Red"
}

# Check if Docker is installed
function Test-DockerInstallation {
    try {
        docker --version | Out-Null
        docker-compose --version | Out-Null
        Write-Success "Docker and Docker Compose are installed"
        return $true
    } catch {
        Write-Error "Docker or Docker Compose is not installed. Please install Docker first."
        return $false
    }
}

# Check if environment file exists
function Test-EnvironmentFile {
    if (-not (Test-Path $ENV_FILE)) {
        Write-Warning "Environment file $ENV_FILE not found"
        Write-Info "Creating environment file from template..."
        
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" $ENV_FILE
            Write-Success "Environment file created from .env.example"
        } else {
            Write-Error "No .env.example file found. Please create $ENV_FILE manually."
            return $false
        }
    }
    
    Write-Success "Environment file $ENV_FILE exists"
    return $true
}

# Generate SSL certificates (self-signed for development)
function New-SSLCertificates {
    Write-Info "Generating SSL certificates..."
    
    $sslDir = "docker/nginx/ssl"
    if (-not (Test-Path $sslDir)) {
        New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    }
    
    $certPath = Join-Path $sslDir "cert.pem"
    $keyPath = Join-Path $sslDir "key.pem"
    
    if (-not (Test-Path $certPath) -or -not (Test-Path $keyPath)) {
        try {
            # Fallback to OpenSSL if available
            if (Get-Command openssl -ErrorAction SilentlyContinue) {
                openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $keyPath -out $cert.pem -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
                Write-Success "SSL certificates generated with OpenSSL"
            } else {
                Write-Warning "OpenSSL not found. SSL certificates not generated."
            }
        } catch {
            Write-Warning "Failed to generate SSL certificates."
        }
    } else {
        Write-Info "SSL certificates already exist"
    }
}

# Build Docker images
function Build-DockerImages {
    Write-Info "Building Docker images..."
    
    try {
        docker-compose build --no-cache
        Write-Success "Docker images built successfully"
    } catch {
        Write-Error "Failed to build Docker images: $($_.Exception.Message)"
        return $false
    }
    return $true
}

# Start services
function Start-Services {
    Write-Info "Starting Docker services..."
    
    try {
        # Start with dependencies first
        docker-compose up -d redis
        
        # Wait for Redis to be ready
        Write-Info "Waiting for Redis to be ready..."
        Start-Sleep 10
        
        # Start backend services
        docker-compose up -d backend secure-backend lifecycle-backend
        
        # Wait for backend services to be ready
        Write-Info "Waiting for backend services to be ready..."
        Start-Sleep 20
        
        # Start frontend and nginx
        docker-compose up -d frontend nginx
        
        # Start monitoring services
        docker-compose up -d prometheus grafana
        
        Write-Success "All services started successfully"
    } catch {
        Write-Error "Failed to start services: $($_.Exception.Message)"
        return $false
    }
    return $true
}

# Check service health
function Test-ServiceHealth {
    Write-Info "Checking service health..."
    
    # Wait for services to be fully ready
    Start-Sleep 30
    
    # Check each service
    $services = @("redis", "backend", "secure-backend", "lifecycle-backend", "frontend", "nginx", "prometheus", "grafana")
    
    foreach ($service in $services) {
        $status = docker-compose ps $service
        if ($status -match "Up") {
            Write-Success "$service is running"
        } else {
            Write-Error "$service is not running"
        }
    }
}

# Show service URLs
function Show-ServiceURLs {
    Write-Info "Service URLs:"
    Write-Host ""
    Write-Host "🌐 Frontend: http://localhost" -ForegroundColor Green
    Write-Host "🔧 Backend API: http://localhost/api" -ForegroundColor Green
    Write-Host "🔒 Secure API: http://localhost/secure-api" -ForegroundColor Green
    Write-Host "🔄 Lifecycle API: http://localhost/lifecycle-api" -ForegroundColor Green
    Write-Host "📊 Prometheus: http://localhost:9090" -ForegroundColor Green
    Write-Host "📈 Grafana: http://localhost:3001" -ForegroundColor Green
    Write-Host "💾 Redis: localhost:6379" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔑 Grafana Login: admin / (check .env.docker for password)" -ForegroundColor Yellow
    Write-Host ""
}

# Main deployment function
function Invoke-Deployment {
    Write-Info "Starting TAM App Docker deployment..."
    
    if (-not (Test-DockerInstallation)) {
        return
    }
    
    if (-not (Test-EnvironmentFile)) {
        return
    }
    
    New-SSLCertificates
    
    if (-not (Build-DockerImages)) {
        return
    }
    
    if (-not (Start-Services)) {
        return
    }
    
    Test-ServiceHealth
    Show-ServiceURLs
    
    Write-Success "🎉 TAM App deployment completed successfully!"
}

# Parse command line arguments
$command = $args[0]
if (-not $command) {
    $command = "deploy"
}

switch ($command.ToLower()) {
    "deploy" {
        Invoke-Deployment
    }
    "build" {
        if (Test-DockerInstallation -and Test-EnvironmentFile) {
            Build-DockerImages
        }
    }
    "start" {
        if (Test-DockerInstallation -and Test-EnvironmentFile) {
            Start-Services
            Test-ServiceHealth
            Show-ServiceURLs
        }
    }
    "stop" {
        Write-Info "Stopping services..."
        docker-compose down
        Write-Success "Services stopped"
    }
    "restart" {
        Write-Info "Restarting services..."
        docker-compose restart
        Test-ServiceHealth
        Show-ServiceURLs
    }
    "logs" {
        Write-Info "Showing logs for all services..."
        docker-compose logs -f
    }
    "health" {
        Test-ServiceHealth
    }
    "urls" {
        Show-ServiceURLs
    }
    "help" {
        Write-Host "Usage: .\docker-deploy-simple.ps1 [command]" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor Yellow
        Write-Host "  deploy    - Full deployment (default)" -ForegroundColor White
        Write-Host "  build     - Build Docker images" -ForegroundColor White
        Write-Host "  start     - Start services" -ForegroundColor White
        Write-Host "  stop      - Stop services" -ForegroundColor White
        Write-Host "  restart   - Restart services" -ForegroundColor White
        Write-Host "  logs      - Show logs" -ForegroundColor White
        Write-Host "  health    - Check service health" -ForegroundColor White
        Write-Host "  urls      - Show service URLs" -ForegroundColor White
        Write-Host "  help      - Show this help message" -ForegroundColor White
    }
    default {
        Write-Error "Unknown command: $command"
        Write-Host "Use '.\docker-deploy-simple.ps1 help' for available commands" -ForegroundColor Yellow
    }
}
