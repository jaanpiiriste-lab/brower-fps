(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const hud = document.getElementById("hud");
  const healthEl = document.getElementById("health");
  const scoreEl = document.getElementById("score");
  const msgEl = document.getElementById("message");
  const gameOverEl = document.getElementById("gameOver");
  const finalScoreEl = document.getElementById("finalScore");
  const restartButton = document.getElementById("restartButton");

  const stat = (id, txt) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      hud.appendChild(el);
    }
    el.textContent = txt;
    return el;
  };

  const ammoEl = stat("ammo", "Ammo: 0");
  const cashEl = stat("cash", "Fake$: 0");
  const armorEl = stat("armor", "Armor: 0");
  const objEl = stat("objective", "Objective: ...");
  const weaponEl = stat("weapon", "Weapon: Pistol");
  const staminaEl = stat("stamina", "Stamina: 100");
  const utilEl = stat("utility", "Dash: Ready | Grenades: 0");

  const MAP_W = 40;
  const MAP_H = 40;

  const FOV = Math.PI / 3;
  const HALF_FOV = FOV / 2;
  const MOVE_SPEED = 3.2;
  const ROT = 0.0024;
  const PITCH = 0.0018;
  const MAX_PITCH = 0.46;
  const PLAYER_R = 0.2;
  const GRAVITY = 13;
  const JUMP = 4.8;
  const MAX_RAY = 34;

  const BULLET_SPEED = 12.5;
  const BULLET_LIFE = 1.2;
  const BULLET_R = 0.06;
  const ENEMY_BULLET_SPEED = 6.2;
  const ENEMY_BULLET_LIFE = 2.2;
  const ENEMY_BULLET_R = 0.07;
  const MAX_AMMO = 120;
  const MAX_STAMINA = 100;
  const MAX_GRENADES = 4;
  const SPRINT_MULT = 1.68;
  const STAMINA_DRAIN = 38;
  const STAMINA_REGEN = 26;
  const DASH_SPEED = 9.2;
  const DASH_TIME = 0.16;
  const DASH_CD = 1.1;
  const DASH_STAMINA_COST = 24;

  const WEAPONS = [
    {
      id: "pistol",
      name: "Pistol",
      fire: 0.22,
      spread: 0.012,
      pellets: 1,
      ammoCost: 1,
      power: 1.1,
      speed: BULLET_SPEED,
      life: BULLET_LIFE,
      recoil: 0.82,
      auto: false,
      toneA: "#6f7b93",
      toneB: "#2f3748"
    },
    {
      id: "smg",
      name: "SMG",
      fire: 0.085,
      spread: 0.03,
      pellets: 1,
      ammoCost: 1,
      power: 0.8,
      speed: 13.8,
      life: 1.1,
      recoil: 0.58,
      auto: true,
      toneA: "#607f8f",
      toneB: "#253640"
    },
    {
      id: "shotgun",
      name: "Shotgun",
      fire: 0.54,
      spread: 0.18,
      pellets: 6,
      ammoCost: 3,
      power: 0.58,
      speed: 11.6,
      life: 0.84,
      recoil: 1.38,
      auto: false,
      toneA: "#7b6a59",
      toneB: "#3b3028"
    },
    {
      id: "rifle",
      name: "Rifle",
      fire: 0.16,
      spread: 0.018,
      pellets: 1,
      ammoCost: 2,
      power: 1.85,
      speed: 15.8,
      life: 1.45,
      recoil: 1.06,
      auto: false,
      toneA: "#4f775e",
      toneB: "#1f3528"
    }
  ];
  const WEAPON_UNLOCK_COST = [0, 6, 9, 13];
  const MUSIC_MAIN = [196, 247, 294, 247, 220, 262, 330, 262, 196, 247, 294, 330, 349, 330, 294, 247];
  const MUSIC_BASS = [98, 98, 110, 110, 123, 123, 110, 98];
  const SITE_CODES = ["SITE-19", "SITE-17", "SITE-23", "SITE-77", "AREA-12"];

  let mapSerial = 0;
  let mapName = "Sector-000";
  let map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
  let mw = MAP_W;
  let mh = MAP_H;
  const SPAWN_A = { x: 2.5, y: 2.5, a: 0.18 };
  const CHECKPOINT = { x: 17.5, y: 18.5 };
  const SHOP = { x: 18.5, y: 20.5 };
  const pitTiles = [];

  function refreshPitTiles() {
    pitTiles.length = 0;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        if (map[y][x] === 2) pitTiles.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }

  let w = 0;
  let h = 0;
  let cols = 0;
  let rays = [];

  let hp = 100;
  let score = 0;
  let ammo = 30;
  let cash = 3;
  let armor = 0;
  let guardDefeated = false;
  let checkpointActive = false;
  let checkpointSpawn = { x: SPAWN_A.x, y: SPAWN_A.y, a: SPAWN_A.a };
  let parkourRecover = 0;
  let damageLevel = 0;
  let mobilityLevel = 0;
  let stamina = 100;
  let sprintRegenDelay = 0;
  let dashCd = 0;
  let dashT = 0;
  let dashVX = 0;
  let dashVY = 0;
  let grenadesCount = 2;
  let grenadeCd = 0;
  let jumpQueued = false;
  let jumpBufferT = 0;
  let coyoteT = 0;

  let lock = false;
  let over = false;
  let recoil = 0;
  let muzzle = 0;
  let shootCd = 0;
  let spawnCd = 0;
  let waveT = 0;
  let wave = 1;
  let wantInteract = false;
  let triggerDown = false;
  let weaponIndex = 0;
  let weaponSwapFlash = 0;
  let unlockedWeapons = [true, false, false, false];

  let prompt = "";
  let note = "";
  let noteT = 0;

  const player = { x: SPAWN_A.x, y: SPAWN_A.y, a: SPAWN_A.a, p: 0, z: 0, vz: 0, g: true };
  const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    KeyE: false,
    ShiftLeft: false,
    ShiftRight: false,
    Space: false
  };
  const enemies = [];
  const bullets = [];
  const ebullets = [];
  const grenades = [];
  const blastFx = [];
  const loot = [];

  let audioCtx = null;
  let musicOn = false;
  let musicStep = 0;
  let musicCd = 0;
  let last = performance.now();

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const angN = (a) => (a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a);
  const gun = () => WEAPONS[weaponIndex];

  function switchWeapon(next) {
    if (next < 0 || next >= WEAPONS.length || next === weaponIndex) return;
    if (!unlockedWeapons[next]) {
      say(WEAPONS[next].name + " is locked. Buy it in shop for $" + WEAPON_UNLOCK_COST[next] + ".", 1.5);
      return;
    }
    weaponIndex = next;
    weaponSwapFlash = 1;
    say("Weapon: " + gun().name, 0.85);
    refreshHudText();
  }

  function cycleWeapon(dir) {
    let i = weaponIndex;
    for (let n = 0; n < WEAPONS.length; n++) {
      i = (i + dir + WEAPONS.length) % WEAPONS.length;
      if (!unlockedWeapons[i]) continue;
      switchWeapon(i);
      return;
    }
  }

  function carveDisk(arena, cx, cy, r, tile = 0) {
    const aw = arena[0].length;
    const ah = arena.length;
    const x1 = Math.max(1, (cx - r) | 0);
    const x2 = Math.min(aw - 2, (cx + r) | 0);
    const y1 = Math.max(1, (cy - r) | 0);
    const y2 = Math.min(ah - 2, (cy + r) | 0);
    const rr = r * r;
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= rr) arena[y][x] = tile;
      }
    }
  }

  function carvePath(arena, from, to, width = 1.1) {
    const aw = arena[0].length;
    const ah = arena.length;
    let x = from.x | 0;
    let y = from.y | 0;
    const tx = to.x | 0;
    const ty = to.y | 0;
    let guard = 0;
    while ((x !== tx || y !== ty) && guard < 2000) {
      guard++;
      carveDisk(arena, x + 0.5, y + 0.5, width, 0);
      let sx = Math.sign(tx - x);
      let sy = Math.sign(ty - y);
      if (Math.random() < 0.3) {
        if (Math.random() < 0.5) sx = Math.random() < 0.5 ? -1 : 1;
        else sy = Math.random() < 0.5 ? -1 : 1;
      }
      if (Math.random() < 0.5 && sx !== 0) x += sx;
      else if (sy !== 0) y += sy;
      else x += sx;
      x = clamp(x, 1, aw - 2);
      y = clamp(y, 1, ah - 2);
    }
    carveDisk(arena, tx + 0.5, ty + 0.5, width, 0);
  }

  function randomOpenCell(arena, avoid = [], minDist = 0, maxTries = 420) {
    const aw = arena[0].length;
    const ah = arena.length;
    for (let i = 0; i < maxTries; i++) {
      const x = 1 + (Math.random() * (aw - 2) | 0);
      const y = 1 + (Math.random() * (ah - 2) | 0);
      if (arena[y][x] !== 0) continue;
      let ok = true;
      for (let n = 0; n < avoid.length; n++) {
        const d = Math.hypot(x + 0.5 - avoid[n].x, y + 0.5 - avoid[n].y);
        if (d < minDist) {
          ok = false;
          break;
        }
      }
      if (ok) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: 2.5, y: 2.5 };
  }

  function carveRoom(arena, cx, cy, rw, rh) {
    for (let y = cy - rh; y <= cy + rh; y++) {
      if (y < 1 || y >= arena.length - 1) continue;
      for (let x = cx - rw; x <= cx + rw; x++) {
        if (x < 1 || x >= arena[0].length - 1) continue;
        const nx = (x - cx) / Math.max(1, rw);
        const ny = (y - cy) / Math.max(1, rh);
        const jitter = 1.04 + Math.random() * 0.26;
        if (nx * nx + ny * ny <= jitter) arena[y][x] = 0;
      }
    }
  }

  function roomCenter(room) {
    return { x: room.cx + 0.5, y: room.cy + 0.5 };
  }

  function shortestPathLen(arena, from, to) {
    const aw = arena[0].length;
    const ah = arena.length;
    const sx = clamp(from.x | 0, 0, aw - 1);
    const sy = clamp(from.y | 0, 0, ah - 1);
    const tx = clamp(to.x | 0, 0, aw - 1);
    const ty = clamp(to.y | 0, 0, ah - 1);
    if (arena[sy][sx] === 1 || arena[ty][tx] === 1) return Infinity;

    const qx = new Int16Array(aw * ah);
    const qy = new Int16Array(aw * ah);
    const dist = new Int16Array(aw * ah);
    dist.fill(-1);
    let head = 0;
    let tail = 0;
    const si = sy * aw + sx;
    dist[si] = 0;
    qx[tail] = sx;
    qy[tail] = sy;
    tail++;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (head < tail) {
      const x = qx[head];
      const y = qy[head];
      head++;
      if (x === tx && y === ty) return dist[y * aw + x];
      const nd = dist[y * aw + x] + 1;
      for (let i = 0; i < dirs.length; i++) {
        const nx = x + dirs[i][0];
        const ny = y + dirs[i][1];
        if (nx < 0 || ny < 0 || nx >= aw || ny >= ah) continue;
        if (arena[ny][nx] === 1) continue;
        const ni = ny * aw + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = nd;
        qx[tail] = nx;
        qy[tail] = ny;
        tail++;
      }
    }
    return Infinity;
  }

  function mapQuality(arena, spawn, checkpoint, shop, roomCount) {
    let open = 0;
    let pits = 0;
    let deadEnds = 0;
    for (let y = 1; y < arena.length - 1; y++) {
      for (let x = 1; x < arena[0].length - 1; x++) {
        const t = arena[y][x];
        if (t === 1) continue;
        open++;
        if (t === 2) pits++;
        let neighbors = 0;
        if (arena[y][x + 1] !== 1) neighbors++;
        if (arena[y][x - 1] !== 1) neighbors++;
        if (arena[y + 1][x] !== 1) neighbors++;
        if (arena[y - 1][x] !== 1) neighbors++;
        if (neighbors <= 1) deadEnds++;
      }
    }

    const area = (arena.length - 2) * (arena[0].length - 2);
    const openRatio = open / Math.max(1, area);
    const pitRatio = pits / Math.max(1, open);
    const distSC = shortestPathLen(arena, spawn, checkpoint);
    const distSS = shortestPathLen(arena, spawn, shop);
    const distCS = shortestPathLen(arena, checkpoint, shop);
    if (!Number.isFinite(distSC) || !Number.isFinite(distSS) || !Number.isFinite(distCS)) return -1e9;

    let score = 0;
    score += Math.min(120, distSC * 1.6);
    score += Math.min(90, distSS * 1.25);
    score += Math.min(70, distCS * 1.05);
    score += Math.max(0, 40 - deadEnds * 0.85);
    score += Math.min(32, roomCount * 1.15);
    score -= Math.abs(openRatio - 0.36) * 420;
    score -= Math.abs(pitRatio - 0.075) * 270;
    return score;
  }

  function generateMapCandidate() {
    const arena = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
    const rooms = [];
    const targetRooms = 20 + (Math.random() * 10 | 0);
    let tries = 0;

    while (rooms.length < targetRooms && tries < 900) {
      tries++;
      const rw = 2 + (Math.random() * 4 | 0);
      const rh = 2 + (Math.random() * 4 | 0);
      const cx = 2 + rw + (Math.random() * (MAP_W - rw * 2 - 4) | 0);
      const cy = 2 + rh + (Math.random() * (MAP_H - rh * 2 - 4) | 0);
      let overlaps = false;
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        if (Math.abs(cx - r.cx) <= rw + r.rw + 2 && Math.abs(cy - r.cy) <= rh + r.rh + 2) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      carveRoom(arena, cx, cy, rw, rh);
      rooms.push({ cx, cy, rw, rh });
    }

    if (rooms.length < 6) {
      for (let i = 0; i < 6; i++) {
        const cx = 4 + (Math.random() * (MAP_W - 8) | 0);
        const cy = 4 + (Math.random() * (MAP_H - 8) | 0);
        carveRoom(arena, cx, cy, 2 + (Math.random() * 3 | 0), 2 + (Math.random() * 3 | 0));
        rooms.push({ cx, cy, rw: 3, rh: 3 });
      }
    }

    const connected = [rooms[0]];
    const waiting = rooms.slice(1);
    while (waiting.length) {
      let best = null;
      for (let i = 0; i < connected.length; i++) {
        const a = connected[i];
        for (let j = 0; j < waiting.length; j++) {
          const b = waiting[j];
          const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
          if (!best || d < best.d) best = { d, i, j };
        }
      }
      const a = connected[best.i];
      const b = waiting.splice(best.j, 1)[0];
      connected.push(b);
      carvePath(arena, roomCenter(a), roomCenter(b), 0.9 + Math.random() * 0.7);
    }

    for (let i = 0; i < rooms.length / 2; i++) {
      const a = rooms[Math.random() * rooms.length | 0];
      const b = rooms[Math.random() * rooms.length | 0];
      if (a === b) continue;
      carvePath(arena, roomCenter(a), roomCenter(b), 0.8 + Math.random() * 0.45);
    }

    let spawnRoom = rooms[0];
    let checkpointRoom = rooms[0];
    for (let i = 1; i < rooms.length; i++) {
      if (rooms[i].cx < spawnRoom.cx) spawnRoom = rooms[i];
      if (rooms[i].cx > checkpointRoom.cx) checkpointRoom = rooms[i];
    }
    let shopRoom = rooms[0];
    let shopScore = -1;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const ds = Math.hypot(r.cx - spawnRoom.cx, r.cy - spawnRoom.cy);
      const dc = Math.hypot(r.cx - checkpointRoom.cx, r.cy - checkpointRoom.cy);
      const score = Math.min(ds, dc);
      if (score > shopScore) {
        shopScore = score;
        shopRoom = r;
      }
    }

    const spawn = { ...roomCenter(spawnRoom), a: 0.18 };
    const checkpoint = roomCenter(checkpointRoom);
    const shop = roomCenter(shopRoom);

    for (let i = 0; i < 10; i++) {
      const c = randomOpenCell(arena, [spawn, checkpoint, shop], 5);
      const lumps = 3 + (Math.random() * 4 | 0);
      for (let n = 0; n < lumps; n++) {
        const ox = (Math.random() - 0.5) * 3.2;
        const oy = (Math.random() - 0.5) * 3.2;
        carveDisk(arena, c.x + ox, c.y + oy, 0.7 + Math.random() * 0.7, 2);
      }
    }

    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 6;
      const bx = spawn.x * (1 - t) + checkpoint.x * t;
      const by = spawn.y * (1 - t) + checkpoint.y * t;
      carveDisk(arena, bx + (Math.random() - 0.5) * 3.2, by + (Math.random() - 0.5) * 3.2, 1.5, 0);
    }

    carveDisk(arena, spawn.x, spawn.y, 2.5, 0);
    carveDisk(arena, checkpoint.x, checkpoint.y, 2.6, 0);
    carveDisk(arena, shop.x, shop.y, 2.3, 0);
    carvePath(arena, spawn, checkpoint, 1.35);
    carvePath(arena, checkpoint, shop, 1.2);

    return {
      arena,
      spawn,
      checkpoint,
      shop,
      score: mapQuality(arena, spawn, checkpoint, shop, rooms.length)
    };
  }

  function generateMap() {
    let best = null;
    for (let i = 0; i < 8; i++) {
      const cand = generateMapCandidate();
      if (!best || cand.score > best.score) best = cand;
    }

    mapSerial += 1;
    const site = SITE_CODES[Math.floor(Math.random() * SITE_CODES.length)];
    const name = site + " SECTOR-" + String(mapSerial).padStart(3, "0");
    return {
      arena: best.arena,
      spawn: best.spawn,
      checkpoint: best.checkpoint,
      shop: best.shop,
      name
    };
  }

  function applyGeneratedMap(g) {
    mapName = g.name;
    SPAWN_A.x = g.spawn.x;
    SPAWN_A.y = g.spawn.y;
    SPAWN_A.a = g.spawn.a;
    CHECKPOINT.x = g.checkpoint.x;
    CHECKPOINT.y = g.checkpoint.y;
    SHOP.x = g.shop.x;
    SHOP.y = g.shop.y;
    setMap(g.arena);
  }

  function setMap(m) {
    map = m;
    mw = map[0].length;
    mh = map.length;
    refreshPitTiles();
  }

  function cycleMap() {
    reset();
    say("Deployment zone assigned: " + mapName, 1.6);
  }

  function objective() {
    if (!guardDefeated) return "Reach containment relay and neutralize security sentry";
    if (!checkpointActive) return "Authorize relay checkpoint (E)";
    if (unlockedWeapons.some((u, i) => i > 0 && !u)) return "Checkpoint online. Use armory terminal to unlock gear";
    return "Containment breach active. Survive hostiles and secure resources";
  }

  function refreshHudText() {
    objEl.textContent = "Map: " + mapName + " | Objective: " + objective();
    weaponEl.textContent = "Weapon: " + gun().name;
    msgEl.textContent = lock
      ? "WASD move, Shift sprint, Q dash, G grenade, Space jump, 1-4 swap loadout, M redeploy sector, Left click fire, E interact"
      : "Click to lock pointer";
    setStamina(stamina);
    refreshUtilityHud();
  }

  function setHP(v) {
    hp = clamp(Math.floor(v), 0, 100);
    healthEl.textContent = "Health: " + hp;
    if (hp <= 0 && !over) endGame();
  }

  function setScore(v) {
    score = Math.floor(v);
    scoreEl.textContent = "Score: " + score;
  }

  function setAmmo(v) {
    ammo = clamp(Math.floor(v), 0, MAX_AMMO);
    ammoEl.textContent = "Ammo: " + ammo;
  }

  function setCash(v) {
    cash = clamp(Math.floor(v), 0, 999);
    cashEl.textContent = "Fake$: " + cash;
  }

  function setArmor(v) {
    armor = clamp(Math.floor(v), 0, 100);
    armorEl.textContent = "Armor: " + armor;
  }

  function setStamina(v) {
    stamina = clamp(Math.floor(v), 0, MAX_STAMINA);
    staminaEl.textContent = "Stamina: " + stamina;
  }

  function refreshUtilityHud() {
    const d = dashCd <= 0 ? "Ready" : dashCd.toFixed(1) + "s";
    utilEl.textContent = "Dash: " + d + " | Grenades: " + grenadesCount;
  }

  function ensureAudio() {
    if (!audioCtx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return false;
      audioCtx = new C();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return true;
  }

  function tone(freq, dur, type, vol) {
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + dur + 0.01);
  }

  function startMusic() {
    if (musicOn || !ensureAudio()) return;
    musicOn = true;
    musicStep = 0;
    musicCd = 0.04;
    say("Facility PA online", 1);
  }

  function updateMusic(dt) {
    if (!musicOn || !audioCtx) return;
    musicCd -= dt;
    if (musicCd > 0) return;
    musicCd += 0.24;
    const f = MUSIC_MAIN[musicStep % MUSIC_MAIN.length];
    tone(f, 0.18, "triangle", 0.03);
    if ((musicStep & 1) === 0) {
      const b = MUSIC_BASS[(musicStep / 2 | 0) % MUSIC_BASS.length];
      tone(b, 0.22, "sine", 0.022);
    }
    musicStep++;
  }

  function applyDamage(raw) {
    let dmg = Math.max(1, raw | 0);
    if (dashT > 0) dmg = Math.max(1, Math.floor(dmg * 0.45));
    if (armor > 0) {
      const blocked = Math.min(armor, Math.ceil(dmg * 0.6));
      setArmor(armor - blocked);
      dmg -= blocked;
    }
    if (dmg > 0) setHP(hp - dmg);
  }

  function say(t, d = 2) {
    note = t;
    noteT = d;
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    w = Math.max(320, Math.floor(window.innerWidth));
    h = Math.max(220, Math.floor(window.innerHeight));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = w;
    rays = new Float32Array(cols);
  }

  function isWall(x, y) {
    const ix = x | 0;
    const iy = y | 0;
    return ix < 0 || iy < 0 || ix >= mw || iy >= mh || map[iy][ix] === 1;
  }

  function isPit(x, y) {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= mw || iy >= mh) return false;
    return map[iy][ix] === 2;
  }

  function inPitCore(x, y) {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= mw || iy >= mh) return false;
    if (map[iy][ix] !== 2) return false;
    const cx = ix + 0.5;
    const cy = iy + 0.5;
    return Math.abs(x - cx) < 0.28 && Math.abs(y - cy) < 0.28;
  }

  function canMove(x, y, r) {
    return !isWall(x - r, y - r) && !isWall(x + r, y - r) && !isWall(x - r, y + r) && !isWall(x + r, y + r);
  }

  function move(ent, dx, dy, r) {
    const nx = ent.x + dx;
    if (canMove(nx, ent.y, r)) ent.x = nx;
    const ny = ent.y + dy;
    if (canMove(ent.x, ny, r)) ent.y = ny;
  }

  function cast(ox, oy, a) {
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    let d = 0;
    while (d < MAX_RAY) {
      if (isWall(ox + ca * d, oy + sa * d)) return d;
      d += 0.035;
    }
    return MAX_RAY;
  }

  function los(ax, ay, bx, by, dist) {
    return dist <= cast(ax, ay, Math.atan2(by - ay, bx - ax)) + 0.04;
  }

  function proj(wx, wy, s, hz) {
    const dx = wx - player.x;
    const dy = wy - player.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return null;
    const rel = angN(Math.atan2(dy, dx) - player.a);
    if (Math.abs(rel) > HALF_FOV + 0.35) return null;
    const pr = (w / 2) / Math.tan(HALF_FOV);
    const sz = Math.min(h * 1.3, pr / d * s);
    const sx = Math.tan(rel) * pr + w / 2;
    const c = clamp(sx | 0, 0, cols - 1);
    if (d > rays[c] + 0.02) return null;
    return { d, sz, sx, top: (h - sz) / 2 + hz };
  }

  function objectVisible(wx, wy, pad = 0.4) {
    const dx = wx - player.x;
    const dy = wy - player.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.05 || d >= MAX_RAY) return false;
    const rel = angN(Math.atan2(dy, dx) - player.a);
    if (Math.abs(rel) > HALF_FOV + 0.68) return false;
    const pr = (w / 2) / Math.tan(HALF_FOV);
    const sx = Math.tan(rel) * pr + w / 2;
    const c = clamp(sx | 0, 0, cols - 1);
    return d <= rays[c] + pad;
  }

  function proj3(wx, wy, wz) {
    const dx = wx - player.x;
    const dy = wy - player.y;
    const ca = Math.cos(player.a);
    const sa = Math.sin(player.a);
    const forward = dx * ca + dy * sa;
    if (forward <= 0.05) return null;
    const right = -dx * sa + dy * ca;
    const pr = (w / 2) / Math.tan(HALF_FOV);
    const sx = w / 2 + (right / forward) * pr;
    if (sx < -64 || sx > w + 64) return null;
    const camZ = 0.52 + player.z * 0.6;
    const sy = h / 2 + player.p * h * 0.36 - ((wz - camZ) / forward) * pr;
    return { sx, sy, d: forward };
  }

  function drawFace3D(points, fill, stroke = "rgba(0,0,0,0.22)") {
    const pts = [];
    let avg = 0;
    for (let i = 0; i < points.length; i++) {
      const p = proj3(points[i].x, points[i].y, points[i].z);
      if (!p) return null;
      avg += p.d;
      pts.push(p);
    }
    avg /= points.length;
    return { pts, fill, stroke, avg };
  }

  function paintFaces(faces) {
    faces.sort((a, b) => b.avg - a.avg);
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i];
      ctx.beginPath();
      ctx.moveTo(f.pts[0].sx, f.pts[0].sy);
      for (let j = 1; j < f.pts.length; j++) ctx.lineTo(f.pts[j].sx, f.pts[j].sy);
      ctx.closePath();
      ctx.fillStyle = f.fill;
      ctx.fill();
      if (f.stroke) {
        ctx.strokeStyle = f.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function drawBox3D(cx, cy, z, sx, sy, sz, palette) {
    if (!objectVisible(cx, cy, Math.max(sx, sy) * 0.85)) return;
    const x1 = cx - sx / 2, x2 = cx + sx / 2;
    const y1 = cy - sy / 2, y2 = cy + sy / 2;
    const z1 = z, z2 = z + sz;
    const faces = [];
    const pushFace = (pts, fill, stroke) => {
      const f = drawFace3D(pts, fill, stroke);
      if (f) faces.push(f);
    };

    pushFace([{ x: x1, y: y1, z: z2 }, { x: x2, y: y1, z: z2 }, { x: x2, y: y2, z: z2 }, { x: x1, y: y2, z: z2 }], palette.top, palette.edge);
    pushFace([{ x: x1, y: y1, z: z1 }, { x: x2, y: y1, z: z1 }, { x: x2, y: y1, z: z2 }, { x: x1, y: y1, z: z2 }], palette.front, palette.edge);
    pushFace([{ x: x2, y: y1, z: z1 }, { x: x2, y: y2, z: z1 }, { x: x2, y: y2, z: z2 }, { x: x2, y: y1, z: z2 }], palette.right, palette.edge);
    pushFace([{ x: x1, y: y2, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z2 }, { x: x1, y: y2, z: z2 }], palette.left, palette.edge);
    pushFace([{ x: x1, y: y2, z: z1 }, { x: x2, y: y2, z: z1 }, { x: x2, y: y2, z: z2 }, { x: x1, y: y2, z: z2 }], palette.back, palette.edge);
    if (faces.length) paintFaces(faces);
  }

  function drawHole3D(cx, cy) {
    if (!objectVisible(cx, cy, 0.95)) return;
    const zTop = 0.02;
    const faces = [];

    drawBox3D(cx, cy, -0.03, 0.88, 0.88, 0.05, {
      top: "#48586c",
      front: "#2d3a4b",
      right: "#222d3c",
      left: "#1c2635",
      back: "#283242",
      edge: "rgba(8,12,18,0.55)"
    });
    drawBox3D(cx, cy, 0.01, 0.74, 0.74, 0.04, {
      top: "#586c84",
      front: "#303c4c",
      right: "#252f3e",
      left: "#202a3a",
      back: "#2b3546",
      edge: "rgba(9,13,20,0.58)"
    });
    drawBox3D(cx - 0.28, cy - 0.28, 0.02, 0.07, 0.07, 0.05, {
      top: "#a8c6df", front: "#5f7488", right: "#4b6177", left: "#465b70", back: "#53697f", edge: "rgba(8,12,18,0.5)"
    });
    drawBox3D(cx + 0.28, cy - 0.28, 0.02, 0.07, 0.07, 0.05, {
      top: "#a8c6df", front: "#5f7488", right: "#4b6177", left: "#465b70", back: "#53697f", edge: "rgba(8,12,18,0.5)"
    });
    drawBox3D(cx - 0.28, cy + 0.28, 0.02, 0.07, 0.07, 0.05, {
      top: "#a8c6df", front: "#5f7488", right: "#4b6177", left: "#465b70", back: "#53697f", edge: "rgba(8,12,18,0.5)"
    });
    drawBox3D(cx + 0.28, cy + 0.28, 0.02, 0.07, 0.07, 0.05, {
      top: "#a8c6df", front: "#5f7488", right: "#4b6177", left: "#465b70", back: "#53697f", edge: "rgba(8,12,18,0.5)"
    });

    const capOuter = drawFace3D(
      [
        { x: cx - 0.33, y: cy - 0.33, z: zTop + 0.004 },
        { x: cx + 0.33, y: cy - 0.33, z: zTop + 0.004 },
        { x: cx + 0.33, y: cy + 0.33, z: zTop + 0.004 },
        { x: cx - 0.33, y: cy + 0.33, z: zTop + 0.004 }
      ],
      "#05080f",
      "rgba(0,0,0,0.5)"
    );
    if (capOuter) faces.push(capOuter);

    const capInner = drawFace3D(
      [
        { x: cx - 0.2, y: cy - 0.2, z: zTop + 0.006 },
        { x: cx + 0.2, y: cy - 0.2, z: zTop + 0.006 },
        { x: cx + 0.2, y: cy + 0.2, z: zTop + 0.006 },
        { x: cx - 0.2, y: cy + 0.2, z: zTop + 0.006 }
      ],
      "#010205",
      null
    );
    if (capInner) faces.push(capInner);
    if (faces.length) paintFaces(faces);
  }

  function drawStructures3D() {
    drawBox3D(CHECKPOINT.x, CHECKPOINT.y, -0.02, 1.22, 1.22, 0.1, {
      top: "rgba(98,112,136,0.9)",
      front: "rgba(52,63,80,0.9)",
      right: "rgba(39,49,65,0.9)",
      left: "rgba(34,44,60,0.9)",
      back: "rgba(46,56,72,0.9)",
      edge: "rgba(10,12,18,0.45)"
    });
    const cpPalette = checkpointActive
      ? { top: "#b98cff", front: "#7a54d6", right: "#5f42ad", left: "#4b348a", back: "#6b49b8", edge: "rgba(20,16,30,0.5)" }
      : guardDefeated
        ? { top: "#72f3b1", front: "#3bc27f", right: "#2e9563", left: "#267c52", back: "#33a86f", edge: "rgba(9,24,18,0.46)" }
        : { top: "#e87979", front: "#ba4c4c", right: "#8f3636", left: "#7e2f2f", back: "#a74242", edge: "rgba(24,8,8,0.45)" };
    drawBox3D(CHECKPOINT.x, CHECKPOINT.y, 0, 0.82, 0.82, 1.06, cpPalette);
    drawBox3D(CHECKPOINT.x - 0.36, CHECKPOINT.y, 0.18, 0.2, 0.2, 0.78, cpPalette);
    drawBox3D(CHECKPOINT.x + 0.36, CHECKPOINT.y, 0.18, 0.2, 0.2, 0.78, cpPalette);
    drawBox3D(CHECKPOINT.x, CHECKPOINT.y, 1.02, 0.96, 0.96, 0.08, {
      top: "rgba(236,244,255,0.9)",
      front: "rgba(170,190,220,0.75)",
      right: "rgba(110,130,165,0.72)",
      left: "rgba(118,138,175,0.72)",
      back: "rgba(150,172,206,0.72)",
      edge: "rgba(20,26,34,0.34)"
    });
    drawBox3D(CHECKPOINT.x, CHECKPOINT.y, 1.1, 0.22, 0.22, 0.28, {
      top: checkpointActive ? "#ffe7ff" : "#fff6d8",
      front: checkpointActive ? "#b98cff" : "#f2d982",
      right: checkpointActive ? "#8f66e0" : "#c1a957",
      left: checkpointActive ? "#7b58c4" : "#a58e4a",
      back: checkpointActive ? "#9a71ea" : "#d4bf6a",
      edge: "rgba(20,20,28,0.5)"
    });
    const cpLabel = objectVisible(CHECKPOINT.x, CHECKPOINT.y, 1) ? proj3(CHECKPOINT.x, CHECKPOINT.y, 1.46) : null;
    if (cpLabel) {
      ctx.fillStyle = checkpointActive ? "#d5f0d3" : "#efe3c1";
      ctx.font = "bold 12px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("RLY", cpLabel.sx, cpLabel.sy);
    }

    drawBox3D(SHOP.x, SHOP.y, -0.02, 1.34, 1.34, 0.1, {
      top: "rgba(85,122,146,0.92)",
      front: "rgba(46,73,96,0.9)",
      right: "rgba(34,60,82,0.9)",
      left: "rgba(30,54,74,0.9)",
      back: "rgba(40,66,88,0.9)",
      edge: "rgba(8,14,22,0.45)"
    });
    drawBox3D(SHOP.x, SHOP.y, 0, 1, 1, 1.24, {
      top: "#8fe1ff",
      front: "#389ed1",
      right: "#2d7ea9",
      left: "#286f95",
      back: "#338bb8",
      edge: "rgba(8,18,28,0.4)"
    });
    drawBox3D(SHOP.x - 0.36, SHOP.y, 0.08, 0.18, 0.18, 1.08, {
      top: "#9ce8ff", front: "#3ea8d8", right: "#317fa5", left: "#2b7598", back: "#388eb8", edge: "rgba(8,18,28,0.4)"
    });
    drawBox3D(SHOP.x + 0.36, SHOP.y, 0.08, 0.18, 0.18, 1.08, {
      top: "#9ce8ff", front: "#3ea8d8", right: "#317fa5", left: "#2b7598", back: "#388eb8", edge: "rgba(8,18,28,0.4)"
    });
    drawBox3D(SHOP.x, SHOP.y - 0.28, 0.66, 0.72, 0.2, 0.42, {
      top: "rgba(215,244,255,0.95)",
      front: "rgba(76,170,218,0.95)",
      right: "rgba(38,111,146,0.95)",
      left: "rgba(34,98,130,0.95)",
      back: "rgba(58,142,182,0.95)",
      edge: "rgba(8,12,20,0.5)"
    });
    drawBox3D(SHOP.x, SHOP.y - 0.41, 1.06, 0.96, 0.06, 0.2, {
      top: "#e7fbff",
      front: "#74ccf2",
      right: "#3d8cb1",
      left: "#347b9c",
      back: "#57a9cf",
      edge: "rgba(8,14,22,0.45)"
    });
    const shopLabel = objectVisible(SHOP.x, SHOP.y, 1.2) ? proj3(SHOP.x, SHOP.y - 0.29, 1.1) : null;
    if (shopLabel) {
      ctx.fillStyle = "#d5e6d9";
      ctx.font = "bold 13px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("ARMORY", shopLabel.sx, shopLabel.sy);
    }
  }

  function drawWorld(hz) {
    const horizon = h / 2 + hz;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, checkpointActive ? "#4f4735" : "#2b332f");
    sky.addColorStop(0.55, checkpointActive ? "#222016" : "#151c18");
    sky.addColorStop(1, checkpointActive ? "#121009" : "#0d110f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);

    const sun = ctx.createRadialGradient(w * 0.74, horizon * 0.24, 4, w * 0.74, horizon * 0.24, w * 0.36);
    sun.addColorStop(0, checkpointActive ? "rgba(255,170,94,0.45)" : "rgba(170,208,168,0.34)");
    sun.addColorStop(0.38, checkpointActive ? "rgba(170,85,45,0.22)" : "rgba(95,128,102,0.16)");
    sun.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, horizon);

    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, checkpointActive ? "#2f2a1e" : "#232b27");
    floor.addColorStop(0.45, checkpointActive ? "#1b1711" : "#161c18");
    floor.addColorStop(1, checkpointActive ? "#0f0d08" : "#0f1210");
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.strokeStyle = checkpointActive ? "rgba(255, 178, 112, 0.14)" : "rgba(164, 194, 167, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      const y = horizon + (h - horizon) * t * t;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const pr = (w / 2) / Math.tan(HALF_FOV);
    const start = player.a - HALF_FOV;
    for (let x = 0; x < cols; x++) {
      const ra = start + x / cols * FOV;
      const raw = cast(player.x, player.y, ra);
      const d = raw * Math.cos(ra - player.a);
      rays[x] = d;
      const wh = Math.min(h * 1.45, pr / Math.max(0.001, d));
      const y = (h - wh) / 2 + hz;
      const hx = player.x + Math.cos(ra) * raw;
      const hy = player.y + Math.sin(ra) * raw;
      const fx = hx - Math.floor(hx);
      const fy = hy - Math.floor(hy);
      const edgeX = Math.min(fx, 1 - fx);
      const edgeY = Math.min(fy, 1 - fy);
      const side = edgeX < edgeY ? 1 : 0;

      const tile = ((Math.floor(hx * 2.8) + Math.floor(hy * 2.8)) & 1) ? 0.9 : 1.12;
      const rough = 0.86 + (Math.sin(hx * 12.4 + hy * 8.3) * 0.5 + 0.5) * 0.2;
      const distShade = clamp(1 - d / 30, 0.14, 1);
      const sideShade = side ? 0.82 : 1;
      const lit = distShade * tile * rough * sideShade;

      let rBase = checkpointActive ? 182 : 162;
      let gBase = checkpointActive ? 154 : 174;
      let bBase = checkpointActive ? 118 : 162;
      if (side) {
        rBase *= 0.88;
        gBase *= 0.9;
        bBase *= 0.9;
      }
      const r = clamp((rBase * lit) | 0, 18, 255);
      const g = clamp((gBase * lit) | 0, 18, 255);
      const b = clamp((bBase * lit) | 0, 18, 255);

      ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
      ctx.fillRect(x, y, 1, wh);

      if (wh > 8) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x, y + wh - 1, 1, 1);
      }
      if (!side && lit > 0.55) {
        ctx.fillStyle = checkpointActive ? "rgba(255,188,122,0.2)" : "rgba(174,205,176,0.18)";
        ctx.fillRect(x, y + wh * 0.18, 1, Math.max(1, wh * 0.04));
      }
      if (d < 6 && !side) {
        ctx.fillStyle = checkpointActive ? "rgba(255,172,112,0.08)" : "rgba(124,178,130,0.08)";
        ctx.fillRect(x, y + wh * 0.35, 1, Math.max(1, wh * 0.08));
      }
    }

  }

  function drawEnemy(e, hz) {
    const s = proj(e.x, e.y, e.type === "sentry" ? 1.12 : e.type === "dash" ? 1.06 : .95, hz);
    if (!s) return;
    const cx = s.sx, top = s.top, size = s.sz;
    const isDash = e.type === "dash";
    const torsoW = e.type === "sentry" ? size * 0.3 : size * 0.24;
    const torsoH = e.type === "sentry" ? size * 0.34 : size * 0.29;
    const legW = torsoW * 0.36;
    const legH = torsoH * 0.72;
    const headW = torsoW * 0.68;
    const headH = torsoH * 0.64;
    const bodyY = top + size * .57;
    const headY = top + size * .32;
    const fade = Math.max(.34, 1 - s.d / 16);
    const dir = e.sd === 0 ? Math.sin(performance.now() * 0.004) : e.sd || 1;
    const gunShift = dir * size * 0.09;

    ctx.save();
    ctx.globalAlpha = fade;

    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.beginPath();
    ctx.ellipse(cx, top + size * 0.94, torsoW * 1.15, torsoW * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    const torsoX = cx - torsoW * 0.5;
    const torsoY = bodyY - torsoH * 0.5;
    const torsoTop = e.type === "sentry" ? "#ffcb68" : isDash ? "#9dff77" : "#d87672";
    const torsoLeft = e.type === "sentry" ? "#b67d30" : isDash ? "#56b443" : "#94413f";
    const torsoRight = e.type === "sentry" ? "#7b4f1f" : isDash ? "#3a872d" : "#5d2524";

    ctx.fillStyle = torsoTop;
    ctx.fillRect(torsoX, torsoY, torsoW, torsoH);
    ctx.fillStyle = torsoLeft;
    ctx.fillRect(torsoX, torsoY, torsoW * 0.24, torsoH);
    ctx.fillStyle = torsoRight;
    ctx.fillRect(torsoX + torsoW * 0.76, torsoY, torsoW * 0.24, torsoH);

    const headX = cx - headW * 0.5;
    const headY0 = headY - headH * 0.5;
    ctx.fillStyle = isDash ? "#d7ffd1" : "#f4c89d";
    ctx.fillRect(headX, headY0, headW, headH);
    ctx.fillStyle = isDash ? "#8bd77f" : "#b98b64";
    ctx.fillRect(headX + headW * 0.76, headY0, headW * 0.24, headH);
    ctx.fillStyle = isDash ? "rgba(22,38,18,0.82)" : "rgba(12,16,26,0.82)";
    ctx.fillRect(headX + headW * 0.12, headY0 + headH * 0.28, headW * 0.76, headH * 0.2);

    const legY = torsoY + torsoH;
    ctx.fillStyle = "#232c38";
    ctx.fillRect(cx - torsoW * 0.44, legY, legW, legH);
    ctx.fillRect(cx + torsoW * 0.08, legY, legW, legH);
    ctx.fillStyle = "#131a22";
    ctx.fillRect(cx - torsoW * 0.44, legY + legH * 0.78, legW, legH * 0.22);
    ctx.fillRect(cx + torsoW * 0.08, legY + legH * 0.78, legW, legH * 0.22);

    const armY = torsoY + torsoH * 0.34;
    ctx.fillStyle = "#263241";
    ctx.fillRect(cx - torsoW * 0.72, armY, torsoW * 0.22, torsoH * 0.62);
    ctx.fillRect(cx + torsoW * 0.5, armY, torsoW * 0.22, torsoH * 0.62);

    const gy = torsoY + torsoH * 0.46;
    const gs = cx + gunShift;
    const ge = gs + dir * size * 0.32;
    if (!isDash) {
      const gunGrad = ctx.createLinearGradient(Math.min(gs, ge), gy, Math.max(gs, ge), gy);
      gunGrad.addColorStop(0, "#515b6e");
      gunGrad.addColorStop(1, "#1f2430");
      ctx.fillStyle = gunGrad;
      ctx.fillRect(Math.min(gs, ge), gy - size * .03, Math.max(3, Math.abs(ge - gs)), size * .06);
      ctx.fillStyle = "#141922";
      ctx.fillRect(cx - size * 0.09, gy - size * 0.06, size * 0.18, size * 0.12);
    } else {
      ctx.strokeStyle = "rgba(182,255,142,0.95)";
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.46, gy - size * 0.02);
      ctx.lineTo(cx - torsoW * 0.66, gy + size * 0.12);
      ctx.moveTo(cx + torsoW * 0.46, gy - size * 0.02);
      ctx.lineTo(cx + torsoW * 0.66, gy + size * 0.12);
      ctx.stroke();
    }

    if (e.mf > .01) {
      const f = size * (.1 + e.mf * .14);
      ctx.fillStyle = isDash ? "rgba(170,255,120," + (.35 + e.mf * .5) + ")" : "rgba(255,190,90," + (.3 + e.mf * .5) + ")";
      ctx.beginPath();
      ctx.moveTo(ge, gy);
      ctx.lineTo(ge + dir * f, gy - f * .65);
      ctx.lineTo(ge + dir * f, gy + f * .65);
      ctx.closePath();
      ctx.fill();
    }
    if (e.type === "sentry") {
      ctx.strokeStyle = "rgba(255,220,110,.8)";
      ctx.lineWidth = Math.max(1, size * .04);
      ctx.beginPath();
      ctx.ellipse(cx, torsoY + torsoH * 0.5, torsoW * 0.95, torsoH * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isDash) {
      ctx.strokeStyle = "rgba(155,255,120,0.75)";
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - torsoW * 0.35, headY0 - headH * 0.12);
      ctx.lineTo(cx - torsoW * 0.15, headY0 - headH * 0.38);
      ctx.lineTo(cx + torsoW * 0.15, headY0 - headH * 0.38);
      ctx.lineTo(cx + torsoW * 0.35, headY0 - headH * 0.12);
      ctx.stroke();
      if (e.dt > 0) {
        ctx.strokeStyle = "rgba(164,255,135,0.52)";
        ctx.lineWidth = Math.max(1, size * 0.045);
        ctx.beginPath();
        ctx.moveTo(cx, torsoY + torsoH * 0.55);
        ctx.lineTo(cx - dir * size * 0.62, torsoY + torsoH * 0.75);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawLoot(hz) {
    for (const p of loot) {
      const s = proj(p.x, p.y, .34, hz);
      if (!s) continue;
      const bob = Math.sin(p.a * 4) * s.sz * .06;
      const x = s.sx;
      const y = s.top + s.sz * .62 + bob;
      const r = Math.max(2, s.sz * .12);
      const dx = r * 0.75;
      const dy = r * 0.52;
      const hgt = r * 1.15;

      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath();
      ctx.ellipse(x, y + hgt * 0.95, r * 1.25, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();

      const topCol = p.k === "ammo"
        ? "#b7ecff"
        : p.k === "med"
          ? "#ffd1d1"
          : p.k === "armor"
            ? "#d2ffdb"
            : "#ffe89d";
      const leftCol = p.k === "ammo"
        ? "#5cb0d8"
        : p.k === "med"
          ? "#cf6d6d"
          : p.k === "armor"
            ? "#59b974"
            : "#d2b25a";
      const rightCol = p.k === "ammo"
        ? "#3d7796"
        : p.k === "med"
          ? "#8f4141"
          : p.k === "armor"
            ? "#2f8850"
            : "#9f8039";

      ctx.beginPath();
      ctx.moveTo(x, y - hgt);
      ctx.lineTo(x - dx, y - hgt + dy);
      ctx.lineTo(x, y - hgt + dy * 2);
      ctx.lineTo(x + dx, y - hgt + dy);
      ctx.closePath();
      ctx.fillStyle = topCol;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x - dx, y - hgt + dy);
      ctx.lineTo(x - dx, y - hgt + dy + hgt);
      ctx.lineTo(x, y - hgt + dy * 2 + hgt);
      ctx.lineTo(x, y - hgt + dy * 2);
      ctx.closePath();
      ctx.fillStyle = leftCol;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + dx, y - hgt + dy);
      ctx.lineTo(x + dx, y - hgt + dy + hgt);
      ctx.lineTo(x, y - hgt + dy * 2 + hgt);
      ctx.lineTo(x, y - hgt + dy * 2);
      ctx.closePath();
      ctx.fillStyle = rightCol;
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = Math.max(1, s.sz * 0.02);
      ctx.stroke();
    }
  }

  function drawParkour(hz) {
    for (let i = 0; i < pitTiles.length; i++) {
      const p = pitTiles[i];
      drawHole3D(p.x, p.y);
    }
  }

  function drawBullets(list, hz, core, glow, scale = .2) {
    for (const b of list) {
      const s = proj(b.x, b.y, scale, hz);
      if (!s) continue;
      const r = Math.max(1.5, s.sz * .12);
      const y = h / 2 + hz;
      ctx.fillStyle = b.core || core;
      ctx.beginPath(); ctx.arc(s.sx, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.glow || glow;
      ctx.beginPath(); ctx.arc(s.sx, y, r * 1.95, 0, Math.PI * 2); ctx.fill();
      const len = Math.min(18, r * 5);
      ctx.strokeStyle = b.glow || glow;
      ctx.lineWidth = Math.max(1, r * 0.55);
      ctx.beginPath();
      ctx.moveTo(s.sx - len * 0.45, y);
      ctx.lineTo(s.sx + len * 0.45, y);
      ctx.stroke();
    }
  }

  function drawWeapon() {
    const wpn = gun();
    const bw = Math.min(220, w * .27), bh = Math.min(140, h * .24);
    const t = performance.now() * 0.0022;
    const bob = Math.sin(t) * 2.2 + Math.cos(t * 0.57) * 1.3;
    const x = w * .53 + 58 + recoil * 12;
    const y = h - bh * .42 - 18 + recoil * 9 + player.p * 24 + bob;

    const body = ctx.createLinearGradient(x, y - bh, x + bw, y);
    body.addColorStop(0, wpn.toneA);
    body.addColorStop(1, wpn.toneB);
    ctx.fillStyle = body;
    ctx.fillRect(x, y - bh, bw * .63, bh);

    const barrelW =
      wpn.id === "shotgun" ? 0.68
        : wpn.id === "smg" ? 0.5
          : wpn.id === "rifle" ? 0.74 : 0.58;
    const barrelH = wpn.id === "shotgun" ? 0.32 : wpn.id === "rifle" ? 0.2 : 0.24;
    ctx.fillStyle = "#1a1f2a";
    ctx.fillRect(x + bw * .42, y - bh * .8, bw * barrelW, bh * barrelH);
    ctx.fillStyle = "#0f141d";
    ctx.fillRect(x + bw * .12, y - bh * .36, bw * .2, bh * .36 + (wpn.id === "shotgun" ? bh * .08 : 0));
    ctx.fillStyle = "rgba(190, 220, 255, 0.24)";
    ctx.fillRect(x + bw * 0.07, y - bh * .92, bw * .47, bh * .08);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + bw * .03, y - bh * .08, bw * .55, bh * .08);

    if (wpn.id === "smg") {
      ctx.fillStyle = "#2a3644";
      ctx.fillRect(x + bw * .22, y - bh * .12, bw * .12, bh * .18);
      ctx.fillStyle = "#111720";
      ctx.fillRect(x + bw * .48, y - bh * .9, bw * .12, bh * .12);
    } else if (wpn.id === "rifle") {
      ctx.fillStyle = "#263627";
      ctx.fillRect(x + bw * .14, y - bh * .14, bw * .14, bh * .2);
      ctx.fillStyle = "#111a14";
      ctx.fillRect(x + bw * .45, y - bh * .88, bw * .15, bh * .12);
      ctx.fillStyle = "#3e5944";
      ctx.fillRect(x + bw * .02, y - bh * .46, bw * .16, bh * .2);
    } else if (wpn.id === "shotgun") {
      ctx.fillStyle = "#6f5238";
      ctx.fillRect(x + bw * .03, y - bh * .26, bw * .15, bh * .26);
      ctx.fillStyle = "#241a14";
      ctx.fillRect(x + bw * .52, y - bh * .83, bw * .6, bh * .08);
    } else {
      ctx.fillStyle = "#2a3340";
      ctx.fillRect(x + bw * .18, y - bh * .08, bw * .08, bh * .16);
    }

    if (muzzle > .01) {
      const fs = 18 + muzzle * 24, fx = x + bw * 1.01, fy = y - bh * .68;
      ctx.fillStyle = "rgba(255,210,110," + (.28 + muzzle * .45) + ")";
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fs, fy - fs * .6);
      ctx.lineTo(fx + fs * .92, fy + fs * .6);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawMiniMap() {
    const px = 184, m = 12, x0 = w - px - m, y0 = m;
    const dim = Math.max(mw, mh), c = px / dim;
    const cw = mw * c, ch = mh * c;
    const bg = ctx.createLinearGradient(x0 - 8, y0 - 8, x0 + cw + 8, y0 + ch + 8);
    bg.addColorStop(0, "rgba(10,18,30,0.72)");
    bg.addColorStop(1, "rgba(7,12,21,0.58)");
    ctx.fillStyle = bg;
    ctx.fillRect(x0 - 8, y0 - 8, cw + 16, ch + 16);
    ctx.strokeStyle = "rgba(163, 223, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 8, y0 - 8, cw + 16, ch + 16);

    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      if (map[y][x] === 1) ctx.fillStyle = "#3f4f67";
      else if (map[y][x] === 2) ctx.fillStyle = "#04070d";
      else ctx.fillStyle = "#142233";
      ctx.fillRect(x0 + x * c, y0 + y * c, c, c);
    }

    ctx.fillStyle = checkpointActive ? "#c38eff" : guardDefeated ? "#5af195" : "#ff7373";
    ctx.fillRect(x0 + (CHECKPOINT.x - .2) * c, y0 + (CHECKPOINT.y - .2) * c, c * .4, c * .4);
    ctx.fillStyle = "#7fd7ff";
    ctx.fillRect(x0 + (SHOP.x - .2) * c, y0 + (SHOP.y - .2) * c, c * .4, c * .4);

    ctx.fillStyle = "#7bd2ff";
    for (const p of loot) ctx.fillRect(x0 + (p.x - .1) * c, y0 + (p.y - .1) * c, c * .2, c * .2);

    for (const e of enemies) if (e.alive) {
      ctx.fillStyle = e.type === "sentry" ? "#ffcf66" : e.type === "dash" ? "#9eff68" : "#ff6f6f";
      ctx.beginPath(); ctx.arc(x0 + e.x * c, y0 + e.y * c, Math.max(2, c * .18), 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x0 + player.x * c, y0 + player.y * c, Math.max(2, c * .2), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ecfbff"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + player.x * c, y0 + player.y * c);
    ctx.lineTo(x0 + (player.x + Math.cos(player.a) * .8) * c, y0 + (player.y + Math.sin(player.a) * .8) * c);
    ctx.stroke();

    ctx.fillStyle = "rgba(180,206,182,0.92)";
    ctx.font = "bold 10px Trebuchet MS";
    ctx.textAlign = "left";
    ctx.fillText("SITE MAP", x0 - 4, y0 - 12);
  }

  function drawHotbar() {
    const slotH = 44;
    const gap = 10;
    const slotW = Math.max(64, Math.min(116, Math.floor((w - (WEAPONS.length - 1) * gap - 24) / WEAPONS.length)));
    const total = WEAPONS.length * slotW + (WEAPONS.length - 1) * gap;
    const startX = Math.max(12, (w - total) * 0.5);
    const y = h - slotH - 96;

    weaponSwapFlash = Math.max(0, weaponSwapFlash - 0.03);
    for (let i = 0; i < WEAPONS.length; i++) {
      const slotX = startX + i * (slotW + gap);
      const active = i === weaponIndex;
      const unlocked = !!unlockedWeapons[i];
      const alpha = active ? 0.94 : 0.58;
      const fill = ctx.createLinearGradient(slotX, y, slotX + slotW, y + slotH);
      fill.addColorStop(0, "rgba(12, 19, 31, " + alpha + ")");
      fill.addColorStop(1, "rgba(8, 13, 22, " + (alpha - 0.1) + ")");
      ctx.fillStyle = fill;
      ctx.fillRect(slotX, y, slotW, slotH);
      if (!unlocked) {
        ctx.fillStyle = "rgba(6,8,12,0.38)";
        ctx.fillRect(slotX, y, slotW, slotH);
      }

      ctx.strokeStyle = active
        ? "rgba(150, 226, 255, " + (0.7 + weaponSwapFlash * 0.25) + ")"
        : "rgba(132, 166, 206, 0.32)";
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(slotX, y, slotW, slotH);

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "12px Trebuchet MS";
      ctx.textAlign = "left";
      ctx.fillText((i + 1) + "  " + WEAPONS[i].name, slotX + 8, y + 16);

      ctx.fillStyle = "rgba(192, 220, 255, 0.88)";
      ctx.font = "11px Trebuchet MS";
      if (unlocked) {
        ctx.fillText(
          "cost " + WEAPONS[i].ammoCost + "  " + (WEAPONS[i].auto ? "auto" : "semi"),
          slotX + 8,
          y + 32
        );
      } else {
        ctx.fillStyle = "rgba(245, 192, 128, 0.95)";
        ctx.fillText("LOCKED  $" + WEAPON_UNLOCK_COST[i], slotX + 8, y + 32);
      }
    }
  }

  function drawShopUI() {
    if (!lock || over) return;
    const d = Math.hypot(player.x - SHOP.x, player.y - SHOP.y);
    if (d > 2.2) return;
    const bx = 24;
    const by = h - 262;
    const bw = Math.min(420, w * 0.52);
    const bh = 118;

    ctx.beginPath();
    ctx.moveTo(bx + 18, by);
    ctx.lineTo(bx + bw, by + 8);
    ctx.lineTo(bx + bw - 20, by + bh + 8);
    ctx.lineTo(bx, by + bh);
    ctx.closePath();
    ctx.fillStyle = "rgba(10,18,30,0.78)";
    ctx.fill();
    ctx.strokeStyle = "rgba(128,210,255,0.5)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const nextLock = unlockedWeapons.findIndex((u, i) => i > 0 && !u);
    const l1 = nextLock !== -1
      ? "Unlock " + WEAPONS[nextLock].name + " $" + WEAPON_UNLOCK_COST[nextLock]
      : "Ammo $2 | Armor $4 | Med $4";
    const l2 = nextLock === -1
      ? "Boots $5 | Damage $6"
      : "Guns unlock in order";

    ctx.fillStyle = "#d7e6da";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.textAlign = "left";
    ctx.fillText("ARMORY TERMINAL", bx + 16, by + 24);
    ctx.font = "12px Trebuchet MS";
    ctx.fillStyle = "#b6cdb8";
    ctx.fillText(l1, bx + 16, by + 50);
    ctx.fillText(l2, bx + 16, by + 70);
    ctx.fillStyle = "#9fbba2";
    ctx.fillText("Press E to buy next item", bx + 16, by + 96);
  }

  function drawOverlay() {
    if (prompt) {
      const bw = Math.min(w * .55, 520), bh = 34, bx = (w - bw) * .5, by = h - 86;
      const promptBg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      promptBg.addColorStop(0, "rgba(7,14,24,0.82)");
      promptBg.addColorStop(1, "rgba(10,17,29,0.74)");
      ctx.fillStyle = promptBg; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "rgba(170, 202, 173, 0.42)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#d1e3d2"; ctx.font = "16px Trebuchet MS"; ctx.textAlign = "center";
      ctx.fillText(prompt, w * .5, by + 22);
    }
    if (noteT > 0 && note) {
      const bw = Math.min(w * .5, 480), bh = 32, bx = (w - bw) * .5, by = 20;
      const noteBg = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      noteBg.addColorStop(0, "rgba(12,14,20,0.82)");
      noteBg.addColorStop(1, "rgba(24,17,11,0.72)");
      ctx.fillStyle = noteBg; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "rgba(214, 168, 122, 0.48)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#e2c49a"; ctx.font = "15px Trebuchet MS"; ctx.textAlign = "center";
      ctx.fillText(note, w * .5, by + 21);
    }
  }

  function drawPostFX() {
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.18, w * 0.5, h * 0.5, w * 0.78);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.48)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(220,230,220,0.018)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, h * 0.7);
    glow.addColorStop(0, "rgba(132,166,138,0.045)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    if (checkpointActive) {
      const alarm = 0.03 + Math.sin(performance.now() * 0.007) * 0.02;
      ctx.fillStyle = "rgba(255,124,76," + alarm + ")";
      ctx.fillRect(0, 0, w, h);
    }
  }

  function mkEnemy(x, y, o = {}) {
    return {
      x, y,
      alive: true,
      type: o.type || "grunt",
      hp: o.hp || 1,
      speed: o.speed === undefined ? .95 : o.speed,
      fr: o.fr || 10.5,
      fi: o.fi || 1.0,
      fc: o.fc === undefined ? (0.4 + Math.random() * .9) : o.fc,
      dmg: o.dmg || 9,
      sc: o.sc || 1,
      sd: o.sd === undefined ? (Math.random() < .5 ? -1 : 1) : o.sd,
      st: 0.9 + Math.random() * 1.8,
      ac: 0,
      mf: 0,
      dc: o.dc === undefined ? (1.1 + Math.random() * 1.1) : o.dc,
      dt: 0,
      dvx: 0,
      dvy: 0
    };
  }

  function spawnGuards() {
    enemies.push(mkEnemy(CHECKPOINT.x + 0.2, CHECKPOINT.y - 1.2, {
      type: "sentry",
      hp: 10,
      speed: 0,
      fi: .52,
      fr: 15,
      dmg: 14,
      fc: .45,
      sd: 0,
      sc: 14
    }));
    enemies.push(mkEnemy(CHECKPOINT.x - 1.1, CHECKPOINT.y - 1.0, { hp: 3, fc: .58, dmg: 10 }));
    enemies.push(mkEnemy(CHECKPOINT.x + 1.1, CHECKPOINT.y - 1.0, { hp: 3, fc: .8, dmg: 10 }));
  }

  function spawnEnemy() {
    for (let i = 0; i < 36; i++) {
      const x = 1 + Math.random() * (mw - 2), y = 1 + Math.random() * (mh - 2);
      if (isWall(x, y) || isPit(x, y)) continue;
      if (Math.hypot(x - player.x, y - player.y) < 4) continue;
      if (Math.hypot(x - CHECKPOINT.x, y - CHECKPOINT.y) < 2.4) continue;
      if (Math.hypot(x - SHOP.x, y - SHOP.y) < 1.8) continue;
      const dashChance = checkpointActive ? 0.16 + Math.min(0.18, wave * 0.012) : 0.08 + Math.min(0.1, wave * 0.008);
      if (Math.random() < dashChance) {
        enemies.push(mkEnemy(x, y, { type: "dash", hp: 3 + (wave > 4 ? 1 : 0), speed: 1.18, fr: 0, fi: 9, fc: 9, dmg: 16, sc: 5 }));
      } else {
        enemies.push(mkEnemy(x, y, { hp: Math.random() < .22 ? 2 : 1, fc: 0.4 + Math.random() * 1.2 }));
      }
      return;
    }
  }

  function enemyBullet(src, nx, ny, cfg = {}) {
    const a = Math.atan2(ny, nx) + (Math.random() - .5) * (cfg.spread || 0);
    const dx = Math.cos(a), dy = Math.sin(a);
    const d = cfg.sd || .34;
    const x = src.x + dx * d, y = src.y + dy * d;
    if (isWall(x, y)) return;
    ebullets.push({
      x, y,
      vx: dx * (cfg.speed || ENEMY_BULLET_SPEED),
      vy: dy * (cfg.speed || ENEMY_BULLET_SPEED),
      life: cfg.life || ENEMY_BULLET_LIFE,
      dmg: cfg.dmg || src.dmg || 9,
      core: cfg.core || null,
      glow: cfg.glow || null
    });
    if (ebullets.length > 160) ebullets.shift();
    if (src.mf !== undefined) src.mf = 1;
  }

  function drop(e) {
    const d = (k, v, dx, dy) => loot.push({ x: e.x + dx, y: e.y + dy, k, v, a: Math.random() * 6.28 });
    if (e.type === "sentry") {
      d("ammo", 20, .25, 0);
      d("ammo", 12, -.22, .18);
      d("cash", 4, .18, -.22);
      d("armor", 24, -.18, -.22);
      return;
    }
    if (e.type === "dash") {
      d("cash", 2 + (Math.random() < 0.45 ? 1 : 0), .12, -.14);
      if (Math.random() < .5) d("armor", 10 + (Math.random() * 8 | 0), -.15, .1);
    }
    if (Math.random() < .55) d("ammo", 6 + (Math.random() * 6 | 0), (Math.random() - .5) * .34, (Math.random() - .5) * .34);
    if (Math.random() < .33) d("cash", 1 + (Math.random() < .2 ? 1 : 0), (Math.random() - .5) * .34, (Math.random() - .5) * .34);
    if (Math.random() < .2) d("med", 8 + (Math.random() * 8 | 0), (Math.random() - .5) * .34, (Math.random() - .5) * .34);
    if (Math.random() < .18) d("armor", 10 + (Math.random() * 10 | 0), (Math.random() - .5) * .34, (Math.random() - .5) * .34);
    if (loot.length > 80) loot.splice(0, loot.length - 80);
  }

  function kill(e) {
    if (!e.alive) return;
    e.alive = false;
    setScore(score + e.sc);
    drop(e);
    if (e.type === "sentry") {
      guardDefeated = true;
      say("Security sentry neutralized. Relay checkpoint unlocked.", 2.6);
      refreshHudText();
    }
  }

  function activateCheckpoint() {
    if (!guardDefeated) {
      say("Relay lockout active. Security sentry still online.", 2.2);
      return;
    }
    checkpointActive = true;
    checkpointSpawn = { x: CHECKPOINT.x - 1.2, y: CHECKPOINT.y + 1.2, a: -1.2 };
    player.x = checkpointSpawn.x;
    player.y = checkpointSpawn.y;
    player.a = checkpointSpawn.a;
    setHP(Math.min(100, hp + 25));
    setAmmo(Math.min(MAX_AMMO, ammo + 18));
    grenadesCount = Math.min(MAX_GRENADES, grenadesCount + 1);
    refreshUtilityHud();
    say("Relay checkpoint authorized. Respawn moved to secure wing.", 2.5);
    refreshHudText();
  }

  function buyFromShop() {
    const nextLock = unlockedWeapons.findIndex((u, i) => i > 0 && !u);
    if (cash >= 2 && ammo <= 35) {
      setCash(cash - 2);
      setAmmo(ammo + 20);
      return say("Bought ammo crate +20 ($2)", 1.6);
    }
    if (cash >= 4 && hp <= 55) {
      setCash(cash - 4);
      setHP(hp + 35);
      return say("Bought med kit +35 HP ($4)", 1.6);
    }
    if (cash >= 4 && armor <= 45) {
      setCash(cash - 4);
      setArmor(armor + 35);
      return say("Bought armor plates +35 ($4)", 1.6);
    }
    if (nextLock !== -1) {
      const cost = WEAPON_UNLOCK_COST[nextLock];
      if (cash >= cost) {
        setCash(cash - cost);
        unlockedWeapons[nextLock] = true;
        switchWeapon(nextLock);
        return say("Unlocked " + WEAPONS[nextLock].name + " ($" + cost + ")", 1.9);
      }
    }
    if (cash >= 2 && ammo <= 102) {
      setCash(cash - 2);
      setAmmo(ammo + 20);
      return say("Bought ammo crate +20 ($2)", 1.6);
    }
    if (cash >= 5 && mobilityLevel < 2) {
      setCash(cash - 5);
      mobilityLevel += 1;
      return say("Bought boots upgrade. Mobility " + mobilityLevel + "/2", 1.8);
    }
    if (cash >= 6 && damageLevel < 3) {
      setCash(cash - 6);
      damageLevel += 1;
      return say("Damage upgrade purchased. Level " + damageLevel, 1.8);
    }
    if (nextLock !== -1 && cash < WEAPON_UNLOCK_COST[nextLock]) {
      return say("Need $" + WEAPON_UNLOCK_COST[nextLock] + " to unlock " + WEAPONS[nextLock].name + ".", 1.8);
    }
    if (cash < 2) return say("Not enough fake money. Need at least $2.", 1.6);
    if (damageLevel >= 3) return say("Shop: max damage level reached.", 1.6);
    say("Shop options: ammo $2, armor $4, med $4, boots $5, damage $6", 2);
  }

  function interact() {
    if (!wantInteract || !lock || over) return;
    wantInteract = false;
    const cpDist = Math.hypot(player.x - CHECKPOINT.x, player.y - CHECKPOINT.y);
    const shopDist = Math.hypot(player.x - SHOP.x, player.y - SHOP.y);
    if (cpDist <= 1.4 && cpDist <= shopDist + 0.3) return activateCheckpoint();
    if (shopDist <= 1.6) return buyFromShop();
  }

  function updatePrompt() {
    prompt = "";
    if (!lock || over) return;
    const cpDist = Math.hypot(player.x - CHECKPOINT.x, player.y - CHECKPOINT.y);
    const shopDist = Math.hypot(player.x - SHOP.x, player.y - SHOP.y);
    if (cpDist <= 1.5) {
      prompt = guardDefeated
        ? (checkpointActive ? "Relay active (E to refresh save state)" : "Press E to authorize relay checkpoint")
        : "Relay locked. Neutralize security sentry";
      return;
    }
    if (shopDist <= 1.7) {
      const nextLock = unlockedWeapons.findIndex((u, i) => i > 0 && !u);
      if (nextLock !== -1) {
        prompt = "Armory [E]: unlock " + WEAPONS[nextLock].name + " $" + WEAPON_UNLOCK_COST[nextLock] + " (restricted loadout)";
      } else {
        prompt = "Armory [E]: ammo $2 / armor $4 / med $4 / boots $5 / damage $6";
      }
    }
  }

  function playShot(wpn) {
    if (!ensureAudio()) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    const f0 = wpn.id === "shotgun" ? 160 : wpn.id === "smg" ? 280 : 240;
    const f1 = wpn.id === "shotgun" ? 60 : wpn.id === "smg" ? 130 : 85;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f1, now + .06);
    g.gain.setValueAtTime(.001, now);
    g.gain.exponentialRampToValueAtTime(.09, now + .01);
    g.gain.exponentialRampToValueAtTime(.001, now + .08);
    o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now + .09);
  }

  function shoot() {
    if (!lock || over || shootCd > 0) return;
    if (!unlockedWeapons[weaponIndex]) return;
    startMusic();
    const wpn = gun();
    if (ammo < wpn.ammoCost) return say("Need " + wpn.ammoCost + " ammo for " + wpn.name + ".");
    shootCd = wpn.fire;
    recoil = Math.max(recoil, wpn.recoil);
    muzzle = 1;
    setAmmo(ammo - wpn.ammoCost);
    playShot(wpn);

    for (let i = 0; i < wpn.pellets; i++) {
      const a = player.a + (Math.random() - .5) * wpn.spread;
      let x = player.x + Math.cos(a) * .35, y = player.y + Math.sin(a) * .35;
      if (isWall(x, y)) { x = player.x; y = player.y; }
      bullets.push({
        x,
        y,
        vx: Math.cos(a) * wpn.speed,
        vy: Math.sin(a) * wpn.speed,
        life: wpn.life,
        pow: (1 + damageLevel) * wpn.power
      });
    }
    if (bullets.length > 180) bullets.shift();
  }

  function tryDash() {
    if (!lock || over || dashCd > 0 || dashT > 0 || stamina < DASH_STAMINA_COST) return;
    const fx = Math.cos(player.a), fy = Math.sin(player.a);
    const rx = Math.cos(player.a + Math.PI / 2), ry = Math.sin(player.a + Math.PI / 2);
    let dx = 0, dy = 0;
    if (keys.KeyW) { dx += fx; dy += fy; }
    if (keys.KeyS) { dx -= fx; dy -= fy; }
    if (keys.KeyD) { dx += rx; dy += ry; }
    if (keys.KeyA) { dx -= rx; dy -= ry; }
    const len = Math.hypot(dx, dy);
    if (len <= 0.001) { dx = fx; dy = fy; }
    else { dx /= len; dy /= len; }
    dashVX = dx * DASH_SPEED;
    dashVY = dy * DASH_SPEED;
    dashT = DASH_TIME;
    dashCd = DASH_CD;
    sprintRegenDelay = 0.45;
    setStamina(stamina - DASH_STAMINA_COST);
    refreshUtilityHud();
    say("Dash", 0.5);
  }

  function throwGrenade() {
    if (!lock || over || grenadeCd > 0 || grenadesCount <= 0) return;
    const a = player.a;
    let x = player.x + Math.cos(a) * 0.4;
    let y = player.y + Math.sin(a) * 0.4;
    if (isWall(x, y)) { x = player.x; y = player.y; }
    grenades.push({
      x,
      y,
      z: 0.34 + player.z,
      vx: Math.cos(a) * 7.1,
      vy: Math.sin(a) * 7.1,
      vz: 3.2,
      life: 1.45
    });
    grenadesCount = Math.max(0, grenadesCount - 1);
    grenadeCd = 0.32;
    refreshUtilityHud();
  }

  function detonateGrenade(g) {
    const radius = 2.35;
    const r2 = radius * radius;
    for (const e of enemies) if (e.alive) {
      const dx = e.x - g.x;
      const dy = e.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      const mult = 1 - d / radius;
      e.hp -= (2.6 + mult * 3.1) * (1 + damageLevel * 0.22);
      if (e.hp <= 0) kill(e);
    }
    blastFx.push({ x: g.x, y: g.y, t: 0, life: 0.34 });
    if (blastFx.length > 20) blastFx.shift();
  }

  function updateGrenades(dt) {
    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.life -= dt;
      g.vz -= 9.8 * dt;
      const nx = g.x + g.vx * dt;
      const ny = g.y + g.vy * dt;
      if (isWall(nx, g.y)) g.vx *= -0.55;
      else g.x = nx;
      if (isWall(g.x, ny)) g.vy *= -0.55;
      else g.y = ny;
      g.z += g.vz * dt;
      if (g.z < 0.02) {
        g.z = 0.02;
        if (Math.abs(g.vz) < 1.2) g.vz = 0;
        else g.vz *= -0.38;
        g.vx *= 0.83;
        g.vy *= 0.83;
      }
      if (g.life <= 0) {
        detonateGrenade(g);
        grenades.splice(i, 1);
      }
    }

    for (let i = blastFx.length - 1; i >= 0; i--) {
      const b = blastFx[i];
      b.t += dt;
      if (b.t >= b.life) blastFx.splice(i, 1);
    }
  }

  function drawGrenades(hz) {
    for (const g of grenades) {
      const s = proj(g.x, g.y, 0.2, hz);
      if (!s) continue;
      const y = s.top + s.sz * 0.72 - g.z * 58;
      const r = Math.max(2, s.sz * 0.1);
      ctx.fillStyle = "#a4f0d1";
      ctx.beginPath();
      ctx.arc(s.sx, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(8,16,12,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const b of blastFx) {
      const s = proj(b.x, b.y, 0.5, hz);
      if (!s) continue;
      const p = b.t / b.life;
      const rr = Math.max(6, s.sz * (0.18 + p * 0.58));
      const alpha = (1 - p) * 0.58;
      ctx.strokeStyle = "rgba(255,220,140," + alpha + ")";
      ctx.lineWidth = Math.max(1.5, rr * 0.08);
      ctx.beginPath();
      ctx.arc(s.sx, s.top + s.sz * 0.65, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function updatePlayer(dt) {
    const fx = Math.cos(player.a), fy = Math.sin(player.a);
    const rx = Math.cos(player.a + Math.PI / 2), ry = Math.sin(player.a + Math.PI / 2);
    let mx = 0, my = 0;
    if (keys.KeyW) { mx += fx; my += fy; }
    if (keys.KeyS) { mx -= fx; my -= fy; }
    if (keys.KeyD) { mx += rx; my += ry; }
    if (keys.KeyA) { mx -= rx; my -= ry; }
    const len = Math.hypot(mx, my);
    const speedScale = 1 + mobilityLevel * 0.12;
    const sprintHeld = keys.ShiftLeft || keys.ShiftRight;
    const canSprint = sprintHeld && len > 0.01 && player.g && dashT <= 0 && stamina > 0;
    const sprintMul = canSprint ? SPRINT_MULT : 1;
    if (len > 0 && dashT <= 0) {
      move(
        player,
        mx / len * MOVE_SPEED * speedScale * sprintMul * dt,
        my / len * MOVE_SPEED * speedScale * sprintMul * dt,
        PLAYER_R
      );
    }
    if (canSprint) {
      setStamina(stamina - STAMINA_DRAIN * dt);
      sprintRegenDelay = 0.4;
    } else {
      sprintRegenDelay = Math.max(0, sprintRegenDelay - dt);
      if (sprintRegenDelay <= 0) setStamina(stamina + STAMINA_REGEN * dt);
    }

    if (dashT > 0) {
      move(player, dashVX * dt, dashVY * dt, PLAYER_R);
      dashT = Math.max(0, dashT - dt);
      if (dashT <= 0) {
        dashVX = 0;
        dashVY = 0;
      }
    }
    dashCd = Math.max(0, dashCd - dt);
    grenadeCd = Math.max(0, grenadeCd - dt);

    if (jumpBufferT > 0) jumpBufferT = Math.max(0, jumpBufferT - dt);
    else jumpQueued = false;
    coyoteT = player.g ? 0.09 : Math.max(0, coyoteT - dt);
    if (jumpQueued && (player.g || coyoteT > 0)) {
      player.vz = JUMP * (1 + mobilityLevel * 0.15);
      player.g = false;
      coyoteT = 0;
      jumpQueued = false;
      jumpBufferT = 0;
    }
    if (!player.g || player.z > 0) {
      player.vz -= GRAVITY * dt;
      player.z += player.vz * dt;
      if (player.z <= 0) { player.z = 0; player.vz = 0; player.g = true; }
    }

    parkourRecover = Math.max(0, parkourRecover - dt);
    if (inPitCore(player.x, player.y) && player.z < 0.36 && parkourRecover <= 0) {
      parkourRecover = 0.8;
      applyDamage(11);
      const respawn = checkpointActive ? checkpointSpawn : SPAWN_A;
      player.x = respawn.x;
      player.y = respawn.y;
      player.a = respawn.a;
      player.z = 0;
      player.vz = 0;
      player.g = true;
      jumpQueued = false;
      say(checkpointActive ? "Missed jump. Respawned at checkpoint." : "Missed jump. Try the center line.", 1.8);
    }

    recoil = Math.max(0, recoil - dt * 9.2);
    muzzle = Math.max(0, muzzle - dt * 15);
    shootCd = Math.max(0, shootCd - dt);
    refreshUtilityHud();
  }

  function updateEnemies(dt) {
    let live = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      live++;
      e.ac = Math.max(0, e.ac - dt);
      e.fc = Math.max(0, e.fc - dt);
      e.mf = Math.max(0, e.mf - dt * 16);
      e.dc = Math.max(0, e.dc - dt);
      if (e.dt > 0) e.dt = Math.max(0, e.dt - dt);

      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > .001) {
        const nx = dx / d, ny = dy / d;
        if (e.type === "dash") {
          if (e.dt > 0) {
            move(e, e.dvx * dt, e.dvy * dt, .22);
          } else {
            if (d > 1.3) move(e, nx * e.speed * dt, ny * e.speed * dt, .22);
            if (e.dc <= 0 && d > 1.6 && d < 9.4 && los(e.x, e.y, player.x, player.y, d)) {
              const dashSpd = 11.2 + Math.min(4.2, wave * 0.2);
              e.dvx = nx * dashSpd;
              e.dvy = ny * dashSpd;
              e.dt = 0.28;
              e.dc = 0.85 + Math.random() * 0.65;
              e.mf = 1;
            }
          }
        } else if (e.type !== "sentry") {
          e.st -= dt;
          if (e.st <= 0) { e.sd *= -1; e.st = .9 + Math.random() * 1.7; }
          let fw = 0;
          if (d > 4.8) fw = 1;
          else if (d < 2.2) fw = -.55;
          const stf = d < 9 ? e.sd * .5 : 0;
          const px = -ny, py = nx;
          move(e, (nx * fw + px * stf) * e.speed * dt, (ny * fw + py * stf) * e.speed * dt, .2);
        }
        if (e.type !== "dash" && e.fc <= 0 && d <= e.fr && los(e.x, e.y, player.x, player.y, d)) {
          enemyBullet(e, nx, ny, { spread: e.type === "sentry" ? .05 : .12 });
          e.fc = e.fi + Math.random() * .45;
        }
      }

      const cd = Math.hypot(player.x - e.x, player.y - e.y);
      const touch = e.type === "dash" ? (e.dt > 0 ? 24 : 14) : 10;
      if (cd <= .62 && e.ac <= 0) { e.ac = e.type === "dash" ? 0.52 : 0.8; applyDamage(touch); }
    }

    spawnCd -= dt;
    waveT += dt;
    if (waveT > 22) {
      waveT = 0;
      wave++;
      if (grenadesCount < MAX_GRENADES) {
        grenadesCount++;
        refreshUtilityHud();
      }
    }
    const maxE = checkpointActive ? Math.min(22, 7 + wave * 2) : Math.min(18, 4 + wave * 2);
    if (spawnCd <= 0 && live < maxE) {
      spawnEnemy();
      spawnCd = Math.max(.45, 2.15 - wave * .11);
    }
  }

  function updateBullets(dt) {
    const hr2 = (.2 + BULLET_R) ** 2;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      const mx = b.vx * dt, my = b.vy * dt;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / .05));
      const sx = mx / steps, sy = my / steps;
      let dead = false;
      for (let s = 0; s < steps; s++) {
        const nx = b.x + sx, ny = b.y + sy;
        if (isWall(nx, ny)) { dead = true; break; }
        b.x = nx; b.y = ny;
        for (const e of enemies) if (e.alive) {
          const dx = e.x - b.x, dy = e.y - b.y;
          if (dx * dx + dy * dy <= hr2) {
            e.hp -= (b.pow || 1);
            if (e.hp <= 0) kill(e);
            dead = true;
            break;
          }
        }
        if (dead) break;
      }
      if (dead) bullets.splice(i, 1);
    }
  }

  function updateEBullets(dt) {
    const hr2 = (PLAYER_R + ENEMY_BULLET_R) ** 2;
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.life -= dt;
      if (b.life <= 0) { ebullets.splice(i, 1); continue; }
      const mx = b.vx * dt, my = b.vy * dt;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my)) / .05));
      const sx = mx / steps, sy = my / steps;
      let dead = false;
      for (let s = 0; s < steps; s++) {
        const nx = b.x + sx, ny = b.y + sy;
        if (isWall(nx, ny)) { dead = true; break; }
        b.x = nx; b.y = ny;
        const dx = player.x - b.x, dy = player.y - b.y;
        if (dx * dx + dy * dy <= hr2) { applyDamage(b.dmg || 9); dead = true; break; }
      }
      if (dead) ebullets.splice(i, 1);
    }
  }

  function updateLoot(dt) {
    for (let i = loot.length - 1; i >= 0; i--) {
      const p = loot[i];
      p.a += dt;
      const dx = player.x - p.x, dy = player.y - p.y;
      if (dx * dx + dy * dy <= .34 * .34) {
        if (p.k === "ammo") { setAmmo(ammo + p.v); say("Picked ammo +" + p.v, 1.1); }
        else if (p.k === "cash") { setCash(cash + p.v); say("Picked fake cash +" + p.v, 1.1); }
        else if (p.k === "med") { setHP(hp + p.v); say("Picked med +" + p.v, 1.1); }
        else if (p.k === "armor") { setArmor(armor + p.v); say("Picked armor +" + p.v, 1.1); }
        loot.splice(i, 1);
      }
    }
  }

  function endGame() {
    over = true;
    lock = false;
    finalScoreEl.textContent = "Score: " + score;
    gameOverEl.classList.remove("hidden");
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function reset() {
    applyGeneratedMap(generateMap());
    guardDefeated = false;
    checkpointActive = false;
    checkpointSpawn = { x: SPAWN_A.x, y: SPAWN_A.y, a: SPAWN_A.a };
    parkourRecover = 0;
    damageLevel = 0;
    mobilityLevel = 0;
    stamina = MAX_STAMINA;
    sprintRegenDelay = 0;
    dashCd = 0;
    dashT = 0;
    dashVX = 0;
    dashVY = 0;
    grenadesCount = 2;
    grenadeCd = 0;
    over = false;
    triggerDown = false;
    jumpQueued = false;
    jumpBufferT = 0;
    coyoteT = 0;
    weaponIndex = 0;
    weaponSwapFlash = 0;
    unlockedWeapons = [true, false, false, false];

    hp = 100; score = 0; ammo = 30; cash = 3; armor = 0;
    setHP(hp); setScore(score); setAmmo(ammo); setCash(cash); setArmor(armor);

    player.x = SPAWN_A.x; player.y = SPAWN_A.y; player.a = SPAWN_A.a;
    player.p = 0; player.z = 0; player.vz = 0; player.g = true;

    enemies.length = 0; bullets.length = 0; ebullets.length = 0; grenades.length = 0; blastFx.length = 0; loot.length = 0;
    spawnGuards();

    recoil = 0; muzzle = 0; shootCd = 0; spawnCd = 0; waveT = 0; wave = 1;
    prompt = ""; note = ""; noteT = 0; wantInteract = false;

    gameOverEl.classList.add("hidden");
    setStamina(stamina);
    refreshUtilityHud();
    refreshHudText();
  }

  function update(dt) {
    if (over) return;
    updateMusic(dt);
    updatePlayer(dt);
    if (triggerDown && gun().auto) shoot();
    updateEnemies(dt);
    updateGrenades(dt);
    updateBullets(dt);
    updateEBullets(dt);
    updateLoot(dt);
    interact();
    updatePrompt();
    if (noteT > 0) {
      noteT -= dt;
      if (noteT <= 0) { noteT = 0; note = ""; }
    }
  }

  function render() {
    const hz = player.z * 65 + player.p * h * .36;
    drawWorld(hz);
    drawParkour(hz);
    drawStructures3D();
    for (const e of enemies) if (e.alive) drawEnemy(e, hz);
    drawGrenades(hz);
    drawBullets(ebullets, hz, "rgba(255,110,90,.96)", "rgba(255,85,60,.42)", .19);
    drawLoot(hz);
    drawBullets(bullets, hz, "rgba(255,232,120,.95)", "rgba(255,180,90,.44)", .2);
    drawWeapon();
    drawPostFX();
    drawHotbar();
    drawShopUI();
    drawMiniMap();
    drawOverlay();
  }

  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function onMove(e) {
    if (!lock || over) return;
    player.a += e.movementX * ROT;
    if (player.a > Math.PI) player.a -= Math.PI * 2;
    if (player.a < -Math.PI) player.a += Math.PI * 2;
    player.p -= e.movementY * PITCH;
    player.p = clamp(player.p, -MAX_PITCH, MAX_PITCH);
  }

  function lockPointer() { if (!over) canvas.requestPointerLock(); }

  function onPL() {
    lock = document.pointerLockElement === canvas;
    if (!lock) triggerDown = false;
    if (lock) startMusic();
    refreshHudText();
  }

  function onKey(e, d) {
    if (e.code in keys) {
      if (e.code === "Space" && d && !keys.Space) {
        jumpQueued = true;
        jumpBufferT = 0.14;
      }
      keys[e.code] = d;
      if (e.code === "Space") e.preventDefault();
      if (e.code === "KeyE" && d) wantInteract = true;
    }
    if (!d) return;
    if (e.code === "KeyQ") return tryDash();
    if (e.code === "KeyG") return throwGrenade();
    if (e.code === "KeyM") return cycleMap();
    if (e.code === "Digit1") switchWeapon(0);
    else if (e.code === "Digit2") switchWeapon(1);
    else if (e.code === "Digit3") switchWeapon(2);
    else if (e.code === "Digit4") switchWeapon(3);
  }

  function initEvents() {
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", lockPointer);
    document.addEventListener("pointerlockchange", onPL);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("keydown", (e) => onKey(e, true));
    document.addEventListener("keyup", (e) => onKey(e, false));
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      startMusic();
      if (document.pointerLockElement !== canvas && !over) lockPointer();
      else {
        triggerDown = true;
        shoot();
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) triggerDown = false;
    });
    document.addEventListener("wheel", (e) => {
      if (!lock || over) return;
      if (e.deltaY > 0) cycleWeapon(1);
      else if (e.deltaY < 0) cycleWeapon(-1);
    }, { passive: true });
    restartButton.addEventListener("click", reset);
  }

  function init() {
    resize();
    initEvents();
    reset();
    requestAnimationFrame(loop);
  }

  init();
})();
