/*
 * BouncyShapesPlayground — reusable ES‑module of the "bouncy shapes" demo
 * v2 — now transfers viewport‑edge momentum (scroll velocity) to bouncing balls
 * ──────────────────────────────────────────────────────────────────────────
 * ✓  Off‑screen spawn flag       (ignore every edge until the ball is visible)
 * ✓  Auto‑inward impulse         (off‑screen spawns now fly toward the canvas)
 * ✓  Solid‑colour pattern        (pass any valid CSS colour string)
 * ✓  Click‑spawn toggle          (disable/enable empty‑canvas spawning)
 * ✓  Obstacle momentum           (moving <div class="obstacle"> transfers velocity)
 * ✓  NEW: Viewport‑edge momentum (scrolling view transfers velocity on edge bounce)
 */

export default class BouncyShapesPlayground {
  constructor (opts = {}) {
    const {
      canvas,
      enableCollision   = false,
      shapeOptions      = ['circle','square','triangle','star'],
      gravity           = 1,
      bounceFactor      = 0.98,
      inertiaFactor    = 0.2,
    //   maxSpeed          = 60,    // NEW — px per frame (≈ px/s at 60 fps)
      clickBoost        = 40,
      spawnSize         = 100,
      pattern           = 'random',
      enableShadow = false,   // shapes have a shadow 
      clickSpawn        = true,
      enableMotion     = true,     // ← set false if you don’t want it
      motionFactor      = 1.0,      // tune overall strength
      
     
      
    } = opts;

    /* Canvas ---------------------------------------------------------- */
    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    if (!this.canvas || !(this.canvas instanceof HTMLCanvasElement)) {
      throw new Error('BouncyShapesPlayground: "canvas" must be a <canvas>.');
    }
    this.ctx = this.canvas.getContext('2d');

    /* Config ---------------------------------------------------------- */
    Object.assign(this, {
      gravity, bounceFactor, clickBoost, spawnSize,
      selectedPattern: pattern, shapeOptions,
      enableCollision, clickSpawn, inertiaFactor,motionFactor, enableMotion,  enableShadow,
    });

    /* State ----------------------------------------------------------- */
    this.balls = [];
    this.obstacles = [];
    this.MAX_ANGULAR_SPEED = 0.2;

    /* NEW — track viewport‑scroll momentum */
    this.prevScrollY    = window.scrollY; // previous frame's scrollTop (DOM px)
    this.scrollVyCanvas = 0;              // per‑frame scroll velocity mapped to canvas units

    /* NEW ─ track window-drag kinematics */
    this.prevWinX     = window.screenX;  // previous window position (screen px)
    this.prevWinY     = window.screenY;
    this.prevWinVx    = 0;               // previous window velocity (canvas px / frame)
    this.prevWinVy    = 0;
    this.winAxCanvas  = 0;               // per-frame window *acceleration* in canvas units
    this.winAyCanvas  = 0;

    /* NEW — live device-shake vector (canvas units / frame) */
    this.shakeAx = 0;
    this.shakeAy = 0;

    /* Obstacles — all elements with class .obstacle ------------------- */
    this._initObstacles();

    /* Start the accelerometer listener (needs a user-tap on iOS) */
    if (this.enableMotion) this._initMotion();   // ⬅️  NEW


    /* Bindings -------------------------------------------------------- */
    this._resizeCanvas      = this._resizeCanvas.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);
    this._animate           = this._animate.bind(this);

    window.addEventListener('resize', this._resizeCanvas);
    window.addEventListener('click', this._handleCanvasClick, { passive: true });

