const sqlite3 = require("sqlite3").verbose();
const { ipcRenderer } = require("electron");
import { bindButton } from "./renderer.js";

let currentUser = null;
let game_time = 0;
let wheat = 0;
let dimension = 0;
let prod_perc = 0;


let farmers = {
  Basic: 0,
  Rare: 0,
  Epic: 0,
  Legendary: 0,
};


const db = new sqlite3.Database("./src/data/field_database.db", (err) => {
  if (err) throw err;
  console.log("Connected to the database.");
});


// Function to calculate profitability
async function calculateProfitability() {
  const farmerWeights = {
    Basic: 1,
    Rare: 1.5,
    Epic: 2.5,
    Legendary: 4,
  };

  let farmerContribution = 0;
  for (const [type, count] of Object.entries(farmers)) {
    farmerContribution += count * farmerWeights[type];
  }

  return (dimension * farmerContribution) +  ((dimension * farmerContribution)*prod_perc/100);
}


// Receive the selected user
ipcRenderer.on("start-game", async (event, user) => {
  ipcRenderer.send("mini-window")
  currentUser = user;
  const row = await new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM fieldsdetails WHERE hashfield = ?",
      [currentUser.hashfield],
      (err, row) => {
        if (err) reject(err);
        resolve(row);
      }
    );
  });

  wheat = row.bleamount || 0;
  dimension = row.dimension || 25;
  dimension += (dimension * row.dimension_perc) / 100;
  prod_perc = row.prod_perc;
  game_time = row.game_time;

    farmers = {
        Basic: row.basic_agri || 0,
        Rare: row.rare_agri || 0,
        Epic: row.epic_agri || 0,
        Legendary: row.legendary_agri || 0,
    };

  console.log("Wheat :", wheat);
  console.log("Game time:", game_time)
  startPeriodicUpdates();

});


// Logout
bindButton("logout", () => {
  ipcRenderer.send("logout");
  ipcRenderer.send("toggle-mini-mode")
  showNotification("Successfully logged out.", "info");
});



function startPeriodicUpdates() {
  setInterval(async () => {
    try {
      const profitability = await calculateProfitability();
      wheat += profitability / 60;
      console.log(wheat += profitability / 60);
      game_time += 1

      db.run(
        "UPDATE fieldsdetails SET bleamount = ?, rentability = ?, game_time = ? WHERE hashfield = ?",
        [wheat, profitability, game_time, currentUser.hashfield],
        (err) => {
          if (err) throw err;
        }
      );
      console.log("Wheat :", wheat);
      console.log("Game time:", game_time);

    } catch (error) {
      console.error("Error during periodic updates:", error);
    }
  }, 60000);
}
