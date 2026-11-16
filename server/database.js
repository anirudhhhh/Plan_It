import pg from 'pg';
let pool;
export function databaseOptions(env=process.env,{migration=false}={}){
 const value=migration?(env.DATABASE_MIGRATION_URL||env.DATABASE_URL):env.DATABASE_URL;if(!value)throw new Error('Configure DATABASE_URL.');
 let url;try{url=new URL(value);}catch{throw new Error('Invalid database URL.');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('Invalid database URL.');
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(env.DATABASE_SSL==='false'&&!local)throw new Error('DATABASE_SSL=false is only allowed on loopback.');
 // URL SSL options override pg's explicit TLS object; keep certificate verification authoritative.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
 return {connectionString:url.href,max:migration?1:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,allowExitOnIdle:true,ssl:env.DATABASE_SSL==='false'?false:{rejectUnauthorized:true,...(env.DATABASE_CA_CERT?{ca:env.DATABASE_CA_CERT.replaceAll('\\n','\n')}:{})}};
}
export function databasePool(){if(!pool){pool=new pg.Pool(databaseOptions());pool.on('error',()=>console.error(JSON.stringify({event:'database_pool_error'})));}return pool;}
export async function closeDatabase(){const old=pool;pool=undefined;await old?.end();}
