(() => {
  const BACKUP_FORMAT = 'cyber-story-lab-backup-v1';

  function backupFileName() {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `cyber-story-lab-backup-${stamp}.json`;
  }

  function validWork(work) {
    return work && typeof work === 'object' && typeof work.id === 'string' && Array.isArray(work.story);
  }

  async function exportAllWorks() {
    let works;
    try { works = await getWorks(); } catch (error) {
      console.error(error);
      toast('作品棚を読み込めませんでした');
      return;
    }
    if (!works.length) {
      toast('バックアップする作品がまだありません');
      return;
    }

    const payload = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      workCount: works.length,
      works
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`${works.length}作品をバックアップしました`);
  }

  async function importBackupFile(file) {
    if (!file) return;
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (error) {
      console.warn(error);
      alert('バックアップファイルを読み込めませんでした。JSON形式のファイルを選んでください。');
      return;
    }

    if (payload?.format !== BACKUP_FORMAT || !Array.isArray(payload.works)) {
      alert('CYBER STORY LABのバックアップファイルではありません。');
      return;
    }

    const works = payload.works.filter(validWork);
    if (!works.length) {
      alert('読み込める作品がありませんでした。');
      return;
    }

    const ok = confirm(`${works.length}作品をこの端末の作品棚へ読み込みます。\n同じ作品IDがある場合はバックアップ側の内容で更新します。`);
    if (!ok) return;

    showBusy('バックアップを読み込み中', `${works.length}作品をこの端末へ戻しています。外部送信はありません。`);
    try {
      for (const work of works) {
        const now = Date.now();
        const normalized = {
          ...work,
          creator: String(work.creator || '匿名').slice(0, 80),
          theme: String(work.theme || '無題').slice(0, 200),
          hero: String(work.hero || '').slice(0, 500),
          story: Array.isArray(work.story) ? work.story.slice(0, 4).map(v => String(v || '').slice(0, 4000)) : ['', '', '', ''],
          drawGuides: Array.isArray(work.drawGuides) ? work.drawGuides.slice(0, 4).map(v => String(v || '').slice(0, 4000)) : ['', '', '', ''],
          images: Array.isArray(work.images) ? work.images.slice(0, 4) : [null, null, null, null],
          processedImages: Array.isArray(work.processedImages) ? work.processedImages.slice(0, 4) : [null, null, null, null],
          layout: work.layout === 'vertical' ? 'vertical' : 'grid',
          createdAt: Number(work.createdAt) || now,
          updatedAt: Number(work.updatedAt) || now
        };
        while (normalized.story.length < 4) normalized.story.push('');
        while (normalized.drawGuides.length < 4) normalized.drawGuides.push('');
        while (normalized.images.length < 4) normalized.images.push(null);
        while (normalized.processedImages.length < 4) normalized.processedImages.push(null);
        await saveWorkRecord(normalized);
      }
      toast(`${works.length}作品を復元しました`);
      await openLibrary();
    } catch (error) {
      console.error(error);
      alert('バックアップの読み込み途中でエラーが起きました。空き容量を確認してください。');
    } finally {
      hideBusy();
    }
  }

  function addCreatorFilter(works) {
    const grid = q('#libraryGrid');
    if (!grid) return;
    const cards = qa('.library-card', grid);
    cards.forEach((card, index) => { card.dataset.creator = works[index]?.creator || ''; });

    const creators = [...new Set(works.map(work => work.creator || '匿名'))].sort((a, b) => a.localeCompare(b, 'ja'));
    if (creators.length < 2) return;

    const select = document.createElement('select');
    select.className = 'backup-creator-filter';
    select.setAttribute('aria-label', '作者で作品を絞り込む');
    select.innerHTML = `<option value="">すべての作者（${works.length}作品）</option>${creators.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
    const current = (state.creator || els.creatorName.value || '').trim();
    if (creators.includes(current)) select.value = current;
    select.onchange = () => {
      const target = select.value;
      cards.forEach(card => { card.hidden = Boolean(target) && card.dataset.creator !== target; });
    };
    select.dispatchEvent(new Event('change'));
    return select;
  }

  async function injectBackupTools() {
    const modal = q('#libraryModal');
    const panel = modal?.querySelector('.library-panel');
    const grid = q('#libraryGrid');
    if (!panel || !grid) return;

    const works = await getWorks();
    q('#backupTools')?.remove();
    const area = document.createElement('section');
    area.id = 'backupTools';
    area.className = 'backup-tools';
    area.innerHTML = `
      <div class="backup-tools-copy">
        <strong>作品を守るバックアップ</strong>
        <span>作品棚はこの端末のブラウザ内に保存されています。定期的にファイル保存すると安心です。</span>
      </div>
      <div class="backup-tools-actions">
        <button type="button" class="ghost-btn" id="exportWorksBtn">💾 全作品を保存</button>
        <button type="button" class="ghost-btn" id="importWorksBtn">📂 バックアップを戻す</button>
        <input type="file" id="importWorksInput" accept="application/json,.json" hidden>
      </div>
      <div class="backup-filter-slot"></div>`;
    panel.insertBefore(area, grid);

    q('#exportWorksBtn').onclick = exportAllWorks;
    const input = q('#importWorksInput');
    q('#importWorksBtn').onclick = () => input.click();
    input.onchange = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      await importBackupFile(file);
    };

    const filter = addCreatorFilter(works);
    if (filter) area.querySelector('.backup-filter-slot').appendChild(filter);
  }

  const openLibraryBeforeBackup = openLibrary;
  openLibrary = async function () {
    await openLibraryBeforeBackup();
    try { await injectBackupTools(); } catch (error) { console.warn('バックアップUI準備失敗', error); }
  };
  els.libraryBtn.onclick = openLibrary;
})();
