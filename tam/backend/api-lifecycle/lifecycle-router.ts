/**
 * API Lifecycle Router
 * Integrates all lifecycle management into a unified router
 */

import { createTRPCRouter } from '../trpc/create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure } from '../trpc/create-context';
import { versionManager } from './version-manager';
import { lifecycleManager } from './lifecycle-hooks';
import { migrationManager } from './migration-framework';
import { deprecationManager } from './deprecation-manager';

export const apiLifecycleRouter = createTRPCRouter({
  // Version Management
  versions: createTRPCRouter({
    // Get all available versions
    list: publicProcedure
      .query(async () => {
        return {
          active: versionManager.getActiveVersions(),
          deprecated: versionManager.getDeprecatedVersions(),
          default: versionManager.getDefaultVersion(),
          supported: ['v1', 'v2']
        };
      }),

    // Get version details
    get: publicProcedure
      .input(z.object({ version: z.string() }))
      .query(async ({ input }) => {
        const version = versionManager.getVersion(input.version);
        
        if (!version) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Version ${input.version} not found`
          });
        }

        return version;
      }),

    // Deprecate a version
    deprecate: protectedProcedure
      .input(z.object({
        version: z.string(),
        deprecationDate: z.date(),
        sunsetDate: z.date()
      }))
      .mutation(async ({ input }) => {
        versionManager.deprecateVersion(input.version, input.deprecationDate, input.sunsetDate);
        
        await deprecationManager.forceNotification(input.version, 'warning');
        
        return {
          success: true,
          message: `Version ${input.version} deprecated successfully`
        };
      })
  }),

  // Migration Management
  migrations: createTRPCRouter({
    // Get migration status
    status: publicProcedure
      .query(async () => {
        return migrationManager.getMigrationStatus();
      }),

    // Create migration plan
    plan: publicProcedure
      .input(z.object({
        fromVersion: z.string(),
        toVersion: z.string()
      }))
      .query(async ({ input }) => {
        const plan = await migrationManager.createMigrationPlan(input.fromVersion, input.toVersion);
        return plan;
      }),

    // Dry run migration
    dryRun: publicProcedure
      .input(z.object({
        fromVersion: z.string(),
        toVersion: z.string()
      }))
      .query(async ({ input }) => {
        const plan = await migrationManager.createMigrationPlan(input.fromVersion, input.toVersion);
        const dryRun = await migrationManager.dryRunMigration(plan);
        return dryRun;
      }),

    // Execute migration
    execute: protectedProcedure
      .input(z.object({
        fromVersion: z.string(),
        toVersion: z.string(),
        confirm: z.boolean().default(false)
      }))
      .mutation(async ({ input }) => {
        if (!input.confirm) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Migration requires explicit confirmation'
          });
        }

        const plan = await migrationManager.createMigrationPlan(input.fromVersion, input.toVersion);
        
        try {
          await migrationManager.executeMigration(plan);
          
          return {
            success: true,
            message: `Migration completed: ${input.fromVersion} → ${input.toVersion}`
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Migration failed',
            cause: error
          });
        }
      }),

    // Rollback migration
    rollback: protectedProcedure
      .input(z.object({
        fromVersion: z.string(),
        toVersion: z.string(),
        confirm: z.boolean().default(false)
      }))
      .mutation(async ({ input }) => {
        if (!input.confirm) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Rollback requires explicit confirmation'
          });
        }

        const plan = await migrationManager.createMigrationPlan(input.fromVersion, input.toVersion);
        
        try {
          await migrationManager.rollbackMigration(plan);
          
          return {
            success: true,
            message: `Rollback completed: ${input.toVersion} → ${input.fromVersion}`
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Rollback failed',
            cause: error
          });
        }
      })
  }),

  // Deprecation Management
  deprecation: createTRPCRouter({
    // Get deprecation schedules
    schedules: publicProcedure
      .query(async () => {
        return deprecationManager.getAllSchedules();
      }),

    // Get deprecation status
    status: publicProcedure
      .input(z.object({ version: z.string() }))
      .query(async ({ input }) => {
        const status = deprecationManager.getDeprecationStatus(input.version);
        
        if (!status) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No deprecation schedule for version ${input.version}`
          });
        }

        return status;
      }),

    // Register client for notifications
    registerClient: publicProcedure
      .input(z.object({
        clientId: z.string(),
        name: z.string(),
        contactEmail: z.string().email(),
        versions: z.array(z.string())
      }))
      .mutation(async ({ input }) => {
        const client = {
          ...input,
          lastSeen: new Date(),
          notificationsSent: []
        };

        deprecationManager.registerClient(client);
        
        return {
          success: true,
          message: `Client ${input.name} registered successfully`
        };
      }),

    // Update client usage
    updateUsage: publicProcedure
      .input(z.object({
        clientId: z.string(),
        versions: z.array(z.string())
      }))
      .mutation(async ({ input }) => {
        deprecationManager.updateClientUsage(input.clientId, input.versions);
        
        return {
          success: true,
          message: 'Usage updated successfully'
        };
      }),

    // Get client status
    clientStatus: publicProcedure
      .input(z.object({ clientId: z.string().optional() }))
      .query(async ({ input }) => {
        if (input.clientId) {
          const client = deprecationManager.getClientStatus().find(c => c.clientId === input.clientId);
          
          if (!client) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Client ${input.clientId} not found`
            });
          }

          return client;
        }

        return deprecationManager.getClientStatus();
      }),

    // Force notification
    forceNotification: protectedProcedure
      .input(z.object({
        version: z.string(),
        type: z.enum(['warning', 'critical', 'final'])
      }))
      .mutation(async ({ input }) => {
        try {
          await deprecationManager.forceNotification(input.version, input.type);
          
          return {
            success: true,
            message: `Forced ${input.type} notification for version ${input.version}`
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to force notification',
            cause: error
          });
        }
      }),

    // Get notification history
    notificationHistory: publicProcedure
      .input(z.object({ version: z.string().optional() }))
      .query(async ({ input }) => {
        return deprecationManager.getNotificationHistory(input.version);
      })
  }),

  // Lifecycle Management
  lifecycle: createTRPCRouter({
    // Get lifecycle status
    status: publicProcedure
      .query(async () => {
        return {
          hooks: lifecycleManager.getHookStatus(),
          isShuttingDown: false,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        };
      }),

    // Trigger startup
    startup: protectedProcedure
      .mutation(async () => {
        try {
          await lifecycleManager.startup();
          
          return {
            success: true,
            message: 'API lifecycle startup completed'
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Startup failed',
            cause: error
          });
        }
      }),

    // Trigger shutdown
    shutdown: protectedProcedure
      .input(z.object({
        graceful: z.boolean().default(true),
        timeout: z.number().default(30000)
      }))
      .mutation(async ({ input }) => {
        try {
          await lifecycleManager.shutdown();
          
          return {
            success: true,
            message: 'API lifecycle shutdown initiated'
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Shutdown failed',
            cause: error
          });
        }
      }),

    // Version transition
    transition: protectedProcedure
      .input(z.object({
        fromVersion: z.string(),
        toVersion: z.string(),
        data: z.any().optional()
      }))
      .mutation(async ({ input }) => {
        try {
          await lifecycleManager.versionTransition(input.fromVersion, input.toVersion, input.data);
          
          return {
            success: true,
            message: `Version transition completed: ${input.fromVersion} → ${input.toVersion}`
          };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Version transition failed',
            cause: error
          });
        }
      })
  }),

  // Analytics and Monitoring
  analytics: createTRPCRouter({
    // Get API usage statistics
    usage: publicProcedure
      .input(z.object({
        version: z.string().optional(),
        timeRange: z.object({
          start: z.date().optional(),
          end: z.date().optional()
        }).optional()
      }))
      .query(async ({ input }) => {
        // Analytics implementation
        return {
          totalRequests: 0,
          requestsByVersion: {},
          requestsByEndpoint: {},
          averageResponseTime: 0,
          errorRate: 0,
          timeRange: input.timeRange
        };
      }),

    // Get performance metrics
    performance: publicProcedure
      .input(z.object({
        version: z.string().optional(),
        timeRange: z.object({
          start: z.date().optional(),
          end: z.date().optional()
        }).optional()
      }))
      .query(async ({ input }) => {
        // Performance metrics implementation
        return {
          responseTime: {
            p50: 0,
            p95: 0,
            p99: 0
          },
          throughput: 0,
          errorRate: 0,
          cacheHitRate: 0,
          memoryUsage: process.memoryUsage()
        };
      }),

    // Get health status
    health: publicProcedure
      .query(async () => {
        return {
          status: 'healthy',
          version: '2.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          loadAverage: require('os').loadavg(),
          timestamp: new Date().toISOString()
        };
      })
  })
});

export type APILifecycleRouter = typeof apiLifecycleRouter;
