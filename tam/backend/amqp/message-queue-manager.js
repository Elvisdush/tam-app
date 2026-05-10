/**
 * Message Queue Manager for TAM App
 * Handles different queue types and message routing
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class MessageQueueManager extends EventEmitter {
  constructor(connectionManager) {
    super();
    this.connectionManager = connectionManager;
    this.queues = new Map();
    this.exchanges = new Map();
    this.consumers = new Map();
    this.producers = new Map();
  }

  // Queue types for different message categories
  static QUEUE_TYPES = {
    LOCATION_UPDATES: 'location.updates',
    USER_NOTIFICATIONS: 'user.notifications',
    DATA_PROCESSING: 'data.processing',
    ANALYTICS_EVENTS: 'analytics.events',
    SYSTEM_TASKS: 'system.tasks',
    DEAD_LETTER: 'dead.letter'
  };

  // Message priorities
  static PRIORITIES = {
    LOW: 1,
    NORMAL: 5,
    HIGH: 8,
    CRITICAL: 10
  };

  async createQueue(queueType, options = {}) {
    const queueName = `${queueType}.${options.suffix || 'default'}`;
    const routingKey = options.routingKey || queueType;
    
    try {
      const channel = await this.connectionManager.createChannel();
      
      // Assert queue with specific configuration
      await channel.assertQueue(queueName, {
        durable: options.durable || true,
        exclusive: options.exclusive || false,
        autoDelete: options.autoDelete || false,
        arguments: options.arguments || [],
        maxLength: options.maxLength || 10000,
        messageTtl: options.messageTtl || 3600000 // 1 hour
      });

      // Assert exchange for routing
      const exchangeName = options.exchange || `${queueType}.exchange`;
      await channel.assertExchange(exchangeName, 'topic', {
        durable: options.durable || true,
        autoDelete: options.autoDelete || false
      });

      // Bind queue to exchange
      await channel.bindQueue(queueName, exchangeName, routingKey);

      // Set up prefetch for consumer
      if (options.prefetch) {
        await channel.prefetch(options.prefetch);
      }

      // Store queue configuration
      this.queues.set(queueName, {
        name: queueName,
        exchange: exchangeName,
        routingKey,
        channel,
        options,
        createdAt: new Date(),
        messageCount: 0,
        consumerCount: 0
      });

      console.log(`✅ Created queue: ${queueName} -> ${exchangeName} (${routingKey})`);
      this.emit('queueCreated', { queueName, exchangeName, routingKey });

      return {
        queue: queueName,
        exchange: exchangeName,
        channel,
        send: async (message, priority = MessageQueueManager.PRIORITIES.NORMAL) => {
          return this.sendMessage(queueName, message, priority, exchangeName, routingKey);
        },
        consume: async (callback, options = {}) => {
          return this.consumeMessages(queueName, callback, options);
        },
        close: async () => {
          await channel.close();
          this.queues.delete(queueName);
        }
      };

    } catch (error) {
      console.error(`❌ Failed to create queue ${queueName}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async sendMessage(queueType, message, priority = MessageQueueManager.PRIORITIES.NORMAL, exchangeName, routingKey) {
    const queueInfo = this.queues.get(queueType);
    if (!queueInfo) {
      throw new Error(`Queue ${queueType} not found`);
    }

    try {
      const messageData = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        type: message.type || 'default',
        data: message.data,
        priority,
        retryCount: 0,
        maxRetries: message.maxRetries || 3,
        metadata: {
          ...message.metadata,
          source: 'tam-app',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      const published = queueInfo.channel.publish(exchangeName || `${queueType}.exchange`, routingKey || queueType, Buffer.from(JSON.stringify(messageData)), {
        persistent: true,
        priority,
        expiration: message.ttl || 3600000,
        messageId: messageData.id,
        headers: {
          'content-type': 'application/json',
          'message-priority': priority.toString(),
          'message-type': messageData.type
        }
      });

      queueInfo.messageCount++;
      console.log(`📤 Sent message to ${queueType}: ${message.type} (${messageData.id})`);
      this.emit('messageSent', { queueType, messageId: messageData.id, type: message.type });

      return published;

    } catch (error) {
      console.error(`❌ Failed to send message to ${queueType}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async consumeMessages(queueType, callback, options = {}) {
    const queueInfo = this.queues.get(queueType);
    if (!queueInfo) {
      throw new Error(`Queue ${queueType} not found`);
    }

    try {
      await queueInfo.channel.consume(queueInfo.name, async (msg) => {
        if (msg === null) {
          console.log(`📭 Consumer cancelled for ${queueType}`);
          this.emit('consumerCancelled', { queueType });
          return;
        }

        try {
          const messageData = JSON.parse(msg.content.toString());
          const processedMessage = {
            ...messageData,
            receivedAt: new Date().toISOString(),
            deliveryTag: msg.fields.deliveryTag,
            redelivered: msg.fields.redelivered,
            headers: msg.properties.headers
          };

          // Update queue stats
          queueInfo.consumerCount++;
          queueInfo.messageCount++;

          console.log(`📥 Received message from ${queueType}: ${messageData.type} (${messageData.id})`);
          this.emit('messageReceived', { queueType, message: processedMessage });

          // Callback with error handling
          await callback(processedMessage, msg);

        } catch (parseError) {
          console.error(`❌ Failed to parse message from ${queueType}:`, parseError);
          
          // Send to dead letter queue if configured
          if (options.deadLetterQueue) {
            await this.sendToDeadLetter(queueType, msg.content, parseError);
          }
        }

      }, {
        noAck: false, // Manual acknowledgment
        prefetch: options.prefetch || 10,
        exclusive: options.exclusive || false
      });

      console.log(`👂 Started consuming from ${queueType}`);
      this.emit('consumerStarted', { queueType });

    } catch (error) {
      console.error(`❌ Failed to consume from ${queueType}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async sendToDeadLetter(queueType, originalMessage, error) {
    const deadLetterData = {
      originalMessage: JSON.parse(originalMessage.content.toString()),
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      failedAt: new Date().toISOString(),
      originalQueue: queueType,
      retryCount: 0
    };

    await this.sendMessage(MessageQueueManager.QUEUE_TYPES.DEAD_LETTER, deadLetterData, MessageQueueManager.PRIORITIES.HIGH);
    console.log(`💀 Sent to dead letter queue: ${queueType} error`);
  }

  async setupDeadLetterQueue() {
    await this.createQueue(MessageQueueManager.QUEUE_TYPES.DEAD_LETTER, {
      durable: true,
      maxLength: 5000,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': ''
      }
    });
  }

  getQueueStats() {
    const stats = {};
    for (const [queueType, queueInfo] of this.queues) {
      stats[queueType] = {
        name: queueInfo.name,
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
        createdAt: queueInfo.createdAt,
        channel: queueInfo.channel ? 'active' : 'inactive'
      };
    }
    return stats;
  }

  async close() {
    console.log('🔄 Closing all AMQP queues and channels...');
    
    for (const [queueType, queueInfo] of this.queues) {
      if (queueInfo.channel) {
        await queueInfo.channel.close();
      }
    }
    
    this.queues.clear();
    this.consumers.clear();
    this.producers.clear();
    
    await this.connectionManager.close();
    console.log('✅ All AMQP queues closed');
    this.emit('closed');
  }
}

module.exports = { MessageQueueManager, QUEUE_TYPES: MessageQueueManager.QUEUE_TYPES, PRIORITIES: MessageQueueManager.PRIORITIES };
