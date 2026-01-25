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
 * 캔버스 리사이즈 & 중앙 정렬
 *************************/
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/*************************
 * 상태
 *************************/
let currentItem = null;
let eraseMode = false;
let openedCategory = null;
let hoverIso = null;

// "x,y" → { img, w, h }
const mapData = {};

/*************************
 * 아이템 정의
 *************************/
const ITEMS = {
  tile: [
    { id: "road_WDL", type: "tile", w: 64, h: 32 },
    { id: "road_WL", type: "tile", w: 64, h: 32 },
    { id: "road_YL", type: "tile", w: 64, h: 32 },
    { id: "road-sidewalk", type: "tile", w: 64, h: 32 },
    { id: "bush", type: "tile", w: 64, h: 32 },
    { id: "road_WDL_curved", type: "tile", w: 64, h: 32 },
    { id: "road_WL_curved", type: "tile", w: 64, h: 32 },
    { id: "road_YL_curved", type: "tile", w: 64, h: 32 },
    { id: "road-bush", type: "tile", w: 64, h: 32 },
    { id: "road-sidewalk_curved", type: "tile", w: 64, h: 32 },
    { id: "road-sidewalk_edge", type: "tile", w: 64, h: 32 },
    { id: "road-bush_curved", type: "tile", w: 64, h: 32 },
    { id: "road-bush_edge", type: "tile", w: 64, h: 32 }
  ],
  housing: [
    { id: "house", type: "building", w: 64, h: 64 },
    { id: "apartment", type: "building", w: 64, h: 128 }
  ],
  commercial: [],
  public: [],
  industry: [],
  etc: []
};

/*************************
 * 좌표 변환 (아이소메트릭)
 *************************/
function getIsoOrigin() {
  const gridPixelHeight = (MAP_W + MAP_H) * (TILE_H / 2);
  return {
    x: UI_WIDTH + (canvas.width - UI_WIDTH) / 2,
    y: (canvas.height - gridPixelHeight) / 2
  };
}

function isoToScreen(x, y) {
  const o = getIsoOrigin();
  return {
    x: o.x + (x - y) * (TILE_W / 2),
    y: o.y + (x + y) * (TILE_H / 2)
  };
}

function screenToIso(px, py) {
  const o = getIsoOrigin();
  px -= o.x;
  py -= o.y;

  const x = Math.floor((px / (TILE_W / 2) + py / (TILE_H / 2)) / 2);
  const y = Math.floor((py / (TILE_H / 2) - px / (TILE_W / 2)) / 2);
  return { x, y };
}

/*************************
 * 렌더링
 *************************/
function drawGrid() {
  ctx.strokeStyle = "#ddd";

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const p = isoToScreen(x, y);

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
      ctx.lineTo(p.x, p.y + TILE_H);
      ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawTiles() {
  const sorted = Object.entries(mapData)
    .map(([key, tile]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, tile };
    })
    .sort((a, b) => (a.x + a.y) - (b.x + b.y)); // ⭐ 핵심

  sorted.forEach(({ x, y, tile }) => {
    const p = isoToScreen(x, y);

    ctx.drawImage(
      tile.img,
      p.x - tile.w / 2,
      p.y + TILE_H - tile.h,
      tile.w,
      tile.h
    );
  });
}

function drawPreview() {
  if (!hoverIso) return;

  const { x, y } = hoverIso;
  const key = `${x},${y}`;
  const p = isoToScreen(x, y);
  const occupied = !!mapData[key];

  // 지우개
  if (eraseMode) {
    if (!occupied) return;

    ctx.fillStyle = "rgba(255,0,0,0.35)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (!currentItem) return;

  ctx.fillStyle = occupied
    ? "rgba(255,0,0,0.35)"
    : "rgba(0,200,0,0.30)";

  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
  ctx.lineTo(p.x, p.y + TILE_H);
  ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
  ctx.closePath();
  ctx.fill();

  if (!occupied) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(
      currentItem.img,
      p.x - currentItem.w / 2,
      p.y + TILE_H - currentItem.h,
      currentItem.w,
      currentItem.h
    );
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawTiles();
  drawPreview();
  requestAnimationFrame(render);
}
render();

/*************************
 * 마우스 인터랙션
 *************************/
canvas.addEventListener("mousemove", e => {
  const iso = screenToIso(e.offsetX, e.offsetY);
  if (iso.x < 0 || iso.y < 0 || iso.x >= MAP_W || iso.y >= MAP_H) {
    hoverIso = null;
    return;
  }
  hoverIso = iso;
});

canvas.addEventListener("click", e => {
  if (!hoverIso) return;
  const { x, y } = hoverIso;
  const key = `${x},${y}`;

  if (eraseMode) {
    delete mapData[key];
    return;
  }

  if (!currentItem || mapData[key]) return;

  mapData[key] = {
    img: currentItem.img,
    w: currentItem.w,
    h: currentItem.h
  };
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

  document.querySelectorAll(".subcategory")
    .forEach(el => el.style.display = "none");

  const target = document.getElementById(cat);
  if (!target) return;

  target.style.display = "grid";
  openedCategory = cat;
};

window.selectItem = function (cat, idx, el) {
  eraseMode = false;
  const item = ITEMS[cat][idx];

  if (!item.img) {
    const img = new Image();
    img.src =
      item.type === "tile"
        ? `assets/tiles/${item.id}.png`
        : `assets/buildings/${item.id}.png`;
    item.img = img;
  }

  currentItem = item;

  document.querySelectorAll(".subcategory img")
    .forEach(i => i.classList.remove("selected"));
  el.classList.add("selected");
};

window.selectEraser = function () {
  eraseMode = true;
  currentItem = null;
  document.querySelectorAll(".subcategory img")
    .forEach(i => i.classList.remove("selected"));
};

/*************************
 * 저장 / 불러오기 / 캡쳐
 *************************/
window.saveCity = function () {
  const name = prompt("도시 이름을 입력하세요");
  if (!name) return;

  if (localStorage.getItem("city_" + name)) {
    alert("이미 존재하는 도시 이름입니다.");
    return;
  }

  const data = {};
  Object.entries(mapData).forEach(([k, v]) => {
    data[k] = { src: v.img.src, w: v.w, h: v.h };
  });

  localStorage.setItem("city_" + name, JSON.stringify(data));
};

window.loadCity = function () {
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith("city_"))
    .map(k => k.replace("city_", ""));

  const name = prompt("불러올 도시 이름:\n" + keys.join("\n"));
  if (!name) return;

  const raw = localStorage.getItem("city_" + name);
  if (!raw) return;

  Object.keys(mapData).forEach(k => delete mapData[k]);

  const data = JSON.parse(raw);
  Object.entries(data).forEach(([k, v]) => {
    const img = new Image();
    img.src = v.src;
    mapData[k] = { img, w: v.w, h: v.h };
  });
};

window.captureCity = function () {
  const link = document.createElement("a");
  link.download = "city.png";
  link.href = canvas.toDataURL();
  link.click();
};