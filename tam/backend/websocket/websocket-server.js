/**
 * WebSocket Server for Real-time AMQP Updates
 * Consumes messages from AMQP queues and broadcasts to connected clients
 */

const WebSocket = require('ws');
const AMQPService = require('../amqp/amqp-service');
const { v4: uuidv4 } = require('uuid');

class WebSocketServer {
  constructor(options = {}) {
    this.port = options.port || 3007;
    this.wss = null;
    this.clients = new Map();
    this.amqpService = null;
    this.messageQueue = [];
    this.isProcessing = false;
    
    // WebSocket configuration
    this.config = {
      heartbeatInterval: options.heartbeatInterval || 30000,
      maxClients: options.maxClients || 1000,
      messageBufferSize: options.messageBufferSize || 1000,
      reconnectDelay: options.reconnectDelay || 5000
    };
  }

  /**
   * Initialize WebSocket server with AMQP integration
   */
  async initialize() {
    try {
      console.log('🔌 Initializing WebSocket server...');
      
      // Initialize AMQP service
      this.amqpService = new AMQPService({
        hostname: process.env.AMQP_HOSTNAME || 'localhost',
        port: parseInt(process.env.AMQP_PORT) || 5672,
        username: process.env.AMQP_USERNAME || 'guest',
        password: process.env.AMQP_PASSWORD || 'guest',
        vhost: process.env.AMQP_VHOST || '/',
        heartbeat: parseInt(process.env.AMQP_HEARTBEAT) || 60,
        reconnect: true
      });

      // Connect to AMQP
      await this.amqpService.initialize();
      console.log('✅ WebSocket server connected to AMQP');

      // Start WebSocket server
      await this.startWebSocketServer();
      
      // Start AMQP consumers
      await this.startAMQPConsumers();
      
      // Start heartbeat
      this.startHeartbeat();
      
      console.log(`🚀 WebSocket server running on port ${this.port}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Start WebSocket server
   */
  async startWebSocketServer() {
    this.wss = new WebSocket.Server({
      port: this.port,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024, // 1MB max payload
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    console.log(`🌐 WebSocket server listening on port ${this.port}`);
  }

  /**
   * Verify client connection
   */
  verifyClient(info) {
    // Check if max clients reached
    if (this.clients.size >= this.config.maxClients) {
      console.log('⚠️ Max clients reached, rejecting connection');
      return false;
    }

    // Check origin (optional security)
    const origin = info.origin;
    const allowedOrigins = process.env.WEBSOCKET_ALLOWED_ORIGINS?.split(',') || ['*'];
    
    if (allowedOrigins[0] !== '*' && !allowedOrigins.includes(origin)) {
      console.log(`⚠️ Origin not allowed: ${origin}`);
      return false;
    }

    return true;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = uuidv4();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      subscriptions: new Set(),
      lastPing: new Date(),
      messageCount: 0
    };

    this.clients.set(clientId, clientInfo);
    console.log(`🔗 Client connected: ${clientId} (${this.clients.size} total)`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      action: 'connected',
      clientId: clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to TAM App WebSocket'
    });

    // Setup client event handlers
    ws.on('message', (data) => this.handleClientMessage(clientId, data));
    ws.on('close', () => this.handleClientDisconnection(clientId));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    ws.on('pong', () => this.handleClientPong(clientId));
  }

  /**
   * Handle client messages
   */
  handleClientMessage(clientId, data) {
    try {
      const clientInfo = this.clients.get(clientId);
      if (!clientInfo) return;

      const message = JSON.parse(data.toString());
      clientInfo.messageCount++;
      clientInfo.lastPing = new Date();

      console.log(`📨 Message from client ${clientId}:`, message.type);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, message);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        case 'get_status':
          this.sendStatus(clientId);
          break;
        default:
          console.log(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`❌ Error handling client message:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle client subscription
   */
  handleSubscription(clientId, message) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) return;

    const { queues = [] } = message;
    
    queues.forEach(queue => {
      if (this.isValidQueue(queue)) {
        clientInfo.subscriptions.add(queue);
        console.log(`📋 Client ${clientId} subscribed to: ${queue}`);
      }
    });

    this.sendToClient(clientId, {
      type: 'subscription',
      action: 'confirmed',
      subscriptions: Array.from(clientInfo.subscriptions),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client unsubscription
   */
  handleSubscription(clientId, message) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) return;

    const { queues = [] } = message;
    
    queues.forEach(queue => {
      clientInfo.subscriptions.delete(queue);
      console.log(`📋 Client ${clientId} unsubscribed from: ${queue}`);
    });

    this.sendToClient(clientId, {
      type: 'unsubscription',
      action: 'confirmed',
      subscriptions: Array.from(clientInfo.subscriptions),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if queue is valid
   */
  isValidQueue(queue) {
    const validQueues = [
      'location.updates',
      'user.notifications',
      'data.processing',
      'analytics.events',
      'system.tasks',
      'dead.letter'
    ];
    return validQueues.includes(queue);
  }

  /**
   * Start AMQP consumers
   */
  async startAMQPConsumers() {
    console.log('🔄 Starting AMQP consumers...');

    // Start consumer for each queue
    const queues = [
      'location.updates',
      'user.notifications', 
      'data.processing',
      'analytics.events',
      'system.tasks'
    ];

    for (const queue of queues) {
      await this.startConsumer(queue);
    }
  }

  /**
   * Start consumer for specific queue
   */
  async startConsumer(queueName) {
    try {
      await this.amqpService.consumeMessages(queueName, async (message) => {
        await this.broadcastMessage(queueName, message);
      });
      console.log(`📥 Started consumer for queue: ${queueName}`);
    } catch (error) {
      console.error(`❌ Failed to start consumer for ${queueName}:`, error);
    }
  }

  /**
   * Broadcast message to subscribed clients
   */
  async broadcastMessage(queueName, message) {
    const messageData = {
      type: 'amqp_message',
      queue: queueName,
      message: message,
      timestamp: new Date().toISOString(),
      messageId: uuidv4()
    };

    // Add to message buffer
    this.messageQueue.push(messageData);
    if (this.messageQueue.length > this.config.messageBufferSize) {
      this.messageQueue.shift();
    }

    // Broadcast to subscribed clients
    let sentCount = 0;
    for (const [clientId, clientInfo] of this.clients) {
      if (clientInfo.subscriptions.has(queueName)) {
        this.sendToClient(clientId, messageData);
        sentCount++;
      }
    }

    console.log(`📤 Broadcasted message from ${queueName} to ${sentCount} clients`);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo || clientInfo.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      clientInfo.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`❌ Error sending to client ${clientId}:`, error);
      this.handleClientDisconnection(clientId);
      return false;
    }
  }

  /**
   * Send status to client
   */
  sendStatus(clientId) {
    const status = {
      type: 'status',
      data: {
        connectedClients: this.clients.size,
        amqpConnection: this.amqpService?.getConnectionStatus() || { connected: false },
        messageQueueSize: this.messageQueue.length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    };

    this.sendToClient(clientId, status);
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnection(clientId) {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      console.log(`🔌 Client disconnected: ${clientId} (connected for ${Date.now() - clientInfo.connectedAt.getTime()}ms)`);
      this.clients.delete(clientId);
    }
  }

  /**
   * Handle client error
   */
  handleClientError(clientId, error) {
    console.error(`❌ Client error ${clientId}:`, error);
    this.handleClientDisconnection(clientId);
  }

  /**
   * Handle client pong
   */
  handleClientPong(clientId) {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      clientInfo.lastPing = new Date();
    }
  }

  /**
   * Handle server error
   */
  handleServerError(error) {
    console.error('❌ WebSocket server error:', error);
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    setInterval(() => {
      // Ping all clients
      for (const [clientId, clientInfo] of this.clients) {
        if (clientInfo.ws.readyState === WebSocket.OPEN) {
          clientInfo.ws.ping();
          
          // Check for timeout
          const timeout = Date.now() - clientInfo.lastPing.getTime();
          if (timeout > this.config.heartbeatInterval * 2) {
            console.log(`⏰ Client ${clientId} timed out`);
            clientInfo.ws.terminate();
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      messageQueueSize: this.messageQueue.length,
      uptime: process.uptime(),
      amqpStatus: this.amqpService?.getConnectionStatus() || { connected: false },
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        messageCount: client.messageCount,
        subscriptions: Array.from(client.subscriptions)
      }))
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down WebSocket server...');
    
    // Close all client connections
    for (const [clientId, clientInfo] of this.clients) {
      this.sendToClient(clientId, {
        type: 'server_shutdown',
        message: 'Server shutting down',
        timestamp: new Date().toISOString()
      });
      clientInfo.ws.close();
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Shutdown AMQP service
    if (this.amqpService) {
      await this.amqpService.shutdown();
    }

    console.log('✅ WebSocket server shutdown complete');
  }
}

module.exports = WebSocketServer;
