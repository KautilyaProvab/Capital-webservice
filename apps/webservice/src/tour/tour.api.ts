import * as moment from 'moment';
import { formatDate } from "../app.helper";
import { BaseApi } from "../base.api";
import { RedisServerService } from '../shared/redis-server.service';
import { getExceptionClassByCode } from '../all-exception.filter';
export abstract class TourApi extends BaseApi {

    constructor() {
        super();
    }
    getTourPaxDetailsUniversal(bookingPaxDetails : any,body: any)
    {
        try{
            const bookingDetails = [];
            body.totalfare= Number((body.baseFare)*(body.adultcount)) + Number((body.childFare)*(body.childcount)) - Number(body.discount) + Number(body.convinenceFee);
            const bookingInfo = {
                usertype: body.usertype,              
                bookingDetails: [{
                    package_name: body.package_name,
                    AppReference: body.appRef,
                    id: body.id,
                    from_date: body.tourPrice[0].from_date,
                    to_date: body.tourPrice[0].to_date,
                    startCity: body.startCity,
                    endCity: body.endCity,
                    tours_country:body.tours_country,
                    TourType: body.module_type,
                    // Adult_Fare: (body.tourPrice[0].adult_airliner_price)*(body.adultcount),
                    Adult_Fare:((body.baseFare) * (body.adultcount)),
                    // Child_Fare: (body.tourPrice[0].child_airliner_price)*(body.childcount),
                    Child_Fare: ((body.childFare)*(body.childcount)),
                    Total_Fare: body.totalfare,
                    convinenceFee:body.convinenceFee,
                    AdultCount: body.adultcount,
                    ChildCount: body.childcount,
                    Remarks: body.remarks,
                    BookingSource:body.BookingSource,
                    PromoCode: body?.PromoCode ?? "",
                    discount: body?.discount ?? 0,
                }]
            };
            bookingDetails.push(bookingInfo);

            const passangers = bookingPaxDetails[0];
            const address = bookingPaxDetails[1];

            
            let passangerDetails: any = [];
            for(const passenger of passangers){
                let passanger_details = {
                    Title: passenger.Title,
                    FirstName: passenger.FirstName,
                    LastName: passenger.LastName,
                    Age: passenger.Age,
                    DateofBirth: passenger.Dob,
                    Address: address.Address ,
                    Address2: address.Address2 ,
                    City: address.City ,
                    State:  address.State ,
                    PostalCode:  address.PostalCode ,
                    Email:  address.Email ,
                    PhoneCode:  address.PhoneCode ,
                    Contact:  address.Contact ,
                    Country:  address.Country ,
                } 
            passangerDetails.push(passanger_details);
            }
            if (Array.isArray(passangerDetails) && passangerDetails.length > 0 && typeof passangerDetails[0] === 'object') {
                passangerDetails[0].LeadPassenger = true;
            }
            const response = bookingDetails.map(booking => ({
                passengerDetails: passangerDetails,
                bookingDetails: booking.bookingDetails
            }));
            return response;

        }catch(error){
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
}

    
}