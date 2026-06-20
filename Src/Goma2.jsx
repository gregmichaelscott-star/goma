import React, { useState, useEffect, useRef, useCallback } from "react";

// ---------- storage helpers (localStorage — for standalone deploy) ----------
const STORE_ENTRIES = "goma:entries";
const STORE_PROGRESS = "goma:program-progress";

const loadLocal = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};

const saveLocal = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
};

// ---------- helpers ----------
const todayKey = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const prettyDate = (key) => {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const pad2 = (n) => String(n).padStart(2, "0");
const fmtClock = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${pad2(m)}:${pad2(s)}`;
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- main component ----------
export default function Goma() {
  const [tab, setTab] = useState("log");
  const [entries, setEntries] = useState(() => loadLocal(STORE_ENTRIES, []));
  const [saveError, setSaveError] = useState(false);

  // form state
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState("3");
  const [exReps, setExReps] = useState("10");
  const [exWeight, setExWeight] = useState("");
  const [exUnit, setExUnit] = useState("lb");

  // program tab state
  const [progress, setProgress] = useState(() => loadLocal(STORE_PROGRESS, {}));
  const [pendingPreset, setPendingPreset] = useState(null);
  const [lastLoggedDay, setLastLoggedDay] = useState(null);

  // persist entries whenever they change
  useEffect(() => {
    const ok = saveLocal(STORE_ENTRIES, entries);
    setSaveError(!ok);
  }, [entries]);

  // persist program progress whenever it changes
  useEffect(() => {
    saveLocal(STORE_PROGRESS, progress);
  }, [progress]);

  const addEntry = () => {
    if (!exName.trim()) return;
    const entry = {
      id: uid(),
      date: todayKey(),
      name: exName.trim(),
      sets: exSets || "0",
      reps: exReps || "0",
      weight: exWeight,
      unit: exUnit,
      ts: Date.now(),
    };
    setEntries((prev) => [entry, ...prev]);
    setExName("");
    setExWeight("");
  };

  const addManyEntries = (exercises, dayId) => {
    const now = Date.now();
    const today = todayKey();
    const newEntries = exercises.map((ex, i) => ({
      id: uid(),
      date: today,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: "",
      unit: "lb",
      ts: now - i,
    }));
    setEntries((prev) => [...newEntries, ...prev]);
    setLastLoggedDay(dayId);
    setTimeout(() => setLastLoggedDay(null), 2500);
  };

  const toggleDayComplete = (dayId) => {
    setProgress((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  const removeEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const today = todayKey();
  const todaysEntries = entries.filter((e) => e.date === today);
  const historyDates = Array.from(
    new Set(entries.filter((e) => e.date !== today).map((e) => e.date))
  ).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div style={styles.app}>
      <style>{css}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.wordmark}>GOMA</h1>
          <span style={styles.dateChip}>{prettyDate(today)}</span>
        </div>
        <nav style={styles.tabs}>
          <button
            onClick={() => setTab("log")}
            style={{
              ...styles.tabBtn,
              ...(tab === "log" ? styles.tabBtnActive : {}),
            }}
          >
            Log
          </button>
          <button
            onClick={() => setTab("program")}
            style={{
              ...styles.tabBtn,
              ...(tab === "program" ? styles.tabBtnActive : {}),
            }}
          >
            Program
          </button>
          <button
            onClick={() => setTab("timer")}
            style={{
              ...styles.tabBtn,
              ...(tab === "timer" ? styles.tabBtnActive : {}),
            }}
          >
            Timer
          </button>
        </nav>
      </header>

      <main style={styles.main}>
        {tab === "log" && (
          <LogTab
            exName={exName}
            setExName={setExName}
            exSets={exSets}
            setExSets={setExSets}
            exReps={exReps}
            setExReps={setExReps}
            exWeight={exWeight}
            setExWeight={setExWeight}
            exUnit={exUnit}
            setExUnit={setExUnit}
            addEntry={addEntry}
            removeEntry={removeEntry}
            todaysEntries={todaysEntries}
            historyDates={historyDates}
            entries={entries}
          />
        )}
        {tab === "program" && (
          <ProgramTab
            progress={progress}
            toggleDayComplete={toggleDayComplete}
            addManyEntries={addManyEntries}
            lastLoggedDay={lastLoggedDay}
            onStartTimer={(presetName) => {
              setPendingPreset(presetName);
              setTab("timer");
            }}
          />
        )}
        {tab === "timer" && (
          <TimerTab
            pendingPreset={pendingPreset}
            onConsumePreset={() => setPendingPreset(null)}
          />
        )}
      </main>

      {saveError && (
        <div style={styles.saveError}>
          Couldn't save — your changes may not persist on this device.
        </div>
      )}
    </div>
  );
}

// ---------- Log tab ----------
function LogTab({
  exName,
  setExName,
  exSets,
  setExSets,
  exReps,
  setExReps,
  exWeight,
  setExWeight,
  exUnit,
  setExUnit,
  addEntry,
  removeEntry,
  todaysEntries,
  historyDates,
  entries,
}) {
  const [openHistory, setOpenHistory] = useState(false);

  return (
    <div>
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Add exercise</h2>
        <input
          style={styles.input}
          placeholder="Exercise name"
          value={exName}
          onChange={(e) => setExName(e.target.value)}
        />
        <div style={styles.row3}>
          <LabeledInput label="Sets" value={exSets} onChange={setExSets} />
          <LabeledInput label="Reps" value={exReps} onChange={setExReps} />
          <div style={styles.weightWrap}>
            <label style={styles.miniLabel}>Weight</label>
            <div style={styles.weightRow}>
              <input
                style={{ ...styles.input, ...styles.weightInput }}
                placeholder="0"
                inputMode="decimal"
                value={exWeight}
                onChange={(e) => setExWeight(e.target.value)}
              />
              <select
                style={styles.unitSelect}
                value={exUnit}
                onChange={(e) => setExUnit(e.target.value)}
              >
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
        </div>
        <button style={styles.primaryBtn} onClick={addEntry}>
          Add to today's session
        </button>
      </section>

      <h2 style={styles.sectionLabel}>Today — {todaysEntries.length} logged</h2>
      {todaysEntries.length === 0 ? (
        <div style={styles.empty}>
          Nothing logged yet today. Add your first set above.
        </div>
      ) : (
        <div style={styles.ticketList}>
          {todaysEntries.map((e) => (
            <Ticket key={e.id} entry={e} onRemove={() => removeEntry(e.id)} />
          ))}
        </div>
      )}

      {historyDates.length > 0 && (
        <div style={styles.historyBlock}>
          <button
            style={styles.historyToggle}
            onClick={() => setOpenHistory((v) => !v)}
          >
            {openHistory ? "Hide" : "Show"} history ({historyDates.length}{" "}
            {historyDates.length === 1 ? "day" : "days"})
            <span style={{ marginLeft: 6 }}>{openHistory ? "▲" : "▼"}</span>
          </button>
          {openHistory &&
            historyDates.map((date) => {
              const dayEntries = entries.filter((e) => e.date === date);
              return (
                <div key={date} style={{ marginTop: 18 }}>
                  <h3 style={styles.historyDate}>{prettyDate(date)}</h3>
                  <div style={styles.ticketList}>
                    {dayEntries.map((e) => (
                      <Ticket
                        key={e.id}
                        entry={e}
                        onRemove={() => removeEntry(e.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange }) {
  return (
    <div style={styles.smallInputWrap}>
      <label style={styles.miniLabel}>{label}</label>
      <input
        style={styles.input}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Ticket({ entry, onRemove }) {
  return (
    <div style={styles.ticket}>
      <div style={styles.ticketPunch} />
      <div style={styles.ticketBody}>
        <div style={styles.ticketName}>{entry.name}</div>
        <div style={styles.ticketMeta}>
          {entry.sets} × {entry.reps}
          {entry.weight ? ` @ ${entry.weight}${entry.unit}` : ""}
        </div>
      </div>
      <button style={styles.ticketRemove} onClick={onRemove} aria-label="Remove">
        ✕
      </button>
    </div>
  );
}

// ---------- Program tab ----------
function ProgramTab({
  progress,
  toggleDayComplete,
  addManyEntries,
  lastLoggedDay,
  onStartTimer,
}) {
  const [openPhase, setOpenPhase] = useState(PROGRAM_PHASES[0].id);

  return (
    <div>
      <div style={styles.programIntro}>
        Sevens-style build: base strength → power &amp; repeat-sprint build → taper.
        Tap a day to see exercises, log them, or jump straight into the matching timer.
      </div>

      {PROGRAM_PHASES.map((phase) => {
        const isOpen = openPhase === phase.id;
        const completedCount = phase.days.filter((d) => progress[d.id]).length;
        return (
          <div key={phase.id} style={styles.phaseBlock}>
            <button
              style={styles.phaseHeader}
              onClick={() => setOpenPhase(isOpen ? null : phase.id)}
            >
              <div>
                <div style={styles.phaseName}>{phase.name}</div>
                <div style={styles.phaseSpan}>{phase.span}</div>
              </div>
              <div style={styles.phaseRight}>
                <span style={styles.phaseProgress}>
                  {completedCount}/{phase.days.length}
                </span>
                <span>{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div style={styles.phaseBody}>
                <p style={styles.phaseBlurb}>{phase.blurb}</p>
                {phase.days.map((day) => (
                  <ProgramDay
                    key={day.id}
                    day={day}
                    complete={!!progress[day.id]}
                    justLogged={lastLoggedDay === day.id}
                    onToggleComplete={() => toggleDayComplete(day.id)}
                    onLog={() => addManyEntries(day.exercises, day.id)}
                    onStartTimer={
                      day.timerPreset
                        ? () => onStartTimer(day.timerPreset)
                        : null
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgramDay({
  day,
  complete,
  justLogged,
  onToggleComplete,
  onLog,
  onStartTimer,
}) {
  return (
    <div style={styles.dayCard}>
      <div style={styles.dayHeader}>
        <button
          style={{
            ...styles.checkbox,
            ...(complete ? styles.checkboxDone : {}),
          }}
          onClick={onToggleComplete}
          aria-label={complete ? "Mark incomplete" : "Mark complete"}
        >
          {complete ? "✓" : ""}
        </button>
        <span
          style={{
            ...styles.dayLabel,
            ...(complete ? styles.dayLabelDone : {}),
          }}
        >
          {day.label}
        </span>
      </div>

      <ul style={styles.exList}>
        {day.exercises.map((ex, i) => (
          <li key={i} style={styles.exItem}>
            <span>{ex.name}</span>
            <span style={styles.exSetsReps}>
              {ex.sets} × {ex.reps}
            </span>
          </li>
        ))}
      </ul>

      <div style={styles.dayActions}>
        <button style={styles.dayActionBtn} onClick={onLog}>
          {justLogged ? "Logged ✓" : "Log this session"}
        </button>
        {onStartTimer && (
          <button style={styles.dayActionBtnAlt} onClick={onStartTimer}>
            Start timer
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Timer tab ----------
function TimerTab({ pendingPreset, onConsumePreset }) {
  const [workSec, setWorkSec] = useState(45);
  const [restSec, setRestSec] = useState(15);
  const [rounds, setRounds] = useState(8);

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("work"); // work | rest
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(workSec);

  const intervalRef = useRef(null);

  // apply a preset handed off from the Program tab
  useEffect(() => {
    if (!pendingPreset) return;
    const p = PRESETS.find((pr) => pr.name === pendingPreset);
    if (p) {
      setRunning(false);
      setPhase("work");
      setRound(1);
      setWorkSec(p.work);
      setRestSec(p.rest);
      setRounds(p.rounds);
      setRemaining(p.work);
    }
    onConsumePreset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPreset]);

  // keep "remaining" in sync if settings change while idle
  useEffect(() => {
    if (!running) {
      setRemaining(phase === "work" ? workSec : restSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workSec, restSec]);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("work");
    setRound(1);
    setRemaining(workSec);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [workSec]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;

        // time's up for this phase — advance
        setPhase((prevPhase) => {
          if (prevPhase === "work") {
            return "rest";
          } else {
            setRound((rd) => {
              const next = rd + 1;
              if (next > rounds) {
                setRunning(false);
              }
              return next;
            });
            return "work";
          }
        });
        return 0; // will be corrected below
      });
      return undefined;
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, rounds]);

  // fix up remaining right after a phase flip (0 -> next duration)
  useEffect(() => {
    if (remaining === 0 && running) {
      setRemaining(phase === "work" ? workSec : restSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const done = round > rounds;
  const ringColor =
    phase === "work" ? colors.amber : colors.coral;
  const total = phase === "work" ? workSec : restSec;
  const pct = Math.max(0, Math.min(1, remaining / Math.max(1, total)));

  return (
    <div>
      <section style={styles.timerCard}>
        <div style={styles.timerStatusRow}>
          <span
            style={{
              ...styles.phasePill,
              background: phase === "work" ? colors.amber : colors.coral,
              color: colors.ink,
            }}
          >
            {done ? "complete" : phase}
          </span>
          <span style={styles.roundText}>
            Round {Math.min(round, rounds)} / {rounds}
          </span>
        </div>

        <div style={styles.ringWrap}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r="98"
              fill="none"
              stroke={colors.line}
              strokeWidth="10"
            />
            <circle
              cx="110"
              cy="110"
              r="98"
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 98}
              strokeDashoffset={2 * Math.PI * 98 * (1 - pct)}
              transform="rotate(-90 110 110)"
              style={{ transition: "stroke-dashoffset 0.95s linear" }}
            />
          </svg>
          <div style={styles.ringCenter}>
            <div style={styles.clockText}>
              {done ? "🏁" : fmtClock(remaining)}
            </div>
          </div>
        </div>

        <div style={styles.timerButtons}>
          {!running ? (
            <button
              style={styles.primaryBtn}
              onClick={() => {
                if (done) reset();
                setRunning(true);
              }}
            >
              {round === 1 && phase === "work" && remaining === workSec
                ? "Start"
                : "Resume"}
            </button>
          ) : (
            <button
              style={styles.secondaryBtn}
              onClick={() => setRunning(false)}
            >
              Pause
            </button>
          )}
          <button style={styles.ghostBtn} onClick={reset}>
            Reset
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Presets</h2>
        <div style={styles.presetGrid}>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              disabled={running}
              style={{ ...styles.presetBtn, opacity: running ? 0.5 : 1 }}
              onClick={() => {
                setWorkSec(p.work);
                setRestSec(p.rest);
                setRounds(p.rounds);
              }}
            >
              <span style={styles.presetName}>{p.name}</span>
              <span style={styles.presetDetail}>
                {p.work}s / {p.rest}s × {p.rounds}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Interval settings</h2>
        <div style={styles.row3}>
          <NumberField
            label="Work (sec)"
            value={workSec}
            onChange={setWorkSec}
            disabled={running}
          />
          <NumberField
            label="Rest (sec)"
            value={restSec}
            onChange={setRestSec}
            disabled={running}
          />
          <NumberField
            label="Rounds"
            value={rounds}
            onChange={setRounds}
            disabled={running}
          />
        </div>
        {running && (
          <div style={styles.lockNote}>Pause to edit settings.</div>
        )}
      </section>
    </div>
  );
}

function NumberField({ label, value, onChange, disabled }) {
  return (
    <div style={styles.smallInputWrap}>
      <label style={styles.miniLabel}>{label}</label>
      <input
        style={{ ...styles.input, opacity: disabled ? 0.5 : 1 }}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9]/g, "");
          onChange(v === "" ? 0 : parseInt(v, 10));
        }}
      />
    </div>
  );
}

// ---------- timer presets ----------
const PRESETS = [
  { name: "Sevens Repeat Sprint", work: 6, rest: 24, rounds: 10 },
  { name: "Sevens Game Sim", work: 30, rest: 25, rounds: 12 },
  { name: "Tabata", work: 20, rest: 10, rounds: 8 },
  { name: "HIIT Classic", work: 40, rest: 20, rounds: 10 },
];

// ---------- periodized program ----------
const PROGRAM_PHASES = [
  {
    id: "base",
    name: "Base",
    span: "Weeks 1–3",
    blurb: "Build the aerobic and strength foundation everything else sits on.",
    days: [
      {
        id: "base-strength-1",
        label: "Day A — Strength Foundation",
        exercises: [
          { name: "Back Squat", sets: "4", reps: "6" },
          { name: "Romanian Deadlift", sets: "3", reps: "8" },
          { name: "Bench Press", sets: "4", reps: "6" },
          { name: "Pallof Press", sets: "3", reps: "10/side" },
        ],
      },
      {
        id: "base-aerobic",
        label: "Day B — Aerobic Base",
        exercises: [
          { name: "Steady-state run (65–75% effort)", sets: "1", reps: "25 min" },
          { name: "Mobility flow", sets: "1", reps: "10 min" },
          { name: "Dead Bug", sets: "3", reps: "12/side" },
        ],
      },
      {
        id: "base-power",
        label: "Day C — Power Foundation",
        exercises: [
          { name: "Box Jump", sets: "3", reps: "5" },
          { name: "Broad Jump", sets: "3", reps: "5" },
          { name: "Trap Bar Deadlift", sets: "4", reps: "5" },
          { name: "Plank", sets: "3", reps: "45 sec" },
        ],
      },
      {
        id: "base-strength-2",
        label: "Day D — Strength Foundation II",
        exercises: [
          { name: "Front Squat", sets: "4", reps: "6" },
          { name: "Pull-Up", sets: "4", reps: "6–8" },
          { name: "Walking Lunge", sets: "3", reps: "10/leg" },
          { name: "Side Plank", sets: "3", reps: "30 sec/side" },
        ],
      },
    ],
  },
  {
    id: "build",
    name: "Build",
    span: "Weeks 4–7",
    blurb: "Shift toward power, repeat-sprint ability, and contact under fatigue.",
    days: [
      {
        id: "build-power",
        label: "Day A — Power & Strength",
        exercises: [
          { name: "Hang Clean", sets: "5", reps: "3" },
          { name: "Jump Squat", sets: "4", reps: "4" },
          { name: "Back Squat (heavy)", sets: "3", reps: "4" },
          { name: "Single-Leg RDL", sets: "3", reps: "8/leg" },
        ],
      },
      {
        id: "build-rsa",
        label: "Day B — Repeat Sprint Ability",
        exercises: [
          { name: "Sprint 40m", sets: "6", reps: "1" },
          { name: "Acceleration drills (10–20m)", sets: "4", reps: "1" },
        ],
        timerPreset: "Sevens Repeat Sprint",
      },
      {
        id: "build-gamesim",
        label: "Day C — Game Sim + Contact",
        exercises: [
          { name: "Game-sim conditioning intervals", sets: "1", reps: "see timer" },
          { name: "Tackle bag drills", sets: "4", reps: "6" },
          { name: "Wrestling-based contact conditioning", sets: "3", reps: "2 min" },
        ],
        timerPreset: "Sevens Game Sim",
      },
      {
        id: "build-cod",
        label: "Day D — Change of Direction",
        exercises: [
          { name: "5-10-5 Shuttle", sets: "5", reps: "1" },
          { name: "T-Drill", sets: "5", reps: "1" },
          { name: "Trap Bar Jump", sets: "4", reps: "3" },
          { name: "Ball skills under fatigue", sets: "1", reps: "10 min" },
        ],
      },
    ],
  },
  {
    id: "taper",
    name: "Taper",
    span: "Final 1–2 weeks",
    blurb: "Cut volume sharply, keep intensity brief and sharp, protect recovery.",
    days: [
      {
        id: "taper-sharpen",
        label: "Day A — Sharpen",
        exercises: [
          { name: "Sprint 30m (max effort, full recovery)", sets: "4", reps: "1" },
          { name: "Light power cleans", sets: "3", reps: "3" },
          { name: "Mobility flow", sets: "1", reps: "10 min" },
        ],
      },
      {
        id: "taper-technical",
        label: "Day B — Light Technical",
        exercises: [
          { name: "Ball skills / passing", sets: "1", reps: "15 min" },
          { name: "Easy aerobic spin or jog", sets: "1", reps: "15 min" },
          { name: "Contrast bath / recovery", sets: "1", reps: "10 min" },
        ],
      },
    ],
  },
];

// ---------- design tokens ----------
const colors = {
  mat: "#2E2C29",
  matDeep: "#262420",
  paper: "#F2EFE9",
  paperDim: "#C9C3B6",
  amber: "#E8B33D",
  sage: "#8C9A88",
  coral: "#D1603D",
  line: "rgba(242,239,233,0.14)",
  ink: "#211F1C",
};

const styles = {
  app: {
    minHeight: "100vh",
    background: colors.mat,
    color: colors.paper,
    fontFamily: "'Inter', sans-serif",
    paddingBottom: 48,
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: colors.matDeep,
    borderBottom: `1px solid ${colors.line}`,
    paddingTop: 18,
  },
  headerInner: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "0 20px",
  },
  wordmark: {
    fontFamily: "'Bebas Neue', 'Inter', sans-serif",
    fontSize: 34,
    letterSpacing: "0.08em",
    margin: 0,
    color: colors.paper,
  },
  dateChip: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: colors.amber,
    letterSpacing: "0.04em",
  },
  tabs: {
    display: "flex",
    gap: 0,
    marginTop: 14,
    padding: "0 20px",
  },
  tabBtn: {
    flex: 1,
    padding: "12px 0",
    background: "transparent",
    border: "none",
    borderBottom: `3px solid transparent`,
    color: colors.paperDim,
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    letterSpacing: "0.06em",
    cursor: "pointer",
  },
  tabBtnActive: {
    color: colors.paper,
    borderBottom: `3px solid ${colors.amber}`,
  },
  main: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "20px 16px 0",
  },
  card: {
    background: colors.matDeep,
    border: `1px solid ${colors.line}`,
    borderRadius: 4,
    padding: 18,
    marginBottom: 22,
  },
  cardTitle: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 20,
    letterSpacing: "0.05em",
    margin: "0 0 14px",
    color: colors.paper,
  },
  input: {
    width: "100%",
    background: colors.mat,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    color: colors.paper,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 15,
    padding: "10px 12px",
    marginBottom: 12,
    boxSizing: "border-box",
  },
  row3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.4fr",
    gap: 10,
  },
  smallInputWrap: { display: "flex", flexDirection: "column" },
  weightWrap: { display: "flex", flexDirection: "column" },
  weightRow: { display: "flex", gap: 6 },
  weightInput: { flex: 1, marginBottom: 12 },
  unitSelect: {
    background: colors.mat,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    color: colors.paper,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    padding: "0 6px",
    marginBottom: 12,
  },
  miniLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: colors.paperDim,
    marginBottom: 6,
  },
  primaryBtn: {
    width: "100%",
    background: colors.amber,
    color: colors.ink,
    border: "none",
    borderRadius: 3,
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 17,
    letterSpacing: "0.05em",
    padding: "13px 0",
    cursor: "pointer",
  },
  secondaryBtn: {
    flex: 1,
    background: colors.coral,
    color: colors.paper,
    border: "none",
    borderRadius: 3,
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 17,
    letterSpacing: "0.05em",
    padding: "13px 0",
    cursor: "pointer",
  },
  ghostBtn: {
    flex: 1,
    background: "transparent",
    color: colors.paperDim,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 17,
    letterSpacing: "0.05em",
    padding: "13px 0",
    cursor: "pointer",
  },
  sectionLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 16,
    letterSpacing: "0.06em",
    color: colors.paperDim,
    margin: "0 0 12px",
  },
  empty: {
    color: colors.paperDim,
    fontSize: 14,
    border: `1px dashed ${colors.line}`,
    borderRadius: 4,
    padding: "18px 14px",
    marginBottom: 10,
  },
  ticketList: { display: "flex", flexDirection: "column", gap: 8 },
  ticket: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    background: colors.matDeep,
    border: `1px dashed ${colors.line}`,
    borderRadius: 3,
    padding: "12px 14px",
    overflow: "hidden",
  },
  ticketPunch: {
    position: "absolute",
    left: -7,
    top: "50%",
    transform: "translateY(-50%)",
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: colors.mat,
    border: `1px solid ${colors.line}`,
  },
  ticketBody: { flex: 1, paddingLeft: 8 },
  ticketName: {
    fontSize: 15,
    fontWeight: 600,
    color: colors.paper,
  },
  ticketMeta: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    color: colors.amber,
    marginTop: 2,
  },
  ticketRemove: {
    background: "transparent",
    border: "none",
    color: colors.paperDim,
    fontSize: 14,
    cursor: "pointer",
    padding: 6,
  },
  historyBlock: { marginTop: 28 },
  historyToggle: {
    width: "100%",
    background: "transparent",
    border: `1px solid ${colors.line}`,
    borderRadius: 4,
    color: colors.paperDim,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    padding: "10px 0",
    cursor: "pointer",
  },
  historyDate: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 15,
    letterSpacing: "0.05em",
    color: colors.sage,
    margin: "0 0 8px",
  },
  timerCard: {
    background: colors.matDeep,
    border: `1px solid ${colors.line}`,
    borderRadius: 4,
    padding: 22,
    marginBottom: 22,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  timerStatusRow: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  phasePill: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 13,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: 20,
  },
  roundText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    color: colors.paperDim,
  },
  ringWrap: {
    position: "relative",
    width: 220,
    height: 220,
    margin: "10px 0 18px",
  },
  ringCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  clockText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 44,
    color: colors.paper,
    fontWeight: 700,
  },
  timerButtons: { display: "flex", gap: 10, width: "100%" },
  lockNote: {
    marginTop: 4,
    fontSize: 12,
    color: colors.paperDim,
    fontStyle: "italic",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  presetBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    background: colors.mat,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
  },
  presetName: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 14,
    letterSpacing: "0.03em",
    color: colors.paper,
  },
  presetDetail: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: colors.amber,
  },
  programIntro: {
    fontSize: 13,
    color: colors.paperDim,
    lineHeight: 1.5,
    marginBottom: 18,
  },
  phaseBlock: {
    border: `1px solid ${colors.line}`,
    borderRadius: 4,
    marginBottom: 14,
    overflow: "hidden",
  },
  phaseHeader: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: colors.matDeep,
    border: "none",
    padding: "14px 16px",
    cursor: "pointer",
    textAlign: "left",
  },
  phaseName: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 20,
    letterSpacing: "0.05em",
    color: colors.paper,
  },
  phaseSpan: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: colors.sage,
    marginTop: 2,
  },
  phaseRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: colors.paperDim,
  },
  phaseProgress: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: colors.amber,
  },
  phaseBody: {
    padding: "0 14px 14px",
  },
  phaseBlurb: {
    fontSize: 13,
    color: colors.paperDim,
    lineHeight: 1.5,
    margin: "10px 0 14px",
  },
  dayCard: {
    background: colors.mat,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    padding: 14,
    marginBottom: 10,
  },
  dayHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    borderRadius: "50%",
    border: `1px solid ${colors.paperDim}`,
    background: "transparent",
    color: colors.ink,
    fontSize: 13,
    lineHeight: "20px",
    cursor: "pointer",
    padding: 0,
  },
  checkboxDone: {
    background: colors.sage,
    border: `1px solid ${colors.sage}`,
    color: colors.ink,
  },
  dayLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 16,
    letterSpacing: "0.03em",
    color: colors.paper,
  },
  dayLabelDone: {
    color: colors.sage,
  },
  exList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  exItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13.5,
    padding: "5px 0",
    borderBottom: `1px solid ${colors.line}`,
  },
  exSetsReps: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    color: colors.amber,
  },
  dayActions: {
    display: "flex",
    gap: 8,
    marginTop: 12,
  },
  dayActionBtn: {
    flex: 1,
    background: colors.amber,
    color: colors.ink,
    border: "none",
    borderRadius: 3,
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 14,
    letterSpacing: "0.04em",
    padding: "9px 0",
    cursor: "pointer",
  },
  dayActionBtnAlt: {
    flex: 1,
    background: "transparent",
    color: colors.paper,
    border: `1px solid ${colors.paperDim}`,
    borderRadius: 3,
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 14,
    letterSpacing: "0.04em",
    padding: "9px 0",
    cursor: "pointer",
  },
  saveError: {
    position: "fixed",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    background: colors.coral,
    color: colors.paper,
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 4,
  },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
* { box-sizing: border-box; }
input:focus, select:focus, button:focus-visible {
  outline: 2px solid ${colors.amber};
  outline-offset: 1px;
}
button { transition: opacity 0.15s ease; }
button:hover { opacity: 0.88; }
::placeholder { color: ${colors.paperDim}; opacity: 0.6; }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
`;
