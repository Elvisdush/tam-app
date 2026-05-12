/**
 * Notification Worker
 * Processes user notification messages from AMQP queue
 */

const AMQPService = require('../amqp/amqp-service');
const { v4: uuidv4 } = require('uuid');

class NotificationWorker {
  constructor(options = {}) {
    this.config = {
      queueName: 'user.notifications',
      maxRetries: 3,
      processingTimeout: 15000,
      batchSize: 20,
      batchTimeout: 3000,
      notificationChannels: ['email', 'push', 'sms', 'websocket'],
      ...options
    };
    
    this.amqpService = null;
    this.isRunning = false;
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      startTime: null
    };
  }

  /**
   * Initialize the worker
   */
  async initialize() {
    try {
      console.log('🔔 Initializing Notification Worker...');
      
      this.amqpService = new AMQPService({
        hostname: process.env.AMQP_HOSTNAME || 'localhost',
        port: parseInt(process.env.AMQP_PORT) || 5672,
        username: process.env.AMQP_USERNAME || 'guest',
        password: process.env.AMQP_PASSWORD || 'guest',
        maxRetries: this.config.maxRetries
      });

      await this.amqpService.initialize();
      
      // Start consuming notifications
      await this.amqpService.startUserNotificationsConsumer(
        this.handleNotification.bind(this)
      );
      
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      console.log('✅ Notification Worker initialized');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Failed to initialize Notification Worker:', error);
      throw error;
    }
  }

  /**
   * Handle notification messages
   */
  async handleNotification(message) {
    const startTime = Date.now();
    
    try {
      console.log(`🔔 Processing notification: ${message.id}`);
      
      // Validate message structure
      const validation = this.validateMessage(message);
      if (!validation.isValid) {
        console.warn(`⚠️ Invalid notification message: ${validation.errors.join(', ')}`);
        this.stats.failed++;
        return;
      }

      // Process notification data
      const processedData = await this.processNotification(message.data);
      
      // Send notification through appropriate channels
      const deliveryResults = await this.sendNotifications(processedData);
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, deliveryResults);
      
      console.log(`✅ Notification processed: ${message.id} (${processingTime}ms)`);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, { success: false, error });
      
      console.error(`❌ Failed to process notification ${message.id}:`, error);
      
      // Publish error event
      await this.publishErrorEvent(message, error);
    }
  }

  /**
   * Validate message structure
   */
  validateMessage(message) {
    const errors = [];
    
    if (!message.id) {
      errors.push('Missing message ID');
    }
    
    if (!message.data) {
      errors.push('Missing data field');
    }
    
    if (message.data) {
      if (!message.data.userId && !message.data.recipientId) {
        errors.push('Missing userId or recipientId');
      }
      
      if (!message.data.title && !message.data.message) {
        errors.push('Missing title or message content');
      }
      
      if (message.data.type && !this.isValidNotificationType(message.data.type)) {
        errors.push('Invalid notification type');
      }
      
      if (message.data.priority && !this.isValidPriority(message.data.priority)) {
        errors.push('Invalid priority level');
      }
      
      if (message.data.channels && !this.isValidChannels(message.data.channels)) {
        errors.push('Invalid notification channels');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate notification type
   */
  isValidNotificationType(type) {
    const validTypes = [
      'info', 'success', 'warning', 'error', 'alert',
      'system', 'security', 'maintenance', 'update',
      'reminder', 'promotion', 'social', 'location',
      'route', 'traffic', 'weather', 'appointment'
    ];
    return validTypes.includes(type);
  }

  /**
   * Validate priority level
   */
  isValidPriority(priority) {
    const validPriorities = ['low', 'normal', 'high', 'critical', 'urgent'];
    return validPriorities.includes(priority);
  }

  /**
   * Validate notification channels
   */
  isValidChannels(channels) {
    const validChannels = this.config.notificationChannels;
    return Array.isArray(channels) && 
           channels.every(channel => validChannels.includes(channel));
  }

  /**
   * Process notification data
   */
  async processNotification(notificationData) {
    // Add processing metadata
    const processed = {
      ...notificationData,
      processedAt: new Date().toISOString(),
      workerId: process.env.WORKER_ID || 'notification-worker-1',
      processingVersion: '1.0.0'
    };

    // Personalization
    processed.personalized = await this.personalizeNotification(processed);
    
    // Content processing
    processed.content = await this.processContent(processed);
    
    // Delivery optimization
    processed.delivery = await this.optimizeDelivery(processed);
    
    // Analytics tracking
    processed.analytics = await this.generateAnalytics(processed);

    return processed;
  }

  /**
   * Personalize notification based on user preferences
   */
  async personalizeNotification(notification) {
    try {
      // Mock user preference lookup
      const userPreferences = await this.getUserPreferences(notification.userId || notification.recipientId);
      
      const personalized = {
        ...notification,
        personalization: {
          language: userPreferences.language || 'en',
          timezone: userPreferences.timezone || 'UTC',
          theme: userPreferences.theme || 'default',
          doNotDisturb: this.checkDoNotDisturb(userPreferences),
          preferredChannels: this.getPreferredChannels(userPreferences)
        }
      };

      // Apply personalization rules
      if (personalized.personalization.doNotDisturb) {
        personalized.scheduledFor = this.calculateOptimalSendTime(userPreferences);
      }

      return personalized;
    } catch (error) {
      console.warn('Personalization failed, using defaults:', error);
      return notification;
    }
  }

  /**
   * Process notification content
   */
  async processContent(notification) {
    const processed = {
      ...notification,
      content: {
        original: notification.message || notification.content,
        rendered: null,
        truncated: false,
        maxLength: this.getMaxLengthForType(notification.type)
      }
    };

    // Content rendering
    processed.content.rendered = await this.renderNotificationContent(processed);
    
    // Content truncation
    if (processed.content.rendered && 
        processed.content.rendered.length > processed.content.maxLength) {
      processed.content.truncated = true;
      processed.content.rendered = processed.content.rendered.substring(0, processed.content.maxLength - 3) + '...';
    }

    // Link processing
    processed.content.links = await this.processLinks(processed.content.rendered);
    
    // Media processing
    processed.content.media = await this.processMedia(notification);

    return processed;
  }

  /**
   * Render notification content
   */
  async renderNotificationContent(notification) {
    try {
      const template = await this.getTemplate(notification.type);
      
      // Simple template rendering
      let rendered = notification.message || notification.content;
      
      if (template) {
        rendered = template
          .replace('{{title}}', notification.title || '')
          .replace('{{message}}', notification.message || notification.content || '')
          .replace('{{userId}}', notification.userId || notification.recipientId || '')
          .replace('{{timestamp}}', new Date().toLocaleString());
      }

      return rendered;
    } catch (error) {
      console.warn('Template rendering failed:', error);
      return notification.message || notification.content;
    }
  }

  /**
   * Get notification template
   */
  async getTemplate(type) {
    const templates = {
      info: '📢 {{title}}: {{message}}',
      success: '✅ {{title}}: {{message}}',
      warning: '⚠️ {{title}}: {{message}}',
      error: '❌ {{title}}: {{message}}',
      alert: '🚨 {{title}}: {{message}}',
      system: '🔧 {{title}}: {{message}}',
      security: '🛡️ {{title}}: {{message}}',
      location: '📍 {{title}}: {{message}}',
      route: '🛣️ {{title}}: {{message}}',
      traffic: '🚦 {{title}}: {{message}}',
      weather: '🌤️ {{title}}: {{message}}'
    };
    
    return templates[type] || null;
  }

  /**
   * Get max length for notification type
   */
  getMaxLengthForType(type) {
    const limits = {
      sms: 160,
      push: 200,
      email: 1000,
      websocket: 500,
      inapp: 200
    };
    
    return limits[type] || limits.push;
  }

  /**
   * Process links in content
   */
  async processLinks(content) {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const links = content.match(linkRegex) || [];
    
    return links.map(link => ({
      url: link,
      domain: new URL(link).hostname,
      shortened: link.length > 50
    }));
  }

  /**
   * Process media attachments
   */
  async processMedia(notification) {
    if (!notification.media) {
      return null;
    }

    return {
      type: notification.media.type || 'image',
      url: notification.media.url || null,
      thumbnail: await this.generateThumbnail(notification.media.url),
      size: notification.media.size || null,
      processed: true
    };
  }

  /**
   * Optimize delivery settings
   */
  async optimizeDelivery(notification) {
    const optimization = {
      channels: notification.channels || ['push'],
      timing: 'immediate',
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential'
      },
      batching: {
        enabled: true,
        batchSize: this.config.batchSize
      }
    };

    // Channel-specific optimization
    if (notification.type === 'critical' || notification.type === 'alert') {
      optimization.channels = ['push', 'sms', 'email'];
      optimization.timing = 'immediate';
    } else if (notification.type === 'promotion' || notification.type === 'update') {
      optimization.channels = ['push', 'email'];
      optimization.timing = this.calculateOptimalTime(notification);
    }

    return optimization;
  }

  /**
   * Send notifications through channels
   */
  async sendNotifications(processedData) {
    const results = {
      email: { success: false, error: null },
      push: { success: false, error: null },
      sms: { success: false, error: null },
      websocket: { success: false, error: null }
    };

    const delivery = await this.optimizeDelivery(processedData);
    
    // Send through each configured channel
    for (const channel of delivery.channels) {
      try {
        switch (channel) {
          case 'email':
            results.email = await this.sendEmailNotification(processedData);
            break;
          case 'push':
            results.push = await this.sendPushNotification(processedData);
            break;
          case 'sms':
            results.sms = await this.sendSMSNotification(processedData);
            break;
          case 'websocket':
            results.websocket = await this.sendWebSocketNotification(processedData);
            break;
        }
      } catch (error) {
        results[channel] = { success: false, error: error.message };
      }
    }

    // Update notification sent statistics
    const totalSent = Object.values(results).filter(r => r.success).length;
    this.stats.notificationsSent += totalSent;
    this.stats.notificationsFailed += Object.values(results).filter(r => !r.success).length;

    return results;
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(notification) {
    try {
      console.log('📧 Sending email notification...');
      
      // Mock email sending
      await this.delay(100); // Simulate email API call
      
      return { success: true, messageId: uuidv4() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification) {
    try {
      console.log('📱 Sending push notification...');
      
      // Mock push notification sending
      await this.delay(50); // Simulate push API call
      
      return { success: true, messageId: uuidv4() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMSNotification(notification) {
    try {
      console.log('📱 Sending SMS notification...');
      
      // Mock SMS sending
      await this.delay(200); // Simulate SMS API call
      
      return { success: true, messageId: uuidv4() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send WebSocket notification
   */
  async sendWebSocketNotification(notification) {
    try {
      console.log('🌐 Sending WebSocket notification...');
      
      // Mock WebSocket broadcast
      await this.delay(10); // Simulate WebSocket broadcast
      
      return { success: true, messageId: uuidv4() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate analytics for notification
   */
  async generateAnalytics(notification) {
    return {
      notificationId: notification.id || notification.messageId,
      type: notification.type,
      channels: notification.channels || ['push'],
      userId: notification.userId || notification.recipientId,
      sentAt: new Date().toISOString(),
      engagement: {
        opened: false,
        clicked: false,
        dismissed: false
      },
      delivery: {
        attempted: this.config.notificationChannels,
        successful: 0, // Will be updated after sending
        failed: 0
      }
    };
  }

  /**
   * Mock helper methods
   */
  async getUserPreferences(userId) {
    // Mock user preference lookup
    await this.delay(5);
    return {
      language: 'en',
      timezone: 'UTC',
      theme: 'default',
      doNotDisturbHours: { start: 22, end: 7 },
      preferredChannels: ['push', 'email']
    };
  }

  checkDoNotDisturb(preferences) {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= preferences.doNotDisturbHours.start && 
           currentHour <= preferences.doNotDisturbHours.end;
  }

  getPreferredChannels(preferences) {
    return preferences.preferredChannels || this.config.notificationChannels;
  }

  calculateOptimalSendTime(notification) {
    // Mock: Calculate optimal send time based on user activity patterns
    return 'immediate'; // Simplified for demo
  }

  async generateThumbnail(mediaUrl) {
    // Mock thumbnail generation
    return `${mediaUrl}?thumbnail=${Date.now()}`;
  }

  /**
   * Update worker statistics
   */
  updateStats(processingTime, deliveryResults) {
    this.stats.totalProcessed++;
    
    if (deliveryResults.success !== false) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
    }
    
    // Update average processing time
    const totalTime = this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalProcessed;
  }

  /**
   * Get worker statistics
   */
  getStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    
    return {
      ...this.stats,
      uptime: uptime,
      successRate: this.stats.totalProcessed > 0 ? (this.stats.successful / this.stats.totalProcessed) * 100 : 0,
      notificationsPerSecond: uptime > 0 ? (this.stats.notificationsSent / (uptime / 1000)) : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log worker statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log('📊 Notification Worker Statistics:');
    console.log(`  Total Processed: ${stats.totalProcessed}`);
    console.log(`  Successful: ${stats.successful}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`  Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`);
    console.log(`  Notifications Sent: ${stats.notificationsSent}`);
    console.log(`  Notifications Failed: ${stats.notificationsFailed}`);
    console.log(`  Notifications/Second: ${stats.notificationsPerSecond.toFixed(2)}`);
    console.log(`  Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Shutting down Notification Worker...');
    
    try {
      if (this.amqpService) {
        await this.amqpService.shutdown();
      }
      
      this.isRunning = false;
      console.log('✅ Notification Worker shutdown complete');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Worker lifecycle management
const worker = new NotificationWorker();

// Handle process signals
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await worker.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await worker.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  worker.shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  worker.shutdown().then(() => process.exit(1));
});

// Start worker
if (require.main === module) {
  worker.initialize().catch(error => {
    console.error('💥 Failed to start Notification Worker:', error);
    process.exit(1);
  });
}

module.exports = NotificationWorker;
