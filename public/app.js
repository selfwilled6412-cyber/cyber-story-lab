const STORAGE_KEY = 'cyberStoryLabState_v03';
const state = {
  step: 1, creator: '', theme: '', hero: '', story: ['', '', '', ''], storyIndex: 0,
  drawGuides: ['', '', '', ''], images: [null, null, null, null], processedImages: [null, null, null, null],
  imageMode: 'original', layout: 'grid', apiReady: false, aiBusy: false
};

const titles = {
  1: ['どんなお話にする？', '最初は自分で。困った時だけ、ヒントを少し使います。'],
  2: ['主役を決めよう', '人間じゃなくてOK。あなたの頭に浮かんだ存在が主役です。'],
  3: ['4コマの流れを作ろう', '1コマずつ考えます。変な展開でも直しません。'],
  4: ['あなたの4コマを確認', '意味を変えず、そのまま作品にします。変えたいところだけ自分で直せます。'],
  5: ['A4用紙に絵を描こう', '文章を「何を描けばいいか」に変換する部分だけAIが補助できます。'],
  6: ['原画を取り込もう', '4枚を写真で登録。原画を残したまま、必要な分だけ仕上げます。'],
  7: ['4コマ漫画 完成', 'あなたが考え、あなたが描いた作品です。']
};

const localThemeHints = [
  '空から変なものが落ちてくる', '食べ物が急にしゃべり出す', 'いつもの場所が別世界になる',
  '正体不明のものに出会う', '小さいものがものすごく大きくなる', '夜だけ動き出すものがある',
  '宇宙に変なお店がある', '大事なものが突然なくなる', '誰も知らない学校がある', '絶対に起きなさそうなことが起きる'
];

const storyQuestions = [
  { title: '最初、主役は何をしてる？', help: '場所や行動を自由に考えてみよう。', hint: ['どこにいる？', '何を見てる？', '何をしてる？'] },
  { title: '次に、何が起きる？', help: '普通じゃなくてOK。急に変なことが起きてもOK。', hint: ['何かが来る？', '何かが変わる？', '何かを見つける？'] },
  { title: 'さらに、何が起きる？', help: 'もっと変になっても大丈夫。', hint: ['もっと大きくなる？', '逆になる？', '別のものが出てくる？'] },
  { title: '最後、どうなる？', help: 'オチがなくてもOK。「そのまま終わる」も作品です。', hint: ['笑って終わる？', 'びっくりして終わる？', 'もっと変になって終わる？'] }
];

const els = {
  stepChip: q('#stepChip'), stepTitle: q('#stepTitle'), stepLead: q('#stepLead'), stepContent: q('#stepContent'),
  progressList: q('#progressList'), backBtn: q('#backBtn'), nextBtn: q('#nextBtn'), creatorName: q('#creatorName'),
  saveBtn: q('#saveBtn'), resetBtn: q('#resetBtn'), libraryBtn: q('#libraryBtn'), apiBadge: q('#apiBadge'), busyModal: q('#busyModal'),
  busyTitle: q('#busyTitle'), busyText: q('#busyText')
};

function q(s, root=document){ return root.querySelector(s); }
function qa(s, root=document){ return [...root.querySelectorAll(s)]; }
function cloneTemplate(id){ return q(id).content.cloneNode(true); }
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function shuffled(arr){ return [...arr].sort(()=>Math.random()-.5); }
function safeFile(s){ return String(s).replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,30); }

async function checkApi(){
  if (location.protocol === 'file:') return setApiStatus(false, 'OFFLINE DEMO');
  try {
    const r = await fetch('/api/health', {cache:'no-store'});
    const data = await r.json();
    setApiStatus(Boolean(data.aiConfigured), data.aiConfigured ? 'AI CONNECTED' : 'AI KEY待ち');
  } catch { setApiStatus(false, 'OFFLINE DEMO'); }
}
function setApiStatus(ready, label){ state.apiReady = ready; els.apiBadge.textContent = label; els.apiBadge.classList.toggle('online', ready); }

function render(){
  els.stepChip.textContent = `STEP ${String(state.step).padStart(2,'0')}`;
  els.stepTitle.textContent = titles[state.step][0]; els.stepLead.textContent = titles[state.step][1];
  els.stepContent.innerHTML = ''; els.backBtn.disabled = state.step === 1;
  els.nextBtn.classList.toggle('hidden', state.step === 7); els.nextBtn.textContent = state.step === 3 ? '4コマを確認 →' : 'つぎへ →';
  updateProgress();
  ({1:renderStep1,2:renderStep2,3:renderStep3,4:renderStep4,5:renderStep5,6:renderStep6,7:renderStep7}[state.step])();
}
function updateProgress(){ qa('li',els.progressList).forEach(li=>{ const n=Number(li.dataset.step); li.classList.toggle('active',n===state.step); li.classList.toggle('done',n<state.step); }); }

