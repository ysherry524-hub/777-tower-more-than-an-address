/* ===========================================================
   777 TOWER — presentation controller
   Keys: ← → Space PageUp/PageDown Home End · Esc closes / exits
         P present · F fullscreen · E edit text
   =========================================================== */
(() => {
    const stage = document.getElementById('stage');
    const slides = [...stage.querySelectorAll('.slide')];
    const N = slides.length;
    const pad = n => String(n).padStart(2, '0');
    const $ = id => document.getElementById(id);
    const dots = $('dots'), lb = $('lightbox');
    let i = -1;
    const AUTO = {};                     // per-slide autoplay hooks (filled below)

    /* === STAGE SCALING: 1920×1080 fitted to the window === */
    function fit() {
        const f = Math.min(innerWidth / 1920, innerHeight / 1080);
        stage.style.transform = `translate(${(innerWidth - 1920 * f) / 2}px, ${(innerHeight - 1080 * f) / 2}px) scale(${f})`;
    }
    addEventListener('resize', fit);
    fit();

    /* === NAVIGATION === */
    slides.forEach((_, k) => {
        const b = document.createElement('button');
        b.textContent = pad(k + 1);
        b.setAttribute('aria-label', `Slide ${k + 1}`);
        b.onclick = () => go(k);
        dots.appendChild(b);
    });
    $('total').textContent = pad(N);

    function go(n) {
        n = Math.max(0, Math.min(N - 1, n));
        if (n === i) return;
        closeLb();
        slides.forEach((s, k) => s.classList.toggle('active', k === n));
        [...dots.children].forEach((d, k) => d.classList.toggle('on', k === n));
        i = n;
        $('cur').textContent = pad(n + 1);
        stage.classList.toggle('dark', slides[n].classList.contains('dark'));
        $('explore').classList.toggle('on', slides[n].hasAttribute('data-explore'));
        history.replaceState(null, '', '#' + (n + 1));
    }

    /* === IN-SLIDE SELECTION ===
       Click [data-pick=k] → slide gets data-sel=k and every [data-k=k] in it gets .on.
       Slides with data-toggle can be cleared by clicking the active item again. */
    function select(s, k) {
        s.dataset.sel = k;
        s.querySelectorAll('[data-k]').forEach(el => {
            el.classList.toggle('on', el.dataset.k === k);
            if (el.hasAttribute('data-pick')) el.setAttribute('aria-pressed', el.dataset.k === k);
        });
        // slide 05: the big frame shows the room for the selected stage (keeps the last room otherwise)
        const layers = [...s.querySelectorAll('[data-rooms]')];
        const hit = layers.find(l => l.dataset.rooms.split(' ').includes(k));
        if (hit) layers.forEach(l => l.classList.toggle('shown', l === hit));
    }
    slides.forEach(s => select(s, s.dataset.sel || ''));

    stage.addEventListener('click', e => {
        const p = e.target.closest('[data-pick]');
        if (p) {
            const s = p.closest('.slide');
            const k = s.dataset.sel === p.dataset.pick && s.hasAttribute('data-toggle') ? '' : p.dataset.pick;
            select(s, k);
            return;
        }
        const z = e.target.closest('[data-zoom]');
        if (z) return openLb(z);
        if (e.target.closest('#lightbox')) closeLb();
    });

    /* === LIGHTBOX: enlarges a frame (slide 05) === */
    function openLb(fig) {
        const c = fig.cloneNode(true);
        ['data-zoom', 'tabindex', 'role', 'aria-label'].forEach(a => c.removeAttribute(a));
        c.classList.remove('m');
        c.style.cssText = `top:0;right:0;bottom:0;left:0;--pos:${fig.style.getPropertyValue('--pos') || '50% 50%'}`;
        $('lbFrame').replaceChildren(c);
        lb.classList.add('open');
        lb.setAttribute('aria-hidden', 'false');
    }
    function closeLb() {
        if (!lb.classList.contains('open')) return false;
        lb.classList.remove('open');
        lb.setAttribute('aria-hidden', 'true');
        return true;
    }

    /* === PRESENT + FULLSCREEN === */
    const root = document.documentElement;
    const canFs = !!root.requestFullscreen;
    function fullscreen() {
        if (!canFs) return;
        document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen().catch(() => {});
    }
    function present(on = !document.body.classList.contains('presenting')) {
        document.body.classList.toggle('presenting', on);
        $('presentBtn').textContent = on ? '退出' : '演示';
        if (on && canFs && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
        if (!on && document.fullscreenElement) document.exitFullscreen();
    }
    $('presentBtn').onclick = () => present();
    $('fsBtn').onclick = fullscreen;
    if (!canFs) $('fsBtn').hidden = true;

    /* === LOOK SWITCHER (temporary, until one theme is chosen) === */
    const THEMES = ['a', 'b', 'c'];
    function setTheme(t) {
        root.dataset.theme = t;
        $('themeBtn').textContent = '风格 · ' + t.toUpperCase();
        try { localStorage.setItem('777-theme', t); } catch (_) {}
    }
    function cycleTheme() { setTheme(THEMES[(THEMES.indexOf(root.dataset.theme) + 1) % THEMES.length]); }
    $('themeBtn').onclick = cycleTheme;
    try { const t = localStorage.getItem('777-theme'); if (THEMES.includes(t)) setTheme(t); } catch (_) {}

    /* === KEYBOARD === */
    addEventListener('keydown', e => {
        if (editing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); return save(); }
        if (e.target.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
        switch (e.key) {
            case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); go(i + 1); break;
            case 'ArrowLeft': case 'PageUp': e.preventDefault(); go(i - 1); break;
            case 'Home': e.preventDefault(); go(0); break;
            case 'End': e.preventDefault(); go(N - 1); break;
            case 'Escape': closeLb() || present(false); break;
            case 'Enter': if (e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } break;
            case 'p': case 'P': present(); break;
            case 'f': case 'F': fullscreen(); break;
            case 'e': case 'E': toggleEdit(); break;
            case 't': case 'T': cycleTheme(); break;
        }
    });

    /* === TRACKPAD / WHEEL (one slide per gesture) === */
    let wheelLock = 0;
    addEventListener('wheel', e => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(d) < 25 || Date.now() < wheelLock || lb.classList.contains('open')) return;
        wheelLock = Date.now() + 1200;
        go(i + (d > 0 ? 1 : -1));
    }, { passive: true });

    /* === TOUCH SWIPE === */
    let tx = null, ty = 0;
    addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    addEventListener('touchend', e => {
        if (tx === null) return;
        const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
        tx = null;
    });

    /* === HERO TYPE (slide 01) ===
       Each letter morphs continuously between two weight/width states. Its box width is driven from the
       two widths measured once at load (Chrome mis-measures letters mid-morph), so spacing stays exact.
       On arrival a sweep runs across line 1 then line 2 once; a real pointer takes over when it moves. */
    const hero = document.querySelector('.vf');
    let heroEnter = 0;
    const HERO_SWEEP = 1500;                                         // ms per line
    if (hero) {
        const chars = [];
        hero.querySelectorAll('.ln').forEach(ln => {
            const [w0, w1] = ln.dataset.w.split(',').map(Number), [x0, x1] = ln.dataset.x.split(',').map(Number);
            const text = ln.textContent; ln.textContent = '';
            [...text].forEach(c => {
                const s = document.createElement('span'), g = c === ' ' ? '\u00a0' : c;
                s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
                s.innerHTML = `<i class="g0">${g}</i>`;
                ln.appendChild(s);
                chars.push({ s, g: s.firstChild, w0, w1, x0, x1, v: -1, a: 0, b: 0, ln });
            });
        });
        const still = false /* always animate: this deck is shown on screens */;
        let measured = false, lineGeo = [];
        const fontsOk = Promise.race([document.fonts.ready.then(() => document.fonts.load('400 100px Archivo')), new Promise(r => setTimeout(r, 2500))]);
        const measure = () => {
            const put = (c, q) => { c.g.style.fontWeight = (c.w0 + (c.w1 - c.w0) * q).toFixed(0); c.g.style.fontStretch = (c.x0 + (c.x1 - c.x0) * q).toFixed(1) + '%'; };
            chars.forEach(c => { put(c, 1); c.b = c.g.offsetWidth; put(c, 0); c.a = c.g.offsetWidth; c.put = put; c.v = 0; c.s.style.width = c.a + 'px'; });
            lineGeo = [...hero.querySelectorAll('.ln')].map(ln => ({ ln, x: hero.offsetLeft + ln.offsetLeft, y: hero.offsetTop + ln.offsetTop + ln.offsetHeight / 2, w: ln.offsetWidth }));
            measured = true;
        };
        fontsOk.then(measure);
        document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', measure);   // font arrived late → re-measure
        let px = -1e4, py = -1e4, lastMove = -1e9, wasOn = false;
        const track = (x, y) => { px = x; py = y; lastMove = performance.now(); };
        addEventListener('pointermove', e => track(e.clientX, e.clientY), { passive: true });
        addEventListener('touchmove', e => track(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
        const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        (function frame(t) {
            const on = slides[i] && slides[i].classList.contains('s1');
            if (on && !wasOn) heroEnter = t + 500;                       // let the title fade in first
            wasOn = on;
            if (on && measured) {
                // everything in 1920×1080 stage px — no getBoundingClientRect per letter
                const R = 130;
                let cx = -1e4, cy = -1e4;
                if (t - lastMove < 2500) {                               // real pointer → stage px
                    const f = Math.min(innerWidth / 1920, innerHeight / 1080);
                    cx = (px - (innerWidth - 1920 * f) / 2) / f; cy = (py - (innerHeight - 1080 * f) / 2) / f;
                } else if (!still) {                                     // one sweep: line 1 → line 2
                    const k = (t - heroEnter) / HERO_SWEEP;
                    if (k >= 0 && k < 2) {
                        const L = lineGeo[k < 1 ? 0 : 1], p = ease(k % 1);
                        cx = L.x - 120 + (L.w + 240) * p; cy = L.y;
                    }
                }
                lineGeo.forEach(L => {
                    let x = L.x;
                    chars.forEach(c => {
                        if (c.ln !== L.ln) return;
                        const w = c.a + (c.b - c.a) * c.v, mid = x + w / 2; x += w;
                        const d = Math.hypot(mid - cx, (L.y - cy) * 2.2);
                        const target = Math.exp(-((d / R) ** 2));
                        const nv = Math.abs(target - c.v) < .002 ? target : c.v + (target - c.v) * .14;
                        if (nv === c.v) return;
                        c.v = nv;
                        c.put(c, c.v);
                        c.s.style.width = (c.a + (c.b - c.a) * c.v).toFixed(2) + 'px';
                        c.g.style.color = c.v > .02 ? `color-mix(in srgb, var(--terra) ${(c.v * 100).toFixed(0)}%, var(--espresso))` : '';
                    });
                });
            }
            requestAnimationFrame(frame);
        })(0);
    }

    /* === PAGE 03: marker → leader line → HUD panel (decoding heading, counting numbers) === */
    const s3 = document.querySelector('.s3');
    if (s3) {
        const line = $('leadLine'), end = $('leadEnd'), svg = line.closest('svg');
        const ANCHOR_X = 700, ANCHOR_Y = 318;                 // right edge of the HUD heading
        const GLYPHS = '0123456789ABCDEF#/<>_';
        function show3(k) {
            select(s3, k);
            const hot = s3.querySelector(`.hot[data-k="${k}"]`); if (!hot) return;
            const hx = +hot.dataset.x, hy = +hot.dataset.y;
            line.setAttribute('points', `${hx - 18},${hy} ${hx - 90},${hy} ${ANCHOR_X + 60},${ANCHOR_Y} ${ANCHOR_X},${ANCHOR_Y}`);
            line.setAttribute('pathLength', '1');
            end.setAttribute('cx', ANCHOR_X); end.setAttribute('cy', ANCHOR_Y);
            svg.classList.remove('draw'); void svg.getBoundingClientRect(); svg.classList.add('draw');
            const hud = s3.querySelector(`.hud[data-k="${k}"]`);
            hud.querySelectorAll('.scr').forEach(el => {          // decode effect
                const txt = el.dataset.text; let f = 0;
                const t = setInterval(() => {
                    f++;
                    el.textContent = [...txt].map((c, n) => c === ' ' || n < f - 8 ? c : GLYPHS[Math.random() * GLYPHS.length | 0]).join('');
                    if (f > txt.length + 8) { clearInterval(t); el.textContent = txt; }
                }, 45);
            });
            hud.querySelectorAll('.cnt').forEach(el => {          // count up
                const to = +el.dataset.to, from = to > 1000 ? to - 60 : 0, t0 = performance.now() + 900;
                (function tick(t) {
                    const p = Math.min(1, Math.max(0, (t - t0) / 1100)), e = 1 - Math.pow(1 - p, 3);
                    el.textContent = Math.round(from + (to - from) * e);
                    if (p < 1) requestAnimationFrame(tick);
                })(performance.now());
            });
        }
        s3.addEventListener('click', e => { const h = e.target.closest('.hot'); if (h) show3(h.dataset.pick); });
        AUTO.s3 = show3;
    }

    /* === PAGE 04: tilt + spotlight, magnetic words, band sweep, idle auto-cycle === */
    const s4 = document.querySelector('.s4'), st4 = $('stage4');
    if (s4 && st4) {
        const ORDER = ['work', 'meet', 'connect', 'experience'];
        const still = false /* always animate: this deck is shown on screens */;
        const sweep = () => { if (still) return; st4.classList.remove('wipe'); void st4.offsetWidth; st4.classList.add('wipe'); };
        let lastTouch = 0, wasActive = false;
        s4.addEventListener('click', e => { if (e.target.closest('[data-pick]')) { lastTouch = performance.now(); sweep(); } });
        st4.addEventListener('pointermove', e => {
            const r = st4.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
            st4.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
            st4.style.setProperty('--my', (y * 100).toFixed(1) + '%');
            if (!still) { st4.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg'); st4.style.setProperty('--ry', ((x - .5) * 9).toFixed(2) + 'deg'); }
        });
        st4.addEventListener('pointerleave', () => { st4.style.setProperty('--rx', '0deg'); st4.style.setProperty('--ry', '0deg'); });
        // magnetic words
        const words = [...s4.querySelectorAll('.w4')];
        addEventListener('pointermove', e => {
            if (still || !s4.classList.contains('active')) return;
            const scale = stage.getBoundingClientRect().width / 1920;
            words.forEach(b => {
                const w = b.querySelector('.w'), r = w.getBoundingClientRect();
                const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) / scale;
                const k = d < 220 ? (1 - d / 220) * .35 : 0;
                w.style.setProperty('--tx', (dx / scale * k).toFixed(1) + 'px');
                w.style.setProperty('--ty', (dy / scale * k).toFixed(1) + 'px');
            });
        }, { passive: true });
        // autoplay: pick a word, sweep the card, aim spotlight/tilt at that word's corner, pull the word in
        const CORNER = { work: [18, 22, -1, 1], meet: [82, 22, -1, -1], connect: [18, 78, 1, 1], experience: [82, 78, 1, -1] };
        AUTO.s4 = k => {
            select(s4, k); sweep();
            const [mx, my, rx, ry] = CORNER[k];
            st4.style.setProperty('--mx', mx + '%'); st4.style.setProperty('--my', my + '%');
            if (!still) { st4.style.setProperty('--rx', rx * 3 + 'deg'); st4.style.setProperty('--ry', ry * -4 + 'deg'); }
            st4.classList.add('auto');
            words.forEach(b => {
                const w = b.querySelector('.w'), on = b.dataset.k === k;
                w.style.setProperty('--tx', on && !still ? (b.classList.contains('L') ? 14 : -14) + 'px' : '0px');
                w.style.setProperty('--ty', '0px');
            });
        };
    }

    /* === PAGE 02 LOOP: the big photo cycles through the rooms nonstop while the slide is shown === */
    const s5 = document.querySelector('.s5');
    if (s5) {
        const rooms = [...s5.querySelectorAll('[data-rooms]')].map(l => l.dataset.rooms);
        let r = 0;
        setInterval(() => { if (s5.classList.contains('active')) select(s5, rooms[r = (r + 1) % rooms.length]); }, 2600);
    }

    /* === AUTOPLAY ===
       Every slide plays its own interactions, then advances; loops after the last slide.
       Any click / key / wheel / touch pauses it for 20 s. A (or the "Auto" button) switches it off/on. */
    const PLAN = {
        s1: { hold: 4400 },                                              // title sweep (0.5 + 2×1.5 s) + a beat
        s2: { keys: ['work', 'connect', 'experience'], intro: 900, step: 1500 },
        s3: { keys: ['building', 'location', 'city'], intro: 1100, step: 3200 },
        s4: { keys: ['work', 'meet', 'connect', 'experience'], intro: 1100, step: 2000 },
        s5: { hold: 12000 },                                             // photos loop on their own (PAGE 02 LOOP)
        s6: { keys: ['business', 'community', 'culture', 'brands'], intro: 1000, step: 1700 },
        s8: { keys: ['people', 'biz', 'comm', 'events'], intro: 3800, step: 1200 },
        s9: { hold: 4500 },
    };
    const TAIL = 900;
    let autoOn = false, pausedUntil = 0, slideT0 = performance.now(), lastSlide = -1, lastStep = -1;
    const planOf = s => PLAN[Object.keys(PLAN).find(c => s.classList.contains(c))] || { hold: 6000 };
    const pauseAuto = () => { pausedUntil = performance.now() + 20000; };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, e => {
        if (ev === 'keydown' && (e.key === 'a' || e.key === 'A')) return;
        if (e.target.closest && e.target.closest('#autoBtn')) return;
        pauseAuto();
    }, { passive: true }));
    function setAuto(on) { autoOn = on; $('autoBtn').textContent = '自动 · ' + (on ? '开' : '关'); slideT0 = performance.now(); lastStep = -1; }
    $('autoBtn').onclick = e => { e.stopPropagation(); setAuto(!autoOn); pausedUntil = 0; };
    addEventListener('keydown', e => { if ((e.key === 'a' || e.key === 'A') && !e.target.isContentEditable && !e.metaKey && !e.ctrlKey) setAuto(!autoOn); });
    setInterval(() => {
        const now = performance.now();
        if (i !== lastSlide) { lastSlide = i; slideT0 = now; lastStep = -1; if (slides[i].hasAttribute('data-toggle')) select(slides[i], ''); }
        if (!autoOn || editing || now < pausedUntil) { if (now < pausedUntil) { slideT0 = now; lastStep = -1; } return; }
        const s = slides[i], p = planOf(s), t = now - slideT0;
        if (p.hold) { if (t > p.hold) go(i + 1 < N ? i + 1 : 0); return; }
        const n = Math.floor((t - p.intro) / p.step);
        if (n >= 0 && n < p.keys.length && n !== lastStep) {
            lastStep = n;
            const k = p.keys[n], hook = AUTO[[...s.classList].find(c => AUTO[c])];
            hook ? hook(k) : select(s, k);
        }
        if (t > p.intro + p.keys.length * p.step + TAIL) go(i + 1 < N ? i + 1 : 0);
    }, 150);

    /* === PHOTOS: assets/<name>.jpg|jpeg|png|webp replaces the placeholder === */
    document.querySelectorAll('.ph[data-src]').forEach(ph => {
        const exts = ['jpg', 'jpeg', 'png', 'webp'];
        (function tryExt(k) {
            if (k >= exts.length) return;
            const url = `${ph.dataset.src}.${exts[k]}`, img = new Image();
            img.onload = () => { ph.querySelector('.ph-media').style.backgroundImage = `url("${url}")`; ph.classList.add('has-img'); };
            img.onerror = () => tryExt(k + 1);
            img.src = url;
        })(0);
    });

    /* === INLINE TEXT EDITING (E) — Cmd/Ctrl+S downloads an updated index.html === */
    const EDITABLE = '.slide h1, .slide h2, .slide p:not(.pcap), .slide .pcap .swap, .slide dd, .slide .ann';
    let editing = false;
    function toggleEdit(on = !editing) {
        editing = on;
        document.body.classList.toggle('editing', on);
        document.querySelectorAll(EDITABLE).forEach(el => on ? el.setAttribute('contenteditable', 'true') : el.removeAttribute('contenteditable'));
    }
    function save() {
        toggleEdit(false);
        const doc = root.cloneNode(true);
        doc.querySelector('#stage').removeAttribute('style');
        doc.querySelector('#stage').classList.remove('dark');
        doc.querySelector('#dots').replaceChildren();
        doc.querySelector('#lbFrame').replaceChildren();
        doc.querySelectorAll('.has-img').forEach(el => el.classList.remove('has-img'));
        doc.querySelectorAll('.ph-media').forEach(el => el.removeAttribute('style'));
        doc.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
        doc.querySelectorAll('.on').forEach(el => el.classList.remove('on'));
        doc.querySelector('body').className = '';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['<!DOCTYPE html>\n' + doc.outerHTML], { type: 'text/html' }));
        a.download = 'index.html';
        a.click();
        toggleEdit(true);
    }

    go((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
// Muted autoplay: retry on load, when WeChat's bridge is ready, on the first touch, and whenever the tab becomes visible again
(() => {
    const play = () => document.querySelectorAll('video').forEach(v => { v.muted = true; if (v.paused) v.play().catch(() => {}); });
    play();
    addEventListener('load', play);
    if (window.WeixinJSBridge) WeixinJSBridge.invoke('getNetworkType', {}, play);
    else document.addEventListener('WeixinJSBridgeReady', () => WeixinJSBridge.invoke('getNetworkType', {}, play));
    ['touchstart', 'pointerdown', 'click'].forEach(ev => addEventListener(ev, play, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
    setInterval(play, 1000);   // WebKit drops autoplay while the slide is still fading in (visibility:hidden) and never resumes it
})();
