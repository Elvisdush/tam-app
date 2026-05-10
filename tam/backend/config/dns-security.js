/**
 * DNS Security Configuration for Backend
 * JavaScript version for Docker compatibility
 */

const dnsSecurity = {
  development: {
    domain: 'localhost',
    subdomains: ['api', 'app', 'admin'],
    security: {
      dnssec: true,
      dmarc: true,
      spf: true,
      dkim: true
    },
    ssl: {
      enabled: false,
      certificate: '',
      key: ''
    }
  },
  production: {
    domain: 'yourdomain.com',
    subdomains: ['api', 'app', 'admin'],
    security: {
      dnssec: true,
      dmarc: true,
      spf: true,
      dkim: true
    },
    ssl: {
      enabled: true,
      certificate: '/path/to/certificate.crt',
      key: '/path/to/private.key'
    }
  }
};

const createDNSManager = (environment = 'development') => {
  const config = dnsSecurity[environment] || dnsSecurity.development;
  
  return {
    getDomain: () => config.domain,
    getSubdomains: () => config.subdomains,
    getSecurityConfig: () => config.security,
    getSSLConfig: () => config.ssl,
    getSecurityScore: () => {
      let score = 0;
      if (config.security.dnssec) score += 25;
      if (config.security.dmarc) score += 25;
      if (config.security.spf) score += 25;
      if (config.security.dkim) score += 25;
      return score;
    },
    getSecurityRecommendations: () => {
      const recommendations = [];
      if (!config.security.dnssec) recommendations.push('Enable DNSSEC');
      if (!config.security.dmarc) recommendations.push('Configure DMARC');
      if (!config.security.spf) recommendations.push('Set up SPF records');
      if (!config.security.dkim) recommendations.push('Implement DKIM');
      return recommendations;
    }
  };
};

module.exports = {
  dnsSecurity,
  createDNSManager
};
