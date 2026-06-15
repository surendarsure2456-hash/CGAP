import { useState, useEffect, useRef } from "react";

// ============================================================
// 🔥 FIREBASE CONFIG — paste your config here to go live
// ============================================================
const FIREBASE_CONFIG = null;
// Example:
// const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "your-app.firebaseapp.com",
//   projectId: "your-project-id",
// };

// ============================================================
// Firebase dynamic loader
// ============================================================
let _db = null;
let _addDoc = null;
let _collection = null;
let _getDocs = null;
let _query = null;
let _orderBy = null;
let _deleteDoc = null;
let _doc = null;
let firebaseReady = false;

async function initFirebase() {
  if (!FIREBASE_CONFIG || firebaseReady) return firebaseReady;
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js");
    const fb = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
    const app = initializeApp(FIREBASE_CONFIG);
    _db = fb.getFirestore(app);
    _addDoc = fb.addDoc;
    _collection = fb.collection;
    _getDocs = fb.getDocs;
    _query = fb.query;
    _orderBy = fb.orderBy;
    _deleteDoc = fb.deleteDoc;
    _doc = fb.doc;
    firebaseReady = true;
    return true;
  } catch (e) {
    console.warn("Firebase init failed, using localStorage fallback", e);
    return false;
  }
}

// ============================================================
// Storage abstraction (Firebase or localStorage)
// ============================================================
const Storage = {
  async save(record) {
    const ready = await initFirebase();
    if (ready && _db) {
      const ref = await _addDoc(_collection(_db, "cgpa_records"), record);
      return ref.id;
    } else {
      const data = JSON.parse(localStorage.getItem("cgpa_records") || "[]");
      const id = "local_" + Date.now();
      data.unshift({ ...record, id });
      localStorage.setItem("cgpa_records", JSON.stringify(data));
      return id;
    }
  },
  async fetchAll() {
    const ready = await initFirebase();
    if (ready && _db) {
      const snap = await _getDocs(_query(_collection(_db, "cgpa_records"), _orderBy("savedAt", "desc")));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      return JSON.parse(localStorage.getItem("cgpa_records") || "[]");
    }
  },
  async delete(id) {
    const ready = await initFirebase();
    if (ready && _db) {
      await _deleteDoc(_doc(_db, "cgpa_records", id));
    } else {
      const data = JSON.parse(localStorage.getItem("cgpa_records") || "[]");
      localStorage.setItem("cgpa_records", JSON.stringify(data.filter(r => r.id !== id)));
    }
  }
};

// ============================================================
// Grade helpers
// ============================================================
function gradeFromMarks(marks) {
  if (marks >= 90) return { letter: "O", gp: 10 };
  if (marks >= 80) return { letter: "A+", gp: 9 };
  if (marks >= 70) return { letter: "A", gp: 8 };
  if (marks >= 60) return { letter: "B+", gp: 7 };
  if (marks >= 50) return { letter: "B", gp: 6 };
  if (marks >= 40) return { letter: "C", gp: 5 };
  return { letter: "F", gp: 0 };
}

function calcCGPA(subjects) {
  let totalPoints = 0, totalCredits = 0;
  for (const s of subjects) {
    const gp = parseFloat(s.marks) / 10;
    totalPoints += gp * parseFloat(s.credits);
    totalCredits += parseFloat(s.credits);
  }
  return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

function cgpaColor(cgpa) {
  if (cgpa >= 9) return "#00e5a0";
  if (cgpa >= 7.5) return "#3dd6f5";
  if (cgpa >= 6) return "#f5c842";
  if (cgpa >= 5) return "#ff9f43";
  return "#ff6b6b";
}

// ============================================================
// Mini Bar Chart
// ============================================================
function BarChart({ subjects }) {
  if (!subjects || subjects.length === 0) return null;
  const max = 100;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, padding: "0 4px" }}>
      {subjects.map((s, i) => {
        const pct = (parseFloat(s.marks) / max) * 100;
        const { letter } = gradeFromMarks(parseFloat(s.marks));
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, color: "#aaa", fontFamily: "monospace" }}>{letter}</span>
            <div style={{
              width: "100%", background: cgpaColor(parseFloat(s.marks) / 10),
              height: `${pct}%`, borderRadius: "3px 3px 0 0",
              transition: "height 0.5s ease", minHeight: 4,
              boxShadow: `0 0 8px ${cgpaColor(parseFloat(s.marks) / 10)}88`
            }} />
            <span style={{ fontSize: 8, color: "#666", maxWidth: 28, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {s.name || `S${i + 1}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Circular CGPA Ring
// ============================================================
function CGPARing({ value, size = 120 }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / 10, 1);
  const offset = circ - pct * circ;
  const color = cgpaColor(value);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 10px ${color}66)` }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1e1e2e" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
      <text x="50" y="46" textAnchor="middle" fill={color} fontSize="18" fontWeight="700" fontFamily="'Courier New', monospace">
        {value.toFixed(2)}
      </text>
      <text x="50" y="60" textAnchor="middle" fill="#666" fontSize="8" fontFamily="sans-serif" letterSpacing="2">
        CGPA
      </text>
    </svg>
  );
}

// ============================================================
// Toast
// ============================================================
function Toast({ msg, type }) {
  if (!msg) return null;
  const bg = type === "error" ? "#ff6b6b22" : "#00e5a022";
  const border = type === "error" ? "#ff6b6b" : "#00e5a0";
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: bg, border: `1px solid ${border}`, color: border,
      padding: "10px 22px", borderRadius: 8, fontSize: 13, fontFamily: "monospace",
      zIndex: 9999, animation: "fadeIn 0.3s ease", letterSpacing: 1
    }}>
      {msg}
    </div>
  );
}

