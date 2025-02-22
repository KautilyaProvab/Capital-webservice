import { ApiProperty } from "@nestjs/swagger";

export class CoreStaticPageContentList {
  @ApiProperty({ example: 1 })
  id: number;
}

export class DiscountInformationListDto {
  @ApiProperty({ example: 1 })
  category: string;
}
