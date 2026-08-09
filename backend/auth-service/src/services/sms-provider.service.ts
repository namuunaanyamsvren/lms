export interface VerificationSms {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export interface SmsProvider {
  sendVerificationSms(message: VerificationSms): Promise<void>;
}

export class SmsDeliveryError extends Error {
  constructor() {
    super('SMS delivery failed');
    this.name = 'SmsDeliveryError';
  }
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

export class DevelopmentSmsProvider implements SmsProvider {
  async sendVerificationSms(_message: VerificationSms): Promise<void> {
    // Intentionally do not print or persist the OTP. Tests can inject a
    // capturing provider instead of weakening the development adapter.
  }
}

export class TwilioSmsProvider implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
    private readonly timeoutMs = positiveInteger('SMS_PROVIDER_TIMEOUT_MS', 5_000),
    private readonly request: typeof fetch = fetch,
  ) {}

  async sendVerificationSms(message: VerificationSms): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body = new URLSearchParams({
        To: message.to,
        From: this.fromNumber,
        Body: `Таны баталгаажуулах код: ${message.code}. ${message.expiresInMinutes} минутын дотор ашиглана уу.`,
      });
      const response = await this.request(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new SmsDeliveryError();
    } catch (error) {
      if (error instanceof SmsDeliveryError) throw error;
      throw new SmsDeliveryError();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const validateSmsEnvironment = (): void => {
  const provider = (process.env.SMS_PROVIDER || (
    process.env.NODE_ENV === 'production' ? '' : 'mock'
  )).toLowerCase();
  positiveInteger('SMS_PROVIDER_TIMEOUT_MS', 5_000);
  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS_PROVIDER=mock is not allowed in production');
    }
    return;
  }
  if (provider !== 'twilio') {
    throw new Error('SMS_PROVIDER must be twilio in production, or mock outside production');
  }
  for (const name of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']) {
    if (!process.env[name]?.trim()) throw new Error(`${name} is required for SMS_PROVIDER=twilio`);
  }
};

export const createSmsProvider = (): SmsProvider => {
  validateSmsEnvironment();
  const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
  if (provider === 'mock') return new DevelopmentSmsProvider();
  return new TwilioSmsProvider(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
    process.env.TWILIO_FROM_NUMBER!,
  );
};

let smsProvider: SmsProvider | undefined;
export const getSmsProvider = (): SmsProvider => {
  smsProvider ||= createSmsProvider();
  return smsProvider;
};

export const setSmsProviderForTests = (provider?: SmsProvider): void => {
  smsProvider = provider;
};
