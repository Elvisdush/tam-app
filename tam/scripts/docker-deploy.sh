#!/bin/bash

# TAM App Docker Deployment Script
# Automates the complete Docker deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="tam-app"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.docker"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Docker and Docker Compose are installed"
}

# Check if environment file exists
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Environment file $ENV_FILE not found"
        log_info "Creating environment file from template..."
        
        if [ -f ".env.example" ]; then
            cp .env.example "$ENV_FILE"
            log_info "Environment file created from .env.example"
        else
            log_error "No .env.example file found. Please create $ENV_FILE manually."
            exit 1
        fi
    fi
    
    log_success "Environment file $ENV_FILE exists"
}

# Generate SSL certificates (self-signed for development)
generate_ssl() {
    log_info "Generating SSL certificates..."
    
    mkdir -p docker/nginx/ssl
    
    if [ ! -f "docker/nginx/ssl/cert.pem" ] || [ ! -f "docker/nginx/ssl/key.pem" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout docker/nginx/ssl/key.pem \
            -out docker/nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        log_success "SSL certificates generated"
    else
        log_info "SSL certificates already exist"
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    # Build with no cache to ensure fresh builds
    docker-compose build --no-cache
    
    log_success "Docker images built successfully"
}

# Start services
start_services() {
    log_info "Starting Docker services..."
    
    # Start with dependencies first
    docker-compose up -d redis
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    sleep 10
    
    # Start backend services
    docker-compose up -d backend secure-backend lifecycle-backend
    
    # Wait for backend services to be ready
    log_info "Waiting for backend services to be ready..."
    sleep 20
    
    # Start frontend and nginx
    docker-compose up -d frontend nginx
    
    # Start monitoring services
    docker-compose up -d prometheus grafana
    
    log_success "All services started successfully"
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    # Wait for services to be fully ready
    sleep 30
    
    # Check each service
    services=("redis" "backend" "secure-backend" "lifecycle-backend" "frontend" "nginx" "prometheus" "grafana")
    
    for service in "${services[@]}"; do
        if docker-compose ps "$service" | grep -q "Up"; then
            log_success "$service is running"
        else
            log_error "$service is not running"
        fi
    done
    
    # Check health endpoints
    log_info "Checking health endpoints..."
    
    # Frontend health
    if curl -f http://localhost/health &> /dev/null; then
        log_success "Frontend health check passed"
    else
        log_warning "Frontend health check failed"
    fi
    
    # Backend health
    if curl -f http://localhost/api/health &> /dev/null; then
        log_success "Backend health check passed"
    else
        log_warning "Backend health check failed"
    fi
    
    # Secure backend health
    if curl -f http://localhost/secure-api/health &> /dev/null; then
        log_success "Secure backend health check passed"
    else
        log_warning "Secure backend health check failed"
    fi
}

# Show service URLs
show_urls() {
    log_info "Service URLs:"
    echo ""
    echo "🌐 Frontend: http://localhost"
    echo "🔧 Backend API: http://localhost/api"
    echo "🔒 Secure API: http://localhost/secure-api"
    echo "🔄 Lifecycle API: http://localhost/lifecycle-api"
    echo "📊 Prometheus: http://localhost:9090"
    echo "📈 Grafana: http://localhost:3001"
    echo "💾 Redis: localhost:6379"
    echo ""
    echo "🔑 Grafana Login: admin / (check .env.docker for password)"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    docker-compose down
    docker system prune -f
    log_success "Cleanup completed"
}

# Show logs
show_logs() {
    log_info "Showing logs for all services..."
    docker-compose logs -f
}

# Main deployment function
deploy() {
    log_info "Starting TAM App Docker deployment..."
    
    check_docker
    check_env_file
    generate_ssl
    build_images
    start_services
    check_health
    show_urls
    
    log_success "🎉 TAM App deployment completed successfully!"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "build")
        check_docker
        check_env_file
        build_images
        ;;
    "start")
        check_docker
        check_env_file
        start_services
        check_health
        show_urls
        ;;
    "stop")
        log_info "Stopping services..."
        docker-compose down
        log_success "Services stopped"
        ;;
    "restart")
        log_info "Restarting services..."
        docker-compose restart
        check_health
        show_urls
        ;;
    "logs")
        show_logs
        ;;
    "cleanup")
        cleanup
        ;;
    "health")
        check_health
        ;;
    "urls")
        show_urls
        ;;
    "help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment (default)"
        echo "  build     - Build Docker images"
        echo "  start     - Start services"
        echo "  stop      - Stop services"
        echo "  restart   - Restart services"
        echo "  logs      - Show logs"
        echo "  cleanup   - Clean up containers and images"
        echo "  health    - Check service health"
        echo "  urls      - Show service URLs"
        echo "  help      - Show this help message"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for available commands"
        exit 1
        ;;
esac
