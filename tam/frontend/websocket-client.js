/**
 * Frontend WebSocket Client for Real-time AMQP Updates
 * Connects to WebSocket server and handles real-time messages
 */

class TAMWebSocketClient {
  constructor(options = {}) {
    this.url = options.url || 'ws://localhost:3007';
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.ws = null;
    this.heartbeatTimer = null;
    this.subscriptions = new Set();
    this.messageQueue = [];
    this.maxMessageQueue = options.maxMessageQueue || 1000;

    // Event callbacks
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});

    this.status = 'disconnected';
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      console.log(`🔌 Connecting to WebSocket server: ${this.url}`);
      this.setStatus('connecting');
      
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      
    } catch (error) {
      console.error('❌ Failed to connect to WebSocket server:', error);
      this.handleError(error);
    }
  }

  /**
   * Handle WebSocket connection open
   */
  handleOpen() {
    console.log('✅ Connected to WebSocket server');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.setStatus('connected');
    this.onConnect();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Resubscribe to queues
    if (this.subscriptions.size > 0) {
      this.subscribe(Array.from(this.subscriptions));
    }
    
    // Process queued messages
    this.processMessageQueue();
  }

  /**
   * Handle WebSocket message
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('📨 Received message:', message.type);
      
      // Handle different message types
      switch (message.type) {
        case 'connection':
          console.log('🔗 Connection confirmed:', message.message);
          break;
        case 'subscription':
          console.log('📋 Subscription confirmed:', message.subscriptions);
          break;
        case 'unsubscription':
          console.log('📋 Unsubscription confirmed:', message.subscriptions);
          break;
        case 'pong':
          // Heartbeat response
          break;
        case 'status':
          console.log('📊 Status update:', message.data);
          break;
        case 'amqp_message':
          this.handleAMQPMessage(message);
          break;
        case 'error':
          console.error('❌ Server error:', message.message);
          this.onError(message);
          break;
        case 'server_shutdown':
          console.log('🛑 Server shutting down:', message.message);
          this.disconnect();
          break;
        default:
          console.log('📨 Unknown message type:', message);
          this.onMessage(message);
      }
      
      // Call specific message handler if registered
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      }
      
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  }

  /**
   * Handle AMQP messages from WebSocket
   */
  handleAMQPMessage(message) {
    console.log(`📤 AMQP Message from ${message.queue}:`, message.message);
    
    // Add to message queue
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxMessageQueue) {
      this.messageQueue.shift();
    }
    
    // Call specific queue handler
    const queueHandler = this.messageHandlers.get(`queue_${message.queue}`);
    if (queueHandler) {
      queueHandler(message);
    }
    
    // Call general message handler
    this.onMessage(message);
  }

  /**
   * Handle WebSocket connection close
   */
  handleClose(event) {
    console.log(`🔌 WebSocket connection closed: ${event.code} - ${event.reason}`);
    this.isConnected = false;
    this.setStatus('disconnected');
    this.stopHeartbeat();
    this.onDisconnect();
    
    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnect();
    } else {
      console.error('❌ Max reconnect attempts reached');
      this.setStatus('failed');
    }
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    console.error('❌ WebSocket error:', error);
    this.setStatus('error');
    this.onError(error);
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    this.reconnectAttempts++;
    console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.setStatus('disconnected');
    this.stopHeartbeat();
  }

  /**
   * Subscribe to AMQP queues
   */
  subscribe(queues) {
    if (!this.isConnected) {
      console.log('⚠️ Not connected, queuing subscription');
      queues.forEach(queue => this.subscriptions.add(queue));
      return;
    }

    const message = {
      type: 'subscribe',
      queues: Array.isArray(queues) ? queues : [queues]
    };

    this.send(message);
    
    // Add to subscriptions
    queues.forEach(queue => this.subscriptions.add(queue));
  }

  /**
   * Unsubscribe from AMQP queues
   */
  unsubscribe(queues) {
    if (!this.isConnected) {
      console.log('⚠️ Not connected, removing from subscription queue');
      queues.forEach(queue => this.subscriptions.delete(queue));
      return;
    }

    const message = {
      type: 'unsubscribe',
      queues: Array.isArray(queues) ? queues : [queues]
    };

    this.send(message);
    
    // Remove from subscriptions
    queues.forEach(queue => this.subscriptions.delete(queue));
  }

  /**
   * Send message to WebSocket server
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      console.warn('⚠️ Not connected, cannot send message');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send ping to server
   */
  ping() {
    this.send({ type: 'ping', timestamp: new Date().toISOString() });
  }

  /**
   * Request status from server
   */
  getStatus() {
    this.send({ type: 'get_status' });
  }

  /**
   * Register message handler
   */
  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Unregister message handler
   */
  off(messageType) {
    this.messageHandlers.delete(messageType);
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Process message queue
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.handleAMQPMessage(message);
    }
  }

  /**
   * Set status
   */
  setStatus(status) {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChange(status);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      status: this.status,
      isConnected: this.isConnected,
      url: this.url,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions),
      messageQueueSize: this.messageQueue.length
    };
  }

  /**
   * Get recent messages
   */
  getRecentMessages(limit = 10) {
    return this.messageQueue.slice(-limit);
  }

  /**
   * Clear message queue
   */
  clearMessageQueue() {
    this.messageQueue = [];
  }
}

// Example usage and initialization
if (typeof window !== 'undefined') {
  // Browser environment
  window.TAMWebSocketClient = TAMWebSocketClient;
  
  // Auto-initialize with default settings
  window.tamWebSocket = new TAMWebSocketClient({
    url: 'ws://localhost:3007',
    onConnect: () => {
      console.log('🎊 TAM WebSocket client connected!');
      // Subscribe to default queues
      window.tamWebSocket.subscribe([
        'location.updates',
        'user.notifications',
        'analytics.events'
      ]);
    },
    onDisconnect: () => {
      console.log('🔌 TAM WebSocket client disconnected');
    },
    onError: (error) => {
      console.error('❌ TAM WebSocket client error:', error);
    },
    onMessage: (message) => {
      console.log('📨 TAM WebSocket message:', message);
    }
  });

  // Register specific handlers
  window.tamWebSocket.on('queue_location.updates', (message) => {
    console.log('📍 Location update received:', message.message);
    // Handle location updates in UI
    if (window.updateLocationUI) {
      window.updateLocationUI(message.message);
    }
  });

  window.tamWebSocket.on('queue_user.notifications', (message) => {
    console.log('🔔 Notification received:', message.message);
    // Handle notifications in UI
    if (window.showNotification) {
      window.showNotification(message.message);
    }
  });

  window.tamWebSocket.on('queue_analytics.events', (message) => {
    console.log('📊 Analytics event received:', message.message);
    // Handle analytics events in UI
    if (window.updateAnalytics) {
      window.updateAnalytics(message.message);
    }
  });

  // Auto-connect when page loads
  document.addEventListener('DOMContentLoaded', () => {
    window.tamWebSocket.connect();
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    window.tamWebSocket.disconnect();
  });
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = TAMWebSocketClient;
}

export default TAMWebSocketClient;
