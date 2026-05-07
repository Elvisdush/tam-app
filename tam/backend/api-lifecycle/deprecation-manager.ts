/**
 * API Deprecation Management System
 * Handles API deprecation, sunset, and client notifications
 */

import { EventEmitter } from 'events';

export interface DeprecationSchedule {
  version: string;
  deprecationDate: Date;
  sunsetDate: Date;
  retirementDate: Date;
  migrationGuide?: string;
  affectedEndpoints: string[];
  alternativeEndpoints: Record<string, string>;
  notificationSchedule: NotificationSchedule[];
}

export interface NotificationSchedule {
  type: 'warning' | 'critical' | 'final';
  date: Date;
  channels: ('email' | 'in_app' | 'webhook' | 'banner')[];
  message: string;
  template: string;
}

export interface ClientInfo {
  clientId: string;
  name: string;
  contactEmail: string;
  versions: string[];
  lastSeen: Date;
  notificationsSent: string[];
}

export class APIDeprecationManager extends EventEmitter {
  private schedules: Map<string, DeprecationSchedule> = new Map();
  private clients: Map<string, ClientInfo> = new Map();
  private notificationHistory: Map<string, any[]> = new Map();
  private isMonitoring = false;

  constructor() {
    super();
    this.initializeSchedules();
    this.startMonitoring();
  }

  private initializeSchedules(): void {
    // Example: Deprecate v1 in favor of v2
    const v1Schedule: DeprecationSchedule = {
      version: 'v1',
      deprecationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      retirementDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days from now
      migrationGuide: '/docs/migration/v1-to-v2',
      affectedEndpoints: [
        '/api/v1/places/search',
        '/api/v1/users/profile',
        '/api/v1/locations/nearby'
      ],
      alternativeEndpoints: {
        '/api/v1/places/search': '/api/v2/places/search',
        '/api/v1/users/profile': '/api/v2/users/profile',
        '/api/v1/locations/nearby': '/api/v2/locations/nearby'
      },
      notificationSchedule: [
        {
          type: 'warning',
          date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days before deprecation
          channels: ['email', 'in_app'],
          message: 'API v1 will be deprecated soon',
          template: 'deprecation-warning'
        },
        {
          type: 'critical',
          date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days before deprecation
          channels: ['email', 'banner', 'webhook'],
          message: 'API v1 deprecation is imminent',
          template: 'deprecation-critical'
        },
        {
          type: 'final',
          date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day before deprecation
          channels: ['email', 'banner', 'webhook'],
          message: 'API v1 will be deprecated tomorrow',
          template: 'deprecation-final'
        }
      ]
    };

    this.schedules.set('v1', v1Schedule);
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Check for scheduled notifications every hour
    setInterval(() => {
      this.checkAndSendNotifications();
    }, 60 * 60 * 1000);

    console.log('📡 Deprecation monitoring started');
  }

  private async checkAndSendNotifications(): Promise<void> {
    const now = new Date();

    for (const [version, schedule] of this.schedules.entries()) {
      for (const notification of schedule.notificationSchedule) {
        if (notification.date <= now && !this.hasNotificationBeenSent(version, notification.type)) {
          await this.sendNotification(version, notification);
        }
      }
    }
  }

  private hasNotificationBeenSent(version: string, notificationType: string): boolean {
    const history = this.notificationHistory.get(version) || [];
    return history.some(n => n.type === notificationType);
  }

  private async sendNotification(version: string, notification: NotificationSchedule): Promise<void> {
    console.log(`📢 Sending ${notification.type} notification for API ${version}`);

    const affectedClients = this.getAffectedClients(version);
    
    for (const client of affectedClients) {
      for (const channel of notification.channels) {
        try {
          await this.sendNotificationToClient(client, version, notification, channel);
          this.recordNotification(version, notification.type, client.clientId);
        } catch (error) {
          console.error(`❌ Failed to send ${channel} notification to ${client.name}:`, error);
        }
      }
    }

    this.emit('notification_sent', {
      version,
      type: notification.type,
      clientsAffected: affectedClients.length,
      channels: notification.channels
    });
  }

  private async sendNotificationToClient(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    channel: string
  ): Promise<void> {
    const schedule = this.schedules.get(version)!;
    
    switch (channel) {
      case 'email':
        await this.sendEmailNotification(client, version, notification, schedule);
        break;
      case 'in_app':
        await this.sendInAppNotification(client, version, notification, schedule);
        break;
      case 'webhook':
        await this.sendWebhookNotification(client, version, notification, schedule);
        break;
      case 'banner':
        await this.sendBannerNotification(client, version, notification, schedule);
        break;
    }
  }

  private async sendEmailNotification(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): Promise<void> {
    console.log(`📧 Sending email to ${client.contactEmail}`);
    
    const emailContent = this.generateEmailContent(client, version, notification, schedule);
    
    // Email sending implementation
    // This would integrate with your email service
    console.log(`📧 Email content: ${emailContent.subject}`);
  }

