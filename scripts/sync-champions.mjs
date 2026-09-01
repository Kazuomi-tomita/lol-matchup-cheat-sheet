import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const WIKI = "https://wiki.leagueoflegends.com/en-us";
const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw", "lol-wiki");
const OUT_DIR = path.join(ROOT, "data", "champions");
const USER_AGENT = "LoLMatchupViewer/0.1 (champion data sync)";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function slug(value) {
  return value.normalize("NFKD").toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function readCached(name) {
  try { return await fs.readFile(path.join(RAW_DIR, name), "utf8"); }
  catch { return undefined; }
}

async function fetchRaw(title, cacheName, refresh) {
  if (!refresh) {
    const cached = await readCached(cacheName);
    if (cached) return cached;
  }
  const url = `${WIKI}/${title.split("/").map(encodeURIComponent).join("/")}?action=raw`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await response.text();
      if (/^#REDIRECT/i.test(text)) {
        const target = text.match(/\[\[([^\]]+)\]\]/)?.[1];
        if (!target) throw new Error(`Unparseable redirect: ${title}`);
        return fetchRaw(target, cacheName, true);
      }
      await fs.writeFile(path.join(RAW_DIR, cacheName), text, "utf8");
      await delay(150);
      return text;
    } catch (error) {
      lastError = error;
      await delay(500 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Failed to fetch ${title}: ${lastError}`);
}

function balancedBlock(source, start) {
  let depth = 0;
  let quote = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && source[i - 1] !== "\\") quote = !quote;
    if (quote) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("Unbalanced Lua table");
}

function parseRoster(lua) {
  const champions = [];
  const entry = /^  \["([^"]+)"\] = \{/gm;
  for (const match of lua.matchAll(entry)) {
    const block = balancedBlock(lua, match.index + match[0].lastIndexOf("{"));
    const name = match[1];
    const numericId = block.match(/\["id"\]\s*=\s*([\d.]+)/)?.[1];
    // Decimal IDs in ChampionData are alternate forms (for example Mega Gnar),
    // not independently selectable champions in the Live Client API.
    if (!numericId || numericId.includes(".")) continue;
    const apiName = block.match(/\["apiname"\]\s*=\s*"([^"]+)"/)?.[1];
    const attackRange = Number(block.match(/\["range"\]\s*=\s*([\d.]+)/)?.[1]);
    const skills = {};
    for (const slot of ["q", "w", "e", "r"]) {
      const skill = block.match(new RegExp(`\\["skill_${slot}"\\]\\s*=\\s*\\{\\[1\\]\\s*=\\s*"([^"]+)"`))?.[1];
      if (skill) skills[slot.toUpperCase()] = skill;
    }
    if (apiName && Number.isFinite(attackRange) && Object.keys(skills).length === 4) champions.push({ name, apiName, attackRange, skills });
  }
  return champions;
}

function fieldsFromTemplate(text) {
  const fields = {};
  let current;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (match) {
      current = match[1].trim().toLowerCase();
      fields[current] = match[2].trim();
    } else if (current) fields[current] += `\n${line}`;
  }
  return fields;
}

