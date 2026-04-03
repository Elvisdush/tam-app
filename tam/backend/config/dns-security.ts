/**
 * DNS Security Configuration
 * Comprehensive DNS security settings for the taxi app
 */

export interface DNSSecurityConfig {
  domain: string;
  subdomains: Record<string, string>;
  securityRecords: DNSRecord[];
  sslCertificates: SSLConfig[];
  cdnConfiguration: CDNConfig;
  monitoring: DNSMonitoringConfig;
}

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'CAA' | 'NS';
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  description: string;
}

export interface SSLConfig {
  domain: string;
  certificateType: 'letsencrypt' | 'cloudflare' | 'custom';
  autoRenew: boolean;
  securityLevel: 'basic' | 'advanced' | 'enterprise';
}

export interface CDNConfig {
  provider: 'cloudflare' | 'aws-cloudfront' | 'fastly' | 'akamai';
  securityFeatures: string[];
  cachingRules: CachingRule[];
}

export interface CachingRule {
  pattern: string;
  ttl: number;
  securityHeaders: boolean;
  compression: boolean;
}

export interface DNSMonitoringConfig {
  enabled: boolean;
  alertThresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    certificateExpiry: number; // days
  };
  healthChecks: string[];
}

// Production DNS Security Configuration
export const PRODUCTION_DNS_CONFIG: DNSSecurityConfig = {
  domain: 'your-taxi-app.com',
  subdomains: {
    api: 'api.your-taxi-app.com',
    cdn: 'cdn.your-taxi-app.com',
    auth: 'auth.your-taxi-app.com',
    admin: 'admin.your-taxi-app.com',
    blog: 'blog.your-taxi-app.com',
    support: 'support.your-taxi-app.com',
    monitoring: 'monitoring.your-taxi-app.com',
  },
  
  securityRecords: [
    // A Records - Main Application
    {
      type: 'A',
      name: '@',
      value: '192.168.1.100',
      ttl: 300,
      description: 'Main application server'
    },
    {
      type: 'A',
      name: 'api',
      value: '192.168.1.101',
      ttl: 300,
      description: 'API server'
    },
    
    // AAAA Records - IPv6 Support
    {
      type: 'AAAA',
      name: '@',
      value: '2606:4700:4700::1111',
      ttl: 300,
      description: 'IPv6 main server'
    },
    
    // CNAME Records - Service Aliases
    {
      type: 'CNAME',
      name: 'cdn',
      value: 'your-app.cdn.cloudflare.net',
      ttl: 300,
      description: 'CDN endpoint'
    },
    {
      type: 'CNAME',
      name: 'auth',
      value: 'auth.your-taxi-app.com.herokudns.com',
      ttl: 300,
      description: 'Authentication service'
    },
    
    // MX Records - Email Configuration
    {
      type: 'MX',
      name: '@',
      value: 'mail.your-taxi-app.com',
      ttl: 3600,
      priority: 10,
      description: 'Primary mail server'
    },
    {
      type: 'MX',
      name: '@',
      value: 'backup.your-taxi-app.com',
      ttl: 3600,
      priority: 20,
      description: 'Backup mail server'
    },
    
    // TXT Records - Security & Verification
    {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:_spf.google.com include:sendgrid.net ~all',
      ttl: 3600,
      description: 'SPF record for email security'
    },
    {
      type: 'TXT',
      name: '@',
      value: 'google-site-verification=your-verification-code',
      ttl: 3600,
      description: 'Google Search Console verification'
    },
    {
      type: 'TXT',
      name: '_dmarc',
      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@your-taxi-app.com; ruf=mailto:dmarc@your-taxi-app.com',
      ttl: 3600,
      description: 'DMARC policy for email authentication'
    },
    {
      type: 'TXT',
      name: 'dkim._domainkey',
      value: 'v=DKIM1; k=rsa; p=your-public-key',
      ttl: 3600,
      description: 'DKIM for email signing'
    },
    
    // CAA Records - Certificate Authority Restrictions
    {
      type: 'CAA',
      name: '@',
      value: '0 issue "letsencrypt.org"',
      ttl: 3600,
      description: 'Restrict certificates to Let\'s Encrypt'
    },
    {
      type: 'CAA',
      name: '@',
      value: '0 issuewild "letsencrypt.org"',
      ttl: 3600,
      description: 'Restrict wildcard certificates to Let\'s Encrypt'
    },
    
    // NS Records - Name Servers
    {
      type: 'NS',
      name: '@',
      value: 'ns1.cloudflare.com',
      ttl: 86400,
      description: 'Primary name server'
    },
    {
      type: 'NS',
      name: '@',
      value: 'ns2.cloudflare.com',
      ttl: 86400,
      description: 'Secondary name server'
    },
  ],
  
  sslCertificates: [
    {
      domain: 'your-taxi-app.com',
      certificateType: 'letsencrypt',
      autoRenew: true,
      securityLevel: 'advanced'
    },
    {
      domain: 'api.your-taxi-app.com',
      certificateType: 'letsencrypt',
      autoRenew: true,
      securityLevel: 'advanced'
    },
    {
      domain: '*.your-taxi-app.com',
      certificateType: 'letsencrypt',
      autoRenew: true,
      securityLevel: 'enterprise'
    }
  ],
  
  cdnConfiguration: {
    provider: 'cloudflare',
    securityFeatures: [
      'DDoS Protection',
      'WAF (Web Application Firewall)',
      'SSL/TLS Encryption',
      'Bot Management',
      'Rate Limiting',
      'Cache Lock',
      'Argo Smart Routing',
      'Image Optimization'
    ],
    cachingRules: [
      {
        pattern: '/api/*',
        ttl: 300,
        securityHeaders: true,
        compression: true
      },
      {
        pattern: '/static/*',
        ttl: 86400,
        securityHeaders: true,
        compression: true
      },
      {
        pattern: '/images/*',
        ttl: 604800,
        securityHeaders: true,
        compression: true
      }
    ]
  },
  
  monitoring: {
    enabled: true,
    alertThresholds: {
      responseTime: 500,
      errorRate: 1,
      certificateExpiry: 30
    },
    healthChecks: [
      'https://your-taxi-app.com/health',
      'https://api.your-taxi-app.com/health',
      'https://auth.your-taxi-app.com/health'
    ]
  }
};

