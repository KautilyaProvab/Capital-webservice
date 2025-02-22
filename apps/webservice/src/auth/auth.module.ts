import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CommonService } from '../common/common/common.service';
import { AuthDbService } from './auth-db.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { jwtConstants } from './constants';
import { JwtStrategy } from './jwt.strategy';
import { TransportConfigModule } from '../transport-config.module';
import { TransportConfigService } from '../transport-config.service';

@Module({
    imports: [
        PassportModule.register({
            defaultStrategy: 'jwt',
            property: 'user',
            session: false,
        }),
        JwtModule.register({
            secret: jwtConstants.secret,
            signOptions: { expiresIn: jwtConstants.expiresInSeconds + 's' },
        }),
    ],
    providers: [AuthService, AuthDbService, JwtStrategy,CommonService, TransportConfigModule, TransportConfigService],
    controllers: [AuthController],
    exports: [PassportModule, JwtModule]
})
export class AuthModule { }
