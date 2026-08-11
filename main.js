/*************************
 * 캔버스 & 기본 설정
 *************************/
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const UI_WIDTH = 220;
const TILE_W = 64;
const TILE_H = 32;
const MAP_W = 20;
const MAP_H = 20;

/*************************
 * 카메라 상태
 *************************/
const camera = { x: 0, y: 0, zoom: 1, minZoom: 0.3, maxZoom: 3 };
const drag = { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 };

/*************************
 * 캔버스 리사이즈
 *************************/
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/*************************
 * 상태
 *************************/
let currentItem = null;
let eraseMode   = false;
let openedCategory = null;
let hoverIso    = null;
let currentVariant = 0;
let currentCityName = null; // 타이틀에서 불러온 맵 이름 (null이면 새 게임)

const mapData = {};

/*************************
 * 이미지 캐시
 *************************/
const imgCache = {};
function loadImg(src) {
  if (!imgCache[src]) {
    const img = new Image();
    img.src = src;
    imgCache[src] = img;
  }
  return imgCache[src];
}

/*************************
 * 아이템 정의
 *
 * variantPrefix: 파일명 앞부분 (없으면 id 사용)
 * maxVariants: 탐색할 최대 번호 (기본 4)
 * variants: 런타임에 자동으로 채워짐 (존재하는 파일만)
 * variantTiles: nxm 건물용 — variant 인덱스별 tilesX/Y (순환)
 *************************/
