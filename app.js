/* =========================
   Ju Smile 減脂日誌 - app.js (integrated)
   功能：
   - 日期切換（可瀏覽/編輯任一天）
   - 三種輸入模式：精準 / 單位換算 / Type×份量
   - 常用食物組合（由勾選品項建立、搜尋加入、編輯/刪除）
   - 運動紀錄（MET 計算）
   - 今日概況（對比目標）＋蛋白質/喝水未達標提醒
   - 喝水紀錄（每日目標、快速加入、進度條）
   - 報表（最近7/30天、本月）
   - CSV 同步：TYPE_TABLE / UNIT_MAP / FOOD_DB
   ========================= */

const APP_VERSION = 'v2.3';
const $ = (id)=>document.getElementById(id);
if ($('appVer')) $('appVer').textContent = APP_VERSION;

/* ---------- LocalStorage 基礎 ---------- */
const STORE_KEY = 'jusmile-days';
const CAL_KEY   = 'jusmile-cal-target';
const PRO_KEY   = 'jusmile-pro-target';
const WT_KEY    = 'jusmile-user-weight';
const WATER_TARGET_KEY = 'jusmile-water-target';

function readStore(){ try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}');}catch{return {}} }
function writeStore(db){ localStorage.setItem(STORE_KEY, JSON.stringify(db||{})); }
function getDay(iso){ const db=readStore(); return db[iso] || {foods:[],exercises:[],water:[]}; }
function saveDay(iso, day){ const db=readStore(); db[iso]=day; writeStore(db); }

const readNum=(k)=>{ const v=localStorage.getItem(k); return v?parseFloat(v):0; };
const writeNum=(k,v)=> localStorage.setItem(k, String(v??''));
const readWeight=()=> readNum(WT_KEY);
const writeWeight=(kg)=> writeNum(WT_KEY, kg);
const readWaterTarget = ()=> parseInt(localStorage.getItem(WATER_TARGET_KEY)||'0',10)||0;
const writeWaterTarget = (v)=> localStorage.setItem(WATER_TARGET_KEY, String(v||0));

/* ---------- 日期狀態（預設今天，可切換） ---------- */
let currentDate = (()=>{ 
  const el=$('logDate'); 
  const iso=new Date().toISOString().slice(0,10); 
  if(el) el.value=iso; 
  return iso; 
})();
function setCurrentDate(iso){
  currentDate = iso;
  if ($('logDate') && $('logDate').value !== iso) $('logDate').value = iso;
  render();
}
$('logDate')?.addEventListener('change', e=> e.target.value && setCurrentDate(e.target.value));
$('btnPrevDay')?.addEventListener('click', ()=>{
  const d=new Date(currentDate); d.setDate(d.getDate()-1); setCurrentDate(d.toISOString().slice(0,10));
});
$('btnNextDay')?.addEventListener('click', ()=>{
  const d=new Date(currentDate); d.setDate(d.getDate()+1); setCurrentDate(d.toISOString().slice(0,10));
});

