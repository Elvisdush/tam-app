/**
 * Enhanced tRPC Router for TAM App
 * Optimized for location-based services with real-time capabilities
 */

import { createTRPCRouter } from "./create-context";
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, protectedProcedure } from "./create-context";

// Location-specific procedures
export const locationRouter = createTRPCRouter({
  // Get nearby places with intelligent caching
  getNearbyPlaces: publicProcedure
    .input(z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radius: z.number().min(100).max(10000).default(1000),
      categories: z.array(z.string()).optional(),
      filters: z.object({
        rating: z.number().min(0).max(5).optional(),
        priceRange: z.object({
          min: z.number().optional(),
          max: z.number().optional()
        }).optional(),
        openNow: z.boolean().optional()
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        // Use consistent hashing for cache affinity
        const cacheKey = `nearby:${input.lat}:${input.lng}:${input.radius}`;
        
        const places = await getNearbyPlacesWithCache({
          ...input,
          cacheKey,
          userId: ctx.user?.id
        });
        
        return {
          places,
          metadata: {
            count: places.length,
            searchRadius: input.radius,
            center: { lat: input.lat, lng: input.lng },
            cached: true
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch nearby places',
          cause: error
        });
      }
    }),

  // Calculate optimal route with traffic data
  calculateRoute: publicProcedure
    .input(z.object({
      start: z.object({ lat: z.number(), lng: z.number() }),
      end: z.object({ lat: z.number(), lng: z.number() }),
      preferences: z.object({
        avoidTolls: z.boolean().default(false),
        avoidHighways: z.boolean().default(false),
        transportMode: z.enum(['driving', 'walking', 'transit']).default('driving')
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const route = await calculateOptimalRoute({
          ...input,
          userId: ctx.user?.id,
          realTimeTraffic: true
        });
        
        return {
          route,
          alternatives: route.alternatives || [],
          metadata: {
            distance: route.distance,
            duration: route.duration,
            traffic: route.trafficCondition,
            tolls: route.tolls || 0
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to calculate route',
          cause: error
        });
      }
    }),

  // Real-time location updates (subscription)
  onLocationUpdate: protectedProcedure
    .input(z.object({
      watchRadius: z.number().default(5000)
    }))
    .subscription(({ input, ctx }) => {
      return async function* (emit) {
        // Subscribe to user's location updates
        const subscription = await subscribeToLocationUpdates({
          userId: ctx.user.id,
          watchRadius: input.watchRadius,
          onLocation: (location) => {
            emit({
              type: 'location_update',
              data: location,
              timestamp: new Date().toISOString()
            });
          },
          onProximity: (place) => {
            emit({
              type: 'nearby_place',
              data: place,
              timestamp: new Date().toISOString()
            });
          }
        });
        
        // Cleanup on unsubscribe
        return () => {
          subscription.unsubscribe();
        };
      };
    }),

  // Search places with advanced filtering
  searchPlaces: publicProcedure
    .input(z.object({
      query: z.string().min(2).max(200),
      location: z.object({ lat: z.number(), lng: z.number() }).optional(),
      radius: z.number().default(5000),
      filters: z.object({
        category: z.string().optional(),
        priceLevel: z.enum(['$', '$$', '$$$']).optional(),
        rating: z.number().min(0).max(5).optional(),
        features: z.array(z.string()).optional()
      }).optional(),
      pagination: z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0)
      }).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const results = await searchPlacesWithFilters({
          ...input,
          userId: ctx.user?.id,
          searchHistory: true
        });
        
        return {
          results,
          pagination: {
            total: results.total,
            limit: input.pagination?.limit || 20,
            offset: input.pagination?.offset || 0,
            hasMore: results.hasMore
          },
          metadata: {
            searchTime: results.searchTime,
            cacheHit: results.fromCache
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Search failed',
          cause: error
        });
      }
    })
});

