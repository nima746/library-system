const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sources=['i18n.js','app.js','backend.js','ui.js'].map(file=>fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'));
function boot(storage=new Map()){
  const elements=new Map();
  const get=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',style:{},setAttribute(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(selector)};
  let serial=0;
  const context=vm.createContext({document:{documentElement:{lang:''},querySelector:get,querySelectorAll:()=>[]},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},crypto:{randomUUID:()=>`id-${++serial}`},Intl,Date,setTimeout:()=>0,fetch:async()=>({ok:false,status:503,json:async()=>({error:{code:'unavailable'}})}),FormData:class{constructor(form){return Object.entries(form.values)}}});
  sources.forEach(source=>vm.runInContext(source.trimEnd().replace(/boot\(\);$/,''),context));
  vm.runInContext(`db={books:seeds.map((b,i)=>({id:'book-'+i,title:b[0],author:b[1],category:b[2],color:b[3],isbn:'DEMO-'+i,shelf:'A-1',version:1,archived_at:null})),readers:[{id:'reader-1',name:'陳怡安',card:'R001',email:'reader@example.com',version:1,archived_at:null}],loans:[{id:'loan-1',book:'book-1',reader:'reader-1',date:day(-7),due:day(7),returned:null,renewals:0,version:1}]};ready=true;session={email:'owner@example.com',id:'owner'};render()`,context);
  return {run:code=>vm.runInContext(code,context),get,storage};
}
test('all languages cover the same translation keys and parameter placeholders',()=>{
  const app=boot();
  assert.equal(app.run(String.raw`(()=>{const base=translations['zh-Hant'];return Object.values(translations).every(dict=>Object.keys(dict).length===Object.keys(base).length&&Object.keys(base).every(key=>key in dict&&JSON.stringify((base[key].match(/\{\w+\}/g)||[]).sort())===JSON.stringify((dict[key].match(/\{\w+\}/g)||[]).sort())))})()`),true);
  const used=[...sources.slice(2).join('\n').matchAll(/\bt\('([^']+)'/g)].map(match=>match[1]).filter(key=>!key.endsWith('_'));
  for(const key of used)assert.equal(app.run(`Object.hasOwn(translations.en,${JSON.stringify(key)})`),true,key);
});
test('language selection persists, updates document semantics, and preserves library data',()=>{
  const app=boot();const before=app.run('JSON.stringify(db)');
  app.run(`changeLanguage('en')`);assert.equal(app.run('document.documentElement.lang'),'en');assert.equal(app.get('#title').textContent,'Catalog');
  app.run(`changeLanguage('ja')`);assert.equal(app.get('#title').textContent,'蔵書管理');assert.equal(app.run('JSON.stringify(db)'),before);assert.equal(app.storage.has('folio-v1'),false);
  const reloaded=boot(app.storage);assert.equal(reloaded.run('language'),'ja');assert.equal(reloaded.run('JSON.stringify(db)'),before);
  reloaded.run(`changeLanguage('invalid')`);assert.equal(reloaded.run('language'),'ja');
});
test('all pages and dialogs render in each language without losing searches or category identifiers',()=>{
  const app=boot();
  for(const lang of ['zh-Hant','en','ja']){
    app.run(`changeLanguage('${lang}');for(const id of ['overview','books','loans','readers','help','activity','settings'])navigate(id);navigate('books');query='原子';bookRows()`);
    assert.match(app.get('#bookRows').innerHTML,/原子習慣/);assert.doesNotMatch(app.get('#bookRows').innerHTML,/小王子/);
    app.run(`bookForm(db.books[0].id)`);assert.match(app.get('#modalBody').innerHTML,/value="心理勵志" selected/);
    app.run(`readerForm(db.readers[0].id)`);assert.match(app.get('#modalBody').innerHTML,/陳怡安/);
    app.run(`loanForm();returnLoan(db.loans[0].id)`);assert.ok(app.get('#modalBody').innerHTML.includes(app.run(`t('confirmReturn')`)));
  }
});
test('failed API mutations preserve frontend records; archived books are excluded from availability',async()=>{
  const app=boot();
  const before=app.run('JSON.stringify(db)');await app.run(`mutate(null,'/api/books','POST',{title:'new'},'bookSaved')`);assert.equal(app.run('JSON.stringify(db)'),before);
  app.run(`db.books[0].archived_at=day();navigate('books')`);assert.doesNotMatch(app.get('#bookRows').innerHTML,/被討厭的勇氣/);
  app.run(`filter='archived';books()`);assert.match(app.get('#bookRows').innerHTML,/被討厭的勇氣/);
  app.run(`loanForm()`);assert.doesNotMatch(app.get('#modalBody').innerHTML,/被討厭的勇氣/);
});
test('backup confirmation rejects non-array record collections without rendering untrusted counts',()=>{
  const app=boot();app.run(`confirmImport({books:{length:'<img src=x onerror=alert(1)>'},readers:[],loans:[]})`);
  assert.doesNotMatch(app.get('#modalBody').innerHTML,/<img/);
  assert.equal(app.get('#toast').textContent,app.run(`t('invalidData')`));
});
