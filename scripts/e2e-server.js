import {rm} from 'node:fs/promises';
process.env.LOCAL_DEMO='true';process.env.DEMO_DATA_FILE='.local/e2e.json';process.env.PORT='3100';
delete process.env.DATABASE_URL;
await rm('.local/e2e.json',{force:true});
await import('../server/http.js');
