import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { MailerService } from "@nestjs-modules/mailer";
import { getExceptionClassByCode } from "../all-exception.filter";
import { BaseApi } from "../base.api";
import { AuthDbService } from "./auth-db.service";
import { jwtConstants } from "./constants";
import { SUPPORT_EMAIL, UI_SERVER_IP } from "apps/webservice/src/constants";
import { CommonService } from "../common/common/common.service";
import { TransportConfigService } from "../transport-config.service";
const moment = require('moment');
import { RedisService } from "nestjs-redis";
var btoa = require("btoa");
const bcrypt = require("bcrypt");
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService extends BaseApi {
  constructor(
    private readonly mailerService: MailerService,
    private readonly transportMailerService: TransportConfigService,
    private readonly userRepo: AuthDbService,
    private readonly commonService: CommonService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService // private readonly mailerService: MailerService,
  ) {
    super();
  }
  private readonly redisClient = this.redisService.getClient();
  async register(user) {
    try {
      const userInDB = await this.userRepo.findOne({ email: user.email });
      if (userInDB.length > 0) {
        const errorClass: any = getExceptionClassByCode(
          "403 User Already exists"
        );
        throw new errorClass("403 User Already exists");
      } else {
        user["title"] = 0;
        const salt = await bcrypt.genSalt();
        let password = await bcrypt.hash(user.password, salt);
        user.uuid = await this.getUUID(user.email)
        const user_password = user.password
        user.password = password;
        const savedUser = await this.userRepo.save(user);
        let message = `Dear ${user.first_name} ${user.last_name}
        Thank you for registering with Booking247.
        We are excited to be your Travel Service Provider. 
        Look for Exciting Discounts and Offer by subscribing to our Newsletter 
        Download the apps from Apple https://play.google.com/store/apps/details?id=com.booking247
         and Android https://play.google.com/store/apps/details?id=com.booking247`

        const sendSmsResponse = this.commonService.sendSMS(message, '880' + user.phone)

        const transportConfig = this.transportMailerService.getTransportConfig("noreply")

        // Create a custom transport using 'noreply' credentials
        const transporter = nodemailer.createTransport({
          host: transportConfig.host,
          port: transportConfig.port,
          secure: transportConfig.secure,
          auth: {
            user: transportConfig.auth.user,
            pass: transportConfig.auth.pass,
          },
        });

        const { cc } = await this.getEmailConfig()

        await transporter.sendMail({
          to: `${savedUser.email}`,
          cc,
          from: `${transportConfig.auth.user}`,
          subject: "New User Registration",
          html: `
          <table style="font-size:14px;font-family:'Arial';background-color:#082e53;width:900px;margin:10px auto">
                <tbody>
                    <tr>
                        <td style="background-color:#082e53;padding:50px 60px 50px">

                           

                            <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border-radius:10px 10px 0px 0px; border-collapse: collapse;">
                                <tbody>
                                	 <tr>
                                        <td align="center" style="padding:45px 20px; border-bottom: 1px solid #ddd;"><img style="width:280px;" src="http://54.198.46.240/booking247/assets/nosafer/images/l-logo.png" alt="image/png" class="CToWUd" data-bit="iit"></td>
                                    </tr>
                                	

                                    
                                </tbody>
                            </table>
                        
                            <table style="width:100%;background:#fff;padding:25px; border-radius: 0px 0px 10px 10px;">
                                <tbody>

                                    <tr>
                                        <td>
                                <table style="width:100%;background:#fff;padding:15px; border-radius:10px; box-shadow: 0px 1px 8px 5px #ddd;">

                                    <tr>
                                        <td style="padding:20px 20px 10px;font-size:25px; text-align: center;"><strong style="padding-bottom: 25px; line-height: 20px; color: #fbc10a; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Welcome to Booking247</strong></td>
                                    </tr>



                                    <tr>
                                        <td style="padding:20px 20px 0px;font-size:23px; padding-bottom:15px;"><strong style="font-size:16px;line-height:20px">Dear ${user.first_name}${user.middle_name ? " " + user.middle_name : ''} ${user.last_name}</strong></td>
                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top">
                                           Thank you for registering with Booking247.<br><br>

                                            <span style="font-size:16px">We are excited to be your Travel Service Provider.</span>
                                     
                                        </td>

                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"></td>
                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 10px;width:100%;font-size:16px;vertical-align:top">
                                            <strong>Username:</strong> <a href="#">${savedUser.email}</a>
                                            
                                        </td>

                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 10px;width:100%;font-size:16px;vertical-align:top">
                                            <strong>Password:</strong> ${user_password}
                                            
                                        </td>

                                    </tr>

                                   
                                     <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"></td>
                                    </tr>

                                        <tr style="border:none">
                                             <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"><strong style="display:block;margin-bottom:5px">Best Regards,</strong>
                                                <span style="display:block;margin-bottom:5px">
                                                Team Booking247
                                                </span>
                                               
                                             </td>
                                          </tr> 
                                      </table>

                                          </td>
                                          </tr>

                                      </tbody>
                            </table>
                        </td>
                    </tr>

                    <tr>
                                        <td style="padding:0px 20px 0px;font-size:16px; text-align: center; line-height:25px; color:#fff; padding-bottom:35px;">care.uk@booking247.com | + 44 1254 66 22 22<br>41, Victoria Street Blackburn, Lancashire, United Kingdom - BB1 6DN</td>
                                    </tr>

                </tbody>
            </table>`
        });

        if (sendSmsResponse)
          return savedUser;
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async getEmailConfig() {
    try {
      const emailConfig = await this.manager.query(`
                SELECT * FROM cms_emailconfigs LIMIT 1
      `);

      const ccArr = emailConfig[0].cc.split(',').map((email: string) => email.trim())
      return { ...emailConfig[0], cc: ccArr }
    } catch (error) {
        console.log(error);
        return error
    }
  }
  
  async getUUID(userEmail) {
    let query = "SELECT uuid FROM auth_users WHERE auth_role_id = 4 ORDER BY id DESC LIMIT 1;"
    const result = await this.manager.query(query);
    let uuid_number = result[0]["uuid"].replace(/\D/g, '').replace('0', '');
    uuid_number = Number(uuid_number) + 1
    let uuid = "TLBC" + "0000" + uuid_number
    return uuid;
  }
  
  async login(body: any): Promise<any> {
    const currentDate = new Date();
    const currenctDateString =
      [
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        currentDate.getDate(),
      ].join("-") +
      " " +
      [
        currentDate.getHours(),
        currentDate.getMinutes(),
        currentDate.getSeconds(),
      ].join(":");
    try {

      if (body.login_type != undefined) {
        if (body.login_type == 'google' || body.login_type == 'facebook') {
          const user = await this.userRepo.findOne({ email: body.email, auth_role_id: 4 });
          if (user.length > 0) {
            const payload = {
              user_id: user[0].id,
              role_id: user[0].auth_role_id,
              JwtexpiresInSeconds: jwtConstants.expiresInSeconds,
            };
            user[0]["access_token"] = this.jwtService.sign(payload);
            const loginUpdate = await this.getGraphData(
              `mutation{
                    updateAuthUser(authUserPartial:{
                      last_login:"${currenctDateString}"
                    },id:${user[0].id})
                  }`,
              `updateAuthUser`
            );
            return user[0];
          } else {

            const salt = await bcrypt.genSalt();
            let password = await bcrypt.hash('Booking247@123', salt);
            let uuid = await this.getUUID(body.email)
            let userreq = {
              title: 0,
              uuid: uuid,
              password: password,
              email: body.email,
              first_name: body.first_name,
              last_name: body.last_name,
              middle_name: "",
              country: "18",
              address: "",
              image: "",
              phone: ""
            };
            const savedUser = await this.userRepo.save(userreq);


            const user = await this.userRepo.findOne({ email: body.email, auth_role_id: 4 });
            if (user.length > 0) {
              const payload = {
                user_id: user[0].id,
                role_id: user[0].auth_role_id,
                JwtexpiresInSeconds: jwtConstants.expiresInSeconds,
              };
              user[0]["access_token"] = this.jwtService.sign(payload);
              const loginUpdate = await this.getGraphData(
                `mutation{
                    updateAuthUser(authUserPartial:{
                      last_login:"${currenctDateString}"
                    },id:${user[0].id})
                  }`,
                `updateAuthUser`
              );
              return user[0];

            }
          }
        }
      } else {
        const user = await this.findUsers(body.email, body.password, 4);
        if (user) {
          let user_password = await bcrypt.compare(
            body.password,
            user[0].password
          );
          if (user_password === true) {
            if (user.status == 0) {
              const errorClass: any = getExceptionClassByCode("403");
              throw new errorClass("403 Inactive User");
            } else if (user.length > 0) {
              const payload = {
                user_id: user[0].id,
                role_id: user[0].auth_role_id,
                JwtexpiresInSeconds: jwtConstants.expiresInSeconds,
              };
              user[0]["access_token"] = this.jwtService.sign(payload);
              const loginUpdate = await this.getGraphData(
                `mutation{
                      updateAuthUser(authUserPartial:{
                        last_login:"${currenctDateString}"
                      },id:${user[0].id})
                    }`,
                `updateAuthUser`
              );
              const otp = await this.generateOtp(user[0].id);
              console.log("otp:",otp.otp)

              const transportConfig = this.transportMailerService.getTransportConfig("noreply")

              // Create a custom transport using 'noreply' credentials
              const transporter = nodemailer.createTransport({
                host: transportConfig.host,
                port: transportConfig.port,
                secure: transportConfig.secure,
                auth: {
                  user: transportConfig.auth.user,
                  pass: transportConfig.auth.pass,
                },
              });

              const { cc } = await this.getEmailConfig()
              
              // await this.manager.query(`UPDATE auth_users SET otp = '${otp}',otpExpiry = '${ogeneratedAt}'  WHERE id = ${user[0].id}`);
              await transporter.sendMail({
                to: body.email,
                cc,
                from: `"Booking247" <${SUPPORT_EMAIL}>`,
                subject: "B2C Verification code for Login",
                html: `
                <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking247 | User OTP Validation</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f6f6f6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 1px solid #eeeeee;
    }
    .header h1 {
      margin: 0;
      color: #4CAF50;
    }
    .content {
      padding: 20px;
    }
    .content p {
      margin: 0 0 20px;
    }
    .otp {
      display: block;
      width: fit-content;
      margin: 20px auto;
      padding: 10px 20px;
      background-color: #4CAF50;
      color: #ffffff;
      text-align: center;
      text-decoration: none;
      border-radius: 4px;
      font-size: 20px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      border-top: 1px solid #eeeeee;
      color: #888888;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
  
    <div class="content">
      <p>Dear User,</p>
      <p><strong>${otp.otp}</strong> is your OTP to login. Please copy and paste it.</p>
      <p>Thanks,</p>
      <p>The Booking247 Team</p>
    </div>
    <div class="footer">
      <p>&copy; 2024 Booking247 All rights reserved.</p>
    </div>
  </div>
</body>
</html>

<table style="font-size:14px;font-family:'Arial';background-color:#082e53;width:900px;margin:10px auto">
                <tbody>
                    <tr>
                        <td style="background-color:#082e53;padding:50px 60px 50px">

                           

                            <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border-radius:10px 10px 0px 0px; border-collapse: collapse;">
                                <tbody>
                                	 <tr>
                                        <td align="center" style="padding:45px 20px; border-bottom: 1px solid #ddd;"><img style="width:280px;" src="http://54.198.46.240/booking247/assets/nosafer/images/l-logo.png" alt="image/png" class="CToWUd" data-bit="iit"></td>
                                    </tr>
                                	

                                    
                                </tbody>
                            </table>
                        
                            <table style="width:100%;background:#fff;padding:25px; border-radius: 0px 0px 10px 10px;">
                                <tbody>

                                    <tr>
                                        <td>
                                <table style="width:100%;background:#fff;padding:15px; border-radius:10px; box-shadow: 0px 1px 8px 5px #ddd;">

                                   <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top">
                                          Dear <strong>User</strong>
                                        </td>

                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top">
                                          <strong>${otp.otp}</strong> is your login verification code.
                                        </td>

                                    </tr>

                                   
                                     <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"></td>
                                    </tr>

                                        <tr style="border:none">
                                             <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"><strong style="display:block;margin-bottom:5px">Best Regards,</strong>
                                                <span style="display:block;margin-bottom:5px">
                                                Team Booking247
                                                </span>
                                               
                                             </td>
                                          </tr> 
                                      </table>

                                          </td>
                                          </tr>

                                      </tbody>
                            </table>
                        </td>
                    </tr>

                    <tr>
                                        <td style="padding:0px 20px 0px;font-size:16px; text-align: center; line-height:25px; color:#fff; padding-bottom:35px;">care.uk@booking247.com | + 44 1254 66 22 22<br>41, Victoria Street Blackburn, Lancashire, United Kingdom - BB1 6DN</td>
                                    </tr>

                </tbody>
            </table>

                          `,
              });
              return user[0];
            }
          } else {
            const errorClass: any = getExceptionClassByCode("403 Unauthorized");
            throw new errorClass("403 Unauthorized");
          }
          const errorClass: any = getExceptionClassByCode("403");
          throw new errorClass("Invalid Credentials");
        }
      }

    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async findUser(email) {
    const result = await this.userRepo.findOne({ where: { email } });
    return result;
  }

  async forgotPassword(email: string): Promise<any> {
    try {
      console.log(email);
      // const userInDB = await this.findUser(email);
      const userInDB = await this.getGraphData(
        `
                    query {
                          authUsers (
                               where: {
                                   email: {
                                        eq: "${email}"
                                    }
                                    auth_role_id: {
                                        eq: "4"
                                    }
                                }
                            ) {
                              email
                              id
                            }
                        }
                      `,
        "authUsers"
      );
      if (userInDB) {
        var userId = userInDB[0].id;
        console.log("userid", userId);
        var encrypted_id = btoa(`"${userId}"`);
        const forgotLink = `${UI_SERVER_IP}/#/auth/forgot-password?token=${encrypted_id}`;

        const transportConfig = this.transportMailerService.getTransportConfig("noreply")

        // Create a custom transport using 'noreply' credentials
        const transporter = nodemailer.createTransport({
          host: transportConfig.host,
          port: transportConfig.port,
          secure: transportConfig.secure,
          auth: {
            user: transportConfig.auth.user,
            pass: transportConfig.auth.pass,
          },
        });

        const { cc } = await this.getEmailConfig()

        const mail = await transporter.sendMail({
          to: email,
          cc,
          from: `"Booking247" <${SUPPORT_EMAIL}>`,
          subject: "Reset Your Password",
          html: `
                    <table style="font-size:14px;font-family:'Arial';background-color:#082e53;width:900px;margin:10px auto">
                <tbody>
                    <tr>
                        <td style="background-color:#082e53;padding:50px 60px 50px">

                           

                            <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border-radius:10px 10px 0px 0px; border-collapse: collapse;">
                                <tbody>
                                	 <tr>
                                        <td align="center" style="padding:45px 20px; border-bottom: 1px solid #ddd;"><img style="width:280px;" src="http://54.198.46.240/booking247/assets/nosafer/images/l-logo.png" alt="image/png" class="CToWUd" data-bit="iit"></td>
                                    </tr>
                                	

                                    
                                </tbody>
                            </table>
                        
                            <table style="width:100%;background:#fff;padding:25px; border-radius: 0px 0px 10px 10px;">
                                <tbody>

                                    <tr>
                                        <td>
                                <table style="width:100%;background:#fff;padding:15px; border-radius:10px; box-shadow: 0px 1px 8px 5px #ddd;">

                                   

                                    <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top">
                                          You have requested to reset your password.<br><br>

                                            <span style="font-size:16px">We cannot simply send you your old password. A unique link to reset your
                                                                password has been generated for you. To reset your password, click the
                                                                following link and follow the instructions.</span>
                                     
                                        </td>

                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"></td>
                                    </tr>

                                    <tr>
                                        <td style="padding:0px 20px 10px;width:100%;font-size:16px;vertical-align:top">
                                             <a href="${forgotLink}">Reset Password</a>
                                            
                                        </td>

                                    </tr>

                                   
                                   
                                     <tr>
                                        <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"></td>
                                    </tr>

                                        <tr style="border:none">
                                             <td style="padding:0px 20px 20px;width:100%;font-size:16px;vertical-align:top"><strong style="display:block;margin-bottom:5px">Best Regards,</strong>
                                                <span style="display:block;margin-bottom:5px">
                                                Team Booking247
                                                </span>
                                               
                                             </td>
                                          </tr> 
                                      </table>

                                          </td>
                                          </tr>

                                      </tbody>
                            </table>
                        </td>
                    </tr>

                    <tr>
                                        <td style="padding:0px 20px 0px;font-size:16px; text-align: center; line-height:25px; color:#fff; padding-bottom:35px;">care.uk@booking247.com | + 44 1254 66 22 22<br>41, Victoria Street Blackburn, Lancashire, United Kingdom - BB1 6DN</td>
                                    </tr>

                </tbody>
            </table>
                    `,
        });
        return "Change password notification has been sent your email";
      } else {
        const errorClass: any = getExceptionClassByCode(
          "403 User email not exists"
        );
        throw new errorClass("403 User email not exists");
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
    //return null;
  }

  async updatePassword(body: any, req: any): Promise<any> {
    const user = await this.getGraphData(
      `{
                    authUser(
                        id: ${body.id}
                    ) {
                      password 
                    }
                }`,
      `authUser`
    );
    if (user) {
      const user_password = body?.old_password ? await bcrypt.compare(
        body?.old_password,
        user.password
      ) : false;
      
      if (body?.old_password && !user_password) {
        const errorClass: any = getExceptionClassByCode(
          "500 Password Error"
        );
        throw new errorClass("Password Error");
      }

      if (body.password) {
        const salt = await bcrypt.genSalt();
        let newPassword = await bcrypt.hash(body.password, salt);
        const result = await this.getGraphData(
          `
                mutation {    
                    updateAuthUser(id: ${body.id}, authUserPartial: {
                    password: "${newPassword}"
                   })
                 }`,
          "updateAuthUser"
        );
        return result;
      } else {
        const errorClass: any = getExceptionClassByCode(
          "500 Password Mismatch"
        );
        throw new errorClass("Password Mismatch");
      }
    } else {
      const errorClass: any = getExceptionClassByCode("403 Invalid Data");
      throw new errorClass("Invalid Data");
    }
  }

  async changePassword(req, body) {
    try {
      const result = await this.getGraphData(
        `{
                    authUser(
                        id: ${req.user.id}
                    ) {
                      id
                      email
                      password 
                    }
                }`,
        `authUser`
      );
      console.log(result);
      if (result) {
        if (result.password === body.old_password) {
          const updatedResult = await this.getGraphData(
            `mutation{
                            updateAuthUser(authUserPartial:{
                              password:"${body.new_password}"
                              
                            },id:${req.user.id})
                          }
                          `,
            `updateAuthUser`
          );
          return updatedResult;
        } else {
          const errorClass: any = getExceptionClassByCode(
            "406 Password Mismatch"
          );
          throw new errorClass("406 Password Mismatch");
        }
      } else {
        const errorClass: any = getExceptionClassByCode("404 No User Found");
        throw new errorClass("404 No User Found");
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async dynamicAuthorizationValidate(role_id: number): Promise<any> {
    const query = `
			SELECT c.name
			FROM auth_capabilities c
			JOIN auth_roles_capabilities rc ON c.id = rc.capability_id
			WHERE rc.role_id = ${role_id};
    	`;
    try {
      const result = await this.manager.query(query);
      return result;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async findUsers(
    email: string,
    password: string,
    auth_role_id: number
  ): Promise<any> {
    const result = await this.userRepo.findOne({
      email,
      auth_role_id,
    });

    console.log("res", result);
    return result;
  }

  // async findUser(email): Promise<any> {
  //     const result = await this.userRepo.findOne({ where: { email } });
  //     return result;
  // }

  async guestLogin(body: any): Promise<any> {
    const userInDB = await this.userRepo.findOne({ email: body.email });
    if (!userInDB) {
      const currentDate = new Date();
      const currenctDateString =
        [
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          currentDate.getDate(),
        ].join("-") +
        " " +
        [
          currentDate.getHours(),
          currentDate.getMinutes(),
          currentDate.getSeconds(),
        ].join(":");
      const guestUser = {
        email: body.email,
        phone: body.phone,
        country: body.country_code,
        first_name: "Guest",
        last_login: currenctDateString,
        auth_role_id: body.auth_role_id,
      };
      const result = await this.userRepo.save(guestUser);
      return result;
    } else {
      const currentDate = new Date();
      const currenctDateString =
        [
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          currentDate.getDate(),
        ].join("-") +
        " " +
        [
          currentDate.getHours(),
          currentDate.getMinutes(),
          currentDate.getSeconds(),
        ].join(":");
      const guestUser = {
        last_login: currenctDateString,
      };
      await this.userRepo.update(userInDB.id, guestUser);
      return userInDB;
    }
  }

  async findByPayload(payload) {
    const result = await this.userRepo.findOne({
      id: payload.user_id,
      auth_role_id: payload.role_id,
    });
    return result;
  }

  async validateUser(payload: any): Promise<any> {
    const user = await this.findByPayload(payload);
    if (!user) {
      throw new HttpException("Invalid token", HttpStatus.UNAUTHORIZED);
    }
    return user;
  }

  async refreshToken(body: any): Promise<any> {
    console.log(body);
    const decode = this.jwtService.decode(body["token"]);
    if (
      !decode.hasOwnProperty("user_id") ||
      !decode.hasOwnProperty("role_id") ||
      !this.jwtService.verify(body["token"])
    ) {
      throw new UnauthorizedException();
    }
    const user = await this.userRepo.findOne({
      id: decode["user_id"],
      auth_role_id: decode["role_id"],
    });
    const payload = {
      user_id: user.id,
      role_id: user.auth_role_id,
      JwtexpiresInSeconds: jwtConstants.expiresInSeconds,
    };
    user[0]["access_token"] = this.jwtService.sign(payload);
    return user;
  }

  async updateLoginLogout(body: any, req: any) {
    try {
      if (body.logout_datetime) {
        const result = await this.getGraphData(
          `
                    mutation {
                        updateAuthUser(
                            id: ${req.user.id}
                            authUserPartial: {
                                logout_date_time: "${body.logout_datetime}"
                            }
                        )
                    }
                `,
          "updateAuthUser"
        );
        return result;
      }
    } catch (error) {
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }
  
  //verification
  // async verifyOtp(body: any) {
  //   const currentTime = new Date();
  //   const result = await this.manager.query(`SELECT * FROM auth_users WHERE otp = ${body.otp} AND id = ${body.user_id}`);
  //   if (!result.length) {
  //       const errorClass: any = getExceptionClassByCode("403 Invalid OTP");
  //       throw new errorClass("403 Invalid OTP");
  //   }
  //   const otpExpiry = new Date(result[0].otpExpiry)
  //   const timeDifferenceInMinutes = (currentTime.getTime() - otpExpiry.getTime()) / 60000;  // 1 minute = 60000 ms

  //   // If the OTP is older than 10 minutes, throw an "OTP Expired" error
  //   if (timeDifferenceInMinutes > 10) {
  //     const errorClass: any = getExceptionClassByCode("OTP Expired");
  //     throw new errorClass("403 OTP Expired");
  //   }

  //   await this.manager.query(`UPDATE auth_users SET otp = null WHERE id = ${body.user_id}`);
  //   return true;
  // }
  async verifyOtp(body: any) {
    const currentTime = new Date();

    // Fetch OTP data from Redis
    const redisOtpData = await (this.redisClient as any).get(`otp:${body.user_id}`);
    console.log('Redis OTP Data:', redisOtpData);  // Add debugging to check the data

    if (!redisOtpData) {
        const errorClass: any = getExceptionClassByCode("403 Invalid OTP");
        throw new errorClass("403 Invalid OTP");
    }

    // Parse the OTP data
    const { otp, generatedAt } = JSON.parse(redisOtpData);
    console.log('OTP and GeneratedAt:', otp, generatedAt);  // Add debugging to verify the OTP

    // Validate OTP
    if (otp !== String(body.otp)) {
        const errorClass: any = getExceptionClassByCode("403 Invalid OTP");
        throw new errorClass("403 Invalid OTP");
    }

    // Calculate time difference between OTP generation and current time
    const otpGeneratedAt = moment(generatedAt, 'YYYY-MM-DD HH:mm:ss');
    const timeDifferenceInMinutes = moment().diff(otpGeneratedAt, 'minutes');
    
    // If the OTP is older than 10 minutes, throw an error
    if (timeDifferenceInMinutes > 10) {
        const errorClass: any = getExceptionClassByCode("OTP Expired");
        throw new errorClass("403 OTP Expired");
    }

    // Optionally, clear OTP from Redis after successful verification
    const delResponse = await (this.redisClient as any).del(`otp:${body.user_id}`);
    console.log('Deleted OTP from Redis:', delResponse);  // Debugging to check if OTP is deleted

    return true;
}

  

  async resendOtp(body: any) {
    const result = await this.manager.query(`SELECT * FROM auth_users WHERE id = ${body.user_id}`);
    if (!result.length) {
        const errorClass: any = getExceptionClassByCode("400 User does not exist");
        throw new errorClass("400 User does not exist");
    }

    const otp = await this.generateOtp(body.user_id);
    console.log("otp:",otp.otp)

    const transportConfig = this.transportMailerService.getTransportConfig("noreply")

    // Create a custom transport using 'noreply' credentials
    const transporter = nodemailer.createTransport({
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      auth: {
        user: transportConfig.auth.user,
        pass: transportConfig.auth.pass,
      },
    });
    // await this.manager.query(`UPDATE auth_users SET otp = '${otp.otp}', otpExpiry = '${otp.generatedAt}' WHERE id = ${body.user_id}`);

    const { cc } = await this.getEmailConfig()

    await transporter.sendMail({
      to: result[0].email,
      cc,
      from: `"Booking247" <${SUPPORT_EMAIL}>`,
      subject: "Resend OTP for Login",
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Verification Code</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f6f6f6;
            color: #333;
            margin: 0;
            padding: 0;
          }
          .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid #eeeeee;
          }
          .header h1 {
            margin: 0;
            color: #4CAF50;
          }
          .content {
            padding: 20px;
          }
          .content p {
            margin: 0 0 20px;
          }
          .otp {
            display: block;
            width: fit-content;
            margin: 20px auto;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: #ffffff;
            text-align: center;
            text-decoration: none;
            border-radius: 4px;
            font-size: 20px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #eeeeee;
            color: #888888;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Login Verification</h1>
          </div>
          <div class="content">
            <p>Dear User,</p>
            <p><strong>${otp.otp}</strong> is your login verification code.</p>
            <p>Thanks,</p>
            <p>The Booking247 Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Booking247; All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      
                `,
    });
    return true;
  }

  // generateOtp() {
  //   let otp;
  //   do {
  //     otp = Math.floor(100000 + Math.random() * 900000).toString();
  //   } while (otp === '000000');
  
  //   // const generatedAt = new Date()  
  //   const generatedAt = moment().format('YYYY-MM-DD HH:mm:ss'); 
  
  //   return { otp, generatedAt };
  // }
  
  // async generateOtp(userId: number) {
  //   let otp;
  //   do {
  //     otp = Math.floor(100000 + Math.random() * 900000).toString();
  //   } while (otp === '000000');
    
  //   const generatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    
  //   // Set OTP in Redis with a TTL (Time-to-Live) of 10 minutes
  //   await (this.redisClient as any).set(
  //     `otp:${userId}`, // Unique key for each user
  //     JSON.stringify({ otp, generatedAt }), // Store OTP and generatedAt together
  //     'EX', // Expire after time
  //     600 // 600 seconds = 10 minutes
  //   );
  
  //   return { otp, generatedAt };
  // }

  async generateOtp(userId: number) {
    try {
      let otp: string;
      do {
        otp = Math.floor(100000 + Math.random() * 900000).toString();
      } while (otp === '000000'); 
  
      const generatedAt = moment().format('YYYY-MM-DD HH:mm:ss'); // Get current time
  
      const redisKey = `otp:${userId}`;
  
      console.log(`Generated OTP for user ${userId}: ${otp}, Timestamp: ${generatedAt}`);
  
      await (this.redisClient as any).set(redisKey, JSON.stringify({otp,generatedAt}), 'EX', 600);
  
      console.log(`Stored OTP for user ${userId} in Redis with key ${redisKey}`);
  
      return { otp, generatedAt };
    } catch (error) {
      console.error('Error generating or storing OTP:', error);
      throw new Error('Failed to generate OTP');
    }
  }
}
