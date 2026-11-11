const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sources=['i18n.js','app.js','ui.js'].map(file=>fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'));
function boot(storage=new Map()){
  const elements=new Map();
  const get=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',style:{},setAttribute(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(selector)};
  let serial=0;
  const context=vm.createContext({document:{documentElement:{lang:''},querySelector:get,querySelectorAll:()=>[]},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},crypto:{randomUUID:()=>`id-${++serial}`},Intl,Date,setTimeout:()=>0,FormData:class{constructor(form){return Object.entries(form.values)}}});
  sources.forEach(source=>vm.runInContext(source,context));
  return {run:code=>vm.runInContext(code,context),get,storage};
}
test('all languages cover the same translation keys and parameter placeholders',()=>{
  const app=boot();
  assert.equal(app.run(String.raw`(()=>{const base=translations['zh-Hant'];return Object.values(translations).every(dict=>Object.keys(dict).length===Object.keys(base).length&&Object.keys(base).every(key=>key in dict&&JSON.stringify((base[key].match(/\{\w+\}/g)||[]).sort())===JSON.stringify((dict[key].match(/\{\w+\}/g)||[]).sort())))})()`),true);
  const used=[...sources[2].matchAll(/\bt\('([^']+)'/g)].map(match=>match[1]);
  for(const key of used)assert.equal(app.run(`Object.hasOwn(translations.en,${JSON.stringify(key)})`),true,key);
});
test('language selection persists, updates document semantics, and preserves library data',()=>{
  const app=boot();const before=app.storage.get('folio-v1');
  app.run(`changeLanguage('en')`);assert.equal(app.run('document.documentElement.lang'),'en');assert.equal(app.get('#title').textContent,'Catalog');
  app.run(`changeLanguage('ja')`);assert.equal(app.get('#title').textContent,'蔵書管理');assert.equal(app.storage.get('folio-v1'),before);
  const reloaded=boot(app.storage);assert.equal(reloaded.run('language'),'ja');assert.equal(reloaded.storage.get('folio-v1'),before);
  reloaded.run(`changeLanguage('invalid')`);assert.equal(reloaded.run('language'),'ja');
});
test('all pages and dialogs render in each language without losing searches or category identifiers',()=>{
  const app=boot();
  for(const lang of ['zh-Hant','en','ja']){
    app.run(`changeLanguage('${lang}');for(const id of ['overview','books','loans','readers','help'])navigate(id);navigate('books');query='原子';bookRows()`);
    assert.match(app.get('#bookRows').innerHTML,/原子習慣/);assert.doesNotMatch(app.get('#bookRows').innerHTML,/小王子/);
    app.run(`bookForm(db.books[0].id)`);assert.match(app.get('#modalBody').innerHTML,/value="心理勵志" selected/);
    app.run(`readerForm(db.readers[0].id)`);assert.match(app.get('#modalBody').innerHTML,/陳怡安/);
    app.run(`loanForm();returnLoan(db.loans[0].id)`);assert.ok(app.get('#modalBody').innerHTML.includes(app.run(`t('confirmReturn')`)));
  }
});
test('localized book entry, checkout, renewal and return keep stored records consistent',()=>{
  const app=boot();
  app.run(`changeLanguage('en');bookForm();$('#bookForm').values={title:'New book <test>',author:'Author',isbn:'NEW-001',category:'文學小說',shelf:'B-01'};$('#bookForm').onsubmit({preventDefault(){},target:$('#bookForm')})`);
  assert.equal(app.run(`db.books[0].title`),'New book <test>');assert.match(app.get('#bookRows').innerHTML,/New book &lt;test&gt;/);
  app.run(`changeLanguage('ja');loanForm(db.books[0].id);$('#loanForm').values={book:db.books[0].id,reader:db.readers[0].id,due:day(14)};$('#loanForm').onsubmit({preventDefault(){},target:$('#loanForm')})`);
  assert.equal(app.run('!!activeLoan(db.books[0].id)'),true);
  const original=app.run('db.loans[0].due');app.run('renew(db.loans[0].id)');const extended=app.run('db.loans[0].due');assert.ok(extended>original);
  app.run('renew(db.loans[0].id)');assert.equal(app.run('db.loans[0].due'),extended);
  app.run(`returnLoan(db.loans[0].id);$('#returnForm').onsubmit({preventDefault(){}})`);assert.equal(app.run('!!activeLoan(db.books[0].id)'),false);
  const overdue=app.run('db.loans.find(isLate).due');app.run('renew(db.loans.find(isLate).id)');assert.equal(app.run('db.loans.find(isLate).due'),overdue);
});
