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
 * 터치 기기 감지 (모바일 안내문구 / 스타일 분기용)
 *************************/
if (("ontouchstart" in window) || navigator.maxTouchPoints > 0) {
  document.body.classList.add("is-touch");
}

/*************************
 * 모바일 사이드바 토글
 *************************/
window.toggleSidebar = function (force) {
  const ui  = document.getElementById("ui");
  const bg  = document.getElementById("ui-backdrop");
  if (!ui) return;
  const open = (typeof force === "boolean") ? force : !ui.classList.contains("open");
  ui.classList.toggle("open", open);
  if (bg) bg.classList.toggle("open", open);
  const btn = document.getElementById("ui-toggle-btn");
  if (btn) btn.textContent = open ? "✕" : "☰";
};

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
let continuousPlacement = true; // 연속 배치 on/off (꺼지면 배치 1회 후 선택 해제)
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
  touchStart   = null;
  touchIsDrag  = false;
  pinch        = null;
  canvas.style.cursor = "default";

  document.getElementById("btn-mode-move").classList.toggle("mode-active",   mode === "move");
  document.getElementById("btn-mode-build").classList.toggle("mode-active",  mode === "build");
  document.getElementById("btn-mode-select").classList.toggle("mode-active", mode === "select");

  const panel = document.getElementById("select-panel");
  if (panel) panel.style.display = "none";

  updateEraseBtnState();
};

function updateEraseBtnState() {
  const btn = document.getElementById("btn-mode-erase");
  if (!btn) return;
  btn.classList.toggle("mode-active", editMode === "build" && eraseMode);
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
  const entries = Object.entries(mapData)
    .filter(([, t]) => t.origin)
    .map(([key, tile]) => {
      const [x, y] = key.split(",").map(Number);
      return {
        x, y, tile,
        xMin: x, xMax: x + tile.tilesX - 1,
        yMin: y, yMax: y + tile.tilesY - 1
      };
    });

  // 두 오브젝트의 점유 범위를 통째로 비교: 한쪽이 두 축 모두에서
  // 확실히 뒤에 있을 때만 먼저 그림. 애매하면(대각선상 인접 등)
  // 먼 쪽 모서리 합, 그다음 가까운 쪽 모서리 합으로 순서를 정함.
  entries.sort((a, b) => {
    const aFar  = a.xMax + a.yMax, bNear = b.xMin + b.yMin;
    if (aFar <= bNear) return -1;
    const bFar  = b.xMax + b.yMax, aNear = a.xMin + a.yMin;
    if (bFar <= aNear) return 1;
    if (aFar !== bFar) return aFar - bFar;
    return aNear - bNear;
  });

  entries.forEach(({ x, y, tile }) => {
    const tw = tile.w * camera.zoom;
    const th = tile.h * camera.zoom;
    const a  = getAnchor(x, y, tile.tilesX, tile.tilesY);
    drawImg(tile.img, a.sx, a.sy, tw, th);
  });
}

/*************************
 * 선택 모드 전용 프리뷰
 * — 배치 기능 없음. 이미 놓인 오브젝트를 호버/선택했을 때만 빨간색으로 강조
 *************************/
function drawSelectPreview() {
  // 클릭으로 선택된 오브젝트 — 패널이 닫힐 때까지 계속 유지되는 빨강 프리뷰
  if (selectedCell && mapData[selectedCell]) {
    const origin = mapData[selectedCell];
    const [sx, sy] = selectedCell.split(",").map(Number);
    getOccupiedCells(sx, sy, origin.tilesX, origin.tilesY)
      .forEach(c => fillDiamond(c.x, c.y, "rgba(255,0,0,0.35)"));
  }

  if (!hoverIso) return;
  const { x, y } = hoverIso;
  const key  = `${x},${y}`;
  const cell = mapData[key];
  if (!cell) return; // 빈 칸은 선택 모드에서 아무 것도 표시하지 않음 (배치 불가)

  const originKey = cell.origin ? key : cell.originKey;
  const origin    = mapData[originKey];
  if (origin) {
    const [ox, oy] = originKey.split(",").map(Number);
    getOccupiedCells(ox, oy, origin.tilesX, origin.tilesY)
      .forEach(c => fillDiamond(c.x, c.y, "rgba(255,0,0,0.35)"));
  }
}