// Development DNS Configuration
export const DEVELOPMENT_DNS_CONFIG: DNSSecurityConfig = {
  ...PRODUCTION_DNS_CONFIG,
  domain: 'dev.your-taxi-app.com',
  subdomains: {
    api: 'api.dev.your-taxi-app.com',
    cdn: 'cdn.dev.your-taxi-app.com',
  },
  securityRecords: PRODUCTION_DNS_CONFIG.securityRecords.map(record => ({
    ...record,
    name: record.name === '@' ? 'dev' : `${record.name}.dev`,
    ttl: record.ttl / 2 // Lower TTL for development
  }))
};

// DNS Security Functions
export class DNSSecurityManager {
  private config: DNSSecurityConfig;

  constructor(config: DNSSecurityConfig) {
    this.config = config;
  }

  // Generate DNS records for deployment
  generateDNSRecords(): DNSRecord[] {
    return this.config.securityRecords;
  }

  // Validate SSL certificate configuration
  validateSSLConfig(): boolean {
    return this.config.sslCertificates.every(cert => 
      cert.domain && cert.certificateType && cert.autoRenew
    );
  }

  // Get security recommendations
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check for essential security records
    const hasSPF = this.config.securityRecords.some(r => 
      r.type === 'TXT' && r.value.includes('v=spf1')
    );
    const hasDMARC = this.config.securityRecords.some(r => 
      r.type === 'TXT' && r.value.includes('v=DMARC1')
    );
    const hasCAA = this.config.securityRecords.some(r => r.type === 'CAA');
    
