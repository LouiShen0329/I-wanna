(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const muteButton = document.getElementById("muteButton");

  const VIEW_W = 960;
  const VIEW_H = 540;
  const WORLD_W = 3740;
  const PLAYER_W = 24;
  const PLAYER_H = 28;
  const MOVE_SPEED = 265;
  const GRAVITY = 2180;
  const JUMP_SPEED = -760;
  const MAX_FALL = 1220;

  const basePlatforms = [
    { id: "start", x: 0, y: 500, w: 500, h: 60 },
    { id: "intro-step", x: 590, y: 500, w: 230, h: 60 },
    { id: "ledge-a", x: 920, y: 456, w: 170, h: 22 },
    { id: "ledge-b", x: 1180, y: 410, w: 130, h: 22 },
    { id: "save-floor", x: 1380, y: 500, w: 430, h: 60 },
    { id: "crumble-a", x: 1850, y: 468, w: 104, h: 18, crumble: true },
    { id: "lonely", x: 2010, y: 430, w: 110, h: 20 },
    { id: "reverse-floor", x: 2140, y: 500, w: 390, h: 60 },
    { id: "stairs-a", x: 2580, y: 462, w: 110, h: 20 },
    { id: "stairs-b", x: 2740, y: 425, w: 105, h: 20 },
    { id: "final-floor", x: 2880, y: 500, w: 820, h: 60 },
    { id: "key-ledge", x: 2920, y: 432, w: 160, h: 18 },
    { id: "door-step", x: 3320, y: 468, w: 170, h: 18 },
  ];

  const staticSpikes = [
    { x: 524, y: 474, w: 40, h: 26, dir: "up", label: "gap" },
    { x: 835, y: 514, w: 42, h: 26, dir: "up", label: "gap" },
    { x: 1518, y: 472, w: 42, h: 28, dir: "up", label: "visible" },
    { x: 2268, y: 472, w: 42, h: 28, dir: "up", label: "reverse" },
    { x: 3152, y: 472, w: 42, h: 28, dir: "up", label: "final" },
  ];

  const signs = [
    { x: 96, y: 422, text: "欢迎来到正常关卡" },
    { x: 312, y: 422, text: "绝对安全" },
    { x: 1454, y: 422, text: "SAVE" },
    { x: 1660, y: 422, text: "SAVE?" },
    { x: 2180, y: 422, text: "向右就是向右" },
    { x: 3180, y: 422, text: "终点很近" },
  ];

  const checkpoints = [
    { x: 64, y: 472 },
    { x: 1418, y: 472 },
    { x: 2295, y: 472 },
    { x: 3008, y: 472 },
  ];

  const trapDefs = [
    {
      id: "safe-sign",
      rect: { x: 250, y: 0, w: 26, h: VIEW_H },
      action() {
        addSpike(352, 468, 40, 32, "up", "牌子没有说为谁安全");
        say("牌子没有说为谁安全。", 2.1);
        shake(9);
      },
    },
    {
      id: "gift-shot",
      rect: { x: 620, y: 0, w: 28, h: VIEW_H },
      action() {
        addProjectile(806, 456, -360, 0, "会飞的奖励");
        say("奖励开始主动靠近你。", 2);
      },
    },
    {
      id: "ceiling-drop",
      rect: { x: 960, y: 0, w: 28, h: VIEW_H },
      action() {
        addFallingSpike(1028, -96, 42, 88, "抬头是不礼貌的");
        say("天花板想参与一下。", 2);
        shake(6);
      },
    },
    {
      id: "ledge-move",
      rect: { x: 1228, y: 0, w: 24, h: VIEW_H },
      action() {
        const ledge = platforms.find((platform) => platform.id === "ledge-b");
        if (ledge) ledge.x += 54;
        addSpike(1190, 382, 36, 28, "down", "平台只是路过");
        say("平台挪了一下，很合理。", 2.2);
      },
    },
    {
      id: "fake-save",
      rect: { x: 1638, y: 0, w: 26, h: VIEW_H },
      action() {
        fakeSave.armed = true;
        fakeSave.vx = 240;
        addSpike(1692, 468, 72, 32, "up", "问号是重点");
        say("问号是重点。", 2.1);
        shake(7);
      },
    },
    {
      id: "floor-lie",
      rect: { x: 1860, y: 0, w: 24, h: VIEW_H },
      action() {
        say("这块地板只讲前半句。", 2);
      },
    },
    {
      id: "reverse",
      rect: { x: 2156, y: 0, w: 24, h: VIEW_H },
      action() {
        state.reverseUntil = Math.max(state.reverseUntil, state.time + 4.6);
        addProjectile(2475, 462, -260, 0, "左右互换后再躲");
        say("左右互换，请保持体面。", 2.4);
      },
    },
    {
      id: "stairs-pop",
      rect: { x: 2632, y: 0, w: 28, h: VIEW_H },
      action() {
        addSpike(2608, 434, 36, 28, "up", "楼梯也会反悔");
        addProjectile(2786, 396, -210, -60, "楼梯的小脾气");
        say("楼梯也会反悔。", 1.9);
      },
    },
    {
      id: "key-tease",
      rect: { x: 2870, y: 0, w: 28, h: VIEW_H },
      action() {
        if (!state.hasKey) {
          key.vx = 150;
          key.teased = true;
          say("钥匙有自己的想法。", 2);
        }
      },
    },
  ];

  const pressed = new Set();
  const jumpCodes = new Set(["ArrowUp", "KeyW", "Space"]);
  const leftCodes = ["ArrowLeft", "KeyA"];
  const rightCodes = ["ArrowRight", "KeyD"];

  let audioCtx = null;
  let lastFrame = 0;
  let platforms = [];
  let hazards = [];
  let projectiles = [];
  let particles = [];
  let triggered = new Set();
  let cameraX = 0;
  let jumpQueued = false;

  const state = {
    started: false,
    won: false,
    deaths: 0,
    time: 0,
    checkpointIndex: 0,
    spawn: { x: checkpoints[0].x, y: checkpoints[0].y },
    hasKey: false,
    muted: false,
    reverseUntil: 0,
    deathTimer: 0,
    pendingDeath: "",
    message: "",
    messageTimer: 0,
    shake: 0,
    goalFakeDone: false,
  };

  const player = {
    x: state.spawn.x,
    y: state.spawn.y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    jumps: 2,
    onGround: false,
    face: 1,
  };

  const fakeSave = {
    x: 1668,
    y: 448,
    w: 24,
    h: 38,
    vx: 0,
    armed: false,
  };

  const key = {
    x: 2928,
    y: 398,
    w: 22,
    h: 22,
    vx: 0,
    teased: false,
  };

  const goal = {
    x: 3408,
    y: 420,
    w: 46,
    h: 48,
  };

  function clonePlatforms() {
    return basePlatforms.map((platform) => ({
      ...platform,
      originalX: platform.x,
      originalY: platform.y,
      gone: false,
      crumbleTimer: null,
    }));
  }

  function resetTransientWorld() {
    platforms = clonePlatforms();
    hazards = [];
    projectiles = [];
    particles = [];
    triggered = new Set();
    state.reverseUntil = 0;
    fakeSave.x = 1668;
    fakeSave.vx = 0;
    fakeSave.armed = false;
    key.x = 2928;
    key.y = 398;
    key.vx = 0;
    key.teased = false;
    goal.x = state.goalFakeDone ? 3534 : 3408;
  }

  function resetPlayer() {
    player.x = state.spawn.x;
    player.y = state.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.jumps = 2;
    player.onGround = false;
  }

  function hardReset() {
    state.won = false;
    state.started = true;
    state.deaths = 0;
    state.checkpointIndex = 0;
    state.spawn = { x: checkpoints[0].x, y: checkpoints[0].y };
    state.hasKey = false;
    state.goalFakeDone = false;
    state.message = "";
    state.messageTimer = 0;
    state.deathTimer = 0;
    resetTransientWorld();
    resetPlayer();
  }

  function respawn(reason) {
    resetTransientWorld();
    resetPlayer();
    say(reason, 2.4);
  }

  function addSpike(x, y, w, h, dir, reason) {
    hazards.push({ kind: "spike", x, y, w, h, dir, reason, age: 0 });
  }

  function addFallingSpike(x, y, w, h, reason) {
    hazards.push({ kind: "falling", x, y, w, h, vy: 0, dir: "down", reason, age: 0 });
  }

  function addProjectile(x, y, vx, vy, reason) {
    projectiles.push({ x, y, w: 22, h: 22, vx, vy, reason, spin: 0 });
  }

  function say(text, duration = 2) {
    state.message = text;
    state.messageTimer = duration;
  }

  function shake(amount) {
    state.shake = Math.max(state.shake, amount);
  }

  function playTone(type) {
    if (state.muted) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      const tones = {
        jump: [440, 0.045, "square", 0.028],
        save: [660, 0.09, "triangle", 0.035],
        death: [110, 0.16, "sawtooth", 0.045],
        key: [880, 0.12, "triangle", 0.04],
        win: [523, 0.28, "triangle", 0.045],
      };
      const [freq, length, wave, volume] = tones[type] || tones.jump;
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);
      if (type === "win") osc.frequency.linearRampToValueAtTime(freq * 1.5, now + length);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + length);
    } catch {
      state.muted = true;
      muteButton.classList.add("is-muted");
    }
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function insetRect(rect, insetX, insetY) {
    return {
      x: rect.x + insetX,
      y: rect.y + insetY,
      w: Math.max(0, rect.w - insetX * 2),
      h: Math.max(0, rect.h - insetY * 2),
    };
  }

  function isDown(codes) {
    return codes.some((code) => pressed.has(code));
  }

  function queueJump() {
    jumpQueued = true;
  }

  function handleJump() {
    if (!jumpQueued || state.deathTimer > 0 || state.won || !state.started) return;
    jumpQueued = false;
    if (player.jumps <= 0) return;
    player.vy = JUMP_SPEED;
    player.onGround = false;
    player.jumps -= 1;
    spawnDust(player.x + player.w / 2, player.y + player.h, 5, "#d6f7a6");
    playTone("jump");
  }

  function moveAndCollide(dt) {
    const reversed = state.time < state.reverseUntil;
    let move = 0;
    const left = isDown(leftCodes);
    const right = isDown(rightCodes);
    if (left) move -= 1;
    if (right) move += 1;
    if (reversed) move *= -1;

    player.vx = move * MOVE_SPEED;
    if (move !== 0) player.face = move > 0 ? 1 : -1;

    player.x += player.vx * dt;
    player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));
    for (const platform of platforms) {
      if (platform.gone || !rectsOverlap(player, platform)) continue;
      if (player.vx > 0) player.x = platform.x - player.w;
      if (player.vx < 0) player.x = platform.x + platform.w;
    }

    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    player.y += player.vy * dt;
    player.onGround = false;

    for (const platform of platforms) {
      if (platform.gone || !rectsOverlap(player, platform)) continue;
      if (player.vy > 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 2;
        if (platform.crumble && platform.crumbleTimer === null) {
          platform.crumbleTimer = 0.34;
          spawnDust(player.x + player.w / 2, platform.y, 8, "#ffd166");
          shake(4);
        }
      } else if (player.vy < 0) {
        player.y = platform.y + platform.h;
        player.vy = 0;
      }
    }

    if (player.y > VIEW_H + 160) {
      kill("掉下去之前，地面已经下班了。");
    }
  }

  function updatePlatforms(dt) {
    for (const platform of platforms) {
      if (platform.gone || platform.crumbleTimer === null) continue;
      platform.crumbleTimer -= dt;
      if (platform.crumbleTimer <= 0) {
        platform.gone = true;
        spawnDust(platform.x + platform.w / 2, platform.y, 16, "#ffd166");
        shake(8);
      }
    }
  }

  function updateTraps(dt) {
    for (const trap of trapDefs) {
      if (triggered.has(trap.id)) continue;
      if (rectsOverlap(player, trap.rect)) {
        triggered.add(trap.id);
        trap.action();
      }
    }

    if (fakeSave.armed) {
      fakeSave.x += fakeSave.vx * dt;
      fakeSave.vx *= Math.pow(0.92, dt * 60);
      fakeSave.x = Math.min(fakeSave.x, 1765);
    }

    if (!state.hasKey && key.teased) {
      key.x += key.vx * dt;
      key.vx *= Math.pow(0.96, dt * 60);
      key.x = Math.min(key.x, 3024);
    }
  }

  function updateHazards(dt) {
    for (const hazard of hazards) {
      hazard.age += dt;
      if (hazard.kind === "falling") {
        hazard.vy += 1720 * dt;
        hazard.y += hazard.vy * dt;
        if (hazard.y > 512) {
          hazard.y = 512;
          hazard.vy = 0;
        }
      }
    }

    for (const projectile of projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.vy += 120 * dt;
      projectile.spin += dt * 10;
    }

    projectiles = projectiles.filter(
      (projectile) =>
        projectile.x > cameraX - 180 &&
        projectile.x < cameraX + VIEW_W + 180 &&
        projectile.y < VIEW_H + 160,
    );
  }

  function updateCheckpointsAndItems() {
    checkpoints.forEach((checkpoint, index) => {
      if (index <= state.checkpointIndex) return;
      const flagBox = { x: checkpoint.x - 12, y: checkpoint.y - 42, w: 34, h: 70 };
      if (rectsOverlap(player, flagBox)) {
        state.checkpointIndex = index;
        state.spawn = { x: checkpoint.x, y: checkpoint.y };
        say(index === 1 ? "这个存档点是真的，这次。" : "存档。暂时。", 2.1);
        spawnDust(checkpoint.x, checkpoint.y, 14, "#42d9a3");
        playTone("save");
      }
    });

    if (!state.hasKey && rectsOverlap(player, insetRect(key, 2, 2))) {
      state.hasKey = true;
      say("钥匙到手。门开始紧张。", 2);
      spawnDust(key.x + key.w / 2, key.y + key.h / 2, 18, "#ffd166");
      playTone("key");
    }

    if (rectsOverlap(player, fakeSave)) {
      kill("假的存档点比真的更热情。");
    }

    if (rectsOverlap(player, goal)) {
      if (!state.hasKey) {
        say("门很礼貌地拒绝了你。", 1.7);
        player.x = goal.x - player.w - 2;
      } else if (!state.goalFakeDone) {
        state.goalFakeDone = true;
        goal.x += 126;
        addFallingSpike(player.x + 20, -120, 48, 96, "终点也会假动作");
        say("恭喜，终点往后退了一步。", 2.3);
        shake(11);
      } else {
        win();
      }
    }
  }

  function checkHazardCollision() {
    for (const spike of staticSpikes) {
      if (rectsOverlap(player, insetRect(spike, 5, 5))) {
        kill("尖刺的职业素养很稳定。");
        return;
      }
    }

    for (const hazard of hazards) {
      if (rectsOverlap(player, insetRect(hazard, 5, 5))) {
        kill(hazard.reason || "这不是装饰。");
        return;
      }
    }

    for (const projectile of projectiles) {
      if (rectsOverlap(player, insetRect(projectile, 4, 4))) {
        kill(projectile.reason || "奖励自己飞过来了。");
        return;
      }
    }
  }

  function kill(reason) {
    if (state.deathTimer > 0 || state.won) return;
    state.deaths += 1;
    state.deathTimer = 0.52;
    state.pendingDeath = reason;
    spawnDust(player.x + player.w / 2, player.y + player.h / 2, 22, "#ff4f57");
    shake(13);
    playTone("death");
  }

  function win() {
    state.won = true;
    state.message = "通关。现在可以怀疑每一块地板了。";
    state.messageTimer = 999;
    spawnDust(player.x + player.w / 2, player.y + player.h / 2, 38, "#9be15d");
    playTone("win");
  }

  function spawnDust(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: -Math.random() * 150 - 20,
        size: Math.random() * 4 + 2,
        ttl: Math.random() * 0.35 + 0.24,
        color,
      });
    }
  }

  function updateParticles(dt) {
    for (const particle of particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 420 * dt;
      particle.ttl -= dt;
    }
    particles = particles.filter((particle) => particle.ttl > 0);
  }

  function updateCamera(dt) {
    const target = Math.max(0, Math.min(WORLD_W - VIEW_W, player.x - VIEW_W * 0.42));
    cameraX += (target - cameraX) * Math.min(1, dt * 8);
  }

  function updateStatus() {
    const keyText = state.hasKey ? "钥匙已拿" : "钥匙未拿";
    const reverseText = state.time < state.reverseUntil ? " | 左右互换" : "";
    statusEl.textContent = `死亡 ${state.deaths} | 存档 ${state.checkpointIndex + 1}/4 | ${keyText}${reverseText}`;
  }

  function update(dt) {
    if (!state.started) {
      updateCamera(dt);
      updateStatus();
      return;
    }

    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 28);
    if (state.messageTimer > 0) state.messageTimer -= dt;

    if (state.deathTimer > 0) {
      state.deathTimer -= dt;
      updateParticles(dt);
      if (state.deathTimer <= 0) respawn(state.pendingDeath);
      updateCamera(dt);
      updateStatus();
      return;
    }

    if (!state.won) {
      handleJump();
      moveAndCollide(dt);
      updatePlatforms(dt);
      updateTraps(dt);
      updateHazards(dt);
      updateCheckpointsAndItems();
      checkHazardCollision();
    }

    updateParticles(dt);
    updateCamera(dt);
    updateStatus();
  }

  function draw() {
    const wobbleX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const wobbleY = state.shake ? (Math.random() - 0.5) * state.shake : 0;

    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.translate(Math.round(-cameraX + wobbleX), Math.round(wobbleY));

    drawBackground();
    drawSigns();
    drawCheckpoints();

    for (const platform of platforms) {
      if (!platform.gone) drawPlatform(platform);
    }

    for (const spike of staticSpikes) drawSpike(spike);
    for (const hazard of hazards) drawHazard(hazard);
    for (const projectile of projectiles) drawProjectile(projectile);

    drawFakeSave();
    if (!state.hasKey) drawKey();
    drawGoal();
    drawPlayer();
    drawParticles();

    ctx.restore();
    drawOverlay();
  }

  function drawBackground() {
    ctx.fillStyle = "#151817";
    ctx.fillRect(cameraX - 80, 0, VIEW_W + 160, VIEW_H);

    ctx.fillStyle = "#1e241f";
    for (let x = Math.floor((cameraX - 160) / 96) * 96; x < cameraX + VIEW_W + 160; x += 96) {
      ctx.fillRect(x, 0, 2, VIEW_H);
    }
    for (let y = 60; y < VIEW_H; y += 64) {
      ctx.fillRect(cameraX - 80, y, VIEW_W + 160, 2);
    }

    ctx.fillStyle = "#20291f";
    for (let x = -120; x < WORLD_W + 160; x += 260) {
      ctx.fillRect(x, 376, 120, 124);
      ctx.fillRect(x + 38, 328, 46, 54);
    }

    ctx.fillStyle = "#101211";
    ctx.fillRect(cameraX - 80, 512, VIEW_W + 160, 40);
  }

  function drawPlatform(platform) {
    const crack = platform.crumbleTimer !== null ? Math.sin(state.time * 70) * 2 : 0;
    ctx.fillStyle = platform.crumble ? "#5b4b2e" : "#2f3a32";
    ctx.fillRect(platform.x + crack, platform.y, platform.w, platform.h);
    ctx.fillStyle = platform.crumble ? "#ffd166" : "#9be15d";
    ctx.fillRect(platform.x + crack, platform.y, platform.w, 4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    for (let x = platform.x + 12; x < platform.x + platform.w - 8; x += 32) {
      ctx.fillRect(x + crack, platform.y + 8, 14, 2);
    }
  }

  function drawSpike(spike) {
    ctx.save();
    ctx.fillStyle = "#ff4f57";
    ctx.strokeStyle = "#ffb0b4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (spike.dir === "down") {
      ctx.moveTo(spike.x, spike.y);
      ctx.lineTo(spike.x + spike.w, spike.y);
      ctx.lineTo(spike.x + spike.w / 2, spike.y + spike.h);
    } else {
      ctx.moveTo(spike.x, spike.y + spike.h);
      ctx.lineTo(spike.x + spike.w, spike.y + spike.h);
      ctx.lineTo(spike.x + spike.w / 2, spike.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHazard(hazard) {
    if (hazard.kind === "spike") {
      const rise = Math.min(1, hazard.age * 10);
      const spike = {
        ...hazard,
        y: hazard.dir === "down" ? hazard.y : hazard.y + hazard.h * (1 - rise),
        h: hazard.h * rise,
      };
      drawSpike(spike);
      return;
    }

    ctx.fillStyle = "#ff4f57";
    ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
    ctx.fillStyle = "#ffe2df";
    ctx.fillRect(hazard.x + 6, hazard.y + 8, hazard.w - 12, 4);
  }

  function drawProjectile(projectile) {
    ctx.save();
    ctx.translate(projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
    ctx.rotate(projectile.spin);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = "#ff4f57";
    ctx.fillRect(-3, -14, 6, 28);
    ctx.fillRect(-14, -3, 28, 6);
    ctx.restore();
  }

  function drawPlayer() {
    if (state.deathTimer > 0 && Math.floor(state.deathTimer * 24) % 2 === 0) return;
    ctx.fillStyle = "#f4f3ea";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = "#42d9a3";
    ctx.fillRect(player.x + (player.face > 0 ? 14 : 5), player.y + 8, 5, 5);
    ctx.fillStyle = "#111";
    ctx.fillRect(player.x + 5, player.y + 21, 14, 3);
  }

  function drawCheckpoints() {
    checkpoints.forEach((checkpoint, index) => {
      const active = index <= state.checkpointIndex;
      ctx.fillStyle = active ? "#42d9a3" : "#536056";
      ctx.fillRect(checkpoint.x, checkpoint.y - 42, 4, 42);
      ctx.fillStyle = active ? "#9be15d" : "#313a32";
      ctx.fillRect(checkpoint.x + 4, checkpoint.y - 42, 34, 18);
      if (index === 0) return;
      ctx.fillStyle = active ? "#101211" : "#aab2a5";
      ctx.font = "700 9px sans-serif";
      ctx.fillText("SAVE", checkpoint.x + 8, checkpoint.y - 29);
    });
  }

  function drawFakeSave() {
    ctx.fillStyle = "#ff4f57";
    ctx.fillRect(fakeSave.x, fakeSave.y - 28, 4, 42);
    ctx.fillStyle = "#5c262b";
    ctx.fillRect(fakeSave.x + 4, fakeSave.y - 28, 38, 18);
    ctx.fillStyle = "#ffd8d8";
    ctx.font = "700 9px sans-serif";
    ctx.fillText("SAVE?", fakeSave.x + 7, fakeSave.y - 15);
  }

  function drawKey() {
    ctx.save();
    const bounce = Math.sin(state.time * 5) * 4;
    ctx.translate(key.x + key.w / 2, key.y + key.h / 2 + bounce);
    ctx.fillStyle = "#ffd166";
    ctx.strokeStyle = "#fff1b7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-5, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(1, -2, 18, 4);
    ctx.fillRect(13, 2, 4, 7);
    ctx.fillRect(19, 2, 4, 5);
    ctx.restore();
  }

  function drawGoal() {
    ctx.fillStyle = state.hasKey ? "#42d9a3" : "#4d554d";
    ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
    ctx.fillStyle = "#111";
    ctx.fillRect(goal.x + 11, goal.y + 12, goal.w - 22, goal.h - 12);
    ctx.fillStyle = state.hasKey ? "#9be15d" : "#aab2a5";
    ctx.fillRect(goal.x + goal.w - 12, goal.y + 25, 5, 5);
  }

  function drawSigns() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const sign of signs) {
      ctx.fillStyle = "#57452d";
      ctx.fillRect(sign.x + 32, sign.y + 24, 6, 54);
      ctx.fillStyle = "#272d25";
      ctx.fillRect(sign.x, sign.y, 108, 34);
      ctx.strokeStyle = "#6f7a68";
      ctx.strokeRect(sign.x, sign.y, 108, 34);
      ctx.fillStyle = "#f4f3ea";
      ctx.font = "700 13px sans-serif";
      ctx.fillText(sign.text, sign.x + 54, sign.y + 17, 96);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.ttl * 3));
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawOverlay() {
    const isReverse = state.time < state.reverseUntil;
    if (isReverse) {
      ctx.fillStyle = "rgba(255, 79, 87, 0.12)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (state.messageTimer > 0 && state.message) {
      ctx.fillStyle = "rgba(16, 18, 17, 0.82)";
      ctx.fillRect(250, 22, 460, 46);
      ctx.strokeStyle = isReverse ? "#ff4f57" : "#42d9a3";
      ctx.strokeRect(250.5, 22.5, 459, 45);
      ctx.fillStyle = "#f4f3ea";
      ctx.textAlign = "center";
      ctx.font = "700 18px sans-serif";
      ctx.fillText(state.message, VIEW_W / 2, 52, 430);
      ctx.textAlign = "start";
    }

    if (!state.started) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#f4f3ea";
      ctx.textAlign = "center";
      ctx.font = "900 40px sans-serif";
      ctx.fillText("反向安全屋", VIEW_W / 2, 238);
      ctx.font = "700 18px sans-serif";
      ctx.fillStyle = "#9be15d";
      ctx.fillText("按任意键开始", VIEW_W / 2, 286);
      ctx.fillStyle = "#aab2a5";
      ctx.font = "600 14px sans-serif";
      ctx.fillText("不要相信看起来太正常的东西", VIEW_W / 2, 320);
      ctx.textAlign = "start";
    }

    if (state.won) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#9be15d";
      ctx.textAlign = "center";
      ctx.font = "900 38px sans-serif";
      ctx.fillText("通关", VIEW_W / 2, 238);
      ctx.fillStyle = "#f4f3ea";
      ctx.font = "700 18px sans-serif";
      ctx.fillText(`死亡 ${state.deaths} 次`, VIEW_W / 2, 282);
      ctx.fillStyle = "#aab2a5";
      ctx.font = "600 14px sans-serif";
      ctx.fillText("按 Enter 重新开始", VIEW_W / 2, 318);
      ctx.textAlign = "start";
    }
  }

  function frame(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    const dt = Math.min(0.033, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", (event) => {
    if (!state.started) {
      state.started = true;
      say("安全第一，信任最后。", 2);
    }

    if (state.won && event.code === "Enter") {
      hardReset();
      return;
    }

    if (event.code === "KeyR") {
      kill("主动重开也是一种预判。");
      return;
    }

    if (jumpCodes.has(event.code) && !pressed.has(event.code)) {
      queueJump();
      event.preventDefault();
    }
    pressed.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    pressed.delete(event.code);
  });

  window.addEventListener("blur", () => {
    pressed.clear();
  });

  document.querySelectorAll("[data-code]").forEach((button) => {
    const code = button.getAttribute("data-code");
    const hold = (event) => {
      event.preventDefault();
      if (!state.started) state.started = true;
      button.classList.add("is-held");
      if (jumpCodes.has(code)) queueJump();
      pressed.add(code);
    };
    const release = (event) => {
      event.preventDefault();
      button.classList.remove("is-held");
      pressed.delete(code);
    };
    button.addEventListener("pointerdown", hold);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  muteButton.addEventListener("click", () => {
    state.muted = !state.muted;
    muteButton.classList.toggle("is-muted", state.muted);
  });

  resetTransientWorld();
  resetPlayer();
  requestAnimationFrame(frame);
})();
