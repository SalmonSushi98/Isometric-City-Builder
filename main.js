/***********************
 * 기본 설정
 ***********************/
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const TILE_W = 64;
const TILE_H = 32;
const MAP_W = 20;
const MAP_H = 20;

/* 🔹 맵 중심을 화면 중앙에 맞춤 */
const MAP_CENTER_X = (MAP_W - 1) / 2;
const MAP_CENTER_Y = (MAP_H - 1) / 2;

const CENTER = isoToScreenRaw(MAP_CENTER_X, MAP_CENTER_Y);
const ORIGIN_X = canvas.width / 2 - CENTER.x + TILE_W / 2;
const ORIGIN_Y = canvas.height / 2 - CENTER.y + 50;

/***********************
 * 상태
 ***********************/
let selectedItem = null;
let selectedType = null;
let selectedUI = null;

const map = Array.from({ length: MAP_H }, () =>
  Array.from({ length: MAP_W }, () => null)
);

let hoverTile = null;

/***********************
 * 에셋 (파일명 고정)
 ***********************/
const TILE_ASSETS = {
  road_WDL: "assets/tiles/road_WDL.png",
  road_WL: "assets/tiles/road_WL.png",
  road_YL: "assets/tiles/road_YL.png",
  sidewalk: "assets/tiles/road-sidewalk.png",
  bush: "assets/tiles/bush.png",
  road_WDL_curved: "assets/tiles/road_WDL_curved.png",
  road_WL_curved: "assets/tiles/road_WL_curved.png",
  road_YL_curved: "assets/tiles/road_YL_curved.png",
  road_bush: "assets/tiles/road-bush.png",
  road_sidewalk_curved: "assets/tiles/road-sidewalk_curved.png",
  road_sidewalk_edge: "assets/tiles/road-sidewalk_edge.png",
  road_bush_curved: "assets/tiles/road-bush_curved.png",
  road_bush_edge: "assets/tiles/road-bush_edge.png",
};

const BUILDING_ASSETS = {
  house: { src: "assets/buildings/house.png", w: 64, h: 64 },
  apartment: { src: "assets/buildings/apartment.png", w: 64, h: 128 }
};

const images = {};
[...Object.values(TILE_ASSETS),
 ...Object.values(BUILDING_ASSETS).map(b => b.src)
].forEach(src => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  images[src] = img;
});

/***********************
 * 좌표 변환
 ***********************/
function isoToScreenRaw(x, y) {
  return {
    x: (x - y) * TILE_W / 2,
    y: (x + y) * TILE_H / 2
  };
}

function isoToScreen(x, y) {
  const p = isoToScreenRaw(x, y);
  return {
    x: p.x + ORIGIN_X,
    y: p.y + ORIGIN_Y
  };
}

function screenToIso(mx, my) {
  mx -= ORIGIN_X;
  my -= ORIGIN_Y;

  return {
    x: Math.floor((mx / (TILE_W / 2) + my / (TILE_H / 2)) / 2),
    y: Math.floor((my / (TILE_H / 2) - mx / (TILE_W / 2)) / 2)
  };
}

function inMap(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

/***********************
 * 렌더링
 ***********************/
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

function drawMap() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const cell = map[y][x];
      if (!cell) continue;

      const p = isoToScreen(x, y);
      const img = images[cell.src];

      if (cell.type === "tile") {
        ctx.drawImage(img, p.x - TILE_W / 2, p.y, TILE_W, TILE_H);
      } else {
        ctx.drawImage(
          img,
          p.x - cell.w / 2,
          p.y - cell.h + TILE_H,
          cell.w,
          cell.h
        );
      }
    }
  }
}

function drawPreview() {
  if (!hoverTile || !inMap(hoverTile.x, hoverTile.y)) return;

  const { x, y } = hoverTile;
  const p = isoToScreen(x, y);
  const occupied = map[y][x] !== null;

  ctx.fillStyle =
    selectedType === "eraser"
      ? "rgba(255,0,0,0.35)"
      : occupied
      ? "rgba(255,0,0,0.35)"
      : "rgba(0,255,0,0.35)";

  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
  ctx.lineTo(p.x, p.y + TILE_H);
  ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
  ctx.closePath();
  ctx.fill();

  if (occupied || selectedType === "eraser" || !selectedItem) return;

  const img = images[selectedItem.src];
  ctx.globalAlpha = 0.7;

  if (selectedType === "tile") {
    ctx.drawImage(img, p.x - TILE_W / 2, p.y, TILE_W, TILE_H);
  } else {
    ctx.drawImage(
      img,
      p.x - selectedItem.w / 2,
      p.y - selectedItem.h + TILE_H,
      selectedItem.w,
      selectedItem.h
    );
  }

  ctx.globalAlpha = 1;
}

/***********************
 * 루프
 ***********************/
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawMap();
  drawPreview();
  requestAnimationFrame(render);
}
render();

/***********************
 * 마우스
 ***********************/
canvas.addEventListener("mousemove", e => {
  hoverTile = screenToIso(e.offsetX, e.offsetY);
});

canvas.addEventListener("click", () => {
  if (!hoverTile || !inMap(hoverTile.x, hoverTile.y)) return;

  const { x, y } = hoverTile;

  if (selectedType === "eraser") {
    map[y][x] = null;
    return;
  }

  if (!selectedItem || map[y][x]) return;
  map[y][x] = { ...selectedItem, type: selectedType };
});

/***********************
 * UI 선택
 ***********************/
function setUISelected(el) {
  if (selectedUI) selectedUI.classList.remove("selected-item");
  selectedUI = el;
  if (el) el.classList.add("selected-item");
}

window.selectTile = (key, el) => {
  selectedType = "tile";
  selectedItem = { src: TILE_ASSETS[key] };
  setUISelected(el);
};

window.selectBuilding = (key, el) => {
  selectedType = "building";
  selectedItem = BUILDING_ASSETS[key];
  setUISelected(el);
};

window.selectEraser = () => {
  selectedType = "eraser";
  selectedItem = null;
  if (selectedUI) selectedUI.classList.remove("selected-item");
  selectedUI = null;
};

/***********************
 * 카테고리 토글
 ***********************/
window.toggleCategory = function (id) {
  document.querySelectorAll(".subcategory").forEach(el => {
    el.style.display =
      el.id === id && el.style.display !== "grid" ? "grid" : "none";
  });
};

/***********************
 * 저장 / 불러오기 / 캡쳐
 ***********************/
window.saveCity = () => {
  const name = prompt("도시 이름을 입력하세요");
  if (!name) return;

  if (localStorage.getItem("city_" + name)) {
    alert("이미 존재하는 도시 이름입니다.");
    return;
  }

  localStorage.setItem("city_" + name, JSON.stringify(map));
  alert("저장 완료!");
};

window.loadCity = () => {
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith("city_"))
    .map(k => k.replace("city_", ""));

  if (keys.length === 0) {
    alert("저장된 도시가 없습니다.");
    return;
  }

  const name = prompt("불러올 도시 이름:\n" + keys.join(", "));
  if (!name) return;

  const data = localStorage.getItem("city_" + name);
  if (!data) {
    alert("해당 도시가 없습니다.");
    return;
  }

  const loaded = JSON.parse(data);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      map[y][x] = loaded[y][x];
    }
  }
};

window.captureCity = () => {
  const link = document.createElement("a");
  link.download = "city.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};