import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { importSPKI, jwtVerify, errors as JoseErrors, type KeyLike } from 'jose';

import { env } from '../env';
import { PrismaService } from '../prisma/prisma.service';

export type JwtActorType = 'user' | 'service';

export type JwtClaims = {
  sub: string;
  tenantId: string;
  type: JwtActorType;
  role?: string;
  exp?: number;
  jti?: string;
};

export type AuthenticatedUser = {
  kind: 'user';
  userId: string;
  tenantId: string;
  role?: string;
};

export type AuthenticatedService = {
  kind: 'service';
  apiKeyId: string;
  tenantId: string;
  profile?: 'read-only' | 'write' | 'admin';
  toolActionKeys: string[];
};

export type AuthenticatedActor = AuthenticatedUser | AuthenticatedService;

let publicKeyPromise: Promise<KeyLike> | undefined;

async function getJwtPublicKey(): Promise<KeyLike> {
  if (!publicKeyPromise) {
    publicKeyPromise = importSPKI(env.JWT_PUBLIC_KEY, 'RS256');
  }
  return publicKeyPromise;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isJwtLike(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(authorizationToken: string): Promise<AuthenticatedActor> {
    if (isJwtLike(authorizationToken)) {
      return this.authenticateJwt(authorizationToken);
    }

    return this.authenticateApiKey(authorizationToken);
  }

  private async authenticateJwt(jwt: string): Promise<AuthenticatedActor> {
    try {
      const { payload } = await jwtVerify(jwt, await getJwtPublicKey(), {
        algorithms: ['RS256'],
      });

      const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;
      const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
      const type = typeof payload.type === 'string' ? payload.type : undefined;
      const role = typeof payload.role === 'string' ? payload.role : undefined;

      if (!tenantId || !sub || (type !== 'user' && type !== 'service')) {
        throw new JoseErrors.JWTInvalid('missing required claims');
      }

      if (type === 'service') {
        return {
          kind: 'service',
          apiKeyId: sub,
          tenantId,
          profile: 'admin',
          toolActionKeys: ['*'],
        };
      }

      return {
        kind: 'user',
        tenantId,
        userId: sub,
        role,
      };
    } catch (error: unknown) {
      if (error instanceof JoseErrors.JWTExpired) {
        const err = new Error('TOKEN_EXPIRED');
        (err as { code?: string }).code = 'TOKEN_EXPIRED';
        throw err;
      }

      const err = new Error('INVALID_TOKEN');
      (err as { code?: string }).code = 'INVALID_TOKEN';
      throw err;
    }
  }

  private async authenticateApiKey(apiKeyValue: string): Promise<AuthenticatedService> {
    const hash = sha256Hex(apiKeyValue);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { hash },
      include: { toolActions: { include: { toolAction: { select: { key: true } } } } },
    });

    if (!apiKey || apiKey.status !== 'ativo') {
      const err = new Error('INVALID_TOKEN');
      (err as { code?: string }).code = 'INVALID_TOKEN';
      throw err;
    }

    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      const err = new Error('TOKEN_EXPIRED');
      (err as { code?: string }).code = 'TOKEN_EXPIRED';
      throw err;
    }

    const toolActionKeys = apiKey.toolActions.map((row) => row.toolAction.key);

    let profile: AuthenticatedService['profile'];
    if (apiKey.profile === 'read_only') profile = 'read-only';
    if (apiKey.profile === 'write') profile = 'write';
    if (apiKey.profile === 'admin') profile = 'admin';

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      kind: 'service',
      apiKeyId: apiKey.id,
      tenantId: apiKey.tenantId,
      profile,
      toolActionKeys,
    };
  }

  timingSafeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }
}
