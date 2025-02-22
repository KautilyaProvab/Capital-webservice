import { months } from "moment";
import { extname } from "path";

export function safeExecute(fn,deafult=null) {
    try {
      return fn();
    } catch (error) {
      return deafult;
    }
  }

export async function safeExecuteAsync<T>(fn: () => Promise<T>, defaultValue: any = null): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      return defaultValue;
    }
  }
export class DefaultMap<K, V> extends Map<K, V> {
    defaultFactory: () => V;

    constructor(defaultFactory: () => V, entries?: readonly (readonly [K, V])[] | null) {
        super(entries);
        this.defaultFactory = defaultFactory;
    }

    get(key: K): V {
        if (!this.has(key)) {
            this.set(key, this.defaultFactory());
        }
        return super.get(key) as V;
    }
}
export function dateFormat(dateInstance = new Date()) {
    const year = dateInstance.getFullYear();
    const month = dateInstance.getMonth() + 1;
    const date = dateInstance.getDate();
    return year + '-' + month.toString().padStart(2, '0') + '-' + date.toString().padStart(2, '0');
}

export function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

export function formatDateTime(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear(),
        hours = ("0" + d.getHours()).slice(-2),
        minutes = ("0" + d.getMinutes()).slice(-2),
        seconds = ("0" + d.getSeconds()).slice(-2);

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;
    var dateTime = year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;
    return dateTime;
}

export function formatHotelDateTime(date) {
    var d = new Date(parseInt(date)),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear(),
        hours = ("0" + d.getHours()).slice(-2),
        minutes = ("0" + d.getMinutes()).slice(-2),
        seconds = ("0" + d.getSeconds()).slice(-2);
    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;
    var dateTime = day + "-" + month + "-" + year ;
    return dateTime;
}

export function formatDepartDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear().toString().substr(-2);

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return day + month + year;
}

export function getDuration(DepartureTime: string, ArrivalTime: string) {
    const dt1 = new Date(DepartureTime);
    const dt2 = new Date(ArrivalTime);
    const diff = ((dt2.getTime() - dt1.getTime()) / 1000) / 60;
    // diff /= 60;
    return Math.abs(Math.round(diff));
}

export function duration(origin, destination) {
    const startDate = new Date(origin);
    // Do your operations
    const endDate = new Date(destination);
    const seconds = (endDate.getTime() - startDate.getTime()) / 1000;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    return hours + ' hr ' + (minutes - (hours * 60)) + ' min';

}
export function formatStringtDate(date) {

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
];
    var d = new Date(date),
        month =  (d.getMonth()),
        day = '' + d.getDate(),
        year = d.getFullYear().toString().substr(-2);
    if (day.length < 2)
        day = '0' + day;
        console.log("qqq" , day ,month,monthNames,year, monthNames[month])
    return day +" "+ monthNames[month].toUpperCase()+" "+ year;
}

export function formatStringtDateNoSpace(date) {

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
];
    var d = new Date(date),
        month =  (d.getMonth()),
        day = '' + d.getDate(),
        year = d.getFullYear().toString().substr(-2);
    if (day.length < 2)
        day = '0' + day;
        console.log("qqq" , day ,month,monthNames,year, monthNames[month])
    return day + monthNames[month].toUpperCase()+ year;
}

export function formatSearchDate(date){
    var dateArray = []
    var time =''
    if(date.includes('T')){
        date = date.replace('T',' ')
    }
    dateArray = date.split(' ')
    if(dateArray.length>1){
        time =dateArray[1].split('.')[0].split('-')[0].split('+')[0]
    }
    return dateArray[0]+' '+time
}

export function formatVoucherDate(date){
    var dateArray = []
    var time =''
    if(date.includes('T')){
        date = date.replace('T',' ')
    }
    dateArray = date.split(' ')
    if(dateArray.length>1){
        time =dateArray[1].split('.')[0].split('-')[0].split('+')[0]
    }
    return dateArray[0].split("-").reverse().join("-")+' '+time
}

export function undefinedToEmpty(obj, key) {
    return obj[key] ? obj[key] : '';
}

export function undefinedToSkip(obj, key) {
    return obj[key] ? key + '="' + obj[key] + '"' : '';
}

export function undefinedToUndefined(obj, key) {
    return obj[key] ? obj[key] : undefined;
}

export function getPropValue(obj, key) {
    return key.split('.').reduce((o, x) => o == undefined ? o : o[x], obj);
}

export function getPropValueOrEmpty(obj, key) {
    return key.split('.').reduce((o, x) => o == undefined ? '' : (o[x] == undefined ? '' : o[x]), obj);
}

export function htmlspecialchars(str) {
    if (str == null) return '';
    return String(str).
        replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;').
        replace(/"/g, '&quot;').
        replace(/'/g, '&#039;');
}

export function domain_base_currency() {
    // return $GLOBALS['CI']->db_cache_api->get_domain_base_currency();
    return 'USD';
}

export function toPascal(o) {
    var newO, origKey, newKey, value
    if (o instanceof Array) {
        return o.map(function (value) {
            if (typeof value === "object") {
                value = toPascal(value)
            }
            return value
        })
    } else {
        newO = {}
        for (origKey in o) {
            if (o.hasOwnProperty(origKey)) {
                newKey = (origKey.charAt(0).toUpperCase() + origKey.slice(1) || origKey).toString()
                value = o[origKey]
                if (value instanceof Array || (value !== null && value.constructor === Object)) {
                    value = toPascal(value)
                }
                newO[newKey] = value
            }
        }
    }
    return newO
}


export function toCamel(o) {
    var newO, origKey, newKey, value
    if (o instanceof Array) {
        return o.map(function (value) {
            if (typeof value === "object") {
                value = toCamel(value)
            }
            return value
        })
    } else {
        newO = {}
        for (origKey in o) {
            if (o.hasOwnProperty(origKey)) {
                newKey = (origKey.charAt(0).toLowerCase() + origKey.slice(1) || origKey).toString()
                value = o[origKey]
                if (value instanceof Array || (value !== null && value.constructor === Object)) {
                    value = toCamel(value)
                }
                newO[newKey] = value
            }
        }
    }
    return newO
}

export const imageFileFilter = (req, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return callback(new Error('Only image files are allowed!'), false);
    }
    callback(null, true);
};
export const editFileName = (req, file, callback) => {
    const name = file.originalname.split('.')[0];
    const fileExtName = extname(file.originalname);
    const randomName = Array(4)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
    callback(null, `${name}-${randomName}${fileExtName}`);
};

export function serialized_data(data) {
    // return base64_encode ( serialize ( data ) );
    return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function nl2br(str: string): string {
    return str.split("\n").join("<br/>");
}

export function valid_array(input: any) {
    if (input instanceof Object && input.constructor === Object) {
        return Object.keys(input).length > 0;
    }
    return Array.isArray(input) && input.length > 0;
}

export function noOfNights(i, o) {
    return Number((new Date(o).getTime() - new Date(i).getTime()) / (1000 * 60 * 60 * 24));
}
export function addDayInDate(date: Date, no_of_days: number) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + (d.getDate() + no_of_days),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

export function debug(msg: any) {
    console.log(msg);
    return true;
}
