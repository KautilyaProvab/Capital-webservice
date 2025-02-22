import { getManager } from "typeorm";
import { getPropValue, valid_array } from "../../app.helper";
import { FAILURE_STATUS, SUCCESS_STATUS } from "../../constants";

export class Flight_Model {
    
    protected manager = getManager();

    update_ticket_cancel_status(app_reference: any, sequence_number: any, origin: any) {
        // throw new Error("Method not implemented.");
        return true;
    }
        
    async get_flight_booking_transaction_details(app_reference: any, sequence_number: any, booking_source: any = '', booking_status: any = '') {
        const response = {};
        response['status'] = FAILURE_STATUS;
		response['data'] = [];
		//Booking Details
		let bd_query = `select BD.*, DL.domain_name, DL.id as domain_id from flight_bookings AS BD, webservice_users AS DL WHERE DL.id = BD.domain_origin AND BD.app_reference like ${app_reference}`;
		if (booking_status != '') {
			bd_query += ` AND BD.status = ${booking_status}`;
		}
		//Transaction Details
		let td_query = `select TD.*,CAST(TD.status AS UNSIGNED) as status_code,BS.name as booking_api_name from flight_booking_transaction_details AS TD 
					left join webservice_api_list BS on BS.source_id=TD.booking_source
					WHERE TD.app_reference='.this->db->escape(app_reference).' AND TD.sequence_number='.intval(sequence_number)`;
		if (booking_source != '') {
			td_query += ` AND TD.booking_source = '.this->db->escape(booking_source)`;
		}
		const booking_transaction_details = await this.manager.query(td_query);
		const flight_booking_transaction_details_origin = getPropValue(booking_transaction_details,'0.origin');
                
		//Itinerary Details
		const id_query = `select ID.* from flight_booking_itinerary_details AS ID WHERE ID.app_reference='.this->db->escape(app_reference).' AND ID.flight_booking_transaction_details_fk='.flight_booking_transaction_details_origin`;
		
		//Customer and Ticket Details
		const cd_query = `select CD.*,FPTI.TicketId,FPTI.TicketNumber,FPTI.IssueDate,FPTI.Fare,FPTI.SegmentAdditionalInfo
						from flight_booking_passenger_details AS CD
						left join flight_passenger_ticket_info FPTI on CD.origin=FPTI.passenger_fk
						WHERE CD.flight_booking_transaction_details_fk='.flight_booking_transaction_details_origin`;
		//Cancellation Details
		const cancellation_details_query = `select FCD.*
						from flight_booking_passenger_details AS CD
						left join flight_cancellation_details AS FCD ON FCD.passenger_fk=CD.origin
						WHERE CD.flight_booking_transaction_details_fk='.flight_booking_transaction_details_origin`;
	
		
		//Baggage Details
		const baggage_query = `select CD.flight_booking_transaction_details_fk,CD.passenger_type,
						concat(CD.first_name," ", CD.middle_name," ", CD.last_name) as pax_name,FBG.*
						from flight_booking_passenger_details AS CD
						join flight_booking_baggage_details FBG on CD.origin=FBG.passenger_fk
						WHERE CD.flight_booking_transaction_details_fk IN 
						(select TD.origin from flight_booking_transaction_details AS TD 
						WHERE TD.app_reference ='.this->db->escape(app_reference).')'`;
		//Meal Details
		const meal_query = `select CD.flight_booking_transaction_details_fk,
						concat(CD.first_name," ", CD.last_name) as pax_name,FML.*
						from flight_booking_passenger_details AS CD
						join flight_booking_meal_details FML on CD.origin=FML.passenger_fk
						WHERE CD.flight_booking_transaction_details_fk IN 
						(select TD.origin from flight_booking_transaction_details AS TD 
						WHERE TD.app_reference ='.this->db->escape(app_reference).')'`;
						// echo meal_query;exit;
		//Seat Details
		const seat_query = `select CD.flight_booking_transaction_details_fk,
						concat(CD.first_name," ", CD.last_name) as pax_name,FST.*
						from flight_booking_passenger_details AS CD
						join flight_booking_seat_details FST on CD.origin=FST.passenger_fk
						WHERE CD.flight_booking_transaction_details_fk IN 
						(select TD.origin from flight_booking_transaction_details AS TD 
						WHERE TD.app_reference ='.this->db->escape(app_reference).')'`;

		response['data']['booking_details']			= await this.manager.query(bd_query);
		response['data']['booking_transaction_details']	= booking_transaction_details;
		response['data']['booking_itinerary_details']	= await this.manager.query(id_query);
		response['data']['booking_customer_details']	= await this.manager.query(cd_query);
		response['data']['cancellation_details']	= await this.manager.query(cancellation_details_query);
		response['data']['baggage_details']	= await this.manager.query(baggage_query);
		response['data']['meal_details']	= await this.manager.query(meal_query);
		response['data']['seat_details']	= await this.manager.query(seat_query);
		if (valid_array(response['data']['booking_details']) == true && valid_array(response['data']['booking_transaction_details']) && valid_array(response['data']['booking_itinerary_details']) && valid_array(response['data']['booking_customer_details'])) {
			response['status'] = SUCCESS_STATUS;
		}
		return response;
    }

}