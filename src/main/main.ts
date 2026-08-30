import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { DataStore } from "./data-store";
import { detectMatchup } from "./live-client";
import type { MatchupState } from "../shared/types";

const store = new DataStore();
let window: BrowserWindow | null = null;
let state: MatchupState = { status: "waiting", candidates: [] };
let lastFingerprint = "";

function publish(next: MatchupState): void {
  state = next;
  window?.webContents.send("matchup:changed", state);
}

async function poll(): Promise<void> {
  try {
    const detected = await detectMatchup();
    const you = store.champion(detected.you);
    const enemy = detected.enemy ? store.champion(detected.enemy) : undefined;
    const fingerprint = `${detected.you}:${detected.enemy ?? "manual"}`;
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    if (!you) {
      publish({ status: "error", candidates: store.allChampions(), message: `No local data for ${detected.you}.` });
      return;
    }
    if (!enemy) {
      const candidates = detected.enemyNames.map((name) => store.champion(name)).filter(Boolean);
      publish({
        status: "manual", you,
        candidates: candidates.length ? candidates as NonNullable<typeof candidates[number]>[] : store.allChampions(),
        message: "Enemy laner could not be detected. Select them manually."
      });
      return;
    }
    publish({ status: "detected", you, enemy, enemyMeta: store.meta(enemy.id), candidates: store.allChampions() });
  } catch {
    if (state.status !== "waiting") {
      lastFingerprint = "";
      publish({ status: "waiting", candidates: store.allChampions() });
    }
  }
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 400,
    minHeight: 560,
    backgroundColor: "#08111d",
    title: "LoL Matchup Viewer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void window.loadURL(devUrl);
    window.webContents.openDevTools({ mode: "detach" });
  }
  else {
    void window.loadFile(path.join(app.getAppPath(), "dist", "index.html")).catch((error) => {
      console.error("Failed to load renderer:", error);
    });
  }
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process exited:", details.reason, details.exitCode);
  });
}

app.whenReady().then(() => {
  store.load();
  state.candidates = store.allChampions();
  ipcMain.handle("matchup:get", () => state);
  ipcMain.handle("matchup:select-enemy", (_event, championId: string) => {
    const enemy = store.champion(championId);
    if (!enemy || !state.you) return state;
    publish({ ...state, status: "manual", enemy, enemyMeta: store.meta(enemy.id) });
    return state;
  });
  createWindow();
  void poll();
  setInterval(() => void poll(), 2000);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
