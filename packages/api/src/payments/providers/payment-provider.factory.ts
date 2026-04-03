import { Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';

type ProviderConstructor = new (config: Record<string, string>) => PaymentProvider;

@Injectable()
export class PaymentProviderFactory {
  private readonly registry = new Map<string, ProviderConstructor>();

  register(name: string, ctor: ProviderConstructor): void {
    this.registry.set(name, ctor);
  }

  create(name: string, config: Record<string, string>): PaymentProvider {
    const Ctor = this.registry.get(name);
    if (!Ctor) {
      throw new Error(`Payment provider "${name}" is not registered`);
    }
    return new Ctor(config);
  }
}
