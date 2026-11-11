import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const assets={};
for(const name of ['index.html','style.css','i18n.js','app.js','ui.js','backend.js'])assets['/'+name]=await readFile(path.join(root,'dist',name),'utf8');
const api=await readFile(path.join(root,'server/api.mjs'),'utf8');
const entry=`
const assets=${JSON.stringify(assets)};
const contentTypes={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/'))return api(request,env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const key=path==='/'?'/index.html':path;
  if(!Object.hasOwn(assets,key))return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:assets[key],{headers:{'Content-Type':contentTypes[key.split('.').pop()], 'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}});
}};
`;
await mkdir(path.join(root,'dist/server'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),api+entry);
await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/.openai/hosting.json'),await readFile(path.join(root,'.openai/hosting.json')));
console.log('Built full-stack Worker with embedded frontend assets.');
