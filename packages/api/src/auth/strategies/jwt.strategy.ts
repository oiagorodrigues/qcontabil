import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { Request } from 'express'
import { User } from '../entities/user.entity'

function extractJwtFromCookie(req: Request): string | null {
  const token = req.cookies?.access_token
  if (typeof token === 'string' && token.length > 0) {
    return token
  }
  return null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string }): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    })

    if (!user) {
      throw new UnauthorizedException()
    }

    return user
  }
}
