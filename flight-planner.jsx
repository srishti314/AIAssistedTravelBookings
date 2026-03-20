import { useState, useRef } from "react";

// ─── Gemini API key injected at build time from GitHub secret ─────────────────
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0A0F1E",
  surface: "#111827",
  card: "#1A2235",
  border: "#1E2D45",
  accent: "#3B82F6",
  accentDim: "#1D4ED8",
  gold: "#F59E0B",
  green: "#10B981",
  text: "#F1F5F9",
  muted: "#64748B",
  subtle: "#94A3B8",
  danger: "#EF4444",
  font: "'Inter', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
};

// ─── Analysis definitions ─────────────────────────────────────────────────────
const ANALYSES = [
  { id:"a", label:"Hidden City & Route Optimizer",  icon:"✈", color:"#3B82F6", desc:"Hidden city tickets, nearby airports, multi-leg combos airlines don't surface" },
  { id:"b", label:"Price Inflation Avoidance",       icon:"🛡", color:"#10B981", desc:"How airlines track searches & exact steps to avoid price inflation" },
  { id:"c", label:"Geo-Pricing Arbitrage",           icon:"🌍", color:"#8B5CF6", desc:"Same ticket priced across countries — find where it's cheapest & how to access it" },
  { id:"d", label:"Optimal Booking Window",          icon:"📅", color:"#F59E0B", desc:"Best days, windows & departure periods based on historical pricing cycles" },
  { id:"e", label:"Fare Class Decoder",              icon:"🔍", color:"#EC4899", desc:"Fare rules, ticket classes & routing logic decoded to find quiet savings" },
  { id:"f", label:"Platform Price Comparison",       icon:"⚖",  color:"#06B6D4", desc:"Airlines vs OTAs vs regional sites — where markups hide & where deals appear" },
  { id:"g", label:"Fare Tracking Strategy",          icon:"📡", color:"#84CC16", desc:"Monitor drops without triggering increases — timing, alerts & behavioral rules" },
];