/* ---------- 類別表 / 單位表 / 精準食物 ---------- */
/* 可被 CSV 覆蓋的預設 */
let TYPE_TABLE = {
  '全穀雜糧類':{kcal:70,protein:2,carb:15,fat:0},
  '豆魚蛋肉類（低脂）':{kcal:55,protein:7,carb:0,fat:2},
  '豆魚蛋肉類（中脂）':{kcal:75,protein:7,carb:0,fat:5},
  '豆魚蛋肉類（高脂）':{kcal:120,protein:7,carb:0,fat:10},
  '乳品類（低脂）':{kcal:120,protein:8,carb:12,fat:4},
  '乳品類（全脂）':{kcal:150,protein:8,carb:12,fat:8},
  '乳品類（脫脂）':{kcal:80,protein:8,carb:12,fat:0},
  '蔬菜類':{kcal:25,protein:1,carb:5,fat:0},
  '水果類':{kcal:60,protein:0.5,carb:15,fat:0},
  '油脂與堅果種子類':{kcal:45,protein:0,carb:0,fat:5},
  '甜點飲料（糖）':{kcal:100,protein:0,carb:25,fat:0},
  '手搖飲（奶茶基準）':{kcal:150,protein:2,carb:22,fat:5},
  '混合料理（便當小格）':{kcal:100,protein:4,carb:12,fat:3},
};
let UNIT_MAP = [
  {name:'白飯',alias:['米飯','飯','rice'],type:'全穀雜糧類',unit_qty:1,unit:'碗',servings:4,note:'1碗≈200g；50g=1份'},
  {name:'白飯 100g',alias:['飯100g'],type:'全穀雜糧類',unit_qty:100,unit:'g',servings:2},
  {name:'吐司',alias:['土司','白吐司','toast'],type:'全穀雜糧類',unit_qty:1,unit:'片',servings:1},
  {name:'法國麵包',alias:['法國麵'],type:'全穀雜糧類',unit_qty:30,unit:'g',servings:1},
  {name:'雞胸肉',alias:['雞肉'],type:'豆魚蛋肉類（低脂）',unit_qty:100,unit:'g',servings:3},
  {name:'雞蛋（M）',alias:['雞蛋','蛋'],type:'豆魚蛋肉類（中脂）',unit_qty:1,unit:'個',servings:1},
  {name:'無糖豆漿',alias:['豆漿(無糖)'],type:'乳品類（低脂）',unit_qty:300,unit:'ml',servings:1},
  {name:'青花菜（熟）',alias:['綠花椰'],type:'蔬菜類',unit_qty:0.5,unit:'碗',servings:1},
  {name:'香蕉（中）',alias:['banana'],type:'水果類',unit_qty:1,unit:'根',servings:1},
];
let FOOD_DB = [
  { name:'雞胸肉 100g', alias:['雞胸肉'], kcal:165, protein:31, carb:0, fat:3.6 },
  { name:'無糖豆漿 300ml', alias:['無糖豆漿'], kcal:90, protein:9, carb:9, fat:3 },
  { name:'白飯 100g', alias:['白飯','米飯'], kcal:150, protein:2.7, carb:34, fat:0.3 },
];

/* 支援從 LS 載回 CSV 覆蓋資料 */
const TYPE_TABLE_KEY='jusmile-type-table', UNIT_MAP_KEY='jusmile-unit-map', FOOD_DB_KEY='jusmile-food-db';
(function(){
  const t=localStorage.getItem(TYPE_TABLE_KEY); if(t){ try{TYPE_TABLE=JSON.parse(t);}catch{} }
  const u=localStorage.getItem(UNIT_MAP_KEY); if(u){ try{UNIT_MAP=JSON.parse(u);}catch{} }
  const f=localStorage.getItem(FOOD_DB_KEY); if(f){ try{FOOD_DB=JSON.parse(f);}catch{} }
})();
const TYPE_URL_KEY='jusmile-type-url', UNIT_URL_KEY='jusmile-unit-url', FOOD_URL_KEY='jusmile-food-url';
$('typeCsvUrl') && ( $('typeCsvUrl').value = localStorage.getItem(TYPE_URL_KEY)||'' );
$('unitCsvUrl') && ( $('unitCsvUrl').value = localStorage.getItem(UNIT_URL_KEY)||'' );
$('foodCsvUrl') && ( $('foodCsvUrl').value = localStorage.getItem(FOOD_URL_KEY)||'' );

