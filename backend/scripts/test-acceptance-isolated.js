// Runs against a fresh, isolated local database; never seeds or migrates the configured business database.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const net = require('node:net');
const {spawn} = require('node:child_process');
const mysql = require('mysql2/promise');
require('dotenv').config();
const root=path.resolve(__dirname,'..');
const dbName='waterproof_test_acceptance_'+crypto.randomBytes(6).toString('hex');
let server,db;
async function child(file,env) {
  return new Promise((resolve,reject)=>{
    const proc=spawn(process.execPath,[file],{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='';
    proc.stdout.on('data',chunk=>{output+=chunk;});proc.stderr.on('data',chunk=>{output+=chunk;});
    proc.on('error',reject);proc.on('close',code=>{if(code===0){console.log('PASS '+file);if(file.includes('test-review'))console.log(output);}else reject(new Error(file+' failed\n'+output));});
  });
}
async function main(){
  const host=process.env.DB_HOST||'localhost';
  if(!['localhost','127.0.0.1','::1'].includes(host))throw Error('Isolated runner requires a local MySQL server');
  const port=await new Promise(resolve=>{const listener=net.createServer();listener.listen(0,'127.0.0.1',()=>{const value=listener.address().port;listener.close(()=>resolve(value));});});
  const env={...process.env,DB_NAME:dbName,NODE_ENV:'test',ALLOW_ISOLATED_TEST:'yes',HOST:'127.0.0.1',PORT:String(port),TEST_BASE_URL:`http://127.0.0.1:${port}`,PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,JWT_SECRET:crypto.randomBytes(48).toString('hex')};
  for(const key of Object.keys(env))if(key.startsWith('WECHAT_'))env[key]='';
  db=await mysql.createConnection({host,port:process.env.DB_PORT||3306,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
  await db.query(`CREATE DATABASE ${dbName} CHARACTER SET utf8mb4`);
  await db.query(`USE ${dbName}`);
  for(const file of ['scripts/migrate.js','scripts/migrate-phase3.js','scripts/migrate-review.js','scripts/migrate-acceptance.js','scripts/migrate-acceptance.js'])await child(file,env);
  server=spawn(process.execPath,['src/app.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let startup='';server.stdout.on('data',chunk=>{startup=(startup+chunk).slice(-3000);});server.stderr.on('data',chunk=>{startup=(startup+chunk).slice(-3000);});
  for(let attempt=0;attempt<50;attempt++){
    try{if((await fetch(env.TEST_BASE_URL+'/health')).ok)break;}catch{}
    if(attempt===49)throw Error('Test server did not start: '+startup);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  await child('scripts/test-review-integration.js',env);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
  if(server && server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
  if(db){
    try{
      const [tables]=await db.query("SHOW TABLES LIKE 'uploads'");
      if(tables.length){const [uploads]=await db.query('SELECT filename,is_public FROM uploads');for(const file of uploads)await fs.promises.rm(path.join(root,file.is_public?'uploads':'private-uploads',file.filename),{force:true});}
      if(/^waterproof_test_acceptance_[a-f0-9]{12}$/.test(dbName))await db.query(`DROP DATABASE ${dbName}`);
      console.log('Isolated database and uploaded fixtures cleaned');
    } finally {await db.end();}
  }
});
