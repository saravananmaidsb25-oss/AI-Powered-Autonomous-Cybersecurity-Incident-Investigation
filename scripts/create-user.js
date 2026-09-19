import {createLocalUser} from '../server/sessions.js';
import {seedTenant,closeDb} from '../server/db.js';
const [tenantId,username,role='analyst']=process.argv.slice(2);
try{seedTenant(tenantId||'default');const user=await createLocalUser({tenantId:tenantId||'default',username,role,password:process.env.SENTINEL_X_NEW_USER_PASSWORD});console.log(`Created ${user.role} ${user.username} in ${user.tenantId}.`);}finally{closeDb();}