function parseCSV(text){
  const L=text.trim().split(/\r?\n/); const header=L.shift().split(',').map(s=>s.trim());
  const idx=(k)=> header.findIndex(h=>h.toLowerCase()===k.toLowerCase());
  return {L,idx};
}
function parseTypeCSV(text){
  const {L,idx}=parseCSV(text); const tbl={};
  L.forEach(line=>{
    const t=line.split(',').map(s=>s.trim()); if(!t.length) return;
    const type=t[idx('type')];
    tbl[type]={kcal:+t[idx('kcal')]||0,protein:+t[idx('protein')]||0,carb:+t[idx('carb')]||0,fat:+t[idx('fat')]||0};
  }); return tbl;
}
function parseUnitCSV(text){
  const {L,idx}=parseCSV(text);
  return L.filter(Boolean).map(line=>{
    const t=line.split(',').map(s=>s.trim());
    return {name:t[idx('name')], alias:(idx('alias')>-1 && t[idx('alias')])?t[idx('alias')].split('|').map(s=>s.trim()).filter(Boolean):[],
      type:t[idx('type')], unit_qty:+t[idx('unit_qty')]||1, unit:t[idx('unit')], servings:+t[idx('servings')]||0, note: idx('note')>-1? t[idx('note')]:''};
  });
}
function parseFoodCSV(text){
  const {L,idx}=parseCSV(text);
  return L.filter(Boolean).map(line=>{
    const t=line.split(',').map(s=>s.trim());
    return {name:t[idx('name')], alias:(idx('alias')>-1 && t[idx('alias')])?t[idx('alias')].split('|').map(s=>s.trim()).filter(Boolean):[],
      kcal:+t[idx('kcal')]||0, protein:+t[idx('protein')]||0, carb:+t[idx('carb')]||0, fat:+t[idx('fat')]||0};
  });
}
async function fetchNoCache(url){ const r=await fetch(url,{cache:'no-store'}); return await r.text(); }
$('btnSyncTypeCsv')?.addEventListener('click', async ()=>{
  const url=$('typeCsvUrl').value.trim(); if(!url) return alert('請貼上 CSV 連結');
  try{ const txt=await fetchNoCache(url); const tbl=parseTypeCSV(txt);
    TYPE_TABLE=tbl; localStorage.setItem(TYPE_TABLE_KEY, JSON.stringify(tbl)); localStorage.setItem(TYPE_URL_KEY,url);
    alert('同步完成（類別表）'); }catch(e){ alert('同步失敗：'+e.message); }
});
$('btnSyncUnitCsv')?.addEventListener('click', async ()=>{
  const url=$('unitCsvUrl').value.trim(); if(!url) return alert('請貼上 CSV 連結');
  try{ const txt=await fetchNoCache(url); const rows=parseUnitCSV(txt);
    UNIT_MAP=rows; localStorage.setItem(UNIT_MAP_KEY, JSON.stringify(rows)); localStorage.setItem(UNIT_URL_KEY,url);
    alert('同步完成（單位換算）'); rebuildUnitOptionsFor($('foodName')?.value||''); }catch(e){ alert('同步失敗：'+e.message); }
});
$('btnSyncFoodCsv')?.addEventListener('click', async ()=>{
  const url=$('foodCsvUrl').value.trim(); if(!url) return alert('請貼上 CSV 連結');
  try{ const txt=await fetchNoCache(url); const rows=parseFoodCSV(txt);
    FOOD_DB=rows; localStorage.setItem(FOOD_DB_KEY, JSON.stringify(rows)); localStorage.setItem(FOOD_URL_KEY,url);
    alert('同步完成（精準食物庫）'); }catch(e){ alert('同步失敗：'+e.message); }
});

