import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SimulatedPaymentResult = 'simulated_succeeded' | 'simulated_failed';

@Injectable()
export class FakePaymentGateway {
  constructor(private readonly configService: ConfigService) {}

  async charge(): Promise<SimulatedPaymentResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Fake payments are disabled in production',
      );
    }
    return this.configService.getOrThrow<SimulatedPaymentResult>(
      'payments.fakeResult',
    );
  }
}