    this._resizeCanvas();
    requestAnimationFrame(this._animate);
  }

  /*──────────────────────────── Public API ────────────────────────────*/
  setClickSpawn(on = true) { this.clickSpawn = !!on; }

  spawn(x, y, shape = null, size = null, pattern = null, outside = false, color = null) {
    const ball = new Ball(this, x, y, shape || this._randShape(), size || this.spawnSize,
                          pattern || this.selectedPattern, outside, color);
    this.balls.push(ball);
    return ball;
  }

  clear() {
    for (const ball of this.balls) {
      ball.markForRemoval();
    }
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resizeCanvas);
    window.removeEventListener('click', this._handleCanvasClick);
  }

  /*────────────────────────── Internals ───────────────────────────────*/
  _randShape() { return this.shapeOptions[Math.floor(Math.random()*this.shapeOptions.length)]; }
  _resizeCanvas() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /* Merge static .obstacle elements into existing obstacle list */
  _initObstacles() {
    const staticEls = document.querySelectorAll('.obstacle');

    for (const el of staticEls) {
      // Skip if this element is already in the obstacle list
      const alreadyTracked = this.obstacles.some(ob => ob.el === el);
      if (alreadyTracked) continue;

      const rect = el.getBoundingClientRect();
      const newObstacle = { el, rect, vx: 0, vy: 0 };
      this.obstacles.push(newObstacle);
    }
  }

  /* Update each obstacle's velocity by differencing successive rects */
  _updateObstacleMotion() {
    for (const ob of this.obstacles) {
      if (!ob.el || !ob.el.getBoundingClientRect) return;
      const newRect = ob.el.getBoundingClientRect();
      ob.vx   = newRect.left - ob.rect.left;
      ob.vy   = newRect.top  - ob.rect.top;
      ob.rect = newRect;
    }
  }

  _handleCanvasClick(e) {
    const x = e.clientX, y = e.clientY;
    if (this._bounceHit(x, y)) return;
    if (this.clickSpawn) this.spawn(x, y);
  }

  _bounceHit(x, y) {
    for (const b of this.balls) {
      const dx = b.x - x;
      const dy = b.y - y;
      const dist = Math.hypot(dx, dy);

      if (dist < b.radius) {
        const mag = Math.max(dist, 1); // avoid division by zero
        const nx = dx / mag;
        const ny = dy / mag;

        // Apply boost away from click point
        const boost = this.clickBoost;
        b.vx += nx * boost;
        b.vy += ny * boost;

        // Add spin depending on lateral offset
        b.angularVelocity += (Math.random() - 0.5) * 0.4;

        return true;
      }
    }
    return false;
  }
    /*─────────────────── NEW: phone accelerometer support ──────────────────*/
    _initMotion () {
    /* iOS ≥13 must ask at runtime */
    const kickOff = () => {
        if (typeof DeviceMotionEvent?.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().catch(() => null);
        }
        window.addEventListener('devicemotion', this._handleMotion.bind(this), { passive:true });
        window.removeEventListener('click', kickOff);   // only need one tap
    };
    /* iOS needs a user gesture → ask on first tap anywhere */
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
        window.addEventListener('click', kickOff, { once:true });
    } else {
        kickOff();   // Android / desktop
    }
    }

    _handleMotion (e) {
    /* prefer linear accel.; fall back to accel.+gravity */
    const a = e.acceleration && (e.acceleration.x !== null)
                ? e.acceleration
                : e.accelerationIncludingGravity;
    if (!a) return;

    /* simple high-pass: ignore tiny drift */
    const ax = Math.abs(a.x) > 0.4 ? a.x : 0;
    const ay = Math.abs(a.y) > 0.4 ? a.y : 0;

    /* map device axes → canvas axes.
        Device +X (right-ward shove) means world moves right,
        so shapes should slide *left* → negate X.
        Device +Y (toward bottom edge) means world moves down,
        so shapes slide *up* → negate Y.                            */
    this.shakeAx = -ax;
    this.shakeAy = -ay;
    }

