import { getManager } from "typeorm";
import { QUERY_FAILURE, QUERY_SUCCESS } from "./constants";

export class Custom_Db {
    protected manager = getManager();
	async single_table_records(table: string, cols='*', condition:any = [], offset=0, limit=100000000, order_by=[])
	{
		let data:any = '';
		if (table != '') {
			if (order_by.length) {
				for ( const [k, v] of order_by) {
					// this->db->order_by(k, v);
				}
			}
			if (!condition.length) {
				condition = true;
			}
            // tmp_data = this->db->select(cols)->get_where(table, condition, limit, offset);
            const tmp_data = await this.manager.query(`select ${cols} from ${table} where ${condition}`);
			if(tmp_data.length) {
                data = { status: QUERY_SUCCESS, data: tmp_data };
			} else {
                data = { status: QUERY_FAILURE };
			}
		} else {
			// redirect('general/redirect_login?op=R');
		}
		return data;
	}
	async multiple_table_cross_records(tables=[], cols='*', joincondition=[], condition=[], offset=0, limit=1000, order_by=[]){
		let data: any = '';
		if (tables.length && joincondition.length) {
			if (order_by.length) {
				for ( const [k, v] of order_by ) {
					// this->db->order_by(k, v);
				}
			}
			for(let i=1;i<tables.length;i++){
				for(const [ck, cv] of joincondition) {
					// this->db->join(tables[i], ck."=".cv);
				}
			}
            // const tmp_data = this->db->select(cols)->get_where(tables[0], condition, limit, offset)->result_[];
            const tmp_data = await this.manager.query(`select ${cols} from ${tables[0]} where ${condition}`);
			data = { status: QUERY_SUCCESS, data: tmp_data };
		} else {
			// redirect('general/redirect_login?op=R');
		}
		return data;
	}
	async insert_record (table_name: string, data: any)
    {
        const num_inserts = await this.manager.query(`insert into ${table_name} values (${data})`);
		if (num_inserts.affectedRows > 0) {
            data = { status: QUERY_SUCCESS, insert_id: num_inserts.insertId };
		} else {
			// redirect('general/redirect_login?op=C');
		}
		return data;
	}
	/*async update_record (table_name='', data='', condition='')
	{
		status = '';
		if (valid_array(data) == true and valid_array(condition)) {
			this->db->update(table_name, data, condition);
			if(this->db->affected_rows()>0) {
				status = QUERY_SUCCESS;
			} else {
				status = QUERY_FAILURE;
			}
		} else {
			redirect('general/redirect_login?op=U');
		}
		return status;
	}
	async delete_record(table_name='',  condition='')
	{
		status = '';
		if (valid_array(condition)) {
			this->db->delete(table_name, condition);
			status = QUERY_SUCCESS;
		} else {
			redirect('general/redirect_login?op=D');
		}
		return status;
	}*/

	async generate_static_response(data, desc='')
	{
        const insert_id = this.insert_record('test', { 'test': data, 'description': desc });
		return insert_id['insert_id'];
	}
	/*async get_static_response(origin=0)
	{
		data = this->custom_db->single_table_records('provab_api_response_history', 'response', array('origin' => origin));
		return data['data'][0]['response'];
	}
	async get_custom_condition(cond)
	{
		sql = ' AND ';
		if (valid_array(cond) == true) {
			foreach (cond as k => v) {
				sql .= v[0].' '.v[1].' '.v[2].' AND ';
			}
		}
		sql = rtrim(sql, ' AND ');
		return sql;
	}
	async get_custom_query(query)
	{
		result_array = this->db->query(query)->result_[];
		data = [];
		if(result_array){
			data['status'] = QUERY_SUCCESS;
			data['data'] = result_array;
		}else{
			data['status'] = QUERY_FAILURE;
			data['data'] = [];
		}
		return data;
	} */
}