const ITEMS = {
  tile: [
    // one-way-paths (번호 없는 단일 파일)
    { id: "bush",      folder: "one-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road",      folder: "one-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "sidewalk",  folder: "one-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    // two-way-paths
    { id: "road_WDL",  folder: "two-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road_WL",   folder: "two-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road_YL",   folder: "two-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    // four-way-paths
    { id: "road_WDL_edge",           folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road_WL_edge",            folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road_YL_edge",            folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road-bush_innerEdge",     folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road-bush_outerEdge",     folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road-bush",               folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road-sidewalk_innerEdge", folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road-sidewalk_outerEdge", folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
    { id: "road-sidewalk",           folder: "four-way-paths", type: "tile", w: 64, h: 32, tilesX: 1, tilesY: 1 },
  ],
  housing: [
    { id: "house",     folder: "buildings", type: "building", w: 64,  h: 64,  tilesX: 1, tilesY: 1 },
    { id: "apartment", folder: "buildings", type: "building", w: 64,  h: 128, tilesX: 1, tilesY: 1 },
    { id: "villa",     folder: "buildings", type: "building", w: 64,  h: 115,  tilesX: 1, tilesY: 1 },
  ],
  commercial: [
    { id: "commercial-building",     folder: "buildings", type: "building", w: 128,  h: 192,  tilesX: 2, tilesY: 2 },
  ],
  public: [
    { id: "bank", folder: "buildings", type: "building", w: 96, h: 80,
      // variant 인덱스별 tilesX/Y (90도씩 회전: 홀수=1×2, 짝수=2×1)
      variantTiles: [
        { tilesX: 1, tilesY: 2 },
        { tilesX: 2, tilesY: 1 },
        { tilesX: 1, tilesY: 2 },
        { tilesX: 2, tilesY: 1 },
      ],
      tilesX: 1, tilesY: 2 },
  ],
  industry: [],
  etc: [],
};

/*************************
 * variant 자동 감지
 *
 * one-way-paths처럼 번호가 없는 파일 → variants: ["id"]
 * 번호가 있는 파일 (_01, _02, ...) → 존재하는 번호만 variants에 등록
 * 최대 탐색 번호: maxVariants (기본 8)
 *************************/
const MAX_VARIANTS = 8;

function detectVariants(item) {
  return new Promise(resolve => {
    // 번호 없는 단일 파일 먼저 시도
    const singleSrc = `assets/${item.folder}/${item.id}.png`;
    const singleImg = new Image();
    singleImg.onload = () => resolve([item.id]);
    singleImg.onerror = () => {
      // 번호 있는 파일 탐색 (_01, _02, ...)
      const found = [];
      let pending = MAX_VARIANTS;
      for (let i = 1; i <= MAX_VARIANTS; i++) {
        const fname = `${item.id}_${String(i).padStart(2, "0")}`;
        const src   = `assets/${item.folder}/${fname}.png`;
        const img   = new Image();
        const idx   = i;
        img.onload = () => {
          found[idx - 1] = fname;
          if (--pending === 0) resolve(found.filter(Boolean));
        };
        img.onerror = () => {
          if (--pending === 0) resolve(found.filter(Boolean));
        };
        img.src = src;
      }
    };
    singleImg.src = singleSrc;
  });
}

// 모든 아이템의 variants를 비동기로 감지 후 게임 시작
async function initVariants() {
  const allItems = Object.values(ITEMS).flat();
  await Promise.all(allItems.map(async item => {
    item.variants = await detectVariants(item);
    // 감지된 variants가 없으면 fallback으로 id 자체 사용
    if (!item.variants || item.variants.length === 0) item.variants = [item.id];
  }));
}

// 현재 아이템의 현재 variant 이미지 src
function getItemSrc(item, variantIdx) {
  const fname = item.variants[variantIdx] || item.variants[0];
  return `assets/${item.folder}/${fname}.png`;
}

// 현재 아이템의 현재 variant 이미지 객체
function getCurrentImg() {
  if (!currentItem) return null;
  const src = getItemSrc(currentItem, currentVariant);
  return loadImg(src);
}

// 현재 variant의 tilesX, tilesY 반환
function getCurrentTiles() {
  if (!currentItem) return { tilesX: 1, tilesY: 1 };
  if (currentItem.variantTiles) {
    const vt = currentItem.variantTiles[currentVariant % currentItem.variantTiles.length];
    return { tilesX: vt.tilesX, tilesY: vt.tilesY };
  }
  return { tilesX: currentItem.tilesX || 1, tilesY: currentItem.tilesY || 1 };
}

/*************************
 * 좌표 변환 (아이소메트릭)
 *************************/
function getIsoOrigin() {
  const gridPixelHeight = (MAP_W + MAP_H) * (TILE_H / 2);
  return {
    x: UI_WIDTH + (canvas.width - UI_WIDTH) / 2 + camera.x,
    y: (canvas.height - gridPixelHeight) / 2 + camera.y,
  };
}

function isoToScreen(x, y) {
  const o = getIsoOrigin();
  return {
    x: o.x + (x - y) * (TILE_W / 2) * camera.zoom,
    y: o.y + (x + y) * (TILE_H / 2) * camera.zoom,
  };
}

function screenToIso(px, py) {
  const o = getIsoOrigin();
  const rx = (px - o.x) / camera.zoom;
  const ry = (py - o.y) / camera.zoom;
  return {
    x: Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2),
    y: Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2),
  };
}

/*************************
 * 다중 타일 유틸
 *************************/
function getOccupiedCells(x, y, tilesX, tilesY) {
  const cells = [];
  for (let dy = 0; dy < tilesY; dy++)
    for (let dx = 0; dx < tilesX; dx++)
      cells.push({ x: x + dx, y: y + dy });
  return cells;
}

function getAnchor(x, y, tilesX, tilesY) {
  const tileH = TILE_H * camera.zoom;
  const midScreen  = isoToScreen(x + (tilesX - 1) / 2, y + (tilesY - 1) / 2);
  const bottomCell = isoToScreen(x + tilesX - 1, y + tilesY - 1);
  return { sx: midScreen.x, sy: bottomCell.y + tileH };
}

/*************************
 * 드로우 헬퍼
 *************************/
function drawImg(img, sx, sy, w, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx - w / 2, sy - h, w, h);
  ctx.restore();
}