function renderStep1(){
  els.stepContent.appendChild(cloneTemplate('#step1Template'));
  const input=q('#themeInput'), hints=q('#themeHints'), ladder=q('#themeHintLadder'); input.value=state.theme;
  input.oninput=e=>state.theme=e.target.value; q('#themeClearBtn').onclick=()=>{state.theme='';input.value='';hints.innerHTML='';};
  q('#themeHintBtn').onclick=()=>{ ladder.classList.toggle('hidden'); hints.innerHTML=''; };
  q('#themeExamplesBtn').onclick=async()=>{
    let items=null;
    if(state.apiReady){
      showBusy('AIが5つの入口を探しています','物語そのものは作りません。お題の入口だけ出します。');
      try{ const data=await apiStoryHelp('theme_examples',{theme:state.theme}); items=data.items; }catch(e){ console.warn(e); } finally{ hideBusy(); }
    }
    if(!Array.isArray(items)||!items.length) items=shuffled(localThemeHints).slice(0,5);
    hints.innerHTML=''; items.slice(0,5).forEach(text=>{ const b=document.createElement('button'); b.className='choice-chip'; b.textContent=text; b.onclick=()=>{state.theme=text;input.value=text;}; hints.appendChild(b); });
  };
}

function renderStep2(){
  els.stepContent.appendChild(cloneTemplate('#step2Template'));
  const input=q('#heroInput'); input.value=state.hero; input.oninput=e=>state.hero=e.target.value;
  q('#heroHintBtn').onclick=()=>q('#heroHintLadder').classList.toggle('hidden');
}

function renderStep3(){
  els.stepContent.appendChild(cloneTemplate('#step3Template'));
  const tabs=q('#storyTabs');
  storyQuestions.forEach((item,i)=>{ const b=document.createElement('button'); b.className=`story-tab ${i===state.storyIndex?'active':''} ${state.story[i].trim()?'done':''}`; b.textContent=`${i+1}コマ目`; b.onclick=()=>{saveStoryAnswer();state.storyIndex=i;render();}; tabs.appendChild(b); });
  const item=storyQuestions[state.storyIndex]; q('#storyQuestionNo').textContent=`${state.storyIndex+1}コマ目 / 4`;
  q('#storyQuestionTitle').textContent=item.title; q('#storyQuestionHelp').textContent=item.help;
  q('#storyContext').innerHTML=`<span>お題：${escapeHtml(state.theme)}</span><span>主役：${escapeHtml(state.hero)}</span>`;
  const answer=q('#storyAnswer'); answer.value=state.story[state.storyIndex]; answer.oninput=e=>state.story[state.storyIndex]=e.target.value;
  q('#storyHintBtn').onclick=async()=>{
    const box=q('#storyHintBox'); let hints=item.hint;
    if(state.apiReady){
      showBusy('AIが質問だけ考えています','答えや展開は作りません。');
      try{ const data=await apiStoryHelp('story_hint',{theme:state.theme,hero:state.hero,story:state.story,index:state.storyIndex}); if(Array.isArray(data.items)) hints=data.items; }catch(e){console.warn(e);}finally{hideBusy();}
    }
    box.innerHTML=`<strong>答えは作りません。考えるための質問：</strong><ul>${hints.slice(0,3).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`; box.classList.remove('hidden');
  };
  q('#storyNextBtn').onclick=()=>{
    saveStoryAnswer(); if(!state.story[state.storyIndex].trim()){toast('まず、このコマの内容を少しだけ入力してみよう');return;}
    if(state.storyIndex<3){state.storyIndex++;saveState();render();window.scrollTo({top:0,behavior:'smooth'});}else{toast('4コマ全部できた！「4コマを確認」へ進めます');}
  };
}
function saveStoryAnswer(){ const answer=q('#storyAnswer'); if(answer) state.story[state.storyIndex]=answer.value; }

