import { Injectable } from "@nestjs/common";
import * as moment from "moment";
import { RedisServerService } from "../../../shared/redis-server.service";
import { TransferApi } from "../../transfer.api";
import { TransferDbService } from "../transfer-db.service";
import { debug } from "console";
import { HOPPA_TRANSFER_BOOKING_SOURCE, HOPPA_TRANSFER_URL } from "apps/webservice/src/constants";

@Injectable()
export class HoppaTransformService extends TransferApi {

    constructor(private readonly redisServerService: RedisServerService,
        private hotelDbService: TransferDbService) {
        super();
    }

    async availabilityResponseFormat(data: any,Request:any, body:any): Promise<any> {
      
        let CancelString = `Within ${+data?.CanxHours?.['$t']} hrs of travel ${data?.CanxPerc?.['$t']}% fee will apply`;
        if(data?.CanxOutOfHoursPP?.['$t']>0){
            CancelString +=`If booking by deposit any cancellation outside of ${data?.CanxOutOfHoursPP?.['$t']} hrs will incur a ${data?.CanxPerc?.['$t']}% loss of deposit`;
        }

        let canxHours = data?.CanxHours?.['$t'];

        let disclaimer=0;

        if(data.Disclaimer){
            disclaimer=data.Disclaimer['$t'];
        }
            let responseFormat = {
            ProductName: data?.Vehicle?.['$t'],
            ProductCode: data?.BookingID?.['$t'],
            ImageUrl:data?.VehicleImage?.['$t'] ,
            ImageHisUrl: data?.Company_Logo?.['$t'],
            BookingEngineId: "",
            Promotion: "",
            PromotionAmount: data?.PromoDiscount?.['$t'],
            StarRating: data?.Rating?.['$t'],
            ReviewCount: data?.NumberOfReviews?.['$t'],
            DestinationName: Request?.PlaceTo?.['$t'],
            Suitcase:data?.BigBagAllowance?.['$t'],
            SmallBaggage:data?.SmallBagAllowance?.['$t'],
            OccupancyFrom:data?.OccupancyFrom?.['$t'],
            OccupancyTo:data?.OccupancyTo?.['$t'],
            Price: {
                TotalDisplayFare: data?.Price?.TotalDisplayFare,
                GSTPrice: 0,
                PriceBreakup: {
                    AgentCommission: 0,
                    AgentTdsOnCommision: 0
                },
                Currency:  data?.Price?.Currency,
            },
            Description: "",
            Cancellation_available: CancelString,
            Cancel_hours :canxHours,
            Cat_Ids: [ ],
            Sub_Cat_Ids: [],
            Supplier_Code:  data?.SupplierID?.['$t'],
            SupplierName:data?.TransferCompany?.['$t'],
            Duration: data?.DurationMin?.['$t']+` Minutes`,
            Disclaimer:disclaimer,
            data        
        }
        return responseFormat; 
    }

    async ProductDetailsResponseFormat(data: any): Promise<any> {

        let Journey: any = [];
        const ArrHours = data?.Request?.ArrTime?.['$t'].slice(0, 2);
        const ArrMinutes = data?.Request?.ArrTime?.['$t'].slice(2, 4);

        Journey[0]={From:data?.Request?.PlaceFrom?.['$t'],
            To:data?.Request?.PlaceTo?.['$t'],
            Date:data?.Request?.ArrDate?.['$t'],
            Time:await this.convertToAMPM(ArrHours+ArrMinutes)
        }

        if(data.Request.IsReturn['$t'] ==1){
            const RetHours = data?.Request?.RetTime?.['$t'].slice(0, 2);
        const RetMinutes = data?.Request?.RetTime?.['$t'].slice(2, 4);
        Journey[1]={From:data?.Request?.PlaceTo?.['$t'],
            To:data?.Request?.PlaceFrom?.['$t'],
            Date:data?.Request?.RetDate?.['$t'],
            Time:await this.convertToAMPM(RetHours+RetMinutes)
        }
        }

      
       
        let responseFormat = {
            "ProductName": data?.Vehicle?.['$t'],
            "ReviewCount": data?.NumberOfReviews?.['$t'],
            "product_image": data?.VehicleImage?.['$t'],
            "StarRating": data?.Rating?.['$t'],
            "Promotion": false,
            "Duration": data?.DurationMin?.['$t'] +' Minutes',
            "ProductCode": data?.BookingID?.['$t'],
            "Suitcase":data?.BigBagAllowance?.['$t'],
            "SmallBaggage":data?.SmallBagAllowance?.['$t'],
            "OccupancyFrom":data?.OccupancyFrom?.['$t'],
            "OccupancyTo":data?.OccupancyTo?.['$t'],
            "ProductPhotos": [
                {
                    "photoHiResURL": data?.Company_Logo?.['$t'],
                    "photoURL": data?.VehicleImage?.['$t'],
                    "ImageCaption": ""
                }
            ],
            "Product_Video": "",
            "Price": {
                "TotalDisplayFare": data?.Price?.TotalDisplayFare,
                "GSTPrice": 0,
                "PriceBreakup": {
                    "AgentCommission": 0,
                    "AgentTdsOnCommision": 0
                },
                "Currency": data?.Price?.Currency
            },
            "Product_Reviews": [],
            "Product_Tourgrade": [],
            "Product_available_date": {},
            "Cancellation_available": true,
            "Cancellation_day": 0,
            "Cancellation_hour": data?.CanxHours?.['$t'],
            "Cancellation_Policy": data?.CanxPerc?.['$t'],
            "BookingEngineId": "",
            "Voucher_req": "",
            "Tourgrade_available": true,
            "UserPhotos": [],
            "Product_AgeBands": [],
            "BookingQuestions": [],
            "Highlights": null,
            "SalesPoints": [],
            "TermsAndConditions": null,
            "MaxTravellerCount": data?.OccupancyTo?.['$t'],
            "Itinerary": "",
            "VoucherOption": "",
            "VoucherOption_List": "",
            "AdditionalInfo": [],
            "Inclusions": [ ],
            "DepartureTime": data?.Request?.ArrDate?.['$t']+' '+ArrHours+':'+ArrMinutes,
            "DeparturePoint": data?.Request?.PlaceFrom?.['$t'],
            "Destination":data?.Request?.PlaceTo?.['$t'],
            "Journey":Journey,
            "DepartureTimeComments": "",
            "ReturnDetails": {},
            "Exclusions": [],
            "ShortDescription": "",
            "Location": "",
            "AllTravellerNamesRequired": false,
            "Country": "",
            "Region": "",
            "SessionID":data?.SessionID,
            "Disclaimer":data?.Disclaimer??"",
            "Extras":data?.Extras??"",
            data
        }
        if(data.Request.RetTime){
            const RetHours = data?.Request?.RetTime?.['$t'].slice(0, 2);
            const RetMinutes = data?.Request?.RetTime?.['$t'].slice(2, 4); 
            responseFormat.ReturnDetails={
                "ReturnTime": data?.Request?.RetDate?.['$t']+' '+RetHours+':'+RetMinutes,
            "ReturnPoint": data?.Request?.PlaceTo?.['$t'],
            }; 
            } 

        
        return responseFormat; 
    }
    
