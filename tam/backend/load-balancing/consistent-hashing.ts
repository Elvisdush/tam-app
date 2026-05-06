/**
 * Consistent Hashing Load Balancer
 * Distributes requests evenly across workers with cache affinity
 */

import { createHash } from 'crypto';

interface WorkerNode {
  id: number;
  pid: number;
  hash: string;
  isActive: boolean;
  lastHealthCheck: number;
}

interface HashRingEntry {
  hash: string;
  worker: WorkerNode;
}

export class ConsistentHashLoadBalancer {
  private workers: Map<number, WorkerNode> = new Map();
  private hashRing: HashRingEntry[] = [];
  private virtualNodes = 150; // Virtual nodes per worker for better distribution
  private currentWorkerIndex = 0;

  constructor(private workerCount: number = 8) {
    this.initializeWorkers();
    this.buildHashRing();
  }

  /**
   * Initialize worker nodes
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      this.workers.set(i, {
        id: i,
        pid: 0, // Will be set when workers are forked
        hash: this.hashWorker(i),
        isActive: true,
        lastHealthCheck: Date.now()
      });
    }
  }

  /**
   * Build consistent hash ring with virtual nodes
   */
  private buildHashRing(): void {
    this.hashRing = [];

    // Create virtual nodes for each worker
    for (const [workerId, worker] of this.workers.entries()) {
      if (!worker.isActive) continue;

      // Create multiple virtual nodes for better distribution
      for (let i = 0; i < this.virtualNodes; i++) {
        const virtualKey = `${worker.id}-${i}`;
        const hash = this.hashString(virtualKey);
        
        this.hashRing.push({
          hash,
          worker
        });
      }
    }

    // Sort hash ring by hash value
    this.hashRing.sort((a, b) => a.hash.localeCompare(b.hash));

    console.log(`🔗 Built hash ring with ${this.hashRing.length} virtual nodes`);
  }

  /**
   * Hash string using MD5
   */
  private hashString(input: string): string {
    return createHash('md5').update(input).digest('hex');
  }

  /**
   * Hash worker identifier
   */
  private hashWorker(workerId: number): string {
    return this.hashString(`worker-${workerId}`);
  }

  /**
   * Get worker for specific key (consistent hashing)
   */
  getWorkerForKey(key: string): WorkerNode | null {
    if (this.hashRing.length === 0) {
      return null;
    }

    const keyHash = this.hashString(key);

    // Find the first virtual node with hash >= key hash
    for (const entry of this.hashRing) {
      if (entry.hash >= keyHash) {
        return entry.worker;
      }
    }

    // Wrap around to the first node
    return this.hashRing[0].worker;
  }

  /**
   * Get worker for request (using request fingerprint)
   */
  getWorkerForRequest(
    method: string,
    url: string,
    userId?: string,
    ip?: string
  ): WorkerNode | null {
    // Create request fingerprint for consistent hashing
    const fingerprint = this.createRequestFingerprint(method, url, userId, ip);
    
    return this.getWorkerForKey(fingerprint);
  }

  /**
   * Create request fingerprint for consistent routing
   */
  private createRequestFingerprint(
    method: string,
    url: string,
    userId?: string,
    ip?: string
  ): string {
    // Priority order: userId > ip > url > method
    if (userId) {
      return `user:${userId}`;
    }
    
    if (ip) {
      return `ip:${ip}`;
    }
    
    // For unauthenticated requests, use URL path for consistency
    const urlPath = new URL(url, 'http://localhost').pathname;
    return `path:${method}:${urlPath}`;
  }

  /**
   * Get multiple workers for key (for replication)
   */
  getWorkersForKey(key: string, count: number = 2): WorkerNode[] {
    const workers: WorkerNode[] = [];
    const seenWorkers = new Set<number>();

    for (const entry of this.hashRing) {
      if (workers.length >= count) break;
      
      if (!seenWorkers.has(entry.worker.id)) {
        workers.push(entry.worker);
        seenWorkers.add(entry.worker.id);
      }
    }

    return workers;
  }

  /**
   * Update worker health status
   */
  updateWorkerHealth(workerId: number, isActive: boolean): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.isActive = isActive;
      worker.lastHealthCheck = Date.now();
      
      // Rebuild hash ring if worker status changed
      this.buildHashRing();
      
