import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {api,today} from '../server/api.mjs';
import {openDatabase} from '../server/sqlite.mjs';
const schema=readFileSync(new URL('../drizzle/0000_library.sql',import.meta.url),'utf8');
const book={title:'Test <book>',author:'Author',category:'文學小說',isbn:'ITEM-001',shelf:'A-1',color:'#819c92'};
const reader={name:'Reader',card:'R001',email:'reader@example.com'};
function fixture(){const DB=openDatabase();DB.sqlite.exec(schema);return {DB,async request(path,method='GET',data,user='alice',origin='https://library.test'){
  const response=await api(new Request('https://library.test/api'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'}:{}),...(method!=='GET'?{'Origin':origin,'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})}),{DB});return {status:response.status,data:await response.json()};
}}}
async function create(f){const b=await f.request('/books','POST',book),r=await f.request('/readers','POST',reader);assert.equal(b.status,201);assert.equal(r.status,201);return {book:b.data.id,reader:r.data.id}}
test('authentication, origin protection and account isolation apply to reads and writes',async t=>{
 const f=fixture();t.after(()=>f.DB.close());
 assert.equal((await f.request('/state','GET',undefined,null)).status,401);
 assert.equal((await f.request('/books','POST',book,'alice','https://evil.test')).status,403);
 const ids=await create(f);assert.equal((await f.request('/state','GET',undefined,'bob')).data.books.length,0);
 assert.equal((await f.request('/books/'+ids.book,'PUT',{...book,version:1},'bob')).status,409);
 const bob=await f.request('/books','POST',book,'bob');assert.equal(bob.status,201);
 assert.equal((await f.request('/books','POST',book)).status,409);
 assert.equal((await f.request('/state')).data.books.length,1);
});
test('database readiness and records persist after closing and reopening SQLite',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'folio-api-test-')),file=join(directory,'library.sqlite');
 let DB=openDatabase(file);try{
  DB.sqlite.exec(schema);
  const response=await api(new Request('https://library.test/api/health'),{DB});assert.equal((await response.json()).database,'ready');
  await DB.prepare('INSERT INTO books(id,owner,title,author,category,isbn,shelf,color) VALUES(?,?,?,?,?,?,?,?)').bind('saved','alice','Saved','Author','文學小說','I001','A-1','#819c92').run();
  DB.close();DB=openDatabase(file);assert.equal((await DB.prepare('SELECT title FROM books WHERE owner=?').bind('alice').first()).title,'Saved');
 }finally{DB.close();unlinkSync(file);rmdirSync(directory)}
});
test('validation rejects malformed, missing and oversized input before database writes',async t=>{
 const f=fixture();t.after(()=>f.DB.close());
 for(const value of [{...book,title:' '},{...book,category:'Unknown'},{...book,title:'x'.repeat(161)}])assert.equal((await f.request('/books','POST',value)).status,422);
 assert.equal((await f.request('/readers','POST',{...reader,email:'invalid'})).status,422);
 const ids=await create(f);
 for(const due of ['2026-02-30','not-a-date','2000-01-01','2999-01-01'])assert.equal((await f.request('/loans','POST',{...ids,due})).status,422);
 assert.equal((await f.request('/import','POST',{books:[null],readers:[],loans:[]})).status,422);
 assert.equal((await f.request('/import','POST',{books:Array(2001).fill(book),readers:[],loans:[]})).status,413);
});
test('SQL enforces one active checkout and rejects archived or foreign-account entities',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const ids=await create(f);
 const attempts=await Promise.all([f.request('/loans','POST',{...ids,due:today()}),f.request('/loans','POST',{...ids,due:today()})]);
 assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
 assert.equal((await f.request('/loans','POST',{...ids,due:today()},'bob')).status,409);
 assert.equal((await f.request('/books/'+ids.book+'/archive','POST',{version:1})).status,409);
 assert.equal((await f.request('/readers/'+ids.reader+'/archive','POST',{version:1})).status,409);
 assert.equal((await f.request('/state')).data.loans.length,1);
});
test('optimistic updates, renewals, returns, reversible archives and audit trail',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const ids=await create(f);
 assert.equal((await f.request('/books/'+ids.book,'PUT',{...book,title:'Edited',version:1})).status,200);
 assert.equal((await f.request('/books/'+ids.book,'PUT',{...book,version:1})).status,409);
 const loan=(await f.request('/loans','POST',{...ids,due:today()})).data.id;
 assert.equal((await f.request('/loans/'+loan+'/renew','POST',{version:1})).status,200);
 assert.equal((await f.request('/loans/'+loan+'/renew','POST',{version:2})).status,409);
 assert.equal((await f.request('/loans/'+loan+'/return','POST',{version:1})).status,409);
 assert.equal((await f.request('/loans/'+loan+'/return','POST',{version:2})).status,200);
 assert.equal((await f.request('/loans/'+loan+'/renew','POST',{version:3})).status,409);
 assert.equal((await f.request('/books/'+ids.book+'/archive','POST',{version:2})).status,200);
 assert.equal((await f.request('/loans','POST',{...ids,due:today()})).status,409);
 assert.equal((await f.request('/books/'+ids.book+'/restore','POST',{version:3})).status,200);
 assert.equal((await f.request('/loans','POST',{...ids,due:today()})).status,201);
 const events=(await f.request('/audit')).data.events;assert.ok(events.some(e=>e.action==='archive'));assert.ok(events.some(e=>e.action==='restore'));assert.ok(events.some(e=>e.action==='return'));
 assert.equal((await f.request('/audit','GET',undefined,'bob')).data.events.length,0);
});
test('import is atomic, validates relationships, preserves historical links and can restore to a separate account',async t=>{
 const f=fixture();t.after(()=>f.DB.close());const data={books:[{...book,id:'book-1'}],readers:[{...reader,id:'reader-1'}],loans:[{id:'loan-1',book:'book-1',reader:'reader-1',date:'2020-01-01',due:'2020-01-15',returned:null,renewals:0}]};
 assert.equal((await f.request('/import','POST',{...data,loans:[{...data.loans[0],reader:'missing'}]})).status,422);
 assert.equal((await f.request('/state')).data.books.length,0);
 assert.equal((await f.request('/import','POST',data)).status,201);
 assert.equal((await f.request('/loans/loan-1/renew','POST',{version:1})).status,409);
 assert.equal((await f.request('/import','POST',data)).status,409);
 const backup=(await f.request('/export')).data;
 assert.equal((await f.request('/import','POST',backup,'bob')).status,201);
 const copied=(await f.request('/state','GET',undefined,'bob')).data;assert.equal(copied.loans[0].book,copied.books[0].id);assert.equal(copied.books[0].owner,'bob');
 const count=f.DB.sqlite.prepare('SELECT count(*) AS count FROM books').get().count;assert.equal(count,2);
});
