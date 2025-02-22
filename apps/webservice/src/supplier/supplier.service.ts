import { ConflictException, Injectable } from "@nestjs/common";
import { BaseApi } from "../base.api";
import { SUPPLIER_PASSWORD, SUPPORT_EMAIL } from "../constants";
import {
  CreateSupplierDto,
  PropertyDto,
  PropertyDtoId,
  SupplierWithId,
} from "./dto/property.dto";
import { CreatePropertiesDto } from "./dto/create.dto";
import { UpdateSupplierDto } from "./dto/update.dto";
import { getConnection } from "typeorm";
import { MailerService } from "@nestjs-modules/mailer";
import { getExceptionClassByCode } from "../all-exception.filter";
const bcrypt = require("bcrypt");
import * as crypto from 'crypto';
import { TransportConfigService } from "../transport-config.service";
import * as nodemailer from 'nodemailer';

@Injectable()
export class SuppliersService extends BaseApi {
  constructor(
    private mailerService: MailerService,
    private readonly transportMailerService: TransportConfigService,
  ) {
    super();
  }
  async create(createSupplierPropertiesDto: CreatePropertiesDto) {
    const property = createSupplierPropertiesDto.properties;
    const supplier = createSupplierPropertiesDto.supplier;
    await this.manager.query("START TRANSACTION;");
    try {
      const supplierID = await this.createSupplier(supplier);
      if (supplierID === 'User already exists') {
        throw new Error("400 User already exists")
      }
      
      // for (const propertyDto of property) {
      await this.createProperty(property, supplierID);
      // }
      await this.manager.query("COMMIT;");
    } catch (error) {
      await this.manager.query("ROLLBACK;");
      const errorClass: any = getExceptionClassByCode(error.message);
      throw new errorClass(error.message);
    }
  }

  async createSupplier(createSupplierDto: CreateSupplierDto) {
    const salt = await bcrypt.genSalt();
    // Generate a unique password
    const uniquePassword = await this.generatePassword();
    let password = await bcrypt.hash(uniquePassword, salt);

    //check if user exists
    const user = await this.manager.query(
      "SELECT id FROM auth_users WHERE auth_role_id=6 AND email= ? ORDER BY id DESC",
      [createSupplierDto.email]
    );

    if (user.length > 0) {
      return 'User already exists';
    }

    let uuid = await this.getUUID();

    const record = await this.manager.query(
      "INSERT INTO auth_users (auth_role_id, first_name, last_name, email, title, phone, business_name, password, status, alternate_phone_number, alternate_email, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        6,
        createSupplierDto.first_name,
        createSupplierDto.last_name,
        createSupplierDto.email,
        createSupplierDto.title,
        createSupplierDto.phone_number,
        createSupplierDto.job_title,
        password,
        2,
        createSupplierDto.alternate_phone_number,
        createSupplierDto.alternate_email,
        uuid,
      ]
    );

    // const data: {
    //   id: number;
    // }[] = await this.manager.query(
    //   "SELECT id FROM auth_users WHERE auth_role_id=6 AND email= ? ORDER BY id DESC",
    //   [createSupplierDto.email]
    // );
    // console.log("data-",data);
    //property
    const id = record.insertId;
    const startRoleId = 59;
    const endRoleId = 68;

    // the specific privileges numbers
    const additionalPrivs = [6, 8, 57];

    // Combine the range (59-68) with the additional privilege numbers
    const privilegeNumbers = [
      ...Array.from({ length: endRoleId - startRoleId + 1 }, (_, i) => startRoleId + i),
      ...additionalPrivs
    ];

    // Remove duplicates by converting to a Set and back to an array
    const uniquePrivilegeNumbers = Array.from(new Set(privilegeNumbers));

    // Insert the unique privileges for the user
    getConnection()
      .createQueryBuilder()
      .insert()
      .into("core_privilege_user", ["user_id", "p_no"])
      .values(
        uniquePrivilegeNumbers.map((p_no) => ({
          user_id: id,
          p_no: p_no,
        }))
      )
      .execute();

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

