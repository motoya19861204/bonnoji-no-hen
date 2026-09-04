/* 煩悩児の変 — 横スクロールベルトアクション（PixiJS v8） */
(async () => {
  const CFG = await (await fetch('config.json')).json();
  const W = CFG.screen.width, H = CFG.screen.height;

  // ---------- 素材（無ければ矩形プレースホルダ） ----------
  let manifest = { frames: {}, voices: {}, images: {} };
  try { manifest = await (await fetch('assets/manifest.json')).json(); } catch (e) {}
  const TEX = {};
  const loadList = [];
  for (const [k, v] of Object.entries(manifest.frames)) loadList.push([k, 'assets/' + v.file]);
  manifest.anims = manifest.anims || {};
  for (const an of Object.values(manifest.anims)) for (const fr of an.frames) loadList.push([fr.file, 'assets/' + fr.file]);
  for (const [k, v] of Object.entries(manifest.images)) if (typeof v === 'string' && /\.(png|webp|jpg)$/.test(v)) loadList.push([k, 'assets/' + v]);
  await Promise.all(loadList.map(async ([k, url]) => { try { TEX[k] = await PIXI.Assets.load(url); } catch (e) { console.warn('missing', url); } }));
  const hasTex = (k) => !!TEX[k];

  // ---------- 音 ----------
  const AC = new (window.AudioContext || window.webkitAudioContext)();
  const VOICE = {};
  for (const [k, f] of Object.entries(manifest.voices)) {
    try { VOICE[k] = await AC.decodeAudioData(await (await fetch('assets/' + f)).arrayBuffer()); } catch (e) { console.warn('voice missing', f); }
  }
  function playVoice(k, gain = 1.0) {
    const b = VOICE[k]; if (!b) return;
    const s = AC.createBufferSource(); s.buffer = b;
    const g = AC.createGain(); g.gain.value = gain; s.connect(g); g.connect(AC.destination); s.start();
  }
  function sfx(type) {
    const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
    f.type = 'lowpass';
    if (type === 'hit') { o.type = 'square'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12); f.frequency.value = 900; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); }
    else if (type === 'big') { o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5); f.frequency.value = 600; g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); }
    else if (type === 'whiff') { o.type = 'triangle'; o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(200, t + 0.08); f.frequency.value = 2000; g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); }
    else if (type === 'jump') { o.type = 'square'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12); f.frequency.value = 3000; g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); }
    else if (type === 'hurt') { o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2); f.frequency.value = 1200; g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); }
    else if (type === 'coin') { o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.08); f.frequency.value = 5000; g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); }
    o.connect(f); f.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.6);
  }
  function noiseBurst(dur = 0.3, vol = 0.5) {
    const n = AC.sampleRate * dur, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = AC.createBufferSource(); s.buffer = buf; const g = AC.createGain(); g.gain.value = vol; s.connect(g); g.connect(AC.destination); s.start();
  }

  // ---------- Pixi ----------
  const app = new PIXI.Application();
  await app.init({ width: W, height: H, background: '#000', antialias: false, resolution: 1 });
  document.getElementById('wrap').appendChild(app.canvas);
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    app.canvas.style.width = Math.floor(W * s) + 'px'; app.canvas.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  const world = new PIXI.Container();       // カメラで動く
  const bgLayer = new PIXI.Container();
  const actorLayer = new PIXI.Container();  // yソート
  const fxLayer = new PIXI.Container();
  const hud = new PIXI.Container();
  const flash = new PIXI.Graphics().rect(0, 0, W, H).fill(0xffffff); flash.alpha = 0;
  world.addChild(bgLayer, actorLayer, fxLayer);
  app.stage.addChild(world, hud, flash);

  // ---------- 入力 ----------
  const keys = {};
  const KEYMAP = { KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyJ: 'KeyZ', KeyK: 'KeyX', Space: 'KeyZ' };
  const pressed = {};
  function down(code) { code = KEYMAP[code] || code; if (!keys[code]) pressed[code] = true; keys[code] = true; }
  function up(code) { code = KEYMAP[code] || code; keys[code] = false; }
  window.addEventListener('keydown', (e) => { down(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
  window.addEventListener('keyup', (e) => up(e.code));
  const touch = document.getElementById('touch');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) touch.style.display = 'block';
  for (const el of touch.querySelectorAll('[data-k]')) {
    const k = el.dataset.k;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(k); el.setPointerCapture(e.pointerId); });
    const rel = (e) => { e.preventDefault(); up(k); };
    el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel);
  }

  // ---------- 背景 ----------
  const PW = CFG.stage.panelWidth;
  const PANELS = ['bg_a', 'bg_b', 'bg_c'];
  const stageLen = PW * PANELS.length;
  PANELS.forEach((k, i) => {
    let s;
    if (hasTex(k)) { s = new PIXI.Sprite(TEX[k]); s.width = PW; s.height = H; }
    else { s = new PIXI.Graphics().rect(0, 0, PW, H).fill(i % 2 ? 0x1a1a2e : 0x16213e).rect(0, CFG.ground.top - 30, PW, H).fill(0x2b2b3a); }
    s.x = i * PW; bgLayer.addChild(s);
  });

  // ---------- アクター ----------
  const actors = [];
  function makeView(name, height, color) {
    const c = new PIXI.Container();
    const spr = new PIXI.Sprite(PIXI.Texture.WHITE); spr.anchor.set(0.5, 1); spr.visible = false;
    const box = new PIXI.Graphics().rect(-height * 0.2, -height, height * 0.4, height).fill(color); box.visible = false;
    const shadow = new PIXI.Graphics().ellipse(0, 0, height * 0.22, height * 0.06).fill({ color: 0x000000, alpha: 0.45 });
    c.addChild(shadow, box, spr); c.spr = spr; c.box = box; c.shadow = shadow;
    return c;
  }
  function setFrame(a, key) {
    const fr = manifest.frames[key];
    if (fr && TEX[key]) {
      a.view.spr.texture = TEX[key];
      const sc = a.height / (fr.charHeight || TEX[key].height);
      a.view.spr.scale.set(sc);
      a.view.spr.anchor.set(fr.anchorX ?? 0.5, fr.anchorY ?? 1);
      a.view.spr.visible = true; a.view.box.visible = false;
    } else { a.view.spr.visible = false; a.view.box.visible = true; a.view.box.tint = key.includes('punch') || key.includes('attack') ? 0xffdd55 : 0xffffff; }
  }
  // 動画由来のコマアニメ。frac=0..1（非ループ）/ 任意（ループ）。無ければ静止ポーズにフォールバック
  function anim(a, clip, frac, fallbackKey) {
    const an = manifest.anims[clip];
    if (!an || !an.frames.length) return setFrame(a, fallbackKey);
    const n = an.frames.length;
    const i = an.loop ? ((Math.floor(frac) % n) + n) % n : Math.min(n - 1, Math.max(0, Math.floor(frac * n)));
    const fr = an.frames[i];
    if (!TEX[fr.file]) return setFrame(a, fallbackKey);
    a.view.spr.texture = TEX[fr.file];
    const sc = a.height / fr.charHeight;
    a.view.spr.scale.set(sc);
    a.view.spr.anchor.set(fr.anchorX, fr.anchorY);
    a.view.spr.visible = true; a.view.box.visible = false;
  }
  function spawn(kind, x, y) {
    const isHero = kind === 'hero';
    const st = isHero ? CFG.hero : CFG.enemies[kind];
    const a = { kind, x, y, z: 0, vz: 0, vx: 0, vy: 0, hp: st.hp, maxHp: st.hp, height: st.height, facing: isHero ? 1 : -1,
      state: 'idle', t: 0, combo: 0, comboTimer: 0, hitDone: false, inv: 0, animT: 0, dead: false, st, attackIx: 0, cool: 0, flashT: 0 };
    a.view = makeView(kind, st.height, isHero ? 0x66ccff : kind === 'boss' ? 0xcc3333 : 0xaa66cc);
    actorLayer.addChild(a.view); actors.push(a); return a;
  }
  const hero = spawn('hero', 120, 460);
  window.__g = { app, hero, actors, keys, pressed, get camX() { return camX; }, get state() { return gameState; } };
  let score = 0, camX = 0, shake = 0, hitStop = 0, waveIx = 0, locked = false, lockRight = 0, gameState = 'play', goBlink = 0;

  // ---------- 演出 ----------
  const fxs = [];
  function fxSprite(key, x, y, scale, color) {
    let s;
    if (hasTex(key)) { s = new PIXI.Sprite(TEX[key]); s.anchor.set(0.5); s.scale.set(scale); }
    else { s = new PIXI.Graphics().star(0, 0, 8, 40 * scale, 18 * scale).fill(color || 0xffee66); }
    s.x = x; s.y = y; fxLayer.addChild(s); return s;
  }
  function hitSpark(x, y, big) {
    const s = fxSprite(big ? 'fx_big' : 'fx_hit', x, y, big ? 0.15 : 0.08, big ? 0xff8833 : 0xffee66);
    s.rotation = Math.random() * 6.28;
    fxs.push({ s, life: big ? 22 : 10, max: big ? 22 : 10, grow: big ? 0.03 : 0.02, growCap: big ? 0.75 : 0.32, spin: big ? 0.15 : 0.3, add: true });
    if (big) { const r = fxSprite('fx_hit', x, y, 0.05, 0x8888ff); fxs.push({ s: r, life: 30, max: 30, grow: 0.09, growCap: 2.2, spin: -0.1, add: true }); }
  }
  function tissueStorm(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = fxSprite('fx_tissue', x, y - 60, 0.04 + Math.random() * 0.05, 0xffffff);
      const ang = Math.random() * 6.28, sp = 6 + Math.random() * 16;
      fxs.push({ s, life: 90 + Math.random() * 60, max: 150, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 8, g: 0.28, drag: 0.94, flutter: Math.random() * 6.28, spin: (Math.random() - .5) * 0.3, tissue: true });
    }
    for (let i = 0; i < 6; i++) {
      const s = fxSprite('fx_tissuebox', x, y - 80, 0.09, 0x66aaff);
      fxs.push({ s, life: 70, max: 70, vx: (Math.random() - .5) * 26, vy: -14 - Math.random() * 10, g: 0.7, spin: (Math.random() - .5) * 0.5, bounceY: y });
    }
    if (hasTex('fx_tissue_mountain')) {
      const m = fxSprite('fx_tissue_mountain', x, y + 4, 0.02, 0xffffff); m.anchor.set(0.5, 1);
      fxs.push({ s: m, life: 80, max: 80, grow: 0.02, growCap: 0.42, mountain: true });
    }
  }
  function floatText(x, y, txt, color, size) {
    const t = new PIXI.Text({ text: txt, style: { fontFamily: 'Impact, sans-serif', fontSize: size || 28, fill: color || '#fff', stroke: { color: '#000', width: 5 }, fontWeight: 'bold' } });
    t.anchor.set(0.5); t.x = x; t.y = y; fxLayer.addChild(t);
    fxs.push({ s: t, life: 40, max: 40, vy: -2.2, text: true });
  }
  function updateFx() {
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i]; f.life--;
      if (f.grow) { const ns = f.s.scale.x + f.grow; f.s.scale.set(f.growCap ? Math.min(ns, f.growCap) : ns); }
      if (f.spin) f.s.rotation += f.spin;
      if (f.vx !== undefined) {
        f.vx *= f.drag || 1; f.vy = (f.vy + (f.g || 0)) * (f.drag || 1);
        f.s.x += f.vx; f.s.y += f.vy;
        if (f.flutter !== undefined) { f.flutter += 0.2; f.s.x += Math.sin(f.flutter) * 2.5; if (f.vy > 2.2) f.vy = 2.2; }
        if (f.bounceY && f.s.y > f.bounceY) { f.s.y = f.bounceY; f.vy *= -0.5; f.vx *= 0.7; }
      }
      if (f.vy !== undefined && f.text) f.s.y += f.vy;
      const r = f.life / f.max;
      if (f.add) f.s.alpha = r;
      else if (f.mountain) f.s.alpha = Math.min(1, r * 3);
      else f.s.alpha = Math.min(1, r * 2.5);
      if (f.life <= 0) { f.s.destroy(); fxs.splice(i, 1); }
    }
  }

  // ---------- HUD ----------
  const hudFrame = hasTex('ui_hud') ? new PIXI.Sprite(TEX['ui_hud']) : null;
  if (hudFrame) { hudFrame.height = 70; hudFrame.scale.x = hudFrame.scale.y; hudFrame.x = 12; hudFrame.y = 10; hud.addChild(hudFrame); }
  const portrait = hasTex('hero_face') ? new PIXI.Sprite(TEX['hero_face']) : new PIXI.Graphics().rect(0, 0, 56, 56).fill(0x66ccff);
  const barBg = new PIXI.Graphics(); const bar = new PIXI.Graphics(); const bossBar = new PIXI.Graphics();
  const scoreT = new PIXI.Text({ text: '1P  0', style: { fontFamily: 'Impact, sans-serif', fontSize: 26, fill: '#ffdd33', stroke: { color: '#000', width: 4 } } });
  const goT = new PIXI.Text({ text: 'GO ▶', style: { fontFamily: 'Impact, sans-serif', fontSize: 44, fill: '#ffee33', stroke: { color: '#a00', width: 6 } } });
  goT.anchor.set(1, 0.5); goT.x = W - 24; goT.y = H / 2; goT.visible = false;
  const comboT = new PIXI.Text({ text: '', style: { fontFamily: 'Impact, sans-serif', fontSize: 34, fill: '#ff5555', stroke: { color: '#fff', width: 5 } } });
  comboT.x = W - 260; comboT.y = 14;
  const msgT = new PIXI.Text({ text: '', style: { fontFamily: 'Impact, sans-serif', fontSize: 64, fill: '#fff', stroke: { color: '#000', width: 8 }, align: 'center' } });
  msgT.anchor.set(0.5); msgT.x = W / 2; msgT.y = H / 2 - 30;
  hud.addChild(barBg, bar, bossBar, portrait, scoreT, goT, comboT, msgT);
  function layoutHud() {
    let px = 20, py = 16, ps = 56, bx = 88, by = 30, bw = 300, bh = 20;
    if (hudFrame && manifest.images.ui_hud_layout) { const L = manifest.images.ui_hud_layout; const s = hudFrame.scale.x; px = 12 + L.px * s; py = 10 + L.py * s; ps = L.ps * s; bx = 12 + L.bx * s; by = 10 + L.by * s; bw = L.bw * s; bh = L.bh * s; }
    if (portrait.texture) { portrait.width = ps; portrait.height = ps; } portrait.x = px; portrait.y = py;
    barBg.clear().rect(bx, by, bw, bh).fill(0x330000);
    const r = Math.max(0, hero.hp / hero.maxHp);
    bar.clear().rect(bx, by, bw * r, bh).fill(r > 0.3 ? 0xffdd00 : 0xff2222);
    scoreT.x = bx + bw + 16; scoreT.y = by - 8; scoreT.text = '1P  ' + String(score).padStart(7, '0');
    const boss = actors.find((a) => a.kind === 'boss' && !a.dead);
    bossBar.clear();
    if (boss) { bossBar.rect(W / 2 - 200, H - 34, 400, 14).fill(0x220000).rect(W / 2 - 200, H - 34, 400 * Math.max(0, boss.hp / boss.maxHp), 14).fill(0xff3333); }
  }

  // ---------- 判定 ----------
  function inRange(a, b, reach) {
    const dx = (b.x - a.x) * a.facing;
    return dx > -10 && dx < reach && Math.abs(b.y - a.y) < CFG.hero.depthTolerance && Math.abs(b.z - a.z) < 60;
  }
  function damage(target, dmg, kb, from, big) {
    if (target.dead || target.state === 'down') return false;
    if (target.kind === 'hero' && target.inv > 0) return false;
    target.hp -= dmg; target.flashT = 6;
    target.facing = from.x > target.x ? 1 : -1;
    const dir = from.facing;
    const y = target.y - target.height * 0.55 - target.z;
    hitSpark(target.x + dir * 20, y, big);
    if (big) { noiseBurst(0.35, 0.8); sfx('big'); } else { sfx('hit'); noiseBurst(0.08, 0.3); }
    if (target.hp <= 0 || big) {
      target.state = 'down'; target.t = big ? 70 : 50; target.vx = dir * kb * 0.9; target.vz = big ? 12 : 7; target.z = Math.max(target.z, 1);
      if (target.hp <= 0) { target.dying = true; if (target.kind !== 'hero') { score += target.st.score; floatText(target.x, y - 40, '+' + target.st.score, '#ffee44', 26); } }
    } else { target.state = 'hit'; target.t = 14; target.vx = dir * kb * 0.5; }
    return true;
  }

  function startPunch(a) {
    const next = a.comboTimer > 0 ? Math.min(a.combo, 2) : 0;
    a.attackIx = next; a.combo = next + 1; a.state = 'punch'; a.t = 0; a.hitDone = false; a.comboTimer = 0; a.queued = false;
    const p = CFG.hero.punch[next]; playVoice(p.voice, p.finisher ? 1.4 : 1.0);
    if (p.finisher) { a.vx = 0; }
    comboT.text = ['ティッシュが', 'ティッシュが', 'やまも～り'][next]; comboShow = 40;
  }
  // ---------- 主人公 ----------
  function updateHero(a) {
    a.animT++; if (a.inv > 0) a.inv--; if (a.comboTimer > 0) a.comboTimer--; else if (a.state === 'idle' || a.state === 'walk') a.combo = 0;
    const grounded = a.z <= 0;
    if (a.state === 'down') {
      a.x += a.vx; a.vx *= 0.9; a.vz -= CFG.hero.gravity; a.z += a.vz; if (a.z < 0) { a.z = 0; a.vz = 0; }
      if (--a.t <= 0) { if (a.hp <= 0) { a.dead = true; gameOver(); } else { a.state = 'idle'; a.inv = CFG.hero.invincibleMs / 16; } }
      setFrame(a, 'hero_down'); return;
    }
    if (a.state === 'hit') { a.x += a.vx; a.vx *= 0.85; if (--a.t <= 0) a.state = 'idle'; anim(a, 'hero_hit', a.t <= 0 ? 1 : 1 - a.t / 14, 'hero_hit'); return; }
    if (a.state === 'punch') {
      const p = CFG.hero.punch[a.attackIx]; a.t += 16;
      if (!a.hitDone && a.t >= 40 && a.t <= 40 + p.activeMs) {
        let hitAny = false;
        for (const e of actors) if (e !== a && !e.dead && inRange(a, e, CFG.hero.reach)) hitAny = damage(e, p.damage, p.knockback, a, !!p.finisher) || hitAny;
        if (hitAny || a.t >= 40 + p.activeMs - 16) {
          a.hitDone = true;
          if (hitAny) {
            hitStop = (p.finisher ? CFG.fx.finisherHitStopMs : CFG.fx.hitStopMs) / 16; shake = p.finisher ? CFG.fx.finisherShake : CFG.fx.shake;
            if (p.finisher) { flash.alpha = 0.9; tissueStorm(a.x + a.facing * 60, a.y, CFG.fx.tissueCount); floatText(a.x, a.y - a.height - 30, 'やまも～り！！', '#ffffff', 48); }
            a.comboTimer = CFG.hero.comboWindowMs / 16;
          } else if (!p.finisher) sfx('whiff');
        }
      }
      if (pressed.KeyZ) { pressed.KeyZ = false; if (a.hitDone && a.attackIx < 2 && a.comboTimer > 0) a.queued = true; }
      const canCancel = a.hitDone && a.comboTimer > 0 && a.t >= 40 + p.activeMs + p.recoverMs * 0.45;
      if (a.queued && canCancel) { a.queued = false; a.state = 'idle'; startPunch(a); return; }
      if (a.t >= 40 + p.activeMs + p.recoverMs) { a.state = 'idle'; a.queued = false; if (a.attackIx === 2) a.combo = 0; }
      anim(a, 'hero_punch' + (a.attackIx + 1), a.t / (40 + p.activeMs + p.recoverMs), 'hero_punch' + (a.attackIx + 1)); return;
    }
    // ジャンプ
    if (!grounded || a.state === 'jump') {
      a.vz -= CFG.hero.gravity; a.z += a.vz; a.x += a.vx;
      if (keys.KeyZ && pressed.KeyZ && !a.kicking) { a.kicking = true; pressed.KeyZ = false; }
      if (a.kicking && !a.hitDone) for (const e of actors) if (e !== a && !e.dead && inRange(a, e, CFG.hero.reach + 20)) { if (damage(e, CFG.hero.jumpKick.damage, CFG.hero.jumpKick.knockback, a, false)) { a.hitDone = true; hitStop = 4; shake = 5; } }
      if (a.z <= 0) { a.z = 0; a.vz = 0; a.state = 'idle'; a.kicking = false; a.hitDone = false; }
      setFrame(a, a.kicking ? 'hero_jump' : 'hero_walk_a'); return;
    }
    // 入力
    let dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (pressed.KeyZ) { pressed.KeyZ = false; startPunch(a); return; }
    if (pressed.KeyX) { pressed.KeyX = false; a.state = 'jump'; a.vz = CFG.hero.jumpPower; a.z = 0.01; a.vx = dx * CFG.hero.speed; sfx('jump'); return; }
    if (dx || dy) {
      a.state = 'walk'; if (dx) a.facing = dx;
      a.x += dx * CFG.hero.speed; a.y += dy * CFG.hero.depthSpeed;
      anim(a, 'hero_walk', a.animT / 4, Math.floor(a.animT / 8) % 2 ? 'hero_walk_a' : 'hero_walk_b');
    } else { a.state = 'idle'; anim(a, 'hero_idle', a.animT / 6, 'hero_idle'); }
    a.y = Math.max(CFG.ground.top, Math.min(CFG.ground.bottom, a.y));
    const minX = camX + 30, maxX = locked ? lockRight - 30 : Math.min(stageLen - 30, camX + W - 30);
    a.x = Math.max(minX, Math.min(maxX, a.x));
  }

  // ---------- 敵 ----------
  let attackers = 0;
  function updateEnemy(a) {
    a.animT++; const st = a.st; const k = a.kind;
    if (a.state === 'down') {
      a.x += a.vx; a.vx *= 0.9; a.vz -= 0.7; a.z += a.vz; if (a.z < 0) { a.z = 0; a.vz = 0; }
      if (--a.t <= 0) { if (a.dying) { a.dead = true; a.view.visible = false; } else { a.state = 'idle'; a.cool = 30; } }
      setFrame(a, k + '_down'); a.view.alpha = a.dying && a.t < 20 ? a.t / 20 : 1; return;
    }
    if (a.state === 'hit') { a.x += a.vx; a.vx *= 0.85; if (--a.t <= 0) { a.state = 'idle'; a.cool = 20; } anim(a, k + '_hit', 1 - a.t / 14, k + '_hit'); return; }
    if (a.state === 'attack') {
      a.t += 16;
      if (!a.hitDone && a.t >= st.windupMs) { a.hitDone = true; if (inRange(a, hero, st.reach)) { if (damage(hero, st.damage, 10, a, false)) { sfx('hurt'); shake = 6; } } }
      if (a.t >= st.windupMs + st.recoverMs) { a.state = 'idle'; a.cool = 40 + Math.random() * 40; attackers--; }
      anim(a, k + '_attack', a.t / (st.windupMs + st.recoverMs), k + '_attack'); return;
    }
    if (a.cool > 0) a.cool--;
    const gap = CFG.ai.chaseGap + (k === 'boss' ? 30 : 0);
    const dx = hero.x - a.x, dy = hero.y - a.y;
    a.facing = dx > 0 ? 1 : -1;
    const wantX = hero.x - a.facing * gap;
    let mx = 0, my = 0;
    if (Math.abs(a.x - wantX) > 6) mx = Math.sign(wantX - a.x);
    if (Math.abs(dy) > 8) my = Math.sign(dy);
    // 攻撃者が上限のときは少し離れてうろつく
    if (attackers >= CFG.ai.maxAttackers && Math.abs(dx) < gap + 60) { mx = -a.facing; my = a.animT % 120 < 60 ? 1 : -1; }
    if (Math.abs(dx) <= gap + 12 && Math.abs(dy) < CFG.hero.depthTolerance && a.cool <= 0 && attackers < CFG.ai.maxAttackers && hero.state !== 'down') {
      a.state = 'attack'; a.t = 0; a.hitDone = false; attackers++; return;
    }
    if (mx || my) { a.x += mx * st.speed; a.y += my * st.speed * 0.7; a.y = Math.max(CFG.ground.top, Math.min(CFG.ground.bottom, a.y)); a.state = 'walk'; anim(a, k + '_walk', a.animT / 5, Math.floor(a.animT / 10) % 2 ? k + '_walk_a' : k + '_walk_b'); }
    else { a.state = 'idle'; anim(a, k + '_idle', a.animT / 6, k + '_idle'); }
  }

  // ---------- ステージ進行 ----------
  function updateStage() {
    const alive = actors.filter((a) => a.kind !== 'hero' && !a.dead);
    if (!locked) {
      const w = CFG.stage.waves[waveIx];
      if (w && hero.x >= w.at) {
        locked = true; lockRight = Math.min(stageLen, w.at + W - 100 + (w.at > camX ? 0 : 0)); camTarget = Math.min(stageLen - W, w.at - 100);
        for (const [kind, x, y] of w.enemies) { const e = spawn(kind, x, y); e.x = Math.min(e.x, lockRight - 40); }
        waveIx++; goT.visible = false;
      }
    } else if (alive.length === 0) {
      locked = false; sfx('coin');
      if (waveIx >= CFG.stage.waves.length) stageClear();
    }
    goT.visible = !locked && waveIx < CFG.stage.waves.length && (goBlink++ % 40 < 24) && gameState === 'play';
  }
  let camTarget = 0;
  function updateCamera() {
    if (!locked) camTarget = Math.max(0, Math.min(stageLen - W, hero.x - W * 0.4));
    camX += (camTarget - camX) * 0.12;
    const sx = shake > 0 ? (Math.random() - .5) * shake * 2 : 0, sy = shake > 0 ? (Math.random() - .5) * shake * 2 : 0;
    if (shake > 0) shake *= 0.85; if (shake < 0.5) shake = 0;
    world.x = -Math.round(camX) + sx; world.y = sy;
  }
  let comboShow = 0;
  function gameOver() { gameState = 'over'; msgT.text = 'GAME OVER\n\n[Z] でもう一回'; }
  function stageClear() { gameState = 'clear'; msgT.text = '煩悩、鎮圧。\n\nSTAGE CLEAR\n[Z] でもう一回'; playVoice('yamamori', 1.2); tissueStorm(hero.x, hero.y, 120); }

  // ---------- メインループ ----------
  app.ticker.maxFPS = 60;
  app.ticker.add(() => {
    if (gameState !== 'play') { updateFx(); updateCamera(); layoutHud(); if ((gameState === 'over' || gameState === 'clear') && pressed.KeyZ) location.reload(); if (gameState !== 'title') for (const k in pressed) pressed[k] = false; return; }
    if (hitStop > 0) { hitStop--; flash.alpha *= 0.85; updateFx(); updateCamera(); return; }
    flash.alpha *= 0.8;
    attackers = actors.filter((a) => a.kind !== 'hero' && !a.dead && a.state === 'attack').length;
    for (const a of actors) { if (a.dead) continue; if (a.kind === 'hero') updateHero(a); else updateEnemy(a); }
    for (const a of actors) {
      a.view.x = Math.round(a.x); a.view.y = Math.round(a.y);
      a.view.spr.y = -a.z; a.view.box.y = -a.z; a.view.spr.scale.x = Math.abs(a.view.spr.scale.x) * a.facing; a.view.box.scale.x = a.facing;
      a.view.shadow.scale.set(Math.max(0.4, 1 - a.z / 300));
      if (a.flashT > 0) { a.flashT--; a.view.spr.tint = a.flashT % 2 ? 0xff4444 : 0xffffff; } else a.view.spr.tint = a.kind === 'hero' && a.inv > 0 && a.inv % 4 < 2 ? 0x8888ff : 0xffffff;
      a.view.zIndex = a.y;
    }
    actorLayer.sortableChildren = true;
    for (const k in pressed) pressed[k] = false;
    updateStage(); updateCamera(); updateFx(); layoutHud();
    if (comboShow > 0) { comboShow--; comboT.alpha = Math.min(1, comboShow / 10); } else comboT.text = '';
  });

  // ---------- 開始（クリックで音を解放 → オープニング動画 → ロゴ → ゲーム） ----------
  const overlay = document.getElementById('overlay');
  const video = document.getElementById('video');
  app.ticker.stop();
  function showTitleThenStart() {
    video.style.display = 'none'; video.pause();
    const title = new PIXI.Container();
    const cover = new PIXI.Graphics().rect(0, 0, W, H).fill(0x000000); title.addChild(cover);
    if (hasTex('title_bg')) { const bg = new PIXI.Sprite(TEX['title_bg']); const sc = Math.max(W / bg.texture.width, H / bg.texture.height); bg.scale.set(sc); bg.anchor.set(0.5); bg.x = W / 2; bg.y = H / 2; title.addChild(bg);
      const dim = new PIXI.Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.35 }); title.addChild(dim); }
    let logo;
    if (hasTex('ui_logo')) { logo = new PIXI.Sprite(TEX['ui_logo']); logo.anchor.set(0.5); logo.width = 620; logo.scale.y = logo.scale.x; }
    else { logo = new PIXI.Text({ text: '煩悩児の変', style: { fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif', fontSize: 110, fontWeight: 'bold', fill: '#f4f4f4', stroke: { color: '#7a0000', width: 12 }, dropShadow: { color: '#000', blur: 8, distance: 6 } } }); logo.anchor.set(0.5); }
    logo.x = W / 2; logo.y = H / 2 - 50; logo.alpha = 0; title.addChild(logo);
    const startT = new PIXI.Text({ text: 'GAME START', style: { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: 40, fill: '#ffe066', stroke: { color: '#000', width: 7 }, letterSpacing: 4 } });
    startT.anchor.set(0.5); startT.x = W / 2; startT.y = H - 92; startT.visible = false; title.addChild(startT);
    const hint = new PIXI.Text({ text: isTouch ? 'タップでスタート' : 'Z キー / クリックでスタート', style: { fontFamily: 'sans-serif', fontSize: 16, fill: '#ddd', stroke: { color: '#000', width: 3 } } });
    hint.anchor.set(0.5); hint.x = W / 2; hint.y = H - 50; title.addChild(hint);
    app.stage.addChild(title);
    const baseScale = logo.scale.x;
    let n = 0; let go = false; let goN = 0;
    const onTap = () => { if (n > 20 && !go) { go = true; sfx('coin'); } };
    app.canvas.addEventListener('pointerdown', onTap);
    const tick = () => {
      n++;
      logo.alpha = Math.min(1, n / 25);
      const pop = n < 25 ? 1 + (25 - n) / 25 * 0.6 : 1 + Math.sin(n / 30) * 0.015;
      logo.scale.set(baseScale * pop);
      startT.visible = n > 30 && (go ? goN % 6 < 3 : n % 50 < 32);
      if (!go && n > 20 && (pressed.KeyZ || pressed.KeyX || pressed.Space)) { go = true; sfx('coin'); }
      for (const k in pressed) pressed[k] = false;
      if (go) { goN++; if (goN > 45) { app.ticker.remove(tick); app.canvas.removeEventListener('pointerdown', onTap); title.destroy({ children: true }); gameState = 'play'; } }
    };
    gameState = 'title'; app.ticker.add(tick); app.ticker.start();
  }
  overlay.addEventListener('pointerdown', start); window.addEventListener('keydown', start, { once: true });
  let started = false;
  function start() {
    if (started) return; started = true; AC.resume(); overlay.style.display = 'none';
    if (isTouch) {
      const el = document.documentElement;
      const fs = el.requestFullscreen || el.webkitRequestFullscreen;
      Promise.resolve(fs ? fs.call(el) : null).catch(() => {}).then(() => {
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
      });
    }
    if (manifest.images.opening) {
      video.src = 'assets/' + manifest.images.opening; video.style.display = 'block';
      video.play().catch(() => showTitleThenStart());
      video.onended = showTitleThenStart;
      const skip = (e) => { if (video.style.display !== 'none') { window.removeEventListener('keydown', skip); video.removeEventListener('pointerdown', skip); showTitleThenStart(); } };
      setTimeout(() => { window.addEventListener('keydown', skip); video.addEventListener('pointerdown', skip); }, 500);
    } else showTitleThenStart();
  }
})();
