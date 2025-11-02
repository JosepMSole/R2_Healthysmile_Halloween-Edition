let video;
let facemesh;
let predictions = [];

let ps;

let mouthOpenSeconds = 0;
let totalOpenSeconds = 0;
let lastMillis = 0;

let startBtn, threshSlider, threshSpan, openTimeSpan, resetBtn, volSlider, bgmToggleBtn;
let readyModel = false;
let readyVideo = false;
let running = false;

// àudios
let brushSound = null;
let bgmSound = null;
let exitSound = null;
let newIconSound = null;

// joc
const MAX_BATS = 3;     // PROVA (després 24)
let nextRewardAt = 5;
let goalReached = false;

// música
let bgmEnabled = true;

function setup() {
  createCanvas(1280, 720);
  createUI();

  // vídeo
  video = createCapture(
    { video: { width: 1280, height: 720 } },
    () => {
      readyVideo = true;
      maybeHideLoading();
    }
  );
  video.size(1280, 720);
  video.hide();

  // facemesh
  facemesh = ml5.facemesh(video, modelLoaded);
  facemesh.on("predict", (results) => {
    predictions = results;
  });

  // partícules
  ps = new ParticleSystem(500);

  // àudios DOM
  brushSound = document.getElementById("brush");
  bgmSound = document.getElementById("bgm");
  exitSound = document.getElementById("exit");
  newIconSound = document.getElementById("newicon");

  if (brushSound) {
    brushSound.loop = true;
    brushSound.volume = 0.5;
  }
  if (bgmSound) {
    bgmSound.volume = 0.5;
  }
  if (newIconSound) {
    newIconSound.volume = 0.8;
  }
}

function modelLoaded() {
  readyModel = true;
  maybeHideLoading();
  console.log("FaceMesh carregat!");
}

function createUI() {
  const loading = createDiv(`
    <div id="loading">
      <div class="skull"></div>
      <img src="LOGO APP - v1.png" alt="logo"
        style="width:520px;margin-top:6px;filter:drop-shadow(0 0 25px #ff7b00aa);" />
      <p>Carregant una maledicció bucal...</p>
    </div>
  `);
  loading.id("loading-wrapper");

  // UI caixa
  const ui = createDiv("");
  ui.id("ui");
  ui.html(`
    <img id="logo" src="LOGO APP - v1.png" alt="Logo app" />
    <div class="panel">
      <p class="tip">Prem "Començar" i obre la boca 👄🎃</p>
      <button id="startBtn">Començar</button>
      <label>Llindar boca (MAR)
        <input id="thresh" type="range" min="0.15" max="0.45" step="0.01" value="0.28" />
        <span id="threshVal">0.28</span>
      </label>
      <label>Volum so
        <input id="volume" type="range" min="0" max="1" step="0.01" value="0.5" />
      </label>
      <button id="bgmToggle" class="on">Música: ON</button>
      <p style="margin-top:6px;font-size:13px;">Temps boca oberta: <b id="openTime">0.0s</b></p>
      <div id="batBar" class="bat-bar"></div>
      <p class="small-hint" id="batHint">Objectiu: 3 🦇 (acumulat)</p>
      <p class="goal-done" id="batDone" style="display:none;">
        🎉 Enhorabona! Has aconseguit rentar-te les dents correctament durant dos minuts!
      </p>
    </div>
    <!-- missatge nou sota la caixa -->
    <p id="marHelp" style="margin-top:8px;font-size:12px;opacity:0.75;max-width:320px;">
      Ajusta el MAR per adaptar-lo a la teva boca.
    </p>
    <p id="marHelp" style="margin-top:8px;font-size:12px;opacity:0.75;max-width:320px;">
      NOTA: Aquesta versió BETA té una duració de 15 segons. La final será de 2min. (Temps recomanat per dentistes)
    </p>
    <button id="resetBtn" title="Reiniciar joc">🔄 Reiniciar</button>
  `);

  startBtn = select("#startBtn");
  threshSlider = select("#thresh");
  threshSpan = select("#threshVal");
  openTimeSpan = select("#openTime");
  resetBtn = select("#resetBtn");
  volSlider = select("#volume");
  bgmToggleBtn = select("#bgmToggle");

  startBtn.mousePressed(() => {
    running = true;
    startBtn.attribute("disabled", "true");
    startBtn.html("En marxa!");

    // música de fons
    if (bgmSound && bgmEnabled) {
      bgmSound.currentTime = 0;
      bgmSound.play().catch(() => {});
    }

    // desbloqueig del raspall
    if (brushSound) {
      brushSound.play().then(() => brushSound.pause()).catch(() => {});
    }
  });

  threshSlider.input(() => {
    threshSpan.html(Number(threshSlider.value()).toFixed(2));
  });

  volSlider.input(() => {
    const v = Number(volSlider.value());
    if (brushSound) brushSound.volume = v;
    if (bgmSound) bgmSound.volume = v;
  });

  bgmToggleBtn.mousePressed(() => {
    bgmEnabled = !bgmEnabled;
    if (bgmEnabled) {
      bgmToggleBtn.html("Música: ON");
      bgmToggleBtn.addClass("on");
      if (bgmSound) bgmSound.play().catch(() => {});
    } else {
      bgmToggleBtn.html("Música: OFF");
      bgmToggleBtn.removeClass("on");
      if (bgmSound) bgmSound.pause();
    }
  });

  resetBtn.mousePressed(() => {
    resetGame();
  });
}

