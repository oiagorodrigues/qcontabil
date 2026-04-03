# HMAC-SHA256 Webhook Signature Validation with timingSafeEqual

## Context

Validating incoming Tipalti webhook signatures to prevent spoofed events. Naive string comparison (`===`) is vulnerable to timing attacks — attacker can guess signature byte-by-byte by measuring response time.

## Pattern

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

function validateWebhookSignature(rawBody: Buffer, signature: string, secret: string): void {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex')

  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new UnauthorizedException('Invalid webhook signature')
  }
}
```

## Key Points

- **`timingSafeEqual` requires equal lengths**: Check lengths first — unequal lengths would throw instead of returning false.
- **`rawBody` not parsed body**: The signature is computed over the raw bytes before JSON parsing. Requires `rawBody: true` in NestFactory options and `RawBodyRequest<Request>` in the controller.
- **Strip prefix**: Some providers send `sha256=<hex>` format. Strip the prefix before comparing.
- **Timing attack**: `===` on strings returns early on first mismatch → attacker measures response time to guess bytes. `timingSafeEqual` always takes the same time.

## NestJS Setup for Raw Body Access

```typescript
// main.ts
const app = await NestFactory.create(AppModule, { rawBody: true })

// webhook.controller.ts
import * as express from 'express'  // namespace import — avoids TS1272 with isolatedModules
import type { RawBodyRequest } from '@nestjs/common'

@Post('tipalti')
@Public()
async handleWebhook(
  @Req() req: RawBodyRequest<express.Request>,
  @Headers('x-tipalti-signature') signature: string,
): Promise<void> {
  const rawBody = req.rawBody ?? Buffer.alloc(0)
  await this.paymentsService.handleWebhook('tipalti', rawBody, signature)
}
```

## Why `import * as express` instead of `import express from 'express'`

With `isolatedModules: true` (TypeScript's `TS1272`), using a type-only namespace as a value in a decorated signature fails. Namespace import (`import * as express`) is treated as a value import and bypasses this restriction.
