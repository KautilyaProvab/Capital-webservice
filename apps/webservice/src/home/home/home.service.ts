import { Injectable } from '@nestjs/common';
import { HomeApi } from '../home.api';

@Injectable()
export class HomeService extends HomeApi {

    constructor() {
        super()
    }

    async getCoreCities(body: any) {
        const result = await this.getGraphData(`query {
                    coreCities(where: {name: {contains: "${body.name}"}}) {
                        name
                    }
                }`, 'coreCities');
        return result.map(t => {
            const tempData = {
                city_name: t.name,
                source: 'db'
            };
            return this.getCoreCitiesUniversal(tempData);
        });
    }

    async getUserProfile(req: any) {
        const result = await this.getGraphData(`
            query {
                authUser (
                    id: ${req.user.id}
                ) {
                    id
                    auth_role_id
                    email
                    date_of_birth
                    title
                    image
                    first_name
                    middle_name
                    last_name
                    address
                    address2
                    country
                    state
                    city
                    zip_code
                    phone_code
                    phone
                    created_at
                    last_login
                    logout_date_time
                    socialuserid
                    status
                    bio
                }
            }
        `, 'authUser');
        return result;
    }

    async getUserByEmail(body: any) {
        const result = await this.getGraphData(`
        authUsers (
            where: {
                email: {
                     eq: ${body.email}
                 }
             }
         ){
                    id
                    auth_role_id
                    email
                    date_of_birth
                    title
                    image
                    first_name
                    middle_name
                    last_name
                    address
                    address2
                    country
                    state
                    city
                    zip_code
                    phone_code
                    phone
                    created_at
                    last_login
                    logout_date_time
                    socialuserid
                    status
                    bio
                }
            }
        `, 'authUser');
        return result;
    }

    async updateUserProfile(body: any, req: any) {
        const result = await this.getGraphData(`
            mutation {
                updateAuthUser(
                    id: ${req.user.id}
                    authUserPartial: {
                        first_name: "${body.first_name}",
                        middle_name:"${body.middle_name}"
                        last_name: "${body.last_name}",
                        address: "${body.address}",
                        address2: "${body.address2}",
                        date_of_birth: "${body.date_of_birth}",
                        phone: "${body.phone}",
                        phone_code: "${body.phone_code}",
                        country: "${body.country}",
                        state: "${body.state}"
                        city: "${body.city}"
                        zip_code: ${body.zip_code}
                        bio:"${body.bio}"
                    }
                )
            }
        `, 'updateAuthUser');
        return result;
    }

    async updateStatus(body: any, req: any) {
        const result = await this.getGraphData(`
            mutation {
                updateAuthUser(
                    id: ${req.user.id}
                    authUserPartial: {
                        status: 0
                    }
                )
            }
        `, 'updateAuthUser');
        return result;
    }
}
