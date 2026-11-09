import {getHandler} from '../server/runtime.js';
export const config = {api:{bodyParser:false}};
export default function handler(req,res) {return getHandler()(req,res);}
