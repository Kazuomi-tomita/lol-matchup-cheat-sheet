import { contextBridge, ipcRenderer } from "electron";
import type { MatchupState, ViewerApi } from "../shared/types";

const api: ViewerApi = {
  getState: () => ipcRenderer.invoke("matchup:get") as Promise<MatchupState>,
  selectEnemy: (championId) => ipcRenderer.invoke("matchup:select-enemy", championId) as Promise<MatchupState>,
  onStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: MatchupState) => callback(state);
    ipcRenderer.on("matchup:changed", listener);
    return () => ipcRenderer.removeListener("matchup:changed", listener);
  }
};

contextBridge.exposeInMainWorld("viewer", api);