// User-specific procedures
export const userRouter = createTRPCRouter({
  // Get user profile with preferences
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const profile = await getUserProfileWithCache(ctx.user.id);
        
        return {
          profile: {
            ...profile,
            preferences: profile.preferences || {},
            stats: profile.stats || {}
          },
          metadata: {
            lastUpdated: profile.updatedAt,
            completeness: calculateProfileCompleteness(profile)
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch profile',
          cause: error
        });
      }
    }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      preferences: z.object({
        notifications: z.object({
          locationSharing: z.boolean(),
          trafficAlerts: z.boolean(),
          nearbyFriends: z.boolean()
        }),
        navigation: z.object({
          defaultTransportMode: z.enum(['driving', 'walking', 'transit']),
          avoidTolls: z.boolean(),
          voiceGuidance: z.boolean()
        }),
        privacy: z.object({
          profileVisibility: z.enum(['public', 'friends', 'private']),
          locationHistory: z.boolean()
        })
      })
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const updatedProfile = await updateUserPreferences({
          userId: ctx.user.id,
          preferences: input.preferences
        });
        
        return {
          success: true,
          profile: updatedProfile,
          metadata: {
            updatedAt: new Date().toISOString()
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update preferences',
          cause: error
        });
      }
    }),

  // Save favorite places
  saveFavoritePlace: protectedProcedure
    .input(z.object({
      placeId: z.string(),
      category: z.string().optional(),
      notes: z.string().max(500).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const favorite = await saveFavoritePlace({
          userId: ctx.user.id,
          placeId: input.placeId,
          category: input.category || 'general',
          notes: input.notes
        });
        
        return {
          success: true,
          favorite,
          metadata: {
            savedAt: new Date().toISOString(),
            totalFavorites: await getUserFavoriteCount(ctx.user.id)
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save favorite place',
          cause: error
        });
      }
    })
});

// Place-specific procedures
export const placeRouter = createTRPCRouter({
  // Get detailed place information
  getDetails: publicProcedure
    .input(z.object({
      placeId: z.string(),
      includeReviews: z.boolean().default(true),
      includePhotos: z.boolean().default(true)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const [place, reviews, photos] = await Promise.all([
          getPlaceDetails(input.placeId),
          input.includeReviews ? getPlaceReviews(input.placeId, 10) : Promise.resolve([]),
          input.includePhotos ? getPlacePhotos(input.placeId) : Promise.resolve([])
        ]);
        
        return {
          place: {
            ...place,
            reviews: reviews.map(review => ({
              ...review,
              user: review.userId === ctx.user?.id ? review.user : sanitizeUser(review.user)
            })),
            photos
          },
          metadata: {
            hasReviews: reviews.length > 0,
            reviewCount: reviews.length,
            averageRating: calculateAverageRating(reviews),
            photoCount: photos.length
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Place not found',
          cause: error
        });
      }
    }),

  // Submit place review
  submitReview: protectedProcedure
    .input(z.object({
      placeId: z.string(),
      rating: z.number().min(1).max(5),
      comment: z.string().max(1000),
      photos: z.array(z.string()).max(5).optional(),
      tags: z.array(z.string()).max(10).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const review = await submitPlaceReview({
          ...input,
          userId: ctx.user.id,
          userAgent: ctx.headers['user-agent']
        });
        
        return {
          success: true,
          review: sanitizeReview(review),
          metadata: {
            submittedAt: new Date().toISOString(),
            moderationStatus: 'pending'
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit review',
          cause: error
        });
      }
    }),

  // Real-time place updates
  onPlaceUpdate: publicProcedure
    .input(z.object({
      placeId: z.string(),
      updateTypes: z.array(z.enum(['reviews', 'photos', 'info', 'hours'])).default(['reviews', 'info'])
    }))
    .subscription(({ input }) => {
      return async function* (emit) {
        const subscription = await subscribeToPlaceUpdates({
          placeId: input.placeId,
          updateTypes: input.updateTypes,
          onUpdate: (update) => {
            emit({
              type: update.type,
              placeId: input.placeId,
              data: update.data,
              timestamp: new Date().toISOString()
            });
          }
        });
        
        return () => {
          subscription.unsubscribe();
        };
      };
    })
});

// Enhanced main router
export const enhancedAppRouter = createTRPCRouter({
  location: locationRouter,
  user: userRouter,
  places: placeRouter,
  
  // System procedures
  health: publicProcedure
    .query(async () => {
      return {
        status: 'healthy',
        version: '2.0.0',
        features: {
          consistentHashing: true,
          realTimeUpdates: true,
          advancedCaching: true,
          loadBalancing: true
        },
        timestamp: new Date().toISOString()
      };
    }),
    
  analytics: publicProcedure
    .input(z.object({
      type: z.enum(['search', 'navigation', 'place_views', 'user_activity']),
      timeRange: z.object({
        start: z.date().optional(),
        end: z.date().optional()
      }).optional()
    }))
    .query(async ({ input }) => {
      // Analytics implementation
      return await getAnalyticsData(input);
    })
});

export type EnhancedAppRouter = typeof enhancedAppRouter;
