import { Module, Global } from '@nestjs/common';
import { RedisModule as RedisInfraModule } from './redis.module';
import { RedisService } from './redis.service';

export { RedisService };
export { REDIS_CLIENT, REDIS_SUB_CLIENT } from './redis.module';

@Global()
@Module({
  imports: [RedisInfraModule],
  providers: [RedisService],
  exports: [RedisService, RedisInfraModule],
})
export class RedisModule {}
