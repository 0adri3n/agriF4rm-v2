const sqlite3 = require("sqlite3").verbose();
const { ipcRenderer } = require("electron");
import { updateUI, bindButton } from "./renderer.js";

let currentUser = null;
let game_time = 0;
let wheat = 0;
let money = 0;
let dimension = 25;

let wheatPrice = 2;

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

async function getWheatPrice() {
  const response = await fetch(
    "https://api.coinbase.com/v2/prices/ETH-USD/spot"
  );
  const data = await response.json();
  const ethPrice = parseFloat(data.data.amount);

  const price = Math.floor((ethPrice / 100)) / 10;

  return price.toFixed(2); 
}


async function calculateProfitability() {
  const farmerWeights = {
    Basic: 1,
    Rare: 1.5,
    Epic: 2.5,
    Legendary: 4,
  };

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
  const prod_perc = row.prod_perc || 0;
  let farmerContribution = 0;
  for (const [type, count] of Object.entries(farmers)) {
    farmerContribution += count * farmerWeights[type];
  }

  return (dimension * farmerContribution) +  ((dimension * farmerContribution)*prod_perc/100);
}

function getUpgradeCost(currentDimension) {
  const upgradeCosts = {
    10: 100000,
    25: 100000,
    50: 1000000,
    100: 25000000,
    200: 1250000000,
    500: 62500000000,
    1000: 3125000000000,
  };

  const nextDimension = Object.keys(upgradeCosts)
    .map(Number)
    .find((dim) => dim > currentDimension);

  return nextDimension
    ? { cost: upgradeCosts[nextDimension], nextDimension }
    : null;
}

function showNotification(message, color = "white") {
  const notificationContainer = document.getElementById(
    "notification-container"
  );
  notificationContainer.innerHTML =
    `<span style="color: ${color}">${message}</span>` +
    '<br><button onclick="closeNotification()">Close</button>';
  notificationContainer.style.display = "block";
}

async function profitabilityHourMinute(profitability) {
  let text = "<br>";
  text += `${profitability} wheat/hour<br>`;
  text += `${(profitability / 60).toFixed(2)} wheat/minute<br>`;
  text += `${(profitability*await getWheatPrice()).toFixed(2)} $/hour<br>`;
  text += `${((profitability* await getWheatPrice()) / 60).toFixed(2)} $/minute<br>`;
  return text;

}

function convertMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(remainingMinutes).padStart(2, "0");

  return `${formattedHours}h${formattedMinutes}m`;
}

ipcRenderer.on("start-game", async (event, user) => {
  ipcRenderer.send("full-window");
  currentUser = user;

  try {
    const row = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM fieldsdetails WHERE hashfield = ?",
        [user.hashfield],
        (err, row) => {
          if (err) reject(err);
          resolve(row);
        }
      );
    });

    wheat = row.bleamount || 0;
    money = row.money || 0;
    dimension = row.dimension || 25;
    dimension += (dimension * row.dimension_perc) / 100
    game_time = row.game_time;

    farmers = {
      Basic: row.basic_agri || 0,
      Rare: row.rare_agri || 0,
      Epic: row.epic_agri || 0,
      Legendary: row.legendary_agri || 0,
    };

    const wheatPrice = await getWheatPrice();
    const profitability = await calculateProfitability();

    updateUI({
      "wheat-amount": wheat.toFixed(2),
      money: money.toFixed(2),
      dimension: dimension,
      "wheat-price": wheatPrice,
      profitability: await profitabilityHourMinute(profitability.toFixed(2)),
      "basic-farmers": farmers.Basic,
      "rare-farmers": farmers.Rare,
      "epic-farmers": farmers.Epic,
      "legendary-farmers": farmers.Legendary,
      dimension_perc: row.dimension_perc,
      rentability_perc: row.prod_perc,
      "game_time": convertMinutesToTime(game_time),
    });

    displayQuests();
    let easter_username = [
      "j9ueve",
      "caca",
      "prout",
      "Léo",
      "Cyp",
      "Jolagreen23",
      "Rami",
      "gros zizi"
    ]
    if(easter_username.includes(user.username)) {
      showNotification(
        `<a style="color:green;">Wow t'es trop beau ${user.username} ! Joue bien bg</a>`,
        "success"
      );
    }
    else{
      showNotification(`Welcome, ${user.username}!`, "success");
    }

    startPeriodicUpdates();
  } catch (error) {
    console.error("Error during game start:", error);
  }
});


