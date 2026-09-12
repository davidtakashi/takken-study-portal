import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://dnuwrkgbqdvnxaxufker.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rqV2EM2BV26dQuMAf6VY2w_vQCnu_od';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const [resources, topics, items] = await Promise.all([
  fetch('./data/resources.json?v=20260910-storage1',{cache:'no-store'}).then(r=>r.json()),
  fetch('./data/topics.json?v=20260910-storage1',{cache:'no-store'}).then(r=>r.json()),
  fetch('./data/items.json?v=20260910-storage1',{cache:'no-store'}).then(r=>r.json()),
]);
const resourceById = new Map(resources.map(r=>[r.id,r]));
const topicById = new Map(topics.map(t=>[t.id,t]));
let progress = [];
let currentTab = 'home';
const THEME_KEY = 'takken-theme';
const FILTER_KEY='takken-filter', LAST_KEY='takken-last-item';
let currentFilter=localStorage.getItem(FILTER_KEY)||'all', searchTerm='';
const themes = {
  dark: { label:'ダーク', note:'紺〜チャコール。夜や長時間の勉強向け', color:'#17243a' },
  green: { label:'グリーン', note:'落ち着いた深緑。目にやさしい集中モード', color:'#27443a' },
  warm: { label:'ウォーム', note:'真っ白を避けたベージュ系。昼間向け', color:'#e6ddcf' },
  auto: { label:'端末に合わせる', note:'スマホの表示設定に自動で合わせる', color:'#17243a' }
};
let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';
function applyTheme(name){
  if(!themes[name]) name='dark';
  currentTheme=name;
  const actual=name==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'warm'):name;
  document.documentElement.dataset.theme=actual;
  localStorage.setItem(THEME_KEY,name);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themes[actual].color);
}
applyTheme(currentTheme);
const $ = s => document.querySelector(s);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = iso => iso ? new Date(iso).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'}) : '';
const fields=['権利関係','宅建業法','法令上の制限','税・その他'];
const topicIdsOf=i=>Array.isArray(i.topic_ids)?i.topic_ids:(i.topic_id?[i.topic_id]:[]);
const fieldOf=i=>{for(const id of topicIdsOf(i)){const t=topicById.get(id);if(t?.field)return t.field;}return (i.native_path||'').split(' / ')[0]||'';};
const topicNamesOf=i=>topicIdsOf(i).map(id=>topicById.get(id)?.name).filter(Boolean);