_animate () {
  /* ------------------------------------------------------------------
   * 1.  Measure external motions that will influence the simulation
   * -----------------------------------------------------------------*/

  /* Canvas rectangle in DOM-space (needed for conversions) */
  const cRect = this.canvas.getBoundingClientRect();

  /* ── a) Viewport-scroll momentum (already in v2) ───────────────── */
  const scaleY      = this.canvas.height / cRect.height;          // DOM-px ➜ canvas-px
  const deltaScroll = window.scrollY - this.prevScrollY;          // DOM-px since last frame
  this.scrollVyCanvas = deltaScroll * scaleY;                     // canvas-px / frame
  this.prevScrollY    = window.scrollY;

  /* ── b) NEW  Window-drag inertial acceleration ─────────────────── */
  const winDx = window.screenX - this.prevWinX;                   // screen-px / frame
  const winDy = window.screenY - this.prevWinY;
  const scaleX = this.canvas.width  / cRect.width;                // DOM-px ➜ canvas-px (x-axis)

  const winVxCanvas = winDx * scaleX;                             // window velocity in canvas units
  const winVyCanvas = winDy * scaleY;
  this.winAxCanvas  = winVxCanvas - this.prevWinVx;               // Δv ⇒ acceleration
  this.winAyCanvas  = winVyCanvas - this.prevWinVy;

  this.prevWinVx = winVxCanvas;
  this.prevWinVy = winVyCanvas;
  this.prevWinX  = window.screenX;
  this.prevWinY  = window.screenY;

  /* ── c) NEW  damp last shake so it dissipates ───────────────────*/
  this.shakeAx *= 0.85;
  this.shakeAy *= 0.85;

  /* ------------------------------------------------------------------
   * 2.  Regular per-frame housekeeping
   * -----------------------------------------------------------------*/
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // Always try to merge in new .obstacle elements, but don't remove existing ones
  this._initObstacles();  
  
  /* Measure obstacle velocities BEFORE balls are updated */
  this._updateObstacleMotion();

  /* Optional ball–ball elastic collisions */
  if (this.enableCollision) {
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        resolveCollision(this.balls[i], this.balls[j]);
      }
    }
  }

  /* ------------------------------------------------------------------
   * 3.  Update & draw every ball
   * -----------------------------------------------------------------*/
  // Ball update & draw loop (includes pop logic)
  for (let i = this.balls.length - 1; i >= 0; i--) {
    const b = this.balls[i];

    if (b._shouldDelete) {
      this.balls.splice(i, 1);
      continue;
    }

    if (!b.markedForRemoval) {
      for (const ob of this.obstacles) checkObstacleCollision(b, ob);
      b.vx -= this.winAxCanvas * this.inertiaFactor;
      b.vy -= this.winAyCanvas * this.inertiaFactor;
      b.vx += this.shakeAx * this.motionFactor;
      b.vy += this.shakeAy * this.motionFactor;
    }

    b.update();
    b.draw();
  }

  /* Schedule next frame */
  this._raf = requestAnimationFrame(this._animate);
}

}

/*────────────────────────────── Ball class ───────────────────────────*/
class Ball {
  constructor(pg, x, y, shape='circle', size=20, pattern='random', outside=false, color=null) {
    Object.assign(this, { pg, x, y, shape, radius: size, pattern });

    /* Velocity — directed toward canvas centre if spawned outside */
    if (outside) {
      const centreX = pg.canvas.width  / 2;
      const centreY = window.scrollY + window.innerHeight / 2;
      const dx = centreX - x;
      const dy = centreY - y;
      const mag = Math.hypot(dx, dy) || 1;
      const speed = 12; // px per frame toward canvas
      this.vx = (dx / mag) * speed;
      this.vy = (dy / mag) * speed;
    } else {
      this.vx = (Math.random() - 0.5) * 10;
      this.vy = (Math.random() - 0.5) * 10;
    }

    this.color = color || `hsl(${Math.random() * 360}, 70%, 60%)`;
    if (pattern === 'solid' && color) this.color = color;

    this.angle = Math.random() * Math.PI * 2;
    this.angularVelocity = (Math.random() - 0.5) * 0.2;
    this.ignoreEdgesUntilVisible = outside;
    this.touchedObstacles = new Set();

    // removal
    this.markedForRemoval = false;
    this.removalProgress = 0;
    this._shouldDelete = false;
  }

  // removal function
  markForRemoval() {
    this.markedForRemoval = true;
    this.removalProgress = 0;
  }

