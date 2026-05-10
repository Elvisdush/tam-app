/**
 * AMQP Service for TAM App
 * Main service that manages AMQP connections, queues, and message processing
 */

const AMQPConnectionManager = require('./connection-manager');
const { MessageQueueManager, QUEUE_TYPES, PRIORITIES } = require('./message-queue-manager');
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
    this.isInitialized = false;
    this.isShuttingDown = false;
    
    this.setupEventHandlers();
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

  // Message publishing methods
  async publishLocationUpdate(locationData, priority = PRIORITIES.NORMAL) {
    const message = {
      type: 'location.update',
      data: locationData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0'
      }
    };

    return await this.messageQueueManager.sendMessage(QUEUE_TYPES.LOCATION_UPDATES, message, priority);
  }

  async publishUserNotification(notificationData, priority = PRIORITIES.HIGH) {
    const message = {
      type: 'user.notification',
      data: notificationData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: 'high'
      }
    };

    return await this.messageQueueManager.sendMessage(QUEUE_TYPES.USER_NOTIFICATIONS, notificationData, priority);
  }

  async publishDataProcessing(taskData, priority = PRIORITIES.NORMAL) {
    const message = {
      type: 'data.processing.task',
      data: taskData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0'
      }
    };

    return await this.messageQueueManager.sendMessage(QUEUE_TYPES.DATA_PROCESSING, taskData, priority);
  }

  async publishAnalyticsEvent(eventData, priority = PRIORITIES.LOW) {
    const message = {
      type: 'analytics.event',
      data: eventData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0'
      }
    };

    return await this.messageQueueManager.sendMessage(QUEUE_TYPES.ANALYTICS_EVENTS, eventData, priority);
  }

  async publishSystemTask(taskData, priority = PRIORITIES.CRITICAL) {
    const message = {
      type: 'system.task',
      data: taskData,
      timestamp: new Date().toISOString(),
      metadata: {
        source: 'tam-app',
        version: '1.0.0',
        priority: 'critical'
      }
    };

    return await this.messageQueueManager.sendMessage(QUEUE_TYPES.SYSTEM_TASKS, taskData, priority);
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

  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Shutting down AMQP service...');

    try {
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