function drawPreview() {
  if (editMode === "select") { drawSelectPreview(); return; }

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
 * 터치 입력 (모바일)
 * — 손가락 하나: 짧게 떼면 탭(배치/선택), 움직이면 카메라 드래그
 * — 손가락 두 개: 핀치 줌 + 두 손가락 이동으로 카메라 팬
 *************************/
const TOUCH_DRAG_THRESHOLD = 10; // px, 이 이상 움직이면 탭이 아니라 드래그로 간주

let touchStart   = null;  // { x, y } 화면 좌표, 손가락 하나 시작 지점
let touchIsDrag  = false;
let pinch        = null;  // 두 손가락 핀치줌 상태

function touchIso(t) {
  const rect = canvas.getBoundingClientRect();
  const ox = t.clientX - rect.left;
  const oy = t.clientY - rect.top;
  const iso = screenToIso(ox, oy);
  return (iso.x < 0 || iso.y < 0 || iso.x >= MAP_W || iso.y >= MAP_H) ? null : iso;
}
function touchDist(t0, t1) { return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY); }
function touchMid(t0, t1)  { return { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 }; }

canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    touchStart   = { x: t.clientX, y: t.clientY };
    touchIsDrag  = false;
    pinch        = null;
    drag.camStartX = camera.x;
    drag.camStartY = camera.y;
    hoverIso = (editMode === "move") ? null : touchIso(t);
  } else if (e.touches.length === 2) {
    touchStart = null;
    touchIsDrag = false;
    hoverIso = null;
    const [t0, t1] = e.touches;
    pinch = {
      startDist:  touchDist(t0, t1),
      startZoom:  camera.zoom,
      mid:        touchMid(t0, t1)
    };
  }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  e.preventDefault();

  if (e.touches.length === 2 && pinch) {
    const [t0, t1] = e.touches;
    const dist    = touchDist(t0, t1);
    const mid     = touchMid(t0, t1);
    const newZoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, pinch.startZoom * (dist / pinch.startDist)));

    // 확대 중심 유지
    const rect = canvas.getBoundingClientRect();
    const mx = pinch.mid.x - rect.left;
    const my = pinch.mid.y - rect.top;
    const o  = getIsoOrigin();
    const ratio = newZoom / camera.zoom;
    camera.x += (mx - o.x) * (1 - ratio);
    camera.y += (my - o.y) * (1 - ratio);
    camera.zoom = newZoom;

    // 두 손가락 이동분만큼 추가로 팬
    camera.x += mid.x - pinch.mid.x;
    camera.y += mid.y - pinch.mid.y;
    pinch.mid = mid;
    return;
  }

  if (e.touches.length === 1 && touchStart) {
    const t  = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;

    if (!touchIsDrag && Math.hypot(dx, dy) > TOUCH_DRAG_THRESHOLD) {
      touchIsDrag = true;
      hoverIso = null;
    }

    if (touchIsDrag) {
      camera.x = drag.camStartX + dx;
      camera.y = drag.camStartY + dy;
    } else if (editMode !== "move") {
      hoverIso = touchIso(t);
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", e => {
  e.preventDefault();
  const wasPinch = !!pinch;
  if (e.touches.length < 2) pinch = null;

  if (e.touches.length === 1 && wasPinch) {
    // 핀치줌 중 손가락 하나를 뗀 경우 — 남은 손가락으로 드래그를 이어감 (탭 오인 방지)
    const t = e.touches[0];
    touchStart  = { x: t.clientX, y: t.clientY };
    touchIsDrag = true;
    drag.camStartX = camera.x;
    drag.camStartY = camera.y;
    hoverIso = null;
    return;
  }

  if (e.touches.length === 0) {
    if (touchStart && !touchIsDrag && editMode !== "move") {
      handleTap(hoverIso);
    }
    touchStart  = null;
    touchIsDrag = false;
    hoverIso    = null;
  }
}, { passive: false });

