/**
 * API Lifecycle Hooks System
 * Manages startup, shutdown, and transition events
 */

import { EventEmitter } from 'events';

export interface LifecycleEvent {
  type: 'startup' | 'shutdown' | 'version_transition' | 'deprecation' | 'sunset';
  timestamp: Date;
  data: any;
  version?: string;
}

export interface LifecycleHook {
  name: string;
  priority: number;
  handler: (event: LifecycleEvent) => Promise<void>;
}

export class APILifecycleManager extends EventEmitter {
  private hooks: Map<string, LifecycleHook[]> = new Map();
  private isShuttingDown = false;
  private gracefulShutdownTimeout = 30000; // 30 seconds

  constructor() {
    super();
    this.setupDefaultHooks();
  }

  private setupDefaultHooks(): void {
    // Startup hooks
    this.registerHook('startup', {
      name: 'database-connection',
      priority: 100,
      handler: async () => {
        console.log('🔌 Establishing database connections...');
        // Database connection logic
      }
    });

    this.registerHook('startup', {
      name: 'cache-warmup',
      priority: 90,
      handler: async () => {
        console.log('🔥 Warming up caches...');
        // Cache warmup logic
      }
    });

    this.registerHook('startup', {
      name: 'health-checks',
      priority: 80,
      handler: async () => {
        console.log('🏥 Running health checks...');
        // Health check logic
      }
    });

    // Shutdown hooks
    this.registerHook('shutdown', {
      name: 'graceful-connections',
      priority: 100,
      handler: async () => {
        console.log('🛑 Closing active connections...');
        // Connection cleanup logic
      }
    });

    this.registerHook('shutdown', {
      name: 'cache-flush',
      priority: 90,
      handler: async () => {
        console.log('💾 Flushing caches...');
        // Cache flush logic
      }
    });

    this.registerHook('shutdown', {
      name: 'cleanup-resources',
      priority: 80,
      handler: async () => {
        console.log('🧹 Cleaning up resources...');
        // Resource cleanup logic
      }
    });
  }

  registerHook(eventType: string, hook: LifecycleHook): void {
    if (!this.hooks.has(eventType)) {
      this.hooks.set(eventType, []);
    }

    const hooks = this.hooks.get(eventType)!;
    hooks.push(hook);
    
    // Sort by priority (higher priority first)
    hooks.sort((a, b) => b.priority - a.priority);
    
    console.log(`🎣 Registered ${hook.name} hook for ${eventType} event`);
  }

  async executeHooks(eventType: string, data?: any, version?: string): Promise<void> {
    const hooks = this.hooks.get(eventType) || [];
    const event: LifecycleEvent = {
      type: eventType as any,
      timestamp: new Date(),
      data: data || {},
      version
    };

    console.log(`🚀 Executing ${hooks.length} hooks for ${eventType} event`);

    for (const hook of hooks) {
      try {
        console.log(`⚡ Running hook: ${hook.name}`);
        await hook.handler(event);
        this.emit('hook:success', { hook: hook.name, event });
      } catch (error) {
        console.error(`❌ Hook ${hook.name} failed:`, error);
        this.emit('hook:error', { hook: hook.name, event, error });
        
        // Decide whether to continue or abort based on hook priority
        if (hook.priority >= 90) {
          console.log(`🛑 Critical hook failed, aborting ${eventType}`);
          throw error;
        }
      }
    }

    console.log(`✅ All ${eventType} hooks completed successfully`);
    this.emit(eventType, event);
  }

  async startup(): Promise<void> {
    console.log('🚀 Starting API lifecycle...');
    
    try {
      await this.executeHooks('startup');
      console.log('✅ API startup completed successfully');
    } catch (error) {
      console.error('❌ API startup failed:', error);
      await this.shutdown();
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⏳ Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log('🛑 Starting graceful shutdown...');

    const shutdownPromise = this.executeHooks('shutdown');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), this.gracefulShutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      console.log('✅ Graceful shutdown completed');
    } catch (error) {
      console.error('❌ Shutdown failed or timed out:', error);
      throw error;
    } finally {
      process.exit(0);
    }
  }

  async versionTransition(fromVersion: string, toVersion: string, data?: any): Promise<void> {
    console.log(`🔄 Transitioning from ${fromVersion} to ${toVersion}...`);
    
    try {
      await this.executeHooks('version_transition', {
        fromVersion,
        toVersion,
        ...data
      });
      
      console.log(`✅ Version transition completed: ${fromVersion} → ${toVersion}`);
    } catch (error) {
      console.error(`❌ Version transition failed:`, error);
      throw error;
    }
  }

  async deprecateVersion(version: string, data?: any): Promise<void> {
    console.log(`⚠️ Deprecating version ${version}...`);
    
    try {
      await this.executeHooks('deprecation', {
        version,
        ...data
      });
      
      console.log(`✅ Version ${version} deprecation completed`);
    } catch (error) {
      console.error(`❌ Version deprecation failed:`, error);
      throw error;
    }
  }

  async sunsetVersion(version: string, data?: any): Promise<void> {
    console.log(`🌅 Sunsetting version ${version}...`);
    
    try {
      await this.executeHooks('sunset', {
        version,
        ...data
      });
      
      console.log(`✅ Version ${version} sunset completed`);
    } catch (error) {
      console.error(`❌ Version sunset failed:`, error);
      throw error;
    }
  }

  getHookStatus(): {
    eventType: string;
    hooks: Array<{ name: string; priority: number; status: string }>;
  }[] {
    const status = [];
    
    for (const [eventType, hooks] of this.hooks.entries()) {
      status.push({
        eventType,
        hooks: hooks.map(hook => ({
          name: hook.name,
          priority: hook.priority,
          status: 'registered'
        }))
      });
    }
    
    return status;
  }
}

// Global lifecycle manager instance
export const lifecycleManager = new APILifecycleManager();

// Setup process signal handlers
process.on('SIGINT', async () => {
  console.log('\n📡 Received SIGINT signal');
  await lifecycleManager.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('\n📡 Received SIGTERM signal');
  await lifecycleManager.shutdown();
});

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught exception:', error);
  await lifecycleManager.shutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  await lifecycleManager.shutdown();
});