function maybeHideLoading() {
  if (readyModel && readyVideo) {
    setTimeout(() => {
      const ld = document.getElementById("loading");
      if (ld) ld.classList.add("hide");
    }, 800);
  }
}

function draw() {
  background(15, 9, 28);

  // vídeo espill
  if (video) {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();
  }

  const now = millis();
  const dt = lastMillis ? (now - lastMillis) / 1000 : 0;
  lastMillis = now;

  let marVal = 0;
  let mouthCenter = createVector(width / 2, height / 2);
  let mouthIsOpen = false;

  if (running && predictions.length > 0) {
    const face = predictions[0];
    const kps = face.scaledMesh || [];
    if (kps.length > 291) {
      const p13 = toCanvasPoint(kps[13]);
      const p14 = toCanvasPoint(kps[14]);
      const p61 = toCanvasPoint(kps[61]);
      const p291 = toCanvasPoint(kps[291]);

      const dy = dist(p13.x, p13.y, p14.x, p14.y);
      const dx = dist(p61.x, p61.y, p291.x, p291.y);
      marVal = dx > 0 ? dy / dx : 0;

      mouthCenter.set((p13.x + p14.x) / 2, (p13.y + p14.y) / 2);

      const thresh = Number(threshSlider.value());
      mouthIsOpen = marVal > thresh;
    }
  }

  if (!goalReached) {
    if (mouthIsOpen) {
      mouthOpenSeconds += dt;
      totalOpenSeconds += dt;

      const mirroredX = width - mouthCenter.x + 10;
      const emitX = mirroredX;
      const emitY = mouthCenter.y + random(-4, 4);

      const extra = constrain(
        int((marVal - Number(threshSlider.value())) * 45),
        0,
        10
      );
      ps.emit(emitX, emitY, 5 + extra);

      if (brushSound && brushSound.paused) {
        brushSound.currentTime = 0;
        brushSound.play().catch(() => {});
      }

      // premis acumulatius
      const currentBats = getBatCount();
      if (currentBats < MAX_BATS && totalOpenSeconds >= nextRewardAt) {
        const isLast = currentBats + 1 >= MAX_BATS;
        addBatReward(isLast);
        nextRewardAt += 5;

        if (isLast) {
          goalReached = true;
          showGoalDone(true);
          if (brushSound) {
            brushSound.pause();
            brushSound.currentTime = 0;
          }
          if (exitSound) {
            exitSound.currentTime = 0;
            exitSound.play().catch(() => {});
          }
        }
      }

      stroke(255, 120, 40, 180);
      strokeWeight(3);
      const lineY1 = mouthCenter.y + 14;
      const lineY2 = mouthCenter.y + 32;
      line(mirroredX - 25, lineY1, mirroredX + 25, lineY1);
      line(mirroredX - 15, lineY2, mirroredX + 15, lineY2);

    } else {
      if (brushSound && !brushSound.paused) {
        brushSound.pause();
        brushSound.currentTime = 0;
      }
      mouthOpenSeconds = 0;
    }

  } else {
    if (brushSound && !brushSound.paused) {
      brushSound.pause();
      brushSound.currentTime = 0;
    }
  }

  // partícules
  ps.update();
  ps.draw();

  // HUD
  fill(255);
  noStroke();
  textSize(16);
  text(`MAR: ${marVal.toFixed(2)}`, 20, height - 20);

  if (openTimeSpan) openTimeSpan.html(totalOpenSeconds.toFixed(1) + "s");
}

function toCanvasPoint(pt) {
  const x = pt[0] * (width / video.width);
  const y = pt[1] * (height / video.height);
  return createVector(x, y);
}

function addBatReward(isLast = false) {
  const bar = document.getElementById("batBar");
  if (!bar) return;
  const span = document.createElement("span");
  span.className = isLast ? "bat-icon bat-icon-gold" : "bat-icon";
  span.textContent = "🦇";
  bar.appendChild(span);

  if (newIconSound) {
    newIconSound.currentTime = 0;
    newIconSound.play().catch(() => {});
  }
}

function clearBatRewards() {
  const bar = document.getElementById("batBar");
  if (!bar) return;
  bar.innerHTML = "";
}

function getBatCount() {
  const bar = document.getElementById("batBar");
  if (!bar) return 0;
  return bar.children.length;
}

function showGoalDone(show) {
  const el = document.getElementById("batDone");
  if (!el) return;
  el.style.display = show ? "block" : "none";
}

function resetGame() {
  goalReached = false;
  mouthOpenSeconds = 0;
  totalOpenSeconds = 0;
  nextRewardAt = 5;
  clearBatRewards();
  showGoalDone(false);

  running = false;
  startBtn.removeAttribute("disabled");
  startBtn.html("Començar");

  if (brushSound) {
    brushSound.pause();
    brushSound.currentTime = 0;
  }

  if (bgmSound) {
    if (bgmEnabled) {
      bgmSound.currentTime = 0;
      bgmSound.play().catch(() => {});
    } else {
      bgmSound.pause();
    }
  }

  console.log("Joc reiniciat.");
}