// Logout
bindButton("logout", () => {
  ipcRenderer.send("logout");
  showNotification("Successfully logged out.", "info");
});

// Sell wheat
bindButton("sell-wheat", async () => {


  if (wheat <= 0) {
    showNotification("You have no wheat to sell!", "error");
    return;
  }

  const profit = wheat * wheatPrice;
  money += profit;
  wheat = 0;

  updateUI({
    "wheat-amount": wheat.toFixed(2),
    money: money.toFixed(2),
  });

  showNotification(
    `You sold your wheat for <span style="color:green;">${profit.toLocaleString()}$</span>.`,
    "success"
  );

  db.run(
    "UPDATE fieldsdetails SET bleamount = ?, money = ? WHERE hashfield = ?",
    [wheat, money, currentUser.hashfield],
    (err) => {
      if (err) throw err;
    }
  );
});

// Recruit a farmer
bindButton("roll-farmer", () => {
  const farmerTypes = [
    { type: "Basic", chance: 65, color: "black" },
    { type: "Rare", chance: 20, color: "orange" },
    { type: "Epic", chance: 10, color: "purple" },
    { type: "Legendary", chance: 5, color: "gold" },
  ];

  if (money - 500 < 0) {
    showNotification("Not enough money...", "error");
    return;
  }

  const roll = Math.random() * 100;
  let cumulative = 0;
  let recruitedFarmer = null;

  for (const farmer of farmerTypes) {
    cumulative += farmer.chance;
    if (roll < cumulative) {
      recruitedFarmer = farmer;
      break;
    }
  }

  if (!recruitedFarmer) {
    showNotification("No farmer recruited... Try again!", "error");
    return;
  }

  money -= 500;
  farmers[recruitedFarmer.type]++;
  (async () => {
    const newProf = await calculateProfitability()
    updateUI({
      money: money.toFixed(2),
      profitability: await profitabilityHourMinute(newProf.toFixed(2)),
      "basic-farmers": farmers.Basic,
      "rare-farmers": farmers.Rare,
      "epic-farmers": farmers.Epic,
      "legendary-farmers": farmers.Legendary,
    });
  })();


  showNotification(
    `You recruited a ${recruitedFarmer.type} farmer!`,
    recruitedFarmer.color
  );

  db.run(
    `UPDATE fieldsdetails 
     SET money = ?, basic_agri = ?, rare_agri = ?, epic_agri = ?, legendary_agri = ? 
     WHERE hashfield = ?`,
    [
      money,
      farmers.Basic,
      farmers.Rare,
      farmers.Epic,
      farmers.Legendary,
      currentUser.hashfield,
    ],
    (err) => {
      if (err) throw err;
    }
  );

  setTimeout(checkQuests, 5000);

});

