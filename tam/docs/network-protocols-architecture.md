# TAM App Network Protocols Architecture

This document explains how application protocols work across the different layers of the TAM App network stack, including the newly integrated AMQP system.

## 🌐 Network Stack Overview

The TAM App operates on a multi-layered network architecture with protocols at each level:

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                    │
├─────────────────────────────────────────────────────┤
│                  Transport Layer                     │
├─────────────────────────────────────────────────────┤
│                   Network Layer                       │
└─────────────────────────────────────────────────────┘
```

## 📱 Application Layer Protocols

### **HTTP/HTTPS**
- **Purpose**: REST API communication between frontend and backend
- **Port**: 3006 (Backend API)
- **Format**: JSON over HTTP/1.1
- **Features**: 
  - CORS headers for cross-origin requests
  - Security headers (XSS protection, content security)
  - Rate limiting headers
  - API versioning
- **Authentication**: JWT tokens, API keys
- **Use Cases**: 
  - Place search requests
  - User authentication
  - Location updates
  - System health checks

### **WebSocket**
- **Purpose**: Real-time bidirectional communication
- **Protocol**: WebSocket over HTTP
- **Use Cases**:
  - Live location updates
  - Real-time notifications
  - Instant messaging
  - Status synchronization

### **AMQP (Advanced Message Queuing Protocol)**
- **Purpose**: Asynchronous message processing and service communication
- **Broker**: RabbitMQ (port 5672)
- **Protocol Features**:
  - Message routing and filtering
  - Persistent message storage
  - Dead letter queues
  - Message acknowledgments
  - Priority queuing
- **Queue Types**:
  - `location.updates` - GPS coordinates, route changes
  - `user.notifications` - Push notifications, alerts
  - `data.processing` - Analytics, reports, transformations
  - `analytics.events` - User behavior tracking
  - `system.tasks` - Maintenance jobs, cleanup
  - `dead.letter` - Failed message handling

### **tRPC**
- **Purpose**: Type-safe RPC communication
- **Protocol**: HTTP POST with JSON-RPC payload
- **Features**:
  - End-to-end TypeScript support
  - Automatic type validation
  - Batch request support
  - Error handling with proper types
- **Use Cases**:
  - Database operations
  - Authentication flows
  - File uploads

## 🚚 Transport Layer Protocols

### **TCP/IP**
- **Purpose**: Reliable, connection-oriented transport
- **Features**:
  - Three-way handshake (SYN, SYN-ACK, ACK)
  - Flow control and congestion management
  - Error detection and recovery
  - Ordered data delivery
- **Ports Used**:
  - 3006: HTTP API
  - 5672: AMQP (RabbitMQ)
  - 6379: Redis
  - 3000: Frontend development

### **TLS/SSL**
- **Purpose**: Secure communication encryption
- **Implementation**:
  - HTTPS for API endpoints
  - TLS for AMQP connections
  - SSL/TLS certificates management
- **Security Features**:
  - End-to-end encryption
  - Certificate validation
  - Perfect forward secrecy

## 🌍 Network Layer Protocols

### **IPv4/IPv6**
- **Purpose**: Network addressing and routing
- **Features**:
  - IP address assignment
  - Packet routing
  - Network segmentation
- **Configuration**:
  - Docker network isolation
  - Bridge networking for containers
  - Port mapping and forwarding

### **Ethernet/Wi-Fi**
- **Purpose**: Physical layer communication
- **Implementation**:
  - 802.11 Wi-Fi for mobile devices
  - Ethernet for server infrastructure
  - Network interface management

## 🔄 Protocol Interactions

### **Request Flow Example**
```
Frontend (HTTP) → Backend API → AMQP Queue → Background Worker → Database
     ↓              ↓              ↓              ↓
  WebSocket      REST API    Message Queue    Async Processing
     ↓              ↓              ↓              ↓