  update() {

    if (this.markedForRemoval) {
      this.removalProgress += 0.1; // adjust speed of pop
      if (this.removalProgress >= 1) {
        this._shouldDelete = true;
      }
      return; // skip physics updates
    }

    const pg = this.pg;

    /* basic Euler step */
    this.vy += pg.gravity;
    this.x  += this.vx;
    this.y  += this.vy;
    

    const w       = pg.canvas.width;
    const bottomY = pg.canvas.height;   // (= window.innerHeight)

    /* ───────── ALWAYS collide with the visible bottom ───────── */
    if (this.y + this.radius > bottomY) {
      this.y  = bottomY - this.radius;
      this.vy = Math.abs(this.vy) > 0.5 ? -this.vy * pg.bounceFactor : 0;
      this.vy += pg.scrollVyCanvas *0.5;           // NEW: transfer edge momentum

      /* little horizontal “roll‑out” friction when the shape has nearly stopped */
      if (Math.abs(this.vy) < 0.2) {
        const f = this.shape === 'circle' ? 0.98 : 0.85;
        this.vx *= f;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }
    }

    /* ───────── Only after the ball is fully inside do we honour the other edges ───────── */
    if (this.ignoreEdgesUntilVisible) {
      const fullyInside =
        this.x - this.radius >= 0 &&
        this.x + this.radius <= w &&
        this.y - this.radius >= 0 &&
        this.y + this.radius <= bottomY;
      if (fullyInside) this.ignoreEdgesUntilVisible = false;
    }

    if (!this.ignoreEdgesUntilVisible) {
      /* top */
      if (this.y - this.radius < 0) {
        this.y  = this.radius;
        this.vy = -this.vy * pg.bounceFactor;
        this.vy += pg.scrollVyCanvas;         // NEW: transfer edge momentum
      }
      /* right */
      if (this.x + this.radius > w) {
        this.x  = w - this.radius;
        this.vx = -this.vx * pg.bounceFactor;
      }
      /* left */
      if (this.x - this.radius < 0) {
        this.x  = this.radius;
        this.vx = -this.vx * pg.bounceFactor;
      }
    }

    /* rotation */
    this.angle += this.angularVelocity;
    this.angularVelocity *= 0.98;
    const M = pg.MAX_ANGULAR_SPEED;
    if (this.angularVelocity >  M) this.angularVelocity =  M;
    if (this.angularVelocity < -M) this.angularVelocity = -M;
    if (Math.abs(this.angularVelocity) < 0.001) this.angularVelocity = 0;
  }

  draw() {
    const ctx = this.pg.ctx;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Animate scale if being removed
    const scale = this.markedForRemoval ? 1 - this.removalProgress : 1;
    const alpha = this.markedForRemoval ? 1 - this.removalProgress : 1;
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // apply shadow is enabled
    if (this.pg.enableShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    }

    ctx.beginPath();
    switch(this.shape){
      case 'circle':   ctx.arc(0, 0, this.radius, 0, Math.PI * 2);                 break;
      case 'square':   ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2); break;
      case 'triangle': ctx.moveTo(0, -this.radius);
                       ctx.lineTo(-this.radius, this.radius);
                       ctx.lineTo(this.radius,  this.radius);
                       ctx.closePath();                                         break;
      case 'star':     drawStar(ctx, 0, 0, 5, this.radius, this.radius / 2);      break;
    }

