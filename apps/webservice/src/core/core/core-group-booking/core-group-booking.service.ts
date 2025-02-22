import { Body, Req } from "@nestjs/common";
import { getExceptionClassByCode } from "apps/webservice/src/all-exception.filter";
import { BaseApi } from "apps/webservice/src/base.api";
import { CreateCarGroupBookingDto, CreateFlightGroupBookingDto, CreateHotelGroupBookingDto } from "./swagger/group-booking.dto";

export class CoreGroupBookingService extends BaseApi {
  
  constructor() {
    super();
  }

 
  async createCarGroupBooking(@Body() body: CreateCarGroupBookingDto,@Req() req: any) {
    var userId=0
    if(req.user){
      userId=req.user.id
    }
    try {
      const timeElapsed = Date.now();
      const today = new Date(timeElapsed);
      const result = await this.getGraphData(
        `
            mutation {    
              createCarGroupBooking(
                  carGroupBooking: {
                        first_name:"${body.first_name}"
                        last_name:"${body.last_name}"
                        phone:"${body.phone}"
                        email:"${body.email}"
                        from:"${body.from}"
                        to:"${body.to}"
                        pick_up_date:"${body.pick_up_date}"
                        drop_off_date:"${body.drop_off_date}"
                        pick_up_time:"${body.pick_up_time}"
                        drop_off_time:"${body.drop_off_time}"
                        total_pax:${body.total_pax}
                        recieved_on:"${today.getFullYear()+"-"+(today.getMonth()+1)+"-"+today.getDate()}"
                        comments:"${body.comments}"
                        created_by_id : "${userId}"
                        group_booking_status:"Pending"
                        status:${1}
                      }
                    ) {
                        id
                        status
                        first_name
                        last_name
                        email
                        phone
                        from
                        to
                        pick_up_date
                        drop_off_date
                        pick_up_time
                        drop_off_time
                        total_pax
                        recieved_on
                        comments
                        group_booking_status
                        created_by_id
                      }
            }
            `,
        "createCarGroupBooking"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async createFlightGroupBooking(@Body() body: CreateFlightGroupBookingDto ,@Req() req:any) {
    const total_pax = body.adult + body.child + body.infant;
    const timeElapsed = Date.now();
    var userId=0
    if(req.user){
      userId=req.user.id
    }
    const today = new Date(timeElapsed);
    try {
      const result = await this.getGraphData(
        `
            mutation {    
              createFlightGroupBooking(
                  flightGroupBooking: {
                    group_booking_status:"Pending"
                        first_name:"${body.first_name}"
                        last_name:"${body.last_name}"
                        phone:"${body.phone}"
                        email:"${body.email}"
                        trip_type:"${body.trip_type}"
                        from:"${body.from}"
                        to:"${body.to}"
                        departure_date:"${body.departure_date}"
                        return_date:"${body.return_date}"
                        adult:${body.adult}
                        child:${body.child}
                        infant:${body.infant}
                        total_pax:${total_pax}
                        class:"${body.class}"
                        carrier:"${body.carrier}"
                        recieved_on:"${today.getFullYear()+"-"+(today.getMonth()+1)+"-"+today.getDate()}"
                        comments:"${body.comments}"
                        created_by_id:"${userId}"
                        status:${1}
                      }
                    ) {
                        id
                        status,
                        group_booking_status
                        first_name
                        last_name
                        email
                        phone
                        trip_type
                        from
                        to
                        departure_date
                        return_date
                        adult
                        child
                        infant
                        total_pax
                        class
                        carrier
                        recieved_on
                        comments
                        created_by_id
                      }
            }
            `,
        "createFlightGroupBooking"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async createHotelGroupBooking(@Body() body: CreateHotelGroupBookingDto , @Req() req : any) {
    const total_pax = body.adult + body.child;
    var userId=0
    if(req.user){
      userId=req.user.id
    }
    try {
      const timeElapsed = Date.now();
      const today = new Date(timeElapsed);
      const result = await this.getGraphData(
        `
            mutation {    
              createHotelGroupBooking(
                  hotelGroupBooking: {
                        first_name:"${body.first_name}"
                        last_name:"${body.last_name}"
                        phone:"${body.phone}"
                        email:"${body.email}"
                        city:"${body.city}"
                        check_in:"${body.check_in}"
                        check_out:"${body.check_out}"
                        adult:${body.adult}
                        child:${body.child}
                        nights:${body.nignts}
                        total_pax:${total_pax}
                        recieved_on:"${today.getFullYear()+"-"+(today.getMonth()+1)+"-"+today.getDate()}"
                        comments:"${body.comments}"
                        created_by_id:"${userId}"
                        group_booking_status:"Pending"
                        status:${1}
                      }
                    ) {
                        id
                        status
                        group_booking_status
                        first_name
                        last_name
                        email
                        phone
                        city
                        check_in
                        check_out
                        adult
                        child
                        nights
                        total_pax
                        recieved_on
                        comments
                        created_by_id
                      }
            }
            `,
        "createHotelGroupBooking"
      );
      return result;
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

}