@echo off
REM Complete Docker Deployment Verification Script

echo.
echo %CYAN%🔍 TAM App Docker Deployment Verification%RESET%
echo %CYAN%=========================================%RESET%
echo.

REM Check Docker containers
echo %BLUE%[1] Checking Docker containers...%RESET%
docker-compose ps
echo.

REM Check Redis
echo %BLUE%[2] Checking Redis connection...%RESET%
docker-compose exec -T redis redis-cli ping
echo.

REM Check health endpoints
echo %BLUE%[3] Checking health endpoints...%RESET%

echo Checking Frontend...
curl -f http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Frontend health check failed%RESET%
) else (
    echo %GREEN%✅ Frontend health check passed%RESET%
)

echo Checking Backend API...
curl -f http://localhost:3006/health >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Backend API health check failed%RESET%
) else (
    echo %GREEN%✅ Backend API health check passed%RESET%
)

echo Checking Secure Backend...
curl -f http://localhost:3011/health >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Secure Backend health check failed%RESET%
) else (
    echo %GREEN%✅ Secure Backend health check passed%RESET%
)

echo Checking Nginx...
curl -f http://localhost/health >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Nginx health check failed%RESET%
) else (
    echo %GREEN%✅ Nginx health check passed%RESET%
)

echo Checking Prometheus...
curl -f http://localhost:9090 >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Prometheus health check failed%RESET%
) else (
    echo %GREEN%✅ Prometheus health check passed%RESET%
)

echo Checking Grafana...
curl -f http://localhost:3001/api/health >nul 2>&1
if errorlevel 1 (
    echo %RED%❌ Grafana health check failed%RESET%
) else (
    echo %GREEN%✅ Grafana health check passed%RESET%
)

echo.

REM Summary
echo %CYAN%📊 Verification Summary%RESET%
echo %CYAN%======================%RESET%
echo.
echo %GREEN%🌐 Frontend: http://localhost%RESET%
echo %GREEN%🔧 Backend API: http://localhost/api%RESET%
echo %GREEN%🔒 Secure API: http://localhost/secure-api%RESET%
echo %GREEN%🔄 Lifecycle API: http://localhost/lifecycle-api%RESET%
echo %GREEN%📊 Prometheus: http://localhost:9090%RESET%
echo %GREEN%📈 Grafana: http://localhost:3001%RESET%
echo %GREEN%💾 Redis: localhost:6379%RESET%
echo.
echo %YELLOW%🔑 Grafana Login: admin / admin%RESET%
echo.

pause
