import {renderPage} from '../server/render.js';
export default async function page(req,res){try{
 const url=new URL(req.url,'http://localhost'),route=req.query?.route||url.searchParams.get('route')||url.pathname;
 const path=typeof route==='string'&&route.startsWith('/')&&!route.startsWith('//')?route:'/';
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control',/^\/(?:account|admin|auth|trips|booking-requests|notifications)(?:\/|$)/.test(path)?'no-store':'public, max-age=0, s-maxage=60, stale-while-revalidate=60');
 res.end(await renderPage(path));
 }catch{res.setHeader('Cache-Control','no-store');res.status(503).send('PLAN-IT is temporarily unavailable. Please try again.');}}