canvas.addEventListener("touchcancel", () => {
  touchStart  = null;
  touchIsDrag = false;
  pinch       = null;
  hoverIso    = null;
});

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
 * 탭/클릭 처리 — 모드별 동작 (마우스 클릭과 터치 탭이 공용으로 사용)
 *************************/
function handleTap(iso) {
  if (!iso) return;
  const { x, y } = iso;
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
    // 연속 배치가 꺼져 있으면 배치 후 선택을 초기화 (다시 골라야 함)
    if (!continuousPlacement) {
      currentItem    = null;
      currentVariant = 0;
      updateVariantUI();
      document.querySelectorAll(".subcategory img").forEach(i => i.classList.remove("selected"));
    }
    return;
  }

  /* ── 선택 모드 (배치 없음: 이미 놓인 오브젝트의 삭제/방향 전환만) ── */
  if (editMode === "select") {
    const cell = mapData[key];

    if (cell) {
      const originKey = cell.origin ? key : cell.originKey;
      selectedCell = originKey;
      showSelectPanel(originKey);
    } else {
      hideSelectPanel();
    }
    return;
  }
}

canvas.addEventListener("click", e => {
  if (editMode === "move") return;
  if (drag.moved) { drag.moved = false; return; } // 드래그 후 클릭 무시하고 초기화
  handleTap(hoverIso);
});

/*************************
 * 배치된 오브젝트가 어떤 ITEMS 정의/variant에 해당하는지 역으로 찾기
 * (mapData에는 이미지 src만 저장되므로, src로부터 역추적)
 *************************/
function findItemByVariantSrc(src) {
  const match = /^assets\/([^/]+)\/([^/]+)\.png$/.exec(src || "");
  if (!match) return null;
  const [, folder, filename] = match;
  for (const cat of Object.keys(ITEMS)) {
    for (let idx = 0; idx < ITEMS[cat].length; idx++) {
      const item = ITEMS[cat][idx];
      if (item.folder !== folder || !item.variants) continue;
      const variantIdx = item.variants.indexOf(filename);
      if (variantIdx !== -1) return { item, variantIdx };
    }
  }
  return null;
}

/*************************
 * 선택 모드: 이미 놓인 오브젝트의 방향(variant) 전환
 * 자리를 벗어나거나 다른 오브젝트와 겹치면 토스트를 띄우고 취소
 *************************/
function rotateObjectAt(originKey) {
  const origin = mapData[originKey];
  if (!origin) return false;

  const found = findItemByVariantSrc(origin.variantSrc);
  if (!found || !found.item.variants || found.item.variants.length <= 1) {
    showToast("이 오브젝트는 방향을 바꿀 수 없습니다.");
    return false;
  }

  const { item, variantIdx } = found;
  const total         = item.variants.length;
  const newVariantIdx  = (variantIdx + 1) % total;
  const newSrc         = `assets/${item.folder}/${item.variants[newVariantIdx]}.png`;

  let newTilesX = item.tilesX || 1, newTilesY = item.tilesY || 1;
  if (item.variantTiles) {
    const vt = item.variantTiles[newVariantIdx % item.variantTiles.length];
    newTilesX = vt.tilesX;
    newTilesY = vt.tilesY;
  }

  const [ox, oy] = originKey.split(",").map(Number);
  const oldCells  = getOccupiedCells(ox, oy, origin.tilesX, origin.tilesY);
  const newCells  = getOccupiedCells(ox, oy, newTilesX, newTilesY);
  const oldKeys   = new Set(oldCells.map(c => `${c.x},${c.y}`));

  const outOfBounds = newCells.some(c => c.x < 0 || c.y < 0 || c.x >= MAP_W || c.y >= MAP_H);
  const overlapping = !outOfBounds && newCells.some(c => {
    const k = `${c.x},${c.y}`;
    return !oldKeys.has(k) && !!mapData[k];
  });
  if (outOfBounds || overlapping) {
    showToast("방향을 바꿀 공간이 부족합니다.");
    return false;
  }

  oldCells.forEach(c => delete mapData[`${c.x},${c.y}`]);
  const img = loadImg(newSrc);
  newCells.forEach(c => {
    const isOrigin = (c.x === ox && c.y === oy);
    mapData[`${c.x},${c.y}`] = isOrigin
      ? { img, w: origin.w, h: origin.h, tilesX: newTilesX, tilesY: newTilesY, origin: true, variantSrc: newSrc }
      : { origin: false, originKey };
  });
  return true;
}

