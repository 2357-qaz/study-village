// Full-screen wish (gacha) presentation: starry sky → falling meteors that turn the colour of the
// best rarity in the pull → impact flash → one-by-one reveals → summary cards for multi-pulls.
// The draw itself has already been saved before this plays, so closing early never loses items.

export const RARITY_FX = {
  common: {color: '#8fd8b4', rgb: [143, 216, 180], stars: 2},
  rare: {color: '#6fa8ff', rgb: [111, 168, 255], stars: 3},
  epic: {color: '#bb82ff', rgb: [187, 130, 255], stars: 4},
  legendary: {color: '#ffcb5c', rgb: [255, 203, 92], stars: 5}
};
const ORDER = ['common', 'rare', 'epic', 'legendary'];
const WHITE = [226, 236, 255];
const rank = r => ORDER.indexOf(r);
const ease = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
  );

/* ---------- synthesized sound effects ---------- */

function sfx(ctx) {
  if (!ctx) return {whoosh() {}, boom() {}, reveal() {}};
  const out = ctx.createGain();
  out.gain.value = 0.55;
  out.connect(ctx.destination);
  const noise = seconds => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  };
  const tone = (freq, at, len, vol = 0.18, type = 'sine') => {
    const osc = ctx.createOscillator(),
      g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + len + 0.05);
  };
  return {
    // Rising airy sweep while the meteor falls.
    whoosh(seconds) {
      const at = ctx.currentTime,
        src = noise(seconds + 0.3),
        filter = ctx.createBiquadFilter(),
        g = ctx.createGain();
      filter.type = 'bandpass';
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(380, at);
      filter.frequency.exponentialRampToValueAtTime(3200, at + seconds);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.32, at + seconds * 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, at + seconds + 0.25);
      src.connect(filter).connect(g).connect(out);
      src.start(at);
    },
    // Deep thump plus a bright sparkle on impact.
    boom(rarity) {
      const at = ctx.currentTime,
        osc = ctx.createOscillator(),
        g = ctx.createGain();
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.5);
      g.gain.setValueAtTime(0.5, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + 0.8);
      const lift = rank(rarity) * 2;
      [0, 4, 7, 12].forEach((step, i) =>
        tone(523.25 * 2 ** ((step + lift) / 12), at + 0.05 + i * 0.05, 0.9, 0.08)
      );
    },
    // Arpeggio whose length and brightness grow with rarity.
    reveal(rarity) {
      const at = ctx.currentTime + 0.05,
        steps = [
          [0, 7],
          [0, 4, 7],
          [0, 4, 7, 12],
          [0, 4, 7, 11, 14, 19]
        ][rank(rarity)];
      steps.forEach((step, i) => {
        tone(392 * 2 ** (step / 12), at + i * 0.085, 1.4, 0.16);
        tone(784 * 2 ** (step / 12), at + i * 0.085, 0.9, 0.05, 'triangle');
      });
    }
  };
}

/* ---------- the stage ---------- */

