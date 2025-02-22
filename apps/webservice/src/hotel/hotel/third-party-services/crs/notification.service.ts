import { Injectable } from "@nestjs/common";
import {
  numberOfNights,
  // AESKey,
  // AESIV,
  // ApprovarRedirectAddress,
} from "apps/webservice/src/constants";
import { HotelApi } from "../../../hotel.api";
import {
  HotelVoucher,
  PolicyDB,
  Policy,
} from "../../hotel-types/hotel.types";
import {
  HandlebarsTemplateData,
  HandlebarsTemplateDataApprovar,
  BusinessEmailType,
  cancelBookingHelper,
} from "../hote-crs.types";
import { CommonService } from "../../../../common/common/common.service";
import * as moment from "moment";
// import { ENV } from "apps/webservice/src/env";
import { PDF, InjectPdf } from "nestjs-pdf";
import { MailerService } from "@nestjs-modules/mailer";

// @Injectable()
// export class HotelCrsNotificationService extends HotelApi {
//   constructor(
//     private readonly commonService: CommonService,
//     @InjectPdf() private readonly pdf: PDF,
//     private readonly mailerService: MailerService
//   ) {
//     super();
//   }

//   // async generateApprovalVoucher(
//   //   formattedData: HandlebarsTemplateData,
//   //   business_email: BusinessEmailType
//   // ) {
//   //   const {
//   //     FullName,
//   //     ApprovarName,
     
//   //   } = business_email;

//   //   const approvarData: HandlebarsTemplateDataApprovar = {
//   //     ...formattedData,
//   //     approvar_name: ApprovarName ?? "",
//   //     name: FullName,
//   //     supervisorId: approvar_business_number,
//   //     costCenter: approvar_cost_center,
//   //     department: approvar_department_name,
//   //     designation: approvar_position_name,
//   //     rejectLink: "",
//   //     approveLink: "",
//   //   };
//   //   const timestamp = moment().format("YYYY-MM-DD-HH-mm-ss");
//   //   const file_name = `approval_voucher-${formattedData.icicId}${timestamp}.pdf`;
//   //   await this.pdf({
//   //     filename: "voucher/hotel/" + file_name,
//   //     template: "approval",
//   //     viewportSize: {
//   //       width: 1080,
//   //       height: 1920,
//   //     },
//   //     locals: approvarData,
//   //   });

//   //   const voucherPath = `${process.cwd()}/voucher/hotel/${file_name}`;
//   //   console.log("Voucher Path: ", voucherPath);
//   //   return voucherPath;
//   // }

//   // sendWhatsAppMessage(
//   //   data: HandlebarsTemplateData,
//   //   voucher_path: string,
//   //   business_email: BusinessEmailType
//   // ) {
//   //   const encryptedData = this.encryptData(
//   //     data.icicId,
//   //     business_email.FullName,
//   //     "",
//   //     "Hotel",
//   //     "Approve",
//   //     0
//   //   );
//   //   const d = {
//   //     ApprovalName: business_email.ApprovarName,
//   //     UserName: business_email.FullName,
//   //     City: data.toCity,
//   //   };
//   //   let vpath = voucher_path.replace("/var/www/html/", "");
//   //   if (process?.env?.TYPE === "UAT") {
//   //     vpath = vpath.replace("misba", "misba_uat");
//   //   }
//   //   return this.commonService.sendWhatsappMsg(
//   //     {
//   //       phoneNumber: business_email.approver_phone,
//   //       countryCode: "+91",
//   //       templateName: "hotel_booking_approvalen",
//   //       headerValues: [`http://www.misba.in/${vpath}`],
//   //       bodyValues: Object.values(d),
//   //       fileName: "Hotel Approval Request.pdf",
//   //       callbackData: "",
//   //       languageCode: "en",
//   //     },
//   //     {
//   //       0: [encryptedData],
//   //     }
//   //   );
//   // }


//    encryptData(
//     app_reference: string,
//     user_full_name: string,
//     business_number: string,
//     mmodule: string,
//     status: string,
//     approvar_email:string 
//   ) {
//     const dd = {
//       app_reference: app_reference,
//       business_number: business_number,
//       user_id: approvar_email,
//       module: mmodule,
//       status: status,
//       user_full_name: user_full_name,
//     };
//     const dd_string = JSON.stringify(dd);
//     const encryptedString = this.commonService.encryptAES(
//       dd_string,
//       AESKey,
//       AESIV
//     );
//     const encodedEncryptedString = encodeURIComponent(encryptedString);
//     return encodedEncryptedString;
//   }