    if (this.pattern === 'progress') drawProgressFill(ctx, this);
    else { ctx.fillStyle = this.color; ctx.fill(); }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

/*──────── ball‑ball collision (elastic) ───────*/
function resolveCollision(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
  const min = a.radius + b.radius;
  if (dist >= min || dist === 0) return;
  const nx = dx / dist, ny = dy / dist;
  const overlap = min - dist;
  a.x -= nx * overlap * 0.5; b.x += nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5; b.y += ny * overlap * 0.5;
  const kx = a.vx - b.vx, ky = a.vy - b.vy;
  const p = 2 * (nx * kx + ny * ky) / 2; // equal mass
  a.vx -= p * nx; a.vy -= p * ny;
  b.vx += p * nx; b.vy += p * ny;
}

/*──────── ball vs obstacle <div class="obstacle"> collision ─────────*/
function checkObstacleCollision(ball, ob) {
  const cRect = ball.pg.canvas.getBoundingClientRect();
  const dRect = ob.rect;

  /* ball centre in DOM‑space */
  const sx = cRect.left + (ball.x / ball.pg.canvas.width)  * cRect.width;
  const sy = cRect.top  + (ball.y / ball.pg.canvas.height) * cRect.height;

  /* closest point on obstacle rect to ball centre */
  const cx = Math.max(dRect.left, Math.min(sx, dRect.right));
  const cy = Math.max(dRect.top,  Math.min(sy, dRect.bottom));

  const dx = sx - cx, dy = sy - cy, dist = Math.hypot(dx, dy);

  // ─────────────────────────────────────────────────────
  // 1. Handle case where ball is fully inside an obstacle
  // ─────────────────────────────────────────────────────
  if (dist >= ball.radius || dist === 0) {
    const insideX = sx > dRect.left && sx < dRect.right;
    const insideY = sy > dRect.top  && sy < dRect.bottom;

    const id = ob.el.dataset?.id || ob.el; // Use dataset ID if available

  if (insideX && insideY && !ball.touchedObstacles.has(id)) {
    // Determine depth of embedment (normalized 0–1)
    const xDepth = Math.min(
      (sx - dRect.left) / dRect.width,
      (dRect.right - sx) / dRect.width
    );
    const yDepth = Math.min(
      (sy - dRect.top) / dRect.height,
      (dRect.bottom - sy) / dRect.height
    );
    const embedDepth = 1 - Math.min(xDepth, yDepth); // 0 = edge, 1 = deep center

    // Determine screen-farthest direction
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const cx = ball.x;
    const cy = ball.y;

    // Choose direction vector toward farthest edge
    const leftDist   = cx;
    const rightDist  = screenW - cx;
    const topDist    = cy;
    const bottomDist = screenH - cy;

    let dirX = 0, dirY = 0;

    const maxDist = Math.max(leftDist, rightDist, topDist, bottomDist);
    switch (maxDist) {
      case leftDist:   dirX = -1; break;
      case rightDist:  dirX =  1; break;
      case topDist:    dirY = -1; break;
      case bottomDist: dirY =  1; break;
    }

    // Final force scale (tweakable)
    const baseForce = 12;
    const force = baseForce * embedDepth;

    ball.vx += dirX * force;
    ball.vy += dirY * force;

    // Add spin for flavor
    ball.angularVelocity += (Math.random() - 0.5) * 0.6;

    // Remember we already reacted
    ball.touchedObstacles.add(id);
  }


    return; // Skip further collision logic
  }

  // ─────────────────────────────────────────────────────
  // 2. Normal collision response if ball overlaps edge
  // ─────────────────────────────────────────────────────
  const nx = dx / dist;
  const ny = dy / dist;

  const overlap = ball.radius - dist;
  const scaleX = ball.pg.canvas.width  / cRect.width;
  const scaleY = ball.pg.canvas.height / cRect.height;

  ball.x += nx * overlap * scaleX;
  ball.y += ny * overlap * scaleY;

  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx -= 2 * dot * nx;
  ball.vy -= 2 * dot * ny;

  ball.vx *= ball.pg.bounceFactor;
  ball.vy *= ball.pg.bounceFactor;

  const obVxCanvas = ob.vx * scaleX;
  const obVyCanvas = ob.vy * scaleY;
  ball.vx += obVxCanvas;
  ball.vy += obVyCanvas;

  // ─────────────────────────────────────────────────────
  // 3. Clean up: if ball is not inside ANY obstacle, reset touchedObstacles
  // ─────────────────────────────────────────────────────
  let isInsideAny = false;
  for (const other of ball.pg.obstacles) {
    const rect = other.rect;
    const sxCheck = cRect.left + (ball.x / ball.pg.canvas.width)  * cRect.width;
    const syCheck = cRect.top  + (ball.y / ball.pg.canvas.height) * cRect.height;

    const inX = sxCheck > rect.left && sxCheck < rect.right;
    const inY = syCheck > rect.top  && syCheck < rect.bottom;

    if (inX && inY) {
      isInsideAny = true;
      break;
    }
  }

  if (!isInsideAny) {
    ball.touchedObstacles.clear(); // ✅ Allow new reactions in the future
  }
}


/*──────── helper: draw star ───────*/
function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    /* outer point */
    x = cx + Math.cos(rot) * outer;
    y = cy + Math.sin(rot) * outer;
    ctx.lineTo(x, y);
    rot += step;
    /* inner point */
    x = cx + Math.cos(rot) * inner;
    y = cy + Math.sin(rot) * inner;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.closePath();
}


