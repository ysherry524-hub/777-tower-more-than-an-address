/* ===========================================================
   777 TOWER — 55" portrait display controller
   Loops page 1 (20 s) → page 2 (8 s) forever; photos cycle every 2.5 s.
   ← → / Space / PageUp / PageDown step by hand (the loop carries on from there).
   =========================================================== */
(() => {
    const W = 2160, H = 3840;
    const HOLD = [20000, 8000];          // ms per page
    const LOOP_STEP = 2500;              // ms per photo on page 1
    const stage = document.getElementById('stage');
    const slides = [...stage.querySelectorAll('.slide')];
    let i = -1, timer;

    function fit() {
        const f = Math.min(innerWidth / W, innerHeight / H);
        stage.style.transform = `translate(${(innerWidth - W * f) / 2}px, ${(innerHeight - H * f) / 2}px) scale(${f})`;
    }
    addEventListener('resize', fit);
    fit();

    function go(n) {
        n = (n + slides.length) % slides.length;
        slides.forEach((s, k) => s.classList.toggle('active', k === n));
        document.body.classList.toggle('on-dark', slides[n].classList.contains('dark'));
        i = n;
        clearTimeout(timer);
        timer = setTimeout(() => go(i + 1), HOLD[n] || 8000);
    }

    addEventListener('keydown', e => {
        if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(i + 1); }
        if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(i - 1); }
    });

    /* page 1 photo loop */
    const photos = [...document.querySelectorAll('.loop figure')];
    let p = 0;
    photos[0].classList.add('shown');
    setInterval(() => {
        photos[p].classList.remove('shown');
        photos[p = (p + 1) % photos.length].classList.add('shown');
    }, LOOP_STEP);

    go((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
// Muted autoplay: retry on load and every second (WebKit drops autoplay while a slide fades in)
(() => {
    const play = () => document.querySelectorAll('video').forEach(v => { v.muted = true; if (v.paused) v.play().catch(() => {}); });
    addEventListener('load', play);
    setInterval(play, 1000);
})();
