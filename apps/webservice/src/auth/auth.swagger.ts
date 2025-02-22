import { ApiProperty } from '@nestjs/swagger';

export class LoginReq {
  @ApiProperty({ example: 'test@gmail.com' }) email: string;
  @ApiProperty({ example: 'test@123' }) password: string;
  // @ApiProperty({ example: '4' }) auth_role_id: number;
  // @ApiProperty({ example: true }) status: boolean;
}

export class RegisterReq {
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() password: string;
}

export class GuestLogin {
  @ApiProperty({ example: 'test@provab.com' }) email: string;
  @ApiProperty({ example: '9885884141' }) phone: string;
  @ApiProperty({ example: 'IN' }) country_code: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: '*********' }) token: string;
}
