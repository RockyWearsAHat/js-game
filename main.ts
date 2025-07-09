import { app, BrowserWindow } from "electron";
import * as path from "path";

// More reliable dev detection - check NODE_ENV or if Vite server is running
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
console.log("isDev:", isDev);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("app.isPackaged:", app.isPackaged);
let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  if (isDev) {
    // In development, load from Vite dev server
    console.log("Loading dev server at http://localhost:5173");
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    const indexPath = path.join(__dirname, "index.html");
    console.log("Loading production build from:", indexPath);
    console.log("__dirname is:", __dirname);
    mainWindow.loadFile(indexPath);

    // Open dev tools in production to see any errors
    mainWindow.webContents.openDevTools();
  }
}

// Start the server only if not in development mode
// if (!isDev) {
//   new ServerGame(Number(ServerConfig.port));
// }

app.whenReady().then(createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
app.on(
  "activate",
  () => BrowserWindow.getAllWindows().length === 0 && createWindow()
);