function renderStep4(){
  els.stepContent.appendChild(cloneTemplate('#step4Template')); const grid=q('#reviewGrid');
  state.story.forEach((text,i)=>{const card=document.createElement('div');card.className='review-card';card.innerHTML=`<div class="koma-no">${i+1}コマ目</div><textarea data-i="${i}">${escapeHtml(text)}</textarea><small>AI修正なし</small>`;grid.appendChild(card);});
  qa('textarea',grid).forEach(t=>t.oninput=e=>{state.story[Number(e.target.dataset.i)]=e.target.value;state.drawGuides=['','','',''];});
}

function localDrawingInstruction(i){
  const text=state.story[i]||'まだ内容がありません', hero=state.hero||'主役';
  return [
    `${hero}が「${text}」という最初の場面。主役を大きく描いて、場所が分かるものを1つだけ足してみよう。`,
    `「${text}」が起きた瞬間。何が変わったのかが見えるように、一番大事なものを大きく描いてみよう。`,
    `「${text}」の中で一番見せたいところ。位置や大きさは自由。変な形でも直さなくてOK。`,
    `最後の「${text}」が伝わる場面。主役の表情・向き・周りの様子を自由に決めて描いてみよう。`
  ][i];
}
async function ensureDrawGuides(useAi=false){
  if(state.drawGuides.every(Boolean) && !useAi) return;
  if(useAi && state.apiReady){
    showBusy('AIが作画指示へ変換中','物語の内容は足さず、「何を描くか」だけ整理します。');
    try{
      const data=await apiStoryHelp('draw_instructions',{theme:state.theme,hero:state.hero,story:state.story});
      if(Array.isArray(data.items)&&data.items.length===4) state.drawGuides=data.items;
    }catch(e){console.warn(e);}finally{hideBusy();}
  }
  if(!state.drawGuides.every(Boolean)) state.drawGuides=state.story.map((_,i)=>localDrawingInstruction(i));
  saveState();
}
async function renderStep5(){
  els.stepContent.appendChild(cloneTemplate('#step5Template')); await ensureDrawGuides(false); const grid=q('#drawGrid');
  state.story.forEach((text,i)=>{const card=document.createElement('article');card.className='draw-card';card.innerHTML=`<div class="koma-no">A4 SHEET ${i+1}</div><h4>${i+1}コマ目</h4><p><strong>このコマの文章：</strong><br>${escapeHtml(text)}</p><div class="draw-callout">✎ ${escapeHtml(state.drawGuides[i])}</div><div class="draw-rule">描き足してOK / 省いてOK / AIの指示どおりじゃなくてOK</div>`;grid.appendChild(card);});
  q('#refreshDrawGuideBtn').onclick=async()=>{await ensureDrawGuides(true);render();};
  q('#drawGuideStatus').textContent=state.apiReady?'AI接続済み：押した時だけ作画指示を再整理します。':'今はローカル補助。API接続後はAIが文章を作画指示へ整理します。';
}