// "Max rolls" recruits the maximum number of farmers with available money
bindButton("max-rolls", () => {
  if (money < 500) {
    showNotification("Not enough money to recruit farmers.", "error");
    return;
  }

  const farmerTypes = [
    { type: "Basic", weight: 65, color: "black" },
    { type: "Rare", weight: 20, color: "orange" },
    { type: "Epic", weight: 10, color: "purple" },
    { type: "Legendary", weight: 5, color: "gold" },
  ];

  const maxRolls = Math.floor(money / 500);
  const weights = farmerTypes.map((farmer) => farmer.weight);

  let recruited = {
    Basic: 0,
    Rare: 0,
    Epic: 0,
    Legendary: 0,
  };

  for (let i = 0; i < maxRolls; i++) {
    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const farmer of farmerTypes) {
      cumulative += farmer.weight;
      if (roll < cumulative) {
        recruited[farmer.type]++;
        break;
      }
    }
  }

  money -= maxRolls * 500;
  farmers.Basic += recruited.Basic;
  farmers.Rare += recruited.Rare;
  farmers.Epic += recruited.Epic;
  farmers.Legendary += recruited.Legendary;

  (async () => {
    const newProf = await calculateProfitability();
    updateUI({
      money: money.toFixed(2),
      profitability: await profitabilityHourMinute(newProf.toFixed(2)),
      "basic-farmers": farmers.Basic,
      "rare-farmers": farmers.Rare,
      "epic-farmers": farmers.Epic,
      "legendary-farmers": farmers.Legendary,
    });
  })();

  showNotification(
    `You recruited :<br>
    <span style="color:black;">${recruited.Basic} Basic </span><br> 
    <span style="color:orange;">${recruited.Rare} Rare</span><br> 
    <span style="color:purple;">${recruited.Epic} Epic</span><br> 
    <span style="color:gold;">${recruited.Legendary} Legendary </span>`,
    "success"
  );

  db.run(
    `UPDATE fieldsdetails 
     SET money = ?, basic_agri = ?, rare_agri = ?, epic_agri = ?, legendary_agri = ? 
     WHERE hashfield = ?`,
    [
      money,
      farmers.Basic,
      farmers.Rare,
      farmers.Epic,
      farmers.Legendary,
      currentUser.hashfield,
    ],
    (err) => {
      if (err) throw err;
    }
  );

  setTimeout(checkQuests, 5000);

});

bindButton("expand-field", () => {
  const upgrade = getUpgradeCost(dimension);

  if (!upgrade) {
    showNotification("You have reached the maximum field size!", "info");
    return;
  }

  const { cost, nextDimension } = upgrade;

  if (money < cost) {
    showNotification(
      `You don't have enough money!<br> You need 
      ${cost.toLocaleString()}$.`,
      "error"
    );
    return;
  }

  dimension = nextDimension;
  money -= cost;

  (async () => {
    const newProf = await calculateProfitability();
      updateUI({
        dimension: dimension,
        money: money.toFixed(2),
        profitability: await profitabilityHourMinute(newProf.toFixed(2)),
      });
  })();

  showNotification(
    `Your field was expanded to 
    ${dimension} units for 
    ${cost.toLocaleString()}$ !`,
    "success"
  );

  db.run(
    "UPDATE fieldsdetails SET dimension = ?, money = ? WHERE hashfield = ?",
    [dimension, money, currentUser.hashfield],
    (err) => {
      if (err) throw err;
    }
  );

  setTimeout(checkQuests, 5000);

});


