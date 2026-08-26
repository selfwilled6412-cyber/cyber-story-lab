(() => {
  titles[1] = ['どんなお話にする？', '最初は自分で。困った時だけ、無料ヒントを少し使います。'];
  titles[5] = ['ラフを描こう', '完成絵ではなく、AIへ伝えるための設計図を作ります。丸・線・矢印・メモでOK。'];
  titles[6] = ['ラフから絵本イラストへ', 'ラフを取り込み、運用側AI接続後は一から絵本イラストへ描き直せます。'];

  setApiStatus = function () {
    state.apiReady = false;
    els.apiBadge.textContent = 'FREE MODE • AI課金なし';
    els.apiBadge.classList.add('online');
  };

  renderStep4 = function () {
    els.stepContent.appendChild(cloneTemplate('#step4Template'));
    const grid = q('#reviewGrid');
    state.story.forEach((text, i) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML = `<div class="koma-no">${i + 1}コマ目</div><textarea data-i="${i}">${escapeHtml(text)}</textarea><small>自動書き換えなし</small>`;
      grid.appendChild(card);
    });
    qa('textarea', grid).forEach(t => {
      t.oninput = e => {
        state.story[Number(e.target.dataset.i)] = e.target.value;
        state.drawGuides = ['', '', '', ''];
      };
    });
  };

  setApiStatus();
  render();

  window.addEventListener('load', () => {
    const loadAiRedrawV12 = () => {
      if (!document.querySelector('link[data-ai-redraw-v12]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './ai-redraw-v12.css';
        link.dataset.aiRedrawV12 = '1';
        document.head.appendChild(link);
      }
      if (!document.querySelector('script[data-ai-redraw-v12]')) {
        const script = document.createElement('script');
        script.src = './ai-redraw-v12.js';
        script.dataset.aiRedrawV12 = '1';
        document.body.appendChild(script);
      }
    };

    const loadDigitalBookV11 = () => {
      if (!document.querySelector('link[data-digital-book-v11]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './digital-book-v11.css';
        link.dataset.digitalBookV11 = '1';
        document.head.appendChild(link);
      }
      const existing = document.querySelector('script[data-digital-book-v11]');
      if (existing) {
        loadAiRedrawV12();
      } else {
        const script = document.createElement('script');
        script.src = './digital-book-v11.js';
        script.dataset.digitalBookV11 = '1';
        script.onload = loadAiRedrawV12;
        document.body.appendChild(script);
      }
    };

    const loadDraftSlotsV10 = () => {
      if (!document.querySelector('link[data-drafts-v10]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './drafts-v10.css';
        link.dataset.draftsV10 = '1';
        document.head.appendChild(link);
      }
      const existingDrafts = document.querySelector('script[data-drafts-v10]');
      if (existingDrafts) {
        loadDigitalBookV11();
      } else {
        const script = document.createElement('script');
        script.src = './drafts-v10.js';
        script.dataset.draftsV10 = '1';
        script.onload = loadDigitalBookV11;
        document.body.appendChild(script);
      }
    };

    const loadBackupV09 = () => {
      if (!document.querySelector('link[data-backup-v09]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './backup-v09.css';
        link.dataset.backupV09 = '1';
        document.head.appendChild(link);
      }
      const existingBackup = document.querySelector('script[data-backup-v09]');
      if (existingBackup) {
        loadDraftSlotsV10();
      } else {
        const script = document.createElement('script');
        script.src = './backup-v09.js';
        script.dataset.backupV09 = '1';
        script.onload = loadDraftSlotsV10;
        document.body.appendChild(script);
      }
    };

    if (!document.querySelector('link[data-ux-v08]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v08.css';
      link.dataset.uxV08 = '1';
      document.head.appendChild(link);
    }

    const existingUx = document.querySelector('script[data-ux-v08]');
    if (existingUx) {
      loadBackupV09();
    } else {
      const script = document.createElement('script');
      script.src = './ux-v08.js';
      script.dataset.uxV08 = '1';
      script.onload = loadBackupV09;
      document.body.appendChild(script);
    }
  });
})();