// opts: {thumb(id) → Promise<url|null>, viewer(el, id) → {dispose}|null, iconHTML(item) → string,
//        rarityName(r) → string, audio: AudioContext|null, reduceMotion: boolean}
export function playWish(host, results, opts) {
  return new Promise(resolve => {
    const best = results.reduce((b, r) => (rank(r.rarity) > rank(b) ? r.rarity : b), 'common');
    const multi = results.length > 1;
    const sound = sfx(opts.audio);
    host.innerHTML = `
      <canvas class="ws-sky"></canvas>
      <div class="ws-flash"></div>
      <button class="ws-skip" type="button">跳过 <span aria-hidden="true">›</span></button>
      <div class="ws-reveal" hidden>
        <div class="ws-rays"></div>
        <div class="ws-art"></div>
        <div class="ws-info">
          <div class="ws-stars"></div>
          <h2 class="ws-name"></h2>
          <p class="ws-meta"></p>
          <p class="ws-text"></p>
        </div>
        <span class="ws-new">NEW</span>
        <p class="ws-tap">点击继续</p>
      </div>
      <div class="ws-summary" hidden>
        <p class="ws-summary-title">本次寻得</p>
        <div class="ws-cards"></div>
        <button class="ws-done" type="button">收进奇物柜</button>
      </div>`;
    const $ = s => host.querySelector(s);
    const canvas = $('.ws-sky'),
      g = canvas.getContext('2d');
    let W = 0,
      H = 0,
      dpr = 1,
      alive = true,
      raf = 0,
      viewer = null,
      skipped = false,
      wake = null; // resolver of the phase currently waiting

    /* --- sky simulation --- */
    const stars = Array.from({length: 170}, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.3 + 0.3,
      p: Math.random() * Math.PI * 2,
      s: 0.6 + Math.random() * 1.8
    }));
    let meteors = [],
      particles = [],
      rings = [],
      tint = WHITE,
      tintGlow = 0;
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = host.clientWidth;
      H = host.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    function burst(x, y, color, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2,
          v = speed * (0.3 + Math.random());
        particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 1,
          decay: 0.5 + Math.random() * 0.7,
          size: 1 + Math.random() * 2.6,
          color
        });
      }
    }
    function frame(ms) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const t = ms / 1000,
        dt = 1 / 60;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#081329');
      sky.addColorStop(0.55, '#13284a');
      sky.addColorStop(1, '#22405a');
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // nebula wash, tinted by the current rarity glow
      g.globalCompositeOperation = 'lighter';
      const neb = g.createRadialGradient(W * 0.5, H * 0.52, 0, W * 0.5, H * 0.52, Math.max(W, H) * 0.7);
      neb.addColorStop(0, rgba(tint, 0.1 + tintGlow * 0.3));
      neb.addColorStop(1, rgba(tint, 0));
      g.fillStyle = neb;
      g.fillRect(0, 0, W, H);
      for (const s of stars) {
        g.fillStyle = `rgba(230,236,255,${0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))})`;
        g.fillRect(s.x * W, s.y * H, s.r, s.r);
      }
      // meteors
      for (const m of meteors) {
        const p = Math.min(1, Math.max(0, (t - m.t0) / m.dur));
        if (p <= 0) continue;
        const e = p * p * (1.6 - 0.6 * p),
          u = 1 - e;
        const x = u * u * m.a[0] + 2 * u * e * m.c[0] + e * e * m.b[0],
          y = u * u * m.a[1] + 2 * u * e * m.c[1] + e * e * m.b[1];
        const col = mix(WHITE, m.color, ease(Math.min(1, Math.max(0, (p - 0.38) / 0.35))));
        m.trail.push([x, y]);
        if (m.trail.length > 44) m.trail.shift();
        g.lineCap = 'round';
        // wide soft glow first, then the bright core
        for (const [scale, alpha] of [
          [3.2, 0.12],
          [1, 0.8]
        ])
          for (let i = 1; i < m.trail.length; i++) {
            const k = i / m.trail.length;
            g.strokeStyle = rgba(scale > 1 ? col : mix(col, [255, 255, 255], 0.35), k * alpha);
            g.lineWidth = k * m.w * scale;
            g.beginPath();
            g.moveTo(...m.trail[i - 1]);
            g.lineTo(...m.trail[i]);
            g.stroke();
          }
        const head = g.createRadialGradient(x, y, 0, x, y, m.w * 4);
        head.addColorStop(0, 'rgba(255,255,255,1)');
        head.addColorStop(0.25, rgba(col, 0.9));
        head.addColorStop(1, rgba(col, 0));
        g.fillStyle = head;
        g.beginPath();
        g.arc(x, y, m.w * 4, 0, Math.PI * 2);
        g.fill();
        if (Math.random() < 0.7)
          particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 40,
            vy: (Math.random() - 0.3) * 40,
            life: 0.8,
            decay: 1.4,
            size: 1 + Math.random() * 1.6,
            color: col
          });
      }
      for (const r of rings) {
        r.r += r.v * dt;
        r.life -= dt * 1.2;
        if (r.life <= 0) continue;
        g.strokeStyle = rgba(r.color, r.life * 0.8);
        g.lineWidth = 3 + r.life * 6;
        g.beginPath();
        g.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, Math.PI * 2);
        g.stroke();
      }
      rings = rings.filter(r => r.life > 0);
      for (const q of particles) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 14 * dt;
        q.vx *= 0.985;
        q.life -= q.decay * dt;
        if (q.life <= 0) continue;
        g.fillStyle = rgba(q.color, q.life);
        g.beginPath();
        g.arc(q.x, q.y, q.size * (0.4 + q.life), 0, Math.PI * 2);
        g.fill();
      }
      particles = particles.filter(q => q.life > 0);
      tintGlow = Math.max(0, tintGlow - dt * 0.35);
    }
    raf = requestAnimationFrame(frame);

    /* --- flow control --- */
    const wait = ms =>
      new Promise(r => {
        const id = setTimeout(r, ms);
        wake = () => {
          clearTimeout(id);
          r();
        };
      });
    const waitTap = () =>
      new Promise(r => {
        const armedAt = performance.now();
        wake = () => r();
        host.onclick = e => {
          if (e.target.closest('.ws-skip, .ws-done') || performance.now() - armedAt < 450) return;
          r();
        };
      });
    $('.ws-skip').onclick = () => {
      skipped = true;
      wake?.();
    };
    const flash = (color, strength = 1) => {
      const f = $('.ws-flash');
      f.style.background = `radial-gradient(circle at 50% 50%, #fff 0%, ${color} 40%, transparent 75%)`;
      f.style.setProperty('--flash', strength);
      f.classList.remove('on');
      void f.offsetWidth;
      f.classList.add('on');
    };
    function disposeViewer() {
      try {
        viewer?.dispose?.();
      } catch {}
      viewer = null;
    }

    async function fall() {
      const fx = RARITY_FX[best],
        now = performance.now() / 1000,
        n = multi ? 5 : 1,
        dur = 2.1;
      meteors = Array.from({length: n}, (_, i) => {
        const spread = (i - (n - 1) / 2) * Math.min(W, 520) * 0.09;
        return {
          t0: now + i * 0.13,
          dur: dur - i * 0.05,
          a: [W * 1.08 + spread, -H * 0.12 - i * 18],
          c: [W * 0.78 + spread, H * 0.2],
          b: [W * 0.5 + spread * 0.25, H * 0.52],
          color: fx.rgb,
          w: i === Math.floor(n / 2) ? 8 : 4.5,
          trail: []
        };
      });
      sound.whoosh(dur);
      await wait(dur * 1000 + 220);
    }
    async function impact() {
      const fx = RARITY_FX[best];
      meteors = [];
      tint = fx.rgb;
      tintGlow = 1;
      flash(fx.color, 1);
      rings.push({x: W / 2, y: H * 0.52, r: 10, v: Math.max(W, H) * 1.3, life: 1, color: fx.rgb});
      rings.push({x: W / 2, y: H * 0.52, r: 4, v: Math.max(W, H) * 0.7, life: 1, color: WHITE});
      burst(W / 2, H * 0.52, fx.rgb, best === 'legendary' ? 160 : 90, 340);
      sound.boom(best);
      await wait(best === 'legendary' ? 1100 : 750);
    }
    async function reveal(item) {
      const fx = RARITY_FX[item.rarity],
        box = $('.ws-reveal'),
        art = $('.ws-art');
      host.style.setProperty('--fx', fx.color);
      host.style.setProperty('--fx-rgb', fx.rgb.join(','));
      host.dataset.rarity = item.rarity;
      tint = fx.rgb;
      tintGlow = 0.8;
      box.hidden = false;
      box.classList.remove('in');
      void box.offsetWidth;
      box.classList.add('in');
      $('.ws-name').textContent = item.name;
      $('.ws-meta').textContent = `${opts.rarityName(item.rarity)} · ${item.isNew ? '首次发现' : '再次相遇'}`;
      $('.ws-text').textContent = item.text;
      $('.ws-new').hidden = !item.isNew;
      $('.ws-stars').innerHTML = Array.from({length: fx.stars}, (_, i) => `<i style="--i:${i}">★</i>`).join(
        ''
      );
      disposeViewer();
      art.innerHTML = opts.iconHTML(item);
      flash(fx.color, item.rarity === 'legendary' ? 1 : 0.7);
      burst(
        W / 2,
        H * 0.42,
        fx.rgb,
        item.rarity === 'legendary' ? 140 : 60,
        item.rarity === 'legendary' ? 300 : 200
      );
      if (item.rarity === 'legendary')
        rings.push({x: W / 2, y: H * 0.42, r: 6, v: Math.max(W, H), life: 1, color: fx.rgb});
      sound.reveal(item.rarity);
      if (!opts.reduceMotion && opts.viewer)
        try {
          art.innerHTML = '';
          viewer = opts.viewer(art, item.id) || null;
        } catch {
          viewer = null;
        }
      if (!viewer) art.innerHTML = opts.iconHTML(item);
      if (!viewer)
        opts
          .thumb(item.id)
          .then(url => {
            if (url && art.isConnected && !viewer) art.innerHTML = `<img src="${url}" alt="">`;
          })
          .catch(() => {});
      await waitTap();
      disposeViewer();
    }
    async function summary() {
      const box = $('.ws-summary');
      $('.ws-reveal').hidden = true;
      $('.ws-skip').hidden = true;
      host.dataset.rarity = best;
      tint = RARITY_FX[best].rgb;
      tintGlow = 0.5;
      const sorted = [...results].sort((a, b) => rank(b.rarity) - rank(a.rarity));
      $('.ws-cards').innerHTML = sorted
        .map(
          (it, i) => `<div class="ws-card r-${it.rarity}" style="--d:${i}">
            <span class="ws-card-art" data-id="${esc(it.id)}">${opts.iconHTML(it)}</span>
            <span class="ws-card-stars">${'★'.repeat(RARITY_FX[it.rarity].stars)}</span>
            <b>${esc(it.name)}</b>${it.isNew ? '<em>NEW</em>' : ''}</div>`
        )
        .join('');
      host.querySelectorAll('.ws-card-art').forEach(el =>
        opts
          .thumb(el.dataset.id)
          .then(url => {
            if (url) el.innerHTML = `<img src="${url}" alt="">`;
          })
          .catch(() => {})
      );
      box.hidden = false;
      await new Promise(r => {
        wake = r;
        $('.ws-done').onclick = r;
      });
    }

    function finish() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposeViewer();
      host.onclick = null;
      resolve();
    }

    (async () => {
      try {
        if (!opts.reduceMotion) {
          await fall();
          meteors = [];
          if (!skipped) await impact();
        }
        for (const item of results) {
          if (skipped && multi) break;
          await reveal(item);
        }
        if (multi) await summary();
      } finally {
        finish();
      }
    })();
  });
}