function fillDiamond(x, y, color) {
  const p  = isoToScreen(x, y);
  const hw = (TILE_W / 2) * camera.zoom;
  const hh = (TILE_H / 2) * camera.zoom;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + hw, p.y + hh);
  ctx.lineTo(p.x, p.y + hh * 2);
  ctx.lineTo(p.x - hw, p.y + hh);
  ctx.closePath();
  ctx.fill();
}

/*************************
 * 토스트 알림
 *************************/
let toastMsg = "";
let toastAlpha = 0;
let toastTimer = null;

function showToast(msg) {
  toastMsg   = msg;
  toastAlpha = 1;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    const fade = setInterval(() => {
      toastAlpha -= 0.05;
      if (toastAlpha <= 0) { toastAlpha = 0; clearInterval(fade); }
    }, 30);
  }, 1200);
}

function drawToast() {
  if (toastAlpha <= 0) return;
  ctx.save();
  ctx.font = "bold 14px sans-serif";
  const tw = ctx.measureText(toastMsg).width;
  const bw = tw + 40, bh = 44;
  const bx = (canvas.width - bw) / 2;
  const by = canvas.height / 2 - bh / 2;
  ctx.globalAlpha = toastAlpha * 0.82;
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.globalAlpha = toastAlpha;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(toastMsg, canvas.width / 2, by + bh / 2);
  ctx.restore();
}

/*************************
 * 줌 표시 / 힌트
 *************************/
function drawZoomIndicator() {
  const pct = Math.round(camera.zoom * 100);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`🔍 ${pct}%`, canvas.width - 12, canvas.height - 12);
  ctx.restore();
}

let showHint = false; // 캔버스 힌트 제거

function drawHint() {} // 사이드바로 이동됨

/*************************
 * 편집 모드
 * "move"   → 좌클릭 드래그로 카메라 이동
 * "build"  → 타일 선택 후 클릭 배치 (제작 모드)
 * "select" → 셀 클릭 후 패널에서 배치/삭제/방향 변경
 *************************/
let editMode = "build";
let selectedCell = null;

window.setEditMode = function (mode) {
  editMode     = mode;
  hoverIso     = null;
  eraseMode    = false;
  selectedCell = null;
  drag.active  = false;
  drag.moved   = false;
  canvas.style.cursor = "default";

  document.getElementById("btn-mode-move").classList.toggle("mode-active",   mode === "move");
  document.getElementById("btn-mode-build").classList.toggle("mode-active",  mode === "build");
  document.getElementById("btn-mode-select").classList.toggle("mode-active", mode === "select");

  const panel = document.getElementById("select-panel");
  if (panel) panel.style.display = "none";

  updateEraseBtnState();
};

function updateEraseBtnState() {
  const btn = document.querySelector(".eraser-btn:not(.eraser-clear-btn)");
  if (!btn) return;
  btn.disabled = (editMode !== "build");
  btn.style.opacity = (editMode !== "build") ? "0.4" : "1";
}

/*************************
 * variant 표시 배지
 *************************/
function drawVariantBadge() {
  if (!currentItem || currentItem.variants.length <= 1) return;
  const total = currentItem.variants.length;
  const txt   = `V ${currentVariant + 1}/${total}`;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(txt, canvas.width - 12, canvas.height - 30);
  ctx.restore();
}

/*************************
 * 렌더링
 *************************/
