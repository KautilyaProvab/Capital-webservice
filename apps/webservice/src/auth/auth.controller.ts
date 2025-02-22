import { Controller, Post, Body, HttpCode, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GuestLogin, LoginReq, RefreshTokenDto } from './auth.swagger';
import {
    RegisterDto,
    ForgotPasswordDto,
    ResetPasswordDto,
} from './auth.validator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @HttpCode(200)
    async register(@Body() user: RegisterDto): Promise<any> {
        return await this.authService.register(user);
    }

    @Post('userLogin')
    @HttpCode(200)
    async login(@Body() user: LoginReq): Promise<any> {
        return await this.authService.login(user);
    }

    @Post('forgotPassword')
    async forgotPassword(@Body() body: ForgotPasswordDto): Promise<any> {
        const result = await this.authService.forgotPassword(body.email);
        return { statusCode: 201, data: result };
    }

    @HttpCode(200)
    @Post('changePassword')
    @UseGuards(AuthGuard('jwt'))
    async changePassword(@Body() body: any, @Req() req: any): Promise<any> {
        const result = await this.authService.changePassword(req, body);
        return result;
    }

    @HttpCode(200)
    @Post('updatePassword')
    async updatePassword(@Body() body: any , @Req() req: any): Promise<any> {
        const result = await this.authService.updatePassword(body,req);
        return result;
    }

    @Post('guestLogin')
    async guestLogin(@Body() body: GuestLogin): Promise<any> {
        return await this.authService.guestLogin(body);
    }

    @Post('refreshToken')
    @HttpCode(200)
    async refreshToken(@Body() body: RefreshTokenDto): Promise<any> {
        return await this.authService.refreshToken(body);
    }


    @Post('updateLogouttime')
    @UseGuards(AuthGuard('jwt'))
    async updateLoginLogout(@Body() body: any, @Req() req: any): Promise<any> {
        return await this.authService.updateLoginLogout(body, req);
    }

    @Post('verifyOtp')
    async verifyOtp(@Body() body: any): Promise<any> {
        return await this.authService.verifyOtp(body);
    }

    @Post('resendOtp')
    async resendOtp(@Body() body: any): Promise<any> {
        return await this.authService.resendOtp(body);
    }

    /*  @Post('resetPassword')
        async resetPassword(@Body() body: ResetPasswordDto): Promise<any>{
          const result = await this.authService.resetPassword(body);
          return { statusCode: 201, data: result };
        }
      */
}
