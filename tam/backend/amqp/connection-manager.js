/**
 * AMQP Connection Manager for TAM App
 * Handles connection lifecycle, reconnection, and channel management
 */

const amqp = require('amqplib');
const { EventEmitter } = require('events');

class AMQPConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      hostname: config.hostname || 'localhost',
      port: config.port || 5672,
      username: config.username || 'guest',
      password: config.password || 'guest',
      vhost: config.vhost || '/',
      heartbeat: config.heartbeat || 60,
      reconnect: config.reconnect !== false,
      reconnectBackoffStrategy: config.reconnectBackoffStrategy || 'linear',
      reconnectBackoffTime: config.reconnectBackoffTime || 1000,
      ...config
    };
    
    this.connection = null;
    this.channels = new Map();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
  }

  async connect() {
    if (this.isConnecting || this.connection) {
      return;
    }

    this.isConnecting = true;
    
    try {
      this.connection = await amqp.connect({
        protocol: 'amqp',
        hostname: this.config.hostname,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        vhost: this.config.vhost,
        heartbeat: this.config.heartbeat
      });

      console.log('✅ AMQP connection established');
      this.emit('connected', this.connection);
      this.reconnectAttempts = 0;
      
      // Set up connection error handling
      this.connection.on('error', (error) => {
        console.error('❌ AMQP connection error:', error);
        this.emit('error', error);
        
        if (this.config.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.connection.on('close', () => {
        console.warn('⚠️ AMQP connection closed');
        this.emit('disconnected');
        
        if (this.config.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.connection.on('blocked', (reason) => {
        console.warn('🚫 AMQP connection blocked:', reason);
        this.emit('blocked', reason);
      });

      this.connection.on('unblocked', () => {
        console.log('🔓 AMQP connection unblocked');
        this.emit('unblocked');
      });

    } catch (error) {
      console.error('❌ Failed to connect to AMQP:', error);
      this.emit('error', error);
      this.isConnecting = false;
      
      if (this.config.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    } finally {
      this.isConnecting = false;
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.config.reconnectBackoffTime * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  async createChannel(name, options = {}) {
    if (!this.connection) {
      throw new Error('AMQP connection not established');
    }

    try {
      const channel = await this.connection.createChannel();
      await channel.assertQueue(name, {
        durable: options.durable || false,
        exclusive: options.exclusive || false,
        autoDelete: options.autoDelete || false,
        arguments: options.arguments || []
      });

      this.channels.set(name, channel);
      console.log(`✅ Created AMQP channel: ${name}`);
      this.emit('channelCreated', { name, channel });
      
      return channel;
    } catch (error) {
      console.error(`❌ Failed to create channel ${name}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async createExchange(name, type = 'direct', options = {}) {
    if (!this.connection) {
      throw new Error('AMQP connection not established');
    }

    try {
      const channel = await this.connection.createChannel();
      await channel.assertExchange(name, type, {
        durable: options.durable || false,
        autoDelete: options.autoDelete || false,
        arguments: options.arguments || []
      });

      console.log(`✅ Created AMQP exchange: ${name} (${type})`);
      this.emit('exchangeCreated', { name, type, channel });
      
      return channel;
    } catch (error) {
      console.error(`❌ Failed to create exchange ${name}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  getChannel(name) {
    return this.channels.get(name);
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      console.log('✅ AMQP connection closed');
      this.emit('disconnected');
    }
    
    // Close all channels
    for (const [name, channel] of this.channels) {
      await channel.close();
    }
    this.channels.clear();
  }

  getConnectionInfo() {
    return {
      isConnected: this.connection !== null,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      channelsCount: this.channels.size,
      config: this.config
    };
  }
}

module.exports = AMQPConnectionManager;