function drawGrid() {
  ctx.strokeStyle = "#ddd";
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const p  = isoToScreen(x, y);
      const hw = (TILE_W / 2) * camera.zoom;
      const hh = (TILE_H / 2) * camera.zoom;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + hw, p.y + hh);
      ctx.lineTo(p.x, p.y + hh * 2);
      ctx.lineTo(p.x - hw, p.y + hh);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawTiles() {
  const sorted = Object.entries(mapData)
    .filter(([, t]) => t.origin)
    .map(([key, tile]) => {
      const [x, y] = key.split(",").map(Number);
      // 다중 타일은 점유 셀 중 최대 (x+y)를 정렬 기준으로 사용
      const sortKey = (x + tile.tilesX - 1) + (y + tile.tilesY - 1);
      return { x, y, tile, sortKey };
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  sorted.forEach(({ x, y, tile }) => {
    const tw = tile.w * camera.zoom;
    const th = tile.h * camera.zoom;
    const a  = getAnchor(x, y, tile.tilesX, tile.tilesY);
    drawImg(tile.img, a.sx, a.sy, tw, th);
  });
}

function drawPreview() {
  if (!hoverIso) return;
  const { x, y } = hoverIso;

  if (eraseMode) {
    const key  = `${x},${y}`;
    const cell = mapData[key];
    if (!cell) return;
    const originKey = cell.origin ? key : cell.originKey;
    const origin    = mapData[originKey];
    if (origin) {
      const [ox, oy] = originKey.split(",").map(Number);
      getOccupiedCells(ox, oy, origin.tilesX, origin.tilesY)
        .forEach(c => fillDiamond(c.x, c.y, "rgba(255,0,0,0.35)"));
    }
    return;
  }

  if (!currentItem) return;

  const { tilesX, tilesY } = getCurrentTiles();
  const ox     = x - (tilesX - 1);
  const oy     = y - (tilesY - 1);
  const cells  = getOccupiedCells(ox, oy, tilesX, tilesY);

  const blocked = cells.some(c =>
    c.x < 0 || c.y < 0 || c.x >= MAP_W || c.y >= MAP_H || !!mapData[`${c.x},${c.y}`]
  );

  cells.forEach(c => fillDiamond(c.x, c.y, blocked ? "rgba(255,0,0,0.35)" : "rgba(0,200,0,0.30)"));

  if (!blocked) {
    const img = getCurrentImg();
    if (img) {
      const tw = currentItem.w * camera.zoom;
      const th = currentItem.h * camera.zoom;
      const a  = getAnchor(ox, oy, tilesX, tilesY);
      drawImg(img, a.sx, a.sy, tw, th, 0.7);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawTiles();
  drawPreview();
  drawZoomIndicator();
  drawVariantBadge();
  drawHint();
  drawToast();
  requestAnimationFrame(render);
}

/*************************
 * 카메라 — 드래그 (우클릭 항상 / 좌클릭은 moveMode일 때)
 *************************/
canvas.addEventListener("mousedown", e => {
  const isMoveBtn = e.button === 2 || (e.button === 0 && editMode === "move");
  if (!isMoveBtn) return;
  drag.active    = true;
  drag.startX    = e.clientX;
  drag.startY    = e.clientY;
  drag.camStartX = camera.x;
  drag.camStartY = camera.y;
  drag.moved     = false;
  canvas.style.cursor = "grabbing";
});
window.addEventListener("mousemove", e => {
  if (drag.active) {
    camera.x = drag.camStartX + (e.clientX - drag.startX);
    camera.y = drag.camStartY + (e.clientY - drag.startY);
    drag.moved = true;
  }
});
window.addEventListener("mouseup", e => {
  if (!drag.active) return;
  if (e.button === 2 || (e.button === 0 && editMode === "move")) {
    drag.active = false;
    canvas.style.cursor = "default";
  }
});
canvas.addEventListener("contextmenu", e => e.preventDefault());

/*************************
 * 카메라 — 휠 줌
 *************************/
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const factor  = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, camera.zoom * factor));
  if (newZoom === camera.zoom) return;
  const mx = e.offsetX, my = e.offsetY;
  const o  = getIsoOrigin();
  const ratio = newZoom / camera.zoom;
  camera.x += (mx - o.x) * (1 - ratio);
  camera.y += (my - o.y) * (1 - ratio);
  camera.zoom = newZoom;
}, { passive: false });

/*************************
 * 키보드
 *************************/
function resetCamera() {
  camera.x = 0; camera.y = 0; camera.zoom = 1;
}

