(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const healthEl = document.getElementById("health");
  const scoreEl = document.getElementById("score");
  const messageEl = document.getElementById("message");
  const gameOverEl = document.getElementById("gameOver");
  const finalScoreEl = document.getElementById("finalScore");
  const restartButton = document.getElementById("restartButton");

  const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,0,0,1,1,0,0,1],
    [1,0,0,1,0,1,0,0,1,0,0,1],
    [1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,0,0,0,0,1,0,1,0,1],
    [1,0,1,0,1,0,1,0,0,1,0,1],
    [1,0,0,0,1,0,1,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  const MAP_WIDTH = MAP[0].length;
  const MAP_HEIGHT = MAP.length;

  const FOV = Math.PI / 3;
  const HALF_FOV = FOV / 2;
  const MOVE_SPEED = 3.2;
  const ROTATE_SPEED = 0.0024;
  const PLAYER_RADIUS = 0.2;
  const ENEMY_SPEED = 0.85;
  const ENEMY_TOUCH_DISTANCE = 0.62;
  const ENEMY_DAMAGE = 12;
  const ENEMY_DAMAGE_COOLDOWN = 0.8;
  const MAX_RAY_DISTANCE = 28;

  const JUMP_VELOCITY = 4.8;
  const GRAVITY = 13;
  const PLAYER_SPAWN = {
    x: 1.5,
    y: 1.5,
    angle: 0.15
  };

  let width = 0;
  let height = 0;
  let columnCount = 0;
  let rayDistances = [];

  let health = 100;
  let score = 0;
  let isGameOver = false;
  let controlsEnabled = false;

  const player = {
    x: PLAYER_SPAWN.x,
    y: PLAYER_SPAWN.y,
    angle: PLAYER_SPAWN.angle,
    z: 0,
    zVelocity: 0,
    onGround: true
  };

  const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false
  };

  const enemies = [];
  let spawnTimer = 0;
  let waveTimer = 0;
  let spawnInterval = 2.3;
  let wave = 1;

  let audioCtx = null;
  let lastTime = performance.now();

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    width = Math.max(320, Math.floor(window.innerWidth));
    height = Math.max(200, Math.floor(window.innerHeight));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    columnCount = width;
    rayDistances = new Float32Array(columnCount);
  }

  function isWall(x, y) {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= MAP_WIDTH || iy >= MAP_HEIGHT) {
      return true;
    }
    return MAP[iy][ix] !== 0;
  }

  function canMoveTo(x, y, radius) {
    return (
      !isWall(x - radius, y - radius) &&
      !isWall(x + radius, y - radius) &&
      !isWall(x - radius, y + radius) &&
      !isWall(x + radius, y + radius)
    );
  }

  function tryMove(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    if (canMoveTo(nx, entity.y, radius)) {
      entity.x = nx;
    }
    const ny = entity.y + dy;
    if (canMoveTo(entity.x, ny, radius)) {
      entity.y = ny;
    }
  }

  function normalizeAngle(a) {
    if (a > Math.PI) return a - Math.PI * 2;
    if (a < -Math.PI) return a + Math.PI * 2;
    return a;
  }

  function castRay(originX, originY, angle) {
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    const step = 0.035;
    let dist = 0;
    while (dist < MAX_RAY_DISTANCE) {
      const rx = originX + cosA * dist;
      const ry = originY + sinA * dist;
      if (isWall(rx, ry)) {
        return dist;
      }
      dist += step;
    }
    return MAX_RAY_DISTANCE;
  }

  function lineOfSightDistance(angle) {
    return castRay(player.x, player.y, angle);
  }

  function renderSkyAndFloor(horizonOffset) {
    const horizon = (height / 2) + horizonOffset;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#1a2538");
    sky.addColorStop(1, "#0a0f18");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);

    const floor = ctx.createLinearGradient(0, horizon, 0, height);
    floor.addColorStop(0, "#1b1f29");
    floor.addColorStop(1, "#0f1116");
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, width, height - horizon);
  }

  function renderWalls(horizonOffset) {
    const projection = (width / 2) / Math.tan(HALF_FOV);
    const rayStart = player.angle - HALF_FOV;

    for (let x = 0; x < columnCount; x++) {
      const t = x / columnCount;
      const rayAngle = rayStart + t * FOV;
      const rawDist = castRay(player.x, player.y, rayAngle);
      const dist = rawDist * Math.cos(rayAngle - player.angle);
      rayDistances[x] = dist;

      const wallHeight = Math.min(height * 1.6, projection / Math.max(0.001, dist));
      const y = ((height - wallHeight) / 2) + horizonOffset;

      const shade = Math.max(36, 235 - dist * 23);
      ctx.fillStyle = "rgb(" + shade + "," + Math.floor(shade * 0.92) + "," + Math.floor(shade * 0.8) + ")";
      ctx.fillRect(x, y, 1, wallHeight);
    }
  }

  function renderEnemies(horizonOffset) {
    const projection = (width / 2) / Math.tan(HALF_FOV);

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;

      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.01) continue;

      const angle = Math.atan2(dy, dx);
      const relative = normalizeAngle(angle - player.angle);
      if (Math.abs(relative) > HALF_FOV + 0.35) continue;

      const size = Math.min(height, projection / dist);
      const screenX = Math.tan(relative) * projection + (width / 2);
      const left = screenX - size / 2;
      const top = ((height - size) / 2) + horizonOffset;

      const centerCol = Math.max(0, Math.min(columnCount - 1, screenX | 0));
      if (dist > rayDistances[centerCol]) continue;

      const tint = Math.max(85, 255 - dist * 35);
      ctx.fillStyle = "rgb(" + tint + "," + Math.floor(tint * 0.28) + "," + Math.floor(tint * 0.24) + ")";
      ctx.fillRect(left, top, size, size);

      ctx.strokeStyle = "rgba(255,220,220,0.4)";
      ctx.strokeRect(left, top, size, size);
    }
  }

  function renderWeapon(recoil) {
    const baseW = Math.min(180, width * 0.24);
    const baseH = Math.min(110, height * 0.2);
    const x = width * 0.5 + 48 + recoil * 12;
    const y = height - baseH * 0.5 - 16 + recoil * 8;

    ctx.fillStyle = "#2b313f";
    ctx.fillRect(x, y - baseH, baseW, baseH);

    ctx.fillStyle = "#151922";
    ctx.fillRect(x + baseW * 0.52, y - baseH * 0.75, baseW * 0.45, baseH * 0.25);
  }

  let recoil = 0;

  function updatePlayer(dt) {
    const forwardX = Math.cos(player.angle);
    const forwardY = Math.sin(player.angle);
    const rightX = Math.cos(player.angle + Math.PI / 2);
    const rightY = Math.sin(player.angle + Math.PI / 2);

    let moveX = 0;
    let moveY = 0;

    if (keys.KeyW) {
      moveX += forwardX;
      moveY += forwardY;
    }
    if (keys.KeyS) {
      moveX -= forwardX;
      moveY -= forwardY;
    }
    if (keys.KeyD) {
      moveX += rightX;
      moveY += rightY;
    }
    if (keys.KeyA) {
      moveX -= rightX;
      moveY -= rightY;
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 0) {
      moveX = (moveX / len) * MOVE_SPEED * dt;
      moveY = (moveY / len) * MOVE_SPEED * dt;
      tryMove(player, moveX, moveY, PLAYER_RADIUS);
    }

    if (keys.Space && player.onGround) {
      player.zVelocity = JUMP_VELOCITY;
      player.onGround = false;
    }

    if (!player.onGround || player.z > 0) {
      player.zVelocity -= GRAVITY * dt;
      player.z += player.zVelocity * dt;
      if (player.z <= 0) {
        player.z = 0;
        player.zVelocity = 0;
        player.onGround = true;
      }
    }

    recoil = Math.max(0, recoil - dt * 9.5);
  }

  function spawnEnemy() {
    const minDist = 3;
    for (let i = 0; i < 28; i++) {
      const x = 1 + Math.random() * (MAP_WIDTH - 2);
      const y = 1 + Math.random() * (MAP_HEIGHT - 2);
      if (isWall(x, y)) continue;

      const dist = Math.hypot(x - player.x, y - player.y);
      if (dist < minDist) continue;

      enemies.push({
        x,
        y,
        alive: true,
        attackCooldown: 0
      });
      return;
    }
  }

  function updateEnemies(dt) {
    let liveCount = 0;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;

      liveCount++;
      if (e.attackCooldown > 0) {
        e.attackCooldown -= dt;
      }

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.001) {
        const step = ENEMY_SPEED * dt;
        const vx = (dx / dist) * step;
        const vy = (dy / dist) * step;
        tryMove(e, vx, vy, 0.18);
      }

      const nowDist = Math.hypot(player.x - e.x, player.y - e.y);
      if (nowDist <= ENEMY_TOUCH_DISTANCE && e.attackCooldown <= 0) {
        e.attackCooldown = ENEMY_DAMAGE_COOLDOWN;
        setHealth(health - ENEMY_DAMAGE);
      }
    }

    spawnTimer -= dt;
    waveTimer += dt;

    if (waveTimer > 20) {
      waveTimer = 0;
      wave++;
      spawnInterval = Math.max(0.6, spawnInterval - 0.15);
    }

    const maxEnemies = Math.min(22, 4 + wave * 2);
    if (spawnTimer <= 0 && liveCount < maxEnemies) {
      spawnEnemy();
      spawnTimer = spawnInterval;
    }
  }

  function setHealth(v) {
    health = Math.max(0, Math.floor(v));
    healthEl.textContent = "Health: " + health;
    if (health <= 0 && !isGameOver) {
      endGame();
    }
  }

  function setScore(v) {
    score = Math.floor(v);
    scoreEl.textContent = "Score: " + score;
  }

  function playShootSound() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  function shoot() {
    if (!controlsEnabled || isGameOver) return;

    recoil = 1;
    playShootSound();

    let target = null;
    let bestDist = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) continue;

      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angleToEnemy = Math.atan2(dy, dx);
      const delta = Math.abs(normalizeAngle(angleToEnemy - player.angle));

      if (delta > 0.07) continue;
      const wallDist = lineOfSightDistance(angleToEnemy);
      if (dist > wallDist + 0.05) continue;

      if (dist < bestDist) {
        bestDist = dist;
        target = e;
      }
    }

    if (target) {
      target.alive = false;
      setScore(score + 1);
    }
  }

  function endGame() {
    isGameOver = true;
    controlsEnabled = false;
    finalScoreEl.textContent = "Score: " + score;
    gameOverEl.classList.remove("hidden");
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  }

  function resetPlayerState() {
    player.x = PLAYER_SPAWN.x;
    player.y = PLAYER_SPAWN.y;
    player.angle = PLAYER_SPAWN.angle;
    player.z = 0;
    player.zVelocity = 0;
    player.onGround = true;
  }

  function restartGame() {
    health = 100;
    score = 0;
    setHealth(health);
    setScore(score);
    isGameOver = false;

    resetPlayerState();

    enemies.length = 0;
    spawnTimer = 0;
    waveTimer = 0;
    spawnInterval = 2.3;
    wave = 1;

    gameOverEl.classList.add("hidden");
    messageEl.textContent = "Click to lock pointer and start";
  }

  function update(dt) {
    if (isGameOver) return;
    updatePlayer(dt);
    updateEnemies(dt);
  }

  function render() {
    const horizonOffset = player.z * 65;
    renderSkyAndFloor(horizonOffset);
    renderWalls(horizonOffset);
    renderEnemies(horizonOffset);
    renderWeapon(recoil);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function onMouseMove(event) {
    if (!controlsEnabled || isGameOver) return;
    player.angle += event.movementX * ROTATE_SPEED;
    if (player.angle > Math.PI) player.angle -= Math.PI * 2;
    if (player.angle < -Math.PI) player.angle += Math.PI * 2;
  }

  function lockPointer() {
    if (!isGameOver) {
      canvas.requestPointerLock();
    }
  }

  function onPointerLockChange() {
    controlsEnabled = document.pointerLockElement === canvas;
    if (controlsEnabled) {
      messageEl.textContent = "WASD move, Space jump, Mouse look, Left click shoot";
    } else if (!isGameOver) {
      messageEl.textContent = "Click to lock pointer and continue";
    }
  }

  function onKey(event, down) {
    if (event.code in keys) {
      keys[event.code] = down;
      if (event.code === "Space") {
        event.preventDefault();
      }
    }
  }

  function initEvents() {
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", lockPointer);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", (e) => onKey(e, true));
    document.addEventListener("keyup", (e) => onKey(e, false));
    document.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        if (document.pointerLockElement !== canvas && !isGameOver) {
          lockPointer();
        } else {
          shoot();
        }
      }
    });
    restartButton.addEventListener("click", restartGame);
  }

  function init() {
    resetPlayerState();
    resize();
    setHealth(health);
    setScore(score);
    initEvents();
    requestAnimationFrame(loop);
  }

  init();
})();
