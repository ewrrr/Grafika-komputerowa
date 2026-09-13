const PEG_COUNT = 3;
const START_PEG = 0;
const GOAL_PEG = 2;
const DISK_HEIGHT = 0.42;
const DISK_GAP = 0.02;
const INNER_RADIUS = 0.2;
const PEG_RADIUS = 0.14;
const LIFT_CLEARANCE = 1.15;

const DISK_COLORS = [0xb42318, 0xd97706, 0xeab308, 0x16a34a, 0x2563eb, 0x7c3aed];

const canvas = document.getElementById("glcanvas");
const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle");
const resetBtn = document.getElementById("reset");
const disksSelect = document.getElementById("disks");
const speedInput = document.getElementById("speed");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefe8dc);
scene.fog = new THREE.Fog(0xefe8dc, 22, 42);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);

const keyLight = new THREE.DirectionalLight(0xfff6ea, 0.95);
keyLight.position.set(-7, 14, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -12;
keyLight.shadow.camera.right = 12;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);
scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb7aa96, 0.55));
scene.add(new THREE.AmbientLight(0xfff4e5, 0.22));

const woodMaterial = new THREE.MeshPhongMaterial({
  color: 0x8b5a2b,
  specular: 0x333333,
  shininess: 18
});
const pegMaterial = new THREE.MeshPhongMaterial({
  color: 0xc4a574,
  specular: 0x555555,
  shininess: 28
});

let diskCount = Number(disksSelect.value);
let speed = Number(speedInput.value);
let pegs = [[], [], []];
let pegX = [-5.2, 0, 5.2];
let pegHeight = 3;
let moves = [];
let moveIndex = 0;
let anim = null;
let paused = false;
let finished = false;
let orbitYaw = 0.42;
let orbitPitch = 0.38;
let dragging = false;
let previousX = 0;
let previousY = 0;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sizeRenderer() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function updateCamera() {
  const radius = 16.5;
  const pitch = THREE.Math.clamp(orbitPitch, 0.18, 1.15);
  camera.position.set(
    Math.sin(orbitYaw) * Math.cos(pitch) * radius,
    Math.sin(pitch) * radius + 1.4,
    Math.cos(orbitYaw) * Math.cos(pitch) * radius
  );
  camera.lookAt(0, 1.15, 0);
}

function makeLabelTexture(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "#3a2f24";
  ctx.font = "bold 170px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 140);
  const texture = new THREE.CanvasTexture(c);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function diskGeometry(outerRadius) {
  const half = DISK_HEIGHT / 2;
  const points = [
    new THREE.Vector2(INNER_RADIUS, -half),
    new THREE.Vector2(outerRadius, -half),
    new THREE.Vector2(outerRadius + 0.03, -half + 0.05),
    new THREE.Vector2(outerRadius + 0.03, half - 0.05),
    new THREE.Vector2(outerRadius, half),
    new THREE.Vector2(INNER_RADIUS, half)
  ];
  return new THREE.LatheGeometry(points, 64);
}

function diskY(stackIndex) {
  return DISK_HEIGHT / 2 + stackIndex * (DISK_HEIGHT + DISK_GAP);
}

function liftHeight() {
  return pegHeight + LIFT_CLEARANCE;
}

function largestRadius() {
  return 0.62 + (diskCount - 1) * 0.32;
}

function clearWorld() {
  while (world.children.length) {
    const child = world.children[0];
    world.remove(child);
    child.traverse(function (obj) {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (obj.material.map) {
          obj.material.map.dispose();
        }
        obj.material.dispose();
      }
    });
  }
}

function buildBoard() {
  const maxR = largestRadius();
  pegX = [-maxR * 2.35, 0, maxR * 2.35];
  pegHeight = diskCount * (DISK_HEIGHT + DISK_GAP) + 1.15;

  const baseWidth = pegX[2] - pegX[0] + maxR * 2.6;
  const base = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, 0.42, 6.2), woodMaterial);
  base.position.y = -0.21;
  base.castShadow = true;
  base.receiveShadow = true;
  world.add(base);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshPhongMaterial({ color: 0xe7dccb, specular: 0x111111, shininess: 4 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.42;
  floor.receiveShadow = true;
  world.add(floor);

  for (let i = 0; i < PEG_COUNT; i++) {
    const peg = new THREE.Mesh(
      new THREE.CylinderGeometry(PEG_RADIUS * 0.86, PEG_RADIUS, pegHeight, 28),
      pegMaterial
    );
    peg.position.set(pegX[i], pegHeight / 2, 0);
    peg.castShadow = true;
    peg.receiveShadow = true;
    world.add(peg);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(PEG_RADIUS * 0.92, 20, 14), pegMaterial);
    cap.position.set(pegX[i], pegHeight, 0);
    cap.castShadow = true;
    world.add(cap);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture(String(i)), transparent: true })
    );
    label.position.set(pegX[i], 0.08, 3.05);
    world.add(label);
  }
}