// ─── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(id, inputs) {
  const ctx = `
ROUTE: ${inputs.origin} → ${inputs.destination} (${inputs.tripType})
DATES: ${inputs.dates} | Flexibility: ${inputs.dateFlexibility || "none stated"}
TRAVELERS: ${inputs.travelers}
TIME PREFS: ${inputs.timePrefs || "any"}
MAX STOPS: ${inputs.maxStops || "any"} | MAX LAYOVER: ${inputs.maxLayover || "any"}
AIRLINE PREFS: ${inputs.airlinePrefs || "none"}
BAGGAGE: ${inputs.baggage || "not specified"}
BUDGET / BEST PRICE SEEN: ${inputs.budget || "not specified"} ${inputs.currency}
USER COUNTRY / IP LOCATION: ${inputs.userCountry || "not specified"}
PREVIOUSLY SEARCHED ON: ${inputs.prevSearches || "none"}
LOYALTY / MILES: ${inputs.miles || "none"}
`;
  const prompts = {
    a: `You are a professional flight pricing analyst. For the route and context below, perform a full Route & Cost Optimization:
${ctx}
1. Identify hidden city ticketing opportunities (explain risks clearly)
2. List nearby alternative departure airports within 100km and their typical price differential
3. List nearby alternative arrival airports within 100km and price differential
4. Suggest multi-leg routing combinations airlines don't surface on standard searches
5. Compare direct vs split routes with estimated price gap
6. Rank the top 3 cheapest legal options with clear explanation
Be specific with realistic pricing logic.`,

    b: `You are a flight pricing surveillance expert. For the route below:
${ctx}
1. List every behavioral trigger that causes price inflation (cookies, fingerprinting, device type, IP, login state, search frequency, time-of-day)
2. Explain the mechanism behind each trigger
3. Give a precise step-by-step search method to avoid ALL triggers
4. Include browser settings, VPN guidance, device recommendations, session hygiene
5. Give a before/after example showing price impact`,

    c: `You are a geo-pricing arbitrage analyst. For the route below:
${ctx}
1. Identify top 5 countries/regions where this ticket is typically priced lowest
2. Explain WHY geo-pricing differs (PPP, local competition, currency, regional demand)
3. For each region, outline the legal method to access those fares
4. Flag restrictions and risks (card billing mismatch, refund complications, fare rule violations)
5. Give expected price delta vs booking from the user's current country`,

    d: `You are an airline pricing historian and demand analyst. For the route below:
${ctx}
1. Identify the cheapest booking days of the week with historical reasoning
2. Identify the ideal booking window for this route type and season
3. Identify the cheapest departure periods (day of week, time of day, season)
4. Explain demand cycles, inventory release schedules, and fare reset patterns
5. Give a week-by-week booking strategy for the next 60 days`,

    e: `You are a fare class and airline pricing rules expert. For the route below:
${ctx}
1. Explain relevant fare buckets (Y, B, M, K, etc.) for this route and what each allows
2. Decode routing logic — how airlines allow/disallow connections to affect pricing
3. Explain change fees, cancellation rules, upgrade eligibility across classes
4. Show how selecting a specific fare class quietly reduces total cost
5. Give 3 concrete examples of fare rule optimization on this route (legal and within airline terms)`,

    f: `You are a platform pricing comparison expert. For the route below:
${ctx}
1. Compare: airline direct website, Google Flights, Kayak, Expedia, Skyscanner, Momondo, and 2–3 lesser-known regional OTAs relevant to this route
2. For each: service fees, markup patterns, hidden discounts, loyalty integration
3. Which platform type typically shows lowest base fares for this route?
4. Flag platforms that add hidden fees at checkout vs. transparent pricing
5. Recommend the optimal platform sequence: where to research vs. where to actually book`,

    g: `You are a fare monitoring strategist. For the route below:
${ctx}
1. Design a fare tracking plan that does NOT trigger price inflation
2. Recommend specific tools/alerts (Google Flights, Hopper, Kayak, Skyscanner) with exact settings
3. Define timing reset rules — when to clear cache, switch devices, reset search context
4. Explain behavioral rules: when to track aggressively vs. back off
5. Give a practical 30-day tracking calendar for this route with weekly action items`,
  };
  return prompts[id];
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle = {
  width:"100%", background:"#0D1526", border:`1px solid ${T.border}`,
  borderRadius:8, padding:"10px 14px", color:T.text, fontSize:14,
  fontFamily:T.font, boxSizing:"border-box", outline:"none",
};
const labelStyle = {
  display:"block", fontSize:12, fontWeight:600, color:T.muted,
  marginBottom:6, letterSpacing:0.5, textTransform:"uppercase",
};
const navBtn = {
  padding:"12px 28px", borderRadius:10, border:"none",
  fontSize:14, fontWeight:600, fontFamily:T.font, transition:"all 0.2s",
};
const ghostBtn = {
  padding:"7px 16px", borderRadius:8, border:`1px solid ${T.border}`,
  background:"transparent", color:T.muted, fontSize:12,
  fontWeight:600, cursor:"pointer", fontFamily:T.font,
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"32px 36px" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:20, fontWeight:700 }}>{title}</div>
        {subtitle && <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>{subtitle}</div>}
        <div style={{ width:40, height:2, background:T.accent, marginTop:12, borderRadius:2 }} />
      </div>
      {children}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 18px", borderRadius:8,
      border:`1px solid ${active ? T.accent : T.border}`,
      background: active ? T.accent+"20" : "transparent",
      color: active ? T.accent : T.muted,
      fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.font,
    }}>{children}</button>
  );
}

function Spinner() {
  return (
    <span style={{
      width:14, height:14, border:"2px solid currentColor",
      borderTopColor:"transparent", borderRadius:"50%",
      display:"inline-block", animation:"spin 0.7s linear infinite",
    }} />
  );
}

