import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../modules/redis/redis.service';
import { AuthService } from '../../modules/auth/auth.service';

// Attach the resolved user to the request for downstream use
export interface AuthenticatedRequest extends Request {
  user: { id: string; username: string };
  sessionToken: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or expired session token',
      });
    }

    const userId = await this.redis.getSession(token);
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or expired session token',
      });
    }

    const user = await this.auth.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or expired session token',
      });
    }

    req.user = { id: user.id, username: user.username };
    req.sessionToken = token;
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
  }
}
