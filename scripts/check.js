import {readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const folder of ['server','public','api','tests','scripts'])for(const name of await readdir(folder))if(name.endsWith('.js'))execFileSync(process.execPath,['--check',`${folder}/${name}`],{stdio:'inherit'});
console.log('JavaScript syntax checks passed.');
