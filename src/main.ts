import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  // ── Global pipes ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}),
        );
        return {
          getStatus: () => 400,
          getResponse: () => ({
            code: 'VALIDATION_ERROR',
            message: messages[0] ?? 'Validation failed',
          }),
        } as any;
      },
    }),
  );

  // ── Global interceptors ───────────────────────────────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── Global filters ────────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Redis adapter for Socket.io (multi-instance scaling) ─────────────────
  const redisUrl = process.env.REDIS_URL!;
  const tlsOptions = redisUrl.startsWith('rediss://') ? { tls: {} } : {};

  const pubClient = new Redis(redisUrl, tlsOptions);
  const subClient = pubClient.duplicate();

  class RedisIoAdapter extends IoAdapter {
    createIOServer(port: number, options?: any) {
      const server = super.createIOServer(port, options);
      server.adapter(createAdapter(pubClient, subClient));
      return server;
    }
  }

  app.useWebSocketAdapter(new RedisIoAdapter(app));

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({ origin: '*' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[App] Listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('[App] Fatal startup error:', err);
  process.exit(1);
});