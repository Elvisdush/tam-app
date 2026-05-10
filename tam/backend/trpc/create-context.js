/**
 * tRPC Context Creation for Backend
 * JavaScript version for Docker compatibility
 */

const createTRPCContext = (req, res) => {
  return {
    req,
    res,
    user: {
      id: 'user-123',
      type: 'free', // free, premium, enterprise
      permissions: ['read']
    },
    session: {
      id: 'session-456',
      createdAt: new Date().toISOString()
    }
  };
};

const createTRPCContextOptions = () => {
  return {
    createContext: createTRPCContext,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  };
};

module.exports = {
  createTRPCContext,
  createTRPCContextOptions
};
