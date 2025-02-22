
import { Url, TMX_HOTEL_BOOKING_SOURCE, TMX_USER_NAME, TMX_PASSWORD, TMX_DOMAINKEY, TMX_SYSTEM, TBOH_USERNAME, TBOH_PASSWORD } from "apps/webservice/src/constants";
import { HttpException, HttpService, Injectable, Logger } from "@nestjs/common";
import { RedisServerService } from "apps/webservice/src/shared/redis-server.service";
import { formatDate, getPropValue, noOfNights } from "../../../app.helper";
import { getExceptionClassByCode } from "../../../all-exception.filter";
import { HOTELBEDS_URL, STUBA_HOTEL_BOOKING_SOURCE, logStoragePath, GIATA_IMAGE_BASE_URL, BASE_CURRENCY, STUBA_URL, STUBA_CURRENCY, STUBA_ORG, STUBA_PWD, STUBA_USER } from "../../../constants";
import { HotelApi } from "../../hotel.api";
import { HotelDbService } from "../hotel-db.service";
import { HotelBedsTransformService } from "./hotelbeds-transform.service";
import { HotelTboTransformService } from './tboHolidays-transform.Service';
// import * as moment from "moment";
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { error } from "console";
import { HotelStubaTransformService } from "./stuba-tranform.service";
// const crypto = require('crypto');
const fs = require('fs')

@Injectable()
export class stubaDotComService extends HotelApi {

  apiCred: any;
  apiCredCached: boolean = false;

  constructor(
    private readonly httpService: HttpService,
    private hotelDbService: HotelDbService,
    private HotelStubaTransformService: HotelStubaTransformService,
    private redisServerService: RedisServerService) {
    super()
  }

  throwSoapError(jsonResponse: any) {
    if (getPropValue(jsonResponse, 'Header.OperationType') == 'Error') {
      throw new HttpException(getPropValue(jsonResponse, 'Main.Error.Message'), 400);
    }
  }


  async formatRooms(rooms, body, USD_to_GBP, Conversion_Rate, markup) {
    let roomDetails = [];
    let totalRoomPrice = 0;
    let totalRooms = 0;
    const cancelCapDays = await this.hotelDbService.getCanelCappingDays('hotel')

      if (!Array.isArray(rooms)) {
        rooms= [rooms];
      }
    if (rooms && rooms.length) {
      await Promise.all(rooms.map(async (roomdata) => {

        if (!Array.isArray(roomdata.Room)) {
          roomdata.Room= [roomdata.Room];
        }
        await Promise.all(roomdata.Room.map(async (room, index) => {
          let roomNum = index + 1;
          let adult_count = body.RoomGuests[index]?.NoOfAdults || 0;
          let child_count = body.RoomGuests[index]?.NoOfChild || 0;
          let RoomPrice = Number(room.Price?.amt) || 0;

          let roomsPrice: any = {
            net: RoomPrice,
            RoomMarkup: {
              AdminMarkup: 0,
              AgentMarkup: 0,
            },
          };

          roomsPrice['net'] = roomsPrice['net'] / USD_to_GBP;
          roomsPrice['net'] = roomsPrice['net'] * Conversion_Rate;
          let markupDetails = await this.hotelDbService.markupDetails(markup, roomsPrice['net']);

          if (body.UserType == "B2B") {
            roomsPrice.RoomMarkup.AdminMarkup = parseFloat(markupDetails.AdminMarkup);
            roomsPrice.RoomMarkup.AgentMarkup = parseFloat(markupDetails.AgentMarkup);

            roomsPrice.net = (roomsPrice.net + markupDetails.AdminMarkup + markupDetails.AgentMarkup).toFixed(2);
            roomsPrice.AgentNetFare = Number((roomsPrice.net - markupDetails.AgentMarkup).toFixed(2));
          } else if (body.UserType == "B2C") {
            roomsPrice.RoomMarkup.AdminMarkup = parseFloat(markupDetails.AdminMarkup);
            roomsPrice.RoomMarkup.AgentMarkup = Number((roomsPrice.net + markupDetails.AdminMarkup).toFixed(2));
          }

          roomsPrice.net = parseFloat(roomsPrice.net ?? 0);
          totalRoomPrice += roomsPrice.net;
          totalRooms += 1;


          if (!roomDetails[index]) {
            roomDetails[index] = [
              {
                code: '',
                name: '',
                rate: [],
              },
            ];
          }
         
          let checkInDate =new Date(body.CheckIn);
            let todayDate = new Date();
            let newDate_Time = checkInDate.setDate(checkInDate.getDate() - cancelCapDays[0].days);

          let CancelationPolicyStatus  = ''
          let CancelationPolicy  = ''
          let cancelDeadline:any = '';
          let APICancelDealine:any = '';
          if(room?.CancellationPolicyStatus?.['$t'] == "Unknown" || todayDate.getTime()  < newDate_Time){
            CancelationPolicyStatus =  "NonRefundable"
          }else{
            CancelationPolicyStatus = room?.CancellationPolicyStatus?.['$t']
          }
          console.log("room.CancelPolicy.From-",room.CancelPolicy.From);
          if(room.CancelPolicy && room.CancelPolicy.From){
            APICancelDealine =new Date(room.CancelPolicy.From);
            
            console.log("APICancelDealine-",APICancelDealine);
            let timeStamp = new Date(room.CancelPolicy.From);
            timeStamp.setDate(timeStamp.getDate() - cancelCapDays[0].days);
            const date = new Date(timeStamp);
console.log("cancelCapDays_days",cancelCapDays[0].days);
// Extract the year, month, and day
const year = date.getFullYear();
const month = (date.getMonth() + 1).toString().padStart(2, '0');  // Months are zero-based, so add 1
const day = date.getDate().toString().padStart(2, '0');

// Format the date as yyyy-mm-dd
cancelDeadline = `${year}-${month}-${day}`;
            console.log("cancelDealine-",cancelDeadline);
           
            CancelationPolicy = `Cancellation chargable From ${cancelDeadline}`
          }
          roomDetails[index][0].rate.push({
            name: room.RoomType?.text ?? '',
            rateKey: roomdata?.id ?? '',
            rateClass: "",
            rateType: "",
            net: roomsPrice,
            allotment: '',
            paymentType: "",
            packaging: false,
            boardCode: '',
            OrginaRoomlPrice : RoomPrice ? RoomPrice : '' ,
            RoomType: room?.MealType?.text ?? "",
            NonRefundable: room?.CancellationPolicyStatus?.['$t'] == 'Refundable' ? false : true,
            boardName: '',
            cancellationPolicies: CancelationPolicy ? CancelationPolicy : "",
            cancellationDeadline: cancelDeadline,
            APICancellationDeadline : APICancelDealine,
            rooms: roomNum,
            adults: adult_count ?? '',
            children: child_count ?? '',
            offers: "",
          });
        })
        );
      })
      );
    }

    let averageRoomPrice = totalRooms > 0 ? (totalRoomPrice / totalRooms).toFixed(2) : 0;

    return { roomDetails, averageRoomPrice };
  }


