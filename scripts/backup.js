import {mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {backupDatabase,closeDb} from '../server/db.js';

const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
const destination=resolve(process.argv[2]||`backups/sentinel-x-${stamp}.db`);
if(existsSync(destination))throw new Error(`Backup destination already exists: ${destination}`);
mkdirSync(dirname(destination),{recursive:true});
backupDatabase(destination);
closeDb();
console.log(destination);