function hideSelectPanel() {
  const panel = document.getElementById("select-panel");
  if (panel) panel.style.display = "none";
  selectedCell = null;
}

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
  updateEraseBtnState();

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

// 연속 배치 on/off 토글
window.toggleContinuousPlacement = function () {
  continuousPlacement = !continuousPlacement;
  updateContinuousUI();
};

function updateContinuousUI() {
  const btn = document.getElementById("btn-continuous");
  if (!btn) return;
  btn.textContent = continuousPlacement ? "🔁 연속 배치: ON" : "🔁 연속 배치: OFF";
  btn.classList.toggle("continuous-off", !continuousPlacement);
}

window.selectEraser = function () {
  if (editMode !== "build") {
    setEditMode("build"); // 다른 모드에 있었다면 먼저 제작 모드로 전환
  }
  eraseMode = !eraseMode; // 이미 build + 지우개 상태였다면 토글로 꺼짐
  if (eraseMode) {
    currentItem = null;
    document.querySelectorAll(".subcategory img").forEach(i => i.classList.remove("selected"));
  }
  updateVariantUI();
  updateEraseBtnState();
};

/*************************
 * 선택 모드 패널 (배치 없음: 방향 전환 + 삭제만)
 *************************/
function showSelectPanel(cellKey) {
  const panel  = document.getElementById("select-panel");
  const origin = mapData[cellKey];
  if (!panel || !origin) return;

  panel.innerHTML = "";
  panel.style.display = "flex";

  const found     = findItemByVariantSrc(origin.variantSrc);
  const canRotate = !!(found && found.item.variants && found.item.variants.length > 1);

  const rotateBtn = document.createElement("button");
  rotateBtn.className = "select-panel-btn select-panel-rotate";
  rotateBtn.textContent = "🔄 방향 전환";
  rotateBtn.disabled = !canRotate;
  rotateBtn.onclick = () => {
    if (rotateObjectAt(cellKey)) showSelectPanel(cellKey); // 패널 새로고침
  };
  panel.appendChild(rotateBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "select-panel-btn select-panel-del";
  delBtn.textContent = "🗑 삭제";
  delBtn.onclick = () => {
    const [ox, oy] = cellKey.split(",").map(Number);
    getOccupiedCells(ox, oy, origin.tilesX, origin.tilesY)
      .forEach(c => delete mapData[`${c.x},${c.y}`]);
    hideSelectPanel();
  };
  panel.appendChild(delBtn);
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
  if (name === null) return; // 취소
  const trimmed = name.trim();
  if (trimmed === "") {
    showToast("도시 이름을 입력해주세요.");
    return;
  }
  if (localStorage.getItem("city_" + trimmed)) {
    alert("이미 존재하는 이름입니다. 다른 이름을 입력해주세요.");
    return;
  }
  localStorage.setItem("city_" + trimmed, JSON.stringify(serializeMap()));
  localStorage.setItem("city_time_" + trimmed, Date.now().toString());
  currentCityName = trimmed;
  syncSnapshot();
  updateBottomButtons();
  showToast(`"${trimmed}" 저장 완료!`);
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
  resetCamera();
  setEditMode("build");
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
  setEditMode("build");
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
  setEditMode("build");
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
updateContinuousUI();