  calculateAge(dateOfBirth) {
    const birthDate = new Date(parseInt(dateOfBirth, 10));
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }


   formatDate = (date) => {
    const [year, month, day] = date.split("-");
    return `${day}-${month}-${year}`;
  };
  


  async search(body: any): Promise<any> {
    try {
      const generateAdults = (num) => {
        let adults = '';
        for (let i = 0; i < num; i++) {
          adults += '<Adult />';
        }
        return adults;
      };

      body.CheckIn = new Date(body.CheckIn).toISOString().split('T')[0];
      body.CheckOut = new Date(body.CheckOut).toISOString().split('T')[0];

      const generateRooms = (roomGuests) => {
        if (!roomGuests || roomGuests.length === 0) return '';
        return roomGuests.map(roomGuest => {
          const adults = generateAdults(roomGuest.NoOfAdults || 0);
          const children = (roomGuest.ChildAge || []).map(age => `<Child age="${age}" />`).join('');
          return `<Room>
                  <Guests>
                    ${adults}
                    ${children}
                  </Guests>
                </Room>`;
        }).join('');
      };

      var hotelcode = await this.hotelDbService.getHotelIdsByGiataId(body?.CityIds?.[0] ?? null, STUBA_HOTEL_BOOKING_SOURCE);
      
      if (!hotelcode || hotelcode.length === 0) {
        throw new Error(`400 No Hotel Found`);
      }

      let xmlData = `<?xml version="1.0" encoding="utf-8"?>
      <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <AvailabilitySearch xmlns="http://www.reservwire.com/namespace/WebServices/Xml">
            <xiRequest>
              <Authority>
                <Org>${STUBA_ORG}</Org>
                <User>${STUBA_USER}</User>
                <Password>${STUBA_PWD}</Password>
                <Currency>${STUBA_CURRENCY}</Currency>
                <Version>1.28</Version>
              </Authority>
              <Hotels>`;

      hotelcode.forEach(code => {
        xmlData += `<Id>${code}</Id>`;
      });

      xmlData += `</Hotels>
              <HotelStayDetails>
                <ArrivalDate>${body?.CheckIn ?? ''}</ArrivalDate>
                <Nights>${body?.NoOfNights ?? 0}</Nights>
                <Nationality>GB</Nationality>
                ${generateRooms(body?.RoomGuests ?? [])}
              </HotelStayDetails>
              <DetailLevel>basic</DetailLevel>
              <MaxResultsPerHotel>0</MaxResultsPerHotel>
              <MaxHotels>0</MaxHotels>
              <MaxSearchTime>0</MaxSearchTime>
              <CanxFees>true</CanxFees>
            </xiRequest>
          </AvailabilitySearch>
        </soap:Body>
      </soap:Envelope>`;
      ;

      const response: any = await this.httpService.post(STUBA_URL, xmlData, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.reservwire.com/namespace/WebServices/Xml/AvailabilitySearch'
        }
      }).toPromise();

      if (!response) {
        throw new Error('Response is undefined or null');
      }

      fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/SearchRQ.xml`, xmlData);
      fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/SearchRS.xml`, response);

      const valuationResp = await this.xmlToJson(response);

      let HotelResult = valuationResp?.["soap:Envelope"]?.["soap:Body"]?.["AvailabilitySearchResponse"]?.["AvailabilitySearchResult"] ?? '';
      if (!HotelResult || !HotelResult["HotelAvailability"]) {
        throw new Error(`400 HotelResult is null for this City`);
      }

  
      let hotel_code: any = [];
      let hideHotelList: any = [];
      for (let index = 0; index < HotelResult["HotelAvailability"].length; index++) {
        const hotel = HotelResult["HotelAvailability"][index];
        hotel_code.push(hotel.Hotel.id);
      }
      // let hotelGiataId = await this.hotelDbService.hotelGiataId(hotel_code, STUBA_HOTEL_BOOKING_SOURCE);
      ;

      let markup: any;
      if (body['UserType']) {
        if (body['UserId'] == undefined) {
          body['UserId'] = 0;
        }
        markup = await this.hotelDbService.getMarkup(body)
        // markup = await this.hotelDbService.getMarkupDetails(body['UserType'], body['UserId'],body);

      }
      let currencyDetails;
      let USD_to_GBP = 1;
      let Conversion_Rate = 1;

      if (HotelResult?.Currency['$t'] && HotelResult?.Currency['$t'] != BASE_CURRENCY && HotelResult?.Currency['$t'] != body.Currency) {
        currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(HotelResult?.Currency['$t']);
        USD_to_GBP = currencyDetails['value'] ?? 1;
      }

      if (body?.Currency != BASE_CURRENCY && body.Currency != HotelResult?.Currency['$t']) {
        currencyDetails = await this.hotelDbService.formatPriceDetailToSelectedCurrency(body.Currency);
        Conversion_Rate = currencyDetails['value'] ?? 1;
      }

      const hotelDetailsQuery = `SELECT roomsxml,giata_code, hotel_name , address, email, star_rating, images, phone_number, trip_adv_rating, country_code ,country_name, city_name, city_code, destination_name FROM giata_property_data WHERE roomsxml IN (${hotel_code.map(code => `'${code}'`).join(', ')})`;
      let hotelDetailsResults = await this.manager.query(hotelDetailsQuery);
 
      body.CheckIn =  this.formatDate(body.CheckIn)
      body.CheckOut = this.formatDate(body.CheckOut)

      let dataFormat: any = await Promise.all((HotelResult["HotelAvailability"] || []).map(async (hotel) => {
        try {
          let hotelDetails = hotelDetailsResults.find(detail => detail.roomsxml == hotel?.Hotel?.id);
          if (!hotelDetails) {
            return null;
          }
          // hotelDetails = hotelDetails[0];

          hotelDetails.GiataCode = hotelDetails.giata_code;
          // hotelDetails.GiataCode = hotelGiataId[hotelDetails.roomsxml].giata_code;

          // let coordinates;
          // if (hotelDetails.location) {
          //   try {
          //     coordinates = JSON.parse(hotelDetails.location);
          //   } catch (e) {
          //     coordinates = { Latitude: '', Longitude: '' };
          //   }
          // }

          // let hotelPicture = hotelDetails.other_images ? JSON.parse(hotelDetails.images) : [];
          // hotelPicture = (hotelPicture.length > 0) ? `https://booking247.stuba.com${hotelPicture[0].images_url}` : '';

          let totalAmount = 0;
          let roomCount = 0;

          const roomResults = Array.isArray(hotel.Result) ? hotel.Result : [hotel.Result];

          let roomPrice = 0
          // roomResults.forEach((rooms) => {
            if (!Array.isArray(roomResults[0].Room)) {
              roomResults[0].Room = [roomResults[0].Room];
            }
            roomResults[0].Room.forEach((room) => {
              let price = parseFloat(room?.Price?.amt ?? 0);
              roomPrice += price
              // if (price < roomPrice) {
              //   roomPrice = price
              // }
              // totalAmount += isNaN(price) ? 0 : price;
              roomCount++;
            });
;
console.log(roomPrice , '=======================>>>>>>>>>>>>>>>.');

          let avgPrice = roomPrice > 0 ? roomPrice : null;
          avgPrice = avgPrice / USD_to_GBP
          avgPrice = avgPrice * Conversion_Rate

          let HotelAmenitiesArr = [];

          // if (hotelDetails.hotel_faci) {
          //   try {
          //     const amenities = JSON.parse(hotelDetails.hotel_faci);
          //     HotelAmenitiesArr = Array.isArray(amenities) ? amenities.map(a => a.Text) : [];
          //   } catch (error) {
          //     console.error("Error parsing hotel amenities:", error);
          //   }
          // }

       
          let hotel_picture = []
          if (hotelDetails?.images) {
            let hotel_images = JSON.parse(hotelDetails.images);
            hotel_images.forEach((image) => {
              let picture_url = `https://photos.hotelbeds.com/giata/${image.path}`
              hotel_picture.push(picture_url)
            })
          }

          let hotelEmail = JSON.parse(hotelDetails.email)

          let address = hotelDetails.address ? JSON.parse(hotelDetails.address) : ''

          let hotelAddress = ``;
          if(address && address.addressLine_1 != undefined && address.addressLine_1 != undefined ){
          hotelAddress = address.addressLine_1+`, `+address.addressLine_2;
          if (address.cityName != undefined && !hotelAddress.includes(address.cityName)) {
              hotelAddress += `, `+address.cityName;
            }
          }

          let data = {
            HotelCode: hotelDetails?.roomsxml ?? '',
            GiataCode: hotelDetails?.GiataCode,
            HotelName: hotelDetails?.hotel_name ?? '',
            HotelCategory: "",
            StarRating: hotelDetails?.star_rating ?? '',
            // HotelDescription: hotelDetails?.hotel_desc ?? '',
            HotelPromotion: "",
            HotelPolicy: [],
            Price: { Amount: parseFloat(avgPrice.toFixed(2)), Currency: body?.Currency ?? '', Commission: '', Markup: {}, },
            HotelPicture: hotel_picture && hotel_picture.length ? hotel_picture[0] : '',
            // HotelDetailsPicture : hotel_picture && hotel_picture.length ? hotel_picture : [] ,
            HotelAddress: hotelAddress ? hotelAddress : '',
            HotelContactNo: "",
            // HotelAmenities: hotelDetails.hotel_faci ? JSON.parse(hotelDetails.hotel_faci) : [],
            Latitude: hotelDetails?.latitude ?? '',
            Longitude: hotelDetails?.longitude ?? '',
            Breakfast: '',
            // HotelLocation: hotelDetails.location ? JSON.parse(hotelDetails.location) : '',
            SupplierPrice: "",
            OrginalHotelCode: "",
            HotelPromotionContent: "",
            PhoneNumber: hotelDetails.phone_number ? JSON.parse(hotelDetails.phone_number) : {},
            Free_cancel_date: "",
            trip_adv_url: hotelDetails?.trip_adv_rating ?? '',
            trip_rating: "",
            NoOfRoomsAvailableAtThisPrice: "",
            Refundable: "",
            // alternativeNames: hotelDetails.alternativeNames ? JSON.parse(hotelDetails.alternativeNames) : {},
            HotelCurrencyCode: "USD",
            Email: hotelEmail && hotelEmail.length ? hotelEmail : '',
            CountryCode: hotelDetails?.country_code ?? '',
            CountryName: hotelDetails?.country_name ?? '',
            CityName: hotelDetails?.city_name ?? '',
            CityCode: hotelDetails?.city_code ?? '',
            DestinationName: hotelDetails?.destination_name ?? '',
            NoOfReviews: "",
            ReviewScore: "",
            ReviewScoreWord: "",
            checkIn:body.CheckIn ?? '',
            checkOut: body?.CheckOut?? '',
            Source: "StubaHotel",
            ResultToken: ''
          };

          let markupDetails = await this.hotelDbService.markupDetails(markup, data['Price']['Amount']);
          if (body.UserType == "B2B") {
            data['Price']['Markup']['AdminMarkup'] = parseFloat(markupDetails.AdminMarkup);
            data['Price']['Markup']['AgentMarkup'] = parseFloat(markupDetails.AgentMarkup);
            let totalPrice = (data['Price']['Amount'] + markupDetails.AdminMarkup + markupDetails.AgentMarkup).toFixed(2);
            data['Price']['Amount'] = parseFloat(totalPrice)
            data['Price']['AgentNetFare'] = (Number((data['Price']['Amount'] - markupDetails.AgentMarkup).toFixed(2)));
          } else if (body.UserType == "B2C") {
            data['Price']['Markup']['AdminMarkup'] = parseFloat(markupDetails.AdminMarkup);
            data['Price']['Amount'] = Number((data['Price']['Amount'] + markupDetails.AdminMarkup).toFixed(2))
          }


          let { roomDetails } = await this.formatRooms(hotel.Result, body, USD_to_GBP, Conversion_Rate, markup);
          return {
            ...data,
            roomDetails,
            searchRequest: body,
            booking_source: body.booking_source,
            ResultToken: data["ResultToken"]
          };
        } catch (err) {
          console.error(`Error processing hotel with id ${hotel?.Hotel?.id}:`, err);
          return null;
        }
      }));

      dataFormat = dataFormat.filter(item => item !== null);

      if (!dataFormat.length) {
        return [];
      }

      const token = this.redisServerService.geneateResultToken(body);

      const duplicatHotelListData = await this.redisServerService.read_list(body.DeDuToken);

      const duplicatHotelList = JSON.parse(duplicatHotelListData);


      const resultData = await Promise.all(
        dataFormat.map(async (x: any) => {
          if (duplicatHotelList[x['GiataCode']] != undefined) {

            if (x['Price']['Amount'] < duplicatHotelList[x['GiataCode']].price) {
              console.log("current_hotel_GiataCode-", x['GiataCode']);
              console.log("current_hotel_price-", x['Price']['Amount']);
              console.log("duplicat-", duplicatHotelList[x['GiataCode']]);
              if (duplicatHotelList[x['GiataCode']].uniqueHotelId) {
                duplicatHotelList[x['GiataCode']].price = x['Price']['Amount'];
                duplicatHotelList[x['GiataCode']].API = 'Stuba_ls_Hotelbeds';
                x.uniqueHotelId = duplicatHotelList[x['GiataCode']].uniqueHotelId = duplicatHotelList.uniqueHotelId++;
                hideHotelList.push(duplicatHotelList[x['GiataCode']].uniqueHotelId)
              } else {
                duplicatHotelList[x['GiataCode']].price = x['Price']['Amount'];
                x.uniqueHotelId = duplicatHotelList[x['GiataCode']].uniqueHotelId = duplicatHotelList.uniqueHotelId++;
                duplicatHotelList[x['GiataCode']].API = 'Stuba';
              }
            } else {
              return null;
            }
          }
          const response = await this.redisServerService.insert_record(token, JSON.stringify(x));
          delete x["ResultToken"];
          return { ...x, ResultIndex: response["access_key"] };
        })
      );
      const resultWithoutNulls = resultData.filter(item => item !== null);
      const DeToken = this.redisServerService.geneateResultToken(body.searchId);

      const duplicatHotelListNew = await this.redisServerService.insert_record(DeToken, JSON.stringify(duplicatHotelList));

      resultWithoutNulls['DeDuToken'] = duplicatHotelListNew["access_key"];
      resultWithoutNulls['HideList'] = hideHotelList;
      // return resultWithoutNulls.length > 0 ? resultWithoutNulls : [];
      return resultWithoutNulls;

    } catch (error) {
      console.error('Error occurred in search:', error);
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }


  async getHotelDetails(body: any): Promise<any> {
    try {
      if (body.ResultToken) {
        let data = await this.redisServerService.read_list(body.ResultToken);
        data = JSON.parse(data[0]);
        let token = data["ResultToken"];


        let room1 = data.searchRequest.RoomGuests[0];
        let room1_pax = room1.NoOfAdults + "_" + room1.NoOfChild;

        let currencyDetails: any;
        let conversionRate = 1;


        let hotelImages = await this.hotelDbService.GetHotelImages(data.GiataCode);
            let hotelFacility = await this.hotelDbService.GetHotelFacilitiesGiata(data.GiataCode)

            let hotelFacilityDescription: any = []; 
            if(hotelFacility[0] && hotelFacility[0].hotel_fac){
             let fac = JSON.parse(hotelFacility[0].hotel_fac);
             fac.forEach(FacilityElement => {

             hotelFacilityDescription.push(FacilityElement.replace(/^facility_/, ''));
            });
         }


        let galleryImages = [];
        let roomImages= [];
        if(hotelImages[0] != undefined && hotelImages[0].images != undefined){
        let gallery = JSON.parse(hotelImages[0].images);
         
      
        gallery.forEach(element => {
            if(element.roomCode == undefined){
                let hImages = `https://photos.hotelbeds.com/giata/`+element.path;
                galleryImages.push(hImages);
                
              }else{
                let hImages = `https://photos.hotelbeds.com/giata/`+element.path;
                roomImages[element.roomCode]=hImages;
              }
              
            });
          }
         

       
        if (Object.keys(data).length) {
          // let hotelPicture = await this.manager.query(`select other_images from stuba_hotel_static_data where hotel_id = "${data?.HotelCode}"`);
          // hotelPicture = hotelPicture[0]
          //  hotelPicture = hotelPicture.other_images ? JSON.parse(hotelPicture.other_images) : [];
          // if(hotelPicture && hotelPicture.length){
          //   hotelPicture.map((picture)=>{
          //    picArr.push(`https://booking247.stuba.com${picture.images_url}`)
          //   })

          //   // hotelPicture = `https://booking247.stuba.com${hotelPicture.images_url}`
          // }

        
          

          let dataFormat = {
            ResultIndex: data?.ResultIndex ?? 0,
            HotelCode: data?.HotelCode ?? null,
            HotelName: data?.HotelName ?? "",
            HotelCategory: data.HotelCategory ? data.HotelCategory : "",
            StarRating: data?.StarRating ?? "",
            HotelDescription: hotelImages && hotelImages.length ? hotelImages[0].hotel_desc :  "",
            HotelPromotion: data.HotelPromotionContent ? data.HotelPromotionContent : "",
            HotelPolicy: data?.HotelPolicy ?? [],
            Price: data?.Price ?? {},
            HotelPicture: galleryImages  && galleryImages.length ? galleryImages : [],
            HotelAddress: data?.HotelAddress ?? "",
            HotelContactNo: data?.HotelContactNo ?? "",
            HotelMap: data?.HotelMap ?? null,
            Latitude: data?.Latitude ?? "",
            Longitude: data?.Longitude ?? "",
            Breakfast: data?.Breakfast ?? "",
            HotelLocation: data?.HotelLocation ?? null,
            SupplierPrice: data?.SupplierPrice ?? null,
            HotelAmenities: hotelFacilityDescription && hotelFacilityDescription.length ?  hotelFacilityDescription :  [],
            OrginalHotelCode: data?.HotelCode ?? "",
            Free_cancel_date: data?.Free_cancel_date ?? "",
            trip_adv_url: data?.trip_adv_url ?? "",
            trip_rating: data?.trip_rating ?? "",
            NoOfRoomsAvailableAtThisPrice: data?.NoOfRoomsAvailableAtThisPrice ?? "",
            Refundable: data?.Refundable ?? "",
            HotelCurrencyCode: data?.CurrencyCode ?? "",
            NoOfReviews: data.NoOfReviews ? data.NoOfReviews : "",
            ReviewScore: data?.ReviewScore ?? "",
            PhoneNumber: data?.PhoneNumber ?? "",
            ReviewScoreWord: data?.ReviewScoreWord ?? "",
            CheckIn: data?.checkIn ?? "",
            CheckOut: data?.checkOut ?? "",
            Source: data?.Source ?? "",
            searchRequest: data?.searchRequest ?? '',
            booking_source: body.booking_source,
            HotelPromotionContent: data?.HotelPromotionContent ?? "",
          };

          const roomDetails = [];

          if (data?.roomDetails) {
            for (const roomData of data.roomDetails) {
              let roomGroup = [];

              await Promise.all(roomData.map(async (obj) => {
                await Promise.all(obj.rate.map(async (e) => {
                  // let price = conversionRate * e.net;
                             


                  // if (markup.value_type == 'plus' && e.adults + "_" + e.children == room1_pax) {
                  //     markupvalue = markup['value'];
                  //     price += markup['value'];
                  // } else {
                  //     let percentVal = (price * markup['value']) / 100;
                  //     markupvalue = percentVal;
                  //     price += percentVal;
                  // }


                  let roomData = {
                    AgencyToken: obj.AgencyToken || "",
                    Rooms: [{
                      Index: '',
                      Price: e.net ? [{ FromDate: data?.checkIn ?? "", ToDate: data?.checkOut ?? "", Amount: e.net.net, Currency: data.Price?.Currency ?? "", markup: e?.net?.RoomMarkup ?? {} }] : [],
                      Id: e?.rateKey || '',
                      Description: e?.name ?? "",
                      RoomType: e?.RoomType ?? '',
                      OrginaRoomlPrice : e?.OrginaRoomlPrice ?? '' ,
                      NonRefundable: e?.NonRefundable ?? null,
                      MealPlanCode: e?.RoomType ?? '',
                      Occupacy: obj?.Occupacy || null,
                      cancellationPolicies: e.cancellationPolicies ? e.cancellationPolicies : '',
                      cancellationDeadline: e.cancellationDeadline ? e.cancellationDeadline : '',
                      APICancellationDeadline:e.APICancellationDeadline ? e.APICancellationDeadline : '',
                      paxCount: '',
                      AdultCount: e?.adults || null,
                      ChildrenCount: e?.children[0] || 0,
                      Rooms: e.rooms,
                      Supplements: e?.Supplements ?? []
                    }],
                    ResultIndex: "",
                    RoomUniqueId: obj.RoomUniqueId || "",
                  };

                  roomGroup.push(roomData);
                  const token = this.redisServerService.geneateResultToken(body)
                  const response = await this.redisServerService.insert_record(token, JSON.stringify(roomData))
                  roomData.Rooms[0].Index = response.access_key;
                  roomData.ResultIndex = body.ResultToken;

                }));

              }));

              roomDetails.push(roomGroup);
            }
          }

          dataFormat["RoomDetails"] = roomDetails;
          dataFormat = {
            ...dataFormat,
            "ResultIndex": ''
          };

          return dataFormat;
        } else {
          const errorClass: any = getExceptionClassByCode(`400 ${'ERROR'}`);
          throw new errorClass(`400 ${'ERROR +++>'}`);
        }
      } else {
        const errorClass: any = getExceptionClassByCode(`400 ResultToken not found!!`);
        throw new errorClass(`400 ResultToken not found!!`);
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error);
      throw new errorClass(error);
    }
  }

  async hotelsValuation(body: any): Promise<any> {
    try {
      let roomListData = await this.redisServerService.read_list(body.ResultToken[0]);
      roomListData = JSON.parse(roomListData[0]);

      let totalRoomPrice : any = 0
      let RoomDetailsArr = []
      await Promise.all(body.BlockRoomId.map(async (RoomResultToken) => {
        let roomDetailsData = await this.redisServerService.read_list(RoomResultToken);
        roomDetailsData = JSON.parse(roomDetailsData)
        await Promise.all(roomDetailsData.Rooms.map(async (room) => {
          room.Price[0].Amount = parseFloat(room.Price[0].Amount)
          totalRoomPrice = totalRoomPrice + room.Price[0].Amount
          try {
            let roomDetails = {
              Price: room?.Price ?? [],
              Index: 0,
              Id: room?.Id ?? '',
              Description: room?.Description ?? '',
              NonRefundable: room?.NonRefundable ?? '',
              MealPlanCode: room?.MealPlanCode ?? '',
              OrginaRoomlPrice : room?.OrginaRoomlPrice ?? '' ,
              Occupancy: room?.Occupacy ?? '',
              cancellationPolicies: room?.cancellationPolicies ?? '',
              cancellationDeadline: room?.cancellationDeadline ?? '',
              APICancellationDeadline : room?.APICancellationDeadline ?? '',
              paxCount: room?.paxCount ?? '',
              AdultCount: room?.AdultCount ?? '',
              ChildrenCount: Number(room.ChildrenCount),
              Rooms: room?.Rooms ?? '',
              Supplements: room?.Supplements ?? []
            };
            RoomDetailsArr.push(roomDetails)

          } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
          }
        }));
      }));

      let dataFormat = {
        ResultIndex: "",
        HotelCode: roomListData?.HotelCode ?? "",
        HotelName: roomListData?.HotelName ?? "",
        HotelCategory: roomListData?.HotelCategory ?? "",
        StarRating: roomListData?.StarRating ?? "",
        HotelDescription: roomListData.HotelDescription ? roomListData.HotelDescription.replace(/\^/g, "'") : "",
        HotelPromotion: roomListData?.HotelPromotion ?? "",
        HotelPolicy: roomListData?.HotelPolicy ?? "",
        Price: roomListData?.Price ?? "",
        HotelPicture: roomListData?.HotelPicture && roomListData?.HotelPicture.length ? roomListData?.HotelPicture : "",
        HotelAddress: roomListData?.HotelAddress ?? "",
        HotelContactNo: roomListData?.HotelContactNo ?? "",
        HotelMap: roomListData?.HotelMap ?? "",
        Latitude: roomListData?.Latitude ?? "",
        Longitude: roomListData?.Longitude ?? "",
        Breakfast: roomListData?.Breakfast ?? "",
        HotelLocation: roomListData?.SupplierPrice ?? null,
        SupplierPrice: roomListData?.SupplierPrice ?? null,
        RoomDetails: RoomDetailsArr,
        OrginalHotelCode: roomListData?.OrginalHotelCode ?? "",
        HotelPromotionContent: roomListData?.HotelPromotionContent ?? "",
        PhoneNumber: roomListData?.PhoneNumber ?? "",
        HotelAmenities: roomListData?.HotelAmenities ?? "",
        Free_cancel_date: roomListData?.Free_cancel_date ?? "",
        trip_adv_url: roomListData?.trip_adv_url ?? "",
        trip_rating: roomListData?.trip_rating ?? "",
        NoOfRoomsAvailableAtThisPrice: roomListData?.NoOfRoomsAvailableAtThisPrice ?? "",
        Refundable: roomListData?.Refundable ?? "",
        HotelCurrencyCode: roomListData.Price?.Currency ?? "",
        NoOfReviews: roomListData?.NoOfReviews ?? "",
        ReviewScore: roomListData?.ReviewScore ?? "",
        ReviewScoreWord: roomListData?.ReviewScoreWord ?? "",
        CheckIn: roomListData?.checkIn ?? "",
        CheckOut: roomListData?.checkOut ?? "",
        Source: roomListData?.Source ?? "",
        searchRequest: roomListData?.searchRequest ?? {},
        NoOfRooms: roomListData.searchRequest?.NoOfRooms ?? '',
        RoomGuests: roomListData?.searchRequest.RoomGuests ?? [],
        booking_source: body.booking_source,
        ResultToken: roomListData.ResultToken
      };


      dataFormat.Price = {
        Amount: parseFloat(totalRoomPrice.toFixed(2)), 
        Currency: roomListData?.Price?.Currency,
        Commission: "",
      };
      

      const token = this.redisServerService.geneateResultToken(body);
      const dataFormatResponse = await this.redisServerService.insert_record(token, JSON.stringify(dataFormat));
      delete dataFormat["BlockRoomId"];
      delete dataFormat["ResultToken"];
      dataFormat = {
        ...dataFormat,
        "ResultToken": dataFormatResponse["access_key"]
      }
      return dataFormat;

    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async formatReservationRequest(booking, pax, room, body) {
    try {
      let bookingAttributeData;
      if (booking && booking.attributes !== undefined) {
        try {
          bookingAttributeData = JSON.parse(booking.attributes.replace(/'/g, '"'));
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      } else {
        console.log('bookingDetails or bookingDetails.attributes is undefined');
      }

      let roomDetails = bookingAttributeData.RoomDetails[0];

      const rooms = pax.reduce((acc, person) => {
        const roomId = person.address2;
        if (!acc[roomId]) acc[roomId] = [];
        if (person.pax_type === 'Adult') {
          acc[roomId].push(`<Adult title="${person.title}" first="${person.first_name}" last="${person.last_name}"/>`);
        } else if (person.pax_type === 'Child') {
          acc[roomId].push(`<Child age="${this.calculateAge(person.date_of_birth)}" title="${person.title}" first="${person.first_name}" last="${person.last_name}"/>`);
        }
        return acc;
      }, {});

      const roomXml = Object.keys(rooms).map(roomId => {
        const guestsXml = rooms[roomId].join('');
        return `<Room><Guests>${guestsXml}</Guests></Room>`;
      }).join('');

      const prepare_xml = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <BookingCreate xmlns="http://www.reservwire.com/namespace/WebServices/Xml">
          <xiRequest>
            <Authority>
              <Org>${STUBA_ORG}</Org>
              <User>${STUBA_USER}</User>
              <Password>${STUBA_PWD}</Password>
              <Currency>${STUBA_CURRENCY}</Currency>
              <Version>1.28</Version>
            </Authority>
            <QuoteId>${roomDetails.Id}</QuoteId>
            <HotelStayDetails>
              ${roomXml}
            </HotelStayDetails>
            <HotelSearchCriteria>
              <AvailabilityStatus>allocation</AvailabilityStatus>
              <DetailLevel>basic</DetailLevel>
            </HotelSearchCriteria>
            <CommitLevel>prepare</CommitLevel>
          </xiRequest>
        </BookingCreate>
      </soap:Body>
    </soap:Envelope>`;



      const response = await this.httpService.post(STUBA_URL, prepare_xml, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.reservwire.com/namespace/WebServices/Xml/BookingCreate'
        }
      }).toPromise();



      if (response) {
        fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/BookingPrepareRQ_2.xml`, prepare_xml);
        fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/BookingPrepareRS_2.xml`, response);
      } else {
        console.warn('Response data is undefined');
      }

      // const valuationResp = await this.xmlToJson(response);
      //  BookingPrepareResult = valuationResp["soap:Envelope"]["soap:Body"]["BookingCreateResponse"]['BookingCreateResult'];


      let confirm_xml = `<?xml version="1.0" encoding="utf-8"?>
      <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <BookingCreate xmlns="http://www.reservwire.com/namespace/WebServices/Xml">
            <xiRequest>
              <Authority>
               <Org>${STUBA_ORG}</Org>
              <User>${STUBA_USER}</User>
              <Password>${STUBA_PWD}</Password>
              <Currency>${STUBA_CURRENCY}</Currency>
                <Version>1.28</Version>
              </Authority>
              <QuoteId>${roomDetails.Id}</QuoteId>
              <HotelStayDetails>
                ${roomXml}
              </HotelStayDetails>
              <CommitLevel>confirm</CommitLevel>
            </xiRequest>
          </BookingCreate>
        </soap:Body>
      </soap:Envelope>`;

      const booking_confirm = await this.httpService.post(STUBA_URL, confirm_xml, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://www.reservwire.com/namespace/WebServices/Xml/BookingCreate'
        }
      }).toPromise();

      if (booking_confirm) {
        fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/BookingConfirmRQ.xml`, confirm_xml);
        fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/BookingConfirmRS.xml`, booking_confirm);
      } else {
        console.warn('Response data is undefined');
      }

      let confirmBookingData :any = await this.xmlToJson(booking_confirm);
       if(!confirmBookingData?.["soap:Envelope"]?.["soap:Body"]?.["soap:Fault"] ){
        let bookingDetails = confirmBookingData["soap:Envelope"]["soap:Body"]["BookingCreateResponse"]['BookingCreateResult']['Booking'];
         return this.HotelStubaTransformService.updateData(bookingDetails, body, booking, pax, room);
       }{
        const errorClass = getExceptionClassByCode(`400 ${confirmBookingData["soap:Envelope"]["soap:Body"]["soap:Fault"].faultstring['$t']}`);
        throw new errorClass(`400  ${confirmBookingData["soap:Envelope"]["soap:Body"]["soap:Fault"].faultstring['$t']}`);
       }

    } catch (error) {
      const errorClass = getExceptionClassByCode(`400 ${error}`);
      throw new errorClass(`400 ${error}`);
    }
  }

  async hotelsReservation(body: any): Promise<any> {
    let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
    let paxDetails = await this.hotelDbService.getHotelBookingPaxDetails(body);
    let roomDetails = await this.hotelDbService.getHotelBookingItineraryDetails(body);

    let formattedRequest = this.formatReservationRequest(bookingDetails[0], paxDetails, roomDetails, body,);

    return formattedRequest;
  }


  async hotelsCancellation(body: any): Promise<any> {
    try {
      let getBookingId = await this.manager.query(`Select confirmation_reference from  hotel_hotel_booking_details where app_reference= "${body.AppReference}" `);

      if (getBookingId && getBookingId.length) {
        let confirmation_reference = getBookingId[0].confirmation_reference


        const CancellationReq = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
        <BookingCancel xmlns="http://www.reservwire.com/namespace/WebServices/Xml">
        <xiRequest>
        <Authority>
               <Org>${STUBA_ORG}</Org>
              <User>${STUBA_USER}</User>
              <Password>${STUBA_PWD}</Password>
              <Currency>${STUBA_CURRENCY}</Currency>
                <Version>1.28</Version>
              </Authority> 
        <BookingId>${confirmation_reference}</BookingId>
             <CommitLevel>confirm</CommitLevel>
        </xiRequest>
        </BookingCancel>
        </soap:Body>
        </soap:Envelope>`;

        const CancelBooking = await this.httpService.post(STUBA_URL, CancellationReq, {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': "http://www.reservwire.com/namespace/WebServices/Xml/BookingCancel"
          }
        }).toPromise();

        if (this.isLogXml) {
          const fs = require('fs');
          fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/BookingCancellationRQ.xml`, CancellationReq);
          fs.writeFileSync(`${logStoragePath}/hotels/stubaHotels/BookingCancellationRS.xml`, CancelBooking);
        }

        const CancelBookingData = await this.xmlToJson(CancelBooking);

        let cancel_booking = CancelBookingData["soap:Envelope"]["soap:Body"]["BookingCancelResponse"]['BookingCancelResult']['Booking']

        if (cancel_booking) {
          let bookingDetails = await this.hotelDbService.getHotelBookingDetails(body);
          let response = await this.HotelStubaTransformService.updateHotelCancelDetails(bookingDetails[0], body, cancel_booking);
          return response;
        }
      }
      else {
        const errorClass: any = getExceptionClassByCode(`400 Cancellation Failed`);
        throw new errorClass(`400 Cancellation Failed`);
      }


    }
    catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

}