window.addEventListener("keydown", e => {
  if (e.key === "Home") resetCamera();
  if (e.key === "+" || e.key === "=") camera.zoom = Math.min(camera.maxZoom, camera.zoom * 1.15);
  if (e.key === "-") camera.zoom = Math.max(camera.minZoom, camera.zoom * 0.87);
  if (e.key === "v" || e.key === "V") cycleVariant();
});

/*************************
 * 호버
 *************************/
canvas.addEventListener("mousemove", e => {
  if (drag.active || editMode === "move") { hoverIso = null; return; }
  const iso = screenToIso(e.offsetX, e.offsetY);
  hoverIso = (iso.x < 0 || iso.y < 0 || iso.x >= MAP_W || iso.y >= MAP_H) ? null : iso;
});
canvas.addEventListener("mouseleave", () => { hoverIso = null; });

/*************************
 * 클릭 핸들러 — 모드별 동작
 *************************/
canvas.addEventListener("click", e => {
  if (editMode === "move" || drag.moved) return;
  const { x, y } = hoverIso;
  const key = `${x},${y}`;

  /* ── 제작 모드 ── */
  if (editMode === "build") {
    if (eraseMode) {
      const cell = mapData[key];
      if (!cell) return;
      const originKey = cell.origin ? key : cell.originKey;
      const origin    = mapData[originKey];
      if (origin) {
        const [ox, oy] = originKey.split(",").map(Number);
        getOccupiedCells(ox, oy, origin.tilesX, origin.tilesY)
          .forEach(c => delete mapData[`${c.x},${c.y}`]);
      }
      return;
    }
    if (!currentItem) return;
    const { tilesX, tilesY } = getCurrentTiles();
    const ox        = x - (tilesX - 1);
    const oy        = y - (tilesY - 1);
    const originKey = `${ox},${oy}`;
    const cells     = getOccupiedCells(ox, oy, tilesX, tilesY);
    const blocked   = cells.some(c =>
      c.x < 0 || c.y < 0 || c.x >= MAP_W || c.y >= MAP_H || !!mapData[`${c.x},${c.y}`]
    );
    if (blocked) return;
    const img = getCurrentImg();
    cells.forEach(c => {
      const isOrigin = (c.x === ox && c.y === oy);
      mapData[`${c.x},${c.y}`] = isOrigin
        ? { img, w: currentItem.w, h: currentItem.h, tilesX, tilesY, origin: true,
            variantSrc: getItemSrc(currentItem, currentVariant) }
        : { origin: false, originKey };
    });
    return;
  }

  /* ── 선택 모드 ── */
  if (editMode === "select") {
    const panel = document.getElementById("select-panel");
    const cell  = mapData[key];

    if (cell) {
      // 오브젝트가 있는 셀 클릭 → 삭제/방향 패널
      const originKey = cell.origin ? key : cell.originKey;
      selectedCell = originKey;
      showSelectPanel(originKey, false);
    } else {
      // 빈 셀 클릭 → 타일 배치 패널
      selectedCell = key;
      showSelectPanel(key, true);
    }
    return;
  }
});

/*************************
 * UI 제어
 *************************/
window.toggleCategory = function (cat) {
  if (openedCategory === cat) {
    document.getElementById(cat).style.display = "none";
    openedCategory = null;
    return;
  }
  document.querySelectorAll(".subcategory").forEach(el => el.style.display = "none");
  const target = document.getElementById(cat);
  if (!target) return;
  target.style.display = "grid";
  openedCategory = cat;
};

window.selectItem = function (cat, idx, el) {
  eraseMode      = false;
  currentItem    = ITEMS[cat][idx];
  currentVariant = 0;
  updateVariantUI();

  document.querySelectorAll(".subcategory img").forEach(i => i.classList.remove("selected"));
  el.classList.add("selected");
};

// Variant 순환 (V키 또는 버튼)
window.cycleVariant = function () {
  if (!currentItem) return;
  const total = currentItem.variants.length;
  if (total <= 1) { showToast("이 타일은 variant가 없습니다."); return; }
  currentVariant = (currentVariant + 1) % total;
  updateVariantUI();
};