//   async transformData(data: HandlebarsTemplateData) {
//     const newData: HandlebarsTemplateData = {
//       ...data,
//       checkIn: moment(data.checkIn, "YYYY-MM-DD").format("MMM DD, YYYY"),
//       checkOut: moment(data.checkOut, "YYYY-MM-DD").format("MMM DD, YYYY"),
//     };

//     const { cc, bcc } = await this.commonService.getMailCC("Hotel", 470);
//     // cc.push(managerId);

//     return { newData, cc, bcc };
//   }

//   async sendUserEmail(
//     data: HandlebarsTemplateData,
//     newData: HandlebarsTemplateData,
//     cc: string[],
//     bcc: string[],
//     business_emails: BusinessEmailType
//   ) {
//     const guest_emailList = data.guestDetails.map((guest) => guest.empEmailId);
//     const {
//       FullName,
//       user_email,
//     approver_email 
//     } = business_emails;
//     const dataNew: HandlebarsTemplateData = {
//       ...newData,
//       name: FullName,
//       supervisorId: "",
//       costCenter: "",
//       department: "",
//       designation: "",
//       needsApproval: approver_email?true:false,
//     };
//     if(!user_email){return}
//     return await this.commonService.sendEmail(
//       user_email,
//       `${FullName} - Hotel Booking Request`,
//       "/templates/icici_hotel_email_template",
//       dataNew,
//       [...cc, ...guest_emailList],
//       bcc
//     );
//   }

//   // Extracted function to send approver email
//   async sendApproverEmail(
//     data: HandlebarsTemplateData,
//     newData: HandlebarsTemplateData,
//     cc: string[],
//     bcc: string[],
//     business_emails: BusinessEmailType
//   ) {
//     const {
//       FullName,
//       approver_email,
//       ApprovarName,
//     } = business_emails;
//     console.log("business_emails",business_emails)
//     if (approver_email && ApprovarName && data.requestType != "Personal") {
//       const approvarLink = this.generateApprovalMailLink(
//         data.icicId,
//         FullName,
//         "",
//         "Hotel",
//         "Approve",
//         approver_email
//       );
//       console.log("approvarLink",approvarLink)
//       const encryprtedString =  approvarLink.split("encryptedData=")[1];
//       await this.manager.query("UPDATE hotel_hotel_booking_details SET approval_code = ?, approvar_id = ? WHERE app_reference = ?", [encryprtedString, approver_email,data.icicId]);
//       const rejectLink = this.generateApprovalMailLink(
//         data.icicId,
//         FullName,
//         "",
//         "Hotel",
//         "Reject",
//         approver_email
//       );
//       const approvarData: HandlebarsTemplateDataApprovar = {
//         ...newData,
//         approvar_name: ApprovarName ?? "",
//         name: FullName,
//         supervisorId: "",
//         costCenter: "",
//         department: "",
//         designation: "",
//         approveLink: approvarLink,
//         rejectLink: rejectLink,
//       };
//       console.log("approvarData",approvarData)
//       console.log("approver_email",approver_email)
//       return await this.commonService.sendEmail(
//         approver_email,
//         `${FullName} - Hotel Booking Approval Request`,
//         "/templates/icici_hotel_email_approvar_template",
//         approvarData,
//         cc,
//         bcc
//       );
//     }
//     return null;
//   }

//   async sendMail(
//     data: HandlebarsTemplateData,
//     business_email?: BusinessEmailType
//   ) {
//     const { newData, cc, bcc } = await this.transformData(data);
//     const user_email_promise = this.sendUserEmail(
//       data,
//       newData,
//       cc,
//       bcc,
//       business_email
//     );
//     const user_approval_promise = this.sendApproverEmail(
//       data,
//       newData,
//       cc,
//       bcc,
//       business_email
//     );

//     return Promise.all([user_email_promise, user_approval_promise]);
//   }

//   generateApprovalMailLink(
//     app_reference: string,
//     user_full_name: string,
//     business_number: string,
//     mmodule: string,
//     status: string,
//     approvar_email: string
//   ) {
//     let base_link = "https://misba.in/";
//     if (ENV === "UAT") {
//       base_link += "misba/";
//     }
//     base_link += ApprovarRedirectAddress;
//     const encodedEncryptedString = this.encryptData(
//       app_reference,
//       user_full_name,
//       business_number,
//       mmodule,
//       status,
//       approvar_email
//     );
    
//     return `${base_link}?encryptedData=${encodedEncryptedString}`;
//   }

