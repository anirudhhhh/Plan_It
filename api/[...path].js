import {handleApi} from '../server/api.js';
export default async function handler(req,res){
 if(Number(req.headers['content-length'])>32768||Buffer.byteLength(JSON.stringify(req.body||{}))>32768){res.status(413).json({error:{code:'TOO_LARGE',message:'Request too large.'}});return;}
 if(typeof req.body==='string'){try{req.body=JSON.parse(req.body);}catch{res.status(400).json({error:{code:'JSON',message:'Invalid JSON.'}});return;}}
 return handleApi(req,res);
}
