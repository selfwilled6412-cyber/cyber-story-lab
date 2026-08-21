(() => {
  const DB_NAME = 'cyberStoryLabUserDraftSlots';
  const DB_VERSION = 1;
  const STORE = 'drafts';

  function normalizeCreator(value) {
    return String(value || '').normalize('NFKC').trim();
  }

  function draftId(creator) {
    return `creator:${normalizeCreator(creator).toLocaleLowerCase('ja-JP')}`;
  }

  function openDraftSlotDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function putDraft(record) {
    const db = await openDraftSlotDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function getDrafts() {
    const db = await openDraftSlotDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  async function deleteDraft(id) {
    const db = await openDraftSlotDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  function snapshotDraft(creator) {
    const now = Date.now();
    return {
      id: draftId(creator),
      creator,
      step: Number(state.step) || 1,
      theme: String(state.theme || ''),
      hero: String(state.hero || ''),
      story: Array.isArray(state.story) ? state.story.slice(0, 4) : ['', '', '', ''],
      storyIndex: Number(state.storyIndex) || 0,
      drawGuides: Array.isArray(state.drawGuides) ? state.drawGuides.slice(0, 4) : ['', '', '', ''],
      images: Array.isArray(state.images) ? state.images.slice(0, 4) : [null, null, null, null],
      processedImages: Array.isArray(state.processedImages) ? state.processedImages.slice(0, 4) : [null, null, null, null],
      imageMode: state.imageMode || 'original',
      layout: state.layout || 'grid',
      workId: state.workId || null,
      createdAt: state.createdAt || now,
      updatedAt: now
    };
  }

  async function saveUserDraft({ quiet = false } = {}) {
    const creator = normalizeCreator(els.creatorName.value || state.creator);
    if (!creator) {
      if (!quiet) toast('作者名を入れると、利用者ごとの途中保存ができます');
      return false;
    }
    state.creator = creator;
    try {
      await putDraft(snapshotDraft(creator));
      await updateDraftButton();
      if (!quiet) toast(`${creator}さんの制作途中を保存しました`);
      return true;
    } catch (error) {
      console.error(error);
      if (!quiet) alert('利用者別の途中保存に失敗しました。端末の空き容量を確認してください。');
      return false;
    }
  }

  function hasCurrentContent() {
    return Boolean(
      state.theme?.trim() || state.hero?.trim() || state.story?.some?.(v => String(v || '').trim()) || state.images?.some?.(Boolean)
    );
  }

  async function restoreDraft(record) {
    if (!record) return;
    const currentCreator = normalizeCreator(els.creatorName.value || state.creator);
    if (hasCurrentContent() && currentCreator && currentCreator !== record.creator) {
      const ok = confirm(`現在の${currentCreator}さんの画面から、${record.creator}さんの制作途中へ切り替えます。\n必要なら先に「途中保存」を押してください。`);
      if (!ok) return;
    }

    Object.assign(state, {
      step: Math.min(7, Math.max(1, Number(record.step) || 1)),
      creator: record.creator || '',
      theme: record.theme || '',
      hero: record.hero || '',
      story: Array.isArray(record.story) ? record.story.slice(0, 4) : ['', '', '', ''],
      storyIndex: Math.min(3, Math.max(0, Number(record.storyIndex) || 0)),
      drawGuides: Array.isArray(record.drawGuides) ? record.drawGuides.slice(0, 4) : ['', '', '', ''],
      images: Array.isArray(record.images) ? record.images.slice(0, 4) : [null, null, null, null],
      processedImages: Array.isArray(record.processedImages) ? record.processedImages.slice(0, 4) : [null, null, null, null],
      imageMode: record.imageMode || 'original',
      layout: record.layout || 'grid',
      workId: record.workId || null,
      createdAt: record.createdAt || null
    });
    while (state.story.length < 4) state.story.push('');
    while (state.drawGuides.length < 4) state.drawGuides.push('');
    while (state.images.length < 4) state.images.push(null);
    while (state.processedImages.length < 4) state.processedImages.push(null);

    els.creatorName.value = state.creator;
    saveState();
    q('#draftSlotsModal')?.classList.add('hidden');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(`${state.creator}さんの制作途中を再開しました`);
  }

  function stepLabel(step) {
    return ({ 1: 'お題', 2: '主役', 3: '4コマの話', 4: '文章確認', 5: '絵を描く', 6: '原画取込', 7: '完成' })[step] || '制作途中';
  }

  function ensureDraftModal() {
    let modal = q('#draftSlotsModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'draftSlotsModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <section class="draft-slots-panel glass" role="dialog" aria-modal="true" aria-labelledby="draftSlotsTitle">
        <header class="draft-slots-head">
          <div><span>CREATOR DRAFTS</span><h3 id="draftSlotsTitle">制作途中から再開</h3></div>
          <button class="ghost-btn" id="closeDraftSlotsBtn">閉じる</button>
        </header>
        <p class="draft-slots-note">作者名ごとに1つの制作途中データを保存できます。同じPCを複数人で使う時に利用してください。</p>
        <div id="draftSlotsGrid" class="draft-slots-grid"></div>
      </section>`;
    document.body.appendChild(modal);
    q('#closeDraftSlotsBtn', modal).onclick = () => modal.classList.add('hidden');
    modal.onclick = event => { if (event.target === modal) modal.classList.add('hidden'); };
    return modal;
  }

  async function openDraftSlots() {
    const modal = ensureDraftModal();
    const grid = q('#draftSlotsGrid', modal);
    grid.innerHTML = '<div class="draft-empty">読み込み中...</div>';
    modal.classList.remove('hidden');
    try {
      const drafts = await getDrafts();
      grid.innerHTML = '';
      if (!drafts.length) {
        grid.innerHTML = '<div class="draft-empty">まだ利用者別の途中保存はありません。<br>作者名を入れて「途中保存」を押すと、ここから再開できます。</div>';
        return;
      }
      drafts.forEach(record => {
        const card = document.createElement('article');
        card.className = 'draft-slot-card';
        card.innerHTML = `
          <div class="draft-slot-main">
            <span>STEP ${String(record.step || 1).padStart(2, '0')} / ${escapeHtml(stepLabel(record.step))}</span>
            <h4>${escapeHtml(record.creator || '匿名')}</h4>
            <p>${escapeHtml(record.theme || 'お題はまだ未入力')}</p>
            <small>最終保存：${new Date(record.updatedAt || Date.now()).toLocaleString('ja-JP')}</small>
          </div>
          <div class="draft-slot-actions">
            <button class="primary-btn compact" data-resume="${escapeHtml(record.id)}">再開する</button>
            <button class="tiny-btn danger" data-remove="${escapeHtml(record.id)}">削除</button>
          </div>`;
        grid.appendChild(card);
      });
      qa('[data-resume]', grid).forEach(button => {
        button.onclick = () => restoreDraft(drafts.find(row => row.id === button.dataset.resume));
      });
      qa('[data-remove]', grid).forEach(button => {
        button.onclick = async () => {
          const record = drafts.find(row => row.id === button.dataset.remove);
          if (!record || !confirm(`${record.creator}さんの制作途中データを削除しますか？\n完成作品の作品棚データは削除されません。`)) return;
          await deleteDraft(record.id);
          await updateDraftButton();
          await openDraftSlots();
        };
      });
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="draft-empty">制作途中データを読み込めませんでした。</div>';
    }
  }

  async function updateDraftButton() {
    let button = q('#draftSlotsBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'draftSlotsBtn';
      button.className = 'ghost-btn draft-slots-btn';
      button.onclick = openDraftSlots;
      const actions = q('.top-actions');
      if (actions) actions.insertBefore(button, q('#libraryBtn'));
    }
    try {
      const drafts = await getDrafts();
      button.textContent = drafts.length ? `制作途中 ${drafts.length}` : '制作途中';
    } catch {
      button.textContent = '制作途中';
    }
  }

  const saveButtonBeforeSlots = els.saveBtn.onclick;
  els.saveBtn.onclick = async () => {
    saveButtonBeforeSlots?.();
    await saveUserDraft();
  };

  const renderStep7BeforeSlots = renderStep7;
  renderStep7 = function () {
    renderStep7BeforeSlots();
    const button = q('#newStoryBtn');
    if (!button) return;
    const oldHandler = button.onclick;
    button.onclick = async () => {
      const creator = normalizeCreator(state.creator || els.creatorName.value);
      if (creator) {
        try { await deleteDraft(draftId(creator)); } catch (error) { console.warn(error); }
      }
      await updateDraftButton();
      oldHandler?.();
    };
  };

  void updateDraftButton();
})();