  private async sendInAppNotification(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): Promise<void> {
    console.log(`📱 Sending in-app notification to ${client.name}`);
    
    const notificationContent = this.generateInAppContent(client, version, notification, schedule);
    
    // In-app notification implementation
    console.log(`📱 In-app notification: ${notificationContent.title}`);
  }

  private async sendWebhookNotification(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): Promise<void> {
    console.log(`🪝 Sending webhook to ${client.name}`);
    
    const webhookPayload = this.generateWebhookPayload(client, version, notification, schedule);
    
    // Webhook implementation
    console.log(`🪝 Webhook payload: ${JSON.stringify(webhookPayload, null, 2)}`);
  }

  private async sendBannerNotification(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): Promise<void> {
    console.log(`🎨 Displaying banner for ${client.name}`);
    
    const bannerContent = this.generateBannerContent(client, version, notification, schedule);
    
    // Banner implementation
    console.log(`🎨 Banner: ${bannerContent.message}`);
  }

  private generateEmailContent(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): { subject: string; body: string } {
    const subject = `API ${version} ${notification.type === 'critical' ? 'URGENT: ' : ''}Deprecation Notice`;
    
    const body = `
Dear ${client.name},

This is a ${notification.type} notification regarding API ${version}.

${notification.message}

Important dates:
- Deprecation: ${schedule.deprecationDate.toDateString()}
- Sunset: ${schedule.sunsetDate.toDateString()}
- Retirement: ${schedule.retirementDate.toDateString()}

Migration guide: ${schedule.migrationGuide}

Affected endpoints:
${schedule.affectedEndpoints.map(endpoint => `- ${endpoint} → ${schedule.alternativeEndpoints[endpoint]}`).join('\n')}

Please update your integration as soon as possible.

Best regards,
TAM App API Team
    `.trim();

    return { subject, body };
  }

  private generateInAppContent(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): { title: string; message: string; action: string } {
    return {
      title: `API ${version} ${notification.type === 'critical' ? 'URGENT' : 'Deprecation'}`,
      message: notification.message,
      action: 'View Migration Guide'
    };
  }

  private generateWebhookPayload(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): any {
    return {
      event: 'api_deprecation',
      version,
      type: notification.type,
      client: {
        id: client.clientId,
        name: client.name
      },
      schedule: {
        deprecationDate: schedule.deprecationDate,
        sunsetDate: schedule.sunsetDate,
        retirementDate: schedule.retirementDate
      },
      affectedEndpoints: schedule.affectedEndpoints,
      alternatives: schedule.alternativeEndpoints,
      migrationGuide: schedule.migrationGuide,
      timestamp: new Date().toISOString()
    };
  }

  private generateBannerContent(
    client: ClientInfo,
    version: string,
    notification: NotificationSchedule,
    schedule: DeprecationSchedule
  ): { type: string; message: string; action: string } {
    return {
      type: notification.type === 'critical' ? 'error' : 'warning',
      message: notification.message,
      action: 'Learn More'
    };
  }

  private getAffectedClients(version: string): ClientInfo[] {
    return Array.from(this.clients.values())
      .filter(client => client.versions.includes(version));
  }

  private recordNotification(version: string, notificationType: string, clientId: string): void {
    if (!this.notificationHistory.has(version)) {
      this.notificationHistory.set(version, []);
    }

    this.notificationHistory.get(version)!.push({
      type: notificationType,
      clientId,
      timestamp: new Date()
    });
  }

  registerClient(client: ClientInfo): void {
    this.clients.set(client.clientId, client);
    console.log(`👤 Registered client: ${client.name} (${client.versions.join(', ')})`);
  }

  updateClientUsage(clientId: string, versions: string[]): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.versions = versions;
      client.lastSeen = new Date();
      console.log(`📊 Updated usage for ${client.name}: ${versions.join(', ')}`);
    }
  }

  getDeprecationStatus(version: string): DeprecationSchedule | undefined {
    return this.schedules.get(version);
  }

  getAllSchedules(): DeprecationSchedule[] {
    return Array.from(this.schedules.values());
  }

  getClientStatus(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  getNotificationHistory(version?: string): Record<string, any[]> {
    if (version) {
      return { [version]: this.notificationHistory.get(version) || [] };
    }
    
    const history: Record<string, any[]> = {};
    for (const [version, notifications] of this.notificationHistory.entries()) {
      history[version] = notifications;
    }
    
    return history;
  }

  async forceNotification(version: string, notificationType: string): Promise<void> {
    const schedule = this.schedules.get(version);
    if (!schedule) {
      throw new Error(`No deprecation schedule found for version ${version}`);
    }

    const notification = schedule.notificationSchedule.find(n => n.type === notificationType);
    if (!notification) {
      throw new Error(`No ${notificationType} notification found for version ${version}`);
    }

    await this.sendNotification(version, notification);
  }
}

export const deprecationManager = new APIDeprecationManager();
