@echo off
REM TAM App Docker Deployment Script (Batch)
REM Automates the complete Docker deployment process

setlocal enabledelayedexpansion

REM Configuration
set PROJECT_NAME=tam-app
set COMPOSE_FILE=docker-compose.yml
set ENV_FILE=.env.docker

REM Colors for output
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "WHITE=[97m"
set "RESET=[0m"

REM Functions
:log_info
echo %BLUE%[INFO]%RESET% %~1
goto :eof

:log_success
echo %GREEN%[SUCCESS]%RESET% %~1
goto :eof

:log_warning
echo %YELLOW%[WARNING]%RESET% %~1
goto :eof

:log_error
echo %RED%[ERROR]%RESET% %~1
goto :eof

REM Check if Docker is installed
:check_docker
call :log_info "Checking Docker installation..."
docker --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker is not installed. Please install Docker first."
    exit /b 1
)
docker-compose --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit /b 1
)
call :log_success "Docker and Docker Compose are installed"
goto :eof

REM Check if environment file exists
:check_env_file
if not exist "%ENV_FILE%" (
    call :log_warning "Environment file %ENV_FILE% not found"
    call :log_info "Creating environment file from template..."
    
    if exist ".env.example" (
        copy ".env.example" "%ENV_FILE%" >nul
        call :log_success "Environment file created from .env.example"
    ) else (
        call :log_error "No .env.example file found. Please create %ENV_FILE% manually."
        exit /b 1
    )
)
call :log_success "Environment file %ENV_FILE% exists"
goto :eof

REM Generate SSL certificates
:generate_ssl
call :log_info "Generating SSL certificates..."

if not exist "docker\nginx\ssl" (
    mkdir "docker\nginx\ssl" >nul
)

if not exist "docker\nginx\ssl\cert.pem" (
    if exist "docker\nginx\ssl\key.pem" (
        del "docker\nginx\ssl\key.pem" >nul
    )
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "docker\nginx\ssl\key.pem" -out "docker\nginx\ssl\cert.pem" -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" >nul 2>&1
    if errorlevel 1 (
        call :log_warning "Failed to generate SSL certificates with OpenSSL"
    ) else (
        call :log_success "SSL certificates generated"
    )
) else (
    call :log_info "SSL certificates already exist"
)
goto :eof

REM Build Docker images
:build_images
call :log_info "Building Docker images..."
docker-compose build --no-cache
if errorlevel 1 (
    call :log_error "Failed to build Docker images"
    exit /b 1
)
call :log_success "Docker images built successfully"
goto :eof

REM Start services
:start_services
call :log_info "Starting Docker services..."

REM Start with dependencies first
docker-compose up -d redis
if errorlevel 1 (
    call :log_error "Failed to start Redis"
    exit /b 1
)

REM Wait for Redis to be ready
call :log_info "Waiting for Redis to be ready..."
timeout /t 10 /nobreak >nul

REM Start backend services
docker-compose up -d backend secure-backend lifecycle-backend
if errorlevel 1 (
    call :log_error "Failed to start backend services"
    exit /b 1
)

REM Wait for backend services to be ready
call :log_info "Waiting for backend services to be ready..."
timeout /t 20 /nobreak >nul

REM Start frontend and nginx
docker-compose up -d frontend nginx
if errorlevel 1 (
    call :log_error "Failed to start frontend and nginx"
    exit /b 1
)

REM Start monitoring services
docker-compose up -d prometheus grafana
if errorlevel 1 (
    call :log_error "Failed to start monitoring services"
    exit /b 1
)

call :log_success "All services started successfully"
goto :eof

REM Check service health
:check_health
call :log_info "Checking service health..."

REM Wait for services to be fully ready
timeout /t 30 /nobreak >nul

REM Check each service
for %%s in (redis backend secure-backend lifecycle-backend frontend nginx prometheus grafana) do (
    docker-compose ps %%s | findstr "Up" >nul
    if errorlevel 1 (
        call :log_error "%%s is not running"
    ) else (
        call :log_success "%%s is running"
    )
)
goto :eof

REM Show service URLs
:show_urls
call :log_info "Service URLs:"
echo.
echo %GREEN%🌐 Frontend: http://localhost%RESET%
echo %GREEN%🔧 Backend API: http://localhost/api%RESET%
echo %GREEN%🔒 Secure API: http://localhost/secure-api%RESET%
echo %GREEN%🔄 Lifecycle API: http://localhost/lifecycle-api%RESET%
echo %GREEN%📊 Prometheus: http://localhost:9090%RESET%
echo %GREEN%📈 Grafana: http://localhost:3001%RESET%
echo %GREEN%💾 Redis: localhost:6379%RESET%
echo.
echo %YELLOW%🔑 Grafana Login: admin / (check .env.docker for password)%RESET%
echo.
goto :eof

REM Main deployment function
:deploy
call :log_info "Starting TAM App Docker deployment..."

call :check_docker
if errorlevel 1 exit /b 1

call :check_env_file
if errorlevel 1 exit /b 1

call :generate_ssl

call :build_images
if errorlevel 1 exit /b 1

call :start_services
if errorlevel 1 exit /b 1

call :check_health
call :show_urls

call :log_success "🎉 TAM App deployment completed successfully!"
goto :eof

REM Cleanup function
:cleanup
call :log_info "Cleaning up..."
docker-compose down
docker system prune -f
call :log_success "Cleanup completed"
goto :eof

REM Show logs
:show_logs
call :log_info "Showing logs for all services..."
docker-compose logs -f
goto :eof

REM Parse command line arguments
set "command=%1"
if "%command%"=="" set "command=deploy"

if "%command%"=="deploy" (
    call :deploy
) else if "%command%"=="build" (
    call :check_docker
    if not errorlevel 1 call :check_env_file
    if not errorlevel 1 call :build_images
) else if "%command%"=="start" (
    call :check_docker
    if not errorlevel 1 call :check_env_file
    if not errorlevel 1 call :start_services
    if not errorlevel 1 call :check_health
    if not errorlevel 1 call :show_urls
) else if "%command%"=="stop" (
    call :log_info "Stopping services..."
    docker-compose down
    call :log_success "Services stopped"
) else if "%command%"=="restart" (
    call :log_info "Restarting services..."
    docker-compose restart
    call :check_health
    call :show_urls
) else if "%command%"=="logs" (
    call :show_logs
) else if "%command%"=="health" (
    call :check_health
) else if "%command%"=="urls" (
    call :show_urls
) else if "%command%"=="help" (
    echo Usage: docker-deploy-cmd.bat [command]
    echo.
    echo Commands:
    echo   deploy    - Full deployment (default)
    echo   build     - Build Docker images
    echo   start     - Start services
    echo   stop      - Stop services
    echo   restart   - Restart services
    echo   logs      - Show logs
    echo   health    - Check service health
    echo   urls      - Show service URLs
    echo   help      - Show this help message
) else (
    call :log_error "Unknown command: %command%"
    echo Use 'docker-deploy-cmd.bat help' for available commands
)

endlocal
