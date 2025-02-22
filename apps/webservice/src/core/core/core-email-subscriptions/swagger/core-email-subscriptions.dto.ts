import { ApiProperty } from "@nestjs/swagger";

export class AddCoreEamilSubscriptionsDto {
  @ApiProperty({ example: 'xxx@gmail.com' })
  email: string;

  @ApiProperty({ example: 1 })
  created_by_id: number;

  @ApiProperty({ example: "News Letter" })
  subscription_type: string;
}


