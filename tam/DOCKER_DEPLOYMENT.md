# 🐳 Docker Deployment Guide for TAM App

This guide provides comprehensive instructions for deploying the TAM App using Docker and Docker Compose.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Services](#services)
- [Deployment Commands](#deployment-commands)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Performance](#performance)

## 🔧 Prerequisites

### Required Software
- **Docker** >= 20.10.0
- **Docker Compose** >= 2.0.0
- **Git** (for cloning the repository)
- **OpenSSL** (for SSL certificate generation)

### System Requirements
- **RAM**: Minimum 4GB, Recommended 8GB
- **CPU**: Minimum 2 cores, Recommended 4 cores
- **Storage**: Minimum 10GB free space
- **Network**: Internet connection for pulling images

### Installation

#### Windows
```powershell
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Install Chocolatey (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Docker via Chocolatey
choco install docker-desktop
```

#### macOS
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker Desktop
brew install --cask docker
```

#### Linux (Ubuntu/Debian)
```bash
# Update package index
sudo apt-get update

# Install Docker
sudo apt-get install docker.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Restart Docker
sudo systemctl restart docker
```

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/tam-app.git
cd tam-app/tam
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.docker .env

# Edit environment variables
nano .env
```

### 3. Deploy the Application
```bash
# Linux/macOS
chmod +x scripts/docker-deploy.sh
./scripts/docker-deploy.sh deploy

# Windows
.\scripts\docker-deploy.ps1 deploy
```

### 4. Access the Application
- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **Secure API**: http://localhost/secure-api
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.docker`:

```bash
# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
CLUSTER_WORKERS=auto

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password
REDIS_MAXMEMORY=256mb

# JWT Configuration
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_minimum_32_characters

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
ENABLE_AUTHENTICATION=true
ENABLE_AUTHORIZATION=true
ENABLE_RATE_LIMITING=true
ENABLE_SECURITY_HEADERS=true

# Frontend
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_SECURE_API_URL=https://yourdomain.com/secure-api

# Monitoring
GRAFANA_ADMIN_PASSWORD=your_grafana_password
```

### SSL Configuration

For development, self-signed certificates are automatically generated. For production:

```bash
# Place your SSL certificates in:
docker/nginx/ssl/cert.pem
docker/nginx/ssl/key.pem
```

## 🏗️ Services

### Core Services

| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| Frontend | 3000 | React Native Web App | `/health` |
| Backend | 3006 | Main API Server | `/health` |
| Secure Backend | 3011 | Authenticated API | `/health` |
| Lifecycle Backend | 3009 | API Lifecycle Management | `/health` |
| Redis | 6379 | Caching & Rate Limiting | Redis CLI |
| Nginx | 80/443 | Reverse Proxy & Load Balancer | `/health` |

### Monitoring Services

| Service | Port | Description | Access |
|---------|------|-------------|--------|
| Prometheus | 9090 | Metrics Collection | http://localhost:9090 |
| Grafana | 3001 | Visualization Dashboard | http://localhost:3001 |

### Service Dependencies

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │    Nginx    │    │ Prometheus  │
│    (3000)   │────│   (80/443)  │────│   (9090)   │
└─────────────┘    └─────────────┘    └─────────────┘
        │                   │                   │
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Backend   │    │ Secure API  │    │   Grafana   │
│   (3006)    │    │   (3011)    │    │   (3001)   │
└─────────────┘    └─────────────┘    └─────────────┘
        │                   │
        ▼                   ▼
┌─────────────────────────────────────┐
│              Redis                  │
│              (6379)                 │
└─────────────────────────────────────┘
```

## 🎮 Deployment Commands

### Automated Deployment Scripts

#### Linux/macOS
```bash
# Full deployment
./scripts/docker-deploy.sh deploy

# Build images only
./scripts/docker-deploy.sh build

# Start services
./scripts/docker-deploy.sh start

# Stop services
./scripts/docker-deploy.sh stop

# Restart services
./scripts/docker-deploy.sh restart

# View logs
./scripts/docker-deploy.sh logs

# Check health
./scripts/docker-deploy.sh health

# Show URLs
./scripts/docker-deploy.sh urls

# Cleanup
./scripts/docker-deploy.sh cleanup
```

#### Windows PowerShell
```powershell
# Full deployment
.\scripts\docker-deploy.ps1 deploy

# Build images only
.\scripts\docker-deploy.ps1 build

# Start services
.\scripts\docker-deploy.ps1 start

# Stop services
.\scripts\docker-deploy.ps1 stop

# Restart services
.\scripts\docker-deploy.ps1 restart

# View logs
.\scripts\docker-deploy.ps1 logs

# Check health
.\scripts\docker-deploy.ps1 health

# Show URLs
.\scripts\docker-deploy.ps1 urls

# Cleanup
.\scripts\docker-deploy.ps1 cleanup
```

### Manual Docker Commands

```bash
# Build and start all services
docker-compose up -d --build

# Start specific services
docker-compose up -d redis backend

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=3

# Update services
docker-compose pull
docker-compose up -d
```

## 📊 Monitoring

### Prometheus Metrics

Access Prometheus at http://localhost:9090

**Available Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `nodejs_heap_size_used_bytes` - Memory usage
- `redis_connected_clients` - Redis connections
- `nginx_connections_total` - Nginx connections

### Grafana Dashboards

Access Grafana at http://localhost:3001

**Default Login:**
- Username: `admin`
- Password: Set in `.env` file (`GRAFANA_ADMIN_PASSWORD`)

**Pre-configured Dashboards:**
- Application Overview
- API Performance
- System Resources
- Security Events

### Health Checks

```bash
# Check all services
curl http://localhost/health

# Check specific services
curl http://localhost/api/health
curl http://localhost/secure-api/health
curl http://localhost/lifecycle-api/health

# Docker health checks
docker-compose ps
docker-compose exec backend curl -f http://localhost:3006/health
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :3006

# Change ports in docker-compose.yml
ports:
  - "3001:3000"  # Change frontend port
```

#### 2. Permission Issues
```bash
# Fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker

# Fix file permissions
sudo chown -R $USER:$USER ./docker/nginx/ssl
chmod 600 ./docker/nginx/ssl/key.pem
```

#### 3. Memory Issues
```bash
# Check memory usage
docker stats

# Increase Docker memory limit in Docker Desktop
# Or limit container memory in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G
```

#### 4. Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

#### 5. SSL Certificate Issues
```bash
# Regenerate certificates
rm -rf docker/nginx/ssl/
./scripts/docker-deploy.sh deploy

# Check certificate validity
openssl x509 -in docker/nginx/ssl/cert.pem -text -noout
```

### Debug Commands

```bash
# View container logs
docker-compose logs -f [service_name]

# Execute commands in container
docker-compose exec backend sh
docker-compose exec redis redis-cli

# Inspect container
docker inspect [container_name]

# Check resource usage
docker stats

# Network debugging
docker-compose exec backend ping redis
```

## 🔒 Security

### Production Security Checklist

- [ ] Change default passwords
- [ ] Use proper SSL certificates
- [ ] Configure firewall rules
- [ ] Enable security headers
- [ ] Set up monitoring alerts
- [ ] Regular security updates
- [ ] Backup configurations
- [ ] Access control policies

### Security Headers

All services include comprehensive security headers:

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

### Rate Limiting

- **Global**: 100 requests/15 minutes
- **Authentication**: 5 requests/15 minutes
- **API endpoints**: 10 requests/second

### Access Control

```bash
# Restrict access to monitoring
# Add to docker/nginx/nginx.conf
location /grafana {
    allow 192.168.1.0/24;
    deny all;
    proxy_pass http://grafana:3000;
}
```

## ⚡ Performance

### Optimization Tips

#### 1. Resource Allocation
```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

#### 2. Caching Strategy
```bash
# Redis optimization
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 3. Load Balancing
```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Check load distribution
docker-compose exec backend ps aux
```

#### 4. Database Optimization
```bash
# Connection pooling
# Set in environment variables
DATABASE_POOL_SIZE=20
DATABASE_POOL_MIN=5
```

### Performance Monitoring

```bash
# Monitor resource usage
docker stats --no-stream

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost/api/health

# Monitor queue depth
docker-compose exec redis redis-cli llen rate_limit_queue
```

### Scaling

#### Horizontal Scaling
```bash
# Scale backend services
docker-compose up -d --scale backend=5 --scale secure-backend=3

# Add load balancer
docker-compose up -d nginx
```

#### Vertical Scaling
```bash
# Increase container resources
docker-compose up -d --memory=2g --cpus=2.0
```

## 🔄 Updates and Maintenance

### Updating Services
```bash
# Pull latest images
docker-compose pull

# Recreate services
docker-compose up -d --force-recreate

# Clean up old images
docker image prune -f
```

### Backup and Restore
```bash
# Backup volumes
docker run --rm -v tam_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v tam_redis_data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data
```

### Log Management
```bash
# Rotate logs
docker-compose exec backend logrotate -f /etc/logrotate.conf

# Archive logs
docker-compose exec backend tar czf /app/logs/archive-$(date +%Y%m%d).tar.gz /app/logs/*.log
```

## 📚 Additional Resources

### Documentation
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Redis Documentation](https://redis.io/documentation)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

### Support

For issues and questions:
1. Check the troubleshooting section
2. Review service logs
3. Consult the documentation
4. Create an issue in the repository

---

**🎉 Your TAM App is now ready for production deployment with Docker!**