/*──────── helper: fill progress‑pride stripes ─────*/
function drawProgressFill(ctx, ball) {
  /* six‑stripe rainbow */
  const rainbow = ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004DFF', '#750787'];
  const stripeH = (ball.radius * 2) / rainbow.length;

  ctx.save();
  ctx.clip();

  /* rotate pattern on triangles / stars so stripes run horizontally */
  if (ball.shape === 'triangle') ctx.rotate(-Math.PI / 2);
  else if (ball.shape === 'star') ctx.rotate(-Math.PI / 1.43);

  for (let i = 0; i < rainbow.length; i++) {
    ctx.fillStyle = rainbow[i];
    ctx.fillRect(-ball.radius, -ball.radius + i * stripeH, ball.radius * 2, stripeH);
  }

  /* Left chevron — black, brown, blue, pink, white */
  const chev = ['#000000', '#613915', '#5BCEFA', '#F5A9B8', '#FFFFFF'];
  const insetStep = ball.radius * 0.1;
  for (let i = 0; i < chev.length; i++) {
    const inset = insetStep * i;
    ctx.fillStyle = chev[i];
    ctx.beginPath();
    ctx.moveTo(-ball.radius - inset, -ball.radius + inset);
    ctx.lineTo(-ball.radius - inset, ball.radius - inset);
    ctx.lineTo(-inset * 2, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// export functions to listen too
export function setupBouncyControls(pg) {
  document.getElementById('gravitySlider').addEventListener('input', e => {
    pg.gravity = parseFloat(e.target.value);
    document.getElementById('gravityValue').textContent = pg.gravity.toFixed(1);
  });

  document.getElementById('bouncinessSlider').addEventListener('input', e => {
    pg.bounceFactor = parseFloat(e.target.value);
    document.getElementById('bouncinessValue').textContent = pg.bounceFactor.toFixed(2);
  });

  document.getElementById('clickBoostSlider').addEventListener('input', e => {
    pg.clickBoost = parseFloat(e.target.value);
    document.getElementById('boostValue').textContent = pg.clickBoost.toFixed(0);
  });

  document.getElementById('sizeSlider').addEventListener('input', e => {
    pg.spawnSize = parseInt(e.target.value);
    document.getElementById('sizeValue').textContent = pg.spawnSize;
  });

  document.getElementById('collisionToggle').addEventListener('change', e => {
    pg.enableCollision = e.target.checked;
  });

  document.getElementById('clearButton').addEventListener('click', () => {
    pg.clearShapes(); // your module should expose this
  });

  document.getElementById('patternSelect').addEventListener('change', e => {
    pg.selectedPattern = e.target.value;
  });


  const clearBtn = document.getElementById('clearButton');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      pg.clear(); // 🧼 clears the balls array
    });
  }
  const chaosBtn = document.getElementById('chaosButton');
  if (chaosBtn) {
    chaosBtn.addEventListener('click', () => {
      // 🧹 Close the bouncy menu first
      document.getElementById('bouncyMenu').classList.remove('open');
      document.getElementById('menuOverlay')?.classList.remove('active');

      // Wait a short delay to ensure the menu is closed
      setTimeout(() => {
        pg.enableCollision = true;

        const shapes = pg.shapeOptions || ['circle', 'square', 'triangle', 'star'];
        const patterns = pg.pattern || ['random', 'solid'];
        const howMany = Math.floor(Math.random() * 20) + 10; // between 10 and 30

        for (let i = 0; i < howMany; i++) {
          const x = Math.random() * window.innerWidth;
          const y = -Math.random() * 500;
          const size = pg.spawnSize; // fallback to spawnSize
          const shape = shapes[Math.floor(Math.random() * shapes.length)];
          const pattern = patterns[Math.floor(Math.random() * patterns.length)];
          const color = `hsl(${Math.random() * 360}, 70%, 60%)`;

          pg.spawn(
            x,
            y,
            shape,
            size,
            pattern,
            true,
            pattern === "solid" ? color : undefined
          );
        }
        console.log(`[DEBUG] Spawned ${howMany} chaotic shapes.`);
      }, 300); // ⏱ Adjust delay if needed
    });
  }
}

