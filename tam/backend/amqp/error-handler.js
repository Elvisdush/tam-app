/**
 * AMQP Error Handler and Retry Manager
 * Provides comprehensive error handling, retry logic, and circuit breaker functionality
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class AMQPErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Retry configuration
    this.maxRetries = options.maxRetries || 5;
    this.initialRetryDelay = options.initialRetryDelay || 1000;
    this.maxRetryDelay = options.maxRetryDelay || 30000;
    this.retryBackoffMultiplier = options.retryBackoffMultiplier || 2;
    this.retryBackoffStrategy = options.retryBackoffStrategy || 'exponential'; // exponential, linear, fixed
    
    // Circuit breaker configuration
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000; // 1 minute
    this.circuitBreakerEnabled = options.circuitBreakerEnabled !== false;
    
    // Dead letter queue configuration
    this.deadLetterQueueEnabled = options.deadLetterQueueEnabled !== false;
    this.deadLetterMaxRetries = options.deadLetterMaxRetries || 3;
    
    // State tracking
    this.retryAttempts = new Map(); // messageId -> retry count
    this.circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = null;
    this.errorStats = {
      totalErrors: 0,
      connectionErrors: 0,
      channelErrors: 0,
      publishErrors: 0,
      consumeErrors: 0,
      retrySuccess: 0,
      retryFailure: 0,
      deadLetterMessages: 0
    };
    
    // Error handlers registry
    this.errorHandlers = new Map();
    this.retryHandlers = new Map();
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Handle AMQP error with appropriate retry logic
   */
  async handleError(error, context = {}) {
    const errorId = uuidv4();
    const errorInfo = {
      id: errorId,
      error: error,
      context: context,
      timestamp: new Date().toISOString(),
      retryCount: this.retryAttempts.get(context.messageId) || 0
    };

    // Update error statistics
    this.updateErrorStats(error);
    
    // Emit error event
    this.emit('error', errorInfo);
    
    console.error(`❌ AMQP Error [${errorId}]:`, error.message);
    
    // Check circuit breaker
    if (this.circuitBreakerEnabled && this.isCircuitBreakerOpen()) {
      console.log('🚫 Circuit breaker is OPEN, rejecting operation');
      this.emit('circuitBreakerOpen', errorInfo);
      return { success: false, reason: 'circuit_breaker_open', errorId };
    }
    
    // Determine retry strategy
    const retryStrategy = this.getRetryStrategy(error, context);
    
    if (retryStrategy.shouldRetry) {
      return await this.handleRetry(errorInfo, retryStrategy);
    } else {
      return await this.handleFinalFailure(errorInfo);
    }
  }

  /**
   * Determine retry strategy based on error type and context
   */
  getRetryStrategy(error, context) {
    const retryCount = this.retryAttempts.get(context.messageId) || 0;
    
    // Check if max retries exceeded
    if (retryCount >= this.maxRetries) {
      return { shouldRetry: false, reason: 'max_retries_exceeded' };
    }
    
    // Check error type for retry eligibility
    const retryableErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'PRECONDITION_FAILED',
      'CHANNEL_ERROR'
    ];
    
    const isRetryable = retryableErrors.some(code => 
      error.code === code || error.message.includes(code)
    );
    
    if (!isRetryable) {
      return { shouldRetry: false, reason: 'non_retryable_error' };
    }
    
    // Calculate retry delay
    const delay = this.calculateRetryDelay(retryCount);
    
    return {
      shouldRetry: true,
      delay: delay,
      retryCount: retryCount + 1
    };
  }

  /**
   * Calculate retry delay based on strategy
   */
  calculateRetryDelay(retryCount) {
    let delay;
    
    switch (this.retryBackoffStrategy) {
      case 'exponential':
        delay = Math.min(
          this.initialRetryDelay * Math.pow(this.retryBackoffMultiplier, retryCount),
          this.maxRetryDelay
        );
        break;
      case 'linear':
        delay = Math.min(
          this.initialRetryDelay + (retryCount * this.initialRetryDelay),
          this.maxRetryDelay
        );
        break;
      case 'fixed':
        delay = this.initialRetryDelay;
        break;
      default:
        delay = this.initialRetryDelay;
    }
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Handle retry with delay
   */
  async handleRetry(errorInfo, retryStrategy) {
    const { messageId, context } = errorInfo;
    
    // Update retry attempts
    this.retryAttempts.set(messageId, retryStrategy.retryCount);
    
    console.log(`🔄 Retrying operation [${errorInfo.id}] in ${retryStrategy.delay}ms (attempt ${retryStrategy.retryCount}/${this.maxRetries})`);
    
    // Emit retry event
    this.emit('retry', {
      ...errorInfo,
      retryCount: retryStrategy.retryCount,
      delay: retryStrategy.delay
    });
    
    // Wait for retry delay
    await this.delay(retryStrategy.delay);
    
    return {
      success: true,
      shouldRetry: true,
      retryCount: retryStrategy.retryCount,
      delay: retryStrategy.delay,
      errorId: errorInfo.id
    };
  }

  /**
   * Handle final failure when retries are exhausted
   */
  async handleFinalFailure(errorInfo) {
    const { messageId, context, error } = errorInfo;
    
    console.log(`❌ Final failure for operation [${errorInfo.id}] after ${this.maxRetries} retries`);
    
    // Update circuit breaker
    if (this.circuitBreakerEnabled) {
      this.updateCircuitBreaker();
    }
    
    // Send to dead letter queue if enabled
    if (this.deadLetterQueueEnabled && context.deadLetterQueue) {
      await this.sendToDeadLetterQueue(errorInfo);
    }
    
    // Clean up retry attempts
    this.retryAttempts.delete(messageId);
    
    // Update statistics
    this.errorStats.retryFailure++;
    
    // Emit final failure event
    this.emit('finalFailure', errorInfo);
    
    return {
      success: false,
      shouldRetry: false,
      reason: 'max_retries_exceeded',
      errorId: errorInfo.id
    };
  }

  /**
   * Send failed message to dead letter queue
   */
  async sendToDeadLetterQueue(errorInfo) {
    try {
      const deadLetterMessage = {
        originalMessage: errorInfo.context.originalMessage,
        error: {
          message: errorInfo.error.message,
          code: errorInfo.error.code,
          stack: errorInfo.error.stack
        },
        context: errorInfo.context,
        retryCount: errorInfo.retryCount,
        timestamp: errorInfo.timestamp,
        errorId: errorInfo.id,
        finalFailureReason: 'max_retries_exceeded'
      };
      
      // Emit dead letter event
      this.emit('deadLetter', deadLetterMessage);
      
      console.log(`💀 Message sent to dead letter queue [${errorInfo.id}]`);
      this.errorStats.deadLetterMessages++;
      
    } catch (dlqError) {
      console.error('❌ Failed to send to dead letter queue:', dlqError);
      this.emit('deadLetterError', { originalError: errorInfo, dlqError });
    }
  }

  /**
   * Handle successful operation
   */
  handleSuccess(messageId) {
    // Clean up retry attempts
    this.retryAttempts.delete(messageId);
    
    // Reset circuit breaker on success
    if (this.circuitBreakerEnabled && this.circuitBreakerState === 'HALF_OPEN') {
      this.resetCircuitBreaker();
    }
    
    // Update statistics
    this.errorStats.retrySuccess++;
    
    // Emit success event
    this.emit('success', { messageId, timestamp: new Date().toISOString() });
  }

  /**
   * Circuit breaker management
   */
  isCircuitBreakerOpen() {
    if (this.circuitBreakerState === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure;
      if (timeSinceLastFailure > this.circuitBreakerTimeout) {
        this.circuitBreakerState = 'HALF_OPEN';
        console.log('🔄 Circuit breaker transitioning to HALF_OPEN');
        this.emit('circuitBreakerHalfOpen');
        return false;
      }
      return true;
    }
    return false;
  }

  updateCircuitBreaker() {
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();
    
    if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
      this.circuitBreakerState = 'OPEN';
      console.log(`🚫 Circuit breaker OPEN after ${this.circuitBreakerFailures} failures`);
      this.emit('circuitBreakerOpen', { failures: this.circuitBreakerFailures });
    }
  }

  resetCircuitBreaker() {
    this.circuitBreakerState = 'CLOSED';
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = null;
    console.log('✅ Circuit breaker reset to CLOSED');
    this.emit('circuitBreakerReset');
  }

  /**
   * Update error statistics
   */
  updateErrorStats(error) {
    this.errorStats.totalErrors++;
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      this.errorStats.connectionErrors++;
    } else if (error.message.includes('channel')) {
      this.errorStats.channelErrors++;
    } else if (error.message.includes('publish')) {
      this.errorStats.publishErrors++;
    } else if (error.message.includes('consume')) {
      this.errorStats.consumeErrors++;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      ...this.errorStats,
      circuitBreakerState: this.circuitBreakerState,
      circuitBreakerFailures: this.circuitBreakerFailures,
      activeRetryAttempts: this.retryAttempts.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Register custom error handler
   */
  registerErrorHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }

  /**
   * Register custom retry handler
   */
  registerRetryHandler(messageType, handler) {
    this.retryHandlers.set(messageType, handler);
  }

  /**
   * Cleanup old retry attempts
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 300000; // 5 minutes
      
      for (const [messageId, timestamp] of this.retryAttempts) {
        if (typeof timestamp === 'number' && (now - timestamp) > maxAge) {
          this.retryAttempts.delete(messageId);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.errorStats = {
      totalErrors: 0,
      connectionErrors: 0,
      channelErrors: 0,
      publishErrors: 0,
      consumeErrors: 0,
      retrySuccess: 0,
      retryFailure: 0,
      deadLetterMessages: 0
    };
    this.retryAttempts.clear();
    this.resetCircuitBreaker();
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down AMQP error handler...');
    
    // Clear retry attempts
    this.retryAttempts.clear();
    
    // Reset circuit breaker
    this.resetCircuitBreaker();
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('✅ AMQP error handler shutdown complete');
  }
}

module.exports = AMQPErrorHandler;