    async formatBlocktripResponse(data:any , body: any): Promise<any> {
  
        let CancelString = `Within ${data?.parsedData?.Cancellation_hour} hrs of travel ${data?.parsedData?.Cancellation_Policy}% fee will apply`;
        if(data?.parsedData?.CanxOutOfHoursPP?.['$t']>0){
            CancelString +=`If booking by deposit any cancellation outside of ${data?.parsedData?.CanxOutOfHoursPP?.['$t']} hrs will incur a ${data?.parsedData?.CanxPerc?.['$t']}% loss of deposit`;
        }
        let CancelHours = data?.parsedData?.Cancellation_hour;
        console.log("data-",data);
        const responseFormat = {
            "ProductName": data.parsedData.ProductName,
            "ProductCode":  data.parsedData.ProductCode,
            "ProductImage": data.parsedData.product_image,
            "BookingDate": data.parsedData.body.ArrivalDate,
            "StarRating":  data?.parsedData?.StarRating,
            "Duration": data.parsedData.Duration,
            "Destination": data.parsedData.Destination,
            "GradeCode": "",
            "GradeDescription": "",
            "DeparturePoint":  data.parsedData.DeparturePoint,
            "DeparturePointAddress": "",
            "BookingQuestions": [],
            "SupplierName":data.parsedData.data?.TransferCompany?.['$t'],
            "SupplierPhoneNumber": "",
            "Suitcase":data?.parsedData?.Suitcase,
            "SmallBaggage":data?.parsedData?.SmallBaggage,
            "Cancellation_available": true,
            "OccupancyFrom":data?.parsedData?.OccupancyFrom,
            "OccupancyTo":data?.parsedData?.OccupancyTo,
            "Price": {
                "TotalDisplayFare": data.Price.TotalDisplayFare,
                "GSTPrice": 0,
                "PriceBreakup": data.Price.PriceBreakup,
                "Currency": data.Price.Currency,
                "markupDetails": data.Price.markupDetails,
                "AgentNetFare": data.Price.AgentNetFare,
                "Amount": data.Price.Amount
            },
            "TM_Cancellation_Charge": [
                {
                    "Charge": data.parsedData?.Cancellation_Policy,
                    "Cancellation_hour":data.parsedData?.Cancellation_hour,
                    "Cancellation_day":data.parsedData?.Cancellation_day
                }
            ],
            "TM_LastCancellation_date": "",
            "HotelPickup": false,
            "HotelList": [],
            "hotel_pikcup_option": { },
            "BlockTourId": data.TransacNo['$t'],
            "Cancellation_Policy": CancelString,
            "CancelHours":CancelHours,
            "TermsAndConditions": null,
            "Inclusions": [],
            "SessionID": data.SessionID,
            "Disclaimer":data?.Disclaimer??"",
            "IsReturn":data.parsedData.body.IsReturn,
            "IsAccomadationAddress":false,
            data
        }

        return responseFormat; 
    }



