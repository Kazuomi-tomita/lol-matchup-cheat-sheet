import { contextBridge, ipcRenderer } from "electron";
import type { MatchupState, UpdateInfo, ViewerApi } from "../shared/types";

const api: ViewerApi = {
  getState: () => ipcRenderer.invoke("matchup:get") as Promise<MatchupState>,
  selectEnemy: (championId) => ipcRenderer.invoke("matchup:select-enemy", championId) as Promise<MatchupState>,
  onStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MatchupState) => callback(state);
    ipcRenderer.on("matchup:changed", listener);
    return () => ipcRenderer.removeListener("matchup:changed", listener);
  },
  getUpdate: () => ipcRenderer.invoke("update:get") as Promise<UpdateInfo | null>,
  openUpdatePage: () => ipcRenderer.invoke("update:open") as Promise<void>,
  onUpdateAvailable: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, update: UpdateInfo) => callback(update);
    ipcRenderer.on("update:available", listener);
    return () => ipcRenderer.removeListener("update:available", listener);
  }
};

contextBridge.exposeInMainWorld("viewer", api);
