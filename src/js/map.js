const sqlite3 = require("sqlite3").verbose();
const { ipcRenderer } = require("electron");

const db = new sqlite3.Database("./src/data/field_database.db", (err) => {
  if (err) throw err;
  console.log("Connecté à la base de données.");
});

const canvas = document.getElementById("field-canvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 40; 
let MAP_ROWS = 20;
let MAP_COLS = 20;

function loadFieldDimensions() {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT dimension FROM fieldsdetails WHERE hashfield = ?",
      [currentUser.hashfield],
      (err, row) => {
        if (err) {
          console.error("Erreur lors de la récupération des dimensions :", err);
          reject(err);
        } else if (row) {
          MAP_ROWS = Math.min(row.dimension || MAP_ROWS, 100);
          MAP_COLS = Math.min(row.dimension || MAP_COLS, 100);
          resolve();
        } else {
          console.warn(
            "Aucune dimension trouvée, utilisation des valeurs par défaut."
          );
          resolve();
        }
      }
    );
  });
}

let scale = 1; 
let offsetX = 0; 
let offsetY = 0; 
let isPanning = false; 
let startPanX, startPanY; 

const tileImage = new Image();
tileImage.src = "./farm_graphics/tile.png"; 

const farmerSprites = {
  Basic: {
    up: "./farm_graphics/basic/farmer_basic_up.png",
    down: "./farm_graphics/basic/farmer_basic_down.png",
    left: "./farm_graphics/basic/farmer_basic_left.png",
    right: "./farm_graphics/basic/farmer_basic_right.png",
  },
  Rare: {
    up: "./farm_graphics/rare/farmer_rare_up.png",
    down: "./farm_graphics/rare/farmer_rare_down.png",
    left: "./farm_graphics/rare/farmer_rare_left.png",
    right: "./farm_graphics/rare/farmer_rare_right.png",
  },
  Epic: {
    up: "./farm_graphics/epic/farmer_epic_up.png",
    down: "./farm_graphics/epic/farmer_epic_down.png",
    left: "./farm_graphics/epic/farmer_epic_left.png",
    right: "./farm_graphics/epic/farmer_epic_right.png",
  },
  Legendary: {
    up: "./farm_graphics/legendary/farmer_legendary_up.png",
    down: "./farm_graphics/legendary/farmer_legendary_down.png",
    left: "./farm_graphics/legendary/farmer_legendary_left.png",
    right: "./farm_graphics/legendary/farmer_legendary_right.png",
  },
};

let currentUser = null;
let dbFarmers = {
  Basic: 0,
  Rare: 0,
  Epic: 0,
  Legendary: 0,
};

const farmerSpeeds = {
  Basic: 0.5,
  Rare: 1.0,
  Epic: 1.5,
  Legendary: 2.0, 
};

const farmersOnMap = [];

const MAX_FARMERS_PER_TYPE = 500;

function drawMap() {
  loadFieldDimensions();
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      ctx.drawImage(
        tileImage,
        col * TILE_SIZE,
        row * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }
}

function addFarmer(type) {
  const farmersOfType = farmersOnMap.filter((f) => f.type === type);
  if (farmersOfType.length >= MAX_FARMERS_PER_TYPE) {
    return; 
  }

  const x = Math.floor(Math.random() * MAP_COLS) * TILE_SIZE;
  const y = Math.floor(Math.random() * MAP_ROWS) * TILE_SIZE;

  const maxSpeed = farmerSpeeds[type];
  const isHorizontal = Math.random() > 0.5;

  const speedX = isHorizontal
    ? Math.random() > 0.5
      ? maxSpeed
      : -maxSpeed
    : 0;
  const speedY = !isHorizontal
    ? Math.random() > 0.5
      ? maxSpeed
      : -maxSpeed
    : 0;

  const direction =
    speedX > 0 ? "right" : speedX < 0 ? "left" : speedY > 0 ? "down" : "up";

  const sprite = new Image();
  sprite.src = farmerSprites[type][direction];

  farmersOnMap.push({
    x: Math.max(0, Math.min(x, (MAP_COLS - 1) * TILE_SIZE)),
    y: Math.max(0, Math.min(y, (MAP_ROWS - 1) * TILE_SIZE)), 
    sprite,
    type,
    speedX,
    speedY,
    direction,
  });
}

