(() => {
  titles[1] = ['どんなお話にする？', '最初は自分で。困った時だけ、無料ヒントを少し使います。'];
  titles[5] = ['A4用紙に絵を描こう', '決めた文章を「何を描けばいいか」に整理するところだけシステムが手伝います。'];
  titles[6] = ['原画を取り込もう', '4枚を写真で登録。画像調整はこの端末の中だけで行います。'];

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
    if (!document.querySelector('link[data-ux-v08]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v08.css';
      link.dataset.uxV08 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-ux-v08]')) {
      const script = document.createElement('script');
      script.src = './ux-v08.js';
      script.dataset.uxV08 = '1';
      document.body.appendChild(script);
    }
  });
})();
