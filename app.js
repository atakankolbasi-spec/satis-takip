const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'});
const money=n=>nf.format(n||0);
const int=n=>(n||0).toLocaleString('tr-TR');
const D=d=>d?new Date(d+'T00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short',year:'numeric'}):'';
const DL=d=>d?new Date(d+'T00:00').toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';
const DS=d=>d?new Date(d+'T00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'}):'';
const iso=dt=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
const shift=(d,n)=>{const t=new Date(d+'T00:00');t.setDate(t.getDate()+n);return iso(t)};
const tr=s=>String(s||'').toLocaleLowerCase('tr');
const newId=()=>(crypto.randomUUID?crypto.randomUUID():'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));

const ICONS={
 ozet:'<path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 8h6V4h-6z"/>',
 satis:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
 firma:'<path d="M4 20V7l8-3 8 3v13M9 20v-5h6v5M8 10h2M14 10h2"/>',
 menu:'<path d="M6 3v8a2 2 0 0 0 2 2v8M8 3v6M10 3v8a2 2 0 0 1-2 2M17 3c-2 2-2 6 0 8v10"/>',
 fiyat:'<path d="M20 12l-8 8-9-9V4h7zM8 8h.01"/>',
 cari:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 tahsilat:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
 rapor:'<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5"/>',
 yedek:'<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/>',
 hizli:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 aysonu:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',
 kullanici:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3-5.5 6.5-5.5s5.9 2 6.5 5.5M17 11a3 3 0 1 0-1-5.8M18 14.7c2 .6 3.2 2.3 3.5 5.3"/>'
};
const VIEWS=[['ozet','Özet'],['satis','Satışlar'],['hizli','Hızlı Giriş'],['firma','Firmalar'],['menu','Menüler'],['fiyat','Özel Fiyatlar'],['cari','Cari Hesap'],['aysonu','Ay Sonu'],['tahsilat','Tahsilatlar'],['rapor','Raporlar'],['yedek','Yedek'],['kullanici','Kullanıcılar']];

/* ---------- durum ---------- */
const S={firms:[],menus:[],prices:[],sales:[],payments:[],settings:[],users:[]};
const ready={};let dbErr='';
const U={view:'ozet',date:null,q:'',sort:'bal',from:'',to:'',repFrom:'',repTo:'',payQ:'',qDate:'',qMenu:'',qKey:'',qv:{},month:'',mFilter:'all',sel:{}};
const dueDays=()=>(S.settings.find(x=>x.id==='app')||{}).dueDays||30;
try{const v=sessionStorage.getItem('st-view');if(v&&VIEWS.some(x=>x[0]===v))U.view=v}catch(e){}

/* ---------- hesaplar ---------- */
const byId=(arr,id)=>arr.find(x=>x.id===id);
const fname=id=>(byId(S.firms,id)||{}).name||'Silinmiş firma';
const mname=id=>(byId(S.menus,id)||{}).name||'Silinmiş menü';
const amt=s=>(s.qty||0)*(s.price||0);
function ledger(){
  const m=new Map(S.firms.map(f=>[f.id,{f,sales:0,qty:0,paid:0,last:''}]));
  const g=id=>m.get(id)||(m.set(id,{f:{id,name:fname(id)},sales:0,qty:0,paid:0,last:''}),m.get(id));
  S.sales.forEach(s=>{const r=g(s.firm);r.sales+=amt(s);r.qty+=s.qty||0;r.paid+=s.paid||0;if(s.date>r.last)r.last=s.date});
  S.payments.forEach(p=>{g(p.firm).paid+=p.amount||0});
  return [...m.values()].map(r=>({...r,bal:r.sales-r.paid}));
}
const lastDate=()=>S.sales.reduce((a,s)=>s.date>a?s.date:a,'');
const priceFor=(firm,menu)=>{const p=S.prices.find(x=>x.firm===firm&&x.menu===menu);return p?p.price:0};
const dates=()=>[...new Set(S.sales.map(s=>s.date))].sort();

/* ---------- yazma ---------- */
function allowed(col,op){
  if(col==='users')return Auth.owner;
  if(['firms','menus','prices','settings'].includes(col))return can('admin');
  return op==='del'?can('admin'):can('write');
}
let toastT;
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),2600)}
async function put(col,id,data){
  if(!allowed(col,'put')){toast('Bu hesabın bu işlem için yetkisi yok');return false}
  const {error}=await sb.from(TABLE[col]).upsert(toRow[col](id,data));
  if(error){toast(errMsg(error));return false}
  const obj={...data,id},i=S[col].findIndex(x=>x.id===id);
  if(i>=0)S[col][i]=obj;else S[col].push(obj);
  schedule();queue(col,150);return true;
}
async function del(col,id){
  if(!allowed(col,'del')){toast('Bu hesabın silme yetkisi yok');return false}
  const {error}=await sb.from(TABLE[col]).delete().eq(PKCOL[col]||'id',id);
  if(error){toast(errMsg(error));return false}
  S[col]=S[col].filter(x=>x.id!==id);schedule();queue(col,150);return true;
}

/* ---------- pencere ---------- */
let modalCfg=null;
function openModal(cfg){
  modalCfg=cfg;const sh=$('#sheet');sh.className='sheet'+(cfg.wide?' wide':'');
  sh.innerHTML=`<header><h2 id="mTitle">${esc(cfg.title)}</h2><button class="btn ghost" data-act="close" aria-label="Kapat">✕</button></header>
  <form id="mForm" novalidate><div class="body" id="mBody">${cfg.body}</div>${cfg.noFoot?'':`<div class="foot"><button type="button" class="btn" data-act="close">Vazgeç</button><button class="btn ${cfg.danger?'danger':'primary'}" type="submit">${esc(cfg.submit||'Kaydet')}</button></div>`}</form>`;
  $('#modal').classList.add('open');
  const f=sh.querySelector('input,select');if(f&&!cfg.noFocus)f.focus();
  if(cfg.onOpen)cfg.onOpen($('#mForm'));
}
function closeModal(){$('#modal').classList.remove('open');modalCfg=null;$('#sheet').innerHTML=''}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalCfg)closeModal()});
$('#modal').addEventListener('mousedown',e=>{if(e.target.id==='modal')closeModal()});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='mForm')return;e.preventDefault();
  if(!modalCfg||!modalCfg.onSubmit)return;
  const form=e.target;
  if(!form.checkValidity()){form.reportValidity();return}
  const btn=form.querySelector('button[type=submit]');btn.disabled=true;
  const ok=await modalCfg.onSubmit(Object.fromEntries(new FormData(form)));
  if(ok!==false)closeModal();else btn.disabled=false;
});
document.addEventListener('input',e=>{if(modalCfg&&modalCfg.onInput&&e.target.closest('#mForm'))modalCfg.onInput(e.target.form,e.target)});

const field=(label,html,cls='')=>`<label class="f ${cls}">${label}${html}</label>`;
const opts=(arr,sel,ph)=>(ph?`<option value="">${esc(ph)}</option>`:'')+arr.map(x=>`<option value="${esc(x.id)}"${x.id===sel?' selected':''}>${esc(x.name)}</option>`).join('');
const sortedFirms=()=>[...S.firms].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
const sortedMenus=()=>[...S.menus].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
function confirmDel(title,text,fn){openModal({title,body:`<p style="margin:0">${text}</p>`,submit:'Sil',danger:true,noFocus:true,onSubmit:async()=>{const ok=await fn();if(ok)toast('Silindi');return ok}})}

/* ---------- satış / tahsilat / firma / menü pencereleri ---------- */
function saleModal(s){
  const edit=!!s;const firms=sortedFirms(),menus=sortedMenus();
  if(!firms.length||!menus.length){toast('Önce firma ve menü ekleyin');return}
  const v=s||{date:U.date||lastDate()||iso(new Date()),firm:'',menu:menus[0].id,qty:'',price:''};
  openModal({title:edit?'Satışı düzenle':'Yeni satış',submit:edit?'Güncelle':'Satışı ekle',
    body:`<div class="fgrid">
      ${field('Tarih',`<input type="date" name="date" value="${esc(v.date)}" required>`)}
      ${field('Firma',`<select name="firm" required>${opts(firms,v.firm,'Seçin')}</select>`)}
      ${field('Menü',`<select name="menu" required>${opts(menus,v.menu)}</select>`)}
      ${field('Adet',`<input type="number" name="qty" min="1" step="1" value="${esc(v.qty)}" required inputmode="numeric">`)}
      ${field('Birim fiyat (₺)',`<input type="number" name="price" min="0" step="0.01" value="${esc(v.price)}" required inputmode="decimal">`,'full')}
    </div><p class="hint" id="pHint">Firma seçince özel fiyat otomatik gelir.</p><p class="hint">Tutar: <b id="pTot">${money(amt(v))}</b></p>`,
    onInput:(f,t)=>{
      if(t.name==='firm'||t.name==='menu'){const p=priceFor(f.firm.value,f.menu.value);if(p){f.price.value=p;$('#pHint').textContent='Özel fiyat uygulandı: '+money(p)}else $('#pHint').textContent='Bu firma için özel fiyat yok, fiyatı elle girin.'}
      $('#pTot').textContent=money((+f.qty.value||0)*(+f.price.value||0));
    },
    onSubmit:async d=>{
      const rec={date:d.date,firm:d.firm,menu:d.menu,qty:+d.qty,price:+d.price,paid:s?s.paid||0:0,by:byName()};
      const ok=await put('sales',edit?s.id:newId(),rec);if(ok){U.date=d.date;toast(edit?'Satış güncellendi':'Satış eklendi')}return ok}});
}
function payModal(p,firm){
  const edit=!!(p&&p.id);const firms=sortedFirms();
  if(!firms.length){toast('Önce firma ekleyin');return}
  const v=p||{date:iso(new Date()),firm:firm||'',amount:'',method:'Nakit',note:''};
  openModal({title:edit?'Tahsilatı düzenle':'Yeni tahsilat',submit:edit?'Güncelle':'Tahsilatı kaydet',
    body:`<div class="fgrid">
      ${field('Tarih',`<input type="date" name="date" value="${esc(v.date)}" required>`)}
      ${field('Firma',`<select name="firm" required>${opts(firms,v.firm,'Seçin')}</select>`)}
      ${field('Tutar (₺)',`<input type="number" name="amount" min="0.01" step="0.01" value="${esc(v.amount)}" required inputmode="decimal">`)}
      ${field('Yöntem',`<select name="method">${['Nakit','Havale / EFT','Çek','Kredi kartı'].map(m=>`<option${m===v.method?' selected':''}>${m}</option>`).join('')}</select>`)}
      ${field('Not',`<input type="text" name="note" value="${esc(v.note)}" placeholder="Örn. ekim ayı kısmi ödeme">`,'full')}
    </div><p class="hint" id="pBal"></p>`,
    onOpen:f=>updBal(f),onInput:(f)=>updBal(f),
    onSubmit:async d=>{
      const ok=await put('payments',edit?p.id:newId(),{date:d.date,firm:d.firm,amount:+d.amount,method:d.method,note:d.note.trim(),by:byName()});
      if(ok)toast(edit?'Tahsilat güncellendi':'Tahsilat kaydedildi');return ok}});
  function updBal(f){const r=ledger().find(x=>x.f.id===f.firm.value);$('#pBal').textContent=r?`${r.f.name} güncel bakiyesi: ${money(r.bal)}`:'Firma seçin.'}
}
function firmModal(f){
  const edit=!!f;const v=f||{name:'',phone:''};
  openModal({title:edit?'Firmayı düzenle':'Yeni firma',submit:edit?'Güncelle':'Firmayı ekle',
    body:`${field('Firma adı',`<input type="text" name="name" value="${esc(v.name)}" required>`)}${field('Telefon',`<input type="tel" name="phone" value="${esc(v.phone)}" placeholder="İsteğe bağlı">`)}`,
    onSubmit:async d=>{
      const name=d.name.trim();if(!name)return false;
      if(S.firms.some(x=>x.id!==(f&&f.id)&&tr(x.name)===tr(name))){toast('Bu isimde bir firma var');return false}
      const ok=await put('firms',edit?f.id:newId(),{name,phone:d.phone.trim()});if(ok)toast(edit?'Firma güncellendi':'Firma eklendi');return ok}});
}
function menuModal(m){
  const edit=!!m;
  openModal({title:edit?'Menüyü düzenle':'Yeni menü',submit:edit?'Güncelle':'Menüyü ekle',
    body:field('Menü adı',`<input type="text" name="name" value="${esc(m?m.name:'')}" required>`),
    onSubmit:async d=>{
      const name=d.name.trim();if(!name)return false;
      const ok=await put('menus',edit?m.id:newId(),{name});if(ok)toast(edit?'Menü güncellendi':'Menü eklendi');return ok}});
}