function buildDisks() {
  pegs = [[], [], []];
  const maxR = largestRadius();

  for (let size = diskCount; size >= 1; size--) {
    const outer = maxR - (diskCount - size) * 0.32;
    const material = new THREE.MeshPhongMaterial({
      color: DISK_COLORS[size - 1],
      specular: 0x666666,
      shininess: 42
    });
    const disk = new THREE.Mesh(diskGeometry(outer), material);
    disk.userData.size = size;
    disk.castShadow = true;
    disk.receiveShadow = true;
    const stackIndex = diskCount - size;
    disk.position.set(pegX[START_PEG], diskY(stackIndex), 0);
    world.add(disk);
    pegs[START_PEG].push(disk);
  }
}

function solveHanoi(n, from, to, aux, list) {
  if (n === 0) {
    return;
  }
  solveHanoi(n - 1, from, aux, to, list);
  list.push({ from: from, to: to });
  solveHanoi(n - 1, aux, to, from, list);
}

function updateStatus() {
  const total = moves.length;
  if (finished) {
    statusEl.textContent = "Gotowe: wszystkie krążki są na paliku 2.";
    return;
  }
  if (anim) {
    const move = moves[moveIndex];
    statusEl.textContent =
      "Ruch " + (moveIndex + 1) + " / " + total + ": palik " + move.from + " → palik " + move.to;
    return;
  }
  statusEl.textContent = "Start z palika 0. Liczba ruchów: " + total + ".";
}

function beginMove() {
  if (moveIndex >= moves.length) {
    anim = null;
    finished = true;
    toggleBtn.textContent = "Start";
    updateStatus();
    return;
  }

  const move = moves[moveIndex];
  const source = pegs[move.from];
  const disk = source.pop();
  const targetHeight = diskY(pegs[move.to].length);
  const top = liftHeight();

  anim = {
    disk: disk,
    to: move.to,
    t: 0,
    duration: 1.35,
    fromX: pegX[move.from],
    toX: pegX[move.to],
    fromY: disk.position.y,
    toY: targetHeight,
    liftY: top
  };
  updateStatus();
}

function samplePath(state, u) {
  const lift = 0.32;
  const travel = 0.36;
  if (u < lift) {
    const t = easeInOutCubic(u / lift);
    return { x: state.fromX, y: lerp(state.fromY, state.liftY, t) };
  }
  if (u < lift + travel) {
    const t = easeInOutCubic((u - lift) / travel);
    return { x: lerp(state.fromX, state.toX, t), y: state.liftY };
  }
  const t = easeInOutCubic((u - lift - travel) / (1 - lift - travel));
  return { x: state.toX, y: lerp(state.liftY, state.toY, t) };
}

function finishMove() {
  const disk = anim.disk;
  disk.position.set(anim.toX, anim.toY, 0);
  pegs[anim.to].push(disk);
  anim = null;
  moveIndex += 1;
  beginMove();
}

function resetPuzzle() {
  diskCount = Number(disksSelect.value);
  paused = false;
  finished = false;
  moveIndex = 0;
  anim = null;
  toggleBtn.textContent = "Pauza";
  clearWorld();
  buildBoard();
  buildDisks();
  moves = [];
  solveHanoi(diskCount, START_PEG, GOAL_PEG, 1, moves);
  beginMove();
}

function sizeAndFrame() {
  sizeRenderer();
  updateCamera();
}

toggleBtn.addEventListener("click", function () {
  if (finished) {
    resetPuzzle();
    return;
  }
  paused = !paused;
  toggleBtn.textContent = paused ? "Start" : "Pauza";
});

resetBtn.addEventListener("click", resetPuzzle);
disksSelect.addEventListener("change", resetPuzzle);
speedInput.addEventListener("input", function () {
  speed = Number(speedInput.value);
});

window.addEventListener("resize", sizeAndFrame);

window.addEventListener("mouseup", function () {
  dragging = false;
});

window.addEventListener("mousemove", function (event) {
  if (!dragging) {
    return;
  }
  orbitYaw -= (event.clientX - previousX) * 0.007;
  orbitPitch += (event.clientY - previousY) * 0.005;
  previousX = event.clientX;
  previousY = event.clientY;
  updateCamera();
});

canvas.addEventListener("mousedown", function (event) {
  dragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
});

window.addEventListener("keydown", function (event) {
  if (event.code === "Space") {
    event.preventDefault();
    toggleBtn.click();
  }
});

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (!paused && !finished && anim) {
    anim.t += dt * speed;
    const u = Math.min(anim.t / anim.duration, 1);
    const point = samplePath(anim, u);
    anim.disk.position.set(point.x, point.y, 0);
    if (u >= 1) {
      finishMove();
    }
  }

  renderer.render(scene, camera);
}

sizeAndFrame();
resetPuzzle();
animate();