/* ---------- Typeahead（食物名稱） ---------- */
const normalize = (s)=> (s||'').toLowerCase().trim().replace(/\s+/g,'');
function allFoodNames(){
  const set=new Set();
  FOOD_DB.forEach(x=>{ set.add(x.name); (x.alias||[]).forEach(a=>set.add(a)); });
  UNIT_MAP.forEach(x=>{ set.add(x.name); (x.alias||[]).forEach(a=>set.add(a)); });
  return Array.from(set);
}
function rankNames(q){
  const key=normalize(q); if(!key) return [];
  const names=allFoodNames();
  return names.map(n=>{
    const m=normalize(n); let s=0;
    if (m.startsWith(key)) s+=40; else if (m.includes(key)) s+=20;
    s += Math.max(0, 12 - n.length/4);
    return {n,s};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.n.length-b.n.length).slice(0,12).map(x=>x.n);
}
function renderTypeahead(q){
  const panel=$('foodSuggest'); const inp=$('foodName');
  panel.innerHTML=''; panel.hidden=true; if(!q) return;
  const list=rankNames(q); if(!list.length){ panel.hidden=false; panel.innerHTML='<div class="typeahead-item">找不到相符項目</div>'; return; }
  list.forEach(name=>{
    const div=document.createElement('div'); div.className='typeahead-item';
    div.innerHTML=`<div>${name}</div><div class="tag">候選</div>`;
    div.addEventListener('mousedown',e=>{ e.preventDefault(); inp.value=name; panel.hidden=true; rebuildUnitOptionsFor(name); tryAutofill(); });
    panel.appendChild(div);
  }); panel.hidden=false;
}
$('foodName')?.addEventListener('input', (e)=>{ renderTypeahead(e.target.value); rebuildUnitOptionsFor(e.target.value); });

/* ---------- 單位選項＆自動換算 ---------- */
const ALLOWED_UNITS=['g','ml','個','碗','片','湯匙','張','粒','杯'];
function rebuildUnitOptionsFor(name){
  const sel=$('foodUnit'); const hint=$('unitHint');
  if(!sel) return; sel.innerHTML='<option value="">選擇單位</option>'; hint && (hint.textContent='輸入名稱若匹配資料庫，會自動帶出可用單位並換算份量');
  const key=normalize(name);
  if(!key){
    // 預設通用單位
    ALLOWED_UNITS.forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o); });
    return;
  }
  // 從 UNIT_MAP 命中
  let rows = UNIT_MAP.map((r,i)=>({...r,_i:i})).filter(r=>{
    const hit = normalize(r.name).includes(key) || (r.alias||[]).some(a=> normalize(a).includes(key));
    return hit && ALLOWED_UNITS.includes(r.unit);
  });
  if(!rows.length){
    ALLOWED_UNITS.forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o); });
    hint && (hint.textContent='未找到對應資料：請自行選單位，並在「計算份量 / 類別」輸入估算值後按「重新計算」');
    return;
  }
  const seen=new Set();
  rows.forEach(r=>{
    if(seen.has(r.unit)) return; seen.add(r.unit);
    const o=document.createElement('option'); o.value=String(r._i); o.textContent=`${r.unit}（每 ${r.unit_qty}${r.unit} ≈ ${r.servings} 份｜${r.type}）`; sel.appendChild(o);
  });
}
function lookupFoodPrecise(name){
  const key=normalize(name);
  return FOOD_DB.find(f=> normalize(f.name)===key || (f.alias||[]).some(a=>normalize(a)===key)) || null;
}
function calcByType(type, s){
  const base=TYPE_TABLE[type]; const n=parseFloat(s)||0; if(!base||!n) return null;
  return {kcal:Math.round(base.kcal*n), protein:+(base.protein*n).toFixed(1), carb:+(base.carb*n).toFixed(1), fat:+(base.fat*n).toFixed(1)};
}
function tryAutofill(){
  const name=$('foodName').value.trim();
  const qty = parseFloat($('foodQty').value)||1;
  const unitSel=$('foodUnit').value;

  // A) 單位換算
  const idx=parseInt(unitSel,10);
  if (!isNaN(idx) && UNIT_MAP[idx]){
    const r=UNIT_MAP[idx]; const servings=(qty/(r.unit_qty||1))*(r.servings||0);
    const est=calcByType(r.type, servings);
    if(est){
      $('foodType').value=r.type; $('foodServings').value=servings.toFixed(2);
      $('foodKcal').value=est.kcal; $('foodProtein').value=est.protein; $('foodCarb').value=est.carb; $('foodFat').value=est.fat;
      return;
    }
  }
  // B) 精準
  const hit=lookupFoodPrecise(name);
  if(hit){
    $('foodKcal').value = Math.round((hit.kcal||0)*qty);
    $('foodProtein').value = +((hit.protein||0)*qty).toFixed(1);
    $('foodCarb').value = +((hit.carb||0)*qty).toFixed(1);
    $('foodFat').value = +((hit.fat||0)*qty).toFixed(1);
    return;
  }
  // C) Type×份量
  const type=$('foodType').value; const s=$('foodServings').value; const est2=calcByType(type, s);
  if(est2){
    $('foodKcal').value=est2.kcal; $('foodProtein').value=est2.protein; $('foodCarb').value=est2.carb; $('foodFat').value=est2.fat;
  }
}
['foodQty','foodUnit','foodType','foodServings'].forEach(id=>{
  const el=$(id); if(!el) return; const ev=(id==='foodUnit'||id==='foodType')?'change':'input'; el.addEventListener(ev, tryAutofill);
});
$('btnAutoFill')?.addEventListener('click', tryAutofill);

