function save(){localStorage.setItem('folio-v1',JSON.stringify(db))}
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2800)}
function activeLoan(id){return db.loans.find(l=>l.book===id&&!l.returned)}
function isLate(l){return !l.returned&&l.due<day()}
function navigate(p){page=p;query='';filter='all';category='';currentPage=1;render()}
function render(){
  save();updateChrome();
  $('#nav').innerHTML=menus.map(([id,icon])=>`<button class="${page===id?'active':''}" onclick="navigate('${id}')"><span>${icon}</span>${t(id)}</button>`).join('');
  $('#title').textContent=t(page);$('#crumb').textContent=t(page);
  $('#today').textContent=new Intl.DateTimeFormat(locale(),{year:'numeric',month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Taipei'}).format(new Date());
  $('#add').hidden=['overview','help'].includes(page);$('#add').textContent=t(page==='books'?'addBook':page==='readers'?'addReader':'addLoan');
  $('#add').onclick=page==='books'?()=>bookForm():page==='readers'?()=>readerForm():()=>loanForm();
  const borrowed=db.loans.filter(l=>!l.returned).length;
  $('#stats').innerHTML=[['totalBooks',db.books.length,'totalNote','▤'],['available',db.books.length-borrowed,'availableNote','▥'],['borrowed',borrowed,'borrowedNote','⇄'],['overdue',db.loans.filter(isLate).length,'overdueNote','◷']].map(([key,n,note,icon])=>`<article class="stat"><div class="stat-top">${t(key)}<span class="stat-icon">${icon}</span></div><strong>${n.toLocaleString(locale())}</strong><small>${t(note)}</small></article>`).join('');
  ({books,loans,readers,overview,help}[page])();
}
function bookCell(b){return `<div class="bookcell"><div class="cover" style="--cover:${/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#819c92'}">${esc(b.title)}</div><div><b>${esc(b.title)}</b><small>${esc(b.isbn)}</small></div></div>`}
function status(b){let l=activeLoan(b.id);return `<span class="pill status ${l?(isLate(l)?'late':'out'):''}">● ${t(l?(isLate(l)?'overdue':'borrowed'):'available')}</span>`}
function tabs(items,handler){return `<div class="tabs">${items.map(([value,key])=>`<button class="${filter===value?'active':''}" onclick="filter='${value}';currentPage=1;${handler}()">${t(key)}</button>`).join('')}</div>`}
function headings(keys){return `<thead><tr>${keys.map(k=>`<th>${t(k)}</th>`).join('')}</tr></thead>`}
function empty(key,columns=6){return `<tr><td colspan="${columns}" class="empty">${t(key)}</td></tr>`}
function categoryOptions(selected=''){return categories.map(c=>`<option value="${esc(c)}" ${selected===c?'selected':''}>${esc(categoryName(c))}</option>`).join('')}
let sortOrder='new';
function books(){
  $('#view').innerHTML=`<div class="panel"><div class="panel-head"><h2>${t('catalog')}<small>CATALOG</small></h2><span class="pill">${t('branch')}</span></div>${tabs([['all','allBooks'],['available','available'],['out','borrowed']],'books')}<div class="toolbar"><div class="search"><span>⌕</span><input id="search" aria-label="${t('searchBooks')}" placeholder="${t('bookPlaceholder')}" value="${esc(query)}" oninput="query=this.value;currentPage=1;bookRows()"></div><select aria-label="${t('category')}" onchange="category=this.value;currentPage=1;bookRows()"><option value="">${t('allCategories')}</option>${categoryOptions(category)}</select><select aria-label="${t('sort')}" id="sort" onchange="sortOrder=this.value;bookRows()"><option value="new" ${sortOrder==='new'?'selected':''}>${t('registered')}</option><option value="title" ${sortOrder==='title'?'selected':''}>${t('titleSort')}</option></select></div><div class="table-wrap"><table>${headings(['bookInfo','author','category','shelf','catalogStatus','actions'])}<tbody id="bookRows"></tbody></table></div><div id="paging" class="pagination"></div></div>`;
  bookRows();
}
function bookRows(){
  let list=db.books.filter(b=>(b.title+b.author+b.isbn).toLowerCase().includes(query.toLowerCase())&&(!category||b.category===category)&&(filter==='all'||(filter==='out'?!!activeLoan(b.id):!activeLoan(b.id))));
  if(sortOrder==='title')list.sort((a,b)=>a.title.localeCompare(b.title,locale()));
  let max=Math.max(1,Math.ceil(list.length/8));currentPage=Math.min(currentPage,max);
  $('#bookRows').innerHTML=list.slice((currentPage-1)*8,currentPage*8).map(b=>`<tr><td>${bookCell(b)}</td><td>${esc(b.author)}</td><td><span class="pill">${esc(categoryName(b.category))}</span></td><td>${esc(b.shelf)}</td><td>${status(b)}</td><td><button class="row-action" onclick="${activeLoan(b.id)?`returnLoan('${activeLoan(b.id).id}')`:`loanForm('${b.id}')`}">${t(activeLoan(b.id)?'returnAction':'borrow')} ↗</button><button class="row-action" aria-label="${t('edit')} ${esc(b.title)}" onclick="bookForm('${b.id}')">⋯</button></td></tr>`).join('')||empty('noBooks');
  $('#paging').innerHTML=`<span>${t('bookPaging',{count:list.length,page:currentPage,max})}</span><div><button aria-label="${t('previous')}" ${currentPage===1?'disabled':''} onclick="currentPage--;bookRows()">←</button><button aria-current="page">${currentPage}</button><button aria-label="${t('next')}" ${currentPage===max?'disabled':''} onclick="currentPage++;bookRows()">→</button></div>`;
}
function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}
function closeModal(){$('#modal').close()}
function buttons(key='save'){return `<div class="form-actions"><button type="button" onclick="closeModal()">${t('cancel')}</button><button class="primary">${t(key)}</button></div>`}
function field(key,name,value='',required=true,type='text'){return `<label>${t(key)}<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} maxlength="160"></label>`}
function bookForm(id){
  let b=db.books.find(b=>b.id===id)||{};
  modal(`<h2>${t(id?'editBook':'newBook')}</h2><form id="bookForm">${field('bookTitle','title',b.title)}${field('author','author',b.author)}${field('isbn','isbn',b.isbn)}<label>${t('category')}<select name="category">${categoryOptions(b.category)}</select></label>${field('shelf','shelf',b.shelf)}${buttons()}</form>`);
  $('#bookForm').onsubmit=e=>{e.preventDefault();let data=Object.fromEntries(new FormData(e.target));Object.keys(data).forEach(k=>data[k]=data[k].trim());if(!data.title||!data.author||!data.isbn||!data.shelf)return toast(t('incomplete'));if(db.books.some(x=>x.id!==id&&x.isbn===data.isbn))return toast(t('duplicateBook'));if(id)Object.assign(b,data);else db.books.unshift({...data,id:uid(),color:'#819c92'});closeModal();render();toast(t('bookSaved'))};
}
function loanForm(bookId){
  let available=db.books.filter(b=>!activeLoan(b.id));if(!available.length)return toast(t('noAvailable'));if(!db.readers.length)return toast(t('addReaderFirst'));
  modal(`<h2>${t('checkout')}</h2><form id="loanForm"><label>${t('selectBook')}<select name="book">${available.map(b=>`<option value="${b.id}" ${b.id===bookId?'selected':''}>${esc(b.title)} · ${esc(b.isbn)}</option>`).join('')}</select></label><label>${t('borrower')}<select name="reader">${db.readers.map(r=>`<option value="${r.id}">${esc(r.name)} · ${esc(r.card)}</option>`).join('')}</select></label><label>${t('due')}<input type="date" name="due" min="${day()}" value="${day(14)}" required></label><p>${t('loanPolicy')}</p>${buttons('confirmCheckout')}</form>`);
  $('#loanForm').onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));if(activeLoan(d.book))return toast(t('alreadyBorrowed'));db.loans.unshift({...d,id:uid(),date:day(),returned:null,renewals:0});closeModal();render();toast(t('loanSaved'))};
}
function returnLoan(id){
  let l=db.loans.find(x=>x.id===id),b=db.books.find(b=>b.id===l.book);
  modal(`<h2>${t('confirmReturn')}</h2><p>${esc(t('returnDescription',{title:b.title}))}</p><form id="returnForm">${buttons('confirmReturn')}</form>`);
  $('#returnForm').onsubmit=e=>{e.preventDefault();l.returned=day();closeModal();render();toast(t('returnedToast'))};
}
function renew(id){let l=db.loans.find(x=>x.id===id);if(isLate(l))return toast(t('overdueRenew'));if(l.renewals)return toast(t('renewedAlready'));let d=new Date(l.due+'T12:00:00');d.setDate(d.getDate()+14);l.due=d.toISOString().slice(0,10);l.renewals=1;render();toast(t('renewedToast'))}
function formatDate(value){return new Intl.DateTimeFormat(locale(),{year:'numeric',month:'short',day:'numeric'}).format(new Date(value+'T12:00:00'))}
function loans(){
  let list=db.loans.filter(l=>filter==='all'||(filter==='late'?isLate(l):filter==='returned'?!!l.returned:!l.returned));
  $('#view').innerHTML=`<div class="panel"><div class="panel-head"><h2>${t('loanRecords')}<small>CIRCULATION</small></h2></div>${tabs([['all','allRecords'],['active','borrowed'],['late','overdue'],['returned','returned']],'loans')}<div class="table-wrap"><table>${headings(['bookInfo','borrower','checkoutDate','due','status','actions'])}<tbody>${list.map(l=>{let b=db.books.find(b=>b.id===l.book),r=db.readers.find(r=>r.id===l.reader);return `<tr><td>${bookCell(b)}</td><td>${esc(r.name)}</td><td>${formatDate(l.date)}</td><td>${formatDate(l.due)}</td><td><span class="pill status ${isLate(l)?'late':l.returned?'':'out'}">${t(l.returned?'returned':isLate(l)?'overdue':'borrowed')}</span></td><td>${!l.returned?`<button class="row-action" onclick="returnLoan('${l.id}')">${t('return')}</button><button class="row-action" onclick="renew('${l.id}')" ${isLate(l)||l.renewals?'disabled':''}>${t(l.renewals?'renewed':'renew')}</button>`:formatDate(l.returned)}</td></tr>`}).join('')||empty('noLoans')}</tbody></table></div><div class="pagination">${t('loanCount',{count:list.length})}</div></div>`;
}
function readers(){
  $('#view').innerHTML=`<div class="panel"><div class="panel-head"><h2>${t('patronList')}<small>PATRONS</small></h2><span class="pill">${t('readerCount',{count:db.readers.length})}</span></div><div class="toolbar"><div class="search"><span>⌕</span><input aria-label="${t('searchReaders')}" placeholder="${t('readerPlaceholder')}" value="${esc(query)}" oninput="query=this.value;readerRows()"></div></div><div class="table-wrap"><table>${headings(['readerName','card','email','currentLoans','late','actions'])}<tbody id="readerRows"></tbody></table></div></div>`;readerRows();
}
function readerRows(){$('#readerRows').innerHTML=db.readers.filter(r=>(r.name+r.card+r.email).toLowerCase().includes(query.toLowerCase())).map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.card)}</td><td>${esc(r.email)}</td><td>${t('copies',{count:db.loans.filter(l=>l.reader===r.id&&!l.returned).length})}</td><td>${t('copies',{count:db.loans.filter(l=>l.reader===r.id&&isLate(l)).length})}</td><td><button class="row-action" onclick="readerForm('${r.id}')">${t('edit')} ↗</button></td></tr>`).join('')||empty('noReaders')}
function readerForm(id){
  let r=db.readers.find(r=>r.id===id)||{};
  modal(`<h2>${t(id?'editReader':'newReader')}</h2><form id="readerForm">${field('name','name',r.name)}${field('card','card',r.card)}${field('email','email',r.email,false,'email')}${buttons()}</form>`);
  $('#readerForm').onsubmit=e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));Object.keys(d).forEach(k=>d[k]=d[k].trim());if(!d.name||!d.card)return toast(t('incompleteReader'));if(db.readers.some(x=>x.id!==id&&x.card===d.card))return toast(t('duplicateReader'));if(id)Object.assign(r,d);else db.readers.push({...d,id:uid()});closeModal();render();toast(t('readerSaved'))};
}
function overview(){
  let max=Math.max(1,...categories.map(c=>db.books.filter(b=>b.category===c).length));
  $('#view').innerHTML=`<div class="overview"><div class="panel"><h2>${t('distribution')}</h2>${categories.map(c=>{let n=db.books.filter(b=>b.category===c).length;return `<div class="bar"><span>${esc(categoryName(c))}</span><i style="width:${n/max*45}%"></i><b>${t('copies',{count:n})}</b></div>`}).join('')}</div><div class="panel"><h2>${t('reminders')}</h2><div class="help"><p style="margin:25px 0">${t('journey')}</p>${t('overdueReminder',{count:db.loans.filter(isLate).length})}<br>${t('readerReminder',{count:db.readers.length})}<br><br><button class="primary" onclick="navigate('loans');filter='late';loans()">${t('viewOverdue')}</button></div></div></div>`;
}
function help(){$('#view').innerHTML=`<div class="panel"><div class="panel-head"><h2>${t('about')}</h2></div><div class="help" style="padding:25px"><b>${t('gettingStarted')}</b><ol>${['step1','step2','step3','step4'].map(k=>`<li>${t(k)}</li>`).join('')}</ol><b>${t('language')}</b><p class="help-copy">${t('languageHelp')}</p><br><b>${t('backup')}</b><p class="help-copy">${t('storageHelp')}</p><br><b>${t('references')}</b><p class="help-copy">${t('referenceIntro')} <a href="https://koha-community.org/manual/22.05/en/html/circulation.html" target="_blank" rel="noopener">${t('koha')}</a>${t('referenceEnd')}</p></div></div>`}
function exportData(){let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`folio-backup-${day()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(t('exportToast'))}
render();
