import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { ChampionData, MatchupMeta } from "../shared/types";

const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function dataRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "data")
    : path.join(app.getAppPath(), "data");
}

function readJsonDirectory<T>(directory: string): T[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) as T);
}

export class DataStore {
  private champions: ChampionData[] = [];
  private metadata: MatchupMeta[] = [];

  load(): void {
    this.champions = readJsonDirectory<ChampionData>(path.join(dataRoot(), "champions"));
    this.metadata = readJsonDirectory<MatchupMeta>(path.join(dataRoot(), "matchup-meta"));
  }

  allChampions(): ChampionData[] {
    return [...this.champions].sort((a, b) => a.name.localeCompare(b.name));
  }

  champion(nameOrId: string): ChampionData | undefined {
    const key = normalize(nameOrId);
    return this.champions.find((champion) =>
      normalize(champion.id) === key ||
      normalize(champion.name) === key ||
      champion.aliases?.some((alias) => normalize(alias) === key));
  }

  meta(championId: string): MatchupMeta | undefined {
    const key = normalize(championId);
    return this.metadata.find((entry) => normalize(entry.championId) === key);
  }
}