    const { cc } = await this.getEmailConfig();

    await transporter.sendMail({
      to: `${createSupplierDto.email}`,
      cc,
      from: `${SUPPORT_EMAIL}`,
      subject: "New User Registration",
      html: `
        <img src="http://booking247.com/assets/nosafer/images/l-logo.png" style="width: 150px;"/> <br>
        <p>Dear ${createSupplierDto.first_name} ${createSupplierDto.last_name}<br>
        Thank you for registering with Booking247.<br>
        We are excited to be your Travel Service Provider.<br>
        Username : ${createSupplierDto.email}<br>
        Password : ${uniquePassword}<br>
        </p>`
    });

    return id;
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

  async check_hotel_code(hotelCode: string) {
    const res = await this.manager.query(`SELECT origin FROM contract_hotel_list_dcb WHERE HotelCode = ?`, [hotelCode]);
    return res.length > 0;
  }
  async createProperty(createPropertyDto: PropertyDto[], supplierID: number) {
    const lastRecord = await this.manager.query("SELECT HotelCode FROM contract_hotel_list_dcb ORDER BY origin DESC LIMIT 1");
    const lastHotelCode = lastRecord[0]?.HotelCode;
    let lastHotelCodeNumber = lastHotelCode ? parseInt(lastHotelCode.slice(2)) : 1000001;
    // if (lastHotelCodeNumber==NaN){
    //   lastHotelCodeNumber=1000001;
    // }
    let increment_speed = 1
    // update power of 2 to get the next available number
    while (await this.check_hotel_code(`MH${lastHotelCodeNumber}`)) {
     lastHotelCodeNumber += increment_speed;
     increment_speed = 2**Math.floor(Math.log2(increment_speed));
    }
    let count = 0;
    for (const propertyDto of createPropertyDto) {
      const hotelCode = `MH${lastHotelCodeNumber + count}`;
      count++;

      const contractExpiryDate = propertyDto.contract_expiry_date === "" ? null : propertyDto.contract_expiry_date;

      await this.manager.query(
        "INSERT INTO contract_hotel_list_dcb (HotelName, HotelCode, hotel_type, Starrating, Country, City, CityCode , Address, Latitude, Longitude, meal_plans, weekend_days, room_view_ids, local_timezone, check_in_time, check_out_time, children_free_before, paid_children_from_age, paid_children_to_age, user_id, status, currency,channel, hotel_policy, contract_expiry) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          propertyDto.propertyName,
          hotelCode,
          propertyDto.propertyType,
          propertyDto.propertyRating,
          propertyDto.country,
          propertyDto.city,
          propertyDto.city_code,
          propertyDto.propertyAddress,
          propertyDto.latitude,
          propertyDto.longitude,
          propertyDto.mealPlans.join(","),
          propertyDto.weekendDays.join(","),
          propertyDto.roomViews.join(","),
          propertyDto.propertyLocalTimezone,
          propertyDto.checkInTime,
          propertyDto.checkOutTime,
          propertyDto.childrenFreeBefore,
          propertyDto.paidChildrenFromAge,
          propertyDto.paidChildrenToAge,
          supplierID,
          0,
          propertyDto.currency,
          propertyDto.channel,
          propertyDto.hotel_policy,
          contractExpiryDate
        ]
      );
    }
  }

  async findAll(findAllDto: { status: boolean | number | (boolean | number)[] }) {
    let query = "SELECT id, first_name, last_name, email, title, phone AS phone_number, business_name AS job_title, status, alternate_phone_number, alternate_email FROM auth_users WHERE auth_role_id = 6";

    let parameters: any[] = [];

    if (Array.isArray(findAllDto.status)) {
      query += " AND status IN (?)";
      parameters.push(findAllDto.status);
    } else {
      query += " AND status = ?";
      parameters.push(findAllDto.status);
    }

    query += " ORDER BY id DESC";
    return (await this.manager.query(query, parameters)) as SupplierWithId[];
  }

  async findProperties(data: { supplier_id: number; status: boolean }) {
    // Fetch the supplier along with the properties of the supplier
    const properties = await this.manager.query(
      `SELECT 
        origin as id,
        HotelName as propertyName,
        hotel_type as propertyType,
        Starrating as propertyRating,
        Country as country,
        City as city,
        Address as propertyAddress,
        Latitude as latitude,
        Longitude as longitude,
        meal_plans as mealPlans,
        weekend_days as weekendDays,
        room_view_ids as roomViews,
        local_timezone as propertyLocalTimezone,
        check_in_time as checkInTime,
        check_out_time as checkOutTime,
        children_free_before as childrenFreeBefore,
        paid_children_from_age as paidChildrenFromAge,
        paid_children_to_age as paidChildrenToAge,
        currency,
        channel
      FROM 
        contract_hotel_list_dcb 
      WHERE 
        user_id = ? 
        AND status = ?
      ORDER BY 
        origin DESC`,
      [data.supplier_id, data.status]
    );

    // Transform the results back to the format used while adding
    const formattedProperties: PropertyDtoId[] = properties.map((property) => ({
      id: property.id,
      propertyName: property.propertyName,
      propertyType: property.propertyType,
      propertyRating: property.propertyRating,
      country: property.country,
      city: property.city,
      propertyAddress: property.propertyAddress,
      latitude: property.latitude,
      longitude: property.longitude,
      mealPlans: property.mealPlans ? property.mealPlans.split(",") : [],
      weekendDays: property.weekendDays ? property.weekendDays.split(",") : [],
      roomViews: property.roomViews ? property.roomViews.split(",") : [],
      propertyLocalTimezone: property.propertyLocalTimezone,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      childrenFreeBefore: property.childrenFreeBefore,
      paidChildrenFromAge: property.paidChildrenFromAge,
      paidChildrenToAge: property.paidChildrenToAge,
      currency: property.currency,
      channel: property.channel
    } as PropertyDtoId));
    return formattedProperties;
  }

  // remove(id: number) {
  //   return `This action removes a #id `;
  // }
  async updateSupplier(updateSupplierDto: any) {
    if (updateSupplierDto.accept) {
      await this.manager.query("START TRANSACTION;");
      try {
        await this.manager.query(
          "UPDATE auth_users SET status = 1 WHERE id = ?",
          [updateSupplierDto.supplier_id]
        );
        await this.manager.query(
          "UPDATE contract_hotel_list_dcb SET status = 1 WHERE user_id = ?",
          [updateSupplierDto.supplier_id]
        );
        await this.manager.query("COMMIT;");

        let user = await this.getUserById({
          id: updateSupplierDto.supplier_id
        });
        console.log('user:', user);

        if (user) {
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

          const { cc } = await this.getEmailConfig();

          const sendMail = transporter.sendMail({
            to: `${user.email}`,
            cc,
            from: `${SUPPORT_EMAIL}`,
            subject: "Updated User Status",
            html: `<p>Dear ${user.first_name}${user.middle_name ? " " + user.middle_name : ""
              } ${user.last_name}<br>
                        Your account status is Successfully Updated.<br>
                        Your User id : ${user.email}<br>
                  `,
          });
          console.log('responseMail:', sendMail);
        }
      } catch (error) {
        await this.manager.query("ROLLBACK;");
        throw new Error(error);
      }
    } else {
      // for reject supplier
      if (updateSupplierDto.reason) {
        await this.manager.query("START TRANSACTION;");
        try {
          await this.manager.query(
            "UPDATE contract_hotel_list_dcb SET status = 3 WHERE user_id = ?",
            [updateSupplierDto.supplier_id]
          );
          await this.manager.query(
            "UPDATE auth_users SET status = 3 WHERE id = ?",
            [updateSupplierDto.supplier_id]
          );
          await this.manager.query("COMMIT;");

          let user = await this.getUserById({
            id: updateSupplierDto.supplier_id
          });
          console.log('user:', user);

          if (user) {
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

            const { cc } = await this.getEmailConfig();

            const sendMail = await transporter.sendMail({
              to: `${user.email}`,
              cc,
              from: `${SUPPORT_EMAIL}`,
              subject: "Supplier User Status",
              html: `<p>Dear ${user.first_name}${user.middle_name ? " " + user.middle_name : ""
                } ${user.last_name},<br>
                        Your account is Rejected.<br>
                        Reason: ${updateSupplierDto.reason}.<br>
                        Your User id : ${user.email}<br>
                  `,
            });
            console.log('responseMail:', sendMail);
          }
        } catch (error) {
          await this.manager.query("ROLLBACK;");
          throw new Error(error);
        }
      } else {
        // for supplier inactive
        await this.manager.query("START TRANSACTION;");
        try {
          await this.manager.query(
            "UPDATE contract_hotel_list_dcb SET status = 0 WHERE user_id = ?",
            [updateSupplierDto.supplier_id]
          );
          await this.manager.query(
            "UPDATE auth_users SET status = 0 WHERE id = ?",
            [updateSupplierDto.supplier_id]
          );
          await this.manager.query("COMMIT;");

          let user = await this.getUserById({
            id: updateSupplierDto.supplier_id
          });
          console.log('user:', user);

          if (user) {
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

            const { cc } = await this.getEmailConfig();

            const sendMail = await transporter.sendMail({
              to: `${user.email}`,
              cc,
              from: `${SUPPORT_EMAIL}`,
              subject: "Updated User Status",
              html: `<p>Dear ${user.first_name}${user.middle_name ? " " + user.middle_name : ""
                } ${user.last_name}<br>
                        Your account status is Successfully Updated.<br>
                        Your User id : ${user.email}<br>
                  `,
            });
            console.log('responseMail:', sendMail);
          }
        } catch (error) {
          await this.manager.query("ROLLBACK;");
          throw new Error(error);
        }
      }
    }
  }

  async getUserById(body: any) {
    const result = await this.getGraphData(
      `
            query {
                authUser (
                    id: ${body.id}
                ) {
                    id
                    auth_role_id
                    email
                    uuid
                    business_name
                    business_phone
                    business_number
                    iata
                    agent_balance
                    credit_limit
                    due_amount
                    date_of_birth
                    title
                    image
                    first_name
                    middle_name
                    last_name
                    address
                    core_city_id
                    country
                    phone_code
                    phone
                    city
                    state
                    zip_code
                    created_at
                    last_login
                    logout_date_time
                    socialuserid
                    status
                    privilege_access
                    api_list
                    agent_group_id
                }
            }
        `,
      "authUser"
    );
    return result;
  }
  
  async delete(body: any): Promise<any> {
    const query = `
      DELETE FROM auth_users WHERE id=${body.id};
      DELETE FROM contract_hotel_list_dcb WHERE user_id=${body.id};
    `;

    try {
      const result = await this.manager.query(query);
      return result;
    } catch (error) {
      console.error('Error deleting records:', error);
      throw new Error(`Failed to delete user with ID ${body.id}`);
    }
  }

  async generatePassword(length = 12) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  async getUUID() {
    let query = "SELECT uuid FROM auth_users WHERE auth_role_id = 6 ORDER BY id DESC LIMIT 1;"
    const result = await this.manager.query(query);
    let uuid_number = result[0]["uuid"].replace(/\D/g, '').replace('0', '');
    uuid_number = Number(uuid_number) + 1;
    let uuid = "TLBC" + "0000" + uuid_number;
    return uuid;
  }

}