// ─── Steps (no API key step anymore) ─────────────────────────────────────────
const STEPS = ["Route", "Flexibility", "Budget & Context", "Analyses", "Results"];

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function FlightPlanner() {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState({
    origin:"", destination:"", tripType:"roundtrip", dates:"",
    travelers:"1 adult", dateFlexibility:"", timePrefs:"",
    maxStops:"", maxLayover:"", airlinePrefs:"", baggage:"",
    budget:"", currency:"USD", userCountry:"", prevSearches:"", miles:"",
  });
  const [selectedAnalyses, setSelectedAnalyses] = useState(ANALYSES.map(a => a.id));
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [activeResult, setActiveResult] = useState(null);
  const [error, setError] = useState("");
  const abortRefs = useRef({});

  const set = key => e => setInputs(prev => ({ ...prev, [key]: e.target.value }));

  function canProceed() {
    if (step === 0) return inputs.origin.trim() && inputs.destination.trim() && inputs.dates.trim();
    if (step === 3) return selectedAnalyses.length > 0;
    return true;
  }

  // ─── Gemini streaming call ──────────────────────────────────────────────────
  async function runAnalysis(analysisId) {
    if (!GEMINI_KEY) {
      setResults(r => ({ ...r, [analysisId]: "Error: API key not configured. Add VITE_GEMINI_API_KEY as a GitHub repo secret." }));
      return;
    }
    setLoading(l => ({ ...l, [analysisId]: true }));
    setResults(r => ({ ...r, [analysisId]: "" }));
    setActiveResult(analysisId);

    const controller = new AbortController();
    abortRefs.current[analysisId] = controller;

    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(analysisId, inputs) }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (delta) setResults(r => ({ ...r, [analysisId]: (r[analysisId] || "") + delta }));
            } catch {}
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setResults(r => ({ ...r, [analysisId]: `Error: ${e.message}` }));
      }
    } finally {
      setLoading(l => ({ ...l, [analysisId]: false }));
    }
  }

  async function runAll() {
    setStep(4);
    setResults({});
    setError("");
    setActiveResult(null);
    for (const id of selectedAnalyses) {
      await runAnalysis(id);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:T.font, color:T.text }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom:`1px solid ${T.border}`, padding:"20px 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background:T.surface,
      }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, letterSpacing:-0.5 }}>✈ AI Flight Planner</div>
          <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>7-lens fare intelligence · Powered by Gemini</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div
                title={s}
                onClick={() => i < step && setStep(i)}
                style={{
                  width:28, height:28, borderRadius:"50%",
                  background: i===step ? T.accent : i<step ? T.green : T.border,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700, cursor:i<step?"pointer":"default",
                  transition:"all 0.2s",
                }}>
                {i < step ? "✓" : i+1}
              </div>
              {i < STEPS.length-1 && (
                <div style={{ width:20, height:1, background:i<step?T.green:T.border }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"40px 24px" }}>

        {/* ── STEP 0: Route ── */}
        {step===0 && (
          <Card title="Route & Travel Basics" subtitle="Tell us where you're going and when.">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Field label="Origin City / Airport *">
                <input style={inputStyle} placeholder="e.g. Mumbai (BOM) or New York" value={inputs.origin} onChange={set("origin")} />
              </Field>
              <Field label="Destination City / Airport *">
                <input style={inputStyle} placeholder="e.g. London (LHR) or Bangkok" value={inputs.destination} onChange={set("destination")} />
              </Field>
            </div>
            <Field label="Trip Type">
              <div style={{ display:"flex", gap:10 }}>
                {[["roundtrip","Round Trip"],["oneway","One Way"],["openjaw","Open Jaw"]].map(([val,lbl])=>(
                  <ToggleBtn key={val} active={inputs.tripType===val} onClick={()=>setInputs(p=>({...p,tripType:val}))}>{lbl}</ToggleBtn>
                ))}
              </div>
            </Field>
            <Field label="Travel Dates / Date Range *">
              <input style={inputStyle} placeholder="e.g. Apr 15–22, 2025 or late April 2025" value={inputs.dates} onChange={set("dates")} />
            </Field>
            <Field label="Number of Travelers">
              <input style={inputStyle} placeholder="e.g. 2 adults, 1 child (age 8)" value={inputs.travelers} onChange={set("travelers")} />
            </Field>
          </Card>
        )}

        {/* ── STEP 1: Flexibility ── */}
        {step===1 && (
          <Card title="Flexibility & Constraints" subtitle="More flexibility = more savings we can find.">
            <Field label="Date Flexibility">
              <input style={inputStyle} placeholder="e.g. ±3 days, any day in April, or fixed" value={inputs.dateFlexibility} onChange={set("dateFlexibility")} />
            </Field>
            <Field label="Departure / Arrival Time Preferences">
              <input style={inputStyle} placeholder="e.g. no red-eyes, morning only, flexible" value={inputs.timePrefs} onChange={set("timePrefs")} />
            </Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Field label="Max Number of Stops">
                <input style={inputStyle} placeholder="e.g. 1, 2, or non-stop only" value={inputs.maxStops} onChange={set("maxStops")} />
              </Field>
              <Field label="Max Layover Duration">
                <input style={inputStyle} placeholder="e.g. 4 hours, overnight OK, any" value={inputs.maxLayover} onChange={set("maxLayover")} />
              </Field>
            </div>
            <Field label="Airline Preferences / Restrictions">
              <input style={inputStyle} placeholder="e.g. prefer Star Alliance, avoid Spirit, any" value={inputs.airlinePrefs} onChange={set("airlinePrefs")} />
            </Field>
            <Field label="Checked Baggage Needs">
              <input style={inputStyle} placeholder="e.g. 1 checked bag 23kg, carry-on only" value={inputs.baggage} onChange={set("baggage")} />
            </Field>
          </Card>
        )}

        {/* ── STEP 2: Budget & Context ── */}
        {step===2 && (
          <Card title="Budget & Booking Context" subtitle="Helps calibrate geo-pricing and platform comparisons.">
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
              <Field label="Target Budget or Best Price Seen">
                <input style={inputStyle} placeholder="e.g. $800, ₹65,000, or unsure" value={inputs.budget} onChange={set("budget")} />
              </Field>
              <Field label="Currency">
                <input style={inputStyle} placeholder="USD, EUR, INR…" value={inputs.currency} onChange={set("currency")} />
              </Field>
            </div>
            <Field label="Your Current Country / Location">
              <input style={inputStyle} placeholder="e.g. India, United States, Germany" value={inputs.userCountry} onChange={set("userCountry")} />
            </Field>
            <Field label="Platforms Already Searched (and when)">
              <input style={inputStyle} placeholder="e.g. Google Flights 3 days ago, Kayak yesterday" value={inputs.prevSearches} onChange={set("prevSearches")} />
            </Field>
            <Field label="Travel Credit Cards / Airline Miles / Loyalty Programs">
              <input style={inputStyle} placeholder="e.g. Chase Sapphire, 40k United miles, none" value={inputs.miles} onChange={set("miles")} />
            </Field>
          </Card>
        )}

        {/* ── STEP 3: Analysis Selection ── */}
        {step===3 && (
          <Card title="Choose Your Analyses" subtitle="Select which of the 7 lenses to run. All selected by default.">
            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <button style={ghostBtn} onClick={()=>setSelectedAnalyses(ANALYSES.map(a=>a.id))}>Select All</button>
              <button style={ghostBtn} onClick={()=>setSelectedAnalyses([])}>Clear All</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {ANALYSES.map(a => {
                const sel = selectedAnalyses.includes(a.id);
                return (
                  <div key={a.id}
                    onClick={()=>setSelectedAnalyses(prev=>sel?prev.filter(x=>x!==a.id):[...prev,a.id])}
                    style={{
                      display:"flex", alignItems:"center", gap:16,
                      padding:"14px 18px", borderRadius:10, cursor:"pointer",
                      border:`1px solid ${sel ? a.color+"60" : T.border}`,
                      background: sel ? a.color+"12" : T.card,
                      transition:"all 0.2s",
                    }}>
                    <div style={{
                      width:36, height:36, borderRadius:8, flexShrink:0,
                      background: sel ? a.color+"30" : T.border+"60",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:16, color: sel ? a.color : T.muted,
                    }}>{a.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:sel?T.text:T.subtle }}>
                        <span style={{ color:sel?a.color:T.muted, marginRight:8, fontFamily:T.mono, fontSize:12 }}>[{a.id.toUpperCase()}]</span>
                        {a.label}
                      </div>
                      <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>{a.desc}</div>
                    </div>
                    <div style={{
                      width:20, height:20, borderRadius:4, flexShrink:0,
                      border:`2px solid ${sel?a.color:T.border}`,
                      background:sel?a.color:"transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:12, color:"#fff",
                    }}>{sel?"✓":""}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── STEP 4: Results ── */}
        {step===4 && (
          <div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:22, fontWeight:700 }}>Analysis Results</div>
              <div style={{ fontSize:14, color:T.muted, marginTop:4 }}>
                {inputs.origin} → {inputs.destination} · {inputs.dates}
              </div>
            </div>

            {/* Tab bar */}
            <div style={{
              display:"flex", gap:6, flexWrap:"wrap", marginBottom:24,
              padding:12, background:T.surface, borderRadius:12,
              border:`1px solid ${T.border}`,
            }}>
              {ANALYSES.filter(a=>selectedAnalyses.includes(a.id)).map(a => {
                const isActive = activeResult===a.id;
                const isLoading = loading[a.id];
                const isDone = results[a.id] && !isLoading;
                return (
                  <button key={a.id} onClick={()=>setActiveResult(a.id)} style={{
                    padding:"8px 14px", borderRadius:8, border:"none", cursor:"pointer",
                    background: isActive ? a.color : "transparent",
                    color: isActive ? "#fff" : isDone ? a.color : T.muted,
                    fontSize:13, fontWeight:600, fontFamily:T.font,
                    display:"flex", alignItems:"center", gap:6,
                    transition:"all 0.2s",
                  }}>
                    {isLoading ? <Spinner /> : a.icon}
                    <span>[{a.id.toUpperCase()}]</span>
                  </button>
                );
              })}
            </div>

            {/* Result panel */}
            {activeResult && (() => {
              const a = ANALYSES.find(x=>x.id===activeResult);
              const text = results[activeResult]||"";
              const isLoading = loading[activeResult];
              const isDone = text && !isLoading;
              return (
                <div style={{ background:T.surface, border:`1px solid ${a.color}30`, borderRadius:12, overflow:"hidden" }}>
                  <div style={{
                    padding:"16px 24px", borderBottom:`1px solid ${T.border}`,
                    display:"flex", alignItems:"center", gap:12,
                    background:a.color+"12",
                  }}>
                    <span style={{ fontSize:20 }}>{a.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, color:a.color }}>{a.label}</div>
                      <div style={{ fontSize:12, color:T.muted }}>{a.desc}</div>
                    </div>
                    {isLoading && <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, color:T.muted, fontSize:12 }}>
                      <Spinner /> Analyzing…
                    </div>}
                    {isDone && <div style={{ marginLeft:"auto", padding:"3px 10px", background:T.green+"20", color:T.green, borderRadius:6, fontSize:11, fontWeight:700 }}>DONE</div>}
                  </div>
                  <div style={{
                    padding:24, fontFamily:T.mono, fontSize:13.5,
                    lineHeight:1.85, color:T.text, whiteSpace:"pre-wrap",
                    maxHeight:520, overflowY:"auto", minHeight:200,
                  }}>
                    {text || (isLoading ? "" : <span style={{ color:T.muted }}>Waiting to start…</span>)}
                    {isLoading && <span style={{ opacity:0.5 }}>▋</span>}
                  </div>
                </div>
              );
            })()}

            {!activeResult && (
              <div style={{ textAlign:"center", padding:"60px 20px", color:T.muted, background:T.surface, borderRadius:12, border:`1px solid ${T.border}` }}>
                Select an analysis tab above to view results.
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop:16, padding:"12px 16px", background:T.danger+"20", border:`1px solid ${T.danger}`, borderRadius:8, color:T.danger, fontSize:13 }}>
            {error}
          </div>
        )}

        {/* ── Nav ── */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:32 }}>
          <button
            onClick={()=>{ setStep(s=>Math.max(0,s-1)); setError(""); }}
            disabled={step===0}
            style={{ ...navBtn, background:"transparent", color:step===0?T.muted:T.subtle, border:`1px solid ${step===0?T.border:T.muted}`, cursor:step===0?"not-allowed":"pointer" }}>
            ← Back
          </button>

          {step < 3 && (
            <button onClick={()=>{ setError(""); setStep(s=>s+1); }} disabled={!canProceed()} style={{
              ...navBtn, background:canProceed()?T.accent:T.border,
              color:canProceed()?"#fff":T.muted, cursor:canProceed()?"pointer":"not-allowed",
            }}>Continue →</button>
          )}

          {step===3 && (
            <button onClick={runAll} disabled={!canProceed()} style={{
              ...navBtn, background:canProceed()?T.gold:T.border,
              color:canProceed()?"#000":T.muted, fontWeight:700, cursor:canProceed()?"pointer":"not-allowed",
            }}>Run {selectedAnalyses.length} Analyses →</button>
          )}

          {step===4 && (
            <button onClick={()=>{ setStep(0); setResults({}); setActiveResult(null); }} style={{
              ...navBtn, background:T.accentDim, color:"#fff", cursor:"pointer",
            }}>New Search</button>
          )}
        </div>
      </div>
    </div>
  );
}
