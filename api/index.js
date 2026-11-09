import {getHandler} from '../server/runtime.js';
import {webHandler} from '../server/web.js';
export default {fetch(request) {return webHandler(getHandler())(request);}};