Real-time UI    Rate Limit    Priority Queue   Result Storage
```

### **Message Flow with AMQP**
```
1. API Request → HTTP → Backend (Port 3006)
2. Backend → AMQP → RabbitMQ (Port 5672)
3. RabbitMQ → Worker → Background Processing
4. Worker → Database → Store Results
5. Worker → AMQP → Response Queue
6. Frontend ← WebSocket ← Real-time Updates
```

### **Error Handling Flow**
```
API Request → Rate Limit Check → Authentication → AMQP Publish
     ↓              ↓                ↓
  HTTP 429      HTTP 401          Message Queued
     ↓              ↓                ↓
   Retry Logic   Error Response    Dead Letter Queue
```

## 🛡 Security Protocol Stack

### **Application Layer Security**
- **JWT Authentication**: Token-based API access
- **CORS Policies**: Cross-origin request control
- **Rate Limiting**: DDoS protection
- **Input Validation**: SQL injection prevention
- **Security Headers**: XSS and clickjacking protection

### **Transport Layer Security**
- **TLS Encryption**: End-to-end communication security
- **Certificate Management**: Automated SSL/TLS renewal
- **AMQP Authentication**: Username/password with vhost isolation

### **Network Layer Security**
- **Firewall Rules**: Port-based access control
- **Docker Network Isolation**: Container segmentation
- **IP Whitelisting**: Restricted AMQP access
- **VPN Support**: Secure remote access

## 📊 Performance Protocol Considerations

### **HTTP Optimizations**
- **Keep-Alive**: Connection pooling
- **Compression**: Gzip response encoding
- **Caching**: Redis-based response caching
- **CDN Integration**: Static asset delivery

### **AMQP Optimizations**
- **Message Batching**: High-throughput processing
- **Prefetch Limits**: Controlled consumption
- **Connection Pooling**: Resource efficiency
- **Lazy Loading**: Large payload handling

### **WebSocket Optimizations**
- **Heartbeat**: Connection maintenance
- **Reconnection Logic**: Automatic recovery
- **Message Compression**: Reduced bandwidth usage

## 🔧 Protocol Configuration

### **Environment Variables**
```bash
# HTTP/HTTPS Configuration
PORT=3006
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# AMQP Configuration
AMQP_HOSTNAME=localhost
AMQP_PORT=5672
AMQP_USERNAME=guest
AMQP_PASSWORD=guest
AMQP_VHOST=/
AMQP_HEARTBEAT=60
AMQP_RECONNECT=true
AMQP_MAX_RECONNECT_ATTEMPTS=10

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### **Docker Network Configuration**
```yaml
networks:
  tam-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

services:
  backend:
    networks:
      - tam-network
    ports:
      - "3006:3006"
  
  redis:
    networks:
      - tam-network
    ports:
      - "6379:6379"
  
  rabbitmq:
    networks:
      - tam-network
    ports:
      - "5672:5672"
      - "15672:15672"  # Management UI
```

## 🌐 Protocol Monitoring

### **Health Check Endpoints**
- `GET /health` - Application status
- `GET /api/health` - API service health
- `GET /api/amqp/status` - AMQP connection status
- `GET /api/amqp/stats` - Queue statistics

### **Metrics Collection**
- **HTTP Metrics**: Request latency, response times, error rates
- **AMQP Metrics**: Queue depth, processing times, failure rates
- **Network Metrics**: Bandwidth usage, connection counts, packet loss
- **WebSocket Metrics**: Connection duration, message frequency, reconnection rates

## 🚀 Future Protocol Enhancements

### **Planned Additions**
- **gRPC**: High-performance RPC communication
- **GraphQL**: Flexible data querying
- **Server-Sent Events**: One-way real-time updates
- **HTTP/2**: Multiplexed request handling
- **QUIC**: UDP-based secure transport

### **Scalability Considerations**
- **Horizontal Scaling**: Multiple API instances
- **Load Balancing**: Distributed request routing
- **Message Queue Clustering**: High availability AMQP
- **Database Sharding**: Distributed data storage

This architecture provides a robust, scalable foundation for the TAM App with enterprise-grade message queuing and real-time communication capabilities.
