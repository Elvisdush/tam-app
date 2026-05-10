/**
 * tRPC App Router for Backend
 * JavaScript version for Docker compatibility
 */

const { createTRPCRouter } = require('@trpc/server');
const { z } = require('zod');

// Example procedures
const exampleRouter = createTRPCRouter({
  hello: {
    input: z.string().optional(),
    resolve: ({ input }) => {
      return {
        greeting: `Hello ${input || 'World'}!`,
        timestamp: new Date().toISOString()
      };
    },
  },
  getStatus: {
    resolve: () => {
      return {
        status: 'healthy',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
    },
  }
});

const placesRouter = createTRPCRouter({
  search: {
    input: z.object({
      query: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      radius: z.number().default(1000)
    }),
    resolve: ({ input }) => {
      // Mock search results
      const results = [
        {
          id: 'place-1',
          name: 'Sample Restaurant',
          address: '123 Main St',
          rating: 4.5,
          distance: 0.5,
          coordinates: { lat: input.lat || 40.7128, lng: input.lng || -74.0060 }
        },
        {
          id: 'place-2',
          name: 'Sample Cafe',
          address: '456 Oak Ave',
          rating: 4.2,
          distance: 0.8,
          coordinates: { lat: input.lat || 40.7128, lng: input.lng || -74.0060 }
        }
      ];
      
      return {
        success: true,
        results,
        query: input,
        total: results.length,
        timestamp: new Date().toISOString()
      };
    },
  },
  getDetails: {
    input: z.object({
      id: z.string()
    }),
    resolve: ({ input }) => {
      // Mock place details
      const place = {
        id: input.id,
        name: 'Sample Restaurant',
        address: '123 Main St',
        rating: 4.5,
        coordinates: { lat: 40.7128, lng: -74.0060 },
        timestamp: new Date().toISOString()
      };
      
      return {
        success: true,
        place
      };
    },
  }
});

const userRouter = createTRPCRouter({
  getProfile: {
    resolve: () => {
      // Mock user profile
      const user = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        preferences: {
          language: 'en',
          currency: 'USD'
        },
        timestamp: new Date().toISOString()
      };
      
      return {
        success: true,
        user
      };
    },
  }
});

// Main app router
const appRouter = createTRPCRouter({
  example: exampleRouter,
  places: placesRouter,
  user: userRouter,
});

module.exports = { appRouter };
