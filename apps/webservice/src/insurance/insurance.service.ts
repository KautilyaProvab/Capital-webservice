import { HttpService, Injectable } from "@nestjs/common";
import { BaseApi } from "../base.api";

@Injectable()
export class InsuranceService extends BaseApi {
  constructor(private readonly httpService: HttpService) {
    super();
  }
  async getPolicy(req, body) {
    let jsonResponse:any = [];
    const requestBody = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <GetRate052005 xmlns="http://www.travelexinsurance.com/">
              <strLocation>${body.location}</strLocation>
              <strDepartureDate>${body.departureDate}</strDepartureDate>
              <strReturnDate>${body.returnDate}</strReturnDate>
              <strProduct>${body.Product}</strProduct>
              <strForm>${body.form}</strForm>
              <strCoverageType>${body.coverageType}</strCoverageType>
              <intFacPremium>${body.facPremium}</intFacPremium>
              <intNumTravelers>${body.numOfTravelers}</intNumTravelers>
              <strDOB>
                <string>${body.DOB}</string>
              </strDOB>
              <intTripCost>
                <int>${body.tripCost}</int>
              </intTripCost>
              <strState>${body.State}</strState>
              <strCountry>${body.Country}</strCountry>
              <strCollisionStartDate>
                <string>${body.collisionStartDate}</string>
              </strCollisionStartDate>
              <strCollisionEndDate>
                <string>${body.collisionEndDate}</string>
              </strCollisionEndDate>
            </GetRate052005>
          </soap:Body>
        </soap:Envelope>`;

    const xmlRequest = requestBody.replace(/\n/g, "").replace(/>\s+</g, "><");
    console.log("Data",xmlRequest);

    const HEADER = {
      "Content-Type": "text/xml;charset=utf-8",
      "Content-Length": xmlRequest.length,
      Accept: "text/xml",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Host:"api-test.travelexinsurance.com",
      SOAPAction: "http://www.travelexinsurance.com/GetRate052005",
    };
    const xmlResponse = await this.httpService
      .post(
        "https://api-test.travelexinsurance.com/TIServices.asmx?WSDL",
        xmlRequest,
        {
          headers: HEADER,
        }
      )
      .toPromise();
    jsonResponse =await this.xmlToJson(xmlResponse.data);
    return jsonResponse;
  }

  async createPolicy(req,body){
    let jsonResponse:any = [];
    const requestBody=`<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <CreatePolicy052018 xmlns="http://www.travelexinsurance.com/">
                <strUserID>string</strUserID>
                <strPassword>string</strPassword>
                <strBrokerLocation>string</strBrokerLocation>
                <strAgencyLocation>string</strAgencyLocation>
                <strAgentCode>string</strAgentCode>
                <strGroupID>string</strGroupID>
                <strInvoiceNumber>string</strInvoiceNumber>
                <dblTotalPolicyCost>double</dblTotalPolicyCost>
                <strDepartureDate>string</strDepartureDate>
                <strReturnDate>string</strReturnDate>
                <strPurchaseDate>string</strPurchaseDate>
                <strProduct>string</strProduct>
                <strForm>string</strForm>
                <strCoverageType>string</strCoverageType>
                <intFacPremium>int</intFacPremium>
                <intNumTravelers>int</intNumTravelers>
                <strFirstName>
                    <string>string</string>
                    <string>string</string>
                </strFirstName>
                <strLastName>
                    <string>string</string>
                    <string>string</string>
                </strLastName>
                <strDOB>
                    <string>string</string>
                    <string>string</string>
                </strDOB>
                <tripCost>
                    <decimal>decimal</decimal>
                    <decimal>decimal</decimal>
                </tripCost>
                <strMedUpgrade>
                    <string>string</string>
                    <string>string</string>
                </strMedUpgrade>
                <strAddress1>string</strAddress1>
                <strAddress2>string</strAddress2>
                <strCity>string</strCity>
                <strState>string</strState>
                <strZip>string</strZip>
                <strCountry>string</strCountry>
                <strPhone>string</strPhone>
                <strFax>string</strFax>
                <strEmail>string</strEmail>
                <strCollisionStartDate>
                    <string>string</string>
                    <string>string</string>
                </strCollisionStartDate>
                <strCollisionEndDate>
                    <string>string</string>
                    <string>string</string>
                </strCollisionEndDate>
                <strBeneficiary>string</strBeneficiary>
                <strPaymentType>string</strPaymentType>
                <tokenCCNumber>string</tokenCCNumber>
                <strMaskedCardNumber>string</strMaskedCardNumber>
                <strCCCardHolderName>string</strCCCardHolderName>
                <strCCExpirationMonth>string</strCCExpirationMonth>
                <strCCExpirationYear>string</strCCExpirationYear>
                <strCCAuthorizationNumber>string</strCCAuthorizationNumber>
                <strExternallyAuthorized>string</strExternallyAuthorized>
                <strCheckNumber>string</strCheckNumber>
                <strCruiseLine>string</strCruiseLine>
                <strTourOperator>string</strTourOperator>
                <strAirLine>string</strAirLine>
                <strDestination>string</strDestination>
                <strFlightNumber>string</strFlightNumber>
            </CreatePolicy052018>
        </soap:Body>
    </soap:Envelope>`

    
    const xmlRequest = requestBody.replace(/\n/g, "").replace(/>\s+</g, "><");

    const HEADER = {
      "Content-Type": "text/xml;charset=utf-8",
      "Content-Length": xmlRequest.length,
      Accept: "text/xml",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Host:"api-test.travelexinsurance.com",
      SOAPAction: "http://www.travelexinsurance.com/CreatePolicy052018",
    };
    const xmlResponse = await this.httpService
      .post(
        "https://api.travelexinsurance.com/TIServices.asmx?WSDL",
        xmlRequest,
        {
          headers: HEADER,
        }
      )
      .toPromise();
    jsonResponse =await this.xmlToJson(xmlResponse.data);
  }

  async getPaymentConfig(req,body){
    let jsonResponse:any = [];
    const requestBody=`<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetPaymentConfiguration xmlns="http://www.travelexinsurance.com/">
          <LocationNumber>string</LocationNumber>
          <UserID>string</UserID>
          <Password>string</Password>
          <ProductFormNumber>string</ProductFormNumber>
          <HostUrl>string</HostUrl>
        </GetPaymentConfiguration>
      </soap:Body>
    </soap:Envelope>`
    const xmlRequest = requestBody.replace(/\n/g, "").replace(/>\s+</g, "><");

    const HEADER = {
      "Content-Type": "text/xml;charset=utf-8",
      "Content-Length": xmlRequest.length,
      Accept: "text/xml",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Host:"api-test.travelexinsurance.com",
      SOAPAction: "http://www.travelexinsurance.com/GetPaymentConfiguration",
    };
    const xmlResponse = await this.httpService
      .post(
        "https://api.travelexinsurance.com/TIServices.asmx?WSDL",
        xmlRequest,
        {
          headers: HEADER,
        }
      )
      .toPromise();
    jsonResponse =await this.xmlToJson(xmlResponse.data);
  }
  
  async extractPolicy(req,body){
    let jsonResponse:any = [];
    const requestBody=`<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <ExtractPolicy xmlns="http://www.travelexinsurance.com/">
                <UserID>string</UserID>
                <Password>string</Password>
                <ConfirmationID>string</ConfirmationID>
                <TravelerFirstName>string</TravelerFirstName>
                <TravelerLastName>string</TravelerLastName>
                <PurchaseDate>string</PurchaseDate>
                <DepartureDate>string</DepartureDate>
                <Country>string</Country>
                <State>string</State>
                <LocationNumber>string</LocationNumber>
                <Source>string</Source>
                <InvoiceNumber>string</InvoiceNumber>
            </ExtractPolicy>
        </soap:Body>
    </soap:Envelope>`
    const xmlRequest = requestBody.replace(/\n/g, "").replace(/>\s+</g, "><");

    const HEADER = {
      "Content-Type": "text/xml;charset=utf-8",
      "Content-Length": xmlRequest.length,
      Accept: "text/xml",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Host:"api-test.travelexinsurance.com",
      SOAPAction: "http://www.travelexinsurance.com/ExtractPolicy",
    };
    const xmlResponse = await this.httpService
      .post(
        "https://api.travelexinsurance.com/TIServices.asmx?WSDL",
        xmlRequest,
        {
          headers: HEADER,
        }
      )
      .toPromise();
    jsonResponse =await this.xmlToJson(xmlResponse.data);
  }
}
