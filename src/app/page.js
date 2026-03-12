"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const ITEM_HEIGHT = 40; // px, must match row height styles
const VISIBLE_COUNT = 7; // odd number so center row aligns perfectly
const SPIN_SPEED_ITEMS_PER_SECOND = 18; // items per second during free spin
const STOP_DURATION_MS = 1800; // duration of easing slowdown in ms
const SPIN_TOTAL_MS = 6000; // total spin time per draw in ms

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fix common ordinal typos in display (e.g. 1th → 1st, 2th → 2nd, 3th → 3rd)
function fixOrdinalDisplay(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\b1th\b/g, "1st")
    .replace(/\b2th\b/g, "2nd")
    .replace(/\b3th\b/g, "3rd");
}

// Simple sounds via Web Audio API (no external files)
function playDrawSound(ctx, kind) {
  if (!ctx) return;
  if (typeof ctx.resume === "function") ctx.resume();
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (kind === "spin") {
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      osc.type = "sine";
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === "complete") {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.type = "sine";
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (kind === "pick") {
      osc.frequency.value = 440;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (kind === "reveal") {
      // Short chime when the opponent reel stops and selection is revealed
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.06);
      osc.frequency.setValueAtTime(783.99, now + 0.12);
      osc.type = "sine";
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (_) {}
}

// Tick for each team that passes the selection box (audible, one per item)
function playItemPassTick(ctx) {
  if (!ctx) return;
  if (typeof ctx.resume === "function") ctx.resume();
  try {
    const now = ctx.currentTime;
    const duration = 0.06;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + duration);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch (_) {}
}

export default function Home() {
  const [teams, setTeams] = useState([]);
  const [teamInput, setTeamInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [phase, setPhase] = useState("input"); // "input" | "drawing" | "done"
  const [pool, setPool] = useState([]);
  const [currentPair, setCurrentPair] = useState([]); // [firstTeam, secondTeam?]
  const [matches, setMatches] = useState([]);
  const [justDrew, setJustDrew] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingIndex, setRollingIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [rollingNames, setRollingNames] = useState([]);

  const pendingDrawRef = useRef(null);
  const currentPairRef = useRef([]);
  const poolRef = useRef([]);
  const phaseRef = useRef("input");
  const rollingNamesRef = useRef([]);
  const isStoppingRef = useRef(false);
  const rollingIndexRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const stopFromRef = useRef(0);
  const stopToRef = useRef(0);
  const stopStartTimeRef = useRef(null);
  const spinStartTimeRef = useRef(null);
  const audioContextRef = useRef(null);
  const prevCenterIndexRef = useRef(null);
  const prevScrollOffsetRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioContextRef.current = new Ctx();
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    currentPairRef.current = currentPair;
  }, [currentPair]);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const pickFirstFromPool = useCallback(() => {
    if (phaseRef.current !== "drawing") return;
    const nextPool = poolRef.current;
    if (!nextPool || nextPool.length === 0) return;
    // Keep special handling for the final 2 teams
    if (nextPool.length === 2) return;

    playDrawSound(getAudioContext(), "pick");
    const [drawn, ...rest] = nextPool;
    setPool(rest);
    setCurrentPair([drawn]);
    setJustDrew(drawn);
  }, [getAudioContext]);

  const addTeam = useCallback(() => {
    const name = teamInput.trim();
    if (name && !teams.includes(name)) {
      setTeams((t) => [...t, name]);
      setTeamInput("");
    }
  }, [teamInput, teams]);

  const addBulk = useCallback(() => {
    const names = bulkInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setTeams((t) => {
      const combined = [...t];
      names.forEach((n) => {
        if (n && !combined.includes(n)) combined.push(n);
      });
      return combined;
    });
    setBulkInput("");
  }, [bulkInput]);

  const removeTeam = useCallback((name) => {
    setTeams((t) => t.filter((x) => x !== name));
  }, []);

  const finalizePendingDraw = useCallback(() => {
    if (!pendingDrawRef.current) return;

    const { drawn, rest } = pendingDrawRef.current;
    pendingDrawRef.current = null;

    setIsRolling(false);
    setRollingIndex(0);
    setRollingNames([]);
    setPool(rest);
    scrollOffsetRef.current = 0;
    setScrollOffset(0);
    isStoppingRef.current = false;
    spinStartTimeRef.current = null;

    const prev = currentPairRef.current;
    if (prev.length === 0) {
      setJustDrew(drawn);
      setCurrentPair([drawn]);
      return;
    }

    playDrawSound(getAudioContext(), "complete");
    setJustDrew(drawn);

    const pair = [prev[0], drawn];
    // Show in Matches first, then keep the pair visible briefly before advancing.
    setMatches((m) => {
      const last = m[m.length - 1];
      if (last && last[0] === pair[0] && last[1] === pair[1]) return m;
      return [...m, pair];
    });
    setCurrentPair(pair);
    setTimeout(() => {
      setCurrentPair([]);
      setJustDrew(null);
      pickFirstFromPool();
    }, 2800);
  }, [setPool, setCurrentPair, setMatches, setJustDrew, getAudioContext, pickFirstFromPool]);

  const startDrawing = useCallback(() => {
    if (teams.length < 2 || teams.length % 2 !== 0) return;
    // Unlock audio on first user gesture so draw sounds work
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pendingDrawRef.current = null;
    rollingNamesRef.current = [];
    setRollingNames([]);
    isStoppingRef.current = false;
    rollingIndexRef.current = 0;
    scrollOffsetRef.current = 0;
    setScrollOffset(0);
    setRollingIndex(0);
    // Keep the very first team static and only randomize the remaining teams
    const [firstTeam, ...restTeams] = teams;
    const shuffledRest = shuffle([...restTeams]);
    // Auto-pick the first (static) team for the first pair when there are more than 2 teams
    if (teams.length > 2) {
      playDrawSound(getAudioContext(), "pick");
      setPool(shuffledRest);
      setCurrentPair([firstTeam]);
      setJustDrew(firstTeam);
    } else {
      // Exactly two teams: keep their order (first as Team 1, second as opponent)
      setPool([firstTeam, ...shuffledRest]);
      setCurrentPair([]);
      setJustDrew(null);
    }
    setMatches([]);
    setIsRolling(false);
    setPhase("drawing");
  }, [teams, getAudioContext]);

  const drawNext = useCallback(async () => {
    if (pool.length === 0 || isRolling) return;

    // Unlock audio on user gesture (required by browsers)
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    // If only two teams remain and no current pair, auto-match them without spinning
    if (pool.length === 2 && currentPair.length === 0) {
      const [teamA, teamB] = pool;
      const pair = [teamA, teamB];
      setMatches((m) => {
        const last = m[m.length - 1];
        if (last && last[0] === pair[0] && last[1] === pair[1]) return m;
        return [...m, pair];
      });
      setCurrentPair(pair);
      setTimeout(() => {
        setPool([]);
        setCurrentPair([]);
        setJustDrew(null);
      }, 2800);
      return;
    }

    // If no team is currently selected in the pair, pick one immediately (no spinning)
    if (currentPair.length === 0) {
      playDrawSound(getAudioContext(), "pick");
      const [drawn, ...rest] = pool;
      setPool(rest);
      setCurrentPair([drawn]);
      setJustDrew(drawn);

      // Ensure spinner state is fully reset
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pendingDrawRef.current = null;
      rollingNamesRef.current = [];
      isStoppingRef.current = false;
      scrollOffsetRef.current = 0;
      setScrollOffset(0);
      rollingIndexRef.current = 0;
      setRollingIndex(0);
      setIsRolling(false);
      spinStartTimeRef.current = null;
      return;
    }

    // At this point, one team is already selected in currentPair.
    // Spin to randomly draw the opponent from the remaining pool.

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setJustDrew(null);
    playDrawSound(getAudioContext(), "spin");

    const [drawn, ...rest] = pool;
    const names = pool.length > 1 ? pool : [drawn];

    pendingDrawRef.current = { drawn, rest };
    rollingNamesRef.current = names;
    setRollingNames(names);
    isStoppingRef.current = false;

    const totalHeight = ITEM_HEIGHT * names.length;
    const initialOffset = Math.random() * (totalHeight || 1);
    scrollOffsetRef.current = initialOffset;
    setScrollOffset(totalHeight ? initialOffset % totalHeight : 0);

    // initialize center index based on current offset so the highlight starts in sync
    if (names.length > 0) {
      const containerHeight = ITEM_HEIGHT * VISIBLE_COUNT;
      const normalizedOffset =
        ((scrollOffsetRef.current % totalHeight) + totalHeight) % totalHeight;
      const rawIndex =
        Math.round(
          (normalizedOffset + containerHeight / 2 - ITEM_HEIGHT / 2) /
            ITEM_HEIGHT,
        ) % names.length;
      const safeIndex = ((rawIndex % names.length) + names.length) % names.length;
      rollingIndexRef.current = safeIndex;
      setRollingIndex(safeIndex);
    } else {
      rollingIndexRef.current = 0;
      setRollingIndex(0);
    }

    setIsRolling(true);
    lastTimeRef.current = null;
    stopStartTimeRef.current = null;
    spinStartTimeRef.current = null;
    prevCenterIndexRef.current = null;
    prevScrollOffsetRef.current = scrollOffsetRef.current;

    const step = (timestamp) => {
      const list = rollingNamesRef.current;
      if (!list || list.length === 0) {
        animationFrameRef.current = null;
        return;
      }

      const total = ITEM_HEIGHT * list.length;
      const containerHeight = ITEM_HEIGHT * VISIBLE_COUNT;

      const prevScroll = prevScrollOffsetRef.current;

      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp;
      }
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (spinStartTimeRef.current == null) {
        spinStartTimeRef.current = timestamp;
      }
      const elapsedTotal = timestamp - spinStartTimeRef.current;

      if (!isStoppingRef.current) {
        const slowDownStartMs = SPIN_TOTAL_MS - STOP_DURATION_MS;
        if (elapsedTotal >= slowDownStartMs) {
          const pending = pendingDrawRef.current;
          if (!list || list.length === 0 || !pending) {
            isStoppingRef.current = true;
          } else {
            const { drawn } = pending;
            const targetIndex = list.indexOf(drawn);
            if (targetIndex === -1) {
              isStoppingRef.current = true;
            } else {
              const centerPixel = containerHeight / 2;
              const baseTarget =
                targetIndex * ITEM_HEIGHT + ITEM_HEIGHT / 2 - centerPixel;

              const minLoops = 1;
              const minTarget = scrollOffsetRef.current + minLoops * total;
              const k = Math.max(
                0,
                Math.ceil((minTarget - baseTarget) / total),
              );
              const finalTarget = baseTarget + k * total;

              stopFromRef.current = scrollOffsetRef.current;
              stopToRef.current = finalTarget;
              isStoppingRef.current = true;
              stopStartTimeRef.current = null;
            }
          }
        }

        if (!isStoppingRef.current) {
          const distanceItems =
            (SPIN_SPEED_ITEMS_PER_SECOND * deltaMs) / 1000;
          scrollOffsetRef.current += distanceItems * ITEM_HEIGHT;
        }
      } else {
        if (stopStartTimeRef.current == null) {
          stopStartTimeRef.current = timestamp;
        }
        const t =
          (timestamp - stopStartTimeRef.current) / STOP_DURATION_MS;
        const clamped = Math.min(Math.max(t, 0), 1);
        const eased = 1 - Math.pow(1 - clamped, 3); // easeOutCubic
        scrollOffsetRef.current =
          stopFromRef.current +
          (stopToRef.current - stopFromRef.current) * eased;

        if (clamped >= 1) {
          // snap to exact alignment and finish — play reveal sound when opponent is selected
          playDrawSound(getAudioContext(), "reveal");
          const normalized =
            ((scrollOffsetRef.current % total) + total) % total;
          const rawIndex =
            Math.round(
              (normalized + containerHeight / 2 - ITEM_HEIGHT / 2) /
                ITEM_HEIGHT,
            ) % list.length;
          const safeIndex =
            ((rawIndex % list.length) + list.length) % list.length;
          rollingIndexRef.current = safeIndex;
          setRollingIndex(safeIndex);
          setScrollOffset(normalized);

          setIsRolling(false);
          isStoppingRef.current = false;
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
          lastTimeRef.current = null;
          stopStartTimeRef.current = null;
          spinStartTimeRef.current = null;

          finalizePendingDraw();
          return;
        }
      }

      prevScrollOffsetRef.current = scrollOffsetRef.current;

      const normalized =
        ((scrollOffsetRef.current % total) + total) % total;
      setScrollOffset(normalized);

      const rawIndex =
        Math.round(
          (normalized + containerHeight / 2 - ITEM_HEIGHT / 2) /
            ITEM_HEIGHT,
        ) % list.length;
      const safeIndex =
        ((rawIndex % list.length) + list.length) % list.length;

      // Play a tick for each team that passes the selection box (when center index changes)
      const prevIdx = prevCenterIndexRef.current;
      if (prevIdx !== null && prevIdx !== safeIndex) {
        playItemPassTick(getAudioContext());
      }
      prevCenterIndexRef.current = safeIndex;

      rollingIndexRef.current = safeIndex;
      setRollingIndex(safeIndex);

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [pool, isRolling, currentPair, setMatches, setPool, setCurrentPair, setJustDrew, finalizePendingDraw, getAudioContext]);

  const reset = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pendingDrawRef.current = null;
    rollingNamesRef.current = [];
    setRollingNames([]);
    rollingIndexRef.current = 0;
    setRollingIndex(0);
    scrollOffsetRef.current = 0;
    setScrollOffset(0);
    isStoppingRef.current = false;
    setPhase("input");
    setPool([]);
    setCurrentPair([]);
    setMatches([]);
    setJustDrew(null);
    setIsRolling(false);
    spinStartTimeRef.current = null;
  }, []);

  const needFirst = phase === "drawing" && currentPair.length === 0 && pool.length > 0;
  const needSecond = phase === "drawing" && currentPair.length === 1 && pool.length > 0;
  const canDraw = needFirst || needSecond;
  const isDone = phase === "drawing" && pool.length === 0 && currentPair.length === 0;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden text-[#0f172a] font-sans">
      {/* Blurred, dimmed full-page background image */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80')",
          filter: "blur(6px)",
          opacity: 0.5,
        }}
      />
      <div className="flex-1 min-h-0 overflow-y-auto mx-auto max-w-5xl w-full px-6 py-6 sm:py-8">
        <header className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-linear-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
            Group Matching Generator
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            Create fair, random pairs or matchups for any team activity or event.
          </p>
        </header>

        {phase === "input" && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-white/90 border border-[#e5e7eb] p-5 shadow-sm backdrop-blur">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Add a team
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTeam()}
                  placeholder="Team name"
                  className="flex-1 rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                />
                <button
                  type="button"
                  onClick={addTeam}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 transition-colors shadow-sm"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white/90 border border-[#e5e7eb] p-5 shadow-sm backdrop-blur">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Or paste several (one per line or comma-separated)
              </label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={"Team A\nTeam B\nTeam C"}
                rows={4}
                className="w-full rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
              />
              <button
                type="button"
                onClick={addBulk}
                className="mt-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 font-medium px-4 py-2 transition-colors border border-sky-100"
              >
                Add all
              </button>
            </div>

            {teams.length > 0 && (
              <div className="rounded-2xl bg-white/90 border border-[#e5e7eb] p-5 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">
                    Teams ({teams.length})
                    {teams.length % 2 !== 0 && (
                      <span className="ml-2 text-amber-400">— need even number</span>
                    )}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {teams.map((name) => (
                    <li
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 pl-3 pr-1 py-1.5 text-sm"
                    >
                      <span className="text-emerald-900">{name}</span>
                      <button
                        type="button"
                        onClick={() => removeTeam(name)}
                        className="rounded-full p-0.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100"
                        aria-label={`Remove ${name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={startDrawing}
                  disabled={teams.length < 2 || teams.length % 2 !== 0}
                  className="mt-4 w-full rounded-lg bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
                >
                  Start drawing
                </button>
              </div>
            )}
          </section>
        )}

        {phase === "drawing" && (
          <section className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)] lg:gap-10 lg:items-start">
            <div className="space-y-6 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
               
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-400/70 focus:ring-offset-1"
                >
                  <span className="text-sm leading-none">↺</span>
                  <span>Reset</span>
                </button>
              </div>

              {/* Current pair slot */}
              <div className="rounded-2xl bg-white/90 border border-[#e5e7eb] p-6 min-h-[180px] flex flex-col items-center justify-center shadow-md backdrop-blur">
                {isRolling && (
                  <div className="w-full max-w-sm">
                    <span className="block text-xs uppercase tracking-wider text-slate-500 text-center mb-3">
                      {currentPair.length === 0 ? "Drawing team" : "Drawing opponent"}
                    </span>
                    {(() => {
                      const list = (rollingNames && rollingNames.length > 0 ? rollingNames : pool) || [];
                      if (list.length === 0) {
                        return (
                          <div
                            className="relative rounded-xl bg-slate-50 border border-slate-200 px-3 overflow-hidden"
                            style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
                          >
                            <div
                              className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-y border-emerald-400/80 pointer-events-none"
                              style={{ height: ITEM_HEIGHT }}
                            />
                            <div className="h-full flex items-center justify-center text-sm text-slate-400">
                              —
                            </div>
                          </div>
                        );
                      }

                      const totalHeight = ITEM_HEIGHT * list.length;
                      const extended =
                        list.length > 0 ? [...list, ...list, ...list] : [];
                      const normalizedOffset =
                        totalHeight > 0
                          ? ((scrollOffset % totalHeight) + totalHeight) % totalHeight
                          : 0;
                      const containerHeight = ITEM_HEIGHT * VISIBLE_COUNT;
                      const centerPixel = containerHeight / 2;

                      return (
                        <div
                          className="relative rounded-xl border border-slate-200 px-3 overflow-hidden mb-5"
                          style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
                        >
                          {/* Fixed selection box in the center */}
                          <div
                            className="pointer-events-none absolute left-4 right-4 top-1/2 -translate-y-1/2 border-y border-emerald-400/90 z-10"
                            style={{ height: ITEM_HEIGHT }}
                          />
                          <div
                            className="absolute inset-x-0"
                            style={{
                              transform: `translateY(-${normalizedOffset}px)`,
                              willChange: "transform",
                            }}
                          >
                            {extended.map((name, idx) => {
                              const rowTop = idx * ITEM_HEIGHT - normalizedOffset;
                              const rowBottom = rowTop + ITEM_HEIGHT;
                              const isCenter =
                                rowTop <= centerPixel && rowBottom > centerPixel;
                              return (
                                <div
                                  key={`${idx}-${name}`}
                                  style={{ height: ITEM_HEIGHT }}
                                  className={`flex items-center justify-center text-sm ${
                                    isCenter ? "text-emerald-700 font-semibold" : "text-slate-500"
                                  }`}
                                >
                                  {fixOrdinalDisplay(name)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {currentPair.length === 0 && !isRolling && matches.length === 0 && pool.length > 0 && (
                  <p className="text-slate-500">Draw the first team</p>
                )}
                {currentPair.length === 0 && !isRolling && pool.length === 2 && (
                  <div className="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6 w-full max-w-full min-w-0 mx-auto">
                    <div className="rounded-xl bg-white border border-slate-200 px-4 sm:px-6 py-5 text-center min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
                      <span className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Team 1</span>
                      <span className="text-xl font-semibold text-slate-900 block text-center min-w-0 wrap-break-word">{fixOrdinalDisplay(pool[0])}</span>
                    </div>
                    <span className="text-slate-400 font-medium text-lg shrink-0 self-center">vs</span>
                    <div className="rounded-xl bg-white border border-slate-200 px-4 sm:px-6 py-5 text-center min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
                      <span className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Team 2</span>
                      <span className="text-xl font-semibold text-slate-900 block text-center min-w-0 wrap-break-word">{fixOrdinalDisplay(pool[1])}</span>
                    </div>
                  </div>
                )}
                {(currentPair.length === 1 || currentPair.length === 2) && (
                  <div className="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6 w-full max-w-full min-w-0 mx-auto">
                    <div
                      className={`rounded-xl bg-white border border-emerald-200 px-4 sm:px-6 py-5 text-center min-w-0 flex-1 flex flex-col justify-center overflow-hidden ${justDrew === currentPair[0] ? "ring-2 ring-emerald-500 animate-draw-in" : ""}`}
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Team 1</span>
                      <span className="text-xl font-semibold text-slate-900 block text-center min-w-0 wrap-break-word">{fixOrdinalDisplay(currentPair[0])}</span>
                    </div>
                    <span className="text-slate-400 font-medium text-lg shrink-0 self-center">vs</span>
                    <div
                      className={`rounded-xl bg-white border px-4 sm:px-6 py-5 text-center min-w-0 flex-1 flex flex-col justify-center overflow-hidden ${currentPair.length === 1 ? "border-dashed border-slate-200" : justDrew === currentPair[1] ? "border-emerald-200 ring-2 ring-emerald-500 animate-draw-in" : "border-slate-200"}`}
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-500 block mb-1">Opponent</span>
                      <span className={`block text-xl font-semibold text-center min-w-0 wrap-break-word ${currentPair.length === 1 && !isRolling ? "text-slate-300" : "text-slate-900"}`}>
                        {currentPair.length === 1 ? "—" : fixOrdinalDisplay(currentPair[1])}
                      </span>
                    </div>
                  </div>
                )}
                {currentPair.length === 0 && (matches.length > 0 || pool.length === 0) && !canDraw && (
                  <p className="text-slate-500">
                    {isDone ? "All pairs drawn." : "Draw the next team."}
                  </p>
                )}
              </div>

              {canDraw && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={drawNext}
                    disabled={isRolling}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 text-lg transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#e0f2fe]"
                  >
                    {isRolling
                      ? "Drawing"
                      : pool.length === 2 && currentPair.length === 0
                        ? "Match last 2 teams"
                        : "Draw"}
                  </button>
                </div>
              )}
            </div>

            {/* Right column: matches + static group/generation table stacked vertically */}
            <div className="space-y-4 lg:self-start lg:min-w-[360px] min-w-0">
              <div className="rounded-2xl bg-white/90 border border-[#e5e7eb] overflow-hidden shadow-sm backdrop-blur">
                <div className="px-4 py-3 border-b border-[#e5e7eb] text-sm font-semibold text-slate-700 bg-slate-50">
                  Matches
                </div>
                {matches.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-[#9ca3af]">
                    No matches yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-[#e5e7eb] max-h-[420px] overflow-y-auto">
                    {matches.map(([a, b], i) => (
                      <li
                        key={`${a}-${b}-${i}`}
                        className="flex items-center gap-3 px-4 py-3 text-[#111827]"
                      >
                        <span className="font-medium min-w-0 flex-1 wrap-break-word text-left">
                          {fixOrdinalDisplay(a)}
                        </span>
                        <span className="text-[#9ca3af] shrink-0">vs</span>
                        <span className="font-medium min-w-0 flex-1 wrap-break-word text-right">
                          {fixOrdinalDisplay(b)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>
          </section>
        )}
      </div>
    </div>
  );
}
