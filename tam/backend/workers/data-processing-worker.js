/**
 * Data Processing Worker
 * Processes analytics events and background data processing tasks
 */

const AMQPService = require('../amqp/amqp-service');
const { v4: uuidv4 } = require('uuid');

class DataProcessingWorker {
  constructor(options = {}) {
    this.config = {
      queueName: 'data.processing',
      maxRetries: 3,
      processingTimeout: 60000,
      batchSize: 15,
      batchTimeout: 10000,
      analyticsInterval: 30000, // 30 seconds
      maxBatchAge: 300000, // 5 minutes
      ...options
    };
    
    this.amqpService = null;
    this.isRunning = false;
    this.processingQueue = [];
    this.analyticsCache = new Map();
    this.stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0,
      analyticsGenerated: 0,
      batchesProcessed: 0,
      startTime: null
    };
  }

  /**
   * Initialize the worker
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Data Processing Worker...');
      
      this.amqpService = new AMQPService({
        hostname: process.env.AMQP_HOSTNAME || 'localhost',
        port: parseInt(process.env.AMQP_PORT) || 5672,
        username: process.env.AMQP_USERNAME || 'guest',
        password: process.env.AMQP_PASSWORD || 'guest',
        maxRetries: this.config.maxRetries
      });

      await this.amqpService.initialize();
      
      // Start consuming data processing tasks
      await this.amqpService.startDataProcessingConsumer(
        this.handleDataProcessingTask.bind(this)
      );
      
      // Start analytics generation
      this.startAnalyticsGeneration();
      
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      console.log('✅ Data Processing Worker initialized');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Failed to initialize Data Processing Worker:', error);
      throw error;
    }
  }

  /**
   * Handle data processing tasks
   */
  async handleDataProcessingTask(message) {
    const startTime = Date.now();
    
    try {
      console.log(`⚙️ Processing data task: ${message.id}`);
      
      // Validate message structure
      const validation = this.validateMessage(message);
      if (!validation.isValid) {
        console.warn(`⚠️ Invalid data processing task: ${validation.errors.join(', ')}`);
        this.stats.failed++;
        return;
      }

      // Process based on task type
      let result;
      switch (message.data.action) {
        case 'analytics_aggregation':
          result = await this.processAnalyticsAggregation(message.data);
          break;
        case 'report_generation':
          result = await this.processReportGeneration(message.data);
          break;
        case 'data_cleanup':
          result = await this.processDataCleanup(message.data);
          break;
        case 'user_analytics':
          result = await this.processUserAnalytics(message.data);
          break;
        case 'performance_metrics':
          result = await this.processPerformanceMetrics(message.data);
          break;
        case 'search_indexing':
          result = await this.processSearchIndexing(message.data);
          break;
        default:
          result = await this.processGenericTask(message.data);
          break;
      }

      // Store processed result
      await this.storeProcessingResult(message, result);
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, true);
      
      console.log(`✅ Data task processed: ${message.id} (${processingTime}ms)`);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(processingTime, false);
      
      console.error(`❌ Failed to process data task ${message.id}:`, error);
      
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
      if (!message.data.action) {
        errors.push('Missing action field');
      }
      
      const validActions = [
        'analytics_aggregation', 'report_generation', 'data_cleanup',
        'user_analytics', 'performance_metrics', 'search_indexing',
        'data_export', 'backup_creation', 'cache_warmup'
      ];
      
      if (!validActions.includes(message.data.action)) {
        errors.push(`Invalid action: ${message.data.action}`);
      }
      
      if (message.data.action === 'analytics_aggregation' && !message.data.timeRange) {
        errors.push('Missing timeRange for analytics aggregation');
      }
      
      if (message.data.action === 'report_generation' && !message.data.reportType) {
        errors.push('Missing reportType for report generation');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Process analytics aggregation
   */
  async processAnalyticsAggregation(data) {
    try {
      console.log('📊 Processing analytics aggregation...');
      
      const { timeRange, metrics, dimensions, filters } = data;
      
      // Mock analytics aggregation
      const aggregation = {
        id: uuidv4(),
        type: 'analytics_aggregation',
        timeRange: timeRange || { start: new Date(Date.now() - 86400000).toISOString(), end: new Date().toISOString() },
        metrics: metrics || ['page_views', 'sessions', 'conversions', 'revenue'],
        dimensions: dimensions || ['user_type', 'device_type', 'location', 'source'],
        filters: filters || {},
        results: {
          totalPageViews: Math.floor(Math.random() * 10000),
          uniqueUsers: Math.floor(Math.random() * 1000),
          averageSessionDuration: Math.floor(Math.random() * 300) + 60,
          conversionRate: (Math.random() * 0.05 + 0.01).toFixed(4),
          totalRevenue: Math.floor(Math.random() * 5000) + 500
        },
        processedAt: new Date().toISOString(),
        processingVersion: '1.0.0'
      };
      
      // Cache aggregation results
      this.analyticsCache.set(`aggregation_${timeRange?.start || 'default'}`, aggregation);
      
      return aggregation;
    } catch (error) {
      console.error('Analytics aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Process report generation
   */
  async processReportGeneration(data) {
    try {
      console.log('📋 Processing report generation...');
      
      const { reportType, parameters, format, recipients } = data;
      
      // Mock report generation
      const report = {
        id: uuidv4(),
        type: 'report_generation',
        reportType: reportType || 'daily_summary',
        parameters: parameters || {},
        format: format || 'pdf',
        generatedAt: new Date().toISOString(),
        downloadUrl: `https://api.tam-app.com/reports/${uuidv4()}.${format}`,
        size: Math.floor(Math.random() * 1000000) + 100000, // bytes
        pageCount: Math.floor(Math.random() * 50) + 10,
        recipients: recipients || [],
        status: 'generated'
      };
      
      // Store report metadata
      await this.storeReportMetadata(report);
      
      return report;
    } catch (error) {
      console.error('Report generation failed:', error);
      throw error;
    }
  }

  /**
   * Process data cleanup
   */
  async processDataCleanup(data) {
    try {
      console.log('🧹 Processing data cleanup...');
      
      const { cleanupType, target, retention, dryRun } = data;
      
      if (dryRun) {
        console.log('🔍 Dry run mode - no actual cleanup performed');
        return {
          id: uuidv4(),
          type: 'data_cleanup',
          cleanupType,
          target,
          estimatedDeletions: Math.floor(Math.random() * 1000) + 100,
          dryRun: true,
          processedAt: new Date().toISOString()
        };
      }
      
      // Mock cleanup operations
      const cleanup = {
        id: uuidv4(),
        type: 'data_cleanup',
        cleanupType: cleanupType || 'temp_files',
        target: target || 'logs',
        retention: retention || { days: 30 },
        deletedItems: Math.floor(Math.random() * 500) + 50,
        freedSpace: Math.floor(Math.random() * 100000000) + 10000000, // bytes
        processedAt: new Date().toISOString()
      };
      
      return cleanup;
    } catch (error) {
      console.error('Data cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Process user analytics
   */
  async processUserAnalytics(data) {
    try {
      console.log('👥 Processing user analytics...');
      
      const { userId, timeRange, metrics, segments } = data;
      
      // Mock user analytics
      const analytics = {
        id: uuidv4(),
        type: 'user_analytics',
        userId: userId,
        timeRange: timeRange || { start: new Date(Date.now() - 604800000).toISOString(), end: new Date().toISOString() },
        metrics: metrics || ['sessions', 'page_views', 'actions', 'conversions'],
        segments: segments || ['new_users', 'returning_users', 'active_users', 'churned_users'],
        results: {
          totalSessions: Math.floor(Math.random() * 100) + 20,
          averageSessionDuration: Math.floor(Math.random() * 600) + 120,
          mostActiveHour: Math.floor(Math.random() * 24),
          conversionFunnel: {
            visitors: 1000,
            signups: 150,
            firstPurchase: 75,
            repeatPurchases: 45
          },
          retention: {
            day1: 0.95,
            day7: 0.85,
            day30: 0.70
          }
        },
        processedAt: new Date().toISOString(),
        processingVersion: '1.0.0'
      };
      
      return analytics;
    } catch (error) {
      console.error('User analytics processing failed:', error);
      throw error;
    }
  }

  /**
   * Process performance metrics
   */
  async processPerformanceMetrics(data) {
    try {
      console.log('📈 Processing performance metrics...');
      
      const { timeRange, services, metrics } = data;
      
      // Mock performance metrics collection
      const performance = {
        id: uuidv4(),
        type: 'performance_metrics',
        timeRange: timeRange || { start: new Date(Date.now() - 3600000).toISOString(), end: new Date().toISOString() },
        services: services || ['api', 'database', 'cache', 'queue'],
        metrics: metrics || ['response_time', 'throughput', 'error_rate', 'cpu_usage', 'memory_usage'],
        results: {
          api: {
            averageResponseTime: Math.floor(Math.random() * 200) + 50,
            requestsPerSecond: Math.floor(Math.random() * 1000) + 100,
            errorRate: (Math.random() * 0.02 + 0.001).toFixed(4)
          },
          database: {
            averageQueryTime: Math.floor(Math.random() * 100) + 20,
            connectionsUsed: Math.floor(Math.random() * 50) + 10,
            slowQueries: Math.floor(Math.random() * 5)
          },
          cache: {
            hitRate: (Math.random() * 0.8 + 0.1).toFixed(2),
            missRate: (Math.random() * 0.2 + 0.1).toFixed(2),
            averageResponseTime: Math.floor(Math.random() * 10) + 2
          },
          queue: {
            depth: Math.floor(Math.random() * 100) + 10,
            processingRate: Math.floor(Math.random() * 500) + 100,
            errorRate: (Math.random() * 0.01 + 0.001).toFixed(4)
          }
        },
        processedAt: new Date().toISOString(),
        processingVersion: '1.0.0'
      };
      
      return performance;
    } catch (error) {
      console.error('Performance metrics processing failed:', error);
      throw error;
    }
  }

  /**
   * Process search indexing
   */
  async processSearchIndexing(data) {
    try {
      console.log('🔍 Processing search indexing...');
      
      const { indexType, documents, updateStrategy } = data;
      
      // Mock search indexing
      const indexing = {
        id: uuidv4(),
        type: 'search_indexing',
        indexType: indexType || 'full_text',
        documents: documents || Math.floor(Math.random() * 1000) + 100,
        updateStrategy: updateStrategy || 'incremental',
        results: {
          indexedDocuments: Math.floor(Math.random() * 1000) + 100,
          indexSize: Math.floor(Math.random() * 100000000) + 10000000, // bytes
          processingTime: Math.floor(Math.random() * 300) + 60,
          termsAdded: Math.floor(Math.random() * 500) + 50
        },
        processedAt: new Date().toISOString(),
        processingVersion: '1.0.0'
      };
      
      return indexing;
    } catch (error) {
      console.error('Search indexing failed:', error);
      throw error;
    }
  }

  /**
   * Process generic task
   */
  async processGenericTask(data) {
    try {
      console.log('⚙️ Processing generic task...');
      
      const result = {
        id: uuidv4(),
        type: 'generic_task',
        data: data,
        processedAt: new Date().toISOString(),
        processingVersion: '1.0.0',
        status: 'completed'
      };
      
      return result;
    } catch (error) {
      console.error('Generic task processing failed:', error);
      throw error;
    }
  }

  /**
   * Store processing result
   */
  async storeProcessingResult(originalMessage, result) {
    try {
      // This would integrate with your database
      console.log('💾 Storing processing result:', {
        messageId: originalMessage.id,
        resultId: result.id,
        type: result.type,
        status: result.status,
        timestamp: result.processedAt
      });
      
      // Simulate database operation
      await this.delay(20); // Mock DB write delay
      
      return true;
    } catch (error) {
      console.error('Failed to store processing result:', error);
      return false;
    }
  }

  /**
   * Store report metadata
   */
  async storeReportMetadata(report) {
    try {
      console.log('💾 Storing report metadata:', {
        reportId: report.id,
        type: report.reportType,
        format: report.format,
        size: report.size,
        generatedAt: report.generatedAt
      });
      
      // Simulate database operation
      await this.delay(15); // Mock DB write delay
      
      return true;
    } catch (error) {
      console.error('Failed to store report metadata:', error);
      return false;
    }
  }

  /**
   * Start analytics generation
   */
  startAnalyticsGeneration() {
    setInterval(async () => {
      try {
        await this.generateScheduledAnalytics();
      } catch (error) {
        console.error('Scheduled analytics generation failed:', error);
      }
    }, this.config.analyticsInterval);
    
    console.log(`📊 Analytics generation started (interval: ${this.config.analyticsInterval}ms)`);
  }

  /**
   * Generate scheduled analytics
   */
  async generateScheduledAnalytics() {
    const analytics = {
      id: uuidv4(),
      type: 'scheduled_analytics',
      timestamp: new Date().toISOString(),
      metrics: {
        systemHealth: this.getSystemHealth(),
        workerStats: this.getStats(),
        queueStatus: this.amqpService?.getQueueStats() || {},
        errorStats: this.amqpService?.getErrorStats() || {}
      },
      processedAt: new Date().toISOString()
    };
    
    try {
      await this.amqpService.publishAnalyticsEvent(analytics, 'normal');
      this.stats.analyticsGenerated++;
      console.log('📊 Scheduled analytics generated');
    } catch (error) {
      console.error('Failed to generate scheduled analytics:', error);
    }
  }

  /**
   * Get system health metrics
   */
  getSystemHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        idle: cpuUsage.idle
      },
      uptime: process.uptime(),
      loadAverage: require('os').loadavg()
    };
  }

  /**
   * Publish error event
   */
  async publishErrorEvent(originalMessage, error) {
    try {
      const event = {
        type: 'data_processing_error',
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
        source: 'data-processing-worker'
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
      tasksPerSecond: uptime > 0 ? (this.stats.totalProcessed / (uptime / 1000)) : 0,
      analyticsPerHour: uptime > 0 ? (this.stats.analyticsGenerated / (uptime / 3600000)) : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log worker statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log('📊 Data Processing Worker Statistics:');
    console.log(`  Total Processed: ${stats.totalProcessed}`);
    console.log(`  Successful: ${stats.successful}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`  Average Processing Time: ${stats.averageProcessingTime.toFixed(2)}ms`);
    console.log(`  Tasks/Second: ${stats.tasksPerSecond.toFixed(2)}`);
    console.log(`  Analytics Generated: ${stats.analyticsGenerated}`);
    console.log(`  Analytics/Hour: ${stats.analyticsPerHour.toFixed(2)}`);
    console.log(`  Uptime: ${(stats.uptime / 1000).toFixed(0)}s`);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Shutting down Data Processing Worker...');
    
    try {
      if (this.amqpService) {
        await this.amqpService.shutdown();
      }
      
      this.isRunning = false;
      console.log('✅ Data Processing Worker shutdown complete');
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
const worker = new DataProcessingWorker();

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
    console.error('💥 Failed to start Data Processing Worker:', error);
    process.exit(1);
  });
}

module.exports = DataProcessingWorker;