function updateVariantUI() {
  const btn = document.getElementById("btn-variant");
  if (!btn) return;
  const total = currentItem ? currentItem.variants.length : 0;
  btn.disabled = total <= 1;
  btn.textContent = total > 1 ? `🔄 variant (${currentVariant + 1}/${total})` : "🔄 variant";
}

window.selectEraser = function () {
  setEditMode("build"); // 반드시 build 모드로
  eraseMode   = true;
  currentItem = null;
  updateVariantUI();
  document.querySelectorAll(".subcategory img").forEach(i => i.classList.remove("selected"));
};

/*************************
 * 선택 모드 패널
 *************************/
function showSelectPanel(cellKey, isEmpty) {
  const panel = document.getElementById("select-panel");
  if (!panel) return;

  panel.innerHTML = "";
  panel.style.display = "flex";

  if (!isEmpty) {
    // 오브젝트가 있는 셀 — 삭제 버튼
    const delBtn = document.createElement("button");
    delBtn.className = "select-panel-btn select-panel-del";
    delBtn.textContent = "🗑 삭제";
    delBtn.onclick = () => {
      const origin = mapData[cellKey];
      if (origin) {
        const [ox, oy] = cellKey.split(",").map(Number);
        getOccupiedCells(ox, oy, origin.tilesX, origin.tilesY)
          .forEach(c => delete mapData[`${c.x},${c.y}`]);
      }
      panel.style.display = "none";
      selectedCell = null;
    };
    panel.appendChild(delBtn);
  } else {
    // 빈 셀 — 현재 선택된 타일 설치 버튼
    const label = document.createElement("div");
    label.className = "select-panel-label";
    label.textContent = currentItem ? `"${currentItem.id}" 설치` : "타일을 먼저 선택하세요";
    panel.appendChild(label);

    if (currentItem) {
      const placeBtn = document.createElement("button");
      placeBtn.className = "select-panel-btn select-panel-place";
      placeBtn.textContent = "✔ 설치";
      placeBtn.onclick = () => {
        const [x, y]        = cellKey.split(",").map(Number);
        const { tilesX, tilesY } = getCurrentTiles();
        const ox        = x - (tilesX - 1);
        const oy        = y - (tilesY - 1);
        const originKey = `${ox},${oy}`;
        const cells     = getOccupiedCells(ox, oy, tilesX, tilesY);
        const blocked   = cells.some(c =>
          c.x < 0 || c.y < 0 || c.x >= MAP_W || c.y >= MAP_H || !!mapData[`${c.x},${c.y}`]
        );
        if (blocked) { showToast("이미 오브젝트가 있습니다."); return; }
        const img = getCurrentImg();
        cells.forEach(c => {
          const isOrigin = (c.x === ox && c.y === oy);
          mapData[`${c.x},${c.y}`] = isOrigin
            ? { img, w: currentItem.w, h: currentItem.h, tilesX, tilesY, origin: true,
                variantSrc: getItemSrc(currentItem, currentVariant) }
            : { origin: false, originKey };
        });
        panel.style.display = "none";
        selectedCell = null;
      };
      panel.appendChild(placeBtn);
    }
  }
}

/*************************
 * 저장 / 불러오기 / 캡쳐
 *************************/
// 맵 데이터를 직렬화해서 반환
function serializeMap() {
  const data = {};
  Object.entries(mapData).forEach(([k, v]) => {
    if (v.origin) {
      data[k] = { src: v.variantSrc, w: v.w, h: v.h, tilesX: v.tilesX, tilesY: v.tilesY, origin: true };
    } else {
      data[k] = { origin: false, originKey: v.originKey };
    }
  });
  return data;
}

// 저장 시점 스냅샷 (변경 감지용)
let savedSnapshot = "{}";

function getCurrentSnapshot() {
  return JSON.stringify(serializeMap());
}

function hasUnsavedChanges() {
  return getCurrentSnapshot() !== savedSnapshot;
}

