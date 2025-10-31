/* ===== Ju Smile 温脂日誌 v1.3 ===== */
const APP_VERSION = 'v1.3';
const $id = (x)=>document.getElementById(x);
const today = ()=> new Date().toISOString().slice(0,10);
if ($id('appVer')) $id('appVer').textContent = APP_VERSION;

/* ---------- 本機儲存 ---------- */
const STORE_KEY = 'jusmile-days';
function readStore(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); }catch(e){ return {}; } }
function writeStore(obj){ localStorage.setItem(STORE_KEY, JSON.stringify(obj||{})); }
function getDay(d){ const db=readStore(); return db[d] || {foods:[], exercises:[]}; }
function saveDay(d, day){ const db=readStore(); db[d]=day; writeStore(db); }

/* ---------- 目標/體重 ---------- */
const CAL_KEY='jusmile-cal-target', PRO_KEY='jusmile-pro-target', WT_KEY='jusmile-user-weight';
const readNum=(k)=>{ const v=localStorage.getItem(k); return v?parseFloat(v):null; };
const writeNum=(k,v)=>localStorage.setItem(k, String(v||''));
function readWeight(){ const v=localStorage.getItem(WT_KEY); return v?parseFloat(v):null; }
function writeWeight(kg){ localStorage.setItem(WT_KEY, String(kg||'')); }

/* ---------- 工具：正規化（搜尋/比對用） ---------- */
function normalize(inp){
  if (!inp) return '';
  const z2h = inp.replace(/[\uFF01-\uFF5E]/g, ch=> String.fromCharCode(ch.charCodeAt(0)-0xFEE0))
                 .replace(/\u3000/g, ' ');
  return z2h.trim().toLowerCase().replace(/\s+/g,'');
}

/* ---------- TYPE_TABLE（可被 CSV 覆蓋） ---------- */
let TYPE_TABLE = {
  '全穀雜糧類':            { kcal:70,  protein:2,   carb:15,  fat:0 },
  '豆魚蛋肉類（低脂）':    { kcal:55,  protein:7,   carb:0,   fat:2 },
  '豆魚蛋肉類（中脂）':    { kcal:75,  protein:7,   carb:0,   fat:5 },
  '豆魚蛋肉類（高脂）':    { kcal:120, protein:7,   carb:0,   fat:10 },
  '乳品類（全脂）':        { kcal:150, protein:8,   carb:12,  fat:8 },
  '乳品類（低脂）':        { kcal:120, protein:8,   carb:12,  fat:4 },
  '乳品類（脫脂）':        { kcal:80,  protein:8,   carb:12,  fat:0 },
  '蔬菜類':                { kcal:25,  protein:1,   carb:5,   fat:0 },
  '水果類':                { kcal:60,  protein:0.5, carb:15,  fat:0 },
  '油脂與堅果種子類':      { kcal:45,  protein:0,   carb:0,   fat:5 },
  // 延伸
  '甜點飲料（糖）':        { kcal:100, protein:0,   carb:25,  fat:0 },
  '手搖飲（奶茶基準）':    { kcal:150, protein:2,   carb:22,  fat:5 },
  '混合料理（便當小格）':  { kcal:100, protein:4,   carb:12,  fat:3 },
};
const TYPE_TABLE_KEY='jusmile-type-table', TYPE_URL_KEY='jusmile-type-url';
(function initTypeFromCache(){ const x=localStorage.getItem(TYPE_TABLE_KEY); if(x){ try{ TYPE_TABLE=JSON.parse(x);}catch{} } })();

