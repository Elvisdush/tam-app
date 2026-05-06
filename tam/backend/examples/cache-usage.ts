/**
 * Cache Integration Examples
 * Shows how to use caching in different parts of the application
 */

import { createCache, CACHE_CONFIGS, invalidateCache } from '../middleware/cache';
import { DatabaseCache, cached, userCache, locationCache } from '../cache/database-cache';
import { Hono } from 'hono';

const app = new Hono();

// Example 1: API Response Caching
app.get('/api/places/nearby', 
  createCache(CACHE_CONFIGS.places),
  async (c) => {
    const { lat, lng, radius = 1000 } = c.req.query();
    
    // This response will be cached for 15 minutes
    const places = await getNearbyPlaces(parseFloat(lat), parseFloat(lng), parseInt(radius));
    
    return c.json({
      success: true,
      data: places,
      cached: false
    });
  }
);

// Example 2: Database Query Caching with Decorator
class PlaceService {
  @cached(locationCache, 120) // Cache for 2 minutes
  async getNearbyPlaces(lat: number, lng: number, radius: number) {
    // Database query will be cached
    const query = `
      SELECT * FROM places 
      WHERE ST_DWithin(location, ST_MakePoint($1, $2)) < $3
      ORDER BY distance
      LIMIT 20
    `;
    
    return await db.query(query, [lat, lng, radius]);
  }

  @cached(userCache, 900) // Cache for 15 minutes
  async getUserProfile(userId: string) {
    // User profile will be cached
    return await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  }
}

// Example 3: Manual Cache Management
app.post('/api/places/:id/review', async (c) => {
  const placeId = c.req.param('id');
  const { rating, comment } = await c.req.json();
  
  // Save review to database
  await saveReview(placeId, rating, comment);
  
  // Invalidate related caches
  await Promise.all([
    invalidateCache(`places:*${placeId}*`), // API cache
    locationCache.invalidate(`place:${placeId}`), // Database cache
    userCache.invalidate(`reviews:${c.get('userId')}`) // User cache
  ]);
  
  return c.json({ success: true });
});

// Example 4: Cache Statistics Endpoint
app.get('/api/cache/stats', async (c) => {
  const [apiStats, dbStats] = await Promise.all([
    getCacheStats(), // From cache middleware
    locationCache.getStats() // From database cache
  ]);
  
  return c.json({
    api: apiStats,
    database: dbStats,
    timestamp: new Date().toISOString()
  });
});

// Example 5: Cache Invalidation Webhook
app.post('/api/cache/invalidate', async (c) => {
  const { patterns } = await c.req.json();
  
  if (!Array.isArray(patterns)) {
    return c.json({ error: 'Invalid patterns' }, 400);
  }
  
  const results = await Promise.all(
    patterns.map(pattern => invalidateCache(pattern))
  );
  
  return c.json({
    success: true,
    invalidated: results.reduce((sum, count) => sum + count, 0)
  });
});

// Example 6: Conditional Caching
app.get('/api/user/profile',
  createCache({
    ttl: 600, // 10 minutes
    keyGenerator: (c) => `profile:${c.get('userId')}`,
    skipCache: (c) => !c.get('userId') // Skip for unauthenticated users
  }),
  async (c) => {
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const profile = await getUserProfile(userId);
    
    return c.json({
      success: true,
      data: profile
    });
  }
);

// Example 7: Search with Intelligent Caching
app.get('/api/search',
  createCache({
    ttl: 300, // 5 minutes
    keyGenerator: (c) => {
      const { q, type, location, page = 1 } = c.req.query();
      return `search:${q}:${type}:${location}:${page}`;
    },
    skipCache: (c) => {
      const { q } = c.req.query();
      // Don't cache empty searches
      return !q || q.trim().length < 2;
    }
  }),
  async (c) => {
    const { q, type, location, page = 1 } = c.req.query();
    
    const results = await performSearch(q, type, location, parseInt(page));
    
    return c.json({
      success: true,
      data: results,
      query: { q, type, location, page },
      cached: false
    });
  }
);

// Helper functions
async function getNearbyPlaces(lat: number, lng: number, radius: number) {
  const placeService = new PlaceService();
  return await placeService.getNearbyPlaces(lat, lng, radius);
}

async function getUserProfile(userId: string) {
  const placeService = new PlaceService();
  return await placeService.getUserProfile(userId);
}

async function saveReview(placeId: string, rating: number, comment: string) {
  // Database implementation
  console.log(`Saving review for place ${placeId}: ${rating} stars`);
}

async function performSearch(query: string, type?: string, location?: string, page: number = 1) {
  // Search implementation
  console.log(`Searching for: ${query} (type: ${type}, location: ${location}, page: ${page})`);
  return [];
}

export default app;
