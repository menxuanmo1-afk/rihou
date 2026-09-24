export const KIND_GROUP_IDS = ["invest", "health", "entertain", "other"];

export const KIND_GROUP_PALETTES = {
  invest: ["#E8A87C", "#E8C07D"],
  health: ["#7DCEA0", "#5BB798", "#7EB6D9", "#8EC5D6"],
  entertain: ["#E07A5F", "#E6A4C4"],
  other: ["#9AA8B5"],
};

const BUILTIN_GROUPS = {
  STUDY: "invest",
  CLASS: "invest",
  READ: "invest",
  CREATE: "invest",
  WORK: "invest",
  FITNESS: "health",
  SPORT: "health",
  MEAL: "health",
  REST: "health",
  SLEEP: "health",
  SHOWER: "health",
  SOCIAL: "entertain",
  SCROLL: "entertain",
  GAME: "entertain",
  COMMUTE: "other",
  CHORE: "other",
  DAZE: "other",
  OTHER: "other",
};

const BUILTIN_COLORS = {
  STUDY: "#E8A87C",
  CLASS: "#E8C07D",
  READ: "#DDB66A",
  CREATE: "#D99A62",
  WORK: "#EDC27F",
  FITNESS: "#65BFA0",
  SPORT: "#5BB798",
  MEAL: "#8DCB90",
  REST: "#77AFC0",
  SLEEP: "#718EC7",
  SHOWER: "#79BCD1",
  SOCIAL: "#D98787",
  SCROLL: "#E07A5F",
  GAME: "#D96B70",
  COMMUTE: "#87949D",
  CHORE: "#9DA5A1",
  DAZE: "#777672",
  OTHER: "#969AA0",
};

const DEFAULT_ORDER = {
  invest: ["STUDY", "CLASS", "READ", "CREATE", "WORK"],
  health: ["FITNESS", "SPORT", "MEAL", "REST", "SLEEP", "SHOWER"],
  entertain: ["SOCIAL", "SCROLL", "GAME"],
  other: ["COMMUTE", "CHORE", "DAZE", "OTHER"],
};

export function normalizeKindGroup(value, fallback = "invest") {
  return KIND_GROUP_IDS.includes(value) ? value : fallback;
}

export function groupForKind(kind, customGroups = {}) {
  if (kind?.id && KIND_GROUP_IDS.includes(customGroups[kind.id])) return customGroups[kind.id];
  if (kind?.custom) {
    const isDisc = /^(飞盘|frisbee)$/i.test(String(kind.label || "").trim());
    const legacy = isDisc || kind.book === "body" ? "health" : "invest";
    return legacy;
  }
  return BUILTIN_GROUPS[kind?.id] || "other";
}

function stringHash(value) {
  let out = 0;
  for (const char of String(value || "")) out = ((out * 31) + char.charCodeAt(0)) >>> 0;
  return out;
}

export function colorForKind(kind, group = groupForKind(kind)) {
  const palette = KIND_GROUP_PALETTES[normalizeKindGroup(group)] || KIND_GROUP_PALETTES.other;
  if (!kind?.custom && group === (BUILTIN_GROUPS[kind?.id] || "other")) return BUILTIN_COLORS[kind?.id] || BUILTIN_COLORS.OTHER;
  if (palette.includes(kind.color)) return kind.color;
  return palette[stringHash(kind.id) % palette.length];
}

export function groupPickerKinds(kinds, usage = {}, customGroups = {}, manualOrder = {}, autoSort = true) {
  const indexed = (Array.isArray(kinds) ? kinds : [])
    .filter((kind) => kind?.id !== "DAZE")
    .map((kind, index) => ({ kind, index }));
  return KIND_GROUP_IDS.map((id) => ({
    id,
    kinds: indexed
      .filter(({ kind }) => groupForKind(kind, customGroups) === id)
      .sort((a, b) => {
        if (autoSort) {
          const count = (Number(usage[b.kind.id]) || 0) - (Number(usage[a.kind.id]) || 0);
          if (count) return count;
        } else {
          const order = Array.isArray(manualOrder[id]) ? manualOrder[id] : [];
          const rankA = order.includes(a.kind.id) ? order.indexOf(a.kind.id) : Number.MAX_SAFE_INTEGER;
          const rankB = order.includes(b.kind.id) ? order.indexOf(b.kind.id) : Number.MAX_SAFE_INTEGER;
          if (rankA !== rankB) return rankA - rankB;
        }
        const order = DEFAULT_ORDER[id] || [];
        const rankA = order.includes(a.kind.id) ? order.indexOf(a.kind.id) : Number.MAX_SAFE_INTEGER;
        const rankB = order.includes(b.kind.id) ? order.indexOf(b.kind.id) : Number.MAX_SAFE_INTEGER;
        return rankA - rankB || a.index - b.index;
      })
      .map(({ kind }) => kind),
  }));
}