async function refreshSession(){
  const { data:{ session } } = await supabase.auth.getSession();
  if(session) await enterApp(session.user); else showLogin();
}
function showLogin(){ $('#loginView').classList.remove('hidden'); $('#mainView').classList.add('hidden'); }
async function enterApp(user){
  $('#loginView').classList.add('hidden'); $('#mainView').classList.remove('hidden');
  $('#userEmail').textContent=user.email??''; await loadProgress(); render();
}
async function loadProgress(){
  const {data,error}=await supabase.from('progress').select('item_id,round_no,completed_at').order('completed_at',{ascending:false});
  if(error) throw error; progress=data??[];
}
const pkey=(id,n)=>`${id}::${n}`;
const progressMap=()=>new Map(progress.map(p=>[pkey(p.item_id,p.round_no),p]));
function progressForItem(i,n){return progressMap().get(pkey(i.id,n))||null;}
function statusOf(i){const n=[1,2,3].filter(x=>progressForItem(i,x)).length;return n===0?'unstarted':n===3?'complete':'partial';}
function filtered(list){return list.filter(i=>(currentFilter==='all'||statusOf(i)===currentFilter)&&(!searchTerm||[i.title,i.native_path,resourceById.get(i.resource_id)?.name,...topicNamesOf(i)].join(' ').toLowerCase().includes(searchTerm.toLowerCase())));}
function toolsHTML(){return `<div class="study-tools"><input id="searchBox" type="search" placeholder="論点・教材を検索" value="${esc(searchTerm)}"><div class="filters">${[['all','すべて'],['unstarted','未着手'],['partial','途中'],['complete','完了']].map(([id,l])=>`<button class="filter-btn ${currentFilter===id?'active':''}" data-filter="${id}">${l}</button>`).join('')}</div></div>`;}
async function toggleProgress(itemId,roundNo){
  const item=items.find(i=>i.id===itemId); if(!item)return;
  const existing=progressForItem(item,roundNo);
  if(existing){
    const {error}=await supabase.from('progress').delete().eq('item_id',item.id).eq('round_no',roundNo); if(error)return alert(error.message);
  }else{
    const {data:{user}}=await supabase.auth.getUser();
    const {error}=await supabase.from('progress').upsert({user_id:user.id,item_id:item.id,round_no:roundNo,completed_at:new Date().toISOString()},{onConflict:'user_id,item_id,round_no'}); if(error)return alert(error.message);
  }
  localStorage.setItem(LAST_KEY,JSON.stringify({itemId:item.id,roundNo}));
  await loadProgress();
  // Do not rebuild the page here: open details and scroll position stay exactly where they are.
  updateRoundButtons(item.id);
}
function updateRoundButtons(itemId){
  const item=items.find(i=>i.id===itemId); if(!item)return;
  document.querySelectorAll(`.round-btn[data-item="${CSS.escape(itemId)}"]`).forEach(b=>{
    const n=Number(b.dataset.round),p=progressForItem(item,n);
    b.classList.toggle('done',!!p);
    b.innerHTML=`<span>${n}</span>${p?`✓ <small>${fmt(p.completed_at)}</small>`:'□'}`;
  });
}
function roundButtons(itemId){
  const item=items.find(i=>i.id===itemId);
  return `<div class="rounds">${[1,2,3].map(n=>{const p=item&&progressForItem(item,n);return `<button class="round-btn ${p?'done':''}" data-item="${esc(itemId)}" data-round="${n}"><span>${n}</span>${p?`✓ <small>${fmt(p.completed_at)}</small>`:'□'}</button>`}).join('')}</div>`;
}
function resourceShort(r){
  return r.name.replace('みんなが欲しかった！宅建士の教科書 2023','みんほし教科書 2023').replace('わかって合格る宅建士 基本テキスト 2026','わかって合格る 基本テキスト').replace('わかって合格る ','わかって合格る｜').replace('LEC 合格のトリセツ ','LECトリセツ｜');
}
async function openStoredPdf(path){
  const w=window.open('', '_blank');
  try{
    const {data,error}=await supabase.storage.from('takken-pdfs').createSignedUrl(path, 86400);
    if(error) throw error;
    if(!data?.signedUrl) throw new Error('署名付きURLを作成できませんでした');
    if(w) w.location.href=data.signedUrl; else window.location.href=data.signedUrl;
  }catch(err){
    if(w) w.close();
    alert(`PDFを開けませんでした。StorageにPDFが入っているか確認してください。\n${err.message}`);
  }
}
function cleanNativePath(path){return String(path||'').split(' / ').filter(x=>x&&x!=='合格のトリセツ基準').join(' / ');}
function itemRow(i,{showResource=false,showPath=false,showTopics=false}={}){
  const r=resourceById.get(i.resource_id), names=topicNamesOf(i);
  const linkLabel=i.link_kind==='pdf'?'該当PDFを開く ↗':i.link_kind==='app'?'Knounで開く ↗':i.link_kind==='video'?'講義を開く ↗':'教材を開く ↗';
  const sourceLink=i.storage_path?`<button type="button" class="source-link storage-link" data-storage-path="${esc(i.storage_path)}">${linkLabel}</button>`:(i.url?`<a class="source-link" href="${esc(i.url)}" target="_blank" rel="noopener">${linkLabel}</a>`:'');
  return `<div class="item-row"><div class="item-main">${showResource?`<div class="resource-name">${esc(resourceShort(r))}</div>`:`<div class="item-title">${esc(i.title)}</div>`}${showPath?`<div class="native">${esc(cleanNativePath(i.native_path))}</div>`:''}${showTopics&&names.length?`<div class="native topic-map-text">対応：${names.map(n=>esc(n)).join('・')}</div>`:''}${sourceLink}</div>${roundButtons(i.id)}</div>`;
}
function percentFor(subset,n){ if(!subset.length)return 0; return Math.round(subset.filter(i=>progressForItem(i,n)).length/subset.length*100); }
function homeHTML(){
  const now=new Date(), weekAgo=new Date(Date.now()-7*86400000);
  const todayN=progress.filter(p=>new Date(p.completed_at).toDateString()===now.toDateString()).length, weekN=progress.filter(p=>new Date(p.completed_at)>=weekAgo).length;
  let last=null;try{last=JSON.parse(localStorage.getItem(LAST_KEY)||'null')}catch{};
  const action=(last&&items.find(i=>i.id===last.itemId))||items.find(i=>statusOf(i)!=='complete'), ar=action&&resourceById.get(action.resource_id), at=action&&topicById.get(topicIdsOf(action)[0]);
  const fieldCards=fields.map(field=>{const ids=new Set(topics.filter(t=>t.field===field).map(t=>t.id));const subset=items.filter(i=>topicIdsOf(i).some(id=>ids.has(id)));return `<div class="card field-card"><h3>${field}</h3>${[1,2,3].map(n=>{const p=percentFor(subset,n);return `<div class="progress-line"><span>${n}周目</span><div class="progress"><i style="width:${p}%"></i></div><b>${p}%</b></div>`}).join('')}</div>`}).join('');
  const resourceCards=resources.map(r=>{const subset=items.filter(i=>i.resource_id===r.id);const p1=percentFor(subset,1),p2=percentFor(subset,2),p3=percentFor(subset,3);return `<div class="card home-resource-card"><div class="home-resource-head"><div><span class="chip">${esc(r.label)}</span><h3>${esc(resourceShort(r))}</h3></div><strong>${p1}%</strong></div><div class="progress home-resource-progress"><i style="width:${p1}%"></i></div><div class="home-round-rates"><span>① ${p1}%</span><span>② ${p2}%</span><span>③ ${p3}%</span></div></div>`}).join('');
  return `<div class="hero-card"><div><div class="eyebrow">宅建 STUDY</div><h2>今日の進み具合</h2></div><div class="hero-count">今日 <b>${todayN}</b> / 今週 <b>${weekN}</b></div></div>`+(action?`<div class="card resume-card"><div class="eyebrow">${last?'続きから再開':'次にやる'}</div><h3>${esc(at?.field||'')} ＞ ${esc(at?.name||action.title)}</h3><p>${esc(resourceShort(ar))}</p><button class="jump-btn" data-jump="${esc(action.id)}">開く →</button></div>`:'')+`<div class="home-section-title">分野別の進捗</div>`+fieldCards+`<div class="home-section-title">教材別の進捗 <span>大きな数字＝①の完了率</span></div>`+resourceCards;
}
function topicsHTML(){
  const byCat=cat=>new Set(resources.filter(r=>r.category===cat).map(r=>r.id));
  const paperIds=byCat('紙テキスト'), digitalIds=byCat('デジタル教材'), lectureIds=byCat('講義');
  const topicRows=(field,group)=>topics.filter(t=>t.field===field&&(!group||t.group===group)).map(t=>{
    const allRelated=items.filter(i=>topicIdsOf(i).includes(t.id));
    const related=filtered(allRelated);
    const counts=ids=>new Set(allRelated.filter(i=>ids.has(i.resource_id)).map(i=>i.resource_id)).size;
    const sections=[['紙テキスト',paperIds],['デジタル教材',digitalIds],['講義',lectureIds]].map(([label,ids])=>{const rows=related.filter(i=>ids.has(i.resource_id));return rows.length?`<div class="topic-section-label">${label}</div>${rows.map(i=>itemRow(i,{showResource:true,showPath:true})).join('')}`:''}).join('');
    return `<details class="level-topic"><summary><span>${t.name}</span><span class="coverage coverage-multi">紙${counts(paperIds)}/2・デジ${counts(digitalIds)}/8・講義${counts(lectureIds)}/1</span></summary>${sections||'<div class="empty-field">現在の絞り込み条件に該当する教材はありません。</div>'}</details>`;
  }).join('');
  return toolsHTML()+`<div class="view-note">論点別にも紙テキスト・デジタル教材・講義をすべて表示します。同じ教材セクションが複数論点に対応する場合、どこか1か所でチェックすれば同じ進捗として反映されます。</div>`+fields.map(field=>{
    return `<details class="level-field" open><summary>${field}</summary>${topicRows(field,null)}</details>`;
  }).join('');
}
function renderNativeTree(list,field){
  const rows=[...list].sort((a,b)=>(a.native_order??0)-(b.native_order??0));
  const root={children:new Map(),items:[]};
  for(const i of rows){
    let parts=(i.native_path||'').split(' / ').filter(Boolean);
    if(parts[0]===field) parts=parts.slice(1);
    if(parts.length && parts[parts.length-1]===i.title) parts=parts.slice(0,-1);
    let node=root;
    for(const part of parts){if(!node.children.has(part))node.children.set(part,{children:new Map(),items:[]});node=node.children.get(part);}
    node.items.push(i);
  }
  const draw=(node,depth=0)=>{
    let html='';
    for(const [name,child] of node.children){html+=`<details class="native-level depth-${depth}" open><summary>${esc(name)}</summary>${draw(child,depth+1)}</details>`;}
    html+=node.items.map(i=>itemRow(i,{showTopics:true})).join('');
    return html;
  };
  return draw(root);
}
function resourcesHTML(){
  const cats=['紙テキスト','デジタル教材','講義'];
  return toolsHTML()+`<div class="view-note resource-note">教材別は、各教材の目次・章立ての順に表示します。各セクションの下に「対応論点」を表示し、論点別と同じチェックを共有します。</div>`+
  cats.map(cat=>`<section class="resource-category"><h2>${cat}${cat==='デジタル教材'?'（8）':''}</h2>${resources.filter(r=>r.category===cat).map(r=>{
    const subset=filtered(items.filter(i=>i.resource_id===r.id));
    const p1=percentFor(subset,1),p2=percentFor(subset,2),p3=percentFor(subset,3);
    return `<details class="resource-card"><summary><div class="resource-summary-row"><div class="resource-summary-main"><span class="chip">${r.label}</span><span>${esc(r.name)}</span></div><div class="resource-summary-progress"><strong>${p1}%</strong><small>①${p1}% ②${p2}% ③${p3}%</small></div></div><div class="progress resource-summary-bar"><i style="width:${p1}%"></i></div></summary><div class="resource-four-fields">${fields.map(field=>{const fs=subset.filter(i=>fieldOf(i)===field);const pdfItem=fs.find(i=>i.link_kind==='pdf'&&(i.storage_path||i.url));const fieldPdf=pdfItem?(pdfItem.storage_path?`<button type="button" class="field-pdf-link storage-link" data-storage-path="${esc(pdfItem.storage_path)}">この分野のPDFを開く ↗</button>`:`<a class="field-pdf-link" href="${esc(pdfItem.url)}" target="_blank" rel="noopener">この分野のPDFを開く ↗</a>`):'';return `<details class="resource-field"><summary><span>${field}</span><span class="field-count">${fs.length}セクション</span></summary>${fieldPdf}${fs.length?renderNativeTree(fs,field):'<div class="empty-field">この分野の項目はまだ登録されていません。</div>'}</details>`}).join('')}</div></details>`
  }).join('')}</section>`).join('');
}
function recentHTML(){
  const byId=new Map(items.map(i=>[i.id,i]));
  return `<div class="card"><h2>最近やったところ</h2>${progress.slice().sort((a,b)=>new Date(b.completed_at)-new Date(a.completed_at)).slice(0,40).map(p=>{const i=byId.get(p.item_id),r=resourceById.get(i?.resource_id);return `<div class="recent-row"><strong>${fmt(p.completed_at)}</strong><span>${esc(i?.title??p.item_id)}</span><div class="muted">${esc(r?resourceShort(r):'')}｜${p.round_no}周目 ✓</div></div>`}).join('')||'<div class="muted">まだ記録がありません。</div>'}</div>`;
}
function settingsHTML(){return `<div class="card"><h2>カラーテーマ</h2><p class="muted">端末ごとに好きな見た目を選べます。選択は自動で保存されます。</p><div class="theme-grid">${Object.entries(themes).map(([id,t])=>`<button class="theme-choice ${currentTheme===id?'selected':''}" data-theme="${id}"><span class="theme-preview theme-preview-${id}"><i></i><i></i><i></i></span><strong>${t.label}</strong><small>${t.note}</small></button>`).join('')}</div></div><div class="card"><h2>ホーム画面アプリ</h2><p class="muted">ホーム画面からアプリ風に起動できます。</p><button id="installBtn">ホーム画面に追加</button><p id="installHint" class="muted"></p></div><div class="card"><h2>データ管理</h2><p class="muted">進捗はSupabaseに保存され、サイトのファイルを更新しても消えません。</p><button id="exportBtn">JSONバックアップを書き出す</button><label class="import-label">バックアップを読み込む<input id="importFile" type="file" accept="application/json,.json"></label></div>`;}
function render(){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));
  $('#content').innerHTML=({home:homeHTML,topics:topicsHTML,resources:resourcesHTML,recent:recentHTML,settings:settingsHTML}[currentTab])();
  document.querySelectorAll('.round-btn').forEach(b=>b.addEventListener('click',()=>toggleProgress(b.dataset.item,Number(b.dataset.round))));
  document.querySelectorAll('.storage-link').forEach(b=>b.addEventListener('click',()=>openStoredPdf(b.dataset.storagePath)));
  $('#exportBtn')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),progress},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`takken-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
  $('#importFile')?.addEventListener('change',importBackup);
  document.querySelectorAll('.theme-choice').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.theme);render();}));
  document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click',()=>{currentFilter=b.dataset.filter;localStorage.setItem(FILTER_KEY,currentFilter);render();}));
  $('#searchBox')?.addEventListener('change',e=>{searchTerm=e.target.value;render();});
  document.querySelectorAll('.jump-btn').forEach(b=>b.addEventListener('click',()=>{const i=items.find(x=>x.id===b.dataset.jump);currentTab='topics';searchTerm=topicNamesOf(i)[0]||i?.title||'';render();}));
  $('#installBtn')?.addEventListener('click',async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null}else $('#installHint').textContent='ブラウザのメニュー →「ホーム画面に追加」から追加できます。';});
}

async function importBackup(e){
  try{const obj=JSON.parse(await e.target.files[0].text());if(!Array.isArray(obj.progress))throw new Error('progress が見つかりません');const {data:{user}}=await supabase.auth.getUser();const rows=obj.progress.filter(p=>p.item_id&&[1,2,3].includes(Number(p.round_no))).map(p=>({user_id:user.id,item_id:p.item_id,round_no:Number(p.round_no),completed_at:p.completed_at||new Date().toISOString()}));if(rows.length){const {error}=await supabase.from('progress').upsert(rows,{onConflict:'user_id,item_id,round_no'});if(error)throw error;}await loadProgress();render();alert(`${rows.length}件を読み込みました`);}catch(err){alert(`読み込み失敗: ${err.message}`)}
}
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(currentTheme==='auto')applyTheme('auto')});
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginMsg').textContent='ログイン中…';const {error}=await supabase.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});if(error)$('#loginMsg').textContent=error.message;else{$('#loginMsg').textContent='';await refreshSession();}});
$('#logoutBtn').addEventListener('click',async()=>{await supabase.auth.signOut();showLogin();});
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{currentTab=b.dataset.tab;render();}));
supabase.auth.onAuthStateChange((event,session)=>{ if(event==='SIGNED_OUT') showLogin(); else if(event==='SIGNED_IN'&&session) enterApp(session.user); });
refreshSession();