function renderStep6(){
  els.stepContent.appendChild(cloneTemplate('#step6Template'));
  qa('.mode',els.stepContent).forEach(b=>{ b.classList.toggle('active',b.dataset.mode===state.imageMode); b.onclick=async()=>{state.imageMode=b.dataset.mode;await processAllImages();render();}; });
  const grid=q('#uploadGrid');
  for(let i=0;i<4;i++){
    const card=document.createElement('article');card.className='upload-card';const img=state.processedImages[i]||state.images[i];
    card.innerHTML=`<div class="koma-no">${i+1}コマ目</div><h4>A4原画 ${i+1}</h4><p>${escapeHtml(state.story[i])}</p><label class="upload-drop"><input type="file" accept="image/*" capture="environment" data-index="${i}">${img?`<img src="${img}" alt="${i+1}コマ目原画">`:`<div class="upload-placeholder"><strong>写真を選ぶ / 撮影する</strong>A4用紙をできるだけ真上から撮ってください</div>`}</label><div class="image-toolbar">${state.images[i]?`<button class="tiny-btn" data-ai="${i}">✦ このコマだけAI仕上げ</button><button class="tiny-btn" data-restore="${i}">原画に戻す</button>`:''}</div><div class="image-status">${state.images[i]?'✓ 登録済み':'未登録'} ${state.processedImages[i]&&state.processedImages[i]!==state.images[i]?' / 補助済み':''}</div>`;
    grid.appendChild(card);
  }
  qa('input[type=file]',grid).forEach(input=>input.onchange=async e=>{const i=Number(e.target.dataset.index),file=e.target.files?.[0];if(!file)return;showBusy('原画を取り込み中','スマホ写真を軽量化しています。');try{state.images[i]=await normalizeUpload(file);state.processedImages[i]=await processImage(state.images[i],state.imageMode);saveState();render();}finally{hideBusy();}});
  qa('[data-restore]',grid).forEach(b=>b.onclick=()=>{const i=Number(b.dataset.restore);state.processedImages[i]=state.images[i];saveState();render();});
  qa('[data-ai]',grid).forEach(b=>b.onclick=()=>aiFinishImage(Number(b.dataset.ai)));
}
async function aiFinishImage(i){
  if(!state.apiReady){ toast('AI接続はまだ準備中。今は「線を見やすく」を使えます'); return; }
  showBusy(`${i+1}コマ目をAI仕上げ中`,'原画の構図・変な形・独自の発想を残すよう指示しています。');
  try{
    const r=await fetch('/api/image-finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:state.images[i],story:state.story[i],hero:state.hero,drawGuide:state.drawGuides[i]||localDrawingInstruction(i)})});
    const data=await r.json(); if(!r.ok) throw new Error(data.error||'AI仕上げに失敗'); state.processedImages[i]=data.imageDataUrl; saveState(); render(); toast(`${i+1}コマ目をAI仕上げしました`);
  }catch(e){ console.error(e); toast(`AI仕上げ失敗：${e.message}`); } finally{ hideBusy(); }
}

function renderStep7(){
  els.stepContent.appendChild(cloneTemplate('#step7Template')); q('#finishHeading').textContent=`${state.creator?state.creator+'さんの':''}4コマ漫画が完成しました！`;
  qa('[data-layout]',els.stepContent).forEach(b=>{b.classList.toggle('active',b.dataset.layout===state.layout);b.onclick=()=>{state.layout=b.dataset.layout;saveState();renderStep7Preview();qa('[data-layout]',els.stepContent).forEach(x=>x.classList.toggle('active',x.dataset.layout===state.layout));};});
  renderStep7Preview(); q('#saveWorkBtn').onclick=saveCurrentWork; q('#downloadPngBtn').onclick=downloadComicPng;
  q('#newStoryBtn').onclick=()=>{const creator=state.creator;Object.assign(state,{step:1,creator,theme:'',hero:'',story:['','','',''],storyIndex:0,drawGuides:['','','',''],images:[null,null,null,null],processedImages:[null,null,null,null],imageMode:'original',layout:'grid',workId:null,createdAt:null});saveState();render();};
}
function renderStep7Preview(){
  const sheet=q('#comicSheet'); if(!sheet)return; sheet.className=`comic-sheet ${state.layout}`;
  sheet.innerHTML=`<div class="comic-headline"><div><small>CYBER STORY LAB</small><h4>${escapeHtml(state.theme||'無題の4コマ')}</h4></div><small>作者：${escapeHtml(state.creator||'匿名')}</small></div><div class="comic-panels"></div><div class="comic-end">おしまい</div>`;
  const panels=q('.comic-panels',sheet);
  state.story.forEach((text,i)=>{const img=state.processedImages[i]||state.images[i];const item=document.createElement('div');item.className='comic-koma';item.innerHTML=`<div class="comic-art">${img?`<img src="${img}" alt="${i+1}コマ目">`:`<div class="missing-art">原画未登録</div>`}<span class="panel-number">${i+1}</span><div class="caption">${escapeHtml(text)}</div></div>`;panels.appendChild(item);});
}

function validateCurrent(){
  if(state.step===1&&!state.theme.trim()) return 'お題を入力するか、ヒントから1つ選んでください。';
  if(state.step===2&&!state.hero.trim()) return '主役を入力してください。人間じゃなくて大丈夫です。';
  if(state.step===3){saveStoryAnswer();if(state.story.some(s=>!s.trim())){const missing=state.story.findIndex(s=>!s.trim());state.storyIndex=missing;render();return `${missing+1}コマ目を少しだけ考えてみよう。困ったらヒントを押せます。`;}}
  if(state.step===6&&state.images.some(x=>!x)) return 'A4原画を4枚すべて登録してください。';
  return null;
}
els.nextBtn.onclick=async()=>{state.creator=els.creatorName.value.trim();const error=validateCurrent();if(error){alert(error);return;}if(state.step===4){state.drawGuides=['','','',''];}if(state.step<7)state.step++;saveState();render();window.scrollTo({top:0,behavior:'smooth'});};
els.backBtn.onclick=()=>{if(state.step===3)saveStoryAnswer();if(state.step>1)state.step--;saveState();render();window.scrollTo({top:0,behavior:'smooth'});};
els.creatorName.oninput=e=>state.creator=e.target.value;
els.saveBtn.onclick=()=>{state.creator=els.creatorName.value.trim();saveState();toast('途中保存しました');};
els.resetBtn.onclick=()=>{if(!confirm('今の作品を消して最初から始めますか？'))return;localStorage.removeItem(STORAGE_KEY);location.reload();};
els.libraryBtn.onclick=openLibrary;

const DB_NAME='cyberStoryLabDB', DB_VERSION=1, STORE_NAME='works';
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE_NAME)){const store=db.createObjectStore(STORE_NAME,{keyPath:'id'});store.createIndex('updatedAt','updatedAt');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function saveWorkRecord(record){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function getWorks(){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readonly');const req=tx.objectStore(STORE_NAME).getAll();req.onsuccess=()=>{const rows=req.result.sort((a,b)=>b.updatedAt-a.updatedAt);db.close();resolve(rows);};req.onerror=()=>{db.close();reject(req.error);};});}
async function deleteWork(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function saveCurrentWork(){
  if(state.images.some(x=>!x)){toast('原画4枚を登録してから作品棚へ保存できます');return;}
  showBusy('作品棚へ保存中','原画と完成画像をこの端末に保存します。');
  try{
    const now=Date.now(), id=state.workId || `work_${now}_${Math.random().toString(36).slice(2,8)}`; state.workId=id;
    await saveWorkRecord({id,creator:state.creator||'匿名',theme:state.theme||'無題',hero:state.hero,story:[...state.story],drawGuides:[...state.drawGuides],images:[...state.images],processedImages:[...state.processedImages],layout:state.layout,createdAt:state.createdAt||now,updatedAt:now}); state.createdAt=state.createdAt||now; saveState(); toast('作品棚に保存しました');
  }catch(e){console.error(e);toast('作品棚への保存に失敗しました');}finally{hideBusy();}
}
async function openLibrary(){
  const modal=q('#libraryModal'),grid=q('#libraryGrid'); modal.classList.remove('hidden'); grid.innerHTML='<div class="library-empty">読み込み中...</div>';
  try{
    const works=await getWorks(); const count=Math.min(works.length,5); q('#volumeCount').textContent=`${count} / 5`; q('#volumeBar').style.width=`${Math.min(100,count/5*100)}%`; grid.innerHTML='';
    if(!works.length){grid.innerHTML='<div class="library-empty">まだ作品はありません。<br>最初の4コマを完成させよう。</div>';}
    works.forEach(w=>{const card=document.createElement('article');card.className='library-card';const thumb=w.processedImages?.[0]||w.images?.[0];card.innerHTML=`${thumb?`<img src="${thumb}" alt="作品サムネイル">`:'<div class="library-noimg">NO IMAGE</div>'}<div class="library-copy"><small>${new Date(w.updatedAt).toLocaleDateString('ja-JP')}</small><h4>${escapeHtml(w.theme)}</h4><p>作者：${escapeHtml(w.creator)}</p><div><button class="tiny-btn" data-open="${w.id}">開く</button><button class="tiny-btn danger" data-delete="${w.id}">削除</button></div></div>`;grid.appendChild(card);});
    qa('[data-open]',grid).forEach(b=>b.onclick=()=>loadWork(works.find(w=>w.id===b.dataset.open)));
    qa('[data-delete]',grid).forEach(b=>b.onclick=async()=>{if(!confirm('この作品を作品棚から削除しますか？'))return;await deleteWork(b.dataset.delete);openLibrary();});
  }catch(e){console.error(e);grid.innerHTML='<div class="library-empty">このブラウザでは作品棚を開けませんでした。</div>';}
  q('#closeLibraryBtn').onclick=()=>modal.classList.add('hidden');
  modal.onclick=e=>{if(e.target===modal)modal.classList.add('hidden');};
}
function loadWork(w){if(!w)return;Object.assign(state,{step:7,creator:w.creator||'',theme:w.theme||'',hero:w.hero||'',story:w.story||['','','',''],storyIndex:0,drawGuides:w.drawGuides||['','','',''],images:w.images||[null,null,null,null],processedImages:w.processedImages||[null,null,null,null],imageMode:'original',layout:w.layout||'grid',workId:w.id,createdAt:w.createdAt});els.creatorName.value=state.creator;saveState();q('#libraryModal').classList.add('hidden');render();window.scrollTo({top:0,behavior:'smooth'});toast('作品を開きました');}

function saveState(){
  const light={...state,apiReady:false,aiBusy:false};
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(light));}catch(e){console.warn('保存容量超過',e);toast('保存容量がいっぱいです。写真を軽くして再登録してください');}
}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)Object.assign(state,JSON.parse(raw));}catch(e){console.warn(e);}els.creatorName.value=state.creator||'';}
function toast(text){const d=document.createElement('div');d.className='toast';d.textContent=text;document.body.appendChild(d);setTimeout(()=>d.remove(),2400);}
function showBusy(title,text){els.busyTitle.textContent=title;els.busyText.textContent=text;els.busyModal.classList.remove('hidden');}
function hideBusy(){els.busyModal.classList.add('hidden');}

