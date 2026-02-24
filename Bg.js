/* ============================================
   NOVAPLAY — Interactive Particle Background
   bg.js — doit être chargé APRÈS le DOM
   ============================================ */

(function () {
    'use strict';

    const canvas = document.getElementById('novaplay-bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // ── Config ──────────────────────────────────────────────
    const CFG = {
        particleCount: 110,       // nombre de particules
        connectionDist: 140,      // distance max pour tracer une ligne
        mouseRadius: 160,         // rayon d'influence de la souris
        mouseRepel: 0.018,        // force de répulsion souris
        speed: 0.35,              // vitesse de base
        minSize: 1.0,             // taille min particule
        maxSize: 2.2,             // taille max
        // couleurs (violets + cyan discret)
        colors: [
            'rgba(139,92,246,',   // violet
            'rgba(167,139,250,',  // violet clair
            'rgba(109,40,217,',   // violet foncé
            'rgba(6,182,212,',    // cyan
            'rgba(192,132,252,',  // lilas
        ],
        // lueur "nebula" : 3 halos colorés qui dérivent lentement
        nebulae: [
            { x: 0.18, y: 0.22, r: 0.40, color: 'rgba(124,58,237,', a: 0.13 },
            { x: 0.80, y: 0.75, r: 0.38, color: 'rgba(139,92,246,', a: 0.10 },
            { x: 0.75, y: 0.18, r: 0.30, color: 'rgba(6,182,212,',  a: 0.07 },
        ],
    };

    // ── État ────────────────────────────────────────────────
    let W, H;
    let particles = [];
    let mouse = { x: -9999, y: -9999, active: false };
    let nebulaeState = [];
    let raf;
    let tick = 0;

    // ── Resize ──────────────────────────────────────────────
    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    // ── Mouse ───────────────────────────────────────────────
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    }, { passive: true });

    window.addEventListener('mouseleave', () => { mouse.active = false; }, { passive: true });

    // ── Particule ───────────────────────────────────────────
    function randomColor() {
        return CFG.colors[Math.floor(Math.random() * CFG.colors.length)];
    }

    function createParticle(forceX, forceY) {
        const angle  = Math.random() * Math.PI * 2;
        const speed  = CFG.speed * (0.4 + Math.random() * 0.9);
        return {
            x:   forceX !== undefined ? forceX : Math.random() * W,
            y:   forceY !== undefined ? forceY : Math.random() * H,
            vx:  Math.cos(angle) * speed,
            vy:  Math.sin(angle) * speed,
            r:   CFG.minSize + Math.random() * (CFG.maxSize - CFG.minSize),
            base: randomColor(),
            a:   0.4 + Math.random() * 0.55,
            // légère pulsation de taille
            pulse: Math.random() * Math.PI * 2,
            pulseSpeed: 0.008 + Math.random() * 0.012,
        };
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < CFG.particleCount; i++) {
            particles.push(createParticle());
        }
    }
    initParticles();

    // ── Nébuleuses ──────────────────────────────────────────
    // Chaque nébuleuse dérive lentement et oscille en opacité
    nebulaeState = CFG.nebulae.map(n => ({
        ...n,
        ox: n.x, oy: n.y,          // origine
        driftAngle: Math.random() * Math.PI * 2,
        driftSpeed: 0.00012 + Math.random() * 0.00008,
        driftAmp: 0.06 + Math.random() * 0.06,
        breathPhase: Math.random() * Math.PI * 2,
        breathSpeed: 0.004 + Math.random() * 0.003,
    }));

    function drawNebulae(t) {
        nebulaeState.forEach(n => {
            n.driftAngle += n.driftSpeed;
            n.breathPhase += n.breathSpeed;

            const cx = (n.ox + Math.cos(n.driftAngle) * n.driftAmp) * W;
            const cy = (n.oy + Math.sin(n.driftAngle * 0.7) * n.driftAmp * 0.6) * H;
            const rPx = n.r * Math.min(W, H);
            const alpha = n.a * (0.8 + 0.2 * Math.sin(n.breathPhase));

            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rPx);
            grd.addColorStop(0,   n.color + alpha + ')');
            grd.addColorStop(0.5, n.color + (alpha * 0.4) + ')');
            grd.addColorStop(1,   n.color + '0)');

            ctx.beginPath();
            ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
        });
    }

    // ── Mise à jour particules ───────────────────────────────
    function updateParticles() {
        const mr2 = CFG.mouseRadius * CFG.mouseRadius;

        particles.forEach(p => {
            // Pulsation
            p.pulse += p.pulseSpeed;
            const displayR = p.r * (1 + 0.18 * Math.sin(p.pulse));

            // Répulsion souris
            if (mouse.active) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < mr2 && d2 > 0) {
                    const strength = (1 - d2 / mr2) * CFG.mouseRepel;
                    p.vx += dx * strength;
                    p.vy += dy * strength;
                }
            }

            // Friction légère
            p.vx *= 0.995;
            p.vy *= 0.995;

            // Vitesse max
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            const maxSpd = CFG.speed * 2.5;
            if (speed > maxSpd) {
                p.vx = (p.vx / speed) * maxSpd;
                p.vy = (p.vy / speed) * maxSpd;
            }

            // Déplacement
            p.x += p.vx;
            p.y += p.vy;

            // Rebond sur les bords (wrap doux)
            const margin = 40;
            if (p.x < -margin)  p.x = W + margin;
            if (p.x > W + margin) p.x = -margin;
            if (p.y < -margin)  p.y = H + margin;
            if (p.y > H + margin) p.y = -margin;

            // Dessin de la particule
            ctx.beginPath();
            ctx.arc(p.x, p.y, displayR, 0, Math.PI * 2);
            ctx.fillStyle = p.base + p.a + ')';
            ctx.fill();
        });
    }

    // ── Connexions ──────────────────────────────────────────
    function drawConnections() {
        const cd2 = CFG.connectionDist * CFG.connectionDist;

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > cd2) continue;

                const t = 1 - d2 / cd2;  // 0..1
                // Couleur de la ligne : mélange des deux particules
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(139,92,246,${t * 0.20})`;
                ctx.lineWidth = t * 0.8;
                ctx.stroke();
            }
        }
    }

    // ── Connexions souris ────────────────────────────────────
    function drawMouseConnections() {
        if (!mouse.active) return;
        const md = CFG.mouseRadius;
        const md2 = md * md;

        particles.forEach(p => {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > md2) return;

            const t = 1 - d2 / md2;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `rgba(167,139,250,${t * 0.30})`;
            ctx.lineWidth = t * 1.0;
            ctx.stroke();
        });

        // Petit point à la position de la souris
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(167,139,250,0.5)';
        ctx.fill();
    }

    // ── Boucle principale ────────────────────────────────────
    function loop() {
        tick++;

        ctx.clearRect(0, 0, W, H);

        // 1. Fond uni
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, W, H);

        // 2. Nébuleuses (halos flous)
        drawNebulae(tick);

        // 3. Connexions (avant les particules = dessous)
        drawConnections();

        // 4. Connexions souris
        drawMouseConnections();

        // 5. Particules
        updateParticles();

        raf = requestAnimationFrame(loop);
    }

    loop();

    // Nettoyage si besoin (SPA, etc.)
    window.__novaplayBgDestroy = function () {
        cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', null);
        window.removeEventListener('resize', resize);
    };
})();