// 스냅샷 갱신 (저장 직후 또는 불러오기 직후 호출)
function syncSnapshot() {
  savedSnapshot = getCurrentSnapshot();
}

// 새로 저장하기
window.saveNewCity = function () {
  const name = prompt("도시 이름을 입력하세요");
  if (!name) return;
  if (localStorage.getItem("city_" + name)) {
    alert("이미 존재하는 이름입니다. 다른 이름을 입력해주세요.");
    return;
  }
  localStorage.setItem("city_" + name, JSON.stringify(serializeMap()));
  localStorage.setItem("city_time_" + name, Date.now().toString());
  currentCityName = name;
  syncSnapshot();
  updateBottomButtons();
  showToast(`"${name}" 저장 완료!`);
};

// 덮어쓰기 저장
window.overwriteCity = function () {
  if (!currentCityName) return;
  localStorage.setItem("city_" + currentCityName, JSON.stringify(serializeMap()));
  localStorage.setItem("city_time_" + currentCityName, Date.now().toString());
  syncSnapshot();
  showToast(`"${currentCityName}" 저장 완료!`);
};

// 전체 초기화
window.clearMap = function () {
  if (!confirm("맵을 초기화하겠습니까?\n배치한 모든 오브젝트가 삭제됩니다.")) return;
  Object.keys(mapData).forEach(k => delete mapData[k]);
};

window.captureCity = function () {
  const link = document.createElement("a");
  link.download = "city.png";
  link.href = canvas.toDataURL();
  link.click();
};

// 하단 버튼 상태 업데이트 (덮어쓰기 버튼 표시 여부)
function updateBottomButtons() {
  const btnOverwrite = document.getElementById("btn-overwrite");
  if (btnOverwrite) btnOverwrite.style.display = currentCityName ? "flex" : "none";
}

/*************************
 * 이름으로 도시 불러오기 (타이틀에서 호출)
 *************************/
window.loadCityByName = function (name) {
  const raw = localStorage.getItem("city_" + name);
  if (!raw) return;
  Object.keys(mapData).forEach(k => delete mapData[k]);
  const data = JSON.parse(raw);
  Object.entries(data).forEach(([k, v]) => {
    if (v.origin) {
      mapData[k] = { img: loadImg(v.src), w: v.w, h: v.h,
        tilesX: v.tilesX || 1, tilesY: v.tilesY || 1,
        origin: true, variantSrc: v.src };
    } else {
      mapData[k] = { origin: false, originKey: v.originKey };
    }
  });
  currentCityName = name;
  syncSnapshot();
  updateBottomButtons();
};

/*************************
 * 새로 시작하기 (타이틀에서 호출)
 *************************/
window.startNewMap = function () {
  Object.keys(mapData).forEach(k => delete mapData[k]);
  currentCityName = null;
  savedSnapshot = "{}";
  resetCamera();
  updateBottomButtons();
};

/*************************
 * 메인으로 돌아가기
 *************************/
window.goToTitle = function () {
  if (hasUnsavedChanges()) {
    if (!confirm("저장하지 않은 변경사항이 있습니다.\n저장하지 않고 타이틀로 돌아가겠습니까?")) return;
  }
  // 현재 편집 상태 초기화
  currentCityName = null;
  savedSnapshot = "{}";
  Object.keys(mapData).forEach(k => delete mapData[k]);
  resetCamera();
  updateBottomButtons();

  // 타이틀 화면 표시
  const ts = document.getElementById("title-screen");
  const savesList = document.getElementById("title-saves-list");
  if (savesList) savesList.classList.remove("open");
  if (typeof refreshTitleSaveLabel === "function") refreshTitleSaveLabel();
  if (typeof showTitleScreen === "function") {
    showTitleScreen();
  } else {
    ts.style.display = "flex";
    ts.classList.remove("hidden");
  }
};

// variant 감지 완료 후 렌더 시작
initVariants().then(() => render());