import "./style.css";
import type { ChampionData, MatchupState, SpellSlot } from "../shared/types";

const app = document.querySelector<HTMLDivElement>("#app")!;
const slots: SpellSlot[] = ["Q", "W", "E", "R"];
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const displayRange = (value: number | string | null) => value == null ? "—" : escapeHtml(value);
const displayCooldown = (cooldown: number[] | undefined) => cooldown?.length ? `${cooldown.map(escapeHtml).join(" / ")}s` : "—";
const legalNotice = `<footer class="legal-notice">LoL Matchup Viewer isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</footer>`;

function rangeRows(you: ChampionData, enemy: ChampionData, keyCooldowns: SpellSlot[]): string {
  const keySlots = new Set(keyCooldowns);
  return slots.map((slot) => {
    const isKey = keySlots.has(slot);
    return `<div class="stat-row${isKey ? " key-cooldown" : ""}"><span class="slot">${slot}${isKey ? `<small aria-label="Key cooldown">!</small>` : ""}</span><span>${displayRange(you.spells[slot].range)}</span><span class="enemy-value">${displayRange(enemy.spells[slot].range)}</span><span class="cd-value">${displayCooldown(enemy.spells[slot].cooldown)}</span></div>`;
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
  app.innerHTML = `<main><header><span class="eyebrow">${state.status === "manual" ? "MANUAL MATCHUP" : "LIVE MATCHUP"}</span><h1>${escapeHtml(you.name)} <i>vs</i> ${escapeHtml(enemy.name)}</h1></header><section class="range-cooldown"><h2>RANGE &amp; COOLDOWN</h2><div class="stat-head"><span>SLOT</span><span>YOU</span><span>ENEMY</span><span>CD</span></div><div class="stat-row aa"><span class="slot">AA</span><span>${displayRange(you.attackRange)}</span><span class="enemy-value">${displayRange(enemy.attackRange)}</span><span class="cd-value">—</span></div>${rangeRows(you, enemy, keyCooldowns)}</section><section class="danger-section"><h2>DANGER</h2>${combos}</section><button id="change-enemy">Change enemy</button>${legalNotice}</main>`;
  document.querySelector("#change-enemy")?.addEventListener("click", () => render({ ...state, status: "manual", enemy: undefined, message: "敵チャンピオンを選択してください" }));
}

void window.viewer.getState().then(render);
window.viewer.onStateChanged(render);