function numericValues(value) {
  if (!value) return [];
  const plain = value
    .replace(/<!--.*?-->/gs, " ")
    .replace(/\{\{tt\|([^|}]+)[^}]*\}\}/g, "$1")
    .replace(/\{\{(?:ap|fd|pp|as)\|([^}]+)\}\}/g, "$1")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/,/g, "");
  const progression = plain.match(/(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i);
  if (progression) {
    const start = Number(progression[1]);
    const end = Number(progression[2]);
    const step = (end - start) / 4;
    return Array.from({ length: 5 }, (_, index) => Number((start + step * index).toFixed(4)));
  }
  return [...plain.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function scalar(value) {
  const values = numericValues(value);
  if (!values.length) return value?.replace(/\{\{[^}]+\}\}/g, "").trim() || null;
  return values.length === 1 ? values[0] : values.join(" / ");
}

function rangeValue(fields) {
  // The wiki uses `target range` for location/unit targeted spells and `range`
  // for most direction targeted spells.  These are the same user-facing stat.
  const raw = fields["target range"] || fields.range;
  if (!raw) return null;
  const clean = raw.replace(/<!--.*?-->/gs, " ");
  if (/always equal to .*attack range/i.test(clean)) {
    const fixed = clean.match(/(?:^|[^\w])([1-9]\d{2,3})\s*\(\+/)?.[1];
    return fixed ? Number(fixed) : "AA";
  }
  const progression = clean.match(/\{\{pp\|([^|}]+)/i);
  if (progression) {
    const points = [...progression[1].matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    if (points.length) return points.length === 1 ? points[0] : `${Math.min(...points)} – ${Math.max(...points)}`;
  }
  const fromTo = clean.match(/([\d.]+)\s+to\s+([\d.]+)/i);
  if (fromTo) return `${Number(fromTo[1])} – ${Number(fromTo[2])}`;
  if (/\{\{dv\|/i.test(clean)) {
    const direct = [...clean.matchAll(/(?:^|[^\w])([1-9]\d{1,3})(?![\w])/g)].map((match) => Number(match[1]));
    const sum = clean.match(/([1-9]\d{1,3})\s*\+\s*([1-9]\d{1,3})/);
    if (sum) {
      const addendIndex = direct.lastIndexOf(Number(sum[2]));
      if (addendIndex >= 0) direct.splice(addendIndex, 1);
      direct.push(Number(sum[1]) + Number(sum[2]));
    }
    const distinct = [...new Set(direct)];
    if (distinct.length) return distinct.join(" / ");
  }
  const values = numericValues(clean);
  const direct = [...clean.matchAll(/(?:^|[^\w])([1-9]\d{1,3})(?![\w])/g)].map((match) => Number(match[1]));
  if (!values.length) return direct.length ? [...new Set(direct)].join(" / ") : null;
  if (/\bto\b/i.test(clean) && values.length >= 2) return `${values[0]} – ${values.at(-1)}`;
  if (direct.length) return [...new Set(direct)].join(" / ");
  return values.length === 1 ? values[0] : [...new Set(values)].join(" / ");
}

function abilityData(name, fields) {
  const range = rangeValue(fields);
  const cooldown = numericValues(fields.cooldown);
  const targeting = fields.targeting?.replace(/\{\{[^}]+\}\}/g, "").trim() || null;
  return {
    name,
    range,
    ...(cooldown.length ? { cooldown } : {}),
    ...(numericValues(fields.width).length ? { width: numericValues(fields.width)[0] } : {}),
    ...(numericValues(fields["effect radius"]).length ? { radius: numericValues(fields["effect radius"])[0] } : {}),
    ...(fields["cast time"] ? { castTime: scalar(fields["cast time"]) } : {}),
    ...(fields.speed ? { projectileSpeed: scalar(fields.speed) } : {}),
    collision: fields.collision?.trim() ?? (fields.projectile?.toLowerCase().includes("true") ? "unit" : null),
    targetType: targeting?.toLowerCase() ?? null
  };
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(OUT_DIR, { recursive: true });
  const lua = await fetchRaw("Module:ChampionData/data", "champion-data.lua", refresh);
  const roster = parseRoster(lua);
  if (roster.length < 150) throw new Error(`Only ${roster.length} champions parsed; refusing partial update`);
  const rosterIds = new Set(roster.map((champion) => slug(champion.name)));
  for (const file of await fs.readdir(OUT_DIR)) {
    if (!file.endsWith(".json") || rosterIds.has(path.basename(file, ".json"))) continue;
    const existing = JSON.parse(await fs.readFile(path.join(OUT_DIR, file), "utf8"));
    if (typeof existing.source === "string" && existing.source.startsWith(WIKI)) {
      await fs.unlink(path.join(OUT_DIR, file));
    }
  }
  const retrievedAt = new Date().toISOString().slice(0, 10);
  let completed = 0;
  for (const champion of roster) {
    const spells = {};
    for (const [slot, ability] of Object.entries(champion.skills)) {
      const cache = `${slug(champion.name)}-${slot.toLowerCase()}.wiki`;
      const raw = await fetchRaw(`Template:Data ${champion.name}/${ability}`, cache, refresh);
      spells[slot] = abilityData(ability, fieldsFromTemplate(raw));
    }
    const output = {
      id: slug(champion.name), name: champion.name,
      ...(champion.apiName !== champion.name ? { aliases: [champion.apiName] } : {}),
      attackRange: champion.attackRange, spells,
      source: `${WIKI}/${encodeURIComponent(champion.name)}`, patch: "current", retrievedAt
    };
    await fs.writeFile(path.join(OUT_DIR, `${output.id}.json`), `${JSON.stringify(output, null, 2)}\n`, "utf8");
    completed += 1;
    process.stdout.write(`\rSynced ${completed}/${roster.length}: ${champion.name}                    `);
  }
  process.stdout.write(`\nSynced ${completed} champions from League of Legends Wiki.\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
