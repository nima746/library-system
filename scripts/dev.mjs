import '../scripts/build.mjs';
import {createServer} from 'node:http';
import {mkdirSync,readFileSync} from 'node:fs';
import {openDatabase} from '../server/sqlite.mjs';
const {default:worker}=await import('../dist/server/index.js');
mkdirSync('.local',{recursive:true});
const DB=openDatabase('.local/library.sqlite');
DB.sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
const migration='0000_library';
if(!DB.sqlite.prepare('SELECT 1 FROM local_migrations WHERE name=?').get(migration)){
  DB.sqlite.exec('BEGIN');try{DB.sqlite.exec(readFileSync('drizzle/0000_library.sql','utf8'));DB.sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(migration);DB.sqlite.exec('COMMIT')}catch(error){DB.sqlite.exec('ROLLBACK');throw error}
}
const port=Number(process.env.PORT||8000);
const server=createServer(async(req,res)=>{
  try{
    // Local developer identity is injected here, never in the production Worker.
    const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value&&!key.startsWith('oai-'))headers.set(key,Array.isArray(value)?value.join(','):value);
    headers.set('oai-authenticated-user-id','local-developer');headers.set('oai-authenticated-user-email','developer@localhost');
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2_000_000){res.writeHead(413);res.end();return}chunks.push(chunk)}
    const url=`http://127.0.0.1:${port}${req.url}`;
    if(req.url.startsWith('/signin-with-chatgpt')||req.url.startsWith('/signout-with-chatgpt')){res.writeHead(302,{Location:'/'});res.end();return}
    const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error(error);res.writeHead(500);res.end('Local server error')}
});
server.listen(port,'127.0.0.1',()=>console.log(`FOLIO local development: http://127.0.0.1:${port} (local developer identity; SQLite in .local/)`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{DB.close();process.exit(0)}));
