(() => {
  const book = { pages: [], index: 0, title: '', touchX: null };

  function safeImage(value) {
    return typeof value === 'string' && /^data:image\/(png|jpe?g|webp);base64,/i.test(value) ? value : '';
  }

  function ensureBookModal() {
    let modal = document.querySelector('#digitalBookModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'digitalBookModal';
    modal.className = 'digital-book-modal hidden';
    modal.innerHTML = `
      <div class="db-shell" role="dialog" aria-modal="true" aria-label="デジタル絵本">
        <header class="db-topbar">
          <div><span class="db-kicker">CYBER STORY LAB // DIGITAL BOOK</span><strong id="dbBookTitle">デジタル絵本</strong></div>
          <div class="db-top-actions">
            <span id="dbCounter">1 / 1</span>
            <button type="button" class="db-icon" id="dbFullscreenBtn">全画面</button>
            <button type="button" class="db-icon" id="dbCloseBtn">閉じる ×</button>
          </div>
        </header>
        <main class="db-stage">
          <button type="button" class="db-arrow db-prev" id="dbPrevBtn" aria-label="前のページ">‹</button>
          <article class="db-page" id="dbPage"><div class="db-page-inner" id="dbPageInner"></div></article>
          <button type="button" class="db-arrow db-next" id="dbNextBtn" aria-label="次のページ">›</button>
        </main>
        <footer class="db-footer">
          <div class="db-progress"><i id="dbProgress"></i></div>
          <span>← → キー / 画面スワイプでもページをめくれます</span>
        </footer>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#dbCloseBtn').onclick = closeBook;
    modal.querySelector('#dbPrevBtn').onclick = () => moveBook(-1);
    modal.querySelector('#dbNextBtn').onclick = () => moveBook(1);
    modal.querySelector('#dbFullscreenBtn').onclick = async () => {
      const shell = modal.querySelector('.db-shell');
      try {
        if (!document.fullscreenElement) await shell.requestFullscreen?.();
        else await document.exitFullscreen?.();
      } catch (error) { console.warn(error); }
    };
    modal.addEventListener('click', event => { if (event.target === modal) closeBook(); });
    const stage = modal.querySelector('.db-stage');
    stage.addEventListener('touchstart', event => { book.touchX = event.changedTouches?.[0]?.clientX ?? null; }, { passive: true });
    stage.addEventListener('touchend', event => {
      if (book.touchX == null) return;
      const endX = event.changedTouches?.[0]?.clientX ?? book.touchX;
      const diff = endX - book.touchX;
      book.touchX = null;
      if (Math.abs(diff) > 48) moveBook(diff > 0 ? -1 : 1);
    }, { passive: true });
    return modal;
  }

  function makeCover(work, subtitle = '4コマから生まれたデジタル絵本') {
    const coverImage = safeImage(work.processedImages?.[0] || work.images?.[0]);
    return {
      kind: 'cover',
      html: `<section class="db-cover ${coverImage ? 'has-image' : ''}">
        ${coverImage ? `<div class="db-cover-art"><img src="${coverImage}" alt="表紙の原画"></div>` : '<div class="db-cover-mark">✦</div>'}
        <div class="db-cover-copy"><span>${escapeHtml(subtitle)}</span><h1>${escapeHtml(work.theme || '無題')}</h1><p>${escapeHtml(work.creator || '作者')}</p></div>
      </section>`
    };
  }

  function makeStoryPage(work, index, storyNumber = null) {
    const image = safeImage(work.processedImages?.[index] || work.images?.[index]);
    const label = storyNumber ? `STORY ${String(storyNumber).padStart(2, '0')} • ${index + 1} / 4` : `${index + 1} / 4`;
    return {
      kind: 'story',
      html: `<section class="db-story-page">
        <div class="db-story-meta"><span>${label}</span><b>${escapeHtml(work.theme || '無題')}</b></div>
        <div class="db-story-art">${image ? `<img src="${image}" alt="${index + 1}ページ目の原画">` : '<div class="db-no-art">原画がまだありません</div>'}</div>
        <div class="db-story-text"><p>${escapeHtml(work.story?.[index] || '')}</p></div>
      </section>`
    };
  }

  function makeDivider(work, number) {
    const image = safeImage(work.processedImages?.[0] || work.images?.[0]);
    return {
      kind: 'divider',
      html: `<section class="db-divider">
        <span>STORY ${String(number).padStart(2, '0')}</span>
        <h1>${escapeHtml(work.theme || '無題')}</h1>
        ${image ? `<img src="${image}" alt="${escapeHtml(work.theme || '作品')}の原画">` : ''}
        <p>主役：${escapeHtml(work.hero || '自由な主役')}</p>
      </section>`
    };
  }

  function makeEnd(creator, count = 1) {
    return {
      kind: 'end',
      html: `<section class="db-end"><div class="db-end-star">✦</div><h1>おしまい</h1><p>${escapeHtml(creator || '作者')}さんの作品</p><span>${count > 1 ? `${count}つのお話を収録` : 'あなたの発想と原画から生まれたデジタル絵本'}</span></section>`
    };
  }

  function openSingleBook(work) {
    if (!work) return;
    book.title = work.theme || 'デジタル絵本';
    book.pages = [makeCover(work), ...[0,1,2,3].map(i => makeStoryPage(work, i)), makeEnd(work.creator, 1)];
    book.index = 0;
    openBook();
  }

  function openVolumeBook(creator, works) {
    const selected = works.filter(work => (work.creator || '匿名') === creator).slice(0, 5).reverse();
    if (selected.length < 5) {
      toast('同じ作者の作品が5本たまると、第1巻のデジタル絵本を作れます');
      return;
    }
    const coverSeed = { ...selected[0], theme: `${creator}さんのデジタル絵本 第1巻`, creator };
    const pages = [makeCover(coverSeed, 'DIGITAL PICTURE BOOK • VOLUME 01')];
    selected.forEach((work, index) => {
      pages.push(makeDivider(work, index + 1));
      [0,1,2,3].forEach(i => pages.push(makeStoryPage(work, i, index + 1)));
    });
    pages.push(makeEnd(creator, selected.length));
    book.title = `${creator}さんのデジタル絵本 第1巻`;
    book.pages = pages;
    book.index = 0;
    openBook();
  }

  function openBook() {
    const modal = ensureBookModal();
    modal.classList.remove('hidden');
    document.body.classList.add('db-open');
    renderBookPage(0);
  }

  function closeBook() {
    const modal = document.querySelector('#digitalBookModal');
    modal?.classList.add('hidden');
    document.body.classList.remove('db-open');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  function moveBook(delta) {
    const next = Math.max(0, Math.min(book.pages.length - 1, book.index + delta));
    if (next === book.index) return;
    const page = document.querySelector('#dbPage');
    page?.classList.add(delta > 0 ? 'turn-next' : 'turn-prev');
    setTimeout(() => {
      book.index = next;
      renderBookPage(delta);
      page?.classList.remove('turn-next', 'turn-prev');
    }, 120);
  }

  function renderBookPage(direction = 0) {
    const modal = ensureBookModal();
    const page = book.pages[book.index];
    modal.querySelector('#dbBookTitle').textContent = book.title;
    modal.querySelector('#dbCounter').textContent = `${book.index + 1} / ${book.pages.length}`;
    modal.querySelector('#dbProgress').style.width = `${((book.index + 1) / book.pages.length) * 100}%`;
    modal.querySelector('#dbPrevBtn').disabled = book.index === 0;
    modal.querySelector('#dbNextBtn').disabled = book.index === book.pages.length - 1;
    const inner = modal.querySelector('#dbPageInner');
    inner.innerHTML = page?.html || '';
    inner.dataset.kind = page?.kind || '';
    if (direction) {
      inner.animate?.([
        { opacity: 0, transform: `translateX(${direction > 0 ? '22px' : '-22px'}) scale(.99)` },
        { opacity: 1, transform: 'translateX(0) scale(1)' }
      ], { duration: 260, easing: 'ease-out' });
    }
  }

  async function injectBookButtons() {
    const grid = q('#libraryGrid');
    if (!grid) return;
    const works = await getWorks();
    const cards = qa('.library-card', grid);
    cards.forEach((card, index) => {
      const work = works[index];
      if (!work || card.querySelector('.digital-book-read')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary-btn compact digital-book-read';
      button.textContent = '📖 デジタル絵本で読む';
      button.onclick = () => openSingleBook(work);
      const actions = card.querySelector('.library-actions') || card;
      actions.appendChild(button);
    });

    const creator = (state.creator || els.creatorName.value || '').trim();
    if (creator) {
      const ownWorks = works.filter(work => (work.creator || '匿名') === creator);
      const area = q('.volume-progress');
      if (area) {
        let button = q('#digitalVolumeBtn', area);
        if (!button) {
          button = document.createElement('button');
          button.id = 'digitalVolumeBtn';
          button.className = 'primary-btn compact digital-volume-btn';
          area.appendChild(button);
        }
        button.disabled = ownWorks.length < 5;
        button.textContent = ownWorks.length >= 5 ? '📚 第1巻をデジタル絵本で読む' : `📚 デジタル第1巻まで あと${5 - ownWorks.length}本`;
        button.onclick = () => openVolumeBook(creator, ownWorks);
      }
    }
  }

  const openLibraryBeforeDigitalBook = openLibrary;
  openLibrary = async function () {
    await openLibraryBeforeDigitalBook();
    try { await injectBookButtons(); } catch (error) { console.warn('デジタル絵本UI準備失敗', error); }
  };
  els.libraryBtn.onclick = openLibrary;

  document.addEventListener('keydown', event => {
    const modal = document.querySelector('#digitalBookModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); moveBook(1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); moveBook(-1); }
    if (event.key === 'Escape') closeBook();
  });
})();