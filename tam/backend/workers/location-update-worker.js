/**
 * Location Update Worker
 * Processes location update messages from AMQP queue
 */

const AMQPService = require('../amqp/amqp-service');
const { v4: uuidv4 } = require('uuid');

class LocationUpdateWorker {
  constructor(options = {}) {
    this.config = {
      queueName: 'location.updates',
      maxRetries: 3,
      processingTimeout: 30000,
      batchSize: 10,
      batchTimeout: 5000,
      ...options
    };
    
    this.amqpService = null;
    this.isRunning = false;
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0,
      startTime: null
    };
  }

  /**
   * Initialize the worker
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Location Update Worker...');
      
      this.amqpService = new AMQPService({
        hostname: process.env.AMQP_HOSTNAME || 'localhost',
        port: parseInt(process.env.AMQP_PORT) || 5672,
        username: process.env.AMQP_USERNAME || 'guest',
        password: process.env.AMQP_PASSWORD || 'guest',
        maxRetries: this.config.maxRetries
      });

      await this.amqpService.initialize();
      
      // Start consuming location updates
      await this.amqpService.startLocationUpdatesConsumer(
        this.handleLocationUpdate.bind(this)
      );
      
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      console.log('✅ Location Update Worker initialized');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Failed to initialize Location Update Worker:', error);
      throw error;
    }
  }

  /**
   * Handle location update messages
   */
  async handleLocationUpdate(message) {
    const startTime = Date.now();
    
    try {
      console.log(`📍 Processing location update: ${message.id}`);
      
      // Validate message structure
      const validation = this.validateMessage(message);
      if (!validation.isValid) {
        console.warn(`⚠️ Invalid location update message: ${validation.errors.join(', ')}`);
        this.stats.failed++;
        return;
      }

      // Process location data
      const processedData = await this.processLocationData(message.data);
      
      // Store processed data (could be database, cache, etc.)
      await this.storeLocationData(processedData);
      
      // Publish processed event
      await this.publishProcessedEvent(message, processedData);
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`✅ Location update processed: ${message.id} (${processingTime}ms)`);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error(`❌ Failed to process location update ${message.id}:`, error);
      
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
      if (typeof message.data.latitude !== 'number' || 
          typeof message.data.longitude !== 'number') {
        errors.push('Invalid coordinates - latitude and longitude must be numbers');
      }
      
      if (message.data.latitude < -90 || message.data.latitude > 90) {
        errors.push('Invalid latitude - must be between -90 and 90');
      }
      
      if (message.data.longitude < -180 || message.data.longitude > 180) {
        errors.push('Invalid longitude - must be between -180 and 180');
      }
      
      if (message.data.accuracy && (typeof message.data.accuracy !== 'number' || message.data.accuracy < 0)) {
        errors.push('Invalid accuracy - must be a positive number');
      }
      
      if (message.data.timestamp && !this.isValidTimestamp(message.data.timestamp)) {
        errors.push('Invalid timestamp format');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate timestamp
   */
  isValidTimestamp(timestamp) {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.toISOString() === timestamp;
  }

  /**
   * Process location data
   */
  async processLocationData(locationData) {
    // Add processing metadata
    const processed = {
      ...locationData,
      processedAt: new Date().toISOString(),
      workerId: process.env.WORKER_ID || 'location-worker-1',
      processingVersion: '1.0.0'
    };

    // Geospatial processing
    if (locationData.latitude && locationData.longitude) {
      processed.geospatial = {
        coordinates: [locationData.longitude, locationData.latitude],
        accuracy: locationData.accuracy || null,
        altitude: locationData.altitude || null,
        speed: locationData.speed || null,
        heading: locationData.heading || null
      };
    }

    // Route analysis (if route data available)
    if (locationData.routeId) {
      processed.routeAnalysis = await this.analyzeRoute(locationData.routeId);
    }

    // Location categorization
    processed.category = this.categorizeLocation(locationData);

    return processed;
  }

  /**
   * Analyze route data
   */
  async analyzeRoute(routeId) {
    try {
      // This would integrate with your route analysis system
      // For now, return basic analysis
      return {
        routeId,
        estimatedDuration: Math.random() * 3600, // Mock: 0-60 minutes
        trafficLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        distance: Math.random() * 50, // Mock: 0-50 km
        analyzedAt: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Route analysis failed:', error);
      return null;
    }
  }

  /**
   * Categorize location
   */
  categorizeLocation(locationData) {
    const category = {
      type: 'unknown',
      confidence: 0.5
    };

    // Speed-based categorization
    if (locationData.speed !== undefined) {
      if (locationData.speed < 1) {
        category.type = 'stationary';
        category.confidence = 0.9;
      } else if (locationData.speed < 5) {
        category.type = 'walking';
        category.confidence = 0.8;
      } else if (locationData.speed < 15) {
        category.type = 'driving';
        category.confidence = 0.9;
      } else {
        category.type = 'high_speed';
        category.confidence = 0.7;
      }
    }

    // Location-based categorization
    if (locationData.latitude && locationData.longitude) {
      // Mock: Check if location is near known places
      const nearHighway = Math.random() > 0.7;
      const nearCity = Math.random() > 0.5;
      
      if (nearHighway) {
        category.context = 'highway';
      } else if (nearCity) {
        category.context = 'urban';
      } else {
        category.context = 'rural';
      }
    }

    return category;
  }

  /**
   * Store location data
   */
  async storeLocationData(processedData) {
    try {
      // This would integrate with your database
      // For now, just log the data
      console.log('💾 Storing location data:', {
        id: processedData.id || processedData.messageId,
        coordinates: processedData.geospatial?.coordinates,
        category: processedData.category,
        timestamp: processedData.processedAt
      });
      
      // Simulate database operation
      await this.delay(10); // Mock DB write delay
      
      return true;
    } catch (error) {
      console.error('Failed to store location data:', error);
      return false;
    }
  }

  /**
   * Publish processed event
   */
  async publishProcessedEvent(originalMessage, processedData) {
    try {
      const event = {
        type: 'location.processed',
        data: {
          originalMessage: originalMessage,
          processedData: processedData,
          processingStats: this.getStats()
        },
        timestamp: new Date().toISOString(),
        source: 'location-worker'
      };

      await this.amqpService.publishAnalyticsEvent(event, 'normal');
      
    } catch (error) {
      console.error('Failed to publish processed event:', error);
    }
  }

  /**
   * Publish error event
   */
  async publishErrorEvent(originalMessage, error) {
    try {
      const event = {
        type: 'location.error',
        data: {
          originalMessage: originalMessage,
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code
          },
          processingStats: this.getStats()
        },
        timestamp: new Date().toISOString(),
        source: 'location-worker'
      };

      await this.amqpService.publishSystemTask(event, 'high');
      
    } catch (publishError) {
      console.error('Failed to publish error event:', publishError);
    }
  }

  /**
   * Update worker statistics
   */
  updateStats(processingTime, success) {
    this.stats.totalProcessed++;
    
    if (success) {
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
      messagesPerSecond: uptime > 0 ? (this.stats.totalProcessed / (uptime / 1000)) : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log worker statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log('📊 Location Update Worker Statistics:');
    console.log(`  Total Processed: ${stats.totalProcessed}`);
    console.log(`  Successful: ${stats.successful}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`  Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`);
    console.log(`  Messages/Second: ${stats.messagesPerSecond.toFixed(2)}`);
    console.log(`  Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Shutting down Location Update Worker...');
    
    try {
      if (this.amqpService) {
        await this.amqpService.shutdown();
      }
      
      this.isRunning = false;
      console.log('✅ Location Update Worker shutdown complete');
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
const worker = new LocationUpdateWorker();

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
    console.error('💥 Failed to start Location Update Worker:', error);
    process.exit(1);
  });
}

module.exports = LocationUpdateWorker;