/* ---------- 食物紀錄：新增/刪除/清空 ---------- */
function addFood(){
  const meal=$('foodMeal')?.value||'未選';
  const name=$('foodName').value.trim()||'(未命名)';
  const qty = parseFloat($('foodQty').value)||1;
  const unitSel=$('foodUnit').value;
  let unitSymbol=''; 
  if (unitSel && !isNaN(parseInt(unitSel,10)) && UNIT_MAP[parseInt(unitSel,10)]) unitSymbol = UNIT_MAP[parseInt(unitSel,10)].unit;
  else unitSymbol = unitSel;

  const kcal=+($('foodKcal').value||0), p=+($('foodProtein').value||0), c=+($('foodCarb').value||0), f=+($('foodFat').value||0);
  const type=$('foodType').value||null; const servings=parseFloat($('foodServings').value)||null;

  const day=getDay(currentDate);
  day.foods.push({meal,name,qty,unit:unitSymbol,kcal,protein:p,carb:c,fat:f,type,servings,t:Date.now()});
  saveDay(currentDate, day); render();

  $('foodName').value=''; ['foodKcal','foodProtein','foodCarb','foodFat','foodServings'].forEach(i=> $(i).value='');
  $('foodUnit').value=''; $('foodQty').value='1'; $('foodMeal') && ($('foodMeal').value='早餐'); rebuildUnitOptionsFor('');
}
$('btnAddFood')?.addEventListener('click', addFood);
$('btnClearFoods')?.addEventListener('click', ()=>{
  const day=getDay(currentDate); if(!day.foods.length) return;
  if(!confirm('確定清空今天飲食？')) return; day.foods=[]; saveDay(currentDate,day); render();
});
window.delFood=(i)=>{ const day=getDay(currentDate); day.foods.splice(i,1); saveDay(currentDate,day); render(); };

function renderFoods(day){
  const tb=$('foodTable'); if(!tb) return; tb.innerHTML='';
  (day.foods||[]).forEach((x,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input type="checkbox" class="rowChk" data-idx="${i}"></td>
      <td>${x.meal||''}</td><td>${x.name||''}</td>
      <td>${x.qty??''}</td><td>${x.unit||''}</td>
      <td>${x.kcal||0}</td><td>${x.protein||0}</td><td>${x.carb||0}</td><td>${x.fat||0}</td>
      <td><button class="btn-danger" onclick="delFood(${i})">刪</button></td>`;
    tb.appendChild(tr);
  });
  // 勾選集合
  SELECTED_INDEXES.clear();
  tb.querySelectorAll('.rowChk').forEach(chk=>{
    chk.addEventListener('change', (e)=>{
      const idx=parseInt(e.target.dataset.idx,10);
      if(e.target.checked) SELECTED_INDEXES.add(idx); else SELECTED_INDEXES.delete(idx);
    });
  });
  const all=$('chkAllFoods'); if(all){ all.checked=false; all.onchange=()=>{ 
    tb.querySelectorAll('.rowChk').forEach(chk=>{ chk.checked=all.checked; const idx=parseInt(chk.dataset.idx,10); if(all.checked) SELECTED_INDEXES.add(idx); else SELECTED_INDEXES.delete(idx); });
  } }
}

/* ---------- 運動紀錄 ---------- */
let EX_DB=[
  {name:'健走（輕鬆）',met:2.8,note:'~4 km/h'},
  {name:'快走',met:3.5,note:'~5–6 km/h'},
  {name:'慢跑',met:7.0,note:'~8 km/h'},
  {name:'重訓（一般）',met:6.0,note:'全身循環'},
  {name:'瑜伽（哈達）',met:2.5,note:''},
  {name:'游泳（自由式中速）',met:8.3,note:''},
];
function rebuildExList(){ const dl=$('exList'); if(!dl) return; dl.innerHTML=''; EX_DB.forEach(x=>{ const o=document.createElement('option'); o.value=x.name; dl.appendChild(o); }); }
rebuildExList();
$('exName')?.addEventListener('change', ()=>{
  const nm=$('exName').value.trim(); const hit=EX_DB.find(x=>x.name===nm); if(hit) $('exMET').value=hit.met;
});
function calcExKcal(met,kg,mins){ const M=+met||0,W=+kg||0,T=+mins||0; if(!M||!W||!T) return 0; return Math.round(M*3.5*W/200*T); }
$('btnAddEx')?.addEventListener('click', ()=>{
  const nm=$('exName').value.trim(), met=parseFloat($('exMET').value)||0, mins=parseFloat($('exMins').value)||0;
  let kg=parseFloat($('userWeight').value); if(!kg) kg=readWeight()||0;
  if(!nm||met<=0||mins<=0||kg<=0) return alert('請輸入名稱、MET、分鐘、體重');
  const kcal=calcExKcal(met,kg,mins);
  const day=getDay(currentDate); if(!day.exercises) day.exercises=[]; day.exercises.push({name:nm,met,mins,kg,kcal,t:Date.now()});
  saveDay(currentDate,day);
  ['exName','exMET','exMins'].forEach(id=> $(id).value = id==='exMins'?'30':''); render();
});
$('btnClearExToday')?.addEventListener('click', ()=>{
  const day=getDay(currentDate); if(!day.exercises?.length) return;
  if(!confirm('確定清空今天運動？')) return; day.exercises=[]; saveDay(currentDate,day); render();
});
window.delEx=(i)=>{ const day=getDay(currentDate); day.exercises.splice(i,1); saveDay(currentDate,day); render(); };
function renderExercises(day){
  const tb=$('exTable'); if(!tb) return; tb.innerHTML='';
  (day.exercises||[]).forEach((e,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${e.name}</td><td>${e.met}</td><td>${e.mins}</td><td>${e.kcal}</td><td><button class="btn-danger" onclick="delEx(${i})">刪</button></td>`;
    tb.appendChild(tr);
  });
}

