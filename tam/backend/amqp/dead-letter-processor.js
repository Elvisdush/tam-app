/**
 * Dead Letter Queue Processor
 * Handles failed messages from AMQP queues with analysis and recovery options
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class DeadLetterProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.deadLetterQueue = options.deadLetterQueue || 'dead.letter';
    this.maxProcessingAttempts = options.maxProcessingAttempts || 3;
    this.processingDelay = options.processingDelay || 5000;
    this.saveFailedMessages = options.saveFailedMessages !== false;
    this.failedMessagesPath = options.failedMessagesPath || './logs/dead-letter-messages';
    
    // State tracking
    this.isProcessing = false;
    this.processingQueue = [];
    this.processingStats = {
      totalProcessed: 0,
      successfullyRecovered: 0,
      permanentlyFailed: 0,
      averageProcessingTime: 0,
      lastProcessed: null
    };
    
    // Message handlers
    this.recoveryHandlers = new Map();
    this.analysisHandlers = new Map();
    
    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  /**
   * Initialize dead letter processor
   */
  async initialize(amqpService) {
    try {
      console.log('🔧 Initializing dead letter processor...');
      
      this.amqpService = amqpService;
      
      // Start consuming from dead letter queue
      await this.startDeadLetterConsumer();
      
      // Start processing loop
      this.startProcessingLoop();
      
      console.log('✅ Dead letter processor initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize dead letter processor:', error);
      throw error;
    }
  }

  /**
   * Start consuming from dead letter queue
   */
  async startDeadLetterConsumer() {
    await this.amqpService.consumeMessages(this.deadLetterQueue, async (message) => {
      await this.handleDeadLetterMessage(message);
    });
    
    console.log(`📥 Started consuming from dead letter queue: ${this.deadLetterQueue}`);
  }

  /**
   * Handle dead letter message
   */
  async handleDeadLetterMessage(message) {
    try {
      const deadLetterMessage = this.parseDeadLetterMessage(message);
      
      console.log(`💀 Processing dead letter message: ${deadLetterMessage.errorId}`);
      
      // Add to processing queue
      this.processingQueue.push({
        message: deadLetterMessage,
        originalMessage: message,
        attempts: 0,
        timestamp: new Date().toISOString()
      });
      
      // Emit message received event
      this.emit('deadLetterReceived', deadLetterMessage);
      
    } catch (error) {
      console.error('❌ Error handling dead letter message:', error);
      this.emit('processingError', { error, message });
    }
  }

  /**
   * Parse dead letter message
   */
  parseDeadLetterMessage(message) {
    try {
      return typeof message === 'string' ? JSON.parse(message) : message;
    } catch (error) {
      console.error('❌ Failed to parse dead letter message:', error);
      return {
        errorId: 'unknown',
        originalMessage: message,
        error: { message: 'Failed to parse message' },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Start processing loop
   */
  startProcessingLoop() {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processNextMessage();
      }
    }, this.processingDelay);
  }

  /**
   * Process next message in queue
   */
  async processNextMessage() {
    if (this.processingQueue.length === 0) return;
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      const queueItem = this.processingQueue.shift();
      const { message, originalMessage, attempts } = queueItem;
      
      console.log(`🔄 Processing dead letter message [${message.errorId}] (attempt ${attempts + 1})`);
      
      // Analyze the error
      const analysis = await this.analyzeMessage(message);
      
      // Attempt recovery
      const recoveryResult = await this.attemptRecovery(message, analysis);
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(recoveryResult.success, processingTime);
      
      if (recoveryResult.success) {
        console.log(`✅ Successfully recovered message [${message.errorId}]`);
        this.emit('messageRecovered', { message, analysis, recoveryResult });
      } else {
        queueItem.attempts++;
        
        if (queueItem.attempts < this.maxProcessingAttempts) {
          console.log(`🔄 Re-queuing message [${message.errorId}] for retry`);
          this.processingQueue.push(queueItem);
        } else {
          console.log(`❌ Permanently failed message [${message.errorId}] after ${this.maxProcessingAttempts} attempts`);
          await this.handlePermanentFailure(message, analysis);
          this.emit('messagePermanentlyFailed', { message, analysis });
        }
      }
      
    } catch (error) {
      console.error('❌ Error in processing loop:', error);
      this.emit('processingError', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Analyze dead letter message
   */
  async analyzeMessage(message) {
    const analysis = {
      errorType: this.classifyError(message.error),
      severity: this.assessSeverity(message),
      recoverability: this.assessRecoverability(message),
      recommendations: [],
      timestamp: new Date().toISOString()
    };
    
    // Add specific recommendations based on error type
    switch (analysis.errorType) {
      case 'connection_error':
        analysis.recommendations.push('Check network connectivity');
        analysis.recommendations.push('Verify AMQP server status');
        break;
      case 'timeout_error':
        analysis.recommendations.push('Increase timeout values');
        analysis.recommendations.push('Check system load');
        break;
      case 'validation_error':
        analysis.recommendations.push('Validate message schema');
        analysis.recommendations.push('Check data format');
        break;
      case 'processing_error':
        analysis.recommendations.push('Review processing logic');
        analysis.recommendations.push('Check resource availability');
        break;
      default:
        analysis.recommendations.push('Review error logs');
        analysis.recommendations.push('Check system configuration');
    }
    
    // Run custom analysis handlers
    const customHandler = this.analysisHandlers.get(analysis.errorType);
    if (customHandler) {
      try {
        const customAnalysis = await customHandler(message);
        Object.assign(analysis, customAnalysis);
      } catch (error) {
        console.error('❌ Custom analysis handler failed:', error);
      }
    }
    
    return analysis;
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    if (errorMessage.includes('connection') || errorCode === 'ECONNREFUSED') {
      return 'connection_error';
    } else if (errorMessage.includes('timeout') || errorCode === 'ETIMEDOUT') {
      return 'timeout_error';
    } else if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
      return 'validation_error';
    } else if (errorMessage.includes('processing') || errorMessage.includes('handler')) {
      return 'processing_error';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('authorization')) {
      return 'auth_error';
    } else if (errorMessage.includes('resource') || errorMessage.includes('memory')) {
      return 'resource_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * Assess error severity
   */
  assessSeverity(message) {
    const errorType = this.classifyError(message.error);
    const retryCount = message.retryCount || 0;
    
    if (errorType === 'connection_error' || errorType === 'auth_error') {
      return 'high';
    } else if (retryCount >= 3 || errorType === 'resource_error') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Assess recoverability
   */
  assessRecoverability(message) {
    const errorType = this.classifyError(message.error);
    const retryCount = message.retryCount || 0;
    
    if (errorType === 'connection_error' || errorType === 'timeout_error') {
      return retryCount < 5 ? 'recoverable' : 'unrecoverable';
    } else if (errorType === 'validation_error') {
      return 'recoverable'; // Can be fixed with data transformation
    } else if (errorType === 'processing_error') {
      return retryCount < 3 ? 'recoverable' : 'unrecoverable';
    } else {
      return 'unknown';
    }
  }

  /**
   * Attempt message recovery
   */
  async attemptRecovery(message, analysis) {
    const errorType = analysis.errorType;
    const recoverability = analysis.recoverability;
    
    if (recoverability === 'unrecoverable') {
      return { success: false, reason: 'unrecoverable' };
    }
    
    // Get recovery handler
    const recoveryHandler = this.recoveryHandlers.get(errorType);
    if (recoveryHandler) {
      try {
        const result = await recoveryHandler(message, analysis);
        return result;
      } catch (error) {
        console.error('❌ Custom recovery handler failed:', error);
        return { success: false, reason: 'recovery_handler_failed', error };
      }
    }
    
    // Default recovery strategies
    switch (errorType) {
      case 'connection_error':
        return await this.handleConnectionError(message);
      case 'timeout_error':
        return await this.handleTimeoutError(message);
      case 'validation_error':
        return await this.handleValidationError(message);
      case 'processing_error':
        return await this.handleProcessingError(message);
      default:
        return await this.handleUnknownError(message);
    }
  }

  /**
   * Handle connection error recovery
   */
  async handleConnectionError(message) {
    try {
      // Wait for connection to be restored
      await this.delay(5000);
      
      // Check AMQP connection status
      const connectionStatus = this.amqpService.getConnectionStatus();
      if (connectionStatus.isConnected) {
        // Re-publish the original message
        await this.republishMessage(message);
        return { success: true, strategy: 'republish_after_connection_restore' };
      } else {
        return { success: false, reason: 'connection_not_restored' };
      }
    } catch (error) {
      return { success: false, reason: 'recovery_failed', error };
    }
  }

  /**
   * Handle timeout error recovery
   */
  async handleTimeoutError(message) {
    try {
      // Increase timeout and retry
      const updatedMessage = {
        ...message.originalMessage,
        metadata: {
          ...message.originalMessage.metadata,
          timeout: (message.originalMessage.metadata?.timeout || 30000) * 2,
          retryAfterTimeout: true
        }
      };
      
      await this.republishMessage(updatedMessage);
      return { success: true, strategy: 'increased_timeout_retry' };
    } catch (error) {
      return { success: false, reason: 'recovery_failed', error };
    }
  }

  /**
   * Handle validation error recovery
   */
  async handleValidationError(message) {
    try {
      // Attempt to fix common validation issues
      const fixedMessage = this.fixValidationIssues(message.originalMessage);
      
      if (fixedMessage) {
        await this.republishMessage(fixedMessage);
        return { success: true, strategy: 'validation_fix' };
      } else {
        return { success: false, reason: 'validation_not_fixable' };
      }
    } catch (error) {
      return { success: false, reason: 'recovery_failed', error };
    }
  }

  /**
   * Handle processing error recovery
   */
  async handleProcessingError(message) {
    try {
      // Wait for resources to become available
      await this.delay(10000);
      
      // Re-publish with lower priority
      const updatedMessage = {
        ...message.originalMessage,
        metadata: {
          ...message.originalMessage.metadata,
          priority: 'low',
          retryAfterProcessingError: true
        }
      };
      
      await this.republishMessage(updatedMessage);
      return { success: true, strategy: 'delayed_low_priority_retry' };
    } catch (error) {
      return { success: false, reason: 'recovery_failed', error };
    }
  }

  /**
   * Handle unknown error
   */
  async handleUnknownError(message) {
    // Basic retry strategy for unknown errors
    try {
      await this.delay(15000);
      await this.republishMessage(message.originalMessage);
      return { success: true, strategy: 'basic_retry' };
    } catch (error) {
      return { success: false, reason: 'recovery_failed', error };
    }
  }

  /**
   * Fix common validation issues
   */
  fixValidationIssues(message) {
    try {
      let fixed = false;
      const fixedMessage = JSON.parse(JSON.stringify(message));
      
      // Fix missing required fields
      if (!fixedMessage.timestamp) {
        fixedMessage.timestamp = new Date().toISOString();
        fixed = true;
      }
      
      if (!fixedMessage.id) {
        fixedMessage.id = require('uuid').v4();
        fixed = true;
      }
      
      // Fix data type issues
      if (fixedMessage.metadata && typeof fixedMessage.metadata.priority === 'string') {
        const priorityMap = { 'low': 1, 'normal': 5, 'high': 8, 'critical': 10 };
        fixedMessage.metadata.priority = priorityMap[fixedMessage.metadata.priority] || 5;
        fixed = true;
      }
      
      return fixed ? fixedMessage : null;
    } catch (error) {
      console.error('❌ Error fixing validation issues:', error);
      return null;
    }
  }

  /**
   * Republish message to original queue
   */
  async republishMessage(message) {
    const queue = message.metadata?.originalQueue || 'data.processing';
    
    switch (queue) {
      case 'location.updates':
        await this.amqpService.publishLocationUpdate(message.data, message.metadata.priority);
        break;
      case 'user.notifications':
        await this.amqpService.publishUserNotification(message.data, message.metadata.priority);
        break;
      case 'data.processing':
        await this.amqpService.publishDataProcessing(message, message.metadata.priority);
        break;
      case 'analytics.events':
        await this.amqpService.publishAnalyticsEvent(message.data, message.metadata.priority);
        break;
      case 'system.tasks':
        await this.amqpService.publishSystemTask(message.data, message.metadata.priority);
        break;
      default:
        await this.amqpService.publishDataProcessing(message, message.metadata.priority);
    }
  }

  /**
   * Handle permanent failure
   */
  async handlePermanentFailure(message, analysis) {
    console.log(`💀 Permanent failure for message [${message.errorId}]`);
    
    // Save to file if enabled
    if (this.saveFailedMessages) {
      await this.saveFailedMessage(message, analysis);
    }
    
    // Update statistics
    this.processingStats.permanentlyFailed++;
  }

  /**
   * Save failed message to file
   */
  async saveFailedMessage(message, analysis) {
    try {
      const filename = `dead-letter-${message.errorId}-${Date.now()}.json`;
      const filepath = path.join(this.failedMessagesPath, filename);
      
      const data = {
        message,
        analysis,
        processingStats: this.processingStats,
        savedAt: new Date().toISOString()
      };
      
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved failed message to: ${filepath}`);
      
    } catch (error) {
      console.error('❌ Failed to save dead letter message:', error);
    }
  }

  /**
   * Update processing statistics
   */
  updateProcessingStats(success, processingTime) {
    this.processingStats.totalProcessed++;
    this.processingStats.lastProcessed = new Date().toISOString();
    
    if (success) {
      this.processingStats.successfullyRecovered++;
    } else {
      this.processingStats.permanentlyFailed++;
    }
    
    // Update average processing time
    const totalTime = this.processingStats.averageProcessingTime * (this.processingStats.totalProcessed - 1) + processingTime;
    this.processingStats.averageProcessingTime = totalTime / this.processingStats.totalProcessed;
  }

  /**
   * Register custom recovery handler
   */
  registerRecoveryHandler(errorType, handler) {
    this.recoveryHandlers.set(errorType, handler);
  }

  /**
   * Register custom analysis handler
   */
  registerAnalysisHandler(errorType, handler) {
    this.analysisHandlers.set(errorType, handler);
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.failedMessagesPath, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create log directory:', error);
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down dead letter processor...');
    
    // Wait for current processing to complete
    while (this.isProcessing) {
      await this.delay(1000);
    }
    
    // Save remaining messages
    for (const queueItem of this.processingQueue) {
      await this.saveFailedMessage(queueItem.message, { errorType: 'shutdown', severity: 'medium' });
    }
    
    console.log('✅ Dead letter processor shutdown complete');
  }
}

module.exports = DeadLetterProcessor;
