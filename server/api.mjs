export class ApiError extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
const fail=(status,code)=>{throw new ApiError(status,code)};
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
export const categories=['文學小說','心理勵志','歷史人文','商業管理','藝術設計','科學新知'];
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)?value:fail(422,'invalidData');
function text(data,key,optional=false){const value=data?.[key];if(optional&&(value===undefined||value===''))return '';if(typeof value!=='string'||!value.trim()||value.trim().length>160)fail(422,'invalidData');return value.trim();}
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail(422,'invalidDate');return value;}
function version(value){if(!Number.isInteger(value)||value<1)fail(422,'invalidData');return value;}
export function validateBook(data){const b=Object.fromEntries(['title','author','category','isbn','shelf'].map(k=>[k,text(data,k)]));if(!categories.includes(b.category))fail(422,'invalidData');b.color=typeof data.color==='string'&&/^#[a-f0-9]{6}$/i.test(data.color)?data.color:'#819c92';return b;}
export function validateReader(data){const r={name:text(data,'name'),card:text(data,'card'),email:text(data,'email',true)};if(r.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))fail(422,'invalidEmail');return r;}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'invalidData');
  if(Number(request.headers.get('content-length')||0)>2_000_000)fail(413,'tooLarge');
  const reader=request.body?.getReader();if(!reader)fail(400,'invalidData');
  let size=0;const chunks=[];while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>2_000_000){await reader.cancel();fail(413,'tooLarge')}chunks.push(next.value)}
  let data;try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}data=JSON.parse(new TextDecoder().decode(bytes))}catch{fail(400,'invalidData')}
  if(!data||typeof data!=='object'||Array.isArray(data))fail(422,'invalidData');return data;
}
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
async function row(db,sql,...args){return stmt(db,sql,...args).first()}
async function all(db,sql,...args){return (await stmt(db,sql,...args).all()).results}
async function changed(statement){const result=await statement.run();if(!result.meta?.changes)fail(409,'conflict');}
async function snapshot(db,owner){return {books:await all(db,'SELECT * FROM books WHERE owner=? ORDER BY created_at DESC,id',owner),readers:await all(db,'SELECT * FROM readers WHERE owner=? ORDER BY created_at DESC,id',owner),loans:await all(db,'SELECT * FROM loans WHERE owner=? ORDER BY created_at DESC,id',owner)}}
function addDays(value,count){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10)}
function validateImport(data){
  if(!['books','readers','loans'].every(k=>Array.isArray(data[k])))fail(422,'invalidData');
  const count=data.books.length+data.readers.length+data.loans.length;
  if(count>2000)fail(413,'tooLarge');if(!count)fail(422,'invalidData');
  const archived=value=>value==null?null:date(typeof value==='string'?value.slice(0,10):value);
  const books=data.books.map(b=>({...validateBook(b),id:id(b.id),archived_at:archived(b.archived_at)}));
  const readers=data.readers.map(r=>({...validateReader(r),id:id(r.id),archived_at:archived(r.archived_at)}));
  for(const [items,key] of [[books,'id'],[books,'isbn'],[readers,'id'],[readers,'card']])if(new Set(items.map(x=>x[key])).size!==items.length)fail(422,'invalidData');
  const bookMap=new Map(books.map(b=>[b.id,b])),readerMap=new Map(readers.map(r=>[r.id,r]));
  const loans=data.loans.map(l=>{if(!l||typeof l!=='object')fail(422,'invalidData');const loan={id:id(l.id),book:id(l.book),reader:id(l.reader),date:date(l.date),due:date(l.due),returned:l.returned===null?null:date(l.returned),renewals:l.renewals};const b=bookMap.get(loan.book),r=readerMap.get(loan.reader);if(!b||!r||loan.date>today()||loan.due<loan.date||loan.returned&&(loan.returned<loan.date||loan.returned>today())||![0,1].includes(loan.renewals)||!loan.returned&&(b.archived_at||r.archived_at))fail(422,'invalidData');return loan});
  if(new Set(loans.map(l=>l.id)).size!==loans.length||new Set(loans.filter(l=>!l.returned).map(l=>l.book)).size!==loans.filter(l=>!l.returned).length)fail(422,'invalidData');
  return {books,readers,loans};
}
export async function api(request,env){
  try{
    const url=new URL(request.url),path=url.pathname,method=request.method;
    if(path==='/api/health'&&method==='GET'){
      if(!env.DB)fail(503,'unavailable');
      await env.DB.prepare('SELECT 1 FROM books LIMIT 0').bind().all();
      return json({ok:true,database:'ready',version:'2.0.0'});
    }
    const owner=request.headers.get('oai-authenticated-user-id');if(!owner)fail(401,'signInRequired');
    if(!['GET','HEAD'].includes(method)){
      if(request.headers.get('origin')!==url.origin)fail(403,'forbidden');
      if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'forbidden');
    }
    if(!env.DB)fail(503,'unavailable');const db=env.DB;
    if(path==='/api/session'&&method==='GET')return json({user:{id:owner,email:request.headers.get('oai-authenticated-user-email')||'',role:'owner'}});
    if(path==='/api/state'&&method==='GET')return json(await snapshot(db,owner));
    if(path==='/api/audit'&&method==='GET')return json({events:await all(db,'SELECT seq,action,entity,entity_id,at FROM audit WHERE owner=? ORDER BY seq DESC LIMIT 100',owner)});
    if(path==='/api/export'&&method==='GET')return json({schemaVersion:2,exportedAt:new Date().toISOString(),...await snapshot(db,owner)});
    const parts=path.split('/').filter(Boolean);const resource=parts[1],recordId=parts[2];
    if(resource==='books'||resource==='readers'){
      const table=resource,validate=resource==='books'?validateBook:validateReader;
      if(!recordId&&method==='POST'){
        const value=validate(await body(request)),keys=Object.keys(value),newId=crypto.randomUUID();
        await stmt(db,`INSERT INTO ${table}(id,owner,${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')},?,?)`,newId,owner,...keys.map(k=>value[k])).run();
        return json({id:newId},201);
      }
      if(recordId&&parts.length===3&&method==='PUT'){
        id(recordId);const input=await body(request),v=version(input.version),value=validate(input),keys=Object.keys(value);
        await changed(stmt(db,`UPDATE ${table} SET ${keys.map(k=>k+'=?').join(',')},version=version+1 WHERE id=? AND owner=? AND version=? AND archived_at IS NULL`,...keys.map(k=>value[k]),recordId,owner,v));return json({ok:true});
      }
      if(recordId&&parts[3]==='archive'&&parts.length===4&&method==='POST'){
        id(recordId);const v=version((await body(request)).version),column=resource==='books'?'book':'reader';
        await changed(stmt(db,`UPDATE ${table} SET archived_at=?,version=version+1 WHERE id=? AND owner=? AND version=? AND archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM loans WHERE owner=? AND ${column}=? AND returned IS NULL)`,today(),recordId,owner,v,owner,recordId));return json({ok:true});
      }
      if(recordId&&parts[3]==='restore'&&parts.length===4&&method==='POST'){
        id(recordId);const v=version((await body(request)).version);
        await changed(stmt(db,`UPDATE ${table} SET archived_at=NULL,version=version+1 WHERE id=? AND owner=? AND version=? AND archived_at IS NOT NULL`,recordId,owner,v));return json({ok:true});
      }
    }
    if(path==='/api/loans'&&method==='POST'){
      const input=await body(request),book=id(input.book),reader=id(input.reader),due=date(input.due);if(due<today()||due>addDays(today(),60))fail(422,'invalidDate');
      const newId=crypto.randomUUID();
      await changed(stmt(db,'INSERT INTO loans(id,owner,book,reader,date,due) SELECT ?,?,b.id,r.id,?,? FROM books b JOIN readers r ON r.owner=b.owner WHERE b.owner=? AND b.id=? AND r.id=? AND b.archived_at IS NULL AND r.archived_at IS NULL',newId,owner,today(),due,owner,book,reader));return json({id:newId},201);
    }
    if(resource==='loans'&&recordId&&parts.length===4&&method==='POST'){
      id(recordId);const v=version((await body(request)).version);
      if(parts[3]==='return'){await changed(stmt(db,'UPDATE loans SET returned=?,version=version+1 WHERE owner=? AND id=? AND version=? AND returned IS NULL',today(),owner,recordId,v));return json({ok:true})}
      if(parts[3]==='renew'){await changed(stmt(db,"UPDATE loans SET due=date(due,'+14 days'),renewals=1,version=version+1 WHERE owner=? AND id=? AND version=? AND returned IS NULL AND renewals=0 AND due>=?",owner,recordId,v,today()));return json({ok:true})}
    }
    if(path==='/api/import'&&method==='POST'){
      const input=validateImport(await body(request)),token=crypto.randomUUID();
      const guard=stmt(db,'INSERT INTO imports(owner,token) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM books WHERE owner=?) AND NOT EXISTS(SELECT 1 FROM readers WHERE owner=?) AND NOT EXISTS(SELECT 1 FROM loans WHERE owner=?)',owner,token,owner,owner,owner);
      const statements=[guard];
      for(const [table,keys] of [['books',['id','title','author','category','isbn','shelf','color','archived_at']],['readers',['id','name','card','email','archived_at']],['loans',['id','book','reader','date','due','returned','renewals']]]){
        statements.push(stmt(db,`INSERT INTO ${table}(owner,${keys.join(',')}) SELECT ?,${keys.map(k=>`json_extract(value,'$.${k}')`).join(',')} FROM json_each(?) WHERE EXISTS(SELECT 1 FROM imports WHERE owner=? AND token=?)`,owner,JSON.stringify(input[table]),owner,token));
      }
      const result=await db.batch(statements);if(!result[0].meta?.changes)fail(409,'importNotEmpty');return json({ok:true},201);
    }
    fail(404,'notFound');
  }catch(error){
    if(error instanceof ApiError)return json({error:{code:error.code}},error.status);
    if(/UNIQUE constraint|FOREIGN KEY constraint|CHECK constraint/i.test(error.message||''))return json({error:{code:'conflict'}},409);
    console.error('API request failed',error.name);return json({error:{code:'unavailable'}},503);
  }
}