/* ---------- 常用食物組合：建立/搜尋/編輯 ---------- */
const PRESET_KEY='jusmile-presets';
function readPresets(){ try{return JSON.parse(localStorage.getItem(PRESET_KEY)||'[]');}catch{return []} }
function writePresets(a){ localStorage.setItem(PRESET_KEY, JSON.stringify(a||[])); }
let SELECTED_INDEXES = new Set();
function selectedFoodItems(){
  const day=getDay(currentDate); const out=[];
  (day.foods||[]).forEach((it,idx)=>{ if(SELECTED_INDEXES.has(idx)) out.push({...it}); });
  return out;
}
$('btnSavePresetFromSelected')?.addEventListener('click', ()=>{
  const name=($('presetFromSelectedName')?.value||'').trim(); if(!name) return alert('請輸入組合名稱');
  const items=selectedFoodItems(); if(!items.length) return alert('請先在明細勾選要保存的品項');
  const arr=readPresets(); const i=arr.findIndex(p=>p.name===name);
  if(i>-1) arr[i]={name,items,updated:Date.now()}; else arr.push({name,items,updated:Date.now()});
  writePresets(arr); $('presetFromSelectedName').value=''; SELECTED_INDEXES.clear(); alert('已保存為常用組合');
});

/* 搜尋建議 */
function rankPresetCandidates(q,arr){
  const key=normalize(q); if(!key) return [];
  return arr.map((p,i)=>{
    const text=(p.name+' '+(p.items||[]).map(x=>x.name).join(' ')).toLowerCase().replace(/\s+/g,'');
    let s=0; if (p.name.toLowerCase().replace(/\s+/g,'').startsWith(key)) s+=40;
    if (text.includes(key)) s+=20; s+=Math.min(10,(p.items||[]).length);
    return {i,p,s};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,10);
}
function renderPresetSuggest(q){
  const panel=$('presetSuggest'); if(!panel) return; panel.innerHTML=''; const arr=readPresets();
  const list=rankPresetCandidates(q,arr); if(!q||!list.length){ panel.hidden=true; return; }
  list.forEach(({i,p})=>{
    const preview=(p.items||[]).map(x=>x.name).slice(0,3).join('＋')+((p.items||[]).length>3?'…':'');
    const div=document.createElement('div'); div.className='typeahead-item';
    div.innerHTML=`<div>${p.name}</div><div class="tag">${preview}</div>`;
    div.addEventListener('mousedown',e=>{ e.preventDefault(); $('presetSearch').value=p.name; panel.hidden=true; });
    panel.appendChild(div);
  }); panel.hidden=false;
}
$('presetSearch')?.addEventListener('input', e=> renderPresetSuggest(e.target.value));
document.addEventListener('click', (e)=>{
  const box=$('presetSearch')?.closest('.typeahead'); const p=$('presetSuggest'); if(!box||!p) return;
  if(!box.contains(e.target)) p.hidden=true;
});
window.applyPreset=(i)=>{
  const arr=readPresets(); const p=arr[i]; if(!p) return;
  const day=getDay(currentDate); p.items.forEach(x=> day.foods.push({...x,t:Date.now()})); saveDay(currentDate,day); render(); alert(`已加入「${p.name}」到今天`);
};
$('btnQuickAddPreset')?.addEventListener('click', ()=>{
  const name=($('presetSearch')?.value||'').trim(); const arr=readPresets(); const idx=arr.findIndex(p=>p.name===name);
  if(idx<0) return alert('請在上方輸入並選取一個常用組合'); applyPreset(idx);
});
window.editPreset=(i)=>{
  const arr=readPresets(); const p=arr[i]; if(!p) return; $('peTitle').textContent=`編輯組合：${p.name}`; window._peIndex=i; renderPresetEditorBody(); $('presetEditor').showModal();
};
$('btnEditSelectedPreset')?.addEventListener('click', ()=>{
  const name=($('presetSearch')?.value||'').trim(); const arr=readPresets(); const idx=arr.findIndex(p=>p.name===name);
  if(idx<0) return alert('請輸入並選取要編輯的常用組合名稱'); editPreset(idx);
});
window._peIndex=-1;
function renderPresetEditorBody(){
  const arr=readPresets(); const p=arr[window._peIndex]; const tb=$('peBody'); if(!tb||!p) return; tb.innerHTML='';
  (p.items||[]).forEach((it,j)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${j+1}</td><td>${it.name||''}</td><td>${it.kcal||0}</td><td>${it.protein||0}</td><td>${it.carb||0}</td><td>${it.fat||0}</td>
      <td><button class="btn-danger" onclick="removePresetItem(${j})">移除</button></td>`;
    tb.appendChild(tr);
  });
}
window.removePresetItem=(j)=>{ const arr=readPresets(); const p=arr[window._peIndex]; p.items.splice(j,1); writePresets(arr); renderPresetEditorBody(); };
$('peClose')?.addEventListener('click', ()=> $('presetEditor').close());
$('peSave')?.addEventListener('click', ()=>{ $('presetEditor').close(); });
$('peDelete')?.addEventListener('click', ()=>{
  if(!confirm('確定刪除此組合？')) return; const arr=readPresets(); arr.splice(window._peIndex,1); writePresets(arr); $('presetEditor').close();
});

/* ---------- 喝水紀錄 ---------- */
function sumWater(day){ const arr=Array.isArray(day.water)?day.water:[]; return arr.reduce((s,v)=>s+(+v||0),0); }
function renderWater(){
  const target=readWaterTarget(); const day=getDay(currentDate); const total=sumWater(day);
  if ($('waterTarget') && !$('waterTarget').value) $('waterTarget').value = target || '';
  $('waterTotal') && ( $('waterTotal').textContent = total );
  const bar=$('waterBar'); if(bar){ const p=target? Math.min(100, Math.round(total/target*100)) : 0; bar.style.width=p+'%'; bar.textContent=`${total}/${target||0} ml`; }
}
$('waterTarget')?.addEventListener('change', e=>{ writeWaterTarget(parseInt(e.target.value||'0',10)||0); renderWater(); });
document.querySelectorAll('[data-add-water]')?.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const add=parseInt(btn.dataset.addWater,10)||0; const day=getDay(currentDate); if(!Array.isArray(day.water)) day.water=[];
    day.water.push(add); saveDay(currentDate,day); renderWater(); updateSummaryBadges();
  });
});
$('btnClearWater')?.addEventListener('click', ()=>{ const day=getDay(currentDate); day.water=[]; saveDay(currentDate,day); renderWater(); updateSummaryBadges(); });

/* ---------- 報表 ---------- */
function buildReport(range){
  const db=readStore(); const rows=[];
  const now=new Date(); let start;
  if(range==='month'){ start=new Date(now.getFullYear(), now.getMonth(), 1); }
  else { const d=parseInt(range,10)||7; start=new Date(now); start.setDate(start.getDate()-(d-1)); }
  const startISO=start.toISOString().slice(0,10), endISO=now.toISOString().slice(0,10);

  Object.keys(db).sort().forEach(d=>{
    if(d<startISO || d>endISO) return; const day=db[d]||{};
    const S=(day.foods||[]).reduce((acc,x)=>({kcal:acc.kcal+(+x.kcal||0),p:acc.p+(+x.protein||0),c:acc.c+(+x.carb||0),f:acc.f+(+x.fat||0)}),{kcal:0,p:0,c:0,f:0});
    const E=(day.exercises||[]).reduce((s,e)=>s+(+e.kcal||0),0);
    const net=Math.max(0, S.kcal - E);
    const water=sumWater(day);
    rows.push({d,S,E,net,water});
  });
  const tb=$('reportBody'); if(!tb) return; tb.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${r.d}</td><td>${r.S.kcal}</td><td>${r.E}</td><td>${r.net}</td>
      <td>${r.S.p.toFixed(1)}</td><td>${r.S.c.toFixed(1)}</td><td>${r.S.f.toFixed(1)}</td><td>${r.water}</td>`;
    tb.appendChild(tr);
  });
}
$('btnBuildReport')?.addEventListener('click', ()=> buildReport( $('reportRange')?.value || '7' ));