/* ---------- ekstre ---------- */
function stmtRows(firm,from,to){
  const mv=[];
  S.sales.filter(s=>s.firm===firm).forEach(s=>{
    mv.push({date:s.date,k:0,t:'Satış',d:`${mname(s.menu)} · ${int(s.qty)} adet × ${money(s.price)}`,deb:amt(s)});
    if(s.paid>0)mv.push({date:s.date,k:1,t:'Tahsilat',d:'Satış anında alınan',cre:s.paid});
  });
  S.payments.filter(p=>p.firm===firm).forEach(p=>mv.push({date:p.date,k:1,t:'Tahsilat',d:[p.method,p.note].filter(Boolean).join(' · '),cre:p.amount,pid:p.id}));
  mv.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.k-b.k);
  let open=0;mv.forEach(m=>{if(from&&m.date<from)open+=(m.deb||0)-(m.cre||0)});
  const rows=mv.filter(m=>(!from||m.date>=from)&&(!to||m.date<=to));
  let run=open;rows.forEach(m=>{run+=(m.deb||0)-(m.cre||0);m.run=run});
  return {rows,open,close:run,deb:rows.reduce((a,m)=>a+(m.deb||0),0),cre:rows.reduce((a,m)=>a+(m.cre||0),0)};
}
function stmtHtml(firm){
  const st=stmtRows(firm,U.from,U.to);
  const body=st.rows.length?st.rows.map(m=>`<tr><td class="num">${D(m.date)}</td><td><span class="pill ${m.k?'good':''}">${m.t}</span></td><td>${esc(m.d)}</td><td class="r num">${m.deb?money(m.deb):''}</td><td class="r num">${m.cre?money(m.cre):''}</td><td class="r num ${m.run>0?'neg':'pos'}">${money(m.run)}</td></tr>`).join(''):`<tr><td colspan="6" class="empty">Bu aralıkta hareket yok.</td></tr>`;
  return `<div class="stmt-top"><div><small>Devir</small><b class="num">${money(st.open)}</b></div><div><small>Satış</small><b class="num">${money(st.deb)}</b></div><div><small>Tahsilat</small><b class="num">${money(st.cre)}</b></div><div><small>Kapanış bakiyesi</small><b class="num ${st.close>0?'neg':'pos'}">${money(st.close)}</b></div></div>
  <div class="tw card"><table><thead><tr><th>Tarih</th><th>Tür</th><th>Açıklama</th><th class="r">Borç</th><th class="r">Alacak</th><th class="r">Bakiye</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
function openStatement(firm){
  U.from='';U.to='';
  openModal({title:fname(firm)+' · Hesap ekstresi',wide:true,noFoot:true,noFocus:true,
    body:`<div class="tools"><label class="f">Başlangıç<input type="date" id="sFrom"></label><label class="f">Bitiş<input type="date" id="sTo"></label><button type="button" class="btn" data-act="stmt-clear">Tümü</button><span style="flex:1"></span><button type="button" class="btn primary" data-act="stmt-pay" data-id="${esc(firm)}">Tahsilat ekle</button></div><div id="stmt">${stmtHtml(firm)}</div>`,
    onInput:(f,t)=>{if(t.id==='sFrom'||t.id==='sTo'){U.from=$('#sFrom').value;U.to=$('#sTo').value;$('#stmt').innerHTML=stmtHtml(firm)}}});
  modalCfg.firm=firm;
}

/* ---------- görünümler ---------- */
function head(title,sub,actions=''){return `<div class="head"><div><div class="eyebrow">${esc(U.view==='ozet'?'Genel durum':'Satış Takip')}</div><h1>${esc(title)}</h1><p>${sub}</p></div><div class="tools">${actions}</div></div>`}
const addBtn=(act,label)=>`<button class="btn primary" data-act="${act}">+ ${label}</button>`;
function emptyCard(t,s){return `<div class="card"><div class="empty"><b>${t}</b>${s}</div></div>`}

function vOzet(){
  const L=ledger(),tot=L.reduce((a,r)=>({s:a.s+r.sales,p:a.p+r.paid}),{s:0,p:0});
  const ld=lastDate(),day=S.sales.filter(s=>s.date===ld),dayQty=day.reduce((a,s)=>a+s.qty,0),dayAmt=day.reduce((a,s)=>a+amt(s),0);
  const debt=L.filter(r=>r.bal>0).sort((a,b)=>b.bal-a.bal),maxB=debt[0]?debt[0].bal:1;
  const ds=dates().slice(-10),byDay=ds.map(d=>({d,v:S.sales.filter(s=>s.date===d).reduce((a,s)=>a+amt(s),0)})),maxD=Math.max(1,...byDay.map(x=>x.v));
  const pays=[...S.payments].sort((a,b)=>a.date<b.date?1:-1).slice(0,5);
  return head('Özet',ld?`En son satış günü: ${DL(ld)}.`:'Henüz satış kaydı yok.',(can('write')?'<button class="btn" data-act="go" data-id="hizli">Hızlı giriş</button>':'')+addBtn('sale-new','Yeni satış')+addBtn('pay-new','Tahsilat'))+`
  <div class="grid kpis">
    <div class="card kpi"><small>Toplam satış</small><b class="num">${money(tot.s)}</b><em>${S.sales.length} satış kaydı</em></div>
    <div class="card kpi ok"><small>Toplam tahsilat</small><b class="num">${money(tot.p)}</b><em>${S.payments.length} tahsilat kaydı</em></div>
    <div class="card kpi ${tot.s-tot.p>0?'hot':''}"><small>Açık bakiye</small><b class="num">${money(tot.s-tot.p)}</b><em>${debt.length} firmadan alacak</em></div>
    <div class="card kpi"><small>${ld?DS(ld)+' porsiyon':'Son gün'}</small><b class="num">${int(dayQty)}</b><em>${money(dayAmt)} · ${day.length} firma</em></div>
  </div>
  <div class="grid two">
    <section class="card"><header><h2>Alacağı en yüksek firmalar</h2><span>Cari bakiyeye göre</span></header>
      ${debt.length?`<div class="bars">${debt.slice(0,7).map(r=>`<div class="bar"><span class="nm" title="${esc(r.f.name)}">${esc(r.f.name)}</span><div class="track"><div class="fill bad" style="width:${Math.max(3,r.bal/maxB*100)}%"></div></div><b class="num">${money(r.bal)}</b></div>`).join('')}</div>`:`<div class="empty"><b>Açık bakiye yok</b>Tüm firmalar hesabını kapatmış.</div>`}
    </section>
    <section class="card"><header><h2>Günlük satış tutarı</h2><span>Son ${ds.length} gün</span></header>
      ${ds.length?`<div class="cols">${byDay.map(x=>`<div class="col" title="${DL(x.d)}: ${money(x.v)}"><span class="num">${x.v>=1000?(x.v/1000).toLocaleString('tr-TR',{maximumFractionDigits:1})+' B':int(x.v)}</span><i style="height:${Math.max(1,x.v/maxD*130)}px"></i></div>`).join('')}</div><div class="labels">${byDay.map(x=>`<div>${DS(x.d)}</div>`).join('')}</div>`:`<div class="empty"><b>Henüz veri yok</b>Satış ekledikçe grafik oluşur.</div>`}
    </section>
  </div>
  <section class="card"><header><h2>Son tahsilatlar</h2><button class="btn ghost" data-act="go" data-id="tahsilat">Tümü →</button></header>
    ${pays.length?`<div class="tw"><table><tbody>${pays.map(p=>`<tr><td class="num">${D(p.date)}</td><td>${esc(fname(p.firm))}</td><td>${esc(p.method||'')}</td><td class="r num pos">${money(p.amount)}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><b>Tahsilat kaydı yok</b>Firmalardan alınan ödemeleri Tahsilatlar sekmesinden girin.</div>`}
  </section>`;
}

function vSatis(){
  if(!U.date)U.date=lastDate()||iso(new Date());
  const rows=S.sales.filter(s=>s.date===U.date).sort((a,b)=>fname(a.firm).localeCompare(fname(b.firm),'tr'));
  const q=rows.reduce((a,s)=>a+s.qty,0),t=rows.reduce((a,s)=>a+amt(s),0);
  const nav=`<div class="seg"><button data-act="day" data-id="-1" aria-label="Önceki gün">‹</button><button data-act="day" data-id="0">Son satış günü</button><button data-act="day" data-id="1" aria-label="Sonraki gün">›</button></div><input type="date" id="dayIn" value="${esc(U.date)}" aria-label="Gün seç">`;
  return head('Satışlar',`${DL(U.date)} · ${rows.length} firma, ${int(q)} porsiyon`,nav+addBtn('sale-new','Yeni satış'))+
  (rows.length?`<div class="card tw"><table><thead><tr><th>Firma</th><th>Menü</th><th class="r">Adet</th><th class="r">Birim fiyat</th><th class="r">Tutar</th><th>Giren</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(fname(s.firm))}</b></td><td>${esc(mname(s.menu))}</td><td class="r num">${int(s.qty)}</td><td class="r num">${money(s.price)}${s.price>1000?' <span class="pill warn" title="Diğer firmalara göre çok yüksek, kontrol edin">yüksek fiyat</span>':''}</td><td class="r num"><b>${money(amt(s))}</b></td><td class="by">${esc(s.by||"")}</td><td class="row-actions"><button class="btn ghost" data-act="sale-edit" data-id="${esc(s.id)}">Düzenle</button><button class="btn ghost" data-act="sale-del" data-id="${esc(s.id)}">Sil</button></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Gün toplamı</td><td class="r num">${int(q)}</td><td></td><td class="r num">${money(t)}</td><td></td><td></td></tr></tfoot></table></div>`:emptyCard('Bu gün satış girilmemiş','Başka bir gün seçin ya da “Yeni satış” ile ekleyin.'));
}

function vFirma(){
  const L=new Map(ledger().map(r=>[r.f.id,r])),list=sortedFirms().filter(f=>!U.q||tr(f.name).includes(tr(U.q)));
  return head('Firmalar',`${S.firms.length} kayıtlı firma`,`<input type="search" id="q" placeholder="Firma ara" value="${esc(U.q)}" aria-label="Firma ara">`+addBtn('firm-new','Yeni firma'))+
  (list.length?`<div class="card tw"><table><thead><tr><th>Firma</th><th>Telefon</th><th class="r">Toplam satış</th><th class="r">Bakiye</th><th></th></tr></thead><tbody>${list.map(f=>{const r=L.get(f.id)||{sales:0,bal:0};return `<tr><td><b>${esc(f.name)}</b></td><td>${esc(f.phone)||'<span style="color:var(--muted)">—</span>'}</td><td class="r num">${money(r.sales)}</td><td class="r num ${r.bal>0?'neg':''}">${money(r.bal)}</td><td class="row-actions"><button class="btn ghost" data-act="firm-edit" data-id="${esc(f.id)}">Düzenle</button><button class="btn ghost" data-act="firm-del" data-id="${esc(f.id)}">Sil</button></td></tr>`}).join('')}</tbody></table></div>`:emptyCard('Firma bulunamadı','Aramayı değiştirin ya da yeni firma ekleyin.'));
}

function vMenu(){
  const list=sortedMenus();
  return head('Menüler','Satışta kullanılan menü çeşitleri',addBtn('menu-new','Yeni menü'))+
  (list.length?`<div class="card tw"><table><thead><tr><th>Menü</th><th class="r">Satılan adet</th><th class="r">Ciro</th><th></th></tr></thead><tbody>${list.map(m=>{const ss=S.sales.filter(s=>s.menu===m.id);return `<tr><td><b>${esc(m.name)}</b></td><td class="r num">${int(ss.reduce((a,s)=>a+s.qty,0))}</td><td class="r num">${money(ss.reduce((a,s)=>a+amt(s),0))}</td><td class="row-actions"><button class="btn ghost" data-act="menu-edit" data-id="${esc(m.id)}">Düzenle</button><button class="btn ghost" data-act="menu-del" data-id="${esc(m.id)}">Sil</button></td></tr>`}).join('')}</tbody></table></div>`:emptyCard('Menü yok','İlk menüyü ekleyin.'));
}

function vFiyat(){
  const firms=sortedFirms().filter(f=>!U.q||tr(f.name).includes(tr(U.q))),menus=sortedMenus();
  if(!menus.length)return head('Özel Fiyatlar','Firma başına anlaşmalı birim fiyat')+emptyCard('Önce menü ekleyin','Fiyatlar firma ve menü eşleşmesine göre girilir.');
  const common=(()=>{const c={};S.prices.forEach(p=>c[p.price]=(c[p.price]||0)+1);const e=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return e?+e[0]:0})();
  return head('Özel Fiyatlar',`Satış girerken firma seçilince bu fiyat otomatik gelir. En yaygın fiyat: <b>${money(common)}</b>. Boş bırakılan hücrede özel fiyat yoktur.`,`<input type="search" id="q" placeholder="Firma ara" value="${esc(U.q)}" aria-label="Firma ara">`)+
  `<div class="card tw"><table class="pm"><thead><tr><th>Firma</th>${menus.map(m=>`<th class="r">${esc(m.name)} (₺)</th>`).join('')}</tr></thead><tbody>${firms.map(f=>`<tr><td><b>${esc(f.name)}</b></td>${menus.map(m=>{const p=S.prices.find(x=>x.firm===f.id&&x.menu===m.id);return `<td class="r"><input type="number" min="0" step="0.01" inputmode="decimal" class="pin" data-firm="${esc(f.id)}" data-menu="${esc(m.id)}" value="${p?esc(p.price):''}" ${can('admin')?'':'disabled'} aria-label="${esc(f.name)} ${esc(m.name)} fiyatı"></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function ageInfo(){
  const today=iso(new Date()),due=dueDays(),map=new Map();
  const paid=new Map(),byFirm=new Map();
  S.payments.forEach(p=>paid.set(p.firm,(paid.get(p.firm)||0)+p.amount));
  S.sales.forEach(s=>{paid.set(s.firm,(paid.get(s.firm)||0)+(s.paid||0));if(!byFirm.has(s.firm))byFirm.set(s.firm,[]);byFirm.get(s.firm).push(s)});
  const days=(a,b)=>Math.round((new Date(b+'T00:00')-new Date(a+'T00:00'))/864e5);
  byFirm.forEach((arr,id)=>{
    arr.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    let rem=paid.get(id)||0,oldest='';const b=[0,0,0];
    arr.forEach(s=>{
      const a=amt(s),used=Math.min(Math.max(rem,0),a);rem-=used;const open=a-used;
      if(open>0.005){if(!oldest)oldest=s.date;const age=days(s.date,today);b[age<=due?0:age<=2*due?1:2]+=open}
    });
    map.set(id,{oldest,age:oldest?days(oldest,today):0,b});
  });
  return {map,due,today};
}
function vCari(){
  const A=ageInfo(),all=ledger();
  const debt=all.filter(r=>r.bal>0.005),totalDebt=debt.reduce((a,r)=>a+r.bal,0);
  const ageOf=r=>{const x=A.map.get(r.f.id);return r.bal>0.005&&x&&x.oldest?x.age:null};
  const over=debt.filter(r=>{const a=ageOf(r);return a!==null&&a>A.due});
  const overAmt=debt.reduce((a,r)=>{const x=A.map.get(r.f.id);return a+(x?x.b[1]+x.b[2]:0)},0);
  const never=all.filter(r=>r.sales>0&&r.paid<=0),neverAmt=never.reduce((a,r)=>a+r.bal,0);
  const bk=[0,0,0];A.map.forEach(x=>x.b.forEach((v,i)=>bk[i]+=v));const bt=bk[0]+bk[1]+bk[2]||1;
  let L=all.filter(r=>!U.q||tr(r.f.name).includes(tr(U.q)));
  const cmp={bal:(a,b)=>b.bal-a.bal,sales:(a,b)=>b.sales-a.sales,name:(a,b)=>a.f.name.localeCompare(b.f.name,'tr'),age:(a,b)=>(ageOf(b)??-1)-(ageOf(a)??-1)}[U.sort];L.sort(cmp);
  const t=L.reduce((a,r)=>({s:a.s+r.sales,p:a.p+r.paid}),{s:0,p:0});
  const so=(v,l)=>`<option value="${v}"${U.sort===v?' selected':''}>${l}</option>`;
  return head('Cari Hesap','Bakiye = tüm satışlar − tüm tahsilatlar. Pozitif bakiye firmadan alacağınızı gösterir. Yaş, ödenmemiş en eski satışın kaç gün önce yapıldığını gösterir (ödemeler en eski satıştan düşülür). Satıra tıklayınca ekstre açılır.',
   `<input type="search" id="q" placeholder="Firma ara" value="${esc(U.q)}" aria-label="Firma ara"><select id="sortSel" aria-label="Sırala">${so('bal','Bakiyeye göre')}${so('age','Yaşa göre')}${so('sales','Satışa göre')}${so('name','Ada göre')}</select><select id="dueSel" aria-label="Vade süresi" title="Vade süresi">${[7,15,30,45,60].map(d=>`<option value="${d}"${d===A.due?' selected':''}>Vade ${d} gün</option>`).join('')}</select><button class="btn" data-act="csv-cari">CSV</button>`)+
  `<div class="grid kpis">
    <div class="card kpi ${totalDebt>0?'hot':''}"><small>Toplam alacak</small><b class="num">${money(totalDebt)}</b><em>${debt.length} firmadan</em></div>
    <div class="card kpi ${over.length?'hot':''}"><small>Vadesi geçen</small><b class="num">${money(overAmt)}</b><em>${over.length} firma, ${A.due} günü aştı</em></div>
    <div class="card kpi"><small>Hiç ödeme yapmamış</small><b class="num">${never.length}</b><em>${money(neverAmt)} alacak</em></div>
    <div class="card kpi ok"><small>Tahsilat oranı</small><b class="num">${all.reduce((a,r)=>a+r.sales,0)?Math.round(all.reduce((a,r)=>a+r.paid,0)/all.reduce((a,r)=>a+r.sales,0)*100):0}%</b><em>satışa göre tahsil edilen</em></div>
  </div>
  <section class="card"><header><h2>Alacak yaşlandırma</h2><span>Ödenmemiş satışların yaşına göre</span></header>
    <div class="stack" role="img" aria-label="Alacak yaşlandırma dağılımı"><i style="width:${bk[0]/bt*100}%;background:var(--accent)"></i><i style="width:${bk[1]/bt*100}%;background:var(--warn)"></i><i style="width:${bk[2]/bt*100}%;background:var(--bad)"></i></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>0–${A.due} gün · <b class="num">${money(bk[0])}</b></span><span><i style="background:var(--warn)"></i>${A.due+1}–${A.due*2} gün · <b class="num">${money(bk[1])}</b></span><span><i style="background:var(--bad)"></i>${A.due*2}+ gün · <b class="num">${money(bk[2])}</b></span></div>
  </section>
  <div class="card tw"><table><thead><tr><th>Firma</th><th class="r">Toplam satış</th><th class="r">Toplam tahsilat</th><th class="r">Cari bakiye</th><th class="r">Yaş</th><th>Son satış</th></tr></thead><tbody>${L.map(r=>{const a=ageOf(r);return `<tr class="click" tabindex="0" data-act="stmt" data-id="${esc(r.f.id)}"><td><b>${esc(r.f.name)}</b></td><td class="r num">${money(r.sales)}</td><td class="r num">${money(r.paid)}</td><td class="r num ${r.bal>0.005?'neg':r.bal<-0.005?'pos':''}">${money(r.bal)}</td><td class="r">${a===null?'<span style="color:var(--muted)">—</span>':`<span class="pill ${a>2*A.due?'bad':a>A.due?'warn':''}">${a} gün</span>`}</td><td class="num">${r.last?D(r.last):'—'}</td></tr>`}).join('')||`<tr><td colspan="6" class="empty">Firma bulunamadı.</td></tr>`}</tbody><tfoot><tr><td>Toplam (${L.length} firma)</td><td class="r num">${money(t.s)}</td><td class="r num">${money(t.p)}</td><td class="r num">${money(t.s-t.p)}</td><td></td><td></td></tr></tfoot></table></div>`;
}

function vTahsilat(){
  const q=tr(U.payQ),list=[...S.payments].filter(p=>!q||tr(fname(p.firm)).includes(q)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const sum=list.reduce((a,p)=>a+p.amount,0);
  return head('Tahsilatlar',`${list.length} kayıt · toplam ${money(sum)}`,`<input type="search" id="payQ" placeholder="Firma ara" value="${esc(U.payQ)}" aria-label="Firma ara">`+addBtn('pay-new','Yeni tahsilat'))+
  (list.length?`<div class="card tw"><table><thead><tr><th>Tarih</th><th>Firma</th><th>Yöntem</th><th>Not</th><th class="r">Tutar</th><th>Giren</th><th></th></tr></thead><tbody>${list.map(p=>`<tr><td class="num">${D(p.date)}</td><td><b>${esc(fname(p.firm))}</b></td><td>${esc(p.method||'')}</td><td>${esc(p.note||'')}</td><td class="r num pos">${money(p.amount)}</td><td class="by">${esc(p.by||"")}</td><td class="row-actions"><button class="btn ghost" data-act="pay-edit" data-id="${esc(p.id)}">Düzenle</button><button class="btn ghost" data-act="pay-del" data-id="${esc(p.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:emptyCard('Tahsilat kaydı yok','Bir firmadan ödeme aldığınızda “Yeni tahsilat” ile girin; cari bakiye otomatik düşer.'));
}

function repData(){
  const ds=dates(),from=U.repFrom||ds[0]||'',to=U.repTo||ds[ds.length-1]||'';
  const ss=S.sales.filter(s=>(!from||s.date>=from)&&(!to||s.date<=to));
  const pp=S.payments.filter(p=>(!from||p.date>=from)&&(!to||p.date<=to));
  const firms=new Map();
  ss.forEach(s=>{const r=firms.get(s.firm)||{name:fname(s.firm),days:new Set(),qty:0,amt:0,paid:0};r.days.add(s.date);r.qty+=s.qty;r.amt+=amt(s);r.paid+=s.paid||0;firms.set(s.firm,r)});
  pp.forEach(p=>{const r=firms.get(p.firm)||{name:fname(p.firm),days:new Set(),qty:0,amt:0,paid:0};r.paid+=p.amount;firms.set(p.firm,r)});
  const days=new Map();ss.forEach(s=>{const r=days.get(s.date)||{f:new Set(),qty:0,amt:0};r.f.add(s.firm);r.qty+=s.qty;r.amt+=amt(s);days.set(s.date,r)});
  return {from,to,firms:[...firms.values()].sort((a,b)=>b.amt-a.amt),days:[...days.entries()].sort((a,b)=>a[0]<b[0]?-1:1),qty:ss.reduce((a,s)=>a+s.qty,0),amt:ss.reduce((a,s)=>a+amt(s),0),paid:pp.reduce((a,p)=>a+p.amount,0)+ss.reduce((a,s)=>a+(s.paid||0),0)};
}
function vRapor(){
  const r=repData();
  return head('Raporlar','Seçilen tarih aralığındaki satış ve tahsilat özeti',`<label class="f">Başlangıç<input type="date" id="rFrom" value="${esc(r.from)}"></label><label class="f">Bitiş<input type="date" id="rTo" value="${esc(r.to)}"></label><button class="btn" data-act="csv-rapor">CSV</button>`)+
  `<div class="grid kpis"><div class="card kpi"><small>Porsiyon</small><b class="num">${int(r.qty)}</b><em>${r.days.length} gün</em></div><div class="card kpi"><small>Satış tutarı</small><b class="num">${money(r.amt)}</b><em>${r.firms.length} firma</em></div><div class="card kpi ok"><small>Tahsilat</small><b class="num">${money(r.paid)}</b><em>aralıkta alınan</em></div><div class="card kpi"><small>Günlük ortalama</small><b class="num">${money(r.days.length?r.amt/r.days.length:0)}</b><em>${int(r.days.length?r.qty/r.days.length:0)} porsiyon</em></div></div>
  <div class="grid two">
  <section class="card"><header><h2>Firma bazında</h2><span>Tutara göre</span></header><div class="tw"><table><thead><tr><th>Firma</th><th class="r">Gün</th><th class="r">Adet</th><th class="r">Tutar</th></tr></thead><tbody>${r.firms.map(f=>`<tr><td>${esc(f.name)}</td><td class="r num">${f.days.size}</td><td class="r num">${int(f.qty)}</td><td class="r num"><b>${money(f.amt)}</b></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Bu aralıkta veri yok.</td></tr>'}</tbody></table></div></section>
  <section class="card"><header><h2>Gün bazında</h2><span>Tarih sırasıyla</span></header><div class="tw"><table><thead><tr><th>Tarih</th><th class="r">Firma</th><th class="r">Adet</th><th class="r">Tutar</th></tr></thead><tbody>${r.days.map(([d,x])=>`<tr><td class="num">${D(d)}</td><td class="r num">${x.f.size}</td><td class="r num">${int(x.qty)}</td><td class="r num"><b>${money(x.amt)}</b></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Bu aralıkta veri yok.</td></tr>'}</tbody></table></div></section></div>`;
}

/* ---------- bağlantı ---------- */
const CFG=window.SATIS_CONFIG||{};
const sb=window.createPCSClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true}});
const emailFor=u=>String(CFG.emailTemplate||'').replace('{u}',u);
const TABLE={firms:'st_firms',menus:'st_menus',prices:'st_prices',sales:'st_sales',payments:'st_payments',settings:'st_settings',users:'st_profiles'};
const PKCOL={settings:'key'};
const COLS=['firms','menus','prices','sales','payments','settings','users'];
const fromRow={
  firms:r=>({id:r.id,name:r.name,phone:r.phone||''}),
  menus:r=>({id:r.id,name:r.name}),
  prices:r=>({id:r.id,firm:r.firm_id,menu:r.menu_id,price:+r.price}),
  sales:r=>({id:r.id,date:r.date,firm:r.firm_id,menu:r.menu_id,qty:r.qty,price:+r.price,paid:+r.paid||0,by:r.by_name||''}),
  payments:r=>({id:r.id,date:r.date,firm:r.firm_id,amount:+r.amount,method:r.method||'',note:r.note||'',by:r.by_name||''}),
  settings:r=>({...(r.value||{}),id:r.key}),
  users:r=>({id:r.username,uid:r.id,name:r.name,role:r.role,active:r.active,created:String(r.created_at||'').slice(0,10)})
};
const toRow={
  firms:(id,d)=>({id,name:d.name,phone:d.phone||''}),
  menus:(id,d)=>({id,name:d.name}),
  prices:(id,d)=>({id,firm_id:d.firm,menu_id:d.menu,price:d.price}),
  sales:(id,d)=>({id,date:d.date,firm_id:d.firm,menu_id:d.menu,qty:d.qty,price:d.price,paid:d.paid||0,by_name:d.by||''}),
  payments:(id,d)=>({id,date:d.date,firm_id:d.firm,amount:d.amount,method:d.method||'',note:d.note||'',by_name:d.by||''}),
  settings:(id,d)=>({key:id,value:d})
};
function errMsg(e){
  const c=e&&e.code;
  if(c==='42501'||/row-level security|yetkisiz/i.test((e&&e.message)||''))return 'Bu hesabın bu işlem için yetkisi yok';
  if(c==='23503')return 'Bağlı kayıtlar olduğu için silinemez';
  if(c==='23505')return 'Aynı kayıt zaten var';
  if(e&&/Failed to fetch|NetworkError/i.test(e.message||''))return 'İnternet bağlantısı yok';
  return 'İşlem yapılamadı, tekrar deneyin';
}
async function fetchAll(table,pk){
  let out=[],from=0;
  for(;;){
    const {data,error}=await sb.from(table).select('*').order(pk).range(from,from+999);
    if(error)throw error;
    out=out.concat(data);if(data.length<1000)break;from+=1000;
  }
  return out;
}
async function reload(col){
  try{S[col]=(await fetchAll(TABLE[col],PKCOL[col]||'id')).map(fromRow[col]);ready[col]=1;dbErr=''}
  catch(e){dbErr=(e&&e.code)||'error'}
  schedule();
}
const timers={};
const queue=(c,ms=300)=>{clearTimeout(timers[c]);timers[c]=setTimeout(()=>reload(c),ms)};
let channel=null;
function startData(){
  COLS.forEach(c=>{if(c!=='users'||Auth.owner)reload(c)});
  if(channel)return;
  channel=sb.channel('st-live');
  COLS.forEach(c=>channel.on('postgres_changes',{event:'*',schema:'public',table:TABLE[c]},()=>queue(c)));
  channel.subscribe();
}
function stopData(){
  COLS.forEach(c=>{S[c]=[];delete ready[c]});S.backups=[];U.bkState='';
  if(channel){sb.removeChannel(channel);channel=null}
}

/* ---------- giriş ve yetkiler ---------- */
const ROLES={admin:'Yönetici',entry:'Giriş yetkilisi',view:'Görüntüleyen'};
const Auth={user:null,owner:false,ready:false};
const can=l=>{
  if(Auth.owner)return true;
  const r=Auth.user&&Auth.user.role;
  return l==='write'?(r==='admin'||r==='entry'):r==='admin';
};
const needLogin=()=>Auth.ready&&!Auth.user;
const byName=()=>Auth.owner?(Auth.user.name||'Ana hesap'):(Auth.user?Auth.user.name:'');
const strip=o=>{const {id,uid,...r}=o;return r};
function setUser(p){Auth.user=p?{username:p.id,uid:p.uid,name:p.name,role:p.role}:null;Auth.owner=!!p&&p.role==='owner'}
async function loadProfile(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return null;
  const {data,error}=await sb.from('st_profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(error)throw error;
  if(!data||data.active===false){await sb.auth.signOut();return {denied:true}}
  return fromRow.users(data);
}
function applyAuth(){
  const lock=needLogin();
  document.body.className=[lock?'lock':'',can('write')?'':'ro',can('del')?'':'nodel',can('admin')?'':'noadm'].join(' ').trim();
  $('#login').hidden=!lock;
  const w=$('#who');
  w.innerHTML=Auth.user?`<b>${esc(Auth.user.name)}</b><span>${Auth.owner?'Ana hesap':ROLES[Auth.user.role]||''}</span><button class="btn ghost" data-act="pw-change">Şifremi değiştir</button><button class="btn ghost" data-act="logout">Çıkış yap</button>`:'';
  if(CFG.url&&/PROJE-KODU/.test(CFG.url))$('#lErr').textContent='Kurulum tamamlanmamış: config.js dosyasına Supabase adresi ve anahtarı yazılmalı.';
}
let fails=0;
$('#lForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const un=$('#lUser').value.trim().toLowerCase(),pw=$('#lPass').value,err=$('#lErr'),btn=$('#lBtn');
  btn.disabled=true;err.textContent='';
  try{
    const {error}=await sb.auth.signInWithPassword({email:emailFor(un),password:pw});
    if(error){fails++;await new Promise(r=>setTimeout(r,Math.min(5000,500*fails)));err.textContent='Kullanıcı adı veya şifre hatalı.'}
    else{
      const p=await loadProfile();
      if(!p||p.denied){err.textContent='Bu hesaba yetki verilmemiş. Ana hesap sahibine başvurun.'}
      else{fails=0;setUser(p);$('#lPass').value='';startData();render()}
    }
  }catch(x){err.textContent=errMsg(x)}
  btn.disabled=false;
});
function pwModal(){
  openModal({title:'Şifremi değiştir',submit:'Şifreyi değiştir',
    body:`<div class="fgrid">${field('Mevcut şifre',`<input type="password" name="cur" autocomplete="current-password" required>`,'full')}${field('Yeni şifre',`<input type="password" name="pw" minlength="6" autocomplete="new-password" required>`)}${field('Yeni şifre (tekrar)',`<input type="password" name="pw2" minlength="6" autocomplete="new-password" required>`)}</div><p class="hint">Şifre en az 6 karakter olmalı.</p>`,
    onSubmit:async d=>{
      if(d.pw!==d.pw2){toast('Yeni şifreler aynı değil');return false}
      const {error:e1}=await sb.auth.signInWithPassword({email:emailFor(Auth.user.username),password:d.cur});
      if(e1){toast('Mevcut şifre hatalı');return false}
      const {error}=await sb.auth.updateUser({password:d.pw});
      if(error){toast(errMsg(error));return false}
      toast('Şifre değiştirildi');return true}});
}

/* ---------- kullanıcılar ---------- */
function vKullanici(){
  const list=[...S.users].sort((a,b)=>a.id.localeCompare(b.id));
  return head('Kullanıcılar','Hesapları yalnızca ana hesap sahibi açabilir, değiştirebilir ve kapatabilir.',addBtn('user-new','Yeni kullanıcı'))+
  `<div class="stmt-note"><b>Yönetici:</b> tüm kayıtları girer, siler, firma ve fiyatları düzenler. <b>Giriş yetkilisi:</b> satış ve tahsilat girer, silemez. <b>Görüntüleyen:</b> yalnızca görür. Satış ve tahsilat kayıtlarında işlemi yapan kullanıcı görünür.</div>`+
  (list.length?`<div class="card tw"><table><thead><tr><th>Kullanıcı adı</th><th>Ad soyad</th><th>Rol</th><th>Durum</th><th>Açılış</th><th></th></tr></thead><tbody>${list.map(u=>`<tr><td><b>${esc(u.id)}</b></td><td>${esc(u.name)}</td><td>${esc(u.role==='owner'?'Ana hesap':ROLES[u.role]||u.role)}</td><td>${u.active===false?'<span class="pill bad">Kapalı</span>':'<span class="pill good">Aktif</span>'}</td><td class="num">${D(u.created)}</td><td class="row-actions"><button class="btn ghost" data-act="user-edit" data-id="${esc(u.id)}">Düzenle</button><button class="btn ghost" data-act="user-toggle" data-id="${esc(u.id)}">${u.active===false?'Aç':'Kapat'}</button><button class="btn ghost" data-act="user-del" data-id="${esc(u.id)}">Sil</button></td></tr>`).join('')}</tbody></table></div>`:emptyCard('Henüz kullanıcı yok','“Yeni kullanıcı” ile kullanıcı adı, rol ve şifre belirleyin.'));
}
const authClient=()=>window.createPCSClient(CFG.url,CFG.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'st-aux'}});
function userModal(u){
  const edit=!!u,self=edit&&Auth.user&&u.uid===Auth.user.uid;
  openModal({title:edit?'Kullanıcıyı düzenle':'Yeni kullanıcı',submit:edit?'Güncelle':'Kullanıcıyı aç',
    body:`<div class="fgrid">
      ${field('Kullanıcı adı',`<input type="text" name="username" value="${esc(u?u.id:'')}" ${edit?'disabled':'required'} pattern="[a-z0-9_.]{3,30}" autocomplete="off" autocapitalize="none" title="3-30 karakter: küçük harf, rakam, nokta, alt çizgi">`)}
      ${field('Ad soyad',`<input type="text" name="name" value="${esc(u?u.name:'')}" required>`)}
      ${field('Rol',`<select name="role" ${self?'disabled':''}>${Object.entries(self?{owner:'Ana hesap'}:ROLES).map(([k,l])=>`<option value="${k}"${u&&u.role===k?' selected':''}>${l}</option>`).join('')}</select>`)}
      ${field(edit?'Yeni şifre':'Şifre',`<input type="password" name="password" minlength="6" autocomplete="new-password" ${edit?'':'required'}>`)}
    </div><p class="hint">${edit?'Şifreyi değiştirmek istemiyorsanız boş bırakın. ':''}Şifre en az 6 karakter olmalı. Kullanıcı adı yalnızca küçük harf, rakam, nokta ve alt çizgi içerebilir.</p>`,
    onSubmit:async d=>{
      const name=d.name.trim(),role=self?'owner':d.role;
      if(edit){
        const {error}=await sb.from('st_profiles').update({name,role}).eq('id',u.uid);
        if(error){toast(errMsg(error));return false}
        if(d.password){const {error:e2}=await sb.rpc('st_set_password',{p_user:u.uid,p_password:d.password});if(e2){toast(errMsg(e2));return false}}
        await reload('users');toast('Kullanıcı güncellendi');return true;
      }
      const id=d.username.trim().toLowerCase();
      if(!/^[a-z0-9_.]{3,30}$/.test(id)){toast('Kullanıcı adı geçersiz');return false}
      if(S.users.some(x=>x.id===id)){toast('Bu kullanıcı adı alınmış');return false}
      const {data,error}=await authClient().auth.signUp({email:emailFor(id),password:d.password});
      if(error){toast(/registered|exists/i.test(error.message)?'Bu kullanıcı adı alınmış':'Hesap açılamadı: '+error.message);return false}
      if(!data.user||(data.user.identities&&data.user.identities.length===0)){toast('Bu kullanıcı adı alınmış');return false}
      const {error:e3}=await sb.from('st_profiles').insert({id:data.user.id,username:id,name,role,active:true});
      if(e3){toast(errMsg(e3));return false}
      await reload('users');toast('Kullanıcı açıldı');return true}});
}

/* ---------- hızlı günlük giriş ---------- */
function qCalc(){
  const menus=sortedMenus();
  if(!byId(S.menus,U.qMenu))U.qMenu=menus[0]?menus[0].id:'';
  if(!U.qDate)U.qDate=iso(new Date());
  const key=U.qDate+'|'+U.qMenu;if(U.qKey!==key){U.qKey=key;U.qv={}}
  const ex=new Map();
  S.sales.filter(s=>s.date===U.qDate&&s.menu===U.qMenu).forEach(s=>{if(!ex.has(s.firm))ex.set(s.firm,[]);ex.get(s.firm).push(s)});
  return sortedFirms().map(f=>{
    const e=ex.get(f.id)||[],d=U.qv[f.id]||{},multi=e.length>1,sp=priceFor(f.id,U.qMenu);
    const qty=d.qty!==undefined?d.qty:(e[0]?String(e[0].qty):''),price=d.price!==undefined?d.price:(e[0]?String(e[0].price):(sp?String(sp):''));
    const q=qty===''?0:+qty,p=price===''?0:+price;
    return {f,e:e[0],multi,qty,price,q,p,sp,total:q*p,changed:!multi&&(e[0]?(q!==e[0].qty||p!==e[0].price):q>0)};
  });
}
function vHizli(){
  const menus=sortedMenus();
  if(!menus.length||!S.firms.length)return head('Hızlı Giriş','Bir günün satışlarını tek ekranda girin')+emptyCard('Önce firma ve menü ekleyin','Hızlı girişte tüm firmalar alt alta listelenir.');
  const rows=qCalc(),tq=rows.reduce((a,r)=>a+r.q,0),ta=rows.reduce((a,r)=>a+r.total,0),n=rows.filter(r=>r.q>0).length,ch=rows.filter(r=>r.changed).length;
  const nav=`<div class="seg"><button data-act="q-day" data-id="-1" aria-label="Önceki gün">‹</button><button data-act="q-today">Bugün</button><button data-act="q-day" data-id="1" aria-label="Sonraki gün">›</button></div><input type="date" id="qDate" value="${esc(U.qDate)}" aria-label="Gün">${menus.length>1?`<select id="qMenu" aria-label="Menü">${opts(menus,U.qMenu)}</select>`:''}`;
  return head('Hızlı Giriş',`${DL(U.qDate)} · ${esc(mname(U.qMenu))}. Adetleri yazın, Enter ile sonraki firmaya geçin. Boş bırakılan firma için satış oluşmaz; kayıtlı bir adedi silmek için 0 yazın.`,nav)+
  `<div class="tools"><button class="btn" data-act="q-prev">Önceki günden getir</button><button class="btn ghost" data-act="q-clear">Girişleri temizle</button></div>
  <div class="card tw"><table class="qt"><thead><tr><th>Firma</th><th class="r">Adet</th><th class="r">Birim fiyat (₺)</th><th class="r">Tutar</th></tr></thead><tbody>${rows.map(r=>{const id=esc(r.f.id);return `<tr><td><b>${esc(r.f.name)}</b>${r.e?' <span class="pill good">kayıtlı</span>':''}${r.multi?' <span class="pill warn" title="Bu gün bu menü için birden fazla satış var, Satışlar sekmesinden düzenleyin">birden fazla kayıt</span>':''}</td><td class="r"><input class="qin qty" type="number" min="0" step="1" inputmode="numeric" id="qq-${id}" data-f="${id}" data-k="qty" value="${esc(r.qty)}" ${r.multi?'disabled':''} aria-label="${esc(r.f.name)} adet"></td><td class="r"><input class="qin" type="number" min="0" step="0.01" inputmode="decimal" id="qp-${id}" data-f="${id}" data-k="price" value="${esc(r.price)}" ${r.multi?'disabled':''} aria-label="${esc(r.f.name)} birim fiyat"></td><td class="r num" id="qa-${id}">${r.total?money(r.total):''}</td></tr>`}).join('')}</tbody><tfoot><tr><td id="qN">${n} firma</td><td class="r num" id="qTq">${int(tq)}</td><td></td><td class="r num" id="qTa">${money(ta)}</td></tr></tfoot></table></div>
  <div class="savebar"><div><b id="qCh">${ch?ch+' değişiklik kaydedilmedi':'Değişiklik yok'}</b><br><span>Kaydedince satışlar Satışlar ve Cari Hesap sekmelerine işlenir.</span></div><button class="btn primary" id="qSave" data-act="q-save" ${ch?'':'disabled'}>Kaydet</button></div>`;
}
function qRefresh(){
  const rows=qCalc();
  rows.forEach(r=>{const c=document.getElementById('qa-'+r.f.id);if(c)c.textContent=r.total?money(r.total):''});
  const set=(id,t)=>{const e=document.getElementById(id);if(e)e.textContent=t};
  const ch=rows.filter(r=>r.changed).length;
  set('qTq',int(rows.reduce((a,r)=>a+r.q,0)));set('qTa',money(rows.reduce((a,r)=>a+r.total,0)));set('qN',rows.filter(r=>r.q>0).length+' firma');
  set('qCh',ch?ch+' değişiklik kaydedilmedi':'Değişiklik yok');
  const b=document.getElementById('qSave');if(b)b.disabled=!ch;
}
let qBusy=false;
async function qSave(){
  if(qBusy)return;
  const rows=qCalc().filter(r=>r.changed);
  const bad=rows.find(r=>r.q>0&&!(r.p>0));
  if(bad){toast(bad.f.name+' için birim fiyat girin');const el=document.getElementById('qp-'+bad.f.id);if(el)el.focus();return}
  qBusy=true;const btn=document.getElementById('qSave');if(btn)btn.disabled=true;
  let n=0,failed='';
  for(const r of rows){
    let ok;
    if(r.e){ok=r.q===0?await del('sales',r.e.id):await put('sales',r.e.id,{...strip(r.e),qty:r.q,price:r.p,by:byName()})}
    else ok=await put('sales',newId(),{date:U.qDate,firm:r.f.id,menu:U.qMenu,qty:r.q,price:r.p,paid:0,by:byName()});
    if(!ok){failed=r.f.name;break}
    delete U.qv[r.f.id];n++;
  }
  qBusy=false;
  toast(failed?`${n} satır kaydedildi, ${failed} kaydedilemedi`:`${n} satır kaydedildi`);
  render();
}

/* ---------- ay sonu tahsilat ---------- */
const mLabel=m=>new Date(m+'-01T00:00').toLocaleDateString('tr-TR',{month:'long',year:'numeric'});
const mEnd=m=>{const [y,mo]=m.split('-').map(Number);return iso(new Date(y,mo,0))};
const mShift=(m,n)=>{const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
function monthFigures(m){
  const st=m+'-01',en=mEnd(m),map=new Map(S.firms.map(f=>[f.id,{f,open:0,sales:0,qty:0,paid:0}]));
  const g=id=>map.get(id)||(map.set(id,{f:{id,name:fname(id)},open:0,sales:0,qty:0,paid:0}),map.get(id));
  S.sales.forEach(s=>{const r=g(s.firm),a=amt(s),p=s.paid||0;if(s.date<st)r.open+=a-p;else if(s.date<=en){r.sales+=a;r.qty+=s.qty||0;r.paid+=p}});
  S.payments.forEach(p=>{const r=g(p.firm);if(p.date<st)r.open-=p.amount;else if(p.date<=en)r.paid+=p.amount});
  return [...map.values()].map(r=>({...r,close:r.open+r.sales-r.paid}));
}
function vAysonu(){
  if(!U.month)U.month=(lastDate()||iso(new Date())).slice(0,7);
  const all=monthFigures(U.month).filter(r=>Math.abs(r.open)>0.005||r.sales>0||r.paid>0);
  const list=(U.mFilter==='open'?all.filter(r=>r.close>0.005):all).sort((a,b)=>b.close-a.close||a.f.name.localeCompare(b.f.name,'tr'));
  const T=all.reduce((a,r)=>({o:a.o+r.open,s:a.s+r.sales,q:a.q+r.qty,p:a.p+r.paid,c:a.c+r.close}),{o:0,s:0,q:0,p:0,c:0});
  const paidFirms=all.filter(r=>r.sales>0&&r.close<=0.005).length,saleFirms=all.filter(r=>r.sales>0).length;
  const selRows=list.filter(r=>U.sel[r.f.id]&&r.close>0.005),selSum=selRows.reduce((a,r)=>a+r.close,0),openRows=list.filter(r=>r.close>0.005);
  const status=r=>r.close<-0.005?'<span class="pill good">Fazla ödeme</span>':r.close<=0.005?'<span class="pill good">Kapandı</span>':r.paid>0?'<span class="pill warn">Kısmi</span>':'<span class="pill bad">Ödenmedi</span>';
  const nav=`<div class="seg"><button data-act="m-day" data-id="-1" aria-label="Önceki ay">‹</button><button data-act="m-day" data-id="0">Son satış ayı</button><button data-act="m-day" data-id="1" aria-label="Sonraki ay">›</button></div><input type="month" id="mMonth" value="${esc(U.month)}" aria-label="Ay"><select id="mFilter" aria-label="Filtre"><option value="all"${U.mFilter!=='open'?' selected':''}>Tüm firmalar</option><option value="open"${U.mFilter==='open'?' selected':''}>Yalnızca açık bakiye</option></select>`;
  return head('Ay Sonu Tahsilat',`${mLabel(U.month)} · ay sonu itibarıyla firma bakiyeleri. Devir, önceki aylardan kalan bakiyedir.`,nav)+
  `<div class="grid kpis"><div class="card kpi"><small>Ay satışı</small><b class="num">${money(T.s)}</b><em>${int(T.q)} porsiyon</em></div><div class="card kpi ok"><small>Ay içi tahsilat</small><b class="num">${money(T.p)}</b><em>${saleFirms?paidFirms+' / '+saleFirms+' firma kapandı':'—'}</em></div><div class="card kpi"><small>Devir</small><b class="num">${money(T.o)}</b><em>önceki aylardan</em></div><div class="card kpi ${T.c>0?'hot':''}"><small>Ay sonu kalan</small><b class="num">${money(T.c)}</b><em>${all.filter(r=>r.close>0.005).length} firmadan</em></div></div>`+
  (list.length?`<div class="card tw"><table><thead><tr><th style="width:40px"><input type="checkbox" class="chk" id="mAll" aria-label="Tümünü seç"${openRows.length&&openRows.every(r=>U.sel[r.f.id])?' checked':''}></th><th>Firma</th><th class="r">Devir</th><th class="r">Ay satışı</th><th class="r">Ay tahsilatı</th><th class="r">Ay sonu kalan</th><th>Durum</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td>${r.close>0.005?`<input type="checkbox" class="chk mchk" data-id="${esc(r.f.id)}"${U.sel[r.f.id]?' checked':''} aria-label="${esc(r.f.name)} seç">`:''}</td><td><b>${esc(r.f.name)}</b></td><td class="r num">${money(r.open)}</td><td class="r num">${money(r.sales)}</td><td class="r num">${money(r.paid)}</td><td class="r num ${r.close>0.005?'neg':''}"><b>${money(r.close)}</b></td><td>${status(r)}</td><td class="row-actions">${r.close>0.005?`<button class="btn ghost" data-act="m-pay" data-id="${esc(r.f.id)}">Tahsil et</button>`:''}<button class="btn ghost" data-act="stmt" data-id="${esc(r.f.id)}">Ekstre</button></td></tr>`).join('')}</tbody><tfoot><tr><td></td><td>Toplam (${list.length} firma)</td><td class="r num">${money(list.reduce((a,r)=>a+r.open,0))}</td><td class="r num">${money(list.reduce((a,r)=>a+r.sales,0))}</td><td class="r num">${money(list.reduce((a,r)=>a+r.paid,0))}</td><td class="r num">${money(list.reduce((a,r)=>a+r.close,0))}</td><td></td><td></td></tr></tfoot></table></div>
  <div class="savebar"><div><b>${selRows.length?`${selRows.length} firma seçili · ${money(selSum)}`:'Firma seçilmedi'}</b><br><span>Seçili firmaların ay sonu kalanını tek seferde tahsil edildi olarak kaydedin.</span></div><button class="btn primary" data-act="m-bulk" ${selRows.length?'':'disabled'}>Seçilenleri tahsil et</button></div>`:emptyCard('Bu ay için hareket yok','Başka bir ay seçin.'));
}
function bulkPayModal(){
  const L=monthFigures(U.month).filter(r=>U.sel[r.f.id]&&r.close>0.005).sort((a,b)=>b.close-a.close);
  if(!L.length){toast('Tahsil edilecek firma seçin');return}
  const total=L.reduce((a,r)=>a+r.close,0);
  openModal({title:'Toplu tahsilat',submit:`${L.length} tahsilatı kaydet`,
    body:`<div class="fgrid">${field('Tahsilat tarihi',`<input type="date" name="date" value="${iso(new Date())}" required>`)}${field('Yöntem',`<select name="method">${['Nakit','Havale / EFT','Çek','Kredi kartı'].map(m=>`<option>${m}</option>`).join('')}</select>`)}${field('Not',`<input type="text" name="note" value="${esc(mLabel(U.month))} ay sonu">`,'full')}</div>
    <div class="stmt-note"><b>${L.length} firma · ${money(total)}</b><br>${L.slice(0,6).map(r=>`${esc(r.f.name)} ${money(r.close)}`).join(' · ')}${L.length>6?` ve ${L.length-6} firma daha`:''}</div><p class="hint">Her firma için ay sonu kalan tutar kadar ayrı bir tahsilat kaydı oluşturulur.</p>`,
    onSubmit:async d=>{
      let n=0;
      for(const r of L){
        const ok=await put('payments',newId(),{date:d.date,firm:r.f.id,amount:Math.round(r.close*100)/100,method:d.method,note:d.note.trim(),by:byName()});
        if(!ok){toast(`${n} tahsilat kaydedildi, ${r.f.name} kaydedilemedi`);return false}
        delete U.sel[r.f.id];n++;
      }
      toast(`${n} tahsilat kaydedildi`);return true}});
}

const RENDER={ozet:vOzet,satis:vSatis,hizli:vHizli,firma:vFirma,menu:vMenu,fiyat:vFiyat,cari:vCari,aysonu:vAysonu,tahsilat:vTahsilat,rapor:vRapor,yedek:vYedek,kullanici:vKullanici};
const COUNT={satis:()=>S.sales.length,firma:()=>S.firms.length,menu:()=>S.menus.length,tahsilat:()=>S.payments.length,kullanici:()=>S.users.length};
const visibleViews=()=>VIEWS.filter(([k])=>k==='kullanici'?Auth.owner:k==='yedek'?can('admin'):(k==='hizli'||k==='aysonu')?can('write'):true);

/* ---------- yedek ---------- */
function backupData(){
  return {
    firms:S.firms.map(f=>({id:f.id,name:f.name,phone:f.phone})),
    menus:S.menus.map(m=>({id:m.id,name:m.name})),
    prices:S.prices.map(p=>({id:p.id,firm:p.firm,menu:p.menu,price:p.price})),
    sales:S.sales.map(s=>({id:s.id,date:s.date,firm:s.firm,menu:s.menu,qty:s.qty,price:s.price,paid:s.paid||0})),
    payments:S.payments.map(p=>({id:p.id,date:p.date,firm:p.firm,amount:p.amount,method:p.method,note:p.note})),
    migratedV2:true
  };
}
function download(name,text,type){
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
const KIND={otomatik:'Otomatik',elle:'Elle',oncesi:'Geri yükleme öncesi'};
const ago=t=>{const h=(Date.now()-new Date(t))/36e5;return h<1?'az önce':h<24?Math.floor(h)+' saat önce':Math.floor(h/24)+' gün önce'};
const stamp=t=>new Date(t).toLocaleString('tr-TR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
async function loadBackups(){
  if(!can('admin'))return;
  const {data,error}=await sb.from('st_backups').select('id,taken_at,kind,note,counts').order('taken_at',{ascending:false}).limit(60);
  S.backups=error?[]:data;U.bkState=error?'error':'ok';schedule();
}
async function backupPayload(id){
  const {data,error}=await sb.from('st_backups').select('payload,taken_at,kind').eq('id',id).maybeSingle();
  if(error||!data){toast('Yedek okunamadı');return null}
  return data;
}
function vYedek(){
  if(can('admin')&&!U.bkState){U.bkState='loading';loadBackups()}
  const bl=S.backups||[],auto=bl.find(b=>b.kind==='otomatik');
  const stale=!auto||(Date.now()-new Date(auto.taken_at))>36*36e5;
  const banner=U.bkState==='error'?'<div class="note">Yedek listesi okunamadı. supabase/yedekleme.sql dosyası Supabase\'de çalıştırılmamış olabilir.</div>'
    :U.bkState!=='ok'?''
    :stale?`<div class="note">${auto?`Son otomatik yedek ${ago(auto.taken_at)} alındı. 36 saatten uzun süredir yenisi alınmamış. Supabase'de zamanlayıcının (pg_cron) açık olduğunu kontrol edin.`:'Henüz otomatik yedek yok. İlk yedek gece 05:00\'te alınır; hemen denemek için "Şimdi yedekle"ye basın.'}</div>`
    :`<div class="stmt-note">Otomatik yedekleme çalışıyor. Son yedek: <b>${stamp(auto.taken_at)}</b> (${ago(auto.taken_at)}).</div>`;
  const rows=bl.map(b=>{const c=b.counts||{};return `<tr><td class="num">${stamp(b.taken_at)}</td><td><span class="pill ${b.kind==='otomatik'?'good':b.kind==='oncesi'?'warn':''}">${KIND[b.kind]||b.kind}</span></td><td>${int(c.firms)} firma · ${int(c.sales)} satış · ${int(c.payments)} tahsilat</td><td>${esc(b.note)}</td><td class="row-actions"><button class="btn ghost" data-act="bk-dl" data-id="${b.id}">İndir</button>${Auth.owner?`<button class="btn ghost" data-act="bk-restore" data-id="${b.id}">Geri yükle</button>`:''}</td></tr>`}).join('');
  return head('Yedek','Kayıtlar her gece otomatik yedeklenir. Yedekleri indirebilir, istediğiniz bir ana geri dönebilirsiniz.',can('admin')?'<button class="btn primary" data-act="bk-now">Şimdi yedekle</button>':'')+
  banner+
  `<section class="card"><header><h2>Otomatik ve elle alınan yedekler</h2><span>Son 35 gün ve her ayın ilk günü</span></header>${bl.length?`<div class="tw"><table><thead><tr><th>Tarih</th><th>Tür</th><th>İçerik</th><th>Not</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="empty"><b>${U.bkState==='ok'?'Henüz yedek yok':'Yükleniyor'}</b>${U.bkState==='ok'?'Yedekler burada listelenir.':''}</div>`}</section>
  <div class="grid two">
    <section class="card pad"><h2>Bilgisayara indir</h2><p class="hint" style="margin:6px 0 14px">Şu anki tüm kayıtları (${S.sales.length} satış, ${S.payments.length} tahsilat, ${S.firms.length} firma) JSON dosyası olarak indirir. Otomatik yedekler Supabase projesinin içinde durur; ayda bir bu dosyayı da saklamanız önerilir.</p><button class="btn" data-act="bk-export">Dosyayı indir</button></section>
    ${Auth.owner?`<section class="card pad"><h2>Dosyadan yükle</h2><p class="hint" style="margin:6px 0 14px">Bir yedek dosyasındaki kayıtlar eklenir; aynı kimlikli kayıtlar yedekteki haline döner. Hiçbir kayıt silinmez.</p><div class="tools"><input type="file" id="bkFile" accept="application/json,.json" aria-label="Yedek dosyası"><button class="btn" data-act="bk-import">Yükle</button></div></section>`:''}
  </div>`;
}
async function importData(j){
  const arr=k=>Array.isArray(j[k])?j[k]:[];
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const set=[['st_firms',arr('firms').map(x=>({id:x.id,name:x.name,phone:x.phone||''}))],
    ['st_menus',arr('menus').map(x=>({id:x.id,name:x.name}))],
    ['st_prices',arr('prices').map(x=>({id:x.id,firm_id:x.firm,menu_id:x.menu,price:+x.price}))],
    ['st_sales',arr('sales').map(x=>({id:x.id,date:x.date,firm_id:x.firm,menu_id:x.menu,qty:+x.qty,price:+x.price,paid:+x.paid||0,by_name:x.by||'Yedek'}))],
    ['st_payments',arr('payments').map(x=>({id:x.id,date:x.date,firm_id:x.firm,amount:+x.amount,method:x.method||'',note:x.note||'',by_name:x.by||'Yedek'}))]];
  const total=set.reduce((a,[,r])=>a+r.length,0);
  if(!total){toast('Dosyada kayıt bulunamadı');return false}
  if(set.some(([,r])=>r.some(x=>!uuid.test(x.id)))){toast('Dosyadaki kayıt kimlikleri geçersiz');return false}
  let n=0;
  for(const [t,rows] of set){
    for(let i=0;i<rows.length;i+=500){
      const {error}=await sb.from(t).upsert(rows.slice(i,i+500));
      if(error){toast(`${t.replace('st_','')} yüklenemedi: ${errMsg(error)}`);return false}
      n+=Math.min(500,rows.length-i);toast(`Yükleniyor… ${n} / ${total}`);
    }
  }
  await Promise.all(COLS.filter(c=>c!=='users').map(reload));
  toast(`${total} kayıt yüklendi`);return true;
}
async function bkImport(){
  const f=$('#bkFile')&&$('#bkFile').files[0];
  if(!f){toast('Önce bir yedek dosyası seçin');return}
  let j;try{j=JSON.parse(await f.text())}catch(e){toast('Dosya okunamadı, geçerli bir yedek değil');return}
  const btn=document.querySelector('[data-act="bk-import"]');if(btn)btn.disabled=true;
  await importData(j);
  if(btn)btn.disabled=false;render();
}
function restoreModal(id){
  const b=(S.backups||[]).find(x=>String(x.id)===String(id));if(!b)return;
  const c=b.counts||{};
  openModal({title:'Yedeğe geri dön',submit:'Geri yükle',danger:true,noFocus:true,
    body:`<p style="margin:0"><b>${stamp(b.taken_at)}</b> tarihli yedek (${int(c.firms)} firma, ${int(c.sales)} satış, ${int(c.payments)} tahsilat) geri yüklenecek.</p>
    <div class="note">Yedekte bulunan kayıtlar yedekteki haline döner; sonradan silinmiş olanlar geri gelir. Yedekten sonra eklenen yeni kayıtlar silinmez. İşlemden hemen önce bugünün halinin yedeği otomatik alınır.</div>`,
    onSubmit:async()=>{
      const {error}=await sb.rpc('st_backup_now',{p_kind:'oncesi',p_note:'Geri yüklemeden önce'});
      if(error){toast('Önce yedek alınamadı, geri yükleme yapılmadı');return false}
      const p=await backupPayload(id);if(!p)return false;
      const ok=await importData(p.payload);
      if(ok){await loadBackups();toast('Yedek geri yüklendi')}
      return ok}});
}

function render(){
  applyAuth();
  if(!Auth.ready){$('#main').innerHTML='<div class="empty"><b>Yükleniyor</b>Oturum kontrol ediliyor.</div>';return}
  if(needLogin())return;
  if(!visibleViews().some(v=>v[0]===U.view))U.view='ozet';
  const a=document.activeElement,keep=a&&a.id&&$('#main').contains(a)?{id:a.id,s:a.selectionStart,e:a.selectionEnd}:null;
  $('#nav').innerHTML=visibleViews().map(([k,l])=>`<button data-act="go" data-id="${k}"${U.view===k?' aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>${l}${COUNT[k]?`<span class="cnt">${COUNT[k]()}</span>`:''}</button>`).join('');
  $('#dot').className='dot'+(dbErr?' off':'');
  $('#syncTxt').textContent=dbErr?'Bağlantı sorunu':COLS.filter(c=>c!=='users'||Auth.owner).some(c=>!ready[c])?'Yükleniyor':'Kayıtlar senkron';
  $('#main').innerHTML=RENDER[U.view]();
  if(keep){const el=document.getElementById(keep.id);if(el){el.focus();try{el.setSelectionRange(keep.s,keep.e)}catch(e){}}}
}
let pending=false;
const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;render()})};

/* ---------- CSV ---------- */
function saveCsv(name,rows){
  const csv='﻿'+rows.map(r=>r.map(c=>{c=String(c??'');return /[";\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(';')).join('\r\n');
  download(name,csv,'text/csv;charset=utf-8');toast('Dosya indirildi');
}

/* ---------- olaylar ---------- */
function setView(v){U.view=v;U.q='';try{sessionStorage.setItem('st-view',v)}catch(e){}render();window.scrollTo(0,0)}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,id=t.dataset.id;
  switch(a){
    case 'close':closeModal();break;
    case 'go':setView(id);break;
    case 'sale-new':saleModal();break;
    case 'sale-edit':saleModal(byId(S.sales,id));break;
    case 'sale-del':{const s=byId(S.sales,id);confirmDel('Satışı sil',`${esc(fname(s.firm))} · ${D(s.date)} · ${int(s.qty)} adet (${money(amt(s))}) silinecek.`,()=>del('sales',id));break}
    case 'pay-new':payModal();break;
    case 'pay-edit':payModal(byId(S.payments,id));break;
    case 'pay-del':{const p=byId(S.payments,id);confirmDel('Tahsilatı sil',`${esc(fname(p.firm))} · ${D(p.date)} · ${money(p.amount)} silinecek.`,()=>del('payments',id));break}
    case 'firm-new':firmModal();break;
    case 'firm-edit':firmModal(byId(S.firms,id));break;
    case 'firm-del':{
      if(S.sales.some(s=>s.firm===id)||S.payments.some(p=>p.firm===id)){toast('Satış veya tahsilatı olan firma silinemez');break}
      confirmDel('Firmayı sil',`${esc(fname(id))} ve özel fiyatları silinecek.`,async()=>{for(const p of S.prices.filter(p=>p.firm===id))await del('prices',p.id);return del('firms',id)});break}
    case 'menu-new':menuModal();break;
    case 'menu-edit':menuModal(byId(S.menus,id));break;
    case 'menu-del':{
      if(S.sales.some(s=>s.menu===id)){toast('Satışta kullanılan menü silinemez');break}
      confirmDel('Menüyü sil',`${esc(mname(id))} ve bu menünün özel fiyatları silinecek.`,async()=>{for(const p of S.prices.filter(p=>p.menu===id))await del('prices',p.id);return del('menus',id)});break}
    case 'day':{const n=+id;U.date=n===0?(lastDate()||U.date):shift(U.date,n);render();break}
    case 'stmt':openStatement(id);break;
    case 'stmt-clear':U.from=U.to='';$('#sFrom').value=$('#sTo').value='';$('#stmt').innerHTML=stmtHtml(modalCfg.firm);break;
    case 'stmt-pay':{const f=id;closeModal();payModal(null,f);break}
    case 'logout':sb.auth.signOut().then(()=>{setUser(null);stopData();render()});break;
    case 'pw-change':pwModal();break;
    case 'bk-now':sb.rpc('st_backup_now',{p_kind:'elle',p_note:'Elle alındı'}).then(async({error})=>{if(error)toast(errMsg(error));else{await loadBackups();toast('Yedek alındı')}});break;
    case 'bk-dl':backupPayload(id).then(p=>{if(p){download(`satis-cari-yedek-${p.taken_at.slice(0,10)}-${p.kind}.json`,JSON.stringify(p.payload,null,2),'application/json');toast('Yedek indirildi')}});break;
    case 'bk-restore':restoreModal(id);break;
    case 'bk-export':download(`satis-cari-yedek-${iso(new Date())}.json`,JSON.stringify(backupData(),null,2),'application/json');toast('Yedek indirildi');break;
    case 'bk-import':bkImport();break;
    case 'user-new':userModal();break;
    case 'user-edit':userModal(byId(S.users,id));break;
    case 'user-toggle':{
      const u=byId(S.users,id);
      if(u.uid===Auth.user.uid){toast('Kendi hesabınızı kapatamazsınız');break}
      sb.from('st_profiles').update({active:u.active===false}).eq('id',u.uid).then(async({error})=>{if(error)toast(errMsg(error));else{await reload('users');toast(u.active===false?'Kullanıcı açıldı':'Kullanıcı kapatıldı')}});break}
    case 'user-del':{
      const u=byId(S.users,id);
      if(u.uid===Auth.user.uid){toast('Kendi hesabınızı silemezsiniz');break}
      confirmDel('Kullanıcıyı sil',`${esc(id)} hesabı silinecek. Girdiği kayıtlar kalır.`,async()=>{const {error}=await sb.rpc('st_delete_user',{p_user:u.uid});if(error){toast(errMsg(error));return false}await reload('users');return true});break}
    case 'q-day':U.qDate=shift(U.qDate||iso(new Date()),+id);render();break;
    case 'q-today':U.qDate=iso(new Date());render();break;
    case 'q-clear':U.qv={};render();break;
    case 'q-prev':{
      qCalc();const prev=dates().filter(d=>d<U.qDate).pop();
      if(!prev){toast('Önceki gün kaydı yok');break}
      const have=new Set(S.sales.filter(s=>s.date===U.qDate&&s.menu===U.qMenu).map(s=>s.firm));let n=0;
      S.sales.filter(s=>s.date===prev&&s.menu===U.qMenu&&!have.has(s.firm)).forEach(s=>{U.qv[s.firm]={qty:String(s.qty),price:String(priceFor(s.firm,U.qMenu)||s.price)};n++});
      toast(`${DS(prev)} gününden ${n} firma getirildi`);render();break}
    case 'q-save':qSave();break;
    case 'm-day':{const n=+id;U.month=n===0?(lastDate()||iso(new Date())).slice(0,7):mShift(U.month,n);U.sel={};render();break}
    case 'm-pay':payModal({date:iso(new Date()),firm:id,amount:Math.round(((monthFigures(U.month).find(r=>r.f.id===id)||{close:0}).close)*100)/100,method:'Nakit',note:mLabel(U.month)+' ay sonu'});break;
    case 'm-bulk':bulkPayModal();break;
    case 'csv-cari':{const A=ageInfo();saveCsv('cari-hesap.csv',[['Firma','Toplam satış','Toplam tahsilat','Cari bakiye','Yaş (gün)','Son satış'],...ledger().sort((a,b)=>b.bal-a.bal).map(r=>{const x=A.map.get(r.f.id);return [r.f.name,r.sales,r.paid,r.bal,r.bal>0.005&&x&&x.oldest?x.age:'',r.last]})]);break}
    case 'csv-rapor':{const r=repData();saveCsv(`rapor-${r.from}-${r.to}.csv`,[['Firma','Gün','Adet','Tutar'],...r.firms.map(f=>[f.name,f.days.size,f.qty,f.amt])]);break}
  }
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-act]')){e.preventDefault();e.target.click()}});
document.addEventListener('input',e=>{
  const t=e.target;if(t.closest('#modal'))return;
  if(t.id==='q'){U.q=t.value;render()}
  else if(t.id==='payQ'){U.payQ=t.value;render()}
});
document.addEventListener('change',async e=>{
  const t=e.target;if(t.closest('#modal'))return;
  if(t.id==='dayIn'&&t.value){U.date=t.value;render()}
  else if(t.id==='sortSel'){U.sort=t.value;render()}
  else if(t.id==='dueSel'){if(await put('settings','app',{dueDays:+t.value}))toast('Vade süresi güncellendi')}
  else if(t.id==='qDate'&&t.value){U.qDate=t.value;render()}
  else if(t.id==='qMenu'){U.qMenu=t.value;render()}
  else if(t.id==='mMonth'&&t.value){U.month=t.value;U.sel={};render()}
  else if(t.id==='mFilter'){U.mFilter=t.value;render()}
  else if(t.id==='mAll'){const m=monthFigures(U.month).filter(r=>r.close>0.005);m.forEach(r=>{if(t.checked)U.sel[r.f.id]=1;else delete U.sel[r.f.id]});render()}
  else if(t.classList.contains('mchk')){if(t.checked)U.sel[t.dataset.id]=1;else delete U.sel[t.dataset.id];render()}
  else if(t.id==='rFrom'){U.repFrom=t.value;render()}
  else if(t.id==='rTo'){U.repTo=t.value;render()}
  else if(t.classList.contains('pin')){
    const {firm,menu}=t.dataset,ex=S.prices.find(p=>p.firm===firm&&p.menu===menu),v=t.value.trim();
    if(v===''){if(ex&&await del('prices',ex.id))toast('Özel fiyat kaldırıldı')}
    else{const n=+v;if(!(n>=0)){toast('Geçerli bir tutar girin');return}if(ex&&ex.price===n)return;if(await put('prices',ex?ex.id:newId(),{firm,menu,price:n}))toast('Fiyat kaydedildi')}
  }
});

document.addEventListener('input',e=>{
  const t=e.target;if(!t.classList||!t.classList.contains('qin'))return;
  const f=t.dataset.f;(U.qv[f]=U.qv[f]||{})[t.dataset.k]=t.value;qRefresh();
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!e.target.classList||!e.target.classList.contains('qin'))return;
  e.preventDefault();
  const k=e.target.dataset.k,list=[...document.querySelectorAll('.qin[data-k="'+k+'"]:not(:disabled)')],i=list.indexOf(e.target);
  if(list[i+1]){list[i+1].focus();list[i+1].select()}
});

/* ---------- başlangıç ---------- */
render();
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT'&&Auth.user){setUser(null);stopData();render()}});
(async()=>{
  try{
    const p=await loadProfile();
    if(p&&!p.denied){setUser(p);startData()}
  }catch(e){dbErr=(e&&e.code)||'error'}
  Auth.ready=true;render();
})();
