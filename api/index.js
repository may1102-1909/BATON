import {getHandler} from '../server/runtime.js';
import {webHandler} from '../server/web.js';

export default async function handler(req, res) {
  if (res && typeof res.writeHead === 'function') {
    return getHandler()(req, res);
  }
  return webHandler(getHandler())(req);
}
