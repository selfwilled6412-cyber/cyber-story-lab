(() => {
  const freeThemePlaces = ['宇宙', '海の底', '夜の学校', '冷蔵庫の中', '雲の上', '誰もいない町', '砂漠', '未来の公園', '月', '森の奥', 'お菓子の国', '駅のホーム', '巨大な台所', '小さな島', '夢の中'];
  const freeThemeThings = ['ラーメン', '靴', '時計', '雲', 'プリン', '自動販売機', '鉛筆', '石', '傘', 'ロボット', '魚', 'ドア', 'パン', '帽子', '謎の箱', '風', '星', 'イス', 'コップ', '名前のない生き物'];
  const freeThemePatterns = [
    (p, t) => `${p}にある${t}の話`,
    (p, t) => `${p}で${t}を見つける話`,
    (p, t) => `${t}が${p}にいる話`,
    (p, t) => `${p}と${t}を組み合わせた話`,
    (p, t) => `${t}がいつもと違う${p}に行く話`,
    (p, t) => `${p}で起きる${t}の不思議な話`
  ];
  const freeHeroKinds = ['動物', '食べ物', '道具', '自然', '機械', '乗り物', '植物', '正体不明のもの'];
  const freeHeroForms = ['目が3つ', 'ものすごく小さい', '虹色', '四角い', 'ふわふわ', '片足だけ長い', 'いつも逆さま', '透明', '光っている', '音が鳴る', '眠そう', '名前がない'];
  const freeHeroExamples = ['しゃべる冷蔵庫', '目が3つある紫色の丸', '名前のない風', '空を泳ぐ魚', '泣いているプリン', '未来から来た鉛筆', '足が生えた雲', '四角い猫', '歌う石', '眠らない自動販売機'];
  const freeStoryHints = [
    [
      () => `${state.hero || '主役'}はどこにいる？`,
      () => '最初に見えているものは何？',
      () => '主役は何をしてる？',
      () => 'その場所は明るい？暗い？それとも変な色？',
      () => '主役は何を持ってる？何も持ってなくてもOK。',
      () => '最初の主役はどんな気分？'
    ],
    [
      () => '急に何が変わった？',
      () => '何かが来た？消えた？大きくなった？',
      () => `${state.hero || '主役'}が見つけたものは何？`,
      () => '音・光・におい・動きのどれかが変わった？',
      () => '普通なら起きないことを1つだけ起こすなら？',
      () => 'さっきまで無かったものが現れた？'
    ],
    [
      () => 'さっき起きたことが、もっと変になるとしたら？',
      () => '大きさや向きが逆になったらどうなる？',
      () => `${state.hero || '主役'}は何をする？何もしなくてもOK。`,
      () => '別のものが1つだけ出てくるなら何？',
      () => '場所そのものが変わったら？',
      () => '「えっ？」と思うことをもう1つ足すなら？'
    ],
    [
      () => '最後に残っているものは何？',
      () => `${state.hero || '主役'}は最後どうしてる？`,
      () => '笑う？驚く？寝る？そのまま？',
      () => 'オチをつけず、そのまま終わってもOK。どう終わる？',
      () => '最後の1秒を絵にしたら何が見える？',
      () => '最初と同じ場所で終わる？違う場所で終わる？'
    ]
  ];

  const freePick = arr => arr[Math.floor(Math.random() * arr.length)];
  const freeShuffle = arr => [...arr].sort(() => Math.random() - 0.5);

  function freeThemeIdeas() {
    const ideas = new Set();
    const partial = state.theme.trim();
    if (partial) {
      ideas.add(`${partial}と「${freePick(freeThemeThings)}」を組み合わせた話`);
      ideas.add(`${partial}がある「${freePick(freeThemePlaces)}」の話`);
    }
    while (ideas.size < 5) ideas.add(freePick(freeThemePatterns)(freePick(freeThemePlaces), freePick(freeThemeThings)));
    return [...ideas].slice(0, 5);
  }

  function freeHeroIdeas() {
    const ideas = new Set(freeShuffle(freeHeroExamples).slice(0, 2));
    while (ideas.size < 5) {
      const kind = freePick(freeHeroKinds);
      const form = freePick(freeHeroForms);
      ideas.add(`${form}${kind === '正体不明のもの' ? '正体不明のもの' : `の${kind}`}`);
    }
    return [...ideas].slice(0, 5);
  }

  setApiStatus = function () {
    state.apiReady = false;
    els.apiBadge.textContent = 'FREE MODE • 0円';
    els.apiBadge.classList.add('online');
  };

  apiStoryHelp = async function () {
    throw new Error('FREE MODEでは外部AIを呼び出しません');
  };

  renderStep1 = function () {
    els.stepContent.appendChild(cloneTemplate('#step1Template'));
    const input = q('#themeInput');
    const hints = q('#themeHints');
    const ladder = q('#themeHintLadder');
    input.value = state.theme;
    input.oninput = e => { state.theme = e.target.value; };
    q('#themeClearBtn').onclick = () => { state.theme = ''; input.value = ''; hints.innerHTML = ''; };
    q('#themeHintBtn').onclick = () => { ladder.classList.toggle('hidden'); hints.innerHTML = ''; };
    q('#themeExamplesBtn').onclick = () => {
      hints.innerHTML = '';
      freeThemeIdeas().forEach(text => {
        const button = document.createElement('button');
        button.className = 'choice-chip';
        button.textContent = text;
        button.onclick = () => { state.theme = text; input.value = text; };
        hints.appendChild(button);
      });
    };
  };

  renderStep2 = function () {
    els.stepContent.appendChild(cloneTemplate('#step2Template'));
    const input = q('#heroInput');
    const hints = q('#heroHints');
    input.value = state.hero;
    input.oninput = e => { state.hero = e.target.value; };
    q('#heroHintBtn').onclick = () => q('#heroHintLadder').classList.toggle('hidden');
    q('#heroExamplesBtn').onclick = () => {
      hints.innerHTML = '';
      freeHeroIdeas().forEach(text => {
        const button = document.createElement('button');
        button.className = 'choice-chip';
        button.textContent = text;
        button.onclick = () => { state.hero = text; input.value = text; };
        hints.appendChild(button);
      });
    };
  };

  renderStep3 = function () {
    els.stepContent.appendChild(cloneTemplate('#step3Template'));
    const tabs = q('#storyTabs');
    storyQuestions.forEach((item, index) => {
      const button = document.createElement('button');
      button.className = `story-tab ${index === state.storyIndex ? 'active' : ''} ${state.story[index].trim() ? 'done' : ''}`;
      button.textContent = `${index + 1}コマ目`;
      button.onclick = () => { saveStoryAnswer(); state.storyIndex = index; render(); };
      tabs.appendChild(button);
    });
    const item = storyQuestions[state.storyIndex];
    q('#storyQuestionNo').textContent = `${state.storyIndex + 1}コマ目 / 4`;
    q('#storyQuestionTitle').textContent = item.title;
    q('#storyQuestionHelp').textContent = item.help;
    q('#storyContext').innerHTML = `<span>お題：${escapeHtml(state.theme)}</span><span>主役：${escapeHtml(state.hero)}</span>`;
    const answer = q('#storyAnswer');
    answer.value = state.story[state.storyIndex];
    answer.oninput = e => { state.story[state.storyIndex] = e.target.value; };
    q('#storyHintBtn').onclick = () => {
      const box = q('#storyHintBox');
      const hints = freeShuffle(freeStoryHints[state.storyIndex]).slice(0, 3).map(fn => fn());
      box.innerHTML = `<strong>答えは出しません。考えるための質問：</strong><ul>${hints.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><small>もう一度押すと別の質問が出ます。</small>`;
      box.classList.remove('hidden');
    };
    q('#storyNextBtn').onclick = () => {
      saveStoryAnswer();
      if (!state.story[state.storyIndex].trim()) { toast('まず、このコマの内容を少しだけ入力してみよう'); return; }
      if (state.storyIndex < 3) {
        state.storyIndex++;
        saveState();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else toast('4コマ全部できた！「4コマを確認」へ進めます');
    };
  };

  localDrawingInstruction = function (index) {
    const text = state.story[index] || 'まだ内容がありません';
    const hero = state.hero || '主役';
    const variants = [
      [
        `${hero}を大きめに描いて、「${text}」が始まる場所を線や記号で少しだけ足してみよう。`,
        `「${text}」の最初の瞬間を1枚にしよう。${hero}の位置を先に決めて、周りは必要なものだけでOK。`,
        `${hero}が何をしているか分かるように描こう。背景は白いままでも、記号だけでも大丈夫。`
      ],
      [
        `「${text}」が起きた瞬間を描こう。何が変わったのか、一番大事なものを大きくしてみよう。`,
        `2コマ目は変化が見える場面。「${text}」の中で一番びっくりする部分を中心に描いてみよう。`,
        `「${text}」を見た人に伝えるなら、何を一番大きく描く？それを真ん中に置いてみよう。`
      ],
      [
        `「${text}」の中で一番見せたいものを1つ決めよう。変な形や位置でも直さなくてOK。`,
        `3コマ目はもっと自由。「${text}」が伝わるなら、実際の大きさや形と違っていてもOK。`,
        `「${text}」を1枚の絵にするなら、主役・物・場所のどれを一番大きくしたい？好きに決めよう。`
      ],
      [
        `最後の「${text}」が伝わる場面。${hero}の表情・向き・周りの様子を自由に決めて描こう。`,
        `4コマ目は終わりの1秒を描こう。「${text}」のあとに何か足さなくて大丈夫。`,
        `「${text}」で終わる絵。最後に見せたいものだけ大きく描いて、ほかは省いてもOK。`
      ]
    ];
    return freePick(variants[index]);
  };

  renderStep5 = function () {
    els.stepContent.appendChild(cloneTemplate('#step5Template'));
    if (!state.drawGuides.every(Boolean)) state.drawGuides = state.story.map((_, i) => localDrawingInstruction(i));
    const grid = q('#drawGrid');
    state.story.forEach((text, i) => {
      const card = document.createElement('article');
      card.className = 'draw-card';
      card.innerHTML = `<div class="koma-no">A4 SHEET ${i + 1}</div><h4>${i + 1}コマ目</h4><p><strong>このコマの文章：</strong><br>${escapeHtml(text)}</p><div class="draw-callout">✎ ${escapeHtml(state.drawGuides[i])}</div><div class="draw-rule">描き足してOK / 省いてOK / ヒントどおりじゃなくてOK</div>`;
      grid.appendChild(card);
    });
    q('#refreshDrawGuideBtn').onclick = () => {
      state.drawGuides = state.story.map((_, i) => localDrawingInstruction(i));
      saveState();
      render();
      toast('作画ヒントを別の言い方にしました');
    };
    q('#drawGuideStatus').textContent = '無料アシスト：文章を増やさず、描くポイントだけ整理します。';
  };

  processImage = function (src, mode) {
    if (!src || mode === 'original') return Promise.resolve(src);
    return loadImage(src).then(img => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = mode === 'mono'
        ? 'grayscale(1) contrast(1.65) brightness(1.12)'
        : 'contrast(1.32) brightness(1.08) saturate(.84)';
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/jpeg', .9);
    });
  };

  renderStep6 = function () {
    els.stepContent.appendChild(cloneTemplate('#step6Template'));
    qa('.mode', els.stepContent).forEach(button => {
      button.classList.toggle('active', button.dataset.mode === state.imageMode);
      button.onclick = async () => {
        state.imageMode = button.dataset.mode;
        showBusy('原画を整えています', '処理はこの端末の中だけ。外部AIには送信しません。');
        try { await processAllImages(); render(); } finally { hideBusy(); }
      };
    });
    const grid = q('#uploadGrid');
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('article');
      card.className = 'upload-card';
      const img = state.processedImages[i] || state.images[i];
      const modeLabel = state.imageMode === 'original' ? '原画' : state.imageMode === 'clean' ? '線を見やすく' : '白黒くっきり';
      card.innerHTML = `<div class="koma-no">${i + 1}コマ目</div><h4>A4原画 ${i + 1}</h4><p>${escapeHtml(state.story[i])}</p><label class="upload-drop"><input type="file" accept="image/*" capture="environment" data-index="${i}">${img ? `<img src="${img}" alt="${i + 1}コマ目原画">` : `<div class="upload-placeholder"><strong>写真を選ぶ / 撮影する</strong>A4用紙をできるだけ真上から撮ってください</div>`}</label><div class="image-status">${state.images[i] ? `✓ 登録済み / ${modeLabel}` : '未登録'}</div>`;
      grid.appendChild(card);
    }
    qa('input[type=file]', grid).forEach(input => {
      input.onchange = async e => {
        const i = Number(e.target.dataset.index);
        const file = e.target.files?.[0];
        if (!file) return;
        showBusy('原画を取り込み中', '写真をこの端末の中で軽量化しています。');
        try {
          state.images[i] = await normalizeUpload(file);
          state.processedImages[i] = await processImage(state.images[i], state.imageMode);
          saveState();
          render();
        } finally { hideBusy(); }
      };
    });
  };

  const originalOpenLibrary = openLibrary;
  openLibrary = async function () {
    await originalOpenLibrary();
    try {
      const works = await getWorks();
      const creator = (state.creator || els.creatorName.value || '').trim();
      const ownWorks = creator ? works.filter(w => w.creator === creator) : works;
      const count = Math.min(ownWorks.length, 5);
      q('#volumeCount').textContent = `${count} / 5`;
      q('#volumeBar').style.width = `${Math.min(100, count / 5 * 100)}%`;
      const note = q('#volumeNote');
      if (note) note.textContent = creator ? `${creator}さんの4コマが5本たまったら第1巻へ。` : '作者名を入れると、その作者ごとの第1巻進捗を表示します。';
    } catch (error) { console.warn(error); }
  };
  els.libraryBtn.onclick = openLibrary;

  setApiStatus(false, 'FREE MODE • 0円');
  render();
})();
