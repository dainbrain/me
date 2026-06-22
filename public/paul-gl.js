// Live gold particle field. Raw WebGL points + CPU 2D physics, no dependencies, view-sourceable.
// The gold texture is sampled into grains; the pointer swipes a wake through them (like a chopstick
// through sand on glass); they scatter, then spring back into the image over a couple of seconds.
// Falls back to the CSS gold image if WebGL is unavailable; respects reduced-motion.

export function initBackground(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return; // CSS .bg image shows through

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VS = `
    attribute vec2 aPos; attribute vec3 aColor;
    uniform float uSize; varying vec3 vColor;
    void main(){ vColor = aColor; gl_PointSize = uSize; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FS = `
    precision mediump float; varying vec3 vColor; uniform float uBright;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float d = length(c);
      float a = smoothstep(0.5, 0.08, d); if (a <= 0.0) discard;
      gl_FragColor = vec4(vColor * uBright, a);
    }`;
  function sh(type, src) { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const aPos = gl.getAttribLocation(prog, 'aPos'), aColor = gl.getAttribLocation(prog, 'aColor');
  const uSize = gl.getUniformLocation(prog, 'uSize'), uBright = gl.getUniformLocation(prog, 'uBright');
  gl.uniform1f(uBright, 0.66);
  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const posBuf = gl.createBuffer(), colBuf = gl.createBuffer();

  // state
  let homeX, homeY, posX, posY, velX, velY, inter, count = 0;
  let dpr = 1, aspect = 1, firstBuild = true;
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });
  const img = new Image();
  let imgReady = false;

  function build() {
    const vw = canvas.clientWidth, vh = canvas.clientHeight;
    if (!vw || !vh || !imgReady) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = vw / vh;

    const cell = vw < 760 ? 9 : 8;
    const cols = Math.max(8, Math.round(vw / cell)), rows = Math.max(8, Math.round(vh / cell));
    off.width = cols; off.height = rows;

    // cover-fit the image onto the cols x rows grid
    const ia = img.naturalWidth / img.naturalHeight, va = cols / rows;
    let sw, shh, sx, sy;
    if (va > ia) { sw = img.naturalWidth; shh = sw / va; sx = 0; sy = (img.naturalHeight - shh) / 2; }
    else { shh = img.naturalHeight; sw = shh * va; sy = 0; sx = (img.naturalWidth - sw) / 2; }
    octx.clearRect(0, 0, cols, rows);
    octx.drawImage(img, sx, sy, sw, shh, 0, 0, cols, rows);
    const data = octx.getImageData(0, 0, cols, rows).data;

    const hx = [], hy = [], col = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4;
        const r = data[k] / 255, g = data[k + 1] / 255, b = data[k + 2] / 255;
        if (0.299 * r + 0.587 * g + 0.114 * b < 0.16) continue; // skip the dark cracks
        hx.push((i + 0.5) / cols * 2 - 1);
        hy.push(-((j + 0.5) / rows * 2 - 1));
        col.push(r, g, b);
      }
    }
    count = hx.length;
    homeX = new Float32Array(hx); homeY = new Float32Array(hy);
    posX = new Float32Array(count); posY = new Float32Array(count);
    velX = new Float32Array(count); velY = new Float32Array(count);
    inter = new Float32Array(count * 2);
    for (let n = 0; n < count; n++) {
      if (firstBuild && !reduce) { const a = Math.random() * 6.2832, rad = Math.random() * 0.42;
        posX[n] = homeX[n] + Math.cos(a) * rad; posY[n] = homeY[n] + Math.sin(a) * rad; }
      else { posX[n] = homeX[n]; posY[n] = homeY[n]; }
    }
    firstBuild = false;

    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, inter, gl.DYNAMIC_DRAW);
    gl.uniform1f(uSize, Math.max(1.5, cell * dpr * 1.18));
    if (reduce) { for (let n = 0; n < count; n++) { inter[2*n] = homeX[n]; inter[2*n+1] = homeY[n]; } draw(); }
  }

  img.onload = () => { imgReady = true; build(); kick(); };
  img.src = '/paul-gold.webp';

  // pointer — mouse, pen, and touch. All listeners are passive and never preventDefault,
  // so they read the finger position for the wake without blocking taps, links, buttons, or scroll.
  let mx = -2, my = -2, mspeed = 0, lastMove = 0;
  function ndc(cx, cy) { const r = canvas.getBoundingClientRect();
    return [(cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height * 2 - 1)]; }
  function setPos(cx, cy) { const p = ndc(cx, cy); mx = p[0]; my = p[1]; mspeed = 0; lastMove = performance.now(); kick(); }
  function move(cx, cy) { const p = ndc(cx, cy);
    mspeed = Math.min(1.8, mspeed + Math.hypot(p[0] - mx, p[1] - my) * 7.0); mx = p[0]; my = p[1]; lastMove = performance.now(); kick(); }
  window.addEventListener('pointerdown', (e) => setPos(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchstart', (e) => { if (e.touches[0]) setPos(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  // physics
  const R = 0.21, R2 = R * R, PUSH = 0.052, SPRING = 0.013, DAMP = 0.90;
  function step() {
    mspeed *= 0.92;
    const push = PUSH * (0.32 + mspeed);
    let moving = 0;
    for (let n = 0; n < count; n++) {
      let px = posX[n], py = posY[n], vx = velX[n], vy = velY[n];
      const dcx = px - mx, dcy = py - my;
      const ax = dcx * aspect, dScreen2 = ax * ax + dcy * dcy;
      if (dScreen2 < R2) {
        const dS = Math.sqrt(dScreen2); const f = (1 - dS / R) * push;
        const len = Math.sqrt(dcx * dcx + dcy * dcy) + 1e-4;
        vx += dcx / len * f; vy += dcy / len * f;
      }
      vx += (homeX[n] - px) * SPRING; vy += (homeY[n] - py) * SPRING;
      vx *= DAMP; vy *= DAMP;
      px += vx; py += vy;
      posX[n] = px; posY[n] = py; velX[n] = vx; velY[n] = vy;
      inter[2 * n] = px; inter[2 * n + 1] = py;
      moving += Math.abs(vx) + Math.abs(vy);
    }
    return moving / Math.max(1, count);
  }
  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inter);
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.enableVertexAttribArray(aColor); gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  let raf = 0;
  function frame() {
    const avg = step(); draw();
    const idle = (performance.now() - lastMove > 450) && avg < 0.00002 && mspeed < 0.002;
    if (reduce || idle) { raf = 0; return; } // settled: stop until the next pointer move
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !reduce && count) raf = requestAnimationFrame(frame); }

  window.addEventListener('resize', () => { build(); kick(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else kick();
  });
}
