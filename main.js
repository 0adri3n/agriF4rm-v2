const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const DiscordRPC = require("discord-rpc");

const clientId = "1333877648761421894";

const rpc = new DiscordRPC.Client({ transport: "ipc" });
DiscordRPC.register(clientId);

const startTimestamp = new Date();

function createWindow() {

  let mini_mode = false;

  // rpc.on("ready", () => {
  //   rpc.setActivity({
  //     details: "Farming...",
  //     largeImageKey: "logo",
  //     largeImageText: "agriF4rm v2",
  //     smallImageKey: "v2",
  //     smallImageText: "v2!",
  //     instance: false,
  //     startTimestamp,
  //   });
  // });

  // rpc.login({ clientId }).catch(console.error);



  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(
      __dirname,
      "./src/html/img/app_icon_2.png"
    ),
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      // preload: path.join(__dirname, "preload.js"), // Si besoin
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("src/html/login.html");

  ipcMain.on("load-game", (event, user) => {
    if(mini_mode == true){
      win.loadFile("src/html/mini_game.html");
      win.webContents.once("did-finish-load", () => {
        win.webContents.send("start-game", user);
      });
    }
    else{
      win.loadFile("src/html/game.html");
      win.webContents.once("did-finish-load", () => {
        win.webContents.send("start-game", user);
        win.maximize();
      });
    }

  });

  ipcMain.on("logout", () => {
    win.loadFile("src/html/login.html");
    win.setSize(800, 600);
  });

  ipcMain.on("mini-window", (event,) => {
    win.setSize(650, 400);
  });

  ipcMain.on("full-window", (event,) => {
    win.maximize();
  });

  ipcMain.on("toggle-mini-mode", (event) => {
    mini_mode = !mini_mode;
  });

}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin"){
    app.quit();
    rpc.destroy();
  } 

});
