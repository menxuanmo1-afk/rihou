function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

function snap(value, step) {
  if (!step || step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/** Resize exactly one edge while keeping the opposite edge fixed. */
export function resizeTimelineSpan(span, edge, requestedMin, options = {}) {
  const startMin = Number(span?.startMin) || 0;
  const endMin = Number(span?.endMin) || 0;
  const lo = Number.isFinite(options.lo) ? options.lo : 0;
  const hi = Number.isFinite(options.hi) ? options.hi : 24 * 60;
  const minSpan = Math.max(1, Number(options.minSpan) || 1);
  const step = Math.max(1, Number(options.step) || 1);
  const requested = snap(Number(requestedMin) || 0, step);

  if (edge === "start") {
    return {
      startMin: clamp(requested, lo, Math.max(lo, endMin - minSpan)),
      endMin,
    };
  }
  if (edge === "end") {
    return {
      startMin,
      endMin: clamp(requested, Math.min(hi, startMin + minSpan), hi),
    };
  }
  return { startMin, endMin };
}