    async addTransferBookingDetails(data: any, body: any): Promise<any> {
        data.DeparturePoint = data?.DeparturePoint?.replace(/'|<br \/>/g, '');
        data.BooKingInfo =body;
        delete data.data.parsedData;
        delete data.HotelList;
        delete data.data.Disclaimer;
        delete data.Disclaimer;
        let Domain: any;

        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

    // Check if the date string matches the format
    const match = data.BookingDate.match(dateRegex);

    if (match) {
        const newDate = data.BookingDate.split("/");
        
            data.BookingDate = `${newDate[2]}-${newDate[1]}-${newDate[0]}`;
        }
        data.Destination = data.Destination.replace(/'/g, " ")
        data.DeparturePoint = data.DeparturePoint.replace(/'/g, " ")
        // data.Destination = data.Destination.replace(/'/g, "''");
        // data.DeparturePoint = data.DeparturePoint.replace(/'/g, "''");
        
        data.Destination = data.Destination.replace(/,/g, "-")
        data.DeparturePoint = data.DeparturePoint.replace(/,/g, "-")

        let payment_mode = 'wallet';
        let pay_later='false';
        let formattedCancelDate:any=``;
        if(data.CancelHours >= '1' ){

            let checkInDate =new Date(data.BookingDate);
            let minusDays = Math.ceil(parseInt(data.CancelHours) / 24);
             let cancel_deadline = checkInDate.setDate(checkInDate.getDate() - minusDays);
                
    const date = new Date(cancel_deadline);
    
    // Extracting the year, month, and day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const day = String(date.getDate()).padStart(2, '0');
    
    // Formatting in yyyy-mm-dd format
     formattedCancelDate = `${year}-${month}-${day}`;
            }
        if(body.UserType == 'B2C'){
            payment_mode = 'payment_gateway';
            
        }else{
        if(data.CancelHours >= '48' ){

        pay_later='true';
      
        }
        }
        
        console.log("data.BookingDate-",data.BookingDate);
        if (body.BookingSource === "ZBAPINO00002") {
            Domain = 1//"Travelomatix";
        }
        const result = await this.getGraphData(
            `mutation {
					createTransferBookingDetail(
                        transferBookingDetail: {
							status: "BOOKING_HOLD"
                            booking_id:"${data?.booking_from ?? 0}"
							app_reference: "${body.AppReference}"
                            booking_source: "${body.UserType}"
                            domain_origin: "${Domain ?? 1}"
							star_rating: ${data.StarRating ? data.StarRating : 0}
							email: "${body.AddressDetails.Email}"
                            phone_number: "${body.AddressDetails.Contact}"
                            currency: "${data?.Price?.Currency ?? " "}"
                            created_by_id: ${body.UserId ?? 0}
                            booking_reference: "${data?.Remarks ?? ""}"
                            attributes: "${JSON.stringify(data).replace(/"/g, "'")}"
                            confirmation_reference:""
                            product_name: "${data?.ProductName}"
                            product_code: "${data?.ProductCode}"
                            grade_code : ""
                            grade_desc : ""
                            phone_code : "${body.AddressDetails.PhoneCode}"
                            alternate_number : ""
                            payment_mode : "${payment_mode}"
                            payment_status:"Not Paid"
                            pay_later:"${pay_later}"
                            convinence_value : 0
                            convinence_value_type : ""
                            convinence_per_pax : 0
                            convinence_amount : 0
                            promo_code : "${body.PromoCode}"
                            discount : 0
                            currency_conversion_rate : 0
                            travel_date: "${data?.BookingDate}"
                            cancel_deadline : "${formattedCancelDate}"
                            Api_id : "${HOPPA_TRANSFER_BOOKING_SOURCE}"
			        }
					) {
						id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
                        payment_mode
                        payment_status
                        pay_later
                        convinence_value
                        convinence_value_type
                        convinence_per_pax
                        convinence_amount
                        promo_code
                        discount
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id
                        
					}
			  	}
			`,
            "createTransferBookingDetail"
        );
        return result;
    }

    async convinenceFees(body: any, totalFare: any): Promise<any> {
        let ConvinenceFee: any = 0;
        
        let passengerCount=body.body.AdultCount + body.body.ChildCount + body.body.InfantCount;

        const query = `select * from core_payment_charges WHERE module = 'Transfer';`
        const queryResponse = await this.manager.query(query);

        if (Array.isArray(queryResponse) && queryResponse.length > 0 && queryResponse[0].status == 1) {

            if (queryResponse[0].fees_type === 'percentage') {
                const percentageAdvanceTax = (totalFare * queryResponse[0].fees) / 100;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));

            } else if (queryResponse[0].fees_type === 'plus') {
                const percentageAdvanceTax = queryResponse[0].fees;
                ConvinenceFee += Number(percentageAdvanceTax.toFixed(2));
            }

            if (queryResponse[0].added_per_pax === "Yes") {
                ConvinenceFee = Number((ConvinenceFee * passengerCount).toFixed(2));
            }
        }

        return ConvinenceFee;
    }

    async addTransferBookingItineraryDetails(data: any, body: any): Promise<any> {
        delete data.data.parsedData;
        delete data.HotelList;
        let promoCode: any = [];
        if (body.PromoCode) {
            promoCode = await this.getGraphData(
                `{
                corePromocodes(where:{
                    promo_code:{
                        eq: "${body.PromoCode}"
                    }
                    }){
                        id
                        promo_code
                        discount_type
                        discount_value
                        use_type
                    }
                }`,
                "corePromocodes"
            );
        }
        let convinenceFee: any = 0;
     
        // if (data.body.UserType === "B2C") {
            convinenceFee = await this.convinenceFees(data, data.Price.TotalDisplayFare);
        // }
        if (body.Currency!== 'GBP'){
            convinenceFee = data.exchangeRate * convinenceFee
        }
        let discountAmount: any = 0;
        let firstPromo: any = "";
        if (promoCode.length > 0 && data.body.UserType === "B2C") {
            firstPromo = promoCode[0];

            if (firstPromo.discount_type === "percentage") {
                // let totalPrice: any;
                // if (data.Price.Currency != "GBP") {
                //     totalPrice = parseFloat((data?.Price?.TotalDisplayFare/data.exchangeRate).toFixed(2))
                // }

                // discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

                // if (data.Price.Currency != "GBP") {
                //     discountAmount = parseFloat((discountAmount *data.exchangeRate).toFixed(2))
                // }
                // data.Price.TotalDisplayFare -= discountAmount;
                let totalPrice = data.Price.Currency !== "GBP"
                    ? parseFloat((data.Price.TotalDisplayFare / data.exchangeRate).toFixed(2))
                    : data.Price.TotalDisplayFare;

                discountAmount = parseFloat(((firstPromo.discount_value / 100) * totalPrice).toFixed(2));

                if (data.Price.Currency !== "GBP") {
                    discountAmount = parseFloat((discountAmount * data.exchangeRate).toFixed(2));
                }

                data.Price.TotalDisplayFare -= discountAmount;

            } else if (firstPromo.discount_type === "plus") {
                discountAmount = firstPromo.discount_value;

                if (data.Price.Currency != "GBP") {
                    discountAmount = parseFloat((discountAmount * data.exchangeRate).toFixed(2))
                }
                data.Price.TotalDisplayFare -= discountAmount;
            }
        }
        if (data.body.UserType === "B2C" && convinenceFee != 0) {
            data.Price.TotalDisplayFare += convinenceFee
        }
        if (firstPromo != "" && firstPromo.use_type === "Single") {
            const query = `UPDATE core_promocodes SET status = 0 WHERE id = ${firstPromo.id}`;
            await this.manager.query(query);
        } 
        console.log("ExtrasAmount-",data?.Price?.ExtrasAmount);
        const result = await this.getGraphData(
            `mutation {
                    createTransferBookingItineraryDetail(
                        transferBookingItineraryDetail: {
                            status: "BOOKING_HOLD"
                            app_reference: "${body.AppReference}"
                            currency: "${data?.Price?.Currency ?? " "}"
                            booking_reference: "${data.remarks}"
                            attributes: "${JSON.stringify(data).replace(/"/g, "'")}"
                            location : "${data.Destination}"
                            travel_date :"${data.BookingDate}"
                            grade_code : "${data.GradeCode}"
                            grade_desc : "${data.GradeDescription}"
                            base_fare : ${(parseFloat((data?.Price?.TotalDisplayFare).toFixed(2)) ?? 0)-(data?.Price?.markupDetails?.AdminMarkup ?? 0)-(data?.Price?.markupDetails?.AgentMarkup ?? 0)-(convinenceFee) + discountAmount}
                            total_fare : ${(parseFloat((data?.Price?.TotalDisplayFare).toFixed(2)) ?? 0)+(parseFloat((data?.Price?.ExtrasAmount).toFixed(2)) ?? 0)}
                            extras_amount : ${parseFloat((data?.Price?.ExtrasAmount).toFixed(2)) ?? 0}
                            admin_markup :  ${data?.Price?.markupDetails?.AdminMarkup ?? 0}
                            admin_net_markup : ${data?.Price?.admin_net_markup ?? 0}
                            agent_markup : ${data?.Price?.markupDetails?.AgentMarkup ?? 0}
                            admin_commission : ${data?.Price?.admin_commission ?? 0}
                            admin_tds : ${data?.Price?.admin_tds ?? 0}
                            agent_commission : ${data?.Price?.PriceBreakup?.AgentCommission ?? 0}
                            agent_tds : ${data?.Price?.PriceBreakup?.AgentTdsOnCommision ?? 0}
                            api_raw_fare : ${data?.Price?.Amount ?? 0}
                            agent_buying_price : ${data?.Price?.agent_buying_price ?? 0}
                            gst : ${data?.Price?.GSTPrice ?? 0}
                            ProductPrice : ${data?.Price?.ProductPrice ?? 0}
                            Discount : ${discountAmount ?? 0}
                            Tax : ${convinenceFee ?? 0}
                    }
                    ) {
                        id
                        app_reference
                        booking_reference
                        location
                        travel_date
                        grade_code
                        grade_desc
                        status
                        total_fare
                        base_fare
                        extras_amount
                        admin_markup
                        admin_net_markup
                        agent_markup
                        admin_commission
                        admin_tds
                        agent_commission
                        agent_tds
                        api_raw_fare
                        agent_buying_price
                        gst
                        currency
                        attributes
                        ProductPrice
                        Discount
                        Tax
                    }
                }
            `,
            "createTransferBookingItineraryDetail"
        );
        return result;
    }

    async addTransferBookingPaxDetails(data: any, body: any): Promise<any> {

        let response: any = [];
        for (let i = 0; i < body.PassengerDetails.length; i++) {
            const result = await this.getGraphData(
                `mutation {
                        createTransferBookingPaxDetail(
                            transferBookingPaxDetail: {
                                status: "BOOKING_HOLD"
                                app_reference: "${body.AppReference}"
                                booking_reference: "${data?.remarks ?? ""}"
                                attributes: "${JSON.stringify(body).replace(/"/g, "'")}"
                                title : "${body.PassengerDetails[i].Title}"
                                first_name : "${body.PassengerDetails[i].FirstName}"
                                middle_name : "${body.PassengerDetails[i].MiddleName}"
                                last_name : "${body?.PassengerDetails?.[i]?.LastName}"
                                phone : ${body?.AddressDetails?.Contact}
                                email : "${body?.AddressDetails?.Email}"
                                pax_type : "${body?.PassengerDetails?.[i]?.PaxType}"
                                age : ${body?.PassengerDetails?.[i]?.Age ?? 0}
                                date_of_birth : "${body?.PassengerDetails?.[i]?.Dob}"
                                adult_count: "${data?.searchBody?.AdultCount ?? 0}"
                                child_count: "${data?.searchBody?.ChildCount ?? 0}"
                        }
                        ) {
                            id
                            app_reference
                            booking_reference
                            title
                            first_name
                            middle_name
                            last_name
                            phone
                            email
                            pax_type
                            age
                            date_of_birth
                            status
                            attributes
                            adult_count
                            child_count
                        }
                    }
                `,
                "createTransferBookingPaxDetail"
            );
            response.push(result);
        }

        return response;
    }

    async getTransferBookingPaxDetailsUniversal(body: any,
        bookingDetails: any,
        bookingItinerary: any,
        paxDetails: any): Promise<any> {

        return {
            BookingSource: body.BookingSource,
            BookingDetails: bookingDetails,
            BookingItineraryDetails: bookingItinerary,
            BookingPaxDetails: paxDetails
        }
    }

    async bookingRequestFormat(data: any, pax: any, body): Promise<any> {
      
        let parsedPaxData = JSON.parse(pax.attributes.replace(/'/g, '"'));
       
       
        let BooKingInfo=data.BooKingInfo;

        if(BooKingInfo.DepPoint == undefined){
            BooKingInfo.DepPoint =``;
        }
        if(BooKingInfo.DepInfo == undefined){
            BooKingInfo.DepInfo =``;
        }
        if(BooKingInfo.RetPoint == undefined){
            BooKingInfo.RetPoint =``;
        }
        if(BooKingInfo.RetInfo == undefined){
            BooKingInfo.RetInfo =``;
        }
        if(BooKingInfo.DepExtraInfo == undefined){
            BooKingInfo.DepExtraInfo =``;
        }
        if(BooKingInfo.RetExtraInfo == undefined){
            BooKingInfo.RetExtraInfo =``;
        }
     
        let bookingReq = `<?xml version="1.0" encoding="UTF-8"?>
<TCOML version="NEWFORMAT" sess="">
	<TransferOnly>
		<Booking>
			<P2PConfirm>
				<Username>${data.username}</Username>
				<Password>${data.password}</Password>
				<TransacNo>${data.BlockTourId}</TransacNo>
				<ExtrasTransacNo>${data.ExtrasTransacNo}</ExtrasTransacNo>
				<AgentBref>${BooKingInfo.AppReference}</AgentBref>
				<PropertyName> ${BooKingInfo.PropertyName} </PropertyName>
				<AccommodationAddress> ${BooKingInfo.AccommodationAddress}</AccommodationAddress>
				<AccommodationAddress2></AccommodationAddress2>
				<J1_PropertyName>${BooKingInfo.J1_PropertyName}</J1_PropertyName>
				<J1_AccommodationAddress>${BooKingInfo.J1_AccommodationAddress}</J1_AccommodationAddress>
				<J1_AccommodationAddress2></J1_AccommodationAddress2>
				<DepPoint>${BooKingInfo.DepPoint}</DepPoint>
				<RetPoint>${BooKingInfo.RetPoint}</RetPoint>	
                <DepInfo>${BooKingInfo.DepInfo}</DepInfo>
                <RetInfo>${BooKingInfo.RetInfo}</RetInfo>
                <DepExtraInfo>${BooKingInfo.DepExtraInfo}</DepExtraInfo>
                <RetExtraInfo>${BooKingInfo.RetExtraInfo}</RetExtraInfo>			
				<Client>
					<LastName>${parsedPaxData.PassengerDetails[0].LastName}</LastName>
					<FirstName>${parsedPaxData.PassengerDetails[0].FirstName}</FirstName>
					<Title>${parsedPaxData.PassengerDetails[0].Title}</Title>
					<Phone></Phone>
					<Mobile>${parsedPaxData.AddressDetails.Contact}</Mobile>
					<CountryCode>${parsedPaxData.AddressDetails.Country}</CountryCode>
					<Email>${parsedPaxData.AddressDetails.Email}</Email>
				</Client>
				<J1_IATA_Airline></J1_IATA_Airline>
				<J2_IATA_Airline></J2_IATA_Airline>
				<SendEmailToCustomer>0</SendEmailToCustomer>
				<Remark></Remark>
                <WA_Flag>1</WA_Flag>
			</P2PConfirm>
		</Booking>
	</TransferOnly>
</TCOML> 
  `;

//   <DepInfo>EZY6533</DepInfo>
// 				<RetInfo>EZY6534</RetInfo>
// 				<DepExtraInfo>EMIRATES</DepExtraInfo>
// 				<RetExtraInfo>EMIRATES</RetExtraInfo>
    
        
        return bookingReq;
    }

    async bookingResponseFormat(data: any, pax: any, body: any, result: any): Promise<any> {

        // if (result.VoucherInfo.BookingStatus['$t'] == 'Confirmed') 

        let attr =result;
       let inbound_notes:any=``;
       let outbound_notes:any=``;
       let payment_mode = data.payment_mode;
       console.log("data-",payment_mode);
        // Creating a new JSON object
        let bookingDetailsNew = {
          Adult: attr.VoucherInfo.Adults.$t,
          Child: attr.VoucherInfo.Children.$t,
          Infant: attr.VoucherInfo.Infants.$t,
          OutboundTransferDetails: {
            OutboundOrigin: attr.VoucherInfo.OutboundTransferDetails.OutboundOrigin.$t,
            OutboundDestination: attr.VoucherInfo.OutboundTransferDetails.OutboundDestination.$t,
            DepartureInfo: {
              FlightNumber: attr.VoucherInfo.OutboundTransferDetails.DepInfo.$t,
              ArrivalDate: attr.VoucherInfo.OutboundTransferDetails.ArrDate.$t,
              ArrivalTime: await this.convertToAMPM(attr.VoucherInfo?.OutboundTransferDetails?.ArrTime?.$t ?? ""),
              PickupDate: attr.VoucherInfo.OutboundTransferDetails.OutboundPickupDate.$t,
              PickupTime:  await this.convertToAMPM(attr.VoucherInfo?.OutboundTransferDetails?.OutboundPickupTime?.$t ?? ""),
              Vehicle: attr.VoucherInfo.OutboundTransferDetails.Vehicle.$t,
              VehicleImage: attr.VoucherInfo.OutboundTransferDetails.VehicleImage.$t
            }
          },
          ReturnTransferDetails:{},
          PUT: attr.PUT.$t,
          WhatsApp: attr.WhatsApp.$t,
          JoiningInstructions: {
            Outbound: {
              CompanyDetail: {
                Name: attr.VoucherInfo.JoiningInstructionsST.Outbound.CompanyDetail.Name.$t,
                Contact: attr.VoucherInfo.JoiningInstructionsST.Outbound.CompanyDetail.ContactValue.$t,
                EmergencyContact: attr.VoucherInfo.JoiningInstructionsST.Outbound.CompanyDetail.EmergencyContactValue.$t,
                OpeningHours: attr.VoucherInfo.JoiningInstructionsST.Outbound.CompanyDetail.OpeningHours.$t
              },
              Pickup: {
                PickupPoint: attr.VoucherInfo.JoiningInstructionsST.Outbound.Pickup.PickupPoint.$t,
                PickupTime:  await this.convertToAMPM(attr.VoucherInfo?.JoiningInstructionsST?.Outbound?.Pickup?.PickupTime?.$t ?? ""),
                FlightNumber: attr.VoucherInfo.JoiningInstructionsST.Outbound.Pickup.FlightNumber?.$t
              }
            },
            Inbound: { }
          }
        };
        if(attr.VoucherInfo?.JoiningInstructionsST?.Outbound?.Pickup?.Notes != undefined){
        outbound_notes = attr.VoucherInfo.JoiningInstructionsST.Outbound.Pickup.Notes.$t.replace(/\n\n+/g, '</p><p>') // Replace double new lines with paragraph tags
                .replace(/\n/g, '<br>');
        }
        if(attr.VoucherInfo.ReturnTransferDetails){

            bookingDetailsNew.ReturnTransferDetails={
            ReturnOrigin: attr.VoucherInfo.ReturnTransferDetails.ReturnOrigin.$t,
            ReturnDestination: attr.VoucherInfo.ReturnTransferDetails.ReturnDestination.$t,
            ReturnInfo: {
              FlightNumber: attr.VoucherInfo.ReturnTransferDetails.RetInfo.$t,
              ReturnDate: attr.VoucherInfo.ReturnTransferDetails.RetDate.$t,
              ReturnTime:  await this.convertToAMPM(attr.VoucherInfo?.ReturnTransferDetails?.RetTime?.$t ?? ""),
              PickupDate: attr.VoucherInfo.ReturnTransferDetails.ReturnPickupDate.$t,
              PickupTime:  await this.convertToAMPM(attr.VoucherInfo?.ReturnTransferDetails?.ReturnPickupTime?.$t ?? ""),
              Vehicle: attr.VoucherInfo.ReturnTransferDetails.Vehicle.$t,
              VehicleImage: attr.VoucherInfo.ReturnTransferDetails.VehicleImage.$t
            }
          }

         
        }

        if(attr.VoucherInfo.JoiningInstructionsST.Inbound){
            bookingDetailsNew.JoiningInstructions.Inbound= {
              CompanyDetail: {
                Name: attr.VoucherInfo.JoiningInstructionsST.Inbound.CompanyDetail.Name.$t,
                Contact: attr.VoucherInfo.JoiningInstructionsST.Inbound.CompanyDetail.ContactValue.$t,
                EmergencyContact: attr.VoucherInfo.JoiningInstructionsST.Inbound.CompanyDetail.EmergencyContactValue.$t,
                OpeningHours: attr.VoucherInfo.JoiningInstructionsST.Inbound.CompanyDetail.OpeningHours.$t
              },
              Pickup: {
                PickupPoint: attr.VoucherInfo.JoiningInstructionsST.Inbound.Pickup.PickupPoint.$t,
                PickupTime:  await this.convertToAMPM(attr.VoucherInfo?.JoiningInstructionsST?.Inbound?.Pickup?.PickupTime?.$t ?? ""),
                FlightNumber: attr.VoucherInfo.JoiningInstructionsST.Inbound.Pickup.FlightNumber.$t
              }
            }
            if(attr.VoucherInfo.JoiningInstructionsST.Inbound.Pickup.Notes.$t != undefined){
            inbound_notes = attr.VoucherInfo.JoiningInstructionsST.Inbound.Pickup.Notes.$t.replace(/\n\n+/g, '</p><p>') 
            .replace(/\n/g, '<br>');
            }
          }
          
        if (result?.VoucherInfo?.BookingStatus?.['$t'] === 'Confirmed')
        {
            let BookingStatus = 'BOOKING_CONFIRMED';
            if(payment_mode == 'pay_later'){
                BookingStatus = 'BOOKING_HOLD'
            }
            const response = result.VoucherInfo;    
            const query = `UPDATE transfer_booking_details SET 
        status = "${BookingStatus}",
        booking_details = "${JSON.stringify(bookingDetailsNew).replace(/"/g, "'")}",
        outbound_notes = "${outbound_notes}",
        inbound_notes = "${inbound_notes}",
        booking_reference = "${response.BookingRef['$t']}",
        booking_id = "${response.BookingRef['$t']}",
        confirmation_reference = "${response.BookingRef['$t']}"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query);
            const query1 = `UPDATE transfer_booking_itinerary_details SET 
        status = "${BookingStatus}",
        booking_reference = "${response.BookingRef['$t']}"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE transfer_booking_pax_details SET 
        status = "${BookingStatus}",
        booking_reference = "${response.BookingRef['$t']}"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query2);
        }
        else {
            const query = `UPDATE transfer_booking_details SET 
        status = "BOOKING_FAILED",
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query);
            const query1 = `UPDATE transfer_booking_itinerary_details SET 
        status = "BOOKING_FAILED"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query1);
            const query2 = `UPDATE transfer_booking_pax_details SET 
        status = "BOOKING_FAILED"
        WHERE app_reference = "${body.AppReference}"`;
            await this.manager.query(query2);
        }
        const bookingDetails = await this.getGraphData(
            `query {
                    transferBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
                        payment_mode
                        payment_status
                        convinence_value
                        convinence_value_type
                        convinence_per_pax
                        convinence_amount
                        promo_code
                        discount
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id
                    }
                }
                `,
            "transferBookingDetails"
        );

        const query3 = `select * from transfer_booking_itinerary_details WHERE app_reference = "${body.AppReference}"`;
        const bookingItinerary = await this.manager.query(query3);

        const query4 = `select * from transfer_booking_pax_details WHERE app_reference = "${body.AppReference}"`;
        const paxDetails = await this.manager.query(query4);

        return {
            BookingDetails: bookingDetails[0],
            BookingItineraryDetails: bookingItinerary[0],
            BookingPaxDetails: paxDetails
        }
    }

    async convertToAMPM(time24) {
        // Ensure the input is a string and has a length of 4
        if(time24 != undefined && time24 != "") {
        const timeStr = time24.toString();
        if (timeStr.length !== 4) {
            throw new Error('Time must be in HHMM format');
        }
    
        // Extract hours and minutes
        const hours = parseInt(timeStr.slice(0, 2), 10);
        const minutes = timeStr.slice(2, 4);
        
        // Determine AM/PM and convert hours
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    
        // Format the output
        return `${hours12}:${minutes} ${period}`;
    }else{
        return ``;
    }
    }
    
    async CancellationResponseFormat(data: any, body: any, result: any): Promise<any> {
     
        const Cancellation = await this.getGraphData(
            `mutation {
					createTransferCancellationDetail(
                        transferCancellationDetail: {
                            app_reference: "${body.AppReference}"
                            booking_reference:"${data.booking_reference}"
                            ChangeRequestId: "${result.BookingRef['$t']}"
                            ChangeRequestStatus: "${result.BookingStatus['$t']}"
                            status_description:""
                            API_RefundedAmount : ${result?.APIRefundedAmount ?? null}
                            API_CancellationCharge: "${result?.CancelFees['$t'] ?? null}"
                            cancellation_processed_on: ${result?.cancellationProcessedOn ?? null}
                            refund_amount: 0
                            cancellation_charge: 0
                            refund_status: "INPROGRESS"
                            refund_payment_mode: "offline"
                            refund_comments: "${result?.RefundComments ?? null}"
                            refund_date: "${result?.RefundDate ?? null}"
                            currency : "GBP"
                            currency_conversion_rate : ${data?.CurrencyConversionRate ?? 1}
                            attributes:"${JSON.stringify(result).replace(/"/g, "'")}"
                            created_by_id:${body.UserId}
			        }
					) {
						id
                        app_reference
                        booking_reference
                        ChangeRequestId
                        ChangeRequestStatus
                        status_description
                        API_RefundedAmount
                        API_CancellationCharge
                        cancellation_processed_on
                        refund_amount
                        cancellation_charge
                        refund_status
                        refund_payment_mode
                        refund_comments
                        refund_date
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id 
					}
			  	}
			`,
            "createTransferCancellationDetail"
        );

        const query = `UPDATE transfer_booking_details SET 
        status = "BOOKING_CANCELLED"
        WHERE app_reference = "${body.AppReference}"`;
        await this.manager.query(query);
        const query1 = `UPDATE transfer_booking_itinerary_details SET 
        status = "BOOKING_CANCELLED"
        WHERE app_reference = "${body.AppReference}"`;
        await this.manager.query(query1);
        const query2 = `UPDATE transfer_booking_pax_details SET 
        status = "BOOKING_CANCELLED"
        WHERE app_reference = "${body.AppReference}"`;
        await this.manager.query(query2);

        const bookingDetails = await this.getGraphData(
            `query {
                    transferBookingDetails (
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        id
                        domain_origin
                        status
                        app_reference
                        booking_source
                        booking_id
                        booking_reference
                        confirmation_reference
                        product_name
                        star_rating
                        product_code
                        grade_code
                        grade_desc
                        phone_code
                        phone_number
                        alternate_number
                        email
                        travel_date
                        payment_mode
                        convinence_value
                        convinence_value_type
                        convinence_per_pax
                        convinence_amount
                        promo_code
                        discount
                        currency
                        currency_conversion_rate
                        attributes
                        created_by_id
                    }
                }
                `,
            "transferBookingDetails"
        );

        const query3 = `select * from transfer_booking_itinerary_details WHERE app_reference = "${body.AppReference}"`;
        const bookingItinerary = await this.manager.query(query3);

        const query4 = `select * from transfer_booking_pax_details WHERE app_reference = "${body.AppReference}"`;
        const paxDetails = await this.manager.query(query4);

        return {
            BookingDetails: bookingDetails[0],
            BookingItineraryDetails: bookingItinerary[0],
            BookingPaxDetails: paxDetails,
            CancellationDetails: Cancellation[0]
        }
    }

    async transformBookingFormat(body: any) {
        const transferBooking = await this.getGraphData(
            `query {
                                transferBookingDetails (
                                    where: {
                                        app_reference: {
                                            eq: "${body.AppReference}"
                                        }
                                    }
                                ) {
                                    attributes
                                }
                            }
                            `,
            "transferBookingDetails"
        );
        let parsedBookingData: any = JSON.parse(transferBooking?.[0]?.attributes.replace(/'/g, '"'));

        const transferPaxDetails = await this.getGraphData(
            `query {
                    transferBookingPaxDetails(
                        where: {
                            app_reference: {
                                eq: "${body.AppReference}"
                            }
                        }
                    ) {
                        title
                        first_name
                        middle_name
                        last_name
                        phone
                        email
                        pax_type
                        age
                        date_of_birth
                        status
                        attributes
                    }
                }
                `,
            "transferBookingPaxDetails"
        );

        const { title, first_name, last_name, email, phone } = transferPaxDetails[0]
        let bookingFormat = {
            "language": "en",
            "holder": {
                title: title,
                name: first_name,
                surname: last_name,
                email: email,
                phone: phone
            },
            "transfers": [
                {
                    "rateKey": parsedBookingData.rateKey,
                    "transferDetails": [
                        {
                            "code": "IB2588",
                            "companyName": "Ibirria",
                            "direction": "ARRIVAL",
                            "type": "FLIGHT"
                        }
                    ]
                }
            ],
            "clientReference": "IntegrationAgency",
            "remark": "Booking remarks"
        }

        return bookingFormat;
    }

}