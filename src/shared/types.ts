export type SpellSlot = "Q" | "W" | "E" | "R";

export interface VariableRange {
  min: number;
  max: number;
}

export interface AbilityVariant {
  label: string;
  name?: string;
  range: number | string | null | VariableRange;
  note?: string;
}

export interface SpellData {
  name: string;
  range: number | string | null | VariableRange;
  cooldown?: number[];
  type?: "normal" | "variable" | "multi" | "derived" | "compound" | "utility";
  variants?: AbilityVariant[];
  expandable?: boolean;
  displayName?: string;
  note?: string;
  width?: number | null;
  radius?: number | null;
  castTime?: number | string | null;
  projectileSpeed?: number | string | null;
  collision?: string | null;
  targetType?: string | null;
}

export interface ChampionForm {
  id: string;
  label: string;
  attackRange?: number;
  spells: Partial<Record<SpellSlot, SpellData>>;
}

export interface ChampionData {
  id: string;
  name: string;
  aliases?: string[];
  attackRange: number;
  spells: Record<SpellSlot, SpellData>;
  forms?: ChampionForm[];
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
  yourAbilityLevels?: Partial<Record<SpellSlot, number>>;
  candidates: ChampionData[];
  message?: string;
}

export interface ViewerApi {
  getState(): Promise<MatchupState>;
  selectEnemy(championId: string): Promise<MatchupState>;
  onStateChanged(callback: (state: MatchupState) => void): () => void;
}
