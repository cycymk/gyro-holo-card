/* Gyro Holo engine: full-screen depth parallax + holo foil, driven by gyro and touch.
   Used by the maker page and by exported single-file viewers. No dependencies. */
(function (global) {
  "use strict";

  const VS = "attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;uv.y=1.0-uv.y;gl_Position=vec4(p,0.,1.);}";
  const FS = `precision highp float;
varying vec2 uv;
uniform sampler2D img, dep;
uniform vec2 tilt, scale;      // scale: screen uv -> image uv (cover/contain)
uniform float strength, foil, focus, style, zoom, edge, ar;
float D(vec2 t){ return texture2D(dep,t).r; }
vec3 hue(float h){ return 0.5+0.5*cos(6.2831*(h+vec3(0.0,0.33,0.67))); }
void main(){
  vec2 iuv = (uv-0.5)*scale + 0.5;                       // image-space uv
  bool outside = any(lessThan(iuv, vec2(0.0))) || any(greaterThan(iuv, vec2(1.0)));
  vec2 base = (iuv-0.5)/zoom + 0.5;                      // overscan hides edges while shifting
  vec2 iso = vec2(min(1.0,1.0/ar), min(1.0,ar));   // equal pixels on both axes
  vec2 shift = tilt * 0.05 * strength * iso;
  vec2 s = base;
  for(int i=0;i<12;i++){ s = base - shift*(D(s)-focus); }
  vec2 t = clamp(s, 0.001, 0.999);
  vec3 c = texture2D(img, t).rgb;
  float d = D(t);
  float lum = dot(c, vec3(.299,.587,.114));
  // foil
  float h = fract(iuv.x*0.9 + iuv.y*1.4 + tilt.x*0.55 - tilt.y*0.35 + d*0.25);
  vec3 rb = hue(h);
  float bands = 0.55 + 0.45*sin((iuv.x+iuv.y)*38.0 + tilt.x*6.0 - tilt.y*3.0);
  vec2 cell = floor(iuv*260.0/iso);
  float rnd = fract(sin(dot(cell, vec2(12.9898,78.233)))*43758.5453);
  float sparkle = step(0.986, fract(rnd + tilt.x*0.8 + tilt.y*0.6));
  if(style < 0.5){            // rainbow holo
    float m = foil*(0.18 + 0.5*smoothstep(0.45,0.95,lum))*bands;
    c = mix(c, c + rb*0.55, m);
    c += sparkle*foil*0.9*smoothstep(0.3,0.8,lum);
  } else if(style < 1.5){     // glitter only
    c += sparkle*foil*1.2*(0.4+0.6*smoothstep(0.2,0.8,lum))*hue(rnd);
    c += sparkle*foil*0.5;
  } else if(style < 2.5){     // foreground-only holo (subject shines, background calm)
    float fg = smoothstep(focus-0.05, focus+0.25, d);
    float m = foil*fg*(0.25 + 0.5*smoothstep(0.35,0.95,lum))*bands;
    c = mix(c, c + rb*0.6, m);
    c += sparkle*foil*fg*0.9;
  }
  vec2 lp = vec2(0.5) - tilt*vec2(0.55,0.45);
  vec2 dv = (iuv-lp)/iso;
  c += exp(-5.0*dot(dv,dv))*(0.06 + 0.22*foil);
  if(outside){                                         // contain mode: dim letterbox fill
    vec2 bt = clamp(iuv, 0.0, 1.0);
    c = texture2D(img, bt).rgb*0.22;
  }
  // soft edge vignette in card mode
  vec2 e = smoothstep(vec2(0.0), vec2(edge), uv) * smoothstep(vec2(0.0), vec2(edge), 1.0-uv);
  c *= mix(1.0, 0.85 + 0.15*e.x*e.y, step(0.0001, edge));
  gl_FragColor = vec4(c, 1.0);
}`;

  const STYLES = { rainbow: 0, glitter: 1, subject: 2, off: 3 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function Holo(canvas, opts) {
    opts = opts || {};
    const gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL 不可用");
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ["tilt", "scale", "strength", "foil", "focus", "style", "zoom", "edge", "ar", "img", "dep"].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    gl.uniform1i(U.img, 0); gl.uniform1i(U.dep, 1);
    const mk = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const imgTex = mk(0), depTex = mk(1);
    const up = (t, unit, src) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };

    const P = Object.assign({ strength: 1, foil: 0.5, focus: 0.5, style: "rainbow", fit: "cover", card: false }, opts.params || {});
    let imgAR = 1, ready = false;
    const st = { gyro: { x: 0, y: 0 }, base: null, raw: null, drag: { x: 0, y: 0 }, dragging: false, tilt: { x: 0, y: 0 }, gyroOn: false, idle: 0 };
    const reduce = global.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const d = Math.min(global.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * d)), h = Math.max(1, Math.round(canvas.clientHeight * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    global.addEventListener("resize", () => requestAnimationFrame(resize));

    // --- sensors ---
    function screenAngle() {
      const a = (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (global.orientation || 0);
      return ((a % 360) + 360) % 360;
    }
    function onOrient(e) {
      if (e.gamma == null || e.beta == null) return;
      let x, y; const a = screenAngle();
      if (a === 90) { x = e.beta; y = -e.gamma; }
      else if (a === 270) { x = -e.beta; y = e.gamma; }
      else if (a === 180) { x = -e.gamma; y = -e.beta; }
      else { x = e.gamma; y = e.beta; }
      st.raw = { x, y };
      if (!st.base) st.base = { x, y };
      // slowly follow the hand so any holding angle becomes "neutral"
      st.base.x += (x - st.base.x) * 0.004; st.base.y += (y - st.base.y) * 0.004;
      st.gyro.x = clamp((x - st.base.x) / 20, -1.5, 1.5);
      st.gyro.y = clamp((y - st.base.y) / 20, -1.5, 1.5);
      if (!st.gyroOn) { st.gyroOn = true; opts.onGyro && opts.onGyro(true); }
    }
    let listening = false;
    async function enableGyro() {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== "granted") throw new Error("denied");
      }
      if (!listening) { global.addEventListener("deviceorientation", onOrient); listening = true; }
      return new Promise(res => setTimeout(() => res(st.gyroOn), 1200));
    }
    function listen() { if (!listening) { global.addEventListener("deviceorientation", onOrient); listening = true; } }
    const needsPermission = () => typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
    function recenter() { st.base = st.raw ? { ...st.raw } : null; st.drag = { x: 0, y: 0 }; }

    // --- touch / mouse drag ---
    const target = opts.dragTarget || canvas;
    let last = null, moved = 0;
    target.addEventListener("pointerdown", e => { if (e.target.closest && e.target.closest("[data-ui]")) return; st.dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY }; try { target.setPointerCapture(e.pointerId); } catch (_) {} });
    target.addEventListener("pointermove", e => {
      if (!st.dragging) {             // desktop hover tilts gently
        if (e.pointerType === "mouse" && !st.gyroOn) { const r = target.getBoundingClientRect(); st.drag.x = ((e.clientX - r.left) / r.width - 0.5) * 2; st.drag.y = ((e.clientY - r.top) / r.height - 0.5) * 2; }
        return;
      }
      const r = target.getBoundingClientRect(), dx = (e.clientX - last.x) / r.width, dy = (e.clientY - last.y) / r.height;
      moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      st.drag.x = clamp(st.drag.x + dx * 3.4, -1.8, 1.8); st.drag.y = clamp(st.drag.y + dy * 3.4, -1.8, 1.8);
    });
    const end = e => { if (!st.dragging) return; st.dragging = false; if (moved < 8 && opts.onTap) opts.onTap(e); };
    target.addEventListener("pointerup", end); target.addEventListener("pointercancel", end);
    target.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !st.dragging) { st.drag.x = 0; st.drag.y = 0; } });

    // --- render ---
    function frame() {
      if (!st.dragging) { st.drag.x *= 0.92; st.drag.y *= 0.92; }
      const tx = st.gyro.x + st.drag.x, ty = st.gyro.y + st.drag.y, k = reduce ? 1 : 0.16;
      st.tilt.x += (tx - st.tilt.x) * k; st.tilt.y += (ty - st.tilt.y) * k;
      if (ready) {
        resize();
        const vAR = canvas.width / canvas.height;
        let sx = 1, sy = 1;
        const cover = P.fit === "cover" || P.card;
        if (cover) { if (vAR > imgAR) sy = imgAR / vAR; else sx = vAR / imgAR; }
        else { if (vAR > imgAR) sx = vAR / imgAR; else sy = imgAR / vAR; }
        gl.uniform2f(U.scale, sx, sy); gl.uniform1f(U.ar, imgAR);
        gl.uniform2f(U.tilt, st.tilt.x, st.tilt.y);
        gl.uniform1f(U.strength, P.strength); gl.uniform1f(U.foil, P.style === "off" ? 0 : P.foil);
        gl.uniform1f(U.focus, P.focus); gl.uniform1f(U.style, STYLES[P.style] ?? 0);
        gl.uniform1f(U.zoom, 1 + 0.075 * P.strength); gl.uniform1f(U.edge, P.card ? 0.04 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (opts.onFrame) opts.onFrame(st.tilt);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      setImage(image, depth) {
        up(imgTex, 0, image); up(depTex, 1, depth);
        imgAR = (image.naturalWidth || image.width) / (image.naturalHeight || image.height);
        ready = true; resize();
      },
      get aspect() { return imgAR; },
      params: P,
      set(k, v) { P[k] = v; },
      enableGyro, listen, needsPermission, recenter,
      get gyroOn() { return st.gyroOn; },
      tilt: st.tilt,
    };
  }

  global.Holo = Holo;
})(window);