function loadAvailableQuests(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * 
       FROM quests 
       WHERE id NOT IN (
         SELECT quests_id 
         FROM users_quests 
         WHERE users_id = ?
       ) ORDER BY id ASC`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}


async function displayQuests() {
  try {
    const questList = document.getElementById("quest-list");
    questList.innerHTML = "";

    const quests = await loadAvailableQuests(currentUser.id);

    quests.forEach((quest) => {
      const li = document.createElement("li");
      li.className = "unselectable";
      if(quest.perc_type == "none"){
        li.innerHTML = `${quest.desc}<br><a style="color:red;">Objective</a> : ${quest.objective_amount} ${quest.objective}<br><a style="color:green;">Reward</a> : ${quest.money_reward}$`;
      }
      else if(quest.desc == "???"){
        li.innerHTML = `HIDDEN QUEST ${quest.desc}<br><a style="color:orange;">Objective</a> : ??? ???<br><a style="color:green;">Reward</a> : ???`;
      }
      else if(quest.perc_type != "none"){
        li.innerHTML = `${quest.desc}<br><a style="color:red;">Objective</a> : ${quest.objective_amount} ${quest.objective}<br><a style="color:green;">Reward</a> : ${quest.money_reward}$ | ${quest.perc_type} Perc + ${quest.perc_amount}%`;      
      }
      questList.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading quests:", err);
  }
}

async function checkQuests() {
  try {
    const quests = await loadAvailableQuests(currentUser.id);

    quests.forEach((quest) => {
      const query = `
        SELECT ${quest.objective}, dimension_perc, prod_perc AS value, rentability 
        FROM fieldsdetails 
        WHERE hashfield = ? AND ${quest.objective} >= ?`;

      db.get(
        query,
        [currentUser.hashfield, quest.objective_amount],
        (err, row) => {
          if (err) {
            console.error(`Error checking quest ${quest.id}:`, err);
            return;
          }

          if (row) {
            money += quest.money_reward;
            let actualDimperc = row.dimension_perc;
            let actualProdPerc = row.prod_perc;
            let newDimensionPerc = 0;
            let newProdPerc = 0;
            let hidden = false;


            if (quest.desc == "???")
            {
              hidden = true;
            }

            if (quest.perc_type !== "none") {
              if (quest.perc_type === "dimension") {
                newDimensionPerc = quest.perc_amount;
                actualDimperc += newDimensionPerc;
              } else if (quest.perc_type === "rentability") {
                newProdPerc = quest.perc_amount;
                actualProdPerc += newProdPerc
              }
            }

            db.run(
              `UPDATE fieldsdetails 
               SET money = ?, 
                   dimension_perc = dimension_perc + ?, 
                   prod_perc = prod_perc + ?
               WHERE hashfield = ?`,
              [
                money,
                newDimensionPerc,
                newProdPerc,
                currentUser.hashfield,
              ],
              (updateErr) => {
                if (updateErr) {
                  console.error(
                    `Error updating fieldsdetails for quest ${quest.id}:`,
                    updateErr
                  );
                  return;
                }

                console.log(
                  `Quest ${quest.id} completed. Money and percentage boosts updated.`
                );

                if (newDimensionPerc > 0) {
                  dimension += (dimension * newDimensionPerc) / 100;
                }

                db.run(
                  "INSERT INTO users_quests (users_id, quests_id) VALUES (?, ?)",
                  [currentUser.id, quest.id],
                  (insertErr) => {
                    if (insertErr) {
                      console.error(
                        `Error marking quest ${quest.id} as completed:`,
                        insertErr
                      );
                      return;
                    }

                    console.log(`Quest ${quest.id} marked as completed.`);
                    
                    let rewardMessage = "";

                    if(hidden){
                      rewardMessage = `<a style="color:red;">HIDDEN QUEST COMPLETED</a><br>Objective: ${quest.objective_amount} ${quest.objective}<br>You earned ${quest.money_reward}$`;
                    }
                    else{
                      rewardMessage = `Quest completed! You earned ${quest.money_reward}$`;
                    }
                    const bonusMessage =
                      quest.perc_type !== "none"
                        ? ` and a ${quest.perc_amount}% boost to ${quest.perc_type}`
                        : "";

                    showNotification(rewardMessage + bonusMessage, "success");
                    

                    (async () => {
                      const newProf = await calculateProfitability();

                      updateUI({
                        money: money.toFixed(2),
                        dimension: dimension.toFixed(2),
                        profitability: await profitabilityHourMinute(newProf.toFixed(2)),
                        "wheat-amount": wheat.toFixed(2),
                        dimension_perc: actualDimperc || 0,
                        rentability_perc: actualProdPerc || 0,
                      });
                    })();
                    
                    const questList = document.getElementById("quest-list");
                    questList.innerHTML = "";
                    displayQuests();
                  }
                );
              }
            );
          }
        }
      );
    });
  } catch (err) {
    console.error("Error checking quests:", err);
  }
}



function startPeriodicUpdates() {
  setInterval(async () => {
    try {
      const wheatPrice = await getWheatPrice();
      const profitability = await calculateProfitability();
      wheat += profitability / 60;
      game_time += 1

      db.run(
        "UPDATE fieldsdetails SET bleamount = ?, rentability = ?, game_time = ? WHERE hashfield = ?",
        [wheat, profitability, game_time, currentUser.hashfield],
        (err) => {
          if (err) throw err;
        }
      );

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

      const dim_perc = row.dimension_perc;
      const prod_perc = row.prod_perc;

      checkQuests();

      updateUI({
        "wheat-amount": wheat.toFixed(2),
        "wheat-price": wheatPrice,
        dimension_perc: dim_perc,
        rentability_perc: prod_perc,
        "game_time": convertMinutesToTime(game_time)
      });
    } catch (error) {
      console.error("Error during periodic updates:", error);
    }
  }, 60000);
}