/* ---------- UNIT_MAP（可被 CSV 覆蓋；支援 alias） ---------- */
let UNIT_MAP = [
  { name:'白飯', alias:['米飯','飯','rice'], type:'全穀雜糧類', unit_qty:1, unit:'碗', servings:4, note:'1碗≈200g; 50g=1份' },
  { name:'糙米飯', alias:['糙米','brown rice'], type:'全穀雜糧類', unit_qty:1, unit:'碗', servings:4 },
  { name:'吐司', alias:['土司','白吐司','toast'], type:'全穀雜糧類', unit_qty:1, unit:'片', servings:1 },
  { name:'地瓜', alias:['番薯','甘薯','sweet potato'], type:'全穀雜糧類', unit_qty:100, unit:'g', servings:1.5 },
  { name:'燙青菜(熟)', alias:['青菜','燙青菜','蔬菜'], type:'蔬菜類', unit_qty:0.5, unit:'碗', servings:1 },
  { name:'香蕉', alias:['banana'], type:'水果類', unit_qty:1, unit:'根', servings:1 },
  { name:'雞胸肉', alias:['雞肉','雞柳','chicken breast'], type:'豆魚蛋肉類（低脂）', unit_qty:100, unit:'g', servings:3 },
  { name:'雞蛋', alias:['蛋','hen egg','egg'], type:'豆魚蛋肉類（中脂）', unit_qty:1, unit:'顆', servings:1 },
  { name:'板豆腐', alias:['豆腐','嫩豆腐','tofu'], type:'豆魚蛋肉類（低脂）', unit_qty:1, unit:'塊', servings:1.5 },
  { name:'牛奶', alias:['鮮奶','milk'], type:'乳品類（全脂）', unit_qty:240, unit:'ml', servings:1 },
  { name:'無糖豆漿', alias:['豆漿(無糖)','soy milk unsweetened'], type:'乳品類（低脂）', unit_qty:300, unit:'ml', servings:1 },
  { name:'花生', alias:['花生米','peanut'], type:'油脂與堅果種子類', unit_qty:1, unit:'湯匙', servings:1 },
  { name:'橄欖油', alias:['油','olive oil'], type:'油脂與堅果種子類', unit_qty:1, unit:'茶匙', servings:1 },
  { name:'珍珠奶茶(微糖)', alias:['珍奶','奶茶','bubble milk tea'], type:'手搖飲（奶茶基準）', unit_qty:500, unit:'ml', servings:1.5 },
  { name:'滷肉飯(小碗)', alias:['魯肉飯','焢肉飯','肉燥飯'], type:'混合料理（便當小格）', unit_qty:1, unit:'碗', servings:4 },
];
const UNIT_MAP_KEY='jusmile-unit-map', UNIT_URL_KEY='jusmile-unit-url';
(function initUnitFromCache(){ const x=localStorage.getItem(UNIT_MAP_KEY); if(x){ try{ UNIT_MAP=JSON.parse(x);}catch{} } })();

/* ---------- FOOD_DB（精準品項；支援 alias；可被 CSV 覆蓋） ---------- */
let FOOD_DB = [
  { name:'雞胸肉 100g', alias:['雞胸肉','chicken breast 100g'], kcal:165, protein:31, carb:0, fat:3.6 },
  { name:'無糖豆漿 300ml', alias:['無糖豆漿','soy milk 300ml'], kcal:90, protein:9, carb:9, fat:3 },
  { name:'白飯 100g', alias:['白飯','米飯 100g','rice 100g'], kcal:150, protein:2.7, carb:34, fat:0.3 },
  { name:'香蕉 100g', alias:['香蕉','banana 100g'], kcal:90, protein:1.1, carb:23, fat:0.3 }
];
const FOOD_DB_KEY='jusmile-food-db', FOOD_URL_KEY='jusmile-food-url';
(function initFoodFromCache(){ const x=localStorage.getItem(FOOD_DB_KEY); if(x){ try{ FOOD_DB=JSON.parse(x);}catch{} } })();

