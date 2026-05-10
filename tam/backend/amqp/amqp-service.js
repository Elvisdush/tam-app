/**
 * AMQP Service for TAM App
 * Main service that manages AMQP connections, queues, and message processing
 */

const AMQPConnectionManager = require('./connection-manager');
const { MessageQueueManager, QUEUE_TYPES, PRIORITIES } = require('./message-queue-manager');
const AMQPErrorHandler = require('./error-handler');
const DeadLetterProcessor = require('./dead-letter-processor');
const { v4: uuidv4 } = require('uuid');

class AMQPService extends require('events').EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      hostname: config.hostname || 'localhost',
      port: config.port || 5672,
      username: config.username || 'guest',
      password: config.password || 'guest',
      vhost: config.vhost || '/',
      heartbeat: config.heartbeat || 60,
      reconnect: config.reconnect !== false,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      ...config
    };
    
    this.connectionManager = new AMQPConnectionManager(this.config);
    this.messageQueueManager = new MessageQueueManager(this.connectionManager);
    this.errorHandler = new AMQPErrorHandler({
      maxRetries: config.maxRetries || 5,
      initialRetryDelay: config.initialRetryDelay || 1000,
      maxRetryDelay: config.maxRetryDelay || 30000,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
      deadLetterQueueEnabled: config.deadLetterQueueEnabled !== false
    });
    this.deadLetterProcessor = new DeadLetterProcessor({
      deadLetterQueue: 'dead.letter',
      maxProcessingAttempts: config.maxProcessingAttempts || 3,
      saveFailedMessages: config.saveFailedMessages !== false
    });
    
    this.isInitialized = false;
    this.isShuttingDown = false;
    
    this.setupEventHandlers();
    this.setupErrorHandlers();
  }

  setupEventHandlers() {
    this.connectionManager.on('connected', () => {
      console.log('🔗 AMQP service connected');
      this.emit('connected');
    });

    this.connectionManager.on('disconnected', () => {
      console.log('🔌 AMQP service disconnected');
      this.emit('disconnected');
    });

    this.connectionManager.on('error', (error) => {
      console.error('❌ AMQP service error:', error);
      this.emit('error', error);
    });

    this.messageQueueManager.on('queueCreated', ({ queueType, exchangeName, routingKey }) => {
      console.log(`📋 Queue ready: ${queueType} -> ${exchangeName} (${routingKey})`);
      this.emit('queueReady', { queueType, exchangeName, routingKey });
    });

    this.messageQueueManager.on('messageSent', ({ queueType, messageId, type }) => {
      console.log(`📤 Message sent: ${queueType} - ${type} (${messageId})`);
      this.emit('messageSent', { queueType, messageId, type });
    });

    this.messageQueueManager.on('messageReceived', ({ queueType, message }) => {
      console.log(`📥 Message received: ${queueType} - ${message.type} (${message.id})`);
      this.emit('messageReceived', { queueType, message });
    });

    this.messageQueueManager.on('consumerStarted', ({ queueType }) => {
      console.log(`👂 Started consuming: ${queueType}`);
      this.emit('consumerStarted', { queueType });
    });

    this.messageQueueManager.on('consumerCancelled', ({ queueType }) => {
      console.log(`🚫 Stopped consuming: ${queueType}`);
      this.emit('consumerStopped', { queueType });
    });
  }

  setupErrorHandlers() {
    // Error handler events
    this.errorHandler.on('retry', (errorInfo) => {
      console.log(`🔄 Retry attempt ${errorInfo.retryCount} for message ${errorInfo.errorId}`);
      this.emit('messageRetry', errorInfo);
    });

    this.errorHandler.on('finalFailure', (errorInfo) => {
      console.log(`❌ Final failure for message ${errorInfo.errorId}`);
      this.emit('messageFinalFailure', errorInfo);
    });

    this.errorHandler.on('circuitBreakerOpen', (errorInfo) => {
      console.log('🚫 Circuit breaker opened');
      this.emit('circuitBreakerOpen', errorInfo);
    });

    this.errorHandler.on('circuitBreakerReset', () => {
      console.log('✅ Circuit breaker reset');
      this.emit('circuitBreakerReset');
    });

    // Dead letter processor events
    this.deadLetterProcessor.on('messageRecovered', (data) => {
      console.log(`✅ Message recovered: ${data.message.errorId}`);
      this.emit('messageRecovered', data);
    });

    this.deadLetterProcessor.on('messagePermanentlyFailed', (data) => {
      console.log(`💀 Message permanently failed: ${data.message.errorId}`);
      this.emit('messagePermanentlyFailed', data);
    });
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing AMQP service...');
      
      // Connect to AMQP broker
      await this.connectionManager.connect();
      
      // Set up dead letter queue
      await this.messageQueueManager.setupDeadLetterQueue();
      
      // Create standard queues
      await this.setupStandardQueues();
      
      // Initialize dead letter processor
      await this.deadLetterProcessor.initialize(this);
      
      this.isInitialized = true;
      console.log('✅ AMQP service initialized');
      this.emit('initialized');

    } catch (error) {
      console.error('❌ Failed to initialize AMQP service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async setupStandardQueues() {
    const queueConfigs = [
      {
        type: QUEUE_TYPES.LOCATION_UPDATES,
        options: {
          durable: true,
          maxLength: 5000,
          messageTtl: 86400000 // 24 hours
        }
      },
      {
        type: QUEUE_TYPES.USER_NOTIFICATIONS,
        options: {
          durable: true,
          maxLength: 10000,
          messageTtl: 604800000 // 7 days
        }
      },
      {
        type: QUEUE_TYPES.DATA_PROCESSING,
        options: {
          durable: true,
          maxLength: 10000,
          prefetch: 20
        }
      },
      {
        type: QUEUE_TYPES.ANALYTICS_EVENTS,
        options: {
          durable: false, // Not persistent - analytics are event-driven
          maxLength: 5000,
          prefetch: 50
        }
      },
      {
        type: QUEUE_TYPES.SYSTEM_TASKS,
        options: {
          durable: true,
          maxLength: 1000
        }
      }
    ];

    for (const config of queueConfigs) {
      await this.messageQueueManager.createQueue(config.type, config.options);
    }
  }

  // Message publishing methods with retry logic
  async publishLocationUpdate(locationData, priority = PRIORITIES.NORMAL) {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      type: 'location.update',
      data: locationData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: priority,
        originalQueue: QUEUE_TYPES.LOCATION_UPDATES
      }
    };

    return await this.publishWithRetry(QUEUE_TYPES.LOCATION_UPDATES, message, priority, messageId);
  }

  async publishUserNotification(notificationData, priority = PRIORITIES.HIGH) {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      type: 'user.notification',
      data: notificationData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: priority,
        originalQueue: QUEUE_TYPES.USER_NOTIFICATIONS
      }
    };

    return await this.publishWithRetry(QUEUE_TYPES.USER_NOTIFICATIONS, message, priority, messageId);
  }

  async publishDataProcessing(taskData, priority = PRIORITIES.NORMAL) {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      type: 'data.processing.task',
      data: taskData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0'
      }
    };

    return await this.publishWithRetry(QUEUE_TYPES.DATA_PROCESSING, message, priority, messageId);
  }

  /**
   * Core retry method for all publish operations
   */
  async publishWithRetry(queueType, message, priority, messageId) {
    const context = {
      messageId: messageId,
      queueType: queueType,
      priority: priority,
      originalMessage: message,
      deadLetterQueue: 'dead.letter'
    };

    try {
      // Attempt to publish message
      const result = await this.messageQueueManager.sendMessage(queueType, message, priority);
      
      // Handle success
      this.errorHandler.handleSuccess(messageId);
      
      return result;
      
    } catch (error) {
      // Handle error with retry logic
      const retryResult = await this.errorHandler.handleError(error, context);
      
      if (retryResult.success && retryResult.shouldRetry) {
        // Retry the operation
        console.log(`🔄 Retrying message publish [${messageId}] (attempt ${retryResult.retryCount})`);
        return await this.publishWithRetry(queueType, message, priority, messageId);
      } else if (retryResult.success) {
        // Operation succeeded after retry
        this.errorHandler.handleSuccess(messageId);
        return { success: true, messageId: messageId, retryCount: retryResult.retryCount };
      } else {
        // Final failure - error handler will send to dead letter queue
        throw new Error(`Message publish failed: ${retryResult.reason}`);
      }
    }
  }

  async publishAnalyticsEvent(eventData, priority = PRIORITIES.LOW) {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      type: 'analytics.event',
      data: eventData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: priority,
        originalQueue: QUEUE_TYPES.ANALYTICS_EVENTS
      }
    };

    return await this.publishWithRetry(QUEUE_TYPES.ANALYTICS_EVENTS, message, priority, messageId);
  }

  async publishSystemTask(taskData, priority = PRIORITIES.CRITICAL) {
    const messageId = uuidv4();
    const message = {
      id: messageId,
      type: 'system.task',
      data: taskData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: priority,
        originalQueue: QUEUE_TYPES.SYSTEM_TASKS
      }
    };

    return await this.publishWithRetry(QUEUE_TYPES.SYSTEM_TASKS, message, priority, messageId);
  }

  // Message consumption methods
  async startLocationUpdatesConsumer(callback) {
    return await this.messageQueueManager.consumeMessages(
      QUEUE_TYPES.LOCATION_UPDATES,
      async (message) => {
        await callback(message);
      },
      { prefetch: 10 }
    );
  }

  async startUserNotificationsConsumer(callback) {
    return await this.messageQueueManager.consumeMessages(
      QUEUE_TYPES.USER_NOTIFICATIONS,
      async (message) => {
        await callback(message);
      },
      { prefetch: 5 }
    );
  }

  async startDataProcessingConsumer(callback, options = {}) {
    return await this.messageQueueManager.consumeMessages(
      QUEUE_TYPES.DATA_PROCESSING,
      async (message) => {
        await callback(message);
      },
      { 
        prefetch: options.prefetch || 20,
        deadLetterQueue: true
      }
    );
  }

  async startAnalyticsConsumer(callback) {
    return await this.messageQueueManager.consumeMessages(
      QUEUE_TYPES.ANALYTICS_EVENTS,
      async (message) => {
        await callback(message);
      },
      { prefetch: 50 }
    );
  }

  async startSystemTasksConsumer(callback) {
    return await this.messageQueueManager.consumeMessages(
      QUEUE_TYPES.SYSTEM_TASKS,
      async (message) => {
        await callback(message);
      },
      { prefetch: 1 }
    );
  }

  // Utility methods
  getConnectionStatus() {
    return this.connectionManager.getConnectionInfo();
  }

  getQueueStats() {
    return this.messageQueueManager.getQueueStats();
  }

  /**
   * Get comprehensive error and retry statistics
   */
  getErrorStats() {
    return {
      errorHandler: this.errorHandler.getErrorStats(),
      deadLetterProcessor: this.deadLetterProcessor.getProcessingStats(),
      circuitBreakerState: this.errorHandler.circuitBreakerState,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset error statistics
   */
  resetErrorStats() {
    this.errorHandler.resetStats();
    console.log('📊 Error statistics reset');
  }

  /**
   * Get system health status
   */
  getHealthStatus() {
    const connectionStatus = this.getConnectionStatus();
    const errorStats = this.getErrorStats();
    const queueStats = this.getQueueStats();

    return {
      status: this.calculateHealthStatus(connectionStatus, errorStats),
      connection: connectionStatus,
      errors: errorStats,
      queues: queueStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate overall health status
   */
  calculateHealthStatus(connectionStatus, errorStats) {
    if (!connectionStatus.isConnected) {
      return 'unhealthy';
    }

    if (errorStats.errorHandler.circuitBreakerState === 'OPEN') {
      return 'degraded';
    }

    if (errorStats.errorHandler.totalErrors > 100) {
      return 'degraded';
    }

    if (errorStats.errorHandler.retryFailure > errorStats.errorHandler.retrySuccess) {
      return 'degraded';
    }

    return 'healthy';
  }

  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Shutting down AMQP service...');

    try {
      // Shutdown error handlers and dead letter processor
      await this.deadLetterProcessor.shutdown();
      await this.errorHandler.shutdown();
      
      await this.messageQueueManager.close();
      await this.connectionManager.close();
      console.log('✅ AMQP service shut down');
      this.emit('shutdown');

    } catch (error) {
      console.error('❌ Error during AMQP shutdown:', error);
      this.emit('error', error);
    } finally {
      this.isShuttingDown = false;
    }
  }
}

module.exports = AMQPService;