// ============================================================
// Main App
// ============================================================
export default function CGPAApp() {
  const [tab, setTab] = useState("calculator");
  const [semName, setSemName] = useState("");
  const [subjects, setSubjects] = useState([{ name: "", marks: "", credits: "" }]);
  const [cgpa, setCgpa] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "success" });
  const [darkMode] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "success" }), 2800);
  };

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const records = await Storage.fetchAll();
      setHistory(records);
    } catch (e) {
      showToast("Failed to load history", "error");
    }
    setLoading(false);
  };

  const addSubjectRow = () => {
    setSubjects([...subjects, { name: "", marks: "", credits: "" }]);
  };

  const removeSubjectRow = (i) => {
    const updated = subjects.filter((_, idx) => idx !== i);
    setSubjects(updated.length ? updated : [{ name: "", marks: "", credits: "" }]);
    setCgpa(null);
  };

  const updateSubject = (i, field, val) => {
    const updated = [...subjects];
    updated[i][field] = val;
    setSubjects(updated);
    setCgpa(null);
  };

  const handleCalculate = () => {
    for (const s of subjects) {
      if (!s.marks || !s.credits) { showToast("Fill all marks & credits", "error"); return; }
      if (parseFloat(s.marks) < 0 || parseFloat(s.marks) > 100) { showToast("Marks must be 0–100", "error"); return; }
      if (parseFloat(s.credits) <= 0) { showToast("Credits must be > 0", "error"); return; }
    }
    const result = calcCGPA(subjects);
    setCgpa(result);
  };

  const handleSave = async () => {
    if (cgpa === null) { showToast("Calculate first!", "error"); return; }
    if (!semName.trim()) { showToast("Enter semester name", "error"); return; }
    setLoading(true);
    try {
      await Storage.save({
        semester: semName.trim(),
        subjects,
        cgpa,
        savedAt: new Date().toISOString(),
        totalCredits: subjects.reduce((a, s) => a + parseFloat(s.credits || 0), 0)
      });
      showToast(`Saved "${semName}" ✓`);
      setSemName("");
      setSubjects([{ name: "", marks: "", credits: "" }]);
      setCgpa(null);
    } catch (e) {
      showToast("Save failed", "error");
    }
    setLoading(false);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await Storage.delete(id);
    setHistory(h => h.filter(r => r.id !== id));
    showToast("Deleted");
  };

  const overallCGPA = history.length
    ? (history.reduce((a, r) => a + r.cgpa, 0) / history.length).toFixed(2)
    : null;

  // ============ STYLES ============
  const C = {
    bg: "#0a0a12",
    surface: "#11111e",
    card: "#16162a",
    border: "#2a2a45",
    text: "#e8e8f0",
    muted: "#666688",
    accent: "#00e5a0",
    accent2: "#3dd6f5",
  };

  const inputStyle = {
    background: "#0d0d1a",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: "9px 12px",
    fontSize: 13,
    fontFamily: "'Courier New', monospace",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
    border: "none",
    borderRadius: 8,
    color: "#050510",
    padding: "11px 20px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    letterSpacing: 1,
    transition: "opacity 0.2s, transform 0.1s",
  };

  const btnGhost = {
    background: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.muted,
    padding: "9px 16px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    letterSpacing: 1,
    transition: "border-color 0.2s, color 0.2s",
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Courier New', monospace", color: C.text }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) translateX(-50%) } to { opacity:1; transform:translateY(0) translateX(-50%) } }
        @keyframes slideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        input:focus { border-color: #00e5a0 !important; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0a12; } ::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 2px; }
        .row-anim { animation: slideIn 0.25s ease; }
        .tab-btn { transition: all 0.2s; }
        .tab-btn:hover { color: #e8e8f0 !important; }
        .subject-row:hover { border-color: #2a2a55 !important; }
        .hist-card:hover { border-color: #2a2a55 !important; background: #18182e !important; }
        .del-btn:hover { color: #ff6b6b !important; border-color: #ff6b6b44 !important; }
        .add-btn:hover { border-color: #00e5a0 !important; color: #00e5a0 !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⬡</span>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: C.accent }}>CGPA</span>
            <span style={{ color: C.muted, fontSize: 11, letterSpacing: 3, marginTop: 1 }}>CALCULATOR</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["calculator", "history"].map(t => (
              <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{
                background: tab === t ? `${C.accent}18` : "transparent",
                border: "none", borderRadius: 6,
                color: tab === t ? C.accent : C.muted,
                padding: "6px 14px", fontSize: 11, cursor: "pointer",
                letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Courier New', monospace",
                fontWeight: tab === t ? 700 : 400,
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* ========== CALCULATOR TAB ========== */}
        {tab === "calculator" && (
          <div>
            {/* Semester input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, color: C.muted, letterSpacing: 2, display: "block", marginBottom: 6 }}>SEMESTER NAME</label>
              <input style={inputStyle} placeholder="e.g. Semester 3 — 2024" value={semName}
                onChange={e => setSemName(e.target.value)} />
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 36px", gap: 8, marginBottom: 6, padding: "0 2px" }}>
              {["SUBJECT", "MARKS /100", "CREDITS", ""].map((h, i) => (
                <span key={i} style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5 }}>{h}</span>
              ))}
            </div>

            {/* Subject rows */}
            {subjects.map((s, i) => (
              <div key={i} className="subject-row row-anim" style={{
                display: "grid", gridTemplateColumns: "1fr 90px 80px 36px",
                gap: 8, marginBottom: 8, alignItems: "center",
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: 10, transition: "border-color 0.2s"
              }}>
                <input style={{ ...inputStyle, background: "transparent", border: "none", padding: "2px 4px" }}
                  placeholder={`Subject ${i + 1}`} value={s.name}
                  onChange={e => updateSubject(i, "name", e.target.value)} />
                <input style={{ ...inputStyle, background: "transparent", border: "none", padding: "2px 4px", textAlign: "center" }}
                  type="number" min="0" max="100" placeholder="—"
                  value={s.marks} onChange={e => updateSubject(i, "marks", e.target.value)} />
                <input style={{ ...inputStyle, background: "transparent", border: "none", padding: "2px 4px", textAlign: "center" }}
                  type="number" min="1" max="10" placeholder="—"
                  value={s.credits} onChange={e => updateSubject(i, "credits", e.target.value)} />
                <button onClick={() => removeSubjectRow(i)} className="del-btn" style={{
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
                  color: C.muted, cursor: "pointer", fontSize: 14, padding: "2px 0",
                  width: 32, height: 32, transition: "all 0.2s"
                }}>×</button>
              </div>
            ))}

            {/* Grade preview strip */}
            {subjects.some(s => s.marks) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {subjects.map((s, i) => {
                  if (!s.marks) return null;
                  const { letter, gp } = gradeFromMarks(parseFloat(s.marks));
                  return (
                    <div key={i} style={{
                      background: `${cgpaColor(gp)}18`, border: `1px solid ${cgpaColor(gp)}44`,
                      borderRadius: 6, padding: "3px 8px", fontSize: 10,
                      color: cgpaColor(gp), letterSpacing: 1
                    }}>
                      {s.name || `S${i + 1}`} · <strong>{letter}</strong> · {gp.toFixed(1)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add row + Calculate */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button className="add-btn" onClick={addSubjectRow} style={{ ...btnGhost, flex: 1 }}>
                + ADD SUBJECT
              </button>
              <button onClick={handleCalculate} style={{ ...btnPrimary, flex: 1 }}>
                CALCULATE
              </button>
            </div>

            {/* Result card */}
            {cgpa !== null && (
              <div className="row-anim" style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 24, marginBottom: 20
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <CGPARing value={cgpa} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>RESULT BREAKDOWN</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: C.muted }}>Total Credits</span>
                        <span>{subjects.reduce((a, s) => a + parseFloat(s.credits || 0), 0)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: C.muted }}>Subjects</span>
                        <span>{subjects.length}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: C.muted }}>Classification</span>
                        <span style={{ color: cgpaColor(cgpa) }}>
                          {cgpa >= 9 ? "Outstanding" : cgpa >= 7.5 ? "Distinction" : cgpa >= 6 ? "First Class" : cgpa >= 5 ? "Pass" : "Fail"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20 }}>
                  <BarChart subjects={subjects} />
                </div>
                <button onClick={handleSave} disabled={loading} style={{ ...btnPrimary, width: "100%", marginTop: 16, opacity: loading ? 0.6 : 1 }}>
                  {loading ? "SAVING..." : "SAVE TO DATABASE"}
                </button>
              </div>
            )}

            {/* Formula note */}
            <div style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}22`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>FORMULA</div>
              <div style={{ fontSize: 11, color: C.accent, letterSpacing: 0.5 }}>
                GP = Marks ÷ 10 &nbsp;·&nbsp; CGPA = Σ(GP × Credits) ÷ Σ Credits
              </div>
            </div>
          </div>
        )}

        {/* ========== HISTORY TAB ========== */}
        {tab === "history" && (
          <div>
            {/* Overall CGPA banner */}
            {overallCGPA && (
              <div className="row-anim" style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 20, marginBottom: 20,
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>CUMULATIVE CGPA</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: cgpaColor(parseFloat(overallCGPA)) }}>
                    {overallCGPA}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>across {history.length} semester{history.length > 1 ? "s" : ""}</div>
                </div>
                <CGPARing value={parseFloat(overallCGPA)} size={90} />
              </div>
            )}

            {loading && (
              <div style={{ textAlign: "center", color: C.muted, padding: 40, fontSize: 12, letterSpacing: 2 }}>
                LOADING...
              </div>
            )}

            {!loading && history.length === 0 && (
              <div style={{
                textAlign: "center", padding: 60, color: C.muted, fontSize: 12, letterSpacing: 2
              }}>
                NO RECORDS YET<br />
                <span style={{ fontSize: 10, opacity: 0.5 }}>calculate & save a semester first</span>
              </div>
            )}

            {history.map((record, idx) => (
              <div key={record.id} className="hist-card row-anim"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, marginBottom: 12, cursor: "pointer",
                  transition: "all 0.2s", overflow: "hidden"
                }}>
                {/* Card header */}
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: `${cgpaColor(record.cgpa)}18`, border: `1px solid ${cgpaColor(record.cgpa)}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: cgpaColor(record.cgpa)
                    }}>
                      {record.cgpa.toFixed(1)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{record.semester}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {record.subjects?.length} subjects · {record.totalCredits} credits · {new Date(record.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", align: "center", gap: 8 }}>
                    <button className="del-btn" onClick={(e) => handleDelete(record.id, e)} style={{
                      ...btnGhost, padding: "4px 10px", fontSize: 11
                    }}>DEL</button>
                    <span style={{ color: C.muted, fontSize: 14, marginLeft: 4 }}>
                      {expandedId === record.id ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === record.id && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
                    <div style={{ marginTop: 12 }}>
                      <BarChart subjects={record.subjects} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {record.subjects?.map((s, i) => {
                        const { letter, gp } = gradeFromMarks(parseFloat(s.marks));
                        return (
                          <div key={i} style={{
                            display: "flex", justifyContent: "space-between",
                            padding: "6px 0", borderBottom: `1px solid ${C.border}33`,
                            fontSize: 11
                          }}>
                            <span style={{ color: C.muted }}>{s.name || `Subject ${i + 1}`}</span>
                            <span>
                              <span style={{ color: C.muted }}>{s.marks}/100 · </span>
                              <span style={{ color: cgpaColor(gp) }}>{letter}</span>
                              <span style={{ color: C.muted }}> · {s.credits}cr</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {history.length > 0 && (
              <button onClick={loadHistory} style={{ ...btnGhost, width: "100%", marginTop: 8 }}>
                ↻ REFRESH
              </button>
            )}
          </div>
        )}
      </div>

      <Toast msg={toast.msg} type={toast.type} />
    </div>
  );
}
