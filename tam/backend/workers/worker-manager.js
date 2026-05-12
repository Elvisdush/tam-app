/**
 * Worker Manager
 * Orchestrates all AMQP consumer workers
 */

const LocationUpdateWorker = require('./location-update-worker');
const NotificationWorker = require('./notification-worker');
const DataProcessingWorker = require('./data-processing-worker');
const { v4: uuidv4 } = require('uuid');

class WorkerManager {
  constructor(options = {}) {
    this.config = {
      maxWorkers: options.maxWorkers || 5,
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      restartOnFailure: options.restartOnFailure !== false,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout || 10000, // 10 seconds
      ...options
    };
    
    this.workers = new Map();
    this.isRunning = false;
    this.stats = {
      startTime: null,
      totalWorkers: 0,
      activeWorkers: 0,
      totalRestarts: 0,
      totalProcessed: 0,
      uptime: 0
    };
    
    this.healthCheckTimer = null;
  }

  /**
   * Initialize worker manager
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Worker Manager...');
      
      // Start core workers
      await this.startWorker('location-updates', LocationUpdateWorker);
      await this.startWorker('notifications', NotificationWorker);
      await this.startWorker('data-processing', DataProcessingWorker);
      
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      // Start health monitoring
      this.startHealthChecks();
      
      console.log('✅ Worker Manager initialized');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Failed to initialize Worker Manager:', error);
      throw error;
    }
  }

  /**
   * Start individual worker
   */
  async startWorker(workerType, WorkerClass) {
    try {
      console.log(`🔧 Starting ${workerType} worker...`);
      
      const worker = new WorkerClass({
        workerId: `${workerType}-${process.env.WORKER_ID || '1'}`,
        maxRetries: this.config.maxRetries
      });
      
      await worker.initialize();
      
      this.workers.set(workerType, {
        instance: worker,
        type: workerType,
        startTime: new Date(),
        status: 'running',
        restarts: 0,
        lastHealthCheck: new Date()
      });
      
      this.stats.totalWorkers++;
      this.stats.activeWorkers++;
      
      console.log(`✅ ${workerType} worker started`);
      
    } catch (error) {
      console.error(`❌ Failed to start ${workerType} worker:`, error);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    console.log(`🔍 Health checks started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  /**
   * Perform health checks on all workers
   */
  async performHealthChecks() {
    const now = new Date();
    let unhealthyWorkers = 0;
    
    for (const [workerType, workerInfo] of this.workers) {
      try {
        // Check worker health
        const isHealthy = await this.checkWorkerHealth(workerInfo);
        
        if (!isHealthy) {
          console.warn(`⚠️ ${workerType} worker is unhealthy`);
          unhealthyWorkers++;
          
          // Attempt to restart unhealthy worker if configured
          if (this.config.restartOnFailure) {
            await this.restartWorker(workerType);
          }
        } else {
          // Update health status
          workerInfo.lastHealthCheck = now;
          workerInfo.status = isHealthy ? 'healthy' : 'unhealthy';
        }
        
      } catch (error) {
        console.error(`❌ Health check failed for ${workerType} worker:`, error);
        unhealthyWorkers++;
      }
    }
    
    // Update overall stats
    this.stats.activeWorkers = this.workers.size - unhealthyWorkers;
    
    // Log if any workers are unhealthy
    if (unhealthyWorkers > 0) {
      console.warn(`⚠️ ${unhealthyWorkers} workers are unhealthy`);
    }
  }

  /**
   * Check individual worker health
   */
  async checkWorkerHealth(workerInfo) {
    try {
      // Check if worker is responsive
      const startTime = Date.now();
      
      // This would be a more sophisticated health check in production
      // For now, just check if the worker process is still running
      const isResponsive = workerInfo.instance && 
                           workerInfo.instance.stats && 
                           Date.now() - workerInfo.lastHealthCheck.getTime() < 60000; // 1 minute
      
      if (!isResponsive) {
        return false;
      }
      
      // Check worker statistics
      const stats = workerInfo.instance.getStats();
      const successRate = stats.successRate || 0;
      const averageProcessingTime = stats.averageProcessingTime || 0;
      
      // Health criteria
      const isHealthy = successRate > 90 && // 90% success rate
                           averageProcessingTime < 5000 && // < 5 seconds average
                           stats.uptime > 60000; // > 1 minute uptime
      
      return isHealthy;
      
    } catch (error) {
      console.error(`Health check error for ${workerInfo.type}:`, error);
      return false;
    }
  }

  /**
   * Restart worker
   */
  async restartWorker(workerType) {
    try {
      console.log(`🔄 Restarting ${workerType} worker...`);
      
      const workerInfo = this.workers.get(workerType);
      if (workerInfo) {
        // Shutdown old worker
        await workerInfo.instance.shutdown();
        
        // Wait a bit before starting new one
        await this.delay(2000);
        
        // Start new worker
        await this.startWorker(workerType, workerInfo.instance.constructor);
        
        // Update restart statistics
        workerInfo.restarts++;
        this.stats.totalRestarts++;
        
        console.log(`✅ ${workerType} worker restarted (${workerInfo.restarts} restarts)`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to restart ${workerType} worker:`, error);
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    // Aggregate statistics from all workers
    for (const [workerType, workerInfo] of this.workers) {
      if (workerInfo.instance && workerInfo.instance.getStats) {
        const workerStats = workerInfo.instance.getStats();
        totalProcessed += workerStats.totalProcessed || 0;
        totalSuccessful += workerStats.successful || 0;
        totalFailed += workerStats.failed || 0;
      }
    }
    
    this.stats.totalProcessed = totalProcessed;
    this.stats.uptime = uptime;
    
    return {
      manager: {
        ...this.stats,
        uptime: uptime,
        workersPerType: this.workers.size,
        averageRestarts: this.stats.totalWorkers > 0 ? (this.stats.totalRestarts / this.stats.totalWorkers) : 0
      },
      workers: Array.from(this.workers.entries()).map(([type, info]) => ({
        type,
        status: info.status,
        startTime: info.startTime,
        restarts: info.restarts,
        lastHealthCheck: info.lastHealthCheck,
        stats: info.instance?.getStats() || null
      })),
      aggregated: {
        totalProcessed,
        totalSuccessful,
        totalFailed,
        overallSuccessRate: totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 0,
        averageProcessingTime: this.workers.size > 0 ? (totalProcessed / this.workers.size) : 0
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get worker by type
   */
  getWorker(workerType) {
    return this.workers.get(workerType);
  }

  /**
   * Get all workers
   */
  getAllWorkers() {
    return Array.from(this.workers.values());
  }

  /**
   * Scale workers
   */
  async scaleWorkers(targetCount) {
    try {
      console.log(`📈 Scaling workers to ${targetCount}...`);
      
      const currentCount = this.workers.size;
      
      if (targetCount > currentCount) {
        // Add more workers
        const workerTypes = ['location-updates', 'notifications', 'data-processing'];
        
        for (let i = currentCount; i < targetCount && i < this.config.maxWorkers; i++) {
          const workerType = workerTypes[i % workerTypes.length];
          await this.startWorker(workerType);
        }
      } else if (targetCount < currentCount) {
        // Remove workers
        const workersToRemove = Array.from(this.workers.keys()).slice(targetCount);
        
        for (const workerType of workersToRemove) {
          await this.stopWorker(workerType);
        }
      }
      
      console.log(`✅ Workers scaled to ${this.workers.size}`);
      this.logStats();
      
    } catch (error) {
      console.error('❌ Failed to scale workers:', error);
    }
  }

  /**
   * Stop worker
   */
  async stopWorker(workerType) {
    try {
      console.log(`🛑 Stopping ${workerType} worker...`);
      
      const workerInfo = this.workers.get(workerType);
      if (workerInfo) {
        await workerInfo.instance.shutdown();
        this.workers.delete(workerType);
        this.stats.activeWorkers--;
        
        console.log(`✅ ${workerType} worker stopped`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to stop ${workerType} worker:`, error);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Shutting down Worker Manager...');
    
    try {
      // Stop health checks
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }
      
      // Shutdown all workers
      const shutdownPromises = Array.from(this.workers.entries()).map(
        async ([workerType, workerInfo]) => {
          try {
            await workerInfo.instance.shutdown();
            console.log(`✅ ${workerType} worker shutdown`);
          } catch (error) {
            console.error(`❌ Failed to shutdown ${workerType} worker:`, error);
          }
        }
      );
      
      await Promise.all(shutdownPromises);
      
      this.isRunning = false;
      console.log('✅ Worker Manager shutdown complete');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Error during Worker Manager shutdown:', error);
    }
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log('📊 Worker Manager Statistics:');
    console.log(`  Total Workers: ${stats.manager.totalWorkers}`);
    console.log(`  Active Workers: ${stats.manager.activeWorkers}`);
    console.log(`  Total Restarts: ${stats.manager.totalRestarts}`);
    console.log(`  Uptime: ${(stats.manager.uptime / 1000).toFixed(0)}s`);
    console.log(`  Total Processed: ${stats.aggregated.totalProcessed}`);
    console.log(`  Overall Success Rate: ${stats.aggregated.overallSuccessRate.toFixed(2)}%`);
    console.log(`  Average Processing Time: ${stats.aggregated.averageProcessingTime.toFixed(2)}ms`);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WorkerManager;
