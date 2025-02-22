import { ApiProperty } from "@nestjs/swagger"

export class SearchDto {
    
    @ApiProperty()
    city_id: number;

    @ApiProperty()
    start_date: string;

    @ApiProperty()
    end_date: string;
    
    @ApiProperty()
    cat_id: number;

    @ApiProperty()
    sub_cat_id: number;

    @ApiProperty()
    sort_order: string;

    @ApiProperty()
    text: string;
    
}

export class SearchDao {
    
}