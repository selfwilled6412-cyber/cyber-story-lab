(() => {
  const book = { pages: [], index: 0, title: '', creator: '', touchX: null };

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
            <button type="button" class="db-icon" id="dbExportBtn">絵本ファイル保存</button>
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
    modal.querySelector('#dbExportBtn').onclick = exportStandaloneBook;
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
    book.creator = work.creator || '作者';
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
    book.creator = creator;
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

  function standaloneHtml() {
    const pages = JSON.stringify(book.pages.map(page => ({ kind: page.kind, html: page.html }))).replace(/</g, '\\u003c');
    const title = escapeHtml(book.title || 'デジタル絵本');
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:system-ui,-apple-system,'Yu Gothic UI',Meiryo,sans-serif;background:#06101f;color:#eefcff}body{overflow:hidden}.book{height:100%;display:grid;grid-template-rows:auto 1fr auto;background:radial-gradient(circle at 50% 0,#102747,#040812 55%)}header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #27425a;background:#071322}header strong{font-size:15px}header span{font:12px ui-monospace,monospace;color:#9fcbd6}.stage{min-height:0;display:grid;grid-template-columns:58px minmax(0,1fr) 58px;align-items:center;gap:10px;padding:12px}.arrow{width:48px;height:48px;border-radius:50%;border:1px solid #47748a;background:#102a3d;color:white;font-size:32px}.arrow:disabled{opacity:.2}.page{width:min(980px,100%);height:min(80vh,760px);margin:auto;overflow:hidden;border-radius:18px;background:white;color:#17202a;box-shadow:0 25px 80px #0009}.inner{height:100%}.db-cover{height:100%;display:grid;grid-template-columns:1.15fr .85fr;background:linear-gradient(135deg,#f4fbff,#eef4ff 52%,#fff0fb)}.db-cover:not(.has-image){grid-template-columns:1fr;place-items:center;text-align:center}.db-cover-art{overflow:hidden}.db-cover-art img{width:100%;height:100%;object-fit:cover}.db-cover-copy{display:flex;flex-direction:column;justify-content:center;padding:48px}.db-cover-copy span,.db-story-meta span,.db-divider span{font-size:11px;letter-spacing:.18em;color:#527786;font-weight:800}.db-cover-copy h1,.db-divider h1{font-size:clamp(30px,5vw,58px);line-height:1.16;margin:16px 0;color:#17313b}.db-cover-copy p{color:#5b7780}.db-cover-mark{font-size:72px;color:#58b7ca}.db-story-page{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:28px;gap:12px;background:#fff}.db-story-meta{display:flex;justify-content:space-between;color:#56717b}.db-story-art{min-height:0;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#eef3f4}.db-story-art img{width:100%;height:100%;object-fit:contain}.db-no-art{color:#7e969e}.db-story-text{min-height:86px;display:flex;align-items:center;justify-content:center;padding:12px 22px;border-top:2px solid #233b44}.db-story-text p{font-size:clamp(20px,2.5vw,31px);line-height:1.65;margin:0;text-align:center;white-space:pre-wrap;font-weight:650}.db-divider,.db-end{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:38px;background:linear-gradient(145deg,#f7fcff,#f6f0ff)}.db-divider img{width:min(420px,70%);max-height:46%;object-fit:contain;border-radius:12px}.db-divider p,.db-end span{color:#6b858e}.db-end-star{font-size:52px;color:#58b7ca}.db-end h1{font-size:clamp(44px,7vw,76px);margin:8px}.db-end p{font-size:21px}.progress{height:5px;background:#153247}.progress i{display:block;height:100%;background:linear-gradient(90deg,#65f7ff,#a77bff)}footer{text-align:center;padding:8px;color:#86a7b4;font-size:11px}@media(max-width:720px){.stage{display:block;padding:6px}.page{height:calc(100vh - 104px)}.arrow{position:absolute;z-index:2;top:50%;transform:translateY(-50%);width:42px;height:42px}.prev{left:8px}.next{right:8px}.db-cover{grid-template-columns:1fr;grid-template-rows:55% 1fr}.db-cover-copy{padding:18px;text-align:center}.db-story-page{padding:10px}.db-story-text p{font-size:19px}footer{display:none}}
</style></head><body><div class="book"><header><strong>${title}</strong><span id="count"></span></header><main class="stage"><button class="arrow prev" id="prev">‹</button><article class="page"><div class="inner" id="inner"></div></article><button class="arrow next" id="next">›</button></main><div><div class="progress"><i id="progress"></i></div><footer>左右キー・スワイプでページをめくれます</footer></div></div><script>
const pages=${pages};let index=0,touchX=null;const inner=document.getElementById('inner'),count=document.getElementById('count'),progress=document.getElementById('progress'),prev=document.getElementById('prev'),next=document.getElementById('next');function render(){inner.innerHTML=pages[index]?.html||'';count.textContent=(index+1)+' / '+pages.length;progress.style.width=((index+1)/pages.length*100)+'%';prev.disabled=index===0;next.disabled=index===pages.length-1}function move(d){index=Math.max(0,Math.min(pages.length-1,index+d));render()}prev.onclick=()=>move(-1);next.onclick=()=>move(1);document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown')move(1);if(e.key==='ArrowLeft'||e.key==='PageUp')move(-1)});document.querySelector('.stage').addEventListener('touchstart',e=>touchX=e.changedTouches[0].clientX,{passive:true});document.querySelector('.stage').addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-touchX;if(Math.abs(d)>48)move(d>0?-1:1)},{passive:true});render();<\/script></body></html>`;
  }

  function exportStandaloneBook() {
    if (!book.pages.length) return;
    const blob = new Blob([standaloneHtml()], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFile(book.creator || '作者')}_${safeFile(book.title || 'デジタル絵本')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('デジタル絵本ファイルを保存しました');
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