async function apiStoryHelp(mode,payload){
  const r=await fetch('/api/story-help',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,...payload})});
  const data=await r.json(); if(!r.ok)throw new Error(data.error||'AI補助に失敗'); return data;
}

async function normalizeUpload(file){
  const src=await fileToDataUrl(file); const img=await loadImage(src); const max=1500,scale=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82);
}
async function processAllImages(){for(let i=0;i<4;i++)if(state.images[i])state.processedImages[i]=await processImage(state.images[i],state.imageMode);saveState();}
function processImage(src,mode){if(!src||mode==='original')return Promise.resolve(src);return loadImage(src).then(img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.filter='contrast(1.28) brightness(1.08) saturate(.82)';ctx.drawImage(img,0,0);return c.toDataURL('image/jpeg',.88);});}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}

async function downloadComicPng(){
  const grid=state.layout==='grid', W=grid?1754:1240, H=grid?1240:1754; const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';
  ctx.font=`700 ${grid?42:40}px sans-serif`;wrapText(ctx,state.theme||'無題の4コマ',48,58,grid?1120:800,48);ctx.font='20px sans-serif';ctx.textAlign='right';ctx.fillText(`作者：${state.creator||'匿名'}`,W-48,62);ctx.textAlign='left';ctx.fillRect(42,96,W-84,4);
  if(grid){
    const gap=24, margin=42, top=124, panelW=(W-margin*2-gap)/2, panelH=(H-top-58-gap)/2;
    for(let i=0;i<4;i++){const col=i%2,row=Math.floor(i/2),x=margin+col*(panelW+gap),y=top+row*(panelH+gap);await drawPanel(ctx,i,x,y,panelW,panelH);}
  }else{
    const margin=46, top=120,gap=14,panelH=(H-top-50-gap*3)/4,panelW=W-margin*2;
    for(let i=0;i<4;i++)await drawPanel(ctx,i,margin,top+i*(panelH+gap),panelW,panelH);
  }
  ctx.textAlign='center';ctx.fillStyle='#111';ctx.font='700 20px sans-serif';ctx.fillText('おしまい',W/2,H-20);ctx.textAlign='left';
  const a=document.createElement('a');a.download=`4koma_${safeFile(state.creator||'author')}_${Date.now()}.png`;a.href=c.toDataURL('image/png');a.click();
}
async function drawPanel(ctx,i,x,y,w,h){
  ctx.save();ctx.strokeStyle='#111';ctx.lineWidth=5;ctx.strokeRect(x,y,w,h);ctx.beginPath();ctx.rect(x+5,y+5,w-10,h-10);ctx.clip();
  const img=state.processedImages[i]||state.images[i];if(img){const image=await loadImage(img);drawCover(ctx,image,x+5,y+5,w-10,h-10);}else{ctx.fillStyle='#eee';ctx.fillRect(x+5,y+5,w-10,h-10);}
  const capH=Math.min(118,h*.27);ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(x+5,y+h-capH-5,w-10,capH);ctx.fillStyle='#111';ctx.font=`700 ${Math.max(18,Math.min(27,w/25))}px sans-serif`;ctx.fillText(`${i+1}`,x+18,y+31);ctx.font=`${Math.max(18,Math.min(27,w/25))}px sans-serif`;wrapText(ctx,state.story[i],x+18,y+h-capH+30,w-36,34);ctx.restore();
}
function drawCover(ctx,img,x,y,w,h){const s=Math.max(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function wrapText(ctx,text,x,y,maxWidth,lineHeight){let line='';for(const ch of [...String(text||'')]){const test=line+ch;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);line=ch;y+=lineHeight;}else line=test;}if(line)ctx.fillText(line,x,y);return y;}

loadState(); render(); checkApi();