//   async formattedRequestMailData(body: HotelVoucher, req: any) {
//     const mainPax = body.BookingPaxDetails[0];
//     const cityResponse = await this.manager.query(
//       `SELECT City FROM contract_hotel_list_dcb WHERE HotelCode = '${body.BookingDetails.HotelCode}'`
//     );
//     const formatedPolicyData: Policy[] = await this.formatPolicyRecords(body);
//     const data: HandlebarsTemplateData = {
//       needsApproval:true,
//       icicId: body.BookingDetails.AppReference,
//       address: body.BookingDetails.HotelAddress,
//       email: body.BookingDetails.Email,
//       name: mainPax.FirstName + " " + mainPax.LastName,
//       guestDetails: body.BookingPaxDetails.map((pax) => {
//         return {
//           empCode: pax.EmployeeId,
//           empName: pax.FirstName + " " + pax.LastName,
//           empGender: pax.Gender,
//           empEmailId: pax.Email,
//           empNumber: pax.Phone,
//           empBand: pax.EmployeeBand,
//         };
//       }),
//       roomDetails: body.BookingItineraryDetails.map((item) => {
//         return {
//           roomType: item.RoomTypeName,
//           roomName: body.BookingDetails.PaymentMode,
//           roomPrice: item.TotalFare,
//         };
//       }),
//       totalRoomPrice: body.BookingItineraryDetails.reduce(
//         (acc, item) => acc + item.TotalFare,
//         0
//       ),
//       toCity: cityResponse?.[0]?.City ?? "",
//       reasonForTravel: body.BookingDetails.Reason,
//       checkIn: body.BookingDetails.HotelCheckIn,
//       checkInTime: body.BookingDetails.CheckInTime,
//       checkOutTime: body.BookingDetails.CheckOutTime,
//       totalNumberOfNights: numberOfNights(
//         body.BookingDetails.HotelCheckIn,
//         body.BookingDetails.HotelCheckOut
//       ).toFixed(0),
//       checkOut: body.BookingDetails.HotelCheckOut,
//       remarks: body.BookingDetails.Remarks || "",
//       supervisorId: "",
//       guestHouse:
//         body.BookingDetails.HotelName || body.BookingDetails.GuesthouseName,
//       costCenter: mainPax.EmployeeCostCenter,
//       department: mainPax.Department,
//       designation: "",
//       requestId: body.BookingDetails.AppReference,
//       requestType: body.BookingDetails.Type,
//       requestedBy: req.user.first_name + " " + req.user.last_name,
//       requestDate: moment().format("YYYY-MM-DD"),
//       companyName: body.BookingDetails.Corporate,
//       created_by_id: req.user.id,
//       Policies: formatedPolicyData,
//     };

//     console.log(JSON.stringify(data));
//     return data;
//   }

//     private async formatPolicyRecords(body: HotelVoucher) {
//         const policiesData: PolicyDB[] = await this.manager.query(
//             `SELECT * from policy_records WHERE app_reference = '${body.BookingDetails.AppReference}'`
//         );
//         const formatedPolicyData: Policy[] = policiesData.map((policy) => {
//             return {
//                 Eligible: policy.eligible,
//                 Selected: policy.selected,
//                 PolicyType: policy.policyType,
//                 Remark: policy.remark,
//                 EligibilityCheck: policy.eligibilityCheck,
//             } as Policy;
//         });
//         return formatedPolicyData;
//     }

//   async sendCancellationEmail(
//     req: {
//       user: {
//         first_name: string;
//         last_name: string;

//         id: number;
//       };
//     },
//     body: {
//       cancellationRemarks: string;
//       AppReference: string;
//     },
//     hotel_booking: cancelBookingHelper
//   ) {
//     const data = {
//       hotel_name: hotel_booking.hotel_name,
//       name: hotel_booking.name,
//       request_id: hotel_booking.request_id,
//       request_type: hotel_booking.BookingType || "Self",
//       requested_by: req.user?.first_name + " " + req.user?.last_name ?? "Admin",
//       reason: body.cancellationRemarks,
//     };
//     const { cc, bcc } = await this.commonService.getMailCC(
//       "Hotel",
//       hotel_booking.corporate_origin
//     );
//     // Send the email
//     cc.push(hotel_booking.ManagerRemoteEmployeeId);
//     await this.mailerService.sendMail({
//       to: hotel_booking.email,
//       cc: cc,
//       bcc: bcc,
//       from: "abhijitwankhede17@gmail.com",
//       subject: `${data.name} - Hotel  Booking Cancelled`,
//       template:
//         process.cwd() + "/templates/icici_hotel_cancel_request_template", // name of the template file without .hbs
//       context: data, // data to be sent to template engine
//     });
//   }
// }
