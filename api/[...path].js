import {handleApi} from '../server/api.js';
export default async function handler(req,res){if(Number(req.headers['content-length'])>32768){res.status(413).json({error:{code:'TOO_LARGE',message:'Request too large.'}});return;}return handleApi(req,res);}