    if (!hasSPF) recommendations.push('Add SPF record to prevent email spoofing');
    if (!hasDMARC) recommendations.push('Add DMARC policy for email authentication');
    if (!hasCAA) recommendations.push('Add CAA records to restrict certificate authorities');
    
    // Check SSL configuration
    if (!this.validateSSLConfig()) {
      recommendations.push('Fix SSL certificate configuration');
    }
    
    // Check monitoring
    if (!this.config.monitoring.enabled) {
      recommendations.push('Enable DNS monitoring and health checks');
    }
    
    return recommendations;
  }

  // Generate deployment checklist
  generateDeploymentChecklist(): string[] {
    return [
      'Configure A/AAAA records for main domain',
      'Set up subdomain CNAME records',
      'Configure MX records for email',
      'Add SPF, DKIM, and DMARC TXT records',
      'Set up CAA records for certificate restrictions',
      'Configure SSL certificates with auto-renewal',
      'Set up CDN with security features',
      'Enable DNS monitoring and alerts',
      'Test all subdomains and services',
      'Verify SSL certificate validity',
      'Test email delivery and SPF/DKIM/DMARC',
      'Set up failover and load balancing'
    ];
  }

  // Get security score
  getSecurityScore(): number {
    let score = 0;
    const maxScore = 100;
    
    // DNS Records (30 points)
    const essentialRecords = ['SPF', 'DMARC', 'CAA'];
    const hasEssentialRecords = essentialRecords.every(recordType => 
      this.config.securityRecords.some(r => 
        r.type === 'TXT' && r.value.toLowerCase().includes(recordType.toLowerCase())
      )
    );
    if (hasEssentialRecords) score += 30;
    
    // SSL Configuration (25 points)
    if (this.validateSSLConfig()) score += 25;
    
    // CDN Security (20 points)
    if (this.config.cdnConfiguration.securityFeatures.length > 5) score += 20;
    
    // Monitoring (15 points)
    if (this.config.monitoring.enabled) score += 15;
    
    // Subdomain Security (10 points)
    if (Object.keys(this.config.subdomains).length > 3) score += 10;
    
    return Math.min(score, maxScore);
  }
}

// DNS Security Monitoring
export class DNSSecurityMonitor {
  private config: DNSMonitoringConfig;

  constructor(config: DNSMonitoringConfig) {
    this.config = config;
  }

  async checkDNSHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: Record<string, any>;
  }> {
    const issues: string[] = [];
    const metrics: Record<string, any> = {};

    // Check response times
    for (const healthCheck of this.config.healthChecks) {
      try {
        const start = Date.now();
        const response = await fetch(healthCheck);
        const responseTime = Date.now() - start;
        
        metrics[healthCheck] = {
          responseTime,
          status: response.status,
          healthy: response.ok
        };

        if (responseTime > this.config.alertThresholds.responseTime) {
          issues.push(`Slow response time for ${healthCheck}: ${responseTime}ms`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        issues.push(`Health check failed for ${healthCheck}: ${errorMessage}`);
        metrics[healthCheck] = { error: errorMessage };
      }
    }

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 3 ? 'critical' : 'warning';
    }

    return { status, issues, metrics };
  }

  async checkCertificateExpiry(): Promise<{
    status: 'valid' | 'expiring' | 'expired';
    daysUntilExpiry: number;
    domain: string;
  }> {
    // This would typically use a library like node-forge or ssl-checker
    // For now, return mock data
    return {
      status: 'valid',
      daysUntilExpiry: 89,
      domain: 'your-taxi-app.com'
    };
  }
}

// Export utility functions
export function createDNSConfig(environment: 'production' | 'development'): DNSSecurityConfig {
  return environment === 'production' ? PRODUCTION_DNS_CONFIG : DEVELOPMENT_DNS_CONFIG;
}

export function createDNSManager(environment: 'production' | 'development'): DNSSecurityManager {
  const config = createDNSConfig(environment);
  return new DNSSecurityManager(config);
}

export function createDNSMonitor(config: DNSMonitoringConfig): DNSSecurityMonitor {
  return new DNSSecurityMonitor(config);
}
