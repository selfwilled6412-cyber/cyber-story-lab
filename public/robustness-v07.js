(() => {
  const DRAFT_DB_NAME = 'cyberStoryLabDraftDB';
  const DRAFT_DB_VERSION = 1;
  const DRAFT_STORE = 'drafts';
  const DRAFT_KEY = 'current';
  let lastDraftSignature = '';

  function openDraftDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DRAFT_DB_NAME, DRAFT_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function imageSignature() {
    return [...state.images, ...state.processedImages]
      .map(value => value ? `${value.length}:${value.slice(-24)}` : '0')
      .join('|');
  }

  async function saveDraftImages(force = false) {
    const signature = imageSignature();
    if (!force && signature === lastDraftSignature) return;
    lastDraftSignature = signature;
    const db = await openDraftDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE, 'readwrite');
      tx.objectStore(DRAFT_STORE).put({
        id: DRAFT_KEY,
        images: [...state.images],
        processedImages: [...state.processedImages],
        updatedAt: Date.now()
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function readDraftImages() {
    const db = await openDraftDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE, 'readonly');
      const req = tx.objectStore(DRAFT_STORE).get(DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  async function clearDraftImages() {
    const db = await openDraftDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE, 'readwrite');
      tx.objectStore(DRAFT_STORE).delete(DRAFT_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    lastDraftSignature = '';
  }

  saveState = function () {
    const light = {
      ...state,
      images: [null, null, null, null],
      processedImages: [null, null, null, null],
      apiReady: false,
      aiBusy: false,
      draftImagesStored: state.images.some(Boolean)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch (error) {
      console.warn('途中保存に失敗', error);
      toast('途中保存に失敗しました。作品棚への保存を先に試してください。');
    }
    void saveDraftImages().catch(error => console.warn('原画の途中保存に失敗', error));
  };

  async function restoreDraftImages() {
    try {
      const draft = await readDraftImages();
      if (!draft) return;
      if (!state.images.some(Boolean) && Array.isArray(draft.images)) {
        state.images = draft.images.slice(0, 4);
        state.processedImages = Array.isArray(draft.processedImages)
          ? draft.processedImages.slice(0, 4)
          : [...state.images];
        while (state.images.length < 4) state.images.push(null);
        while (state.processedImages.length < 4) state.processedImages.push(null);
        lastDraftSignature = imageSignature();
        if (state.images.some(Boolean)) {
          render();
          toast('途中保存していた原画を復元しました');
        }
      }
    } catch (error) {
      console.warn('原画の復元に失敗', error);
    }
  }

  els.resetBtn.onclick = async () => {
    if (!confirm('今の作品を消して最初から始めますか？')) return;
    try { await clearDraftImages(); } catch (error) { console.warn(error); }
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  const originalRenderStep7 = renderStep7;
  renderStep7 = function () {
    originalRenderStep7();
    const newStoryBtn = q('#newStoryBtn');
    if (newStoryBtn) {
      const oldHandler = newStoryBtn.onclick;
      newStoryBtn.onclick = async () => {
        try { await clearDraftImages(); } catch (error) { console.warn(error); }
        oldHandler?.();
      };
    }
  };

  function volumeHtml(creator, works) {
    const safeCreator = escapeHtml(creator || '作者');
    const pages = works.slice(0, 5).map((work, workIndex) => {
      const panels = (work.story || []).slice(0, 4).map((text, i) => {
        const src = work.processedImages?.[i] || work.images?.[i] || '';
        return `<section class="panel"><div class="art">${src ? `<img src="${src}" alt="${i + 1}コマ目">` : '<div class="missing">NO IMAGE</div>'}<b>${i + 1}</b></div><p>${escapeHtml(text || '')}</p></section>`;
      }).join('');
      return `<article class="story-page"><header><span>STORY ${String(workIndex + 1).padStart(2, '0')}</span><h2>${escapeHtml(work.theme || '無題')}</h2></header><div class="panels">${panels}</div><footer>${safeCreator} / CYBER STORY LAB</footer></article>`;
    }).join('');

    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${safeCreator}さんの4コマ作品集 第1巻</title><style>
      @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;background:#fff}.cover,.story-page{page-break-after:always;min-height:270mm}.cover{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:8px solid #111}.cover .kicker{letter-spacing:.3em;font-weight:800}.cover h1{font-size:38px;margin:24px 20px 10px}.cover h2{font-size:22px;font-weight:600}.cover .mark{font-size:14px;margin-top:70px}.story-page header{border-bottom:4px solid #111;margin-bottom:8mm}.story-page header span{font-size:12px;font-weight:800;letter-spacing:.18em}.story-page h2{font-size:24px;margin:4px 0 10px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.panel{border:3px solid #111;break-inside:avoid;background:#fff}.art{height:92mm;position:relative;overflow:hidden;background:#f4f4f4}.art img{width:100%;height:100%;object-fit:cover}.art b{position:absolute;top:5px;left:7px;background:#fff;border:2px solid #111;border-radius:999px;width:30px;height:30px;display:grid;place-items:center}.missing{height:100%;display:grid;place-items:center;color:#777}.panel p{min-height:22mm;margin:0;padding:5mm;font-size:15px;line-height:1.55;border-top:2px solid #111}.story-page footer{text-align:right;margin-top:5mm;font-size:11px}@media screen{body{background:#ddd}.cover,.story-page{width:210mm;min-height:297mm;margin:12px auto;padding:12mm;background:#fff;box-shadow:0 8px 30px #888}}
    </style></head><body><section class="cover"><div class="kicker">CYBER STORY LAB</div><h1>${safeCreator}さんの<br>4コマ作品集</h1><h2>第1巻</h2><div class="mark">作者の発想と原画から生まれた作品集</div></section>${pages}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));<\/script></body></html>`;
  }

  function openVolume(creator, works) {
    const selected = works.filter(work => work.creator === creator).slice(0, 5).reverse();
    if (selected.length < 5) {
      toast('同じ作者の4コマが5本たまると第1巻を作れます');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) {
      toast('作品集を開けませんでした。ポップアップを許可してください。');
      return;
    }
    win.document.open();
    win.document.write(volumeHtml(creator, selected));
    win.document.close();
  }

  const openLibraryV06 = openLibrary;
  openLibrary = async function () {
    await openLibraryV06();
    try {
      const works = await getWorks();
      const creator = (state.creator || els.creatorName.value || '').trim();
      if (!creator) return;
      const ownWorks = works.filter(work => work.creator === creator);
      const area = q('.volume-progress');
      if (!area) return;
      let button = q('#makeVolumeBtn', area);
      if (!button) {
        button = document.createElement('button');
        button.id = 'makeVolumeBtn';
        button.className = 'primary-btn compact volume-maker';
        area.appendChild(button);
      }
      if (ownWorks.length >= 5) {
        button.disabled = false;
        button.textContent = '📕 第1巻を作る・印刷/PDF';
        button.onclick = () => openVolume(creator, ownWorks);
      } else {
        button.disabled = true;
        button.textContent = `📕 第1巻まで あと${5 - ownWorks.length}本`;
      }
    } catch (error) {
      console.warn('作品集ボタンの準備に失敗', error);
    }
  };
  els.libraryBtn.onclick = openLibrary;

  if (state.images.some(Boolean)) {
    void saveDraftImages(true).then(() => saveState()).catch(error => console.warn(error));
  } else {
    void restoreDraftImages();
  }
})();