/* ---------- CSV 解析 ---------- */
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  const header=lines.shift().split(',').map(s=>s.trim());
  const idx=(k)=> header.findIndex(h=>h.toLowerCase()===k.toLowerCase());
  return { lines, header, idx };
}
function parseTypeCSV(text){
  const {lines,idx}=parseCSV(text);
  const tbl={};
  lines.forEach(line=>{
    if(!line.trim()) return;
    const t=line.split(',').map(s=>s.trim());
    const type=t[idx('type')];
    tbl[type] = {
      kcal:parseFloat(t[idx('kcal')])||0,
      protein:parseFloat(t[idx('protein')])||0,
      carb:parseFloat(t[idx('carb')])||0,
      fat:parseFloat(t[idx('fat')])||0
    };
  });
  return tbl;
}
function parseUnitCSV(text){
  const {lines,idx}=parseCSV(text);
  return lines.filter(Boolean).map(line=>{
    const t=line.split(',').map(s=>s.trim());
    return {
      name:t[idx('name')],
      alias: (idx('alias')>-1 && t[idx('alias')]) ? t[idx('alias')].split('|').map(s=>s.trim()).filter(Boolean) : [],
      type:t[idx('type')],
      unit_qty:parseFloat(t[idx('unit_qty')])||1,
      unit:t[idx('unit')],
      servings:parseFloat(t[idx('servings')])||0,
      note: idx('note')>-1 ? t[idx('note')] : ''
    };
  });
}
function parseFoodCSV(text){
  const {lines,idx}=parseCSV(text);
  return lines.filter(Boolean).map(line=>{
    const t=line.split(',').map(s=>s.trim());
    return {
      name:t[idx('name')],
      alias: (idx('alias')>-1 && t[idx('alias')]) ? t[idx('alias')].split('|').map(s=>s.trim()).filter(Boolean) : [],
      kcal:parseFloat(t[idx('kcal')])||0,
      protein:parseFloat(t[idx('protein')])||0,
      carb:parseFloat(t[idx('carb')])||0,
      fat:parseFloat(t[idx('fat')])||0
    };
  });
}
async function fetchText(url){ const r=await fetch(url,{cache:'no-store'}); return await r.text(); }

/* ---------- 清單（datalist 改為 typeahead） ---------- */
function rebuildFoodList(){ /* 仍保留，現在候選由下方 typeahead 使用 */
  /* no-op render; 由 getAllFoodCandidates() 動態取得 */
}

