import { Injectable } from "@nestjs/common";
import { BaseApi } from "./../base.api";

@Injectable()
export class AuthDbService extends BaseApi {

    constructor() {
        super()
    }

    async save(user: any) {
        const result = await this.getGraphData(`
            mutation {
                createAuthUser(
                    authUser: {
                        address: "${user.address}"
                        address2: "${user.address}"
                        auth_role_id: 4
                        business_name: ""
                        business_number: ""
                        email: "${user.email}"
                        country:"${user.country}"
                        first_name: "${user.first_name}"
                        middle_name: "${user.middle_name}"
                        last_name: "${user.last_name}"
                        password: "${user.password}"
                        date_of_birth:"${user.date_of_birth}"
                        status: true
                        title: ${user.title}
                        phone: "${user.phone}"
                        uuid: "${user.uuid}"
                    }
                ) {
                    id
                    auth_role_id
                    email
                    uuid
                    first_name
                    last_name
                    address
                    core_city_id
                    phone
                    status
                    user_type
                    state
                    city
                    zip_code
                }
            }
        `, 'createAuthUser');
        return result;
    }

    async findOne(request: any): Promise<any> {
        let queryFind: any;
        if (!request.auth_role_id)
            request.auth_role_id = '';
        if (!request.email)
            request.email = '';
        if (!request.password)
            request.password = '';
            request.password = '';
            if (request.email && !request.password && request.auth_role_id) {
                queryFind = `SELECT id, auth_role_id, email, title, first_name,password, last_name, address, phone, image
                        FROM auth_users 
                        WHERE email = '${request.email}'
                        AND auth_role_id = '${request.auth_role_id}'`;
            } else if (request.email && !request.password) {
            queryFind = `SELECT id, auth_role_id, email, title, first_name,password, last_name, address, phone, image
                    FROM auth_users 
                    WHERE email = '${request.email}'`;
        } else if (!request.id) {
            queryFind = `SELECT id, auth_role_id, email, title, first_name, last_name, address, phone, image
                    FROM auth_users 
                    WHERE auth_role_id = '${request.auth_role_id}'
                    AND email = '${request.email}' 
                    AND password = '${request.password}'`;
        } else if (request.id && request.auth_role_id) {
            queryFind = `SELECT id, auth_role_id, email, title, first_name, last_name, address, phone, image
                    FROM auth_users 
                    WHERE auth_role_id = '${request.auth_role_id}'
                    AND id = '${request.id}'`;
        } else {
            queryFind = `SELECT id, auth_role_id, email, title, first_name, last_name, address, phone, image
                    FROM auth_users 
                    WHERE id = '${request.id}'
                    AND auth_role_id = '${request.auth_role_id}'
                    AND email = '${request.email}' 
                    AND password = '${request.password}'`;
        }
        const result = await this.manager.query(queryFind);
        return result;
    }

    async update(userid: any, user: any) {
        const result = await this.getGraphData(``, '');
        return result;
    }
}