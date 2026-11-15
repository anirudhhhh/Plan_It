import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {handleApi} from './api.js';
import {demo} from './store.js';
import {renderPage} from './render.js';
export const security={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' https: data:; connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
};
const root=resolve('public');
export const server=createServer(async(req,res)=>{for(const [k,v]of Object.entries(security))res.setHeader(k,v);if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');try{
 if(req.url.startsWith('/api/v1/')||req.url==='/health'){if(req.url==='/health')req.url='/api/v1/health';let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>32768){res.writeHead(413);res.end('Request too large');return;}chunks.push(c);}try{req.body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};}catch{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'JSON',message:'Invalid JSON.'}}));return;}await handleApi(req,res);return;}
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/robots.txt'){res.setHeader('Content-Type','text/plain');res.end('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /trips\nDisallow: /account\n');return;}
 if(path==='/sitemap.xml'){const origin=process.env.SITE_URL||'http://localhost:3000';res.setHeader('Content-Type','application/xml');res.end(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/packs','/packs/ayodhya','/packs/bodh-gaya','/packs/rajgir','/stays','/rides','/about'].map(p=>`<url><loc>${origin}${p}</loc></url>`).join('')}</urlset>`);return;}
 let file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+'/')&&file!==root){res.writeHead(403);res.end();return;}
 let data;try{if((await stat(file)).isDirectory())file=resolve(file,'index.html');data=await readFile(file);}catch{if(extname(path)){res.writeHead(404);res.end('Not found');return;}file=resolve(root,'index.html');data=await readFile(file);}
 if(file.endsWith('index.html'))data=await renderPage(path);
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'})[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control',['.html','.js','.css'].includes(extname(file))?'no-cache':'public, max-age=3600');res.end(data);
 }catch{res.writeHead(500);res.end('Unable to serve this page.');}});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log(`PLAN-IT http://127.0.0.1:${process.env.PORT||3000} (${demo?'LOCAL DEMO':'configured services'})`));
