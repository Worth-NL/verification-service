// Minimal ambient types for the (untyped) GOV.UK Notify Node client.
// Only the surface this service uses is declared.
declare module "notifications-node-client" {
  interface NotificationOptions {
    personalisation?: Record<string, unknown>;
    reference?: string;
    [key: string]: unknown;
  }

  export class NotifyClient {
    constructor(baseUrl?: string, apiKeyId?: string);
    sendEmail(
      templateId: string,
      emailAddress: string,
      options?: NotificationOptions
    ): Promise<unknown>;
    sendSms(
      templateId: string,
      phoneNumber: string,
      options?: NotificationOptions
    ): Promise<unknown>;
  }
}