      console.log(`🏥 Worker ${workerId} status updated: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
    }
  }

  /**
   * Add new worker to the ring
   */
  addWorker(workerId: number, pid: number): void {
    const worker: WorkerNode = {
      id: workerId,
      pid,
      hash: this.hashWorker(workerId),
      isActive: true,
      lastHealthCheck: Date.now()
    };

    this.workers.set(workerId, worker);
    this.buildHashRing();
    
    console.log(`➕ Added worker ${workerId} (PID: ${pid}) to hash ring`);
  }

  /**
   * Remove worker from the ring
   */
  removeWorker(workerId: number): void {
    this.workers.delete(workerId);
    this.buildHashRing();
    
    console.log(`➖ Removed worker ${workerId} from hash ring`);
  }

  /**
   * Get load distribution statistics
   */
  getLoadDistribution(): Map<number, number> {
    const distribution = new Map<number, number>();
    
    // Count virtual nodes per worker
    for (const entry of this.hashRing) {
      const count = distribution.get(entry.worker.id) || 0;
      distribution.set(entry.worker.id, count + 1);
    }

    return distribution;
  }

  /**
   * Get cache hit ratio for worker
   */
  getCacheHitRatio(workerId: number): number {
    // This would need to be tracked in actual implementation
    return 0.85; // Placeholder
  }

  /**
   * Get optimal worker for cache-heavy operations
   */
  getOptimalWorker(
    method: string,
    url: string,
    userId?: string,
    ip?: string,
    preferCached: boolean = true
  ): WorkerNode | null {
    if (preferCached) {
      // Use consistent hashing for cache affinity
      return this.getWorkerForRequest(method, url, userId, ip);
    } else {
      // Use round-robin for non-cached operations
      return this.getRoundRobinWorker();
    }
  }

  /**
   * Round-robin worker selection (fallback)
   */
  private getRoundRobinWorker(): WorkerNode | null {
    const activeWorkers = Array.from(this.workers.values())
      .filter(worker => worker.isActive);

    if (activeWorkers.length === 0) {
      return null;
    }

    const worker = activeWorkers[this.currentWorkerIndex % activeWorkers.length];
    this.currentWorkerIndex++;
    
    return worker;
  }

  /**
   * Get hash ring statistics
   */
  getHashRingStats(): {
    totalVirtualNodes: number;
    activeWorkers: number;
    loadDistribution: Map<number, number>;
    balanceScore: number;
  } {
    const distribution = this.getLoadDistribution();
    const activeWorkers = Array.from(this.workers.values()).filter(w => w.isActive).length;
    
    // Calculate balance score (0 = perfect balance, 1 = worst balance)
    const loads = Array.from(distribution.values());
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const balanceScore = variance / (avgLoad * avgLoad);

    return {
      totalVirtualNodes: this.hashRing.length,
      activeWorkers,
      loadDistribution: distribution,
      balanceScore
    };
  }

  /**
   * Simulate key redistribution when worker fails
   */
  simulateWorkerFailure(workerId: number): {
    affectedKeys: number;
    redistributedKeys: number;
    newDistribution: Map<number, number>;
  } {
    const beforeDistribution = this.getLoadDistribution();
    
    // Remove worker
    this.updateWorkerHealth(workerId, false);
    
    const afterDistribution = this.getLoadDistribution();
    
    // Calculate affected keys (simplified)
    const virtualNodesPerWorker = this.virtualNodes;
    const affectedKeys = virtualNodesPerWorker;
    
    return {
      affectedKeys,
      redistributedKeys: affectedKeys,
      newDistribution: afterDistribution
    };
  }
}

// Factory function for creating load balancer
export function createConsistentHashLoadBalancer(workerCount: number = 8) {
  return new ConsistentHashLoadBalancer(workerCount);
}

// Utility functions for cache key generation
export const CacheKeyUtils = {
  /**
   * Generate cache key for user data
   */
  userCacheKey(userId: string, dataType: string): string {
    return `user:${userId}:${dataType}`;
  },

  /**
   * Generate cache key for location data
   */
  locationCacheKey(lat: number, lng: number, radius: number): string {
    // Round coordinates for better cache hits
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    return `location:${roundedLat}:${roundedLng}:${radius}`;
  },

  /**
   * Generate cache key for search results
   */
  searchCacheKey(query: string, filters: Record<string, any> = {}): string {
    const filterString = JSON.stringify(filters);
    const combined = `${query}:${filterString}`;
    return `search:${createHash('md5').update(combined).digest('hex')}`;
  },

  /**
   * Generate cache key for place data
   */
  placeCacheKey(placeId: string, dataType: string = 'details'): string {
    return `place:${placeId}:${dataType}`;
  }
};
