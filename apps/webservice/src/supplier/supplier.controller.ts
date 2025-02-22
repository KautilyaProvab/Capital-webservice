import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CreatePropertiesDto } from "./dto/create.dto";
import { SuppliersService } from "./supplier.service";
import { UpdateSupplierDto } from "./dto/update.dto";

@Controller("supplier")
export class SuppliersController {
  constructor(private readonly sService: SuppliersService) {}

  @Post("create")
  create(@Body() createSupplierDto: CreatePropertiesDto) {
    return this.sService.create(createSupplierDto);
  }

  @Post("find_all")
  findAll(@Body() findAllDto: any) {
    return this.sService.findAll(findAllDto);
  }

  @Post("find_properties")
  findProperties(@Body() findPropertiesDto: any) {
    return this.sService.findProperties(findPropertiesDto);
  }


  @Post("update")
  update(@Body() updateSupplierDto: UpdateSupplierDto) {
    return this.sService.updateSupplier(updateSupplierDto);
  }

  @Post("delete")
  delete(@Body() body:any){
    return this.sService.delete(body);
  }
}
