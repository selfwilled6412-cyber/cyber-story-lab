(() => {
  const ASSET_DB = 'cyberStoryLabAiRedrawAssets';
  const ASSET_STORE = 'assets';
  const ASSET_VERSION = 1;
  let redrawEnabled = false;
  let redrawPinRequired = true;
  let assets = { characterRough: null, characterReference: null };

  state.characterBrief ||= state.hero || '';
  state.visualStyle ||= 'picturebook';
  state.redrawNotes = Array.isArray(state.redrawNotes) ? state.redrawNotes.slice(0, 4) : ['', '', '', ''];
  state.redrawGenerated = Array.isArray(state.redrawGenerated) ? state.redrawGenerated.slice(0, 4) : [false, false, false, false];
  while (state.redrawNotes.length < 4) state.redrawNotes.push('');
  while (state.redrawGenerated.length < 4) state.redrawGenerated.push(false);

  titles[5] = ['ラフを描こう', '完成絵を描く必要はありません。丸・線・矢印・メモで、AIへ「こうしてほしい」を伝える設計図を作ります。'];
  titles[6] = ['ラフから絵本イラストへ', 'ラフを補正するのではなく、構図と発想を参考にAIが一から絵本イラストとして描き直します。'];

  function creatorAssetKey() {
    const creator = String(state.creator || els.creatorName.value || 'anonymous').trim() || 'anonymous';
    return `creator:${creator.slice(0, 80)}`;
  }

  function openAssetDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(ASSET_DB, ASSET_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadAssets() {
    const db = await openAssetDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readonly');
      const req = tx.objectStore(ASSET_STORE).get(creatorAssetKey());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    assets = row ? { characterRough: row.characterRough || null, characterReference: row.characterReference || null } : { characterRough: null, characterReference: null };
    return assets;
  }

  async function saveAssets() {
    const db = await openAssetDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).put({ id: creatorAssetKey(), ...assets, updatedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function clearAssets() {
    const db = await openAssetDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).delete(creatorAssetKey());
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    assets = { characterRough: null, characterReference: null };
  }

  async function checkRedrawAvailability() {
    if (location.protocol === 'file:') return;
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json();
      redrawEnabled = Boolean(data.reillustrationEnabled);
      redrawPinRequired = data.pinRequired !== false;
    } catch (error) {
      console.warn('AI再作画の状態確認に失敗', error);
      redrawEnabled = false;
    }
  }

  function styleLabel(value = state.visualStyle) {
    return {
      picturebook: 'やさしい絵本イラスト',
      watercolor: '水彩絵本',
      pop: '明るいポップ絵本',
      crayon: 'クレヨン・色鉛筆風'
    }[value] || 'やさしい絵本イラスト';
  }

  function getPin() {
    return sessionStorage.getItem('cyberStoryLabAiPin') || '';
  }

  async function callReillustrate(payload, retry = true) {
    const headers = { 'Content-Type': 'application/json' };
    const pin = getPin();
    if (pin) headers['x-ai-pin'] = pin;
    const response = await fetch('/api/reillustrate', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && retry) {
      const entered = prompt('AI再作画はスタッフ用です。スタッフPINを入力してください。');
      if (!entered) throw new Error('スタッフPINが必要です');
      sessionStorage.setItem('cyberStoryLabAiPin', entered);
      return callReillustrate(payload, false);
    }
    if (!response.ok) {
      if (data.code === 'FREE_MODE') throw new Error('運用側の画像AIがまだ接続されていません');
      if (data.code === 'PIN_REQUIRED' || data.code === 'PIN_NOT_CONFIGURED') throw new Error('スタッフPINの設定を確認してください');
      throw new Error(data.error || 'AI再作画に失敗しました');
    }
    return data;
  }

  async function makeCharacterReference() {
    state.characterBrief = q('#characterBrief')?.value.trim() || state.hero || '';
    saveState();
    if (!redrawEnabled) {
      toast('AI再作画は運用側のAI接続後に使えます。ラフ作成は今のまま進められます。');
      return;
    }
    showBusy('主人公の見本を作成中', 'ラフと設定を参考に、後の4ページで同じ姿を保つための見本を作っています。');
    try {
      const data = await callReillustrate({
        mode: 'character',
        roughImageDataUrl: assets.characterRough,
        hero: state.hero,
        characterBrief: state.characterBrief,
        visualStyle: state.visualStyle
      });
      assets.characterReference = data.imageDataUrl;
      await saveAssets();
      render();
      toast('主人公の見本ができました');
    } catch (error) {
      console.error(error);
      toast(error.message);
    } finally { hideBusy(); }
  }

  async function redrawPanel(index) {
    if (!state.images[index]) { toast(`${index + 1}コマ目のラフを先に登録してください`); return; }
    if (!redrawEnabled) { toast('AI再作画は運用側のAI接続後に使えます'); return; }
    state.redrawNotes[index] = q(`[data-redraw-note="${index}"]`)?.value.trim() || state.redrawNotes[index] || '';
    saveState();
    showBusy(`${index + 1}コマ目を一から再作画中`, 'ラフは設計図として使い、作者の構図・変な形・位置関係を残して絵本イラストへ描き直します。');
    try {
      const data = await callReillustrate({
        mode: 'panel',
        roughImageDataUrl: state.images[index],
        characterReferenceDataUrl: assets.characterReference || assets.characterRough || null,
        hero: state.hero,
        characterBrief: state.characterBrief || state.hero,
        story: state.story[index],
        drawGuide: state.drawGuides[index] || '',
        correctionNote: state.redrawNotes[index] || '',
        visualStyle: state.visualStyle,
        panelIndex: index
      });
      state.processedImages[index] = data.imageDataUrl;
      state.redrawGenerated[index] = true;
      saveState();
      render();
      toast(`${index + 1}コマ目を絵本イラストにしました`);
    } catch (error) {
      console.error(error);
      toast(error.message);
    } finally { hideBusy(); }
  }

  async function redrawAll() {
    if (state.images.some(image => !image)) { toast('ラフ4枚をすべて登録してから使えます'); return; }
    if (!redrawEnabled) { toast('AI再作画は運用側のAI接続後に使えます'); return; }
    for (let i = 0; i < 4; i++) {
      await redrawPanel(i);
    }
  }

  renderStep5 = function () {
    state.characterBrief ||= state.hero || '';
    els.stepContent.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'redraw-step redraw-step5';
    wrap.innerHTML = `
      <div class="redraw-principle">
        <strong>ラフは「完成絵」ではなく設計図</strong>
        <span>丸・棒人間・矢印・「ここに月」などのメモでOK。上手に描く必要はありません。</span>
      </div>
      <section class="character-lock-card">
        <div class="redraw-section-head"><div><small>CHARACTER LOCK</small><h3>主人公を同じ姿で出す準備</h3></div><span class="redraw-status ${redrawEnabled ? 'ready' : ''}">${redrawEnabled ? 'AI再作画 READY' : 'AI接続待ち'}</span></div>
        <p>4ページで主人公の顔や色が変わりにくいように、特徴を短く決めます。主人公ラフは任意です。</p>
        <label class="redraw-field"><span>主人公の特徴</span><textarea id="characterBrief" rows="3" placeholder="例：青い丸い体、目が3つ、黄色い帽子、足が1本">${escapeHtml(state.characterBrief || state.hero || '')}</textarea></label>
        <div class="style-picker" role="group" aria-label="絵本の仕上げ方">
          ${[
            ['picturebook','やさしい絵本'],['watercolor','水彩'],['pop','ポップ'],['crayon','クレヨン風']
          ].map(([value,label]) => `<button type="button" class="mode ${state.visualStyle === value ? 'active' : ''}" data-redraw-style="${value}">${label}</button>`).join('')}
        </div>
        <div class="character-rough-grid">
          <label class="character-upload">
            <input type="file" id="characterRoughInput" accept="image/*" capture="environment">
            ${assets.characterRough ? `<img src="${assets.characterRough}" alt="主人公ラフ"><b>主人公ラフを変更</b>` : '<div><b>＋ 主人公ラフ（任意）</b><span>顔や形だけでもOK</span></div>'}
          </label>
          <div class="character-result">
            ${assets.characterReference ? `<img src="${assets.characterReference}" alt="AIが作った主人公見本"><b>AI主人公見本</b>` : '<div><b>AI主人公見本</b><span>AI接続後にここへ表示</span></div>'}
          </div>
        </div>
        <div class="redraw-actions"><button type="button" class="primary-btn" id="makeCharacterRefBtn" ${redrawEnabled ? '' : 'disabled'}>✨ 主人公の見本を一から作る</button><small>${redrawEnabled ? 'この見本を4コマ共通の参考画像として使います。' : '運用側のAI契約・スタッフPIN設定後に有効になります。'}</small></div>
      </section>
      <section class="rough-guide-section">
        <div class="redraw-section-head"><div><small>ROUGH × 4</small><h3>A4にラフを4枚描こう</h3></div><span>1枚 1〜3分でOK</span></div>
        <div class="rough-guide-grid" id="roughGuideGrid"></div>
      </section>`;
    els.stepContent.appendChild(wrap);

    const grid = q('#roughGuideGrid');
    state.story.forEach((text, i) => {
      const card = document.createElement('article');
      card.className = 'rough-guide-card';
      card.innerHTML = `<span>${i + 1}コマ目</span><h4>${escapeHtml(text)}</h4><p>${escapeHtml(state.drawGuides[i] || localDrawingInstruction(i))}</p><div>○ 主役の位置　→ 動き　□ 背景の場所　文字メモもOK</div>`;
      grid.appendChild(card);
    });

    q('#characterBrief').oninput = e => { state.characterBrief = e.target.value; saveState(); };
    qa('[data-redraw-style]').forEach(button => button.onclick = () => { state.visualStyle = button.dataset.redrawStyle; saveState(); render(); });
    q('#characterRoughInput').onchange = async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      showBusy('主人公ラフを取り込み中', 'ラフを軽量化して、この端末に保存します。');
      try {
        assets.characterRough = await normalizeUpload(file);
        assets.characterReference = null;
        await saveAssets();
        render();
      } finally { hideBusy(); }
    };
    q('#makeCharacterRefBtn').onclick = makeCharacterReference;
  };

  renderStep6 = function () {
    els.stepContent.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'redraw-step redraw-step6';
    wrap.innerHTML = `
      <div class="redraw-principle">
        <strong>AIは「補正」ではなく一から描き直します</strong>
        <span>左のラフを設計図として、右に新しい絵本イラストを作ります。作者の変な形や構図を勝手に普通へ直さない設定です。</span>
      </div>
      <div class="redraw-toolbar">
        <div><span class="redraw-status ${redrawEnabled ? 'ready' : ''}">${redrawEnabled ? 'AI再作画 READY' : 'FREE MODE / AI未接続'}</span><small>仕上げ：${escapeHtml(styleLabel())}</small></div>
        <button type="button" class="primary-btn" id="redrawAllBtn" ${redrawEnabled ? '' : 'disabled'}>✨ 4コマ全部をAI再作画</button>
      </div>
      <div class="redraw-panel-grid" id="redrawPanelGrid"></div>`;
    els.stepContent.appendChild(wrap);
    const grid = q('#redrawPanelGrid');

    for (let i = 0; i < 4; i++) {
      const rough = state.images[i];
      const finalImage = state.redrawGenerated[i] ? state.processedImages[i] : null;
      const card = document.createElement('article');
      card.className = 'redraw-panel-card';
      card.innerHTML = `
        <div class="redraw-panel-head"><span>${i + 1}コマ目</span><strong>${escapeHtml(state.story[i])}</strong></div>
        <div class="before-after">
          <label class="redraw-image-box rough-box">
            <span>あなたのラフ</span>
            <input type="file" accept="image/*" capture="environment" data-rough-upload="${i}">
            ${rough ? `<img src="${rough}" alt="${i + 1}コマ目のラフ"><b>ラフを撮り直す</b>` : '<div><b>＋ ラフを撮影 / 選択</b><small>A4全体が入ればOK</small></div>'}
          </label>
          <div class="redraw-arrow">→</div>
          <div class="redraw-image-box final-box">
            <span>AIが一から描いた絵</span>
            ${finalImage ? `<img src="${finalImage}" alt="${i + 1}コマ目のAI再作画"><b>完成イラスト</b>` : `<div><b>${redrawEnabled ? 'AI再作画前' : 'AI接続後に生成'}</b><small>ラフの構図を参考に新しく描きます</small></div>`}
          </div>
        </div>
        <label class="redraw-field"><span>違うところがあれば一言</span><input type="text" data-redraw-note="${i}" value="${escapeHtml(state.redrawNotes[i] || '')}" placeholder="例：帽子を黄色に戻して / 月をもっと左へ"></label>
        <div class="redraw-card-actions">
          <button type="button" class="primary-btn compact" data-redraw-panel="${i}" ${redrawEnabled && rough ? '' : 'disabled'}>${finalImage ? '↻ 指示を反映してもう一度' : '✨ AIが一から描き直す'}</button>
          <button type="button" class="ghost-btn compact" data-use-rough="${i}" ${rough ? '' : 'disabled'}>ラフのまま完成へ使う</button>
        </div>`;
      grid.appendChild(card);
    }

    qa('[data-rough-upload]').forEach(input => input.onchange = async event => {
      const index = Number(input.dataset.roughUpload);
      const file = event.target.files?.[0];
      if (!file) return;
      showBusy(`${index + 1}コマ目のラフを取り込み中`, 'ラフを軽量化して、この端末に途中保存します。');
      try {
        state.images[index] = await normalizeUpload(file);
        state.processedImages[index] = state.images[index];
        state.redrawGenerated[index] = false;
        saveState();
        render();
      } finally { hideBusy(); }
    });
    qa('[data-redraw-note]').forEach(input => input.oninput = () => { state.redrawNotes[Number(input.dataset.redrawNote)] = input.value; saveState(); });
    qa('[data-redraw-panel]').forEach(button => button.onclick = () => redrawPanel(Number(button.dataset.redrawPanel)));
    qa('[data-use-rough]').forEach(button => button.onclick = () => {
      const index = Number(button.dataset.useRough);
      state.processedImages[index] = state.images[index];
      state.redrawGenerated[index] = false;
      saveState();
      render();
      toast('このコマはラフのまま使います');
    });
    q('#redrawAllBtn').onclick = redrawAll;
  };

  const renderStep7BeforeRedraw = renderStep7;
  renderStep7 = function () {
    renderStep7BeforeRedraw();
    const generatedCount = state.redrawGenerated.filter(Boolean).length;
    const heading = q('#finishHeading');
    if (heading && generatedCount) heading.textContent = `${state.creator ? state.creator + 'さんの' : ''}ラフから生まれたデジタル絵本が完成しました！`;
    const sheet = q('#comicSheet');
    if (sheet && generatedCount) {
      const badge = document.createElement('div');
      badge.className = 'redraw-finish-badge';
      badge.textContent = `ROUGH → AI RE-ILLUSTRATION ${generatedCount}/4`;
      sheet.prepend(badge);
    }
    const newStory = q('#newStoryBtn');
    if (newStory) {
      const old = newStory.onclick;
      newStory.onclick = async () => {
        try { await clearAssets(); } catch (error) { console.warn(error); }
        state.characterBrief = '';
        state.redrawNotes = ['', '', '', ''];
        state.redrawGenerated = [false, false, false, false];
        old?.();
      };
    }
  };

  const loadWorkBeforeRedraw = loadWork;
  loadWork = async function (work) {
    state.characterBrief = work?.hero || '';
    state.redrawNotes = ['', '', '', ''];
    state.redrawGenerated = (work?.processedImages || []).map((value, i) => Boolean(value && value !== work?.images?.[i]));
    while (state.redrawGenerated.length < 4) state.redrawGenerated.push(false);
    await loadAssets().catch(() => {});
    return loadWorkBeforeRedraw(work);
  };

  const validateBeforeRedraw = validateCurrent;
  validateCurrent = function () {
    const base = validateBeforeRedraw();
    if (base) return base;
    if (state.step === 5 && !state.characterBrief?.trim()) state.characterBrief = state.hero || '';
    return null;
  };

  void (async () => {
    await Promise.allSettled([checkRedrawAvailability(), loadAssets()]);
    if (state.step === 5 || state.step === 6 || state.step === 7) render();
  })();
})();
