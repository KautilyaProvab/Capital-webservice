import { Injectable } from "@nestjs/common";
import { formatDate } from "apps/webservice/src/app.helper";
import { ExchangeRate_1_USD_to_BDT ,ExchangeRate_1_GBP_to_USD, ExchangeRate_1_EUR_to_USD, BASE_CURRENCY, HOTELBEDS_HOTEL_BOOKING_SOURCE,GIATA_IMAGE_BASE_URL } from "apps/webservice/src/constants";
import moment from "moment";
import { RedisServerService } from "../../../shared/redis-server.service";
import { roomBasisCode } from "../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { log } from "console";

@Injectable()
export class HotelBedsTransformService extends HotelApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: HotelDbService) {
        super();
    }

    async updateHotelBookingItineraryDetails(id, BookingStatus) {
        
        
        //total_fare:${TotalPrice}
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingItineraryDetail(
                        id: ${id}
                        hotelHotelBookingItineraryDetailPartial: {
                            status: "${BookingStatus}"
                            
                        }
                    )
                } 
            `, 'updateHotelHotelBookingItineraryDetail');
        return result
    }
    async updateHotelBookingDetails(body) {
        // let result: any;
        if (body) {
            const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingDetail(
                        id: ${body.id}
                        hotelHotelBookingDetailPartial: {
                            status: "${body.BookingStatus}"
                            booking_id: "${body.booking_id}"
                            created_datetime: "${body.created_date}"
                            booking_reference: "${body.booking_reference}"
                            confirmation_reference: "${body.confirmation_reference}"
                        }
                    )
                } 
            `, 'updateHotelHotelBookingDetail');
            return result;
        }
        // return result;
    }

    async updateHotelBookingPaxDetails(id, BookingStatus) {
        const result = await this.getGraphData(`
                mutation {
                    updateHotelHotelBookingPaxDetail(
                        id: ${id}
                        hotelHotelBookingPaxDetailPartial: {
                            status: "${BookingStatus}"
                        }
                    )
                } 
            `, 'updateHotelHotelBookingPaxDetail');
        return result
    }

    async updateData(bookingDetails: any, body, booking, bookingPaxDetails, bookingItineraryDetails) {
        console.log("bookingDetails-",bookingDetails);
        body.TotalPrice = bookingDetails.totalSellingRate;
        body.Currency = bookingDetails.currency;
        let bookingDetailsBody = {};
        let BookingStatus= 'BOOKING_CONFIRMED';
        if(booking[0].payment_mode == 'pay_later'){
            BookingStatus= 'BOOKING_HOLD';
        }
        if (bookingDetails) {
            bookingDetailsBody['id'] = booking[0].id;
            bookingDetailsBody['booking_reference'] = bookingDetails.reference;
            bookingDetailsBody['confirmation_reference'] = bookingDetails.reference;
            bookingDetailsBody['booking_id'] = bookingDetails.reference;
            bookingDetailsBody['BookingStatus'] = BookingStatus;
        }
        let createdDate = formatDate(Date.now());
        bookingDetailsBody['created_date'] = createdDate;
        const bookingDetailsResp = await this.updateHotelBookingDetails(bookingDetailsBody);
       
        let bookingItineraryResp;
        bookingItineraryDetails.forEach(async element => {
            bookingItineraryResp = await this.updateHotelBookingItineraryDetails(element.id, BookingStatus);
        });
        let bookingPaxResp;
        bookingPaxDetails.forEach(async element => {

            bookingPaxResp = await this.updateHotelBookingPaxDetails(element.id, BookingStatus);
        });
        // if (bookingDetailsResp) {
        const bookingDetailsByAppRef = await this.hotelDbService.getHotelBookingDetails(
            body
        );
        const bookingPaxDetailsByAppRef = await this.hotelDbService.getHotelBookingPaxDetails(
            body
        );
        const bookingItineraryDetailsByAppRef = await this.hotelDbService.getHotelBookingItineraryDetails(
            body
        );
        const result = this.getHotelBookingPaxDetailsUniversal(body, bookingPaxDetailsByAppRef, bookingDetailsByAppRef[0], bookingItineraryDetailsByAppRef);
        return result;
        // }

    }

    async getHotelSearchUniversalFormat(body: any, markup: any, result: any) {
        
        const start3: any = new Date();
        let hotel_image = [];
        let hotel_amenities;
        let hotel_code=[];
        let currencyDetails=[];
        let conversionRate=1;
       
        

        // let hotel_code: any ="";
        for (var i = 0; i < result.hotels.length; i++) {
           
           hotel_code.push(result.hotels[i].code)
        // hotel_code+=`"`+result.hotels[i].code+`",`
        }
       
        // hotel_code.toString()
        let hotelInfo= await this.hotelDbService.GetHotelInfo(hotel_code);
        
       
        // v
        let hotelsData=[];
        hotelInfo=JSON.parse(JSON.stringify(hotelInfo));
       
        for (var i = 0; i < hotelInfo.length; i++) {
            hotelsData[hotelInfo[i].hotelbeds]=hotelInfo[i];     
            // hotelsData[hotelInfo[i].hotel_code].giata_code= hotelGiataId[hotelInfo[i].hotel_code].giata_code;
            // hotelsData[hotelInfo[i].hotel_code].giata_code= hotelInfo[i].giata_code;    
         }
      

        if(body.currency != BASE_CURRENCY){
            currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency)  
            conversionRate=parseFloat(currencyDetails['value']);

        }
       
        return Promise.all(
            result.hotels.map(async (t: any) => {
                
       
        
        if(hotelsData[t.code] != undefined){
           
        let hotelFacilities:any =[];
       
        if(hotelsData[t.code].hotel_faci != undefined && hotelsData[t.code].hotel_faci != ""){
        hotelFacilities= JSON.parse(hotelsData[t.code].hotel_faci);
        }
      
        if(hotelsData[t.code]){
      
        let trip_rating="";
        let NoOfReviews="";
       
        if(typeof t.reviews!="undefined"){
           trip_rating=t.reviews[0].rate;
           NoOfReviews=t.reviews[0].reviewCount;
          
        }
        
       
        let HotelPrice=0;
        let hotelCommission=0;
        
        if(typeof t.rooms[0].rates[0].sellingRate!="undefined"){
            HotelPrice=t.rooms[0].rates[0].sellingRate * (parseInt(body.NoOfRooms));
        }else if(typeof t.rooms[0].rates[0].net!="undefined"){
            HotelPrice=t.rooms[0].rates[0].net * (parseInt(body.NoOfRooms));    
        }

       
      let firstRoomCancelPolicy = [];
        
        if(t.rooms[0].rates[0].cancellationPolicies!=undefined){
            
            
            firstRoomCancelPolicy[0] = t.rooms[0].rates[0].cancellationPolicies[0];
            // firstRoomCancelPolicy[0].amount=t.rooms[0].rates[0].cancellationPolicies[0].amount*conversionRate * (parseInt(body.NoOfRooms));
            const CancPrice = t.rooms[0].rates[0].cancellationPolicies[0].amount*conversionRate;
            firstRoomCancelPolicy[0].amount=CancPrice;

            //*parseInt(body.NoOfRooms)
            
        }else{
            firstRoomCancelPolicy[0]=[];
            firstRoomCancelPolicy[0].amount=0;
        }
        if(typeof t.rooms[0].rates[0].commission!="undefined"){
            hotelCommission=t.rooms[0].rates[0].commission;
        }

     
        
        let address = JSON.parse(hotelsData[t.code].address);
        let hotelPhone:any =``;
        if(hotelsData[t.code].phone_number !='' && hotelsData[t.code].phone_number !=null){
           const Phone = JSON.parse(hotelsData[t.code].phone_number);
           hotelPhone=Phone.voice;
        }
         
        
      // Extract values that are not null
// const nonNullValues = Object.values(address).filter(value => value !== null);


let hotelAddress = ``;
// Convert the filtered values to a string
// const hotelAddress = nonNullValues.join(', ');
if(address && address.addressLine_1 != undefined && address.addressLine_1 != undefined ){
hotelAddress = address.addressLine_1+`, `+address.addressLine_2;
if (address.cityName != undefined && !hotelAddress.includes(address.cityName)) {
    hotelAddress += `, `+address.cityName; // Add stringToAdd to mainString if not already present
  }
}
         const data = {
            ResultIndex: "",
            HotelCode: t.code,
            GiataCode:hotelsData[t.code].giata_code,
            HotelName: t.name,
            HotelCategory: t.categoryName,
            StarRating: hotelsData[t.code].star_rating != undefined ? hotelsData[t.code].star_rating : "",
            HotelDescription: '',
            HotelPromotion: "",
            HotelPolicy: firstRoomCancelPolicy,
            Price: {
                "Amount": conversionRate * HotelPrice,
                "Currency": body.Currency ,//t.Currency
                "Commission": conversionRate * hotelCommission
            },
            HotelPicture: GIATA_IMAGE_BASE_URL+hotelsData[t.code].image,
            HotelAddress: hotelAddress ? hotelAddress : 'N/A',
            HotelContactNo: hotelPhone ? hotelPhone : 'N/A',
            HotelMap: null,
            Latitude: t.latitude ? t.latitude  : '',
            Longitude: t.longitude ? t.longitude  : '',
            Breakfast: "",
            HotelLocation: null,
            SupplierPrice: null,
            RoomDetails: t.rooms,
            OrginalHotelCode:  t.code,
            HotelPromotionContent: "",
            PhoneNumber: hotelPhone ? hotelPhone : 'N/A',
            HotelAmenities: hotelFacilities ? hotelFacilities : [],
            Free_cancel_date: "",
            trip_adv_url: "",
            trip_rating: trip_rating,
            NoOfRoomsAvailableAtThisPrice: "",
            Refundable: t.rooms[0].rates[0].rateClass == "NRF" ? false : true,
            HotelCurrencyCode: t.currency,
            NoOfReviews: NoOfReviews,
            ReviewScore: trip_rating,
            ReviewScoreWord: "",
            CheckIn: body.CheckIn,
            CheckOut: body.CheckOut,
            Source: "hotelbeds",
            searchRequest: body
        }
     
      
       
        data['Price']['AdminMarkup']=0;
        
            if(markup.markupDetails.adminMarkup[0] != undefined){
               
                const AdminMarkup = markup.markupDetails.adminMarkup[0];
               
            if (AdminMarkup.value_type == 'percentage') {
                let percentVal = (data['Price']['Amount'] * AdminMarkup.value) / 100;
                data['Price']['AdminMarkup']=percentVal;
                data['Price']['Amount'] += percentVal;
                data['Price']['Amount'] = parseFloat(data['Price']['Amount'].toFixed(2));
            } else if (AdminMarkup.value_type == 'plus') {
                AdminMarkup.value=parseFloat(AdminMarkup.value);
                data['Price']['AdminMarkup']=AdminMarkup.value*conversionRate;
                // result['price']['Amount'] += markup['value'];
                data['Price']['Amount'] += data['Price']['AdminMarkup'];
                // result.roomDetails.forEach(room => {
                //     room['Rooms'].forEach(element => {
                //         element['Price']['Amount'] += markup['value'];
                //     });
                //     room['Price']['Amount'] += markup['value'];
                // });
            }
        }

        if(markup.markupDetails.agentMarkup != undefined && markup.markupDetails.agentMarkup[0] != undefined){
               
            const AgentMarkup = markup.markupDetails.agentMarkup[0];
          
        if (AgentMarkup.value_type == 'percentage') {
            let percentVal = (data['Price']['Amount'] * AgentMarkup.value) / 100;
            data['Price']['AgentMarkup']=percentVal;
            data['Price']['Amount'] += percentVal;
            data['Price']['Amount'] = parseFloat(data['Price']['Amount'].toFixed(2));
        } else if (AgentMarkup.value_type == 'plus') {
            AgentMarkup.value=parseFloat(AgentMarkup.value);
            data['Price']['AgentMarkup']=AgentMarkup.value*conversionRate;
            // result['price']['Amount'] += markup['value'];
            data['Price']['Amount'] += data['Price']['AgentMarkup'];
          
        }
    }
        
        
        data['Price']['Amount'] = parseFloat(data['Price']['Amount'].toFixed(2))
        data['Price']['AdminMarkup'] = parseFloat(data['Price']['AdminMarkup'].toFixed(2))
        if(data['HotelPolicy'] && data['HotelPolicy'][0]){
        // data['HotelPolicy'][0].amount=parseFloat(data['HotelPolicy'][0].amount)+data['Price']['AdminMarkup'];
        data['HotelPolicy'][0].amount=parseFloat(data['HotelPolicy'][0].amount.toFixed(2));
        }
        // data['RoomDetails'][0].rates[0].cancellationPolicies[0].amount= firstRoomCancelAmount ;
        console.log("Price After-",data['Price']['Amount']);
        const token = this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(data));
        
    
        // delete(data['RoomDetails']);
        
        data["ResultIndex"] = response["access_key"];
        data["booking_source"] = body.booking_source

        const end3: any = new Date();
        console.log("Formatted time:", (end3 - start3));

        return data;
    }
}   
    })
)
    }

    async getHotelDetailsUniversalFormat(body: any, result: any, roomApi: any, markup: any) {
        let rooms = []
        let CancelPenalty=[]
        let NonRefundable=true;
        let currencyDetails=[];
        let conversionRate=1;
       let room1 = result.searchRequest.RoomGuests[0];
       let room1_pax=room1.NoOfAdults+"_"+room1.NoOfChild;

       const cancelCapDays = await this.hotelDbService.getCanelCappingDays('hotel')
       
       
        // room.forEach((element, i) => {
            let rateElement =roomApi.rates;
            let roomName=roomApi.name;
       
            if(result.searchRequest.Currency != BASE_CURRENCY){
                // console.log("HotelCurrency-",result.HotelCurrencyCode);
                currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(result.searchRequest.Currency)  
                conversionRate=currencyDetails['value'];
    
            }
        //    console.log("rateElement-",rateElement);
            for (let index = 0; index < rateElement.length; index++) {
            // console.log(rateElement[index].rooms+"_"+rateElement[index].adults+"_"+rateElement[index].children);return;
             
              if(typeof rooms[rateElement[index].rooms+"_"+rateElement[index].adults+"_"+rateElement[index].children]=="undefined"){
                // rooms[rateElement[index].rooms-1]=[];
                rooms[rateElement[index].rooms+"_"+rateElement[index].adults+"_"+rateElement[index].children]=[];
                
              }
            let room = {};
            room["Price"] = []
            room['Index']=index;
            room['code']=roomApi.code;
            room['Id'] = rateElement[index].rateKey
            room['Description'] = roomName;
            room['RoomType'] =rateElement[index].boardName;
            let checkInDate =new Date(result.searchRequest.CheckIn);
            let todayDate = new Date();
            let newDate_Time = checkInDate.setDate(checkInDate.getDate() - cancelCapDays[0].days);
          

            console.log("today -", todayDate );
            console.log("checkInDate -", checkInDate );
           
            if (rateElement[index].rateClass == 'NOR' && todayDate.getTime()  < newDate_Time) {
                NonRefundable= room['NonRefundable'] = false;
            }else{
                NonRefundable= room['NonRefundable'] = true;
            }
           
          
            let price = 0;
            // if (Array.isArray(priceBreakDown)) {
            //     priceBreakDown.map(item => {
            //         console.log("qwertyu" ,item)
            //         let floatValue = parseFloat(item.Price['$t']);
            //         price = floatValue;
            //         if (item.Currency['$t'] === BASE_CURRENCY) {
            //             price = ExchangeRate_1_USD_to_BDT * price
            //             item.Currency['$t'] = "BDT"
            //         }
            //         room['Price'].push({
            //             FromDate:item.FromDate['$t'],
            //             ToDate:item.ToDate['$t'],
            //             Currency: item.Currency['$t'],
            //             Amount: Number(price.toFixed(2))
            //         })
            //     })
            // } else {
                
            
                if(typeof rateElement[index].sellingRate!="undefined"){
                    price = parseFloat(rateElement[index].sellingRate);
                }else if(typeof rateElement[index].net!="undefined"){
                    price = parseFloat(rateElement[index].net);
                }
        
                // if (result.HotelCurrencyCode === "GBP") {
                    price = conversionRate * price
                    price = parseFloat(price.toFixed(2));
                // }
                
                // if (result.HotelCurrencyCode === "EUR") {
                //     price = ExchangeRate_1_EUR_to_USD * price
                    
                // }
               let AdminMarkupValue:any=0;
               let AgentMarkupValue:any=0;
               let roomMarkupValue =0;
             
            //    console.log("markup-",markup.markupDetails.adminMarkup);
            if(markup.markupDetails.adminMarkup[0] != undefined){
                const AdminMarkup=markup.markupDetails.adminMarkup[0];
                if( AdminMarkup.value > 0){
            if(AdminMarkup.value_type == 'plus' ){
                    if(rateElement[index].adults+"_"+rateElement[index].children==room1_pax){
                        AdminMarkupValue=(AdminMarkup.value*conversionRate).toFixed(2);
                        AdminMarkupValue= parseFloat(AdminMarkupValue);
                    // result['price']['Amount'] += markup['value'];
                    price +=AdminMarkupValue;

                    roomMarkupValue = AdminMarkupValue / result.searchRequest.NoOfRooms;

                    price = parseFloat(Number(price).toFixed(2));
                    }
            }else{
                
                let percentVal = (price * AdminMarkup.value) / 100;
                roomMarkupValue =AdminMarkupValue= percentVal;

                price += percentVal;
               
                price = parseFloat(price.toFixed(2));

            }
        }
        }
        if(markup.markupDetails.agentMarkup != undefined && markup.markupDetails.agentMarkup[0] != undefined){
            const AgentMarkup=markup.markupDetails.agentMarkup[0];
            if(AgentMarkup.value > 0 ){
        if(AgentMarkup.value_type == 'plus'){
                if(rateElement[index].adults+"_"+rateElement[index].children==room1_pax){
                    AgentMarkupValue=(AgentMarkup.value*conversionRate).toFixed(2);
                    AgentMarkupValue= parseFloat(AgentMarkupValue);
                // result['price']['Amount'] += markup['value'];
                price +=AgentMarkupValue;

                roomMarkupValue = AgentMarkupValue / result.searchRequest.NoOfRooms;

                price = parseFloat(Number(price).toFixed(2));
                }
        }else{
            
            let percentVal = (price * AgentMarkup.value) / 100;
            roomMarkupValue =AgentMarkupValue= percentVal;

            price += percentVal;
           
            price = parseFloat(price.toFixed(2));

        }
    }
    }
    // console.log("price_just_before-",price);    
                room['Price'].push({
                    FromDate:result.searchRequest.CheckIn,
                    ToDate:result.searchRequest.CheckOut,
                    Currency: result.searchRequest.Currency,
                    Amount: parseFloat(price.toFixed(2)),
                    AdminMarkup:AdminMarkupValue,
                    AgentMarkup:AgentMarkupValue
                })
            // }
            // console.log("price_after-",price);
               
            room['MealPlanCode'] = rateElement[index].boardCode;
            room['Occupancy'] = rateElement[index].allotment;
            let cancelationString=``;
            let nonrefundableDate:any=``;
            let CancellationDeadline:any =``;
            let APICancellationDeadline:any =``
               
  
            if(Array.isArray(rateElement[index].cancellationPolicies)){
                const { DateTime } = require('luxon');
                let newDateTime1:any=``;
                rateElement[index].cancellationPolicies.forEach(cancelElement => {
                    // Input date string
                    const dateStr = cancelElement.from;
                    
                    // Parse the date and time zone
                    const dateTime = DateTime.fromISO(dateStr);

                    const today = new Date();
  
                    // Convert the input date (anotherDate) to a Date object
                    const dateToCompare = new Date(dateStr);
                    if(body.UserType == "B2B"){
                        newDateTime1 = dateToCompare.setDate(dateToCompare.getDate() - cancelCapDays[0].days);
                        }else{
                            newDateTime1 = dateToCompare;
                        }
                        // newDateTime1= newDateTime1.toISOString().split('T')[0];
                        // today = today.toISOString().split('T')[0];
                  console.log("today-",today);
                  console.log("dateToCompare-",newDateTime1);
                    // Compare the two dates
                    if (newDateTime1 < today.getTime()) {
                        console.log("in-right");
                        nonrefundableDate ='true';
                      
                    } else {
                        nonrefundableDate ='false';
                        console.log("in-wrong");
                      
                    }
                });
                
                if(nonrefundableDate == 'true'){
                    NonRefundable= room['NonRefundable'] = true;
                }else{
                let cancelFlag =0;
                rateElement[index].cancellationPolicies.forEach(cancelElement => {
                    let newDateTime:any=``;
                   
                   

                    // Input date string
                    const dateStr = cancelElement.from;
                    
                    // Parse the date and time zone
                    const dateTime = DateTime.fromISO(dateStr);
                    
                    // Convert to desired time zone if needed (e.g., UTC)
                    const dateTimeInUTC = dateTime.toUTC();
                    
                    // Subtract days
                    if(body.UserType == "B2B"){
                    newDateTime = dateTimeInUTC.minus({ days: cancelCapDays[0].days });
                    }else{
                        newDateTime = dateTimeInUTC;
                    }
                    // Print the result in ISO format
                    // console.log("cancelElement-",cancelElement);
                    // console.log("newDateTime-",newDateTime.toISO());

                    if(cancelFlag == 0){
                        CancellationDeadline = newDateTime.toISO();
                        APICancellationDeadline = cancelElement.from;
                    }
                    let cancelCharge : any = 0;
                    // console.log("Typof-",typeof cancelElement.amount);
                    // if(typeof cancelElement.amount != 'number'){
                    const cancelPrice =cancelElement.amount * conversionRate ;
            cancelCharge = cancelPrice + roomMarkupValue;
            cancelCharge=parseFloat(Number(cancelCharge).toFixed(2));
                    // }else{
                    //     cancelCharge=parseFloat(cancelElement.amount);
                    // }
                    // Custom format for date (e.g., YYYY-MM-DD)
            const customDatePart = newDateTime.toISO().split('T')[0];
            const [year, month, day] = customDatePart.split('-');
            const formattedDate = `${day}/${month}/${year}`;

// Custom format for time (e.g., HH:MM:SS)
            const customTimePart = newDateTime.toISO().split('T')[1].split('.')[0];

                    cancelationString+=` Cancellation Charge ${cancelCharge}  ${result.searchRequest.Currency} From ${formattedDate} ,`;
                
                    cancelFlag++;
                });
            }
            }
            console.log("cancelationString-",cancelationString);
            room['CancellationDeadline'] = CancellationDeadline;
            room['APICancellationDeadline'] = APICancellationDeadline;
            room['cancellationPolicies'] = cancelationString;
            room['paxCount']=rateElement[index].rooms+"~"+rateElement[index].adults+"~"+rateElement[index].children;
            room['AdultCount']=rateElement[index].adults;
            room['ChildrenCount']=rateElement[index].children;
            room['Rooms']=rateElement[index].rooms;
            rooms[rateElement[index].rooms+"_"+rateElement[index].adults+"_"+rateElement[index].children].push(room);
            CancelPenalty.push(rateElement[index].cancellationPolicies);
        }
        let newRooms:any =[];
        // for (let x in rooms) {
        //     if(newRooms[x]==undefined){
        //         newRooms[x]=[];
        //     }

        //     newRooms[x].push(rooms[x]);
        //   } 
      
        // });
        // if (result['Currency'] === BASE_CURRENCY) {
        //     result['TotalPrice'] = ExchangeRate_1_USD_to_BDT * result['TotalPrice']
        //     result['Currecy'] = " BDT"
        // }
        let reindexedRoom: any=[];
        let NewRoomIndex=1;
        reindexedRoom= Object.values(rooms);
      
        // rooms.forEach(RoomElement => {
             
        //     reindexedRoom[NewRoomIndex+1] = RoomElement;
            
        // })
        
        let roomCurrency=result.searchRequest.Currency
        let roomPrice=0;

        if(typeof roomApi.rates[0].sellingRate!="undefined"){
        roomPrice=roomApi.rates[0].sellingRate;

        }else if(typeof roomApi.rates[0].net!="undefined"){
            roomPrice=roomApi.rates[0].net;
        }
        // if (result.HotelCurrencyCode === "GBP") {
            roomApi.rates[0].sellingRate = conversionRate * roomPrice
            roomCurrency = result.searchRequest.Currency
        // }
        // if (result.HotelCurrencyCode === "EUR") {
        //     roomApi.rates[0].sellingRate = ExchangeRate_1_EUR_to_USD * roomPrice
        //     roomCurrency = BASE_CURRENCY
        // }
        if(markup.markupDetails.adminMarkup[0] != undefined){
            let AdminMarkup = markup.markupDetails.adminMarkup[0];
            if(AdminMarkup.value > 0 ){
        if(AdminMarkup.value_type == 'plus'){
          
          let  markValue=(AdminMarkup.value*conversionRate).toFixed(2);
          const markValueOnce = parseFloat(markValue);
            // result['price']['Amount'] += markup['value'];
            roomApi.rates[0].sellingRate +=markValueOnce;
            roomApi.rates[0].sellingRate = parseFloat(roomApi.rates[0].sellingRate.toFixed(2));
    }else{
        
        let percentVal = (roomApi.rates[0].sellingRate * AdminMarkup.value) / 100;
       

        roomApi.rates[0].sellingRate += percentVal;
       
        roomApi.rates[0].sellingRate = parseFloat(roomApi.rates[0].sellingRate.toFixed(2));

    }
}
}
if(markup.markupDetails.agentMarkup != undefined && markup.markupDetails.agentMarkup[0] != undefined){
    let AgentMarkup = markup.markupDetails.agentMarkup[0];
    if(AgentMarkup.value > 0){
if(AgentMarkup.value_type == 'plus'){
  
  let  markValue=(AgentMarkup.value*conversionRate).toFixed(2);
  const markValueOnce = parseFloat(markValue);
    // result['price']['Amount'] += markup['value'];
    roomApi.rates[0].sellingRate +=markValueOnce;
    roomApi.rates[0].sellingRate = parseFloat(roomApi.rates[0].sellingRate.toFixed(2));
}else{

let percentVal = (roomApi.rates[0].sellingRate * AgentMarkup.value) / 100;


roomApi.rates[0].sellingRate += percentVal;

roomApi.rates[0].sellingRate = parseFloat(roomApi.rates[0].sellingRate.toFixed(2));

}
    }
}
        
        let roomDetail = {
            AgencyToken: body["ResultToken"],
            Rooms: reindexedRoom,
            Price: {
                Currency: roomCurrency,
                Amount: roomApi.rates[0].sellingRate,
                Commission: 0
            },
            CancelPolicy: {
                NonRefundable: NonRefundable,
                CancelPenalty: CancelPenalty
            }
        };
        const token = this.redisServerService.geneateResultToken(body);
        const response = await this.redisServerService.insert_record(token, JSON.stringify(roomDetail));
        roomDetail["ResultIndex"] = response["access_key"];
        
        return roomDetail;
    }

    // Function to compare dates
async NonRefundableDates(anotherDate) {
    // Get today's date
    const today = new Date();
  
    // Convert the input date (anotherDate) to a Date object
    const dateToCompare = new Date(anotherDate);
  console.log("today-",today);
  console.log("dateToCompare-",dateToCompare);
    // Compare the two dates
    if (dateToCompare < today) {
        console.log("in-right");
      return 'true';  // If another date is lesser than today, return true
    } else {
        console.log("in-wrong");
      return 'false';   // Otherwise, return true
    }
  }
    async updateCancelledData(response, AppReference) {
        //Make updates
    }
}