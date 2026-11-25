/**
 * Waitlist confirmation / double-opt-in email.
 * TODO: wire a provider when WAITLIST_EMAIL_ENABLED=true (T5.15 follow-up).
 */
export type WaitlistEmailPayload = {
  readonly email: string;
  readonly name?: string | undefined;
};

export type WaitlistEmailSender = {
  sendSignupAck: (payload: WaitlistEmailPayload) => Promise<void>;
};

export const noopWaitlistEmailSender: WaitlistEmailSender = {
  async sendSignupAck(): Promise<void> {
    // Intentionally empty when WAITLIST_EMAIL_ENABLED=false.
  },
};

export function createWaitlistEmailSender(enabled: boolean): WaitlistEmailSender {
  if (!enabled) {
    return noopWaitlistEmailSender;
  }
  return {
    async sendSignupAck(_payload: WaitlistEmailPayload): Promise<void> {
      // TODO: send confirmation / double-opt-in via chosen provider.
    },
  };
}