/* ---------- 目標/體重 儲存 ---------- */
$('btnSaveTargets')?.addEventListener('click', ()=>{
  const cal=parseFloat($('setCal')?.value)||0, pro=parseFloat($('setProtein')?.value)||0, wt=parseFloat($('setWeight')?.value)||0;
  if(cal>0) writeNum(CAL_KEY,cal); if(pro>0) writeNum(PRO_KEY,pro); if(wt>0) writeWeight(wt);
  if ($('userWeight') && wt>0) $('userWeight').value = wt;
  alert('已保存');
});

/* ---------- 概況徽章＋未達標提醒 ---------- */
function sumFoods(day){ let kcal=0,p=0,c=0,f=0; (day.foods||[]).forEach(x=>{kcal+=+x.kcal||0; p+=+x.protein||0; c+=+x.carb||0; f+=+x.fat||0;}); return {kcal,p,c,f}; }
function sumExercises(day){ let kcal=0; (day.exercises||[]).forEach(e=>kcal+=+e.kcal||0); return {kcal}; }
function updateSummaryBadges(){
  const day=getDay(currentDate); const S=sumFoods(day); const E=sumExercises(day); const net=Math.max(0, S.kcal - E.kcal);
  const set=(id,v)=>{ const el=$(id); if(el) el.textContent=String(v); };
  set('sumKcalBadge',S.kcal); set('sumPBadge',S.p.toFixed(1)); set('sumCBadge',S.c.toFixed(1)); set('sumFBadge',S.f.toFixed(1));
  set('exKcalBadge',E.kcal); set('netKcalBadge',net);

  const proteinTarget=readNum(PRO_KEY)||0; const waterTarget=readWaterTarget()||0; const waterTotal=sumWater(day);
  let notes=[];
  if(proteinTarget>0 && S.p<proteinTarget) notes.push(`蛋白質未達標，尚差 <b>${(proteinTarget-S.p).toFixed(1)} g</b>`);
  if(waterTarget>0 && waterTotal<waterTarget) notes.push(`喝水未達標，尚差 <b>${waterTarget-waterTotal} ml</b>`);
  const box=$('badgeAlerts'); if(box){ if(notes.length){ box.classList.remove('ok'); box.innerHTML=notes.join('　｜　'); } else { box.classList.add('ok'); box.textContent='今天的蛋白質與喝水皆已達成目標，太棒了！'; } }
}

/* ---------- 渲染 ---------- */
function updateCalBar(net,target){
  const bar=$('calBar'); if(!bar) return; const t=target||0; const p=t? Math.min(100, Math.round(net/t*100)) : 0;
  bar.style.width=p+'%'; bar.textContent = t? `${net}/${t} kcal` : `${net} kcal`;
}
function render(){
  const day=getDay(currentDate);
  renderFoods(day); renderExercises(day);

  const S=sumFoods(day), E=sumExercises(day); const net=Math.max(0, S.kcal - E.kcal);
  $('sumKcal') && ( $('sumKcal').textContent = S.kcal );
  $('exKcal') && ( $('exKcal').textContent = E.kcal );
  $('netKcal') && ( $('netKcal').textContent = net );
  updateCalBar(net, readNum(CAL_KEY)||0);

  renderWater();
  updateSummaryBadges();
}

/* ---------- 初始化 ---------- */
$('foodName')?.addEventListener('change', tryAutofill);
$('foodQty')?.addEventListener('input', tryAutofill);
render(); // 首次渲染
