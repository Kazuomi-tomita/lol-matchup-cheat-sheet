export type SpellSlot = "Q" | "W" | "E" | "R";

export interface SpellData {
  name: string;
  range: number | string | null;
  cooldown?: number[];
  width?: number | null;
  radius?: number | null;
  castTime?: number | string | null;
  projectileSpeed?: number | string | null;
  collision?: string | null;
  targetType?: string | null;
}

export interface ChampionData {
  id: string;
  name: string;
  aliases?: string[];
  attackRange: number;
  spells: Record<SpellSlot, SpellData>;
  source?: string;
  patch?: string;
  retrievedAt?: string;
}

export interface MatchupMeta {
  championId: string;
  keyCooldowns: SpellSlot[];
  dangerCombos: Array<{ combo: string; effectiveRange: number; note?: string }>;
}

export interface MatchupState {
  status: "waiting" | "detected" | "manual" | "error";
  you?: ChampionData;
  enemy?: ChampionData;
  enemyMeta?: MatchupMeta;
  candidates: ChampionData[];
  message?: string;
}

export interface ViewerApi {
  getState(): Promise<MatchupState>;
  selectEnemy(championId: string): Promise<MatchupState>;
  onStateChanged(callback: (state: MatchupState) => void): () => void;
}
