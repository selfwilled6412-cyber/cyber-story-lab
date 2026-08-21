(() => {
  const ONBOARD_KEY = 'cyberStoryLabOnboarding_v08';
  let autoSaveTimer = null;

  function ensureSaveBadge() {
    let badge = document.querySelector('#uxSaveBadge');
    if (badge) return badge;
    badge = document.createElement('span');
    badge.id = 'uxSaveBadge';
    badge.className = 'ux-save-badge';
    badge.textContent = '✓ 自動保存';
    const actions = document.querySelector('.top-actions');
    if (actions) actions.insertBefore(badge, document.querySelector('#libraryBtn'));
    return badge;
  }

  function setSaveStatus(text, busy = false) {
    const badge = ensureSaveBadge();
    badge.textContent = text;
    badge.classList.toggle('saving', busy);
  }

  function scheduleAutoSave() {
    setSaveStatus('… 保存中', true);
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      try {
        state.creator = els.creatorName.value.trim();
        saveState();
        setSaveStatus('✓ 自動保存');
      } catch (error) {
        console.warn('自動保存に失敗', error);
        setSaveStatus('! 保存確認');
      }
    }, 700);
  }

  document.addEventListener('input', event => {
    if (event.target.matches('input, textarea')) scheduleAutoSave();
  }, true);

  document.addEventListener('change', event => {
    if (event.target.matches('input, textarea')) scheduleAutoSave();
  }, true);

  const stepCopy = {
    1: ['今やること', 'まずは「どんな話にしたいか」を一言だけ。思いつかなければヒントを押してOK。'],
    2: ['今やること', '主役を1つ決めよう。人間じゃなくても、物でも、正体不明でもOK。'],
    3: ['今やること', '4コマを1コマずつ考える。長い文章にしなくてOK。1〜2文で十分。'],
    4: ['今やること', '4つの文章を見直す。変な展開でも直さなくてOK。作者の言葉を残そう。'],
    5: ['今やること', 'A4用紙を4枚用意。1枚に1コマずつ、大きく自由に描こう。'],
    6: ['今やること', 'A4原画を1枚ずつ撮影・登録。真上から、紙全体が入るように撮るときれい。'],
    7: ['完成！', '作品棚へ保存してPNGも残そう。5本たまると第1巻を作れる。']
  };

  function injectStepCoach() {
    const content = document.querySelector('#stepContent');
    if (!content) return;
    document.querySelector('#stepCoach')?.remove();
    const [label, text] = stepCopy[state.step] || ['今やること', '画面の案内に沿って進めよう。'];
    const coach = document.createElement('div');
    coach.id = 'stepCoach';
    coach.className = 'step-coach';
    coach.innerHTML = `<span>${label}</span><strong>${escapeHtml(text)}</strong>`;
    content.parentNode.insertBefore(coach, content);
  }

  const renderBeforeUx = render;
  render = function () {
    renderBeforeUx();
    injectStepCoach();
    ensureSaveBadge();
  };

  function buildOnboarding() {
    let overlay = document.querySelector('#uxOnboarding');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'uxOnboarding';
    overlay.className = 'ux-onboard hidden';
    overlay.innerHTML = `
      <section class="ux-onboard-card" role="dialog" aria-modal="true" aria-labelledby="uxOnboardTitle">
        <div class="ux-onboard-kicker">CYBER STORY LAB // START GUIDE</div>
        <h2 id="uxOnboardTitle">4コマを1本作ってみよう</h2>
        <p class="ux-onboard-lead">上手な話や上手な絵を作る場所ではありません。あなたの発想をそのまま作品にする工房です。</p>
        <div class="ux-onboard-grid">
          <article><b>01</b><h3>話を考える</h3><p>お題・主役・4コマを1つずつ決める。困った時だけ無料ヒント。</p></article>
          <article><b>02</b><h3>A4に描く</h3><p>1コマ＝A4用紙1枚。棒人間やラフでもOK。大きく描こう。</p></article>
          <article><b>03</b><h3>写真で完成</h3><p>4枚を取り込むと文字入り4コマに。作品棚へ保存できる。</p></article>
        </div>
        <div class="ux-onboard-safe"><strong>FREE MODE</strong><span>外部AIへの送信なし・AI課金なし</span></div>
        <div class="ux-onboard-actions">
          <button type="button" class="primary-btn" id="uxStartBtn">制作をスタート →</button>
          <button type="button" class="ghost-btn" id="uxCloseBtn">閉じる</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#uxStartBtn').onclick = () => {
      localStorage.setItem(ONBOARD_KEY, 'seen');
      overlay.classList.add('hidden');
      document.querySelector('#themeInput')?.focus();
    };
    overlay.querySelector('#uxCloseBtn').onclick = () => overlay.classList.add('hidden');
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.classList.add('hidden');
    });
    return overlay;
  }

  function openOnboarding() {
    buildOnboarding().classList.remove('hidden');
  }

  function ensureGuideButton() {
    if (document.querySelector('#uxGuideBtn')) return;
    const button = document.createElement('button');
    button.id = 'uxGuideBtn';
    button.className = 'ghost-btn ux-guide-btn';
    button.textContent = '使い方';
    button.onclick = openOnboarding;
    const actions = document.querySelector('.top-actions');
    if (actions) actions.insertBefore(button, document.querySelector('#libraryBtn'));
  }

  ensureSaveBadge();
  ensureGuideButton();
  render();

  if (!localStorage.getItem(ONBOARD_KEY)) {
    setTimeout(openOnboarding, 300);
  }
})();