function drawFarmers() {
  farmersOnMap.forEach((farmer) => {
    const minFarmerSize = 20; 
    const farmerSize = Math.max(TILE_SIZE * scale, minFarmerSize);

    ctx.drawImage(farmer.sprite, farmer.x, farmer.y, farmerSize, farmerSize);
  });
}

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoomIntensity = 0.1;
  const mouseX = event.offsetX;
  const mouseY = event.offsetY;

  const newScale = scale - event.deltaY * zoomIntensity * 0.01;
  if (newScale >= 0.3 && newScale <= 3) {
    offsetX = mouseX - ((mouseX - offsetX) * newScale) / scale;
    offsetY = mouseY - ((mouseY - offsetY) * newScale) / scale;
    scale = newScale;
  }
});

canvas.addEventListener("mousedown", (event) => {
  isPanning = true;
  startPanX = event.clientX - offsetX;
  startPanY = event.clientY - offsetY;
});

canvas.addEventListener("mousemove", (event) => {
  if (isPanning) {
    offsetX = event.clientX - startPanX;
    offsetY = event.clientY - startPanY;
  }
});

canvas.addEventListener("mouseup", () => {
  isPanning = false;
});

canvas.addEventListener("mouseleave", () => {
  isPanning = false;
});

function moveFarmers() {
  farmersOnMap.forEach((farmer) => {
    if (Math.random() < 0.01) {
      const isHorizontal = Math.random() > 0.5;
      const maxSpeed = farmerSpeeds[farmer.type];

      farmer.speedX = isHorizontal
        ? Math.random() > 0.5
          ? maxSpeed
          : -maxSpeed
        : 0;
      farmer.speedY = !isHorizontal
        ? Math.random() > 0.5
          ? maxSpeed
          : -maxSpeed
        : 0;

      farmer.direction =
        farmer.speedX > 0
          ? "right"
          : farmer.speedX < 0
          ? "left"
          : farmer.speedY > 0
          ? "down"
          : "up";

      farmer.sprite.src = farmerSprites[farmer.type][farmer.direction];
    }

    farmer.x += farmer.speedX;
    farmer.y += farmer.speedY;

    if (farmer.x < 0 || farmer.x > MAP_COLS * TILE_SIZE - TILE_SIZE) {
      farmer.speedX *= -1; 
    }
    if (farmer.y < 0 || farmer.y > MAP_ROWS * TILE_SIZE - TILE_SIZE) {
      farmer.speedY *= -1; 
    }
  });
}

function gameLoop() {
  ctx.save();

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  ctx.clearRect(
    -offsetX / scale,
    -offsetY / scale,
    canvas.width / scale,
    canvas.height / scale
  );

  drawMap();
  moveFarmers();
  drawFarmers();

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

function checkAndAddFarmersFromDB() {
  db.get(
    "SELECT * FROM fieldsdetails WHERE hashfield = ?",
    [currentUser.hashfield],
    (err, row) => {
      if (err) {
        console.error("Erreur lors de la récupération des données :", err);
        return;
      }

      const newFarmers = {
        Basic: row.basic_agri || 0,
        Rare: row.rare_agri || 0,
        Epic: row.epic_agri || 0,
        Legendary: row.legendary_agri || 0,
      };

      for (const type in newFarmers) {
        const countInDB = newFarmers[type];
        const countOnMap = farmersOnMap.filter((f) => f.type === type).length;

        if (countInDB > countOnMap) {
          const difference = countInDB - countOnMap;
          for (let i = 0; i < difference; i++) {
            addFarmer(type);
          }
        }
      }
    }
  );
}

function startFarmerCheck() {
  setInterval(() => {
    checkAndAddFarmersFromDB();
  }, 1000); 
}


ipcRenderer.on("start-game", (event, user) => {
  currentUser = user;
  loadFieldDimensions();
  checkAndAddFarmersFromDB();
});

tileImage.onload = () => {
  gameLoop(); 
  startFarmerCheck();
};