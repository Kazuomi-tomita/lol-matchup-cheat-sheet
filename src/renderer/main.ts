import "./style.css";
import type { ChampionData, MatchupState, SpellData, SpellSlot, UpdateInfo, VariableRange } from "../shared/types";

const app = document.querySelector<HTMLDivElement>("#app")!;
const slots: SpellSlot[] = ["Q", "W", "E", "R"];
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const isVariableRange = (value: SpellData["range"]): value is VariableRange => typeof value === "object" && value !== null;
const displayRange = (value: SpellData["range"]) => value == null ? "—" : isVariableRange(value) ? `${escapeHtml(value.min)} → ${escapeHtml(value.max)}` : escapeHtml(value);
const displayCooldown = (cooldown: number[] | undefined) => cooldown?.length ? `${cooldown.map(escapeHtml).join(" / ")}s` : "—";
const selectedForms = new Map<string, string>();
const expandedAbilities = new Set<string>();
const showMyRangesKey = "showMyRanges";
let showMyRanges = localStorage.getItem(showMyRangesKey) === "true";
let availableUpdate: UpdateInfo | null = null;
const legalNotice = `<footer class="legal-notice">LoL Matchup Viewer isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</footer>`;

function activeForm(champion: ChampionData) {
  const selected = selectedForms.get(champion.id);
  return champion.forms?.find((form) => form.id === selected) ?? champion.forms?.[0];
}

function spellFor(champion: ChampionData, slot: SpellSlot): SpellData {
  return activeForm(champion)?.spells[slot] ?? champion.spells[slot];
}

function abilityRange(spell: SpellData, expansionKey: string): string {
  if (spell.type === "utility") return `<span class="utility-value">${escapeHtml(spell.displayName ?? spell.name)}</span>`;
  if (spell.expandable && spell.variants?.length) {
    const expanded = expandedAbilities.has(expansionKey);
    return `<button class="ability-expand" data-expand="${escapeHtml(expansionKey)}" aria-expanded="${expanded}">${escapeHtml(spell.displayName ?? `${spell.variants.length} variants`)} <b>${expanded ? "▾" : "▸"}</b></button>`;
  }
  if (!spell.variants?.length) return displayRange(spell.range);
  return `<span class="variants">${spell.variants.map((variant) => `<small><b>${escapeHtml(variant.label)}</b>${displayRange(variant.range)}</small>`).join("")}</span>`;
}

function expansion(spell: SpellData, expansionKey: string, side: "you" | "enemy"): string {
  if (!spell.expandable || !spell.variants?.length || !expandedAbilities.has(expansionKey)) return "";
  return `<div class="ability-expansion ${side}">${spell.variants.map((variant) => `<div><b>${escapeHtml(variant.label)}</b><span>${escapeHtml(variant.name ?? variant.label)}</span><strong>${displayRange(variant.range)}${variant.note ? ` <small>${escapeHtml(variant.note)}</small>` : ""}</strong></div>`).join("")}</div>`;
}

function rankCooldown(spell: SpellData, level: number | undefined): string {
  if (!Number.isInteger(level) || !level || level < 1 || !spell.cooldown?.length) return "—";
  const value = spell.cooldown.length === 1 ? spell.cooldown[0] : spell.cooldown[level - 1];
  return typeof value === "number" && Number.isFinite(value) ? `${escapeHtml(value)}s` : "—";
}

function formTabs(champion: ChampionData, side: "you" | "enemy"): string {
  if (!champion.forms?.length) return "";
  const current = activeForm(champion)?.id;
  return `<div class="form-tabs ${side}"><span>${side === "you" ? "YOU" : "ENEMY"}</span>${champion.forms.map((form) => `<button class="form-tab${form.id === current ? " active" : ""}" data-champion="${escapeHtml(champion.id)}" data-form="${escapeHtml(form.id)}">${escapeHtml(form.label)}</button>`).join("")}</div>`;
}

function rangeRows(you: ChampionData, enemy: ChampionData, keyCooldowns: SpellSlot[]): string {
  const keySlots = new Set(keyCooldowns);
  return slots.map((slot) => {
    const isKey = keySlots.has(slot);
    const yourSpell = spellFor(you, slot);
    const enemySpell = spellFor(enemy, slot);
    const yourKey = `you:${you.id}:${slot}`;
    const enemyKey = `enemy:${enemy.id}:${slot}`;
    return `<div class="stat-row${isKey ? " key-cooldown" : ""}"><span class="slot">${slot}${isKey ? `<small aria-label="Key cooldown">!</small>` : ""}</span><span class="ability-value my-range">${abilityRange(yourSpell, yourKey)}</span><span class="enemy-value ability-value">${abilityRange(enemySpell, enemyKey)}</span><span class="cd-value">${displayCooldown(enemySpell.cooldown)}</span></div>${expansion(yourSpell, yourKey, "you")}${expansion(enemySpell, enemyKey, "enemy")}`;
  }).join("");
}

function yourCooldowns(you: ChampionData, levels: MatchupState["yourAbilityLevels"]): string {
  return slots.map((slot) => {
    const spell = spellFor(you, slot);
    const shared = spell.type === "compound" ? `<em title="Shared by all ${slot} variants">SHARED</em>` : "";
    return `<span><b>${slot}</b>${shared}${rankCooldown(spell, levels?.[slot])}</span>`;
  }).join("");
}

function render(state: MatchupState): void {
  if (state.status === "waiting") {
    app.innerHTML = `<main class="waiting"><div><div class="orb"></div><h1>Waiting for game...</h1><p>Leagueの試合開始を検出すると自動で表示します</p></div>${legalNotice}</main>`;
    return;
  }
  if (!state.you) {
    app.innerHTML = `<main class="waiting"><div><h1>データが見つかりません</h1><p>${escapeHtml(state.message ?? "Unknown error")}</p></div>${legalNotice}</main>`;
    return;
  }
  if (!state.enemy) {
    app.innerHTML = `<main><header><span class="eyebrow">MANUAL SELECT</span><h1>${escapeHtml(state.you.name)} <i>vs</i> ?</h1></header><section class="picker"><p>${escapeHtml(state.message ?? "敵チャンピオンを選択してください")}</p><select id="enemy"><option value="">Select enemy...</option>${state.candidates.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("")}</select></section>${legalNotice}</main>`;
    document.querySelector<HTMLSelectElement>("#enemy")?.addEventListener("change", (event) => {
      const id = (event.target as HTMLSelectElement).value;
      if (id) void window.viewer.selectEnemy(id).then(render);
    });
    return;
  }
  const { you, enemy, enemyMeta } = state;
  const keyCooldowns = enemyMeta?.keyCooldowns ?? [];
  const combos = (enemyMeta?.dangerCombos ?? []).map((combo) => `<div class="danger"><span>${escapeHtml(combo.combo.replace(">", " → "))}</span><strong>${escapeHtml(combo.effectiveRange)}</strong></div>`).join("") || `<p class="empty danger-empty">No danger metadata</p>`;
  const yourAttackRange = activeForm(you)?.attackRange ?? you.attackRange;
  const enemyAttackRange = activeForm(enemy)?.attackRange ?? enemy.attackRange;
  app.innerHTML = `<main><header><span class="eyebrow">${state.status === "manual" ? "MANUAL MATCHUP" : "LIVE MATCHUP"}</span><h1>${escapeHtml(you.name)} <i>vs</i> ${escapeHtml(enemy.name)}</h1></header><section class="range-cooldown${showMyRanges ? "" : " my-ranges-hidden"}"><div class="section-title"><h2>RANGE &amp; COOLDOWN</h2><button id="toggle-my-ranges" aria-expanded="${showMyRanges}">${showMyRanges ? "▼" : "▶"} MY RANGE</button></div><div class="forms">${formTabs(you, "you")}${formTabs(enemy, "enemy")}</div><div class="stat-head"><span>SLOT</span><span class="my-range">YOU</span><span>ENEMY</span><span>CD</span></div><div class="stat-row aa"><span class="slot">AA</span><span class="my-range">${displayRange(yourAttackRange)}</span><span class="enemy-value">${displayRange(enemyAttackRange)}</span><span class="cd-value">—</span></div>${rangeRows(you, enemy, keyCooldowns)}<div class="your-cooldowns"><strong>YOUR CD</strong>${yourCooldowns(you, state.yourAbilityLevels)}</div></section><section class="danger-section"><h2>DANGER</h2>${combos}</section><button id="change-enemy">Change enemy</button>${legalNotice}</main>`;
  document.querySelector("#toggle-my-ranges")?.addEventListener("click", () => {
    showMyRanges = !showMyRanges;
    localStorage.setItem(showMyRangesKey, String(showMyRanges));
    render(state);
  });
  document.querySelectorAll<HTMLButtonElement>(".form-tab").forEach((button) => button.addEventListener("click", () => {
    selectedForms.set(button.dataset.champion!, button.dataset.form!);
    render(state);
  }));
  document.querySelectorAll<HTMLButtonElement>(".ability-expand").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.expand!;
    if (expandedAbilities.has(key)) expandedAbilities.delete(key);
    else expandedAbilities.add(key);
    render(state);
  }));
  document.querySelector("#change-enemy")?.addEventListener("click", () => render({ ...state, status: "manual", enemy: undefined, message: "敵チャンピオンを選択してください" }));
}

function renderUpdateNotice(update: UpdateInfo | null): void {
  document.querySelector(".update-notice")?.remove();
  if (!update) return;
  const notice = document.createElement("aside");
  notice.className = "update-notice";
  notice.innerHTML = `<div><strong>新しいバージョンがあります</strong><span>現在 ${escapeHtml(update.currentVersion)} / 最新 ${escapeHtml(update.latestVersion)}</span></div><button type="button">更新ページを開く</button>`;
  notice.querySelector("button")?.addEventListener("click", () => void window.viewer.openUpdatePage());
  document.body.prepend(notice);
}

const renderWithUpdate = (state: MatchupState): void => {
  render(state);
  renderUpdateNotice(availableUpdate);
};

void Promise.all([window.viewer.getState(), window.viewer.getUpdate()]).then(([state, update]) => {
  availableUpdate = update;
  renderWithUpdate(state);
});
window.viewer.onStateChanged(renderWithUpdate);
window.viewer.onUpdateAvailable((update) => {
  availableUpdate = update;
  renderUpdateNotice(update);
});
