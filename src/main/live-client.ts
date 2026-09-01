import https from "node:https";

interface LivePlayer {
  championName: string;
  rawChampionName?: string;
  summonerName?: string;
  riotId?: string;
  team: string;
  position?: string;
}

interface LiveGameData {
  activePlayer?: { summonerName?: string; riotId?: string };
  allPlayers?: LivePlayer[];
}

export interface DetectedMatchup { you: string; enemy?: string; enemyNames: string[] }

export function championNameFromRaw(rawChampionName?: string): string | undefined {
  if (!rawChampionName) return undefined;

  // Human players normally use "game_character_displayname_Ahri", while bots
  // can use the resource-key form "Character_Ahri_Name".
  const displayName = rawChampionName.match(/^game_character_displayname_(.+)$/i);
  if (displayName) return displayName[1];

  const resourceKey = rawChampionName.match(/^Character_(.+)_Name$/i);
  if (resourceKey) return resourceKey[1];

  return rawChampionName;
}

function stableChampionName(player: LivePlayer): string {
  // championName is localized, so prefer the locale-independent raw key.
  return championNameFromRaw(player.rawChampionName) || player.championName;
}

function fetchGameData(): Promise<LiveGameData> {
  return new Promise((resolve, reject) => {
    const request = https.get({
      hostname: "127.0.0.1",
      port: 2999,
      path: "/liveclientdata/allgamedata",
      rejectUnauthorized: false,
      timeout: 1400
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Live Client returned ${response.statusCode}`));
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(JSON.parse(body) as LiveGameData); }
        catch (error) { reject(error); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Live Client timeout")));
    request.on("error", reject);
  });
}

const sameIdentity = (player: LivePlayer, active: LiveGameData["activePlayer"]) =>
  Boolean(active && ((active.riotId && player.riotId === active.riotId) ||
    (active.summonerName && player.summonerName === active.summonerName)));

export async function detectMatchup(): Promise<DetectedMatchup> {
  const data = await fetchGameData();
  const players = data.allPlayers ?? [];
  const you = players.find((player) => sameIdentity(player, data.activePlayer));
  if (!you) throw new Error("Could not identify the active player");

  const enemies = players.filter((player) => player.team !== you.team);
  const normalizedPosition = (value?: string) => value?.toUpperCase().replace("MIDDLE", "MID");
  const ownPosition = normalizedPosition(you.position);
  const enemy = enemies.find((player) => ownPosition && normalizedPosition(player.position) === ownPosition)
    ?? enemies.find((player) => normalizedPosition(player.position) === "MID");

  return {
    you: stableChampionName(you),
    enemy: enemy ? stableChampionName(enemy) : undefined,
    enemyNames: enemies.map(stableChampionName)
  };
}