/* ======= 搜尋自動完成（Typeahead） ======= */
let taActiveIndex = -1;
function getAllFoodCandidates() {
  const names = new Set();
  FOOD_DB.forEach(x=>{ names.add(x.name); (x.alias||[]).forEach(a=>names.add(a)); });
  UNIT_MAP.forEach(x=>{ names.add(x.name); (x.alias||[]).forEach(a=>names.add(a)); });
  return Array.from(names);
}
function rankCandidates(query, list) {
  const q = normalize(query);
  if (!q) return [];
  const isFood = (n)=> FOOD_DB.some(x=> normalize(x.name)===normalize(n) || (x.alias||[]).some(a=> normalize(a)===normalize(n)));
  const typeOf = (n)=> {
    const hit = UNIT_MAP.find(x=> normalize(x.name)===normalize(n) || (x.alias||[]).some(a=> normalize(a)===normalize(n)));
    return hit ? hit.type : '';
  };
  const score = (name) => {
    const n = normalize(name);
    let s = 0;
    if (n.startsWith(q)) s += 40;
    else if (n.includes(q)) s += 20;
    // 子序列模糊
    let i=0; for (const ch of q){ const p=n.indexOf(ch,i); if(p===-1){ i=-1; break; } i=p+1; }
    if (i !== -1) s += 8;
    if (isFood(name)) s += 6;
    const type = typeOf(name); if (type) s += 4;
    s += Math.max(0, 12 - name.length/4);
    return s;
  };
  return list.map(n=>({name:n,s:score(n)}))
             .filter(x=>x.s>0)
             .sort((a,b)=> b.s-a.s || a.name.length-b.name.length)
             .slice(0,12).map(x=>x.name);
}
function highlightOnce(text, query){
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
  const m = text.match(re); if(!m) return text;
  return text.replace(re, `<span class="typeahead-mark">${m[0]}</span>`);
}
function renderTypeahead(query){
  const panel = $id('foodSuggest'); if(!panel) return;
  const input = $id('foodName');
  const list = rankCandidates(query, getAllFoodCandidates());

  panel.innerHTML = '';
  taActiveIndex = -1;

  if (!query || !list.length){
    panel.hidden = !query;
    if (query && !list.length){
      panel.innerHTML = '<div class="typeahead-empty">找不到相符項目</div>';
      panel.hidden = false;
    }
    return;
  }

  list.forEach((name, idx)=>{
    const fromFood = FOOD_DB.some(x=> normalize(x.name)===normalize(name) || (x.alias||[]).some(a=> normalize(a)===normalize(name)));
    const fromUnit = UNIT_MAP.find(x=> normalize(x.name)===normalize(name) || (x.alias||[]).some(a=> normalize(a)===normalize(name)));
    const tag = fromFood ? '精準' : (fromUnit ? `換算·${fromUnit.type}` : '候選');

    const div = document.createElement('div');
    div.className = 'typeahead-item';
    div.dataset.index = idx;
    div.innerHTML = `<div>${highlightOnce(name, query)}</div><div class="tag">${tag}</div>`;
    div.addEventListener('mousedown', (e)=>{ e.preventDefault(); selectTypeahead(idx); });
    panel.appendChild(div);
  });
  panel.hidden = false;

  function selectTypeahead(i){
    const chosen = list[i]; if(!chosen) return;
    input.value = chosen;
    panel.hidden = true;
    rebuildUnitOptionsFor(chosen);
    tryAutofill();
    input.focus();
  }
  function setActive(i){
    const items = [...panel.querySelectorAll('.typeahead-item')];
    items.forEach(el => el.classList.remove('active'));
    if (i>=0 && i<items.length){ items[i].classList.add('active'); }
    taActiveIndex = i;
  }
  input.onkeydown = (ev)=>{
    const items = panel.querySelectorAll('.typeahead-item');
    if (panel.hidden || !items.length) return;
    if (ev.key === 'ArrowDown'){ ev.preventDefault(); setActive(Math.min(items.length-1, taActiveIndex+1)); }
    else if (ev.key === 'ArrowUp'){ ev.preventDefault(); setActive(Math.max(0, taActiveIndex-1)); }
    else if (ev.key === 'Enter'){ if (taActiveIndex>=0){ ev.preventDefault(); selectTypeahead(taActiveIndex); } }
    else if (ev.key === 'Escape'){ panel.hidden = true; }
  };
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
$id('foodName')?.addEventListener('input', debounce(()=>{
  const q = $id('foodName').value;
  renderTypeahead(q);
  rebuildUnitOptionsFor(q);
}, 120));
// 點外面就關閉建議
document.addEventListener('click', (e)=>{
  const p=$id('foodSuggest'), box=$id('foodName')?.closest('.typeahead');
  if (!p || !box) return;
  if (!box.contains(e.target)) p.hidden = true;
});

/* ---------- 單位選項生成（支援 alias） ---------- */
function rebuildUnitOptionsFor(name){
  const sel = $id('foodUnit'); const hint = $id('unitHint');
  if(!sel) return;
  sel.innerHTML = '<option value="">（請先選食物，再選單位）</option>';
  if(hint) hint.textContent = '';
  if(!name) return;

  const key = normalize(name);
  const rows = UNIT_MAP
    .map((r,i)=>({...r,_i:i}))
    .filter(r=>{
      const hitByName  = normalize(r.name) === key || normalize(r.name).includes(key);
      const hitByAlias = Array.isArray(r.alias) && r.alias.some(a=> normalize(a).includes(key) || normalize(a)===key);
      return hitByName || hitByAlias;
    });

  if(!rows.length) return;

  rows.forEach(r=>{
    const opt=document.createElement('option');
    opt.value=String(r._i);
    const aliasTxt = r.alias && r.alias.length ? `（別名：${r.alias.slice(0,3).join('、')}…）` : '';
    opt.textContent=`每 ${r.unit_qty}${r.unit} = ${r.servings} 份（${r.type}）${aliasTxt}`;
    sel.appendChild(opt);
  });
  if(hint) hint.textContent='選了單位後，會用「數量×單位換算」計算';
}

/* ---------- 查找 & 計算 ---------- */
function lookupFoodPrecise(name){
  const n = normalize(name);
  return FOOD_DB.find(f=>{
    if (normalize(f.name) === n) return true;
    if (Array.isArray(f.alias)) return f.alias.some(a=> normalize(a) === n);
    return false;
  }) || null;
}
function calcByTypeServings(typeName, servings){
  const base=TYPE_TABLE[typeName]; const s=parseFloat(servings)||0;
  if(!base || !s) return null;
  return {
    kcal:Math.round(base.kcal*s),
    protein:+(base.protein*s).toFixed(1),
    carb:+(base.carb*s).toFixed(1),
    fat:+(base.fat*s).toFixed(1),
  };
}

/* ---------- 自動帶入（單位換算優先 → 精準 → Type×份量） ---------- */
function tryAutofill(){
  const name = $id('foodName').value.trim();
  const qty  = parseFloat($id('foodQty').value)||1;

  // A) 單位換算（若使用者已選單位）
  const unitSel = $id('foodUnit');
  const selIdx = unitSel && unitSel.value ? parseInt(unitSel.value, 10) : NaN;
  if (!isNaN(selIdx) && UNIT_MAP[selIdx]){
    const row = UNIT_MAP[selIdx];
    const totalServings = (row.servings || 0) * qty;
    const est = calcByTypeServings(row.type, totalServings);
    if(est){
      $id('foodType').value      = row.type;
      $id('foodServings').value  = totalServings.toFixed(2);
      $id('foodKcal').value      = est.kcal;
      $id('foodProtein').value   = est.protein;
      $id('foodCarb').value      = est.carb;
      $id('foodFat').value       = est.fat;
      return;
    }
  }

  // B) 精準（完全相同或 alias 相同）
  const hit = lookupFoodPrecise(name);
  if(hit){
    $id('foodKcal').value    = Math.round((hit.kcal||0) * qty);
    $id('foodProtein').value = +((hit.protein||0) * qty).toFixed(1);
    $id('foodCarb').value    = +((hit.carb||0) * qty).toFixed(1);
    $id('foodFat').value     = +((hit.fat||0) * qty).toFixed(1);
    return;
  }

  // C) Type × 份量
  const type=$id('foodType').value; const s=$id('foodServings').value;
  const est2=calcByTypeServings(type, s);
  if(est2){
    $id('foodKcal').value=est2.kcal;
    $id('foodProtein').value=est2.protein;
    $id('foodCarb').value=est2.carb;
    $id('foodFat').value=est2.fat;
  }
}
['foodQty','foodUnit','foodType','foodServings'].forEach(id=>{
  const el=$id(id); if(!el) return;
  const ev = (id==='foodUnit'||id==='foodType') ? 'change' : 'input';
  el.addEventListener(ev, tryAutofill);
});
$id('btnAutoFill')?.addEventListener('click', tryAutofill);

/* ---------- 加入/刪除 食物 ---------- */
function addFood(){
  const meal=''; // 可擴充餐別
  const name=$id('foodName').value.trim()||'(未命名)';
  const kcal=+($id('foodKcal').value||0);
  const p=+($id('foodProtein').value||0);
  const c=+($id('foodCarb').value||0);
  const f=+($id('foodFat').value||0);
  const type=$id('foodType').value||null;
  const servings=parseFloat($id('foodServings').value)||null;

  const d=today(); const day=getDay(d);
  day.foods.push({meal,name,kcal,protein:p,carb:c,fat:f,type,servings,t:Date.now()});
  saveDay(d,day);
  render();

  // reset
  $id('foodName').value=''; $id('foodKcal').value=''; $id('foodProtein').value='';
  $id('foodCarb').value=''; $id('foodFat').value=''; $id('foodServings').value='';
  $id('foodUnit').value=''; $id('foodQty').value='1';
  rebuildUnitOptionsFor('');
}
$id('btnAddFood')?.addEventListener('click', addFood);
$id('btnClearFoods')?.addEventListener('click', ()=>{
  const d=today(); const day=getDay(d);
  if(!day.foods.length) return;
  if(!confirm('確定清空今天飲食？')) return;
  day.foods=[]; saveDay(d,day); render();
});
window.delFood = (i)=>{
  const d=today(); const day=getDay(d);
  day.foods.splice(i,1); saveDay(d,day); render();
}

/* ---------- 運動：DB、計算、紀錄 ---------- */
let EX_DB = [
  {name:'健走（輕鬆）', met:2.8, note:'~4 km/h'},
  {name:'快走', met:3.5, note:'~5–6 km/h'},
  {name:'慢跑', met:7.0, note:'~8 km/h'},
  {name:'騎飛輪（中等）', met:7.0, note:''},
  {name:'重訓（一般）', met:6.0, note:'全身循環'},
  {name:'瑜伽（哈達）', met:2.5, note:''},
  {name:'游泳（自由式中速）', met:8.3, note:''},
  {name:'家務（掃地拖地）', met:3.3, note:''},
];
const EX_KEY='jusmile-ex-db', EX_URL_KEY='jusmile-ex-url';
(function initEx(){ const x=localStorage.getItem(EX_KEY); if(x){ try{ EX_DB=JSON.parse(x);}catch{} } })();

function rebuildExList(){
  const dl = $id('exList'); if(!dl) return;
  dl.innerHTML=''; EX_DB.forEach(x=>{ const o=document.createElement('option'); o.value=x.name; dl.appendChild(o); });
}
rebuildExList();

$id('exName')?.addEventListener('change', ()=>{
  const nm=$id('exName').value.trim();
  const norm=s=>s.replace(/\s+/g,'').toLowerCase();
  const hit=EX_DB.find(x=>x.name===nm) || EX_DB.find(x=>norm(x.name).includes(norm(nm)));
  if(hit && $id('exMET')) $id('exMET').value=hit.met;
});

function calcExKcal(met,kg,mins){
  const M=parseFloat(met)||0, W=parseFloat(kg)||0, T=parseFloat(mins)||0;
  if(!M||!W||!T) return 0;
  return Math.round(M*3.5*W/200*T);
}

$id('btnAddEx')?.addEventListener('click', ()=>{
  const nm=$id('exName').value.trim();
  const met=parseFloat($id('exMET').value)||0;
  const mins=parseFloat($id('exMins').value)||0;
  let kg=parseFloat($id('userWeight').value);
  if(!kg) kg=readWeight()||0;
  if(!nm||met<=0||mins<=0||kg<=0){ alert('請輸入名稱、MET、分鐘、體重'); return; }
  const kcal=calcExKcal(met,kg,mins);
  const d=today(); const day=getDay(d);
  if(!day.exercises) day.exercises=[];
  day.exercises.push({name:nm,met,mins,kg,kcal,t:Date.now()});
  saveDay(d,day);
  $id('exName').value=''; $id('exMET').value=''; $id('exMins').value='30';
  render();
});
$id('btnClearExToday')?.addEventListener('click', ()=>{
  const d=today(); const day=getDay(d);
  if(!day.exercises || !day.exercises.length) return;
  if(!confirm('確定清空今天的運動紀錄？')) return;
  day.exercises=[]; saveDay(d,day); render();
});
window.delEx = (i)=>{
  const d=today(); const day=getDay(d); if(!day.exercises) return;
  day.exercises.splice(i,1); saveDay(d,day); render();
}

/* ---------- 同步 CSV（TYPE/UNIT/FOOD） ---------- */
$id('btnSyncTypeCsv')?.addEventListener('click', async ()=>{
  const url=$id('typeCsvUrl').value.trim(); if(!url){ alert('請貼上 CSV 連結'); return; }
  try{ const txt=await fetchText(url); const tbl=parseTypeCSV(txt);
    TYPE_TABLE=tbl; localStorage.setItem(TYPE_TABLE_KEY, JSON.stringify(tbl)); localStorage.setItem(TYPE_URL_KEY,url);
    alert('同步完成（類別表）'); }catch(e){ alert('同步失敗：'+e.message); }
});
$id('btnSyncUnitCsv')?.addEventListener('click', async ()=>{
  const url=$id('unitCsvUrl').value.trim(); if(!url){ alert('請貼上 CSV 連結'); return; }
  try{ const txt=await fetchText(url); const rows=parseUnitCSV(txt);
    UNIT_MAP=rows; localStorage.setItem(UNIT_MAP_KEY, JSON.stringify(rows)); localStorage.setItem(UNIT_URL_KEY,url);
    alert('同步完成（單位換算）'); }catch(e){ alert('同步失敗：'+e.message); }
});
$id('btnSyncFoodCsv')?.addEventListener('click', async ()=>{
  const url=$id('foodCsvUrl').value.trim(); if(!url){ alert('請貼上 CSV 連結'); return; }
  try{ const txt=await fetchText(url); const rows=parseFoodCSV(txt);
    FOOD_DB=rows; localStorage.setItem(FOOD_DB_KEY, JSON.stringify(rows)); localStorage.setItem(FOOD_URL_KEY,url);
    alert('同步完成（食物庫）'); }catch(e){ alert('同步失敗：'+e.message); }
});
// 還原已存的 URL（若有）
['typeCsvUrl','unitCsvUrl','foodCsvUrl'].forEach(id=>{
  const el=$id(id); if(!el) return;
  const key = id==='typeCsvUrl'?TYPE_URL_KEY : (id==='unitCsvUrl'?UNIT_URL_KEY : FOOD_URL_KEY);
  const v=localStorage.getItem(key)||''; if(v) el.value=v;
});

/* ---------- 渲染 ---------- */
function sumFoods(day){ let kcal=0,p=0,c=0,f=0; (day.foods||[]).forEach(x=>{kcal+=+x.kcal||0; p+=+x.protein||0; c+=+x.carb||0; f+=+x.fat||0;}); return {kcal,p,c,f}; }
function sumExercises(day){ let kcal=0; (day.exercises||[]).forEach(e=>kcal+=+e.kcal||0); return {kcal}; }

function renderFoods(day){
  const tb=$id('foodTable'); if(!tb) return; tb.innerHTML='';
  (day.foods||[]).forEach((x,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${x.meal||''}</td><td>${x.name||''}</td>
      <td>${x.kcal||0}</td><td>${x.protein||0}</td><td>${x.carb||0}</td><td>${x.fat||0}</td>
      <td><button class="btn-danger" onclick="delFood(${i})">刪</button></td>`;
    tb.appendChild(tr);
  });
}
function renderExercises(day){
  const tb=$id('exTable'); if(!tb) return; tb.innerHTML='';
  (day.exercises||[]).forEach((e,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${e.name}</td><td>${e.met}</td><td>${e.mins}</td><td>${e.kcal}</td>
      <td><button class="btn-danger" onclick="delEx(${i})">刪</button></td>`;
    tb.appendChild(tr);
  });
}
function updateCalorieBar(net, target){
  const el=$id('calBar'); if(!el) return;
  const t=target||0; const v=Math.max(0, Math.min(100, t? Math.round(net/t*100):0));
  el.style.width = v+'%';
  el.textContent = t? `${net}/${t} kcal` : `${net} kcal`;
}
function render(){
  const d=today(); const day=getDay(d);
  renderFoods(day); renderExercises(day);

  const S=sumFoods(day), E=sumExercises(day);
  const net=Math.max(0, S.kcal - E.kcal);

  if($id('sumKcal')) $id('sumKcal').textContent = S.kcal;
  if($id('sumProtein')) $id('sumProtein').textContent = S.p.toFixed(0);
  if($id('sumCarb')) $id('sumCarb').textContent = S.c.toFixed(0);
  if($id('sumFat')) $id('sumFat').textContent = S.f.toFixed(0);
  if($id('exKcal')) $id('exKcal').textContent = E.kcal;
  if($id('netKcal')) $id('netKcal').textContent = net;

  updateCalorieBar(net, readNum(CAL_KEY)||0);
}
render();

/* ---------- 保存目標/體重 ---------- */
$id('btnSaveTargets')?.addEventListener('click', ()=>{
  const cal=parseFloat($id('setCal')?.value)||0;
  const pro=parseFloat($id('setProtein')?.value)||0;
  const wt =parseFloat($id('setWeight')?.value)||0;
  if(cal>0) writeNum(CAL_KEY, cal);
  if(pro>0) writeNum(PRO_KEY, pro);
  if(wt>0)  writeWeight(wt);
  if($id('userWeight') && wt>0) $id('userWeight').value = wt;
  alert('已保存');
});

/* ---------- 初始事件 ---------- */
$id('foodName')?.addEventListener('change', tryAutofill);
$id('foodQty') ?.addEventListener('input',  tryAutofill);
$id('btnAutoFill')?.addEventListener('click', tryAutofill);
