import { app, BrowserWindow } from "electron";
import * as path from "path";

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Create the browser window with more appropriate size for a game
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Allow direct access to Node.js APIs
    },
    title: "Parkour 3D",
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Open the DevTools in development mode
  // mainWindow.webContents.openDevTools();

  // Log when the window is ready to show
  mainWindow.once("ready-to-show", () => {
    console.log("Window is ready to show");

    // Maximize the window for better gaming experience
    mainWindow?.maximize();
  });

  // Emitted when the window is closed
  mainWindow.on("closed", () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// On macOS it's common to re-create a window when the dock icon is clicked
app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
