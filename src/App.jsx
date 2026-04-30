import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

/* ─── Google Fonts ─── */
(() => {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
})();

/* ─── Global CSS ─── */
(() => {
  const s = document.createElement("style");
  s.textContent = `
*{box-sizing:border-box;}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.fu{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}
.fi{animation:fadeIn .4s ease both}
.si{animation:slideIn .3s ease both}
.card-h{transition:box-shadow .2s,transform .2s}
.card-h:hover{box-shadow:0 8px 32px rgba(14,165,233,.12);transform:translateY(-2px)}
.tb{transition:all .18s ease;cursor:pointer}
.tb:hover{background:rgba(14,165,233,.08)!important}
.pill{transition:all .15s ease;cursor:pointer}
.pill:hover{transform:scale(1.03)}
.pbtn{transition:all .18s ease;cursor:pointer}
.pbtn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(14,165,233,.28)}
.pbtn:active{transform:translateY(0)}
.sbtn{transition:all .15s ease;cursor:pointer}
.sbtn:hover{background:rgba(14,165,233,.06)!important}
.tog{transition:background .2s;cursor:pointer}
.spin{animation:spin .8s linear infinite}
.pulse-txt{animation:pulse 1.5s ease infinite}
.blink{animation:blink 1s step-end infinite}
input:focus,select:focus,textarea:focus{outline:none;border-color:#0ea5e9!important}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(14,165,233,.25);border-radius:10px}
.chat-bubble{line-height:1.65;white-space:pre-wrap;word-break:break-word}
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════════════════ */
const T = {
  bg:"#eef5ff", surface:"#ffffff", surfB:"#f5faff",
  border:"rgba(14,165,233,.14)", borderM:"rgba(14,165,233,.35)",
  blue:"#0ea5e9", blueD:"#0369a1", blueL:"#e0f2fe",
  text:"#0b1929", textS:"#3d5a7a", textT:"#7aa0bc",
  ok:"#10b981", warn:"#f59e0b", danger:"#ef4444", purple:"#8b5cf6",
  font:"'DM Sans',sans-serif", mono:"'DM Mono',monospace",
};

/* ══════════════════════════════════════════════════
   AI API HELPER — Groq (streaming)
══════════════════════════════════════════════════ */
// Auto-detect: pakai proxy path di production (Vercel/Netlify), langsung di dev
const GROQ_ENDPOINT = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "https://api.groq.com/openai/v1/chat/completions"
  : "/api/groq/openai/v1/chat/completions";

async function aiChat(apiKey, messages, onChunk) {
  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
      stream: true,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq error: ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value);
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const j = JSON.parse(data);
        const t = j.choices?.[0]?.delta?.content || "";
        full += t;
        onChunk?.(full);
      } catch {}
    }
  }
  return full;
}

/* ══════════════════════════════════════════════════
   STAT / MATH HELPERS
══════════════════════════════════════════════════ */
const PARAMS = {
  Hb:   {label:"Hemoglobin (Hb)",  unit:"g/dL",    refLow:12,  refHigh:17.5, trim:.20, tea:1.5},
  MCV:  {label:"MCV",              unit:"fL",      refLow:80,  refHigh:100,  trim:.15, tea:2.5},
  PLT:  {label:"Trombosit (PLT)", unit:"×10³/µL", refLow:150, refHigh:400,  trim:.25, tea:9.0},
  WBC:  {label:"Leukosit (WBC)",  unit:"×10³/µL", refLow:4,   refHigh:11,   trim:.25, tea:9.0},
  MCH:  {label:"MCH",             unit:"pg",      refLow:27,  refHigh:33,   trim:.15, tea:2.5},
  MCHC: {label:"MCHC",            unit:"g/dL",    refLow:32,  refHigh:36,   trim:.15, tea:2.5},
  RBC:  {label:"Eritrosit (RBC)", unit:"×10⁶/µL", refLow:3.8, refHigh:6.0,  trim:.20, tea:2.5},
};
const METHODS = {
  MA:     {label:"Moving Average",  short:"MA",    color:"#0ea5e9", dash:"none"},
  EWMA:   {label:"EWMA (λ=0.2)",    short:"EWMA",  color:"#10b981", dash:"5 3"},
  TRIM:   {label:"Trimmed Mean",    short:"Trim",  color:"#f59e0b", dash:"3 3"},
  MEDIAN: {label:"Median / AoN",   short:"Med",   color:"#8b5cf6", dash:"8 3"},
};

const avg  = a => a.reduce((s,v)=>s+v,0)/a.length;
const std  = a => { const m=avg(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };
const med  = a => { const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };

const calcMA     = (v,n)=>v.map((_,i)=>i<n-1?null:+avg(v.slice(i-n+1,i+1)).toFixed(3));
const calcEWMA   = (v,l=.2)=>{ let e=v[0]; return v.map(x=>+(e=l*x+(1-l)*e).toFixed(3)); };
const calcTrim   = (v,n,f)=>v.map((_,i)=>{ if(i<n-1)return null; const s=[...v.slice(i-n+1,i+1)].sort((a,b)=>a-b),k=Math.floor(s.length*f),t=s.slice(k,s.length-k); return +avg(t).toFixed(3); });
const calcMed    = (v,n)=>v.map((_,i)=>i<n-1?null:+med(v.slice(i-n+1,i+1)).toFixed(3));
const getLimits  = (v,mult)=>{ const vals=v.filter(x=>x!==null),m=avg(vals),s=std(vals); return {target:m,ucl:m+mult*s,lcl:m-mult*s}; };
const getSigma   = (tea,bias,cv)=>(tea-Math.abs(bias))/cv;
const sigmaZone  = s=>s>=6?{label:"World Class",color:T.ok}:s>=4?{label:"Good",color:T.blue}:s>=3?{label:"Marginal",color:T.warn}:{label:"Poor",color:T.danger};

function genDemo(param,n=160){
  const cfg=PARAMS[param],mid=(cfg.refLow+cfg.refHigh)/2,span=(cfg.refHigh-cfg.refLow)*.55;
  return Array.from({length:n},(_,i)=>+Math.max(cfg.refLow*.4,mid+(i>=100?(cfg.refHigh-mid)*.3:0)+(Math.random()-.5)*span+(Math.random()-.5)*span*.2).toFixed(2));
}
function parseCSV(txt){
  const lines=txt.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return null;
  const hdr=lines[0].split(/[,;\t]/).map(h=>h.trim());
  const rows=lines.slice(1).map(l=>{const c=l.split(/[,;\t]/),o={};hdr.forEach((h,i)=>o[h]=c[i]?.trim());return o;});
  return{hdr,rows};
}

/* ══════════════════════════════════════════════════
   BUILD QC CONTEXT STRING (for AI prompts)
══════════════════════════════════════════════════ */
function buildContext(param, stats, limits, violations, selMethods, blockSize, useAoN, mult) {
  if (!stats) return "Belum ada data QC yang dianalisis.";
  const cfg = PARAMS[param];
  let ctx = `KONTEKS DATA QC — PasienQuC\n`;
  ctx += `Parameter: ${cfg.label} (${cfg.unit})\n`;
  ctx += `N data: ${stats.n} | Block size: ${blockSize} | AoN filter: ${useAoN?"Ya":"Tidak"} | Limit: ±${mult}SD\n`;
  ctx += `Ref range: ${cfg.refLow}–${cfg.refHigh} ${cfg.unit}\n\n`;
  ctx += `STATISTIK:\n`;
  ctx += `Mean: ${stats.mean.toFixed(3)} | SD: ${stats.sd.toFixed(3)} | CV%: ${stats.cv.toFixed(2)}% | Median: ${stats.median.toFixed(3)}\n\n`;
  ctx += `CONTROL LIMITS & VIOLATIONS:\n`;
  selMethods.forEach(m => {
    if (!limits?.[m]) return;
    const v = violations?.[m]?.length ?? 0;
    const pct = stats.n ? (v/stats.n*100).toFixed(1) : 0;
    ctx += `${METHODS[m].label}: Target=${limits[m].target.toFixed(3)} UCL=${limits[m].ucl.toFixed(3)} LCL=${limits[m].lcl.toFixed(3)} Violations=${v} (${pct}%)\n`;
  });
  return ctx;
}

/* ══════════════════════════════════════════════════
   SHARED UI PRIMITIVES
══════════════════════════════════════════════════ */
const cardStyle = {background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:20,boxShadow:"0 2px 14px rgba(14,165,233,.05)"};
const lblStyle  = {fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:8};
const hintStyle = {fontSize:10,color:T.textT,fontFamily:T.mono,marginTop:4};
const selStyle  = {width:"100%",background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font};
const inpStyle  = {width:"100%",background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:14,fontFamily:T.mono};
const btnP      = {padding:"10px 22px",background:T.blue,border:"none",borderRadius:9,color:"#fff",fontSize:13,fontFamily:T.font,fontWeight:600};
const btnS      = {padding:"10px 22px",background:"transparent",border:`1.5px solid ${T.borderM}`,borderRadius:9,color:T.blue,fontSize:13,fontFamily:T.font};
const btnDanger = {padding:"10px 22px",background:"transparent",border:`1.5px solid ${T.danger}44`,borderRadius:9,color:T.danger,fontSize:13,fontFamily:T.font};

function Spinner(){return <div className="spin" style={{width:16,height:16,border:`2px solid ${T.blueL}`,borderTop:`2px solid ${T.blue}`,borderRadius:"50%",display:"inline-block"}}/>;}

/* ══════════════════════════════════════════════════
   API KEY LANDING PAGE
══════════════════════════════════════════════════ */
function ApiKeyPage({ onConnect }) {
  const [key, setKey]     = useState("");
  const [show, setShow]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith("gsk_") || trimmed.length < 20) {
      setError("Format API key tidak valid. Harus diawali 'gsk_' dan minimal 20 karakter.");
      return;
    }
    onConnect(trimmed);
  };

  return (
    <div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      {/* Hero */}
      <div className="fu" style={{textAlign:"center",marginBottom:48}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:20}}>
          <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 24px rgba(14,165,233,.35)"}}>
            <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
              <path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="3" cy="14" r="1.5" fill="white"/>
              <circle cx="19" cy="8" r="1.5" fill="white"/>
            </svg>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:-.5}}>PasienQuC</div>
            <div style={{fontSize:12,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>v.0.2.0 · AI-Powered QC</div>
          </div>
        </div>
        <div style={{fontSize:16,color:T.textS,maxWidth:460,lineHeight:1.7}}>
          Patient-Based Real-Time Quality Control untuk CBC Hematologi, dilengkapi interpretasi AI, chatbot analitik, dan narasi laporan otomatis.
        </div>
      </div>

      {/* Key Card */}
      <div className="fu" style={{...cardStyle,width:"100%",maxWidth:480,padding:36,animationDelay:"100ms"}}>
        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:6}}>Masukkan Groq API Key</div>
        <div style={{fontSize:12,color:T.textS,marginBottom:20,lineHeight:1.6}}>
          Di artifact Claude: gunakan{" "}
          <a href="https://console.anthropic.com/settings/api-keys" target="_blank" rel="noopener noreferrer"
            style={{color:T.blue,fontWeight:600,textDecoration:"none"}}>
            Anthropic API key ↗
          </a>
          {" "}(sk-ant-...). Di GitHub/production: gunakan{" "}
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            style={{color:T.blue,fontWeight:600,textDecoration:"none"}}>
            Groq API key ↗
          </a>
          {" "}(gsk_...). Key hanya tersimpan lokal di session ini.
        </div>

        <div style={{position:"relative",marginBottom:16}}>
          <input
            type={show?"text":"password"}
            value={key}
            onChange={e=>{setKey(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleConnect()}
            placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
            style={{...inpStyle,paddingRight:52,letterSpacing:show?0:2}}
          />
          <button onClick={()=>setShow(!show)} style={{
            position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
            background:"none",border:"none",cursor:"pointer",color:T.textT,fontSize:18,padding:0,
          }}>{show?"🙈":"👁"}</button>
        </div>

        {error && (
          <div style={{background:"#fef2f2",border:`1px solid ${T.danger}44`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.danger,marginBottom:16}}>
            {error}
          </div>
        )}

        <button className="pbtn" onClick={handleConnect} disabled={!key.trim()}
          style={{...btnP,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:!key.trim()?.6:1}}>
          ▶ Masuk ke PasienQuC
        </button>

        <div style={{marginTop:20,padding:"14px 16px",background:T.surfB,borderRadius:10,border:`1px solid ${T.border}`}}>
          <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,marginBottom:6}}>FITUR AI (Powered by Groq + LLaMA 3.3 70B)</div>
          {["✦ Interpretasi otomatis hasil QC","✦ Chatbot analitik laboratorium","✦ Narasi laporan QC siap cetak"].map(f=>(
            <div key={f} style={{fontSize:12,color:T.textS,marginBottom:3}}>{f}</div>
          ))}
        </div>
      </div>

      <div className="fu" style={{marginTop:24,fontSize:11,color:T.textT,fontFamily:T.mono,animationDelay:"200ms"}}>
        Aplikasi dibuat oleh dr. WIY · PasienQuC v.0.2.0 · April 2026
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   AI INTERPRETATION PANEL
══════════════════════════════════════════════════ */
function AIInterpretation({ apiKey, context, param }) {
  const [text, setText]     = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);

  const run = async () => {
    setLoading(true); setText(""); setDone(false);
    const cfg = PARAMS[param];
    try {
      await aiChat(apiKey, [
        {role:"system", content:`Kamu adalah konsultan Quality Control laboratorium klinis berpengalaman (setara Sp.PK senior). 
Tugasmu: menginterpretasikan data PBRTQC (Patient-Based Real-Time QC) dan memberikan kesimpulan klinis yang actionable.
Gunakan bahasa Indonesia formal-profesional, singkat dan tepat. Format: paragraf pendek (bukan bullet). Fokus pada: 
1) Status presisi analitik, 2) Ada/tidaknya drift atau shift, 3) Rekomendasi tindakan konkret, 4) Apakah perlu eskalasi.
Maksimal 200 kata.`},
        {role:"user", content:`Interpretasikan data QC berikut untuk parameter ${cfg.label}:\n\n${context}`}
      ], t => setText(t));
      setDone(true);
    } catch(e) {
      setText(`❌ Error: ${e.message}`);
      setDone(true);
    } finally { setLoading(false); }
  };

  return (
    <div style={{...cardStyle,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>✦ Interpretasi AI Otomatis</div>
          <div style={{fontSize:11,color:T.textT,fontFamily:T.mono}}>LLaMA 3.3 70B via Groq</div>
        </div>
        <button className="pbtn" onClick={run} disabled={loading}
          style={{...btnP,display:"flex",alignItems:"center",gap:8,padding:"8px 18px",fontSize:12}}>
          {loading?<><Spinner/> Menganalisis...</>:"▶ Generate Interpretasi"}
        </button>
      </div>

      {(text||loading) && (
        <div style={{background:T.surfB,borderRadius:10,padding:18,border:`1.5px solid ${T.border}`,minHeight:80}}>
          {!text && loading && (
            <div style={{display:"flex",gap:8,alignItems:"center",color:T.textT}}>
              <Spinner/><span className="pulse-txt" style={{fontSize:12,fontFamily:T.mono}}>AI sedang menganalisis data QC Anda...</span>
            </div>
          )}
          {text && (
            <div style={{fontSize:13,color:T.text,lineHeight:1.75,fontFamily:T.font}} className="chat-bubble">
              {text}{loading && <span className="blink" style={{color:T.blue}}>▌</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   CHATBOT PANEL
══════════════════════════════════════════════════ */
function ChatbotPanel({ apiKey, context, param }) {
  const [msgs, setMsgs]     = useState([
    {role:"assistant", content:`Halo! Saya asisten analitik PasienQuC. Tanyakan apapun tentang hasil QC parameter ${PARAMS[param]?.label || param} Anda — interpretasi, perbandingan metode, rekomendasi tindakan, atau pertanyaan umum tentang PBRTQC.`}
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef();

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  // reset when param changes
  useEffect(()=>{
    setMsgs([{role:"assistant",content:`Halo! Saya asisten analitik PasienQuC. Tanyakan apapun tentang hasil QC parameter ${PARAMS[param]?.label||param} Anda.`}]);
  },[param]);

  const send = async () => {
    if(!input.trim()||loading) return;
    const userMsg = {role:"user",content:input.trim()};
    const newMsgs = [...msgs, userMsg];
    setMsgs([...newMsgs, {role:"assistant",content:""}]);
    setInput(""); setLoading(true);

    const sysPrompt = `Kamu adalah asisten analitik laboratorium klinis (PBRTQC specialist) dalam aplikasi PasienQuC.
Jawab dengan bahasa Indonesia yang profesional namun mudah dipahami oleh dokter spesialis patologi klinik.
Fokus pada: statistik QC, metode PBRTQC (MA, EWMA, Trimmed Mean, Median/AoN), sigma metric, OPSpecs, dan interpretasi klinis.
Jika ada data QC dari user, gunakan data tersebut sebagai konteks jawaban.
Jangan pernah menyebut nama model AI atau brand lain. Jawab singkat dan tepat (maks 150 kata kecuali diminta panjang).

KONTEKS DATA QC SAAT INI:
${context}`;

    try {
      const history = newMsgs.slice(-10).map(m=>({role:m.role,content:m.content}));
      await aiChat(apiKey,
        [{role:"system",content:sysPrompt}, ...history],
        t => setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:t}])
      );
    } catch(e) {
      setMsgs(prev=>[...prev.slice(0,-1),{role:"assistant",content:`❌ Error: ${e.message}`}]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{...cardStyle,display:"flex",flexDirection:"column",height:480}}>
      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:4}}>✦ Chatbot Analitik</div>
      <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,marginBottom:14}}>Tanya bebas seputar QC & PBRTQC</div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,marginBottom:14,paddingRight:4}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}} className="si">
            {m.role==="assistant" && (
              <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:8,marginTop:2}}>
                <svg width="13" height="13" viewBox="0 0 22 22" fill="none">
                  <path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            <div style={{
              maxWidth:"78%",padding:"10px 14px",borderRadius:12,fontSize:12.5,lineHeight:1.65,
              background:m.role==="user"?T.blue:T.surfB,
              color:m.role==="user"?"#fff":T.text,
              borderBottomRightRadius:m.role==="user"?2:12,
              borderBottomLeftRadius:m.role==="assistant"?2:12,
              border:m.role==="assistant"?`1px solid ${T.border}`:"none",
            }} className="chat-bubble">
              {m.content || (loading&&i===msgs.length-1 ? <span className="pulse-txt">✦ Sedang mengetik...</span> : "")}
              {loading && i===msgs.length-1 && m.content && <span className="blink" style={{color:T.blue}}>▌</span>}
            </div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
          placeholder="Ketik pertanyaan tentang hasil QC..."
          style={{...inpStyle,flex:1,padding:"10px 14px",fontSize:12.5}}
          disabled={loading}
        />
        <button className="pbtn" onClick={send} disabled={loading||!input.trim()}
          style={{...btnP,padding:"10px 18px",opacity:loading||!input.trim()?.6:1}}>
          {loading?<Spinner/>:"→"}
        </button>
      </div>

      {/* Quick prompts */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
        {["Kenapa CV tinggi?","Apa makna drift ini?","Rekomendasikan rule QC","Apakah layak dilaporkan?"].map(q=>(
          <button key={q} className="sbtn" onClick={()=>{setInput(q);}}
            style={{...btnS,padding:"4px 10px",fontSize:11,borderRadius:20}}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   NARRATIVE REPORT PANEL
══════════════════════════════════════════════════ */
function NarrativeReport({ apiKey, context, param, stats, limits, violations, selMethods, mult }) {
  const [text, setText]     = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);
  const [format, setFormat] = useState("formal");

  const formats = {
    formal: "Laporan QC bulanan formal untuk keperluan akreditasi ISO 15189",
    ringkas: "Ringkasan eksekutif singkat untuk kepala instalasi laboratorium",
    rekomendasi: "Rekomendasi teknis berisi action plan konkret untuk analis",
  };

  const run = async () => {
    setLoading(true); setText(""); setDone(false);
    const cfg = PARAMS[param];
    const date = new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
    try {
      await aiChat(apiKey, [
        {role:"system", content:`Kamu adalah konsultan QC laboratorium klinis senior. 
Tugas: menulis narasi laporan QC profesional dalam bahasa Indonesia. 
Format: ${formats[format]}.
Gunakan bahasa formal, terstruktur, dan siap cetak. Sertakan: tanggal laporan, parameter, ringkasan performa, temuan penting, dan rekomendasi.
Panjang: 250–350 kata. Jangan gunakan markdown atau bullet — tulis dalam paragraf mengalir.`},
        {role:"user", content:`Tulis narasi laporan QC untuk tanggal ${date}.\n\nData:\n${context}`}
      ], t => setText(t));
      setDone(true);
    } catch(e) {
      setText(`❌ Error: ${e.message}`);
      setDone(true);
    } finally { setLoading(false); }
  };

  const copyText = () => { navigator.clipboard.writeText(text); };
  const downloadTxt = () => {
    const blob = new Blob([text], {type:"text/plain"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`PasienQuC_Narasi_${param}_${new Date().toISOString().slice(0,10)}.txt`; a.click();
  };

  return (
    <div style={{...cardStyle}}>
      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:4}}>✦ Narasi Laporan Otomatis</div>
      <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,marginBottom:18}}>AI menulis laporan QC siap cetak</div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        {Object.entries(formats).map(([k,v])=>(
          <button key={k} className="pill" onClick={()=>setFormat(k)} style={{
            padding:"7px 16px",borderRadius:20,border:`1.5px solid ${format===k?T.blue:T.border}`,
            background:format===k?T.blueL:"transparent",
            color:format===k?T.blueD:T.textS,fontSize:12,fontWeight:format===k?600:400,
          }}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>
        ))}
        <button className="pbtn" onClick={run} disabled={loading}
          style={{...btnP,marginLeft:"auto",display:"flex",alignItems:"center",gap:8,padding:"8px 18px",fontSize:12}}>
          {loading?<><Spinner/> Menulis...</>:"▶ Generate Laporan"}
        </button>
      </div>

      {(text||loading) && (
        <div style={{background:T.surfB,borderRadius:10,padding:22,border:`1.5px solid ${T.border}`,minHeight:120}}>
          {!text && loading && (
            <div style={{display:"flex",gap:8,alignItems:"center",color:T.textT}}>
              <Spinner/><span className="pulse-txt" style={{fontSize:12,fontFamily:T.mono}}>AI sedang menyusun narasi laporan...</span>
            </div>
          )}
          {text && (
            <>
              <div style={{fontSize:13,color:T.text,lineHeight:1.85,fontFamily:T.font,whiteSpace:"pre-wrap"}} className="chat-bubble">
                {text}{loading && <span className="blink" style={{color:T.blue}}>▌</span>}
              </div>
              {done && (
                <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                  <button className="sbtn" onClick={copyText} style={{...btnS,padding:"7px 16px",fontSize:12}}>⎘ Salin Teks</button>
                  <button className="sbtn" onClick={downloadTxt} style={{...btnS,padding:"7px 16px",fontSize:12}}>↓ Download .txt</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════════ */
function StatCard({label,value,unit,color,delay=0,warn=false}){
  return(
    <div className="card-h fu" style={{animationDelay:`${delay}ms`,background:T.surface,border:`1.5px solid ${warn?T.danger:T.border}`,borderRadius:14,padding:"14px 18px",borderTop:`3px solid ${color||T.blue}`,minWidth:0}}>
      <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:6}}>{label}</div>
      <div style={{fontSize:24,fontWeight:700,color:warn?T.danger:T.text,lineHeight:1}}>{value}</div>
      <div style={{fontSize:11,color:T.textS,marginTop:3,fontFamily:T.mono}}>{unit}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SIGMA GAUGE
══════════════════════════════════════════════════ */
function SigmaGauge({sigma}){
  const z=sigmaZone(sigma),pct=Math.min(100,(sigma/6)*100);
  return(
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:10}}>Sigma Metric</div>
      <div style={{position:"relative",width:120,height:120,margin:"0 auto"}}>
        <svg viewBox="0 0 120 120" style={{transform:"rotate(-90deg)"}}>
          <circle cx="60" cy="60" r="52" fill="none" stroke={T.blueL} strokeWidth="10"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke={z.color} strokeWidth="10"
            strokeDasharray={`${(pct/100)*326.7} 326.7`}
            style={{transition:"stroke-dasharray .8s cubic-bezier(.22,1,.36,1)"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontSize:28,fontWeight:700,color:z.color,fontFamily:T.mono}}>{sigma.toFixed(1)}σ</div>
        </div>
      </div>
      <div style={{marginTop:10,fontSize:12,fontWeight:600,color:z.color}}>{z.label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   OPSPECS PANEL
══════════════════════════════════════════════════ */
function OPSpecsPanel({cfg,stats}){
  const [bias,setBias]=useState(.5);
  const [cv,setCv]=useState(stats?+stats.cv.toFixed(2):3);
  const [tea,setTea]=useState(cfg.tea);
  const sigma=getSigma(tea,bias,cv),z=sigmaZone(sigma);
  return(
    <div className="fi" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div style={{...cardStyle}}>
        <div style={{fontSize:12,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:18}}>Parameter OPSpecs</div>
        {[
          {label:"TEa (%) — Allowable Total Error",val:tea,set:setTea,min:.5,max:20,step:.1},
          {label:"Bias (%) — Metode vs Reference",val:bias,set:setBias,min:0,max:10,step:.1},
          {label:"CV (%) — Imprecision",val:cv,set:setCv,min:.1,max:15,step:.1},
        ].map(s=>(
          <div key={s.label} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:12,color:T.textS}}>{s.label}</span>
              <span style={{fontSize:13,fontWeight:600,color:T.blue,fontFamily:T.mono}}>{s.val.toFixed(1)}%</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
              onChange={e=>s.set(+e.target.value)} style={{width:"100%",accentColor:T.blue}}/>
          </div>
        ))}
        <div style={{marginTop:16,padding:"12px 16px",borderRadius:10,background:z.color+"18",border:`1.5px solid ${z.color}44`}}>
          <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,marginBottom:4}}>σ = (TEa − |Bias|) / CV</div>
          <div style={{fontSize:14,fontFamily:T.mono,color:T.text}}>= <strong style={{color:z.color}}>{sigma.toFixed(2)}σ</strong> — {z.label}</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{...cardStyle}}><SigmaGauge sigma={sigma}/></div>
        <div style={{...cardStyle}}>
          <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:12}}>OPSpecs Zones</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
            {[
              {s:"≥ 6σ",l:"World Class",d:"Rule 1₃s, minimal kontrol",c:T.ok,a:sigma>=6},
              {s:"4–6σ",l:"Good",d:"Westgard multirule",c:T.blue,a:sigma>=4&&sigma<6},
              {s:"3–4σ",l:"Marginal",d:"QC ketat, 4×/hari",c:T.warn,a:sigma>=3&&sigma<4},
              {s:"< 3σ",l:"Poor",d:"Investigasi segera",c:T.danger,a:sigma<3},
            ].map(z=>(
              <div key={z.s} style={{borderRadius:10,padding:10,background:z.a?z.c+"18":T.surfB,border:`1.5px solid ${z.a?z.c:T.border}`,transition:"all .3s"}}>
                <div style={{fontSize:13,fontWeight:700,color:z.c,fontFamily:T.mono}}>{z.s}</div>
                <div style={{fontSize:11,fontWeight:600,color:T.text,margin:"3px 0"}}>{z.l}</div>
                <div style={{fontSize:10,color:T.textS,lineHeight:1.4}}>{z.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   VIOLATION CARDS
══════════════════════════════════════════════════ */
function ViolationCards({violations,selectedMethods,workingData,limits}){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:12}}>
      {selectedMethods.map((m,i)=>{
        const v=violations?.[m]??[],pct=workingData?(v.length/workingData.length*100).toFixed(1):0,ok=v.length===0;
        return(
          <div key={m} className="card-h fu" style={{animationDelay:`${i*55}ms`,background:T.surface,borderRadius:12,border:`1.5px solid ${T.border}`,borderLeft:`4px solid ${METHODS[m].color}`,padding:"15px 16px"}}>
            <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:METHODS[m].color,fontFamily:T.mono,marginBottom:7}}>{METHODS[m].short}</div>
            <div style={{fontSize:30,fontWeight:700,color:ok?T.ok:T.danger,fontFamily:T.mono}}>{v.length}</div>
            <div style={{fontSize:11,color:T.textS}}>{ok?"No violations":`${v.length} pelanggaran`} · {pct}%</div>
            {limits?.[m]&&<div style={{marginTop:7,fontSize:10,color:T.textT,fontFamily:T.mono}}>UCL {limits[m].ucl.toFixed(2)} / LCL {limits[m].lcl.toFixed(2)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════ */
export default function PasienQuC() {
  const [apiKey, setApiKey]     = useState("");
  const [param, setParam]       = useState("Hb");
  const [blockSize, setBlockSize] = useState(20);
  const [mult, setMult]         = useState(2);
  const [rawData, setRawData]   = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [tab, setTab]           = useState("dashboard");
  const [selMethods, setSelMethods] = useState(["MA","EWMA","TRIM","MEDIAN"]);
  const [useAoN, setUseAoN]     = useState(false);
  const [mounted, setMounted]   = useState(false);
  const fileRef = useRef();

  useEffect(()=>{ setTimeout(()=>setMounted(true),60); },[]);

  const cfg = PARAMS[param];

  const workingData = useMemo(()=>{
    if(!rawData)return null;
    return useAoN?rawData.filter(v=>v>=cfg.refLow&&v<=cfg.refHigh):rawData;
  },[rawData,useAoN,cfg]);

  const series = useMemo(()=>{
    if(!workingData||workingData.length<blockSize)return null;
    return{MA:calcMA(workingData,blockSize),EWMA:calcEWMA(workingData),TRIM:calcTrim(workingData,blockSize,cfg.trim),MEDIAN:calcMed(workingData,blockSize)};
  },[workingData,blockSize,cfg]);

  const limits = useMemo(()=>{
    if(!series)return null;
    const o={};Object.keys(series).forEach(m=>{o[m]=getLimits(series[m],mult);});return o;
  },[series,mult]);

  const violations = useMemo(()=>{
    if(!series||!limits)return null;
    const o={};
    Object.keys(series).forEach(m=>{o[m]=series[m].map((v,i)=>({idx:i,value:v,viol:v!==null&&(v>limits[m].ucl||v<limits[m].lcl)})).filter(d=>d.viol);});
    return o;
  },[series,limits]);

  const chartData = useMemo(()=>{
    if(!workingData||!series)return[];
    return workingData.map((v,i)=>{const p={idx:i+1,raw:+v.toFixed(3)};Object.keys(series).forEach(m=>{if(series[m][i]!==null)p[m]=series[m][i];});return p;});
  },[workingData,series]);

  const stats = useMemo(()=>{
    if(!workingData||!workingData.length)return null;
    const m=avg(workingData),s=std(workingData);
    return{n:workingData.length,mean:m,sd:s,cv:(s/m)*100,median:med(workingData)};
  },[workingData]);

  const aiContext = useMemo(()=>buildContext(param,stats,limits,violations,selMethods,blockSize,useAoN,mult),[param,stats,limits,violations,selMethods,blockSize,useAoN,mult]);

  const loadDemo = ()=>setRawData(genDemo(param,160));
  const handleFile = e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPasteText(ev.target.result);r.readAsText(f);};
  const handlePaste = ()=>{
    const p=parseCSV(pasteText);if(!p)return alert("Format tidak dikenali.");
    const col=p.hdr.find(h=>h.toLowerCase().includes(param.toLowerCase()))||p.hdr.find(h=>p.rows.every(r=>!isNaN(parseFloat(r[h]))));
    if(!col)return alert("Kolom numerik tidak ditemukan.");
    setRawData(p.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v)));
  };
  const toggleMethod = m=>setSelMethods(prev=>prev.includes(m)?prev.filter(x=>x!==m):[...prev,m]);

  const exportCSV = ()=>{
    if(!chartData.length)return;
    const h=["Index","Raw",...Object.keys(METHODS).map(m=>`${METHODS[m].short}_val`),...Object.keys(METHODS).map(m=>`${METHODS[m].short}_UCL`),...Object.keys(METHODS).map(m=>`${METHODS[m].short}_LCL`)].join(",");
    const rows=chartData.map(d=>[d.idx,d.raw,...Object.keys(METHODS).map(m=>d[m]??""),...Object.keys(METHODS).map(m=>limits?.[m]?.ucl?.toFixed(3)??""),...Object.keys(METHODS).map(m=>limits?.[m]?.lcl?.toFixed(3)??"")].join(","));
    const blob=new Blob([[h,...rows].join("\n")],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`PasienQuC_${param}.csv`;a.click();
  };

  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    return(
      <div style={{background:T.surface,border:`1.5px solid ${T.borderM}`,borderRadius:10,padding:"10px 14px",fontFamily:T.mono,fontSize:11,boxShadow:"0 4px 20px rgba(14,165,233,.12)"}}>
        <div style={{color:T.textS,marginBottom:5}}>Pasien #{label}</div>
        {payload.map(p=><div key={p.dataKey} style={{color:p.color||T.text,marginBottom:2}}>{p.dataKey}: {typeof p.value==="number"?p.value.toFixed(3):p.value}</div>)}
      </div>
    );
  };

  // ── GATE: show API key page if not connected ──
  if (!apiKey) return <ApiKeyPage onConnect={setApiKey} />;

  const TABS = ["dashboard","ai","opspecs","data","report"];

  return (
    <div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",color:T.text,opacity:mounted?1:0,transition:"opacity .4s"}}>

      {/* ── HEADER ── */}
      <div style={{background:T.surface,borderBottom:`1.5px solid ${T.border}`,padding:"15px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(14,165,233,.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px rgba(14,165,233,.3)"}}>
            <svg width="21" height="21" viewBox="0 0 22 22" fill="none">
              <path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="3" cy="14" r="1.5" fill="white"/>
              <circle cx="19" cy="8" r="1.5" fill="white"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:T.text,letterSpacing:-.3}}>PasienQuC <span style={{color:T.blue}}>·</span> QC Dashboard</div>
            <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>Patient-Based Real-Time QC · CBC · AI-Powered</div>
          </div>
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {TABS.map(t=>(
            <button key={t} className="tb" onClick={()=>setTab(t)} style={{
              padding:"7px 16px",borderRadius:8,border:`1.5px solid ${tab===t?T.blue:T.border}`,
              background:tab===t?T.blue:"transparent",color:tab===t?"#fff":T.textS,
              fontSize:12,fontFamily:T.font,fontWeight:tab===t?600:400,textTransform:"capitalize",letterSpacing:.3,
            }}>
              {t==="ai"?"✦ AI":t}
            </button>
          ))}
          <div style={{marginLeft:8,display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:T.surfB,borderRadius:8,border:`1px solid ${T.border}`}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.ok}}/>
            <span style={{fontSize:11,color:T.textS,fontFamily:T.mono}}>Groq</span>
          </div>
          <button className="sbtn" onClick={()=>setApiKey("")} style={{...btnDanger,padding:"6px 12px",fontSize:11}}>Logout</button>
        </div>
      </div>

      <div style={{padding:"26px 32px"}}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard"&&(
          <div>
            {/* Controls */}
            <div className="fu" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              <div style={cardStyle}>
                <div style={lblStyle}>Parameter CBC</div>
                <select value={param} onChange={e=>{setParam(e.target.value);setRawData(null);}} style={selStyle}>
                  {Object.entries(PARAMS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
                <div style={hintStyle}>{cfg.unit} · Ref: {cfg.refLow}–{cfg.refHigh}</div>
              </div>
              <div style={cardStyle}>
                <div style={lblStyle}>Block Size (n)</div>
                <input type="number" min={5} max={100} value={blockSize} onChange={e=>setBlockSize(+e.target.value)} style={inpStyle}/>
                <div style={hintStyle}>IGD: 15–30</div>
              </div>
              <div style={cardStyle}>
                <div style={lblStyle}>Control Limit</div>
                <select value={mult} onChange={e=>setMult(+e.target.value)} style={selStyle}>
                  {[1.5,2,2.5,3].map(v=><option key={v} value={v}>± {v} SD</option>)}
                </select>
                <div style={hintStyle}>Typical: ±2SD</div>
              </div>
              <div style={cardStyle}>
                <div style={lblStyle}>Average of Normals</div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
                  <div className="tog" onClick={()=>setUseAoN(!useAoN)} style={{width:42,height:22,borderRadius:11,background:useAoN?T.blue:"#cbd5e1",position:"relative"}}>
                    <div style={{position:"absolute",top:3,left:useAoN?22:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.12)"}}/>
                  </div>
                  <span style={{fontSize:12,color:useAoN?T.blue:T.textT,fontWeight:useAoN?600:400}}>{useAoN?"Aktif":"Nonaktif"}</span>
                </div>
                <div style={hintStyle}>Filter: {cfg.refLow}–{cfg.refHigh} {cfg.unit}</div>
              </div>
            </div>

            {/* Method pills */}
            <div className="fu" style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",animationDelay:"60ms"}}>
              {Object.entries(METHODS).map(([k,v])=>{
                const on=selMethods.includes(k);
                return(
                  <div key={k} className="pill" onClick={()=>toggleMethod(k)} style={{padding:"6px 16px",borderRadius:20,border:`1.5px solid ${on?v.color:T.border}`,background:on?v.color+"12":"transparent",color:on?v.color:T.textS,fontSize:12,fontWeight:on?600:400}}>
                    <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:on?v.color:T.border,marginRight:6,verticalAlign:"middle"}}/>
                    {v.label}
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {!rawData&&(
              <div className="fu" style={{border:`2px dashed ${T.border}`,borderRadius:16,padding:"48px 40px",textAlign:"center",background:T.surface,marginBottom:22,animationDelay:"100ms"}}>
                <div style={{fontSize:38,marginBottom:12}}>📊</div>
                <div style={{fontSize:15,color:T.textS,marginBottom:20}}>Belum ada data · Upload CSV atau gunakan data demo</div>
                <div style={{display:"flex",gap:12,justifyContent:"center"}}>
                  <button className="pbtn" onClick={loadDemo} style={btnP}>▶ Load Data Demo ({param})</button>
                  <button className="sbtn" onClick={()=>setTab("data")} style={btnS}>↑ Upload CSV</button>
                </div>
              </div>
            )}

            {/* Stat cards */}
            {stats&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
                <StatCard label="N Sampel" value={stats.n} unit="data" color={T.blue} delay={0}/>
                <StatCard label="Mean" value={stats.mean.toFixed(2)} unit={cfg.unit} color={T.blue} delay={60}/>
                <StatCard label="SD" value={stats.sd.toFixed(3)} unit="" color={T.ok} delay={120}/>
                <StatCard label="CV%" value={stats.cv.toFixed(2)+"%"} unit="" color={stats.cv>10?T.danger:T.warn} warn={stats.cv>10} delay={180}/>
                <StatCard label="Median" value={stats.median.toFixed(2)} unit={cfg.unit} color={T.purple} delay={240}/>
              </div>
            )}

            {/* Chart */}
            {chartData.length>0&&series&&limits&&(
              <div className="card-h fu" style={{...cardStyle,padding:24,marginBottom:20,animationDelay:"200ms"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:T.text}}>Control Chart — {cfg.label}</div>
                    <div style={{fontSize:11,color:T.textT,fontFamily:T.mono}}>{chartData.length} titik · Block n={blockSize}</div>
                  </div>
                  <div style={{fontSize:11,fontFamily:T.mono,color:T.textT}}>Ref: {cfg.refLow}–{cfg.refHigh} {cfg.unit}</div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{top:4,right:16,bottom:16,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
                    <XAxis dataKey="idx" tick={{fontSize:10,fill:T.textT}} stroke={T.border} label={{value:"Urutan Pasien",position:"insideBottom",offset:-4,fill:T.textT,fontSize:10}}/>
                    <YAxis tick={{fontSize:10,fill:T.textT}} stroke={T.border} label={{value:cfg.unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:10}}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
                    <Line dataKey="raw" stroke="rgba(14,165,233,.18)" dot={false} strokeWidth={1} name="Raw" legendType="none"/>
                    <ReferenceLine y={cfg.refHigh} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.5} label={{value:"↑ Ref",fill:T.textT,fontSize:9,position:"insideTopRight"}}/>
                    <ReferenceLine y={cfg.refLow} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.5} label={{value:"↓ Ref",fill:T.textT,fontSize:9,position:"insideBottomRight"}}/>
                    {selMethods.map(m=>[
                      <Line key={m} dataKey={m} stroke={METHODS[m].color} dot={false} strokeWidth={2.2} name={METHODS[m].label} connectNulls strokeDasharray={METHODS[m].dash}/>,
                      <ReferenceLine key={m+"u"} y={limits[m].ucl} stroke={METHODS[m].color} strokeDasharray="2 6" strokeOpacity={.35}/>,
                      <ReferenceLine key={m+"l"} y={limits[m].lcl} stroke={METHODS[m].color} strokeDasharray="2 6" strokeOpacity={.35}/>,
                    ])}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Violations */}
            {violations&&(
              <div style={{...cardStyle,padding:20}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>Ringkasan Pelanggaran Control Limit</div>
                <ViolationCards violations={violations} selectedMethods={selMethods} workingData={workingData} limits={limits}/>
              </div>
            )}

            {/* AI Interpretation inline */}
            {stats&&<AIInterpretation apiKey={apiKey} context={aiContext} param={param}/>}
          </div>
        )}

        {/* ══ AI TAB ══ */}
        {tab==="ai"&&(
          <div className="fi">
            <div style={{marginBottom:20}}>
              <div style={{fontSize:20,fontWeight:700,color:T.text}}>✦ Fitur AI PasienQuC</div>
              <div style={{fontSize:12,color:T.textS,marginTop:4,fontFamily:T.mono}}>LLaMA 3.3 70B via Groq API · {cfg.label} ({cfg.unit})</div>
            </div>
            {!stats&&(
              <div style={{...cardStyle,padding:30,textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:14,color:T.textS,marginBottom:14}}>Load data terlebih dahulu untuk mengaktifkan fitur AI</div>
                <button className="pbtn" onClick={loadDemo} style={btnP}>▶ Load Data Demo</button>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
              <AIInterpretation apiKey={apiKey} context={aiContext} param={param}/>
              <ChatbotPanel apiKey={apiKey} context={aiContext} param={param}/>
            </div>
            <NarrativeReport apiKey={apiKey} context={aiContext} param={param} stats={stats} limits={limits} violations={violations} selMethods={selMethods} mult={mult}/>
          </div>
        )}

        {/* ══ OPSPECS TAB ══ */}
        {tab==="opspecs"&&(
          <div className="fi">
            <div style={{marginBottom:20}}>
              <div style={{fontSize:20,fontWeight:700,color:T.text}}>OPSpecs & Sigma Metric</div>
              <div style={{fontSize:12,color:T.textS,marginTop:4,fontFamily:T.mono}}>Operational Process Specifications · {cfg.label}</div>
            </div>
            <OPSpecsPanel cfg={cfg} stats={stats}/>
            <div style={{...cardStyle,padding:22,marginTop:20}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>Panduan QC Berdasarkan Sigma</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:T.blueL}}>
                      {["Sigma","Klasifikasi","QC Rule","Frekuensi","Rekomendasi"].map(h=>(
                        <th key={h} style={{padding:"9px 13px",textAlign:"left",fontWeight:600,color:T.blueD,fontSize:11,letterSpacing:.5}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["≥ 6σ","World Class","1₃s","2×/hari","PBRTQC saja cukup",T.ok],
                      ["4–6σ","Good","1₂s/2₂s/R₄s","2×/hari","PBRTQC + QC 2 level",T.blue],
                      ["3–4σ","Marginal","Multirule ketat","4×/hari","PBRTQC + QC 3 level",T.warn],
                      ["< 3σ","Poor","Semua rules","6×/hari","Investigasi, perbaiki metode",T.danger],
                    ].map((row,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"transparent":T.surfB}}>
                        {row.slice(0,-1).map((cell,j)=>(
                          <td key={j} style={{padding:"9px 13px",color:j===0?row[5]:T.text,fontFamily:j===0?T.mono:"inherit",fontWeight:j===0?700:400}}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ DATA TAB ══ */}
        {tab==="data"&&(
          <div className="fi">
            <div style={{...cardStyle,padding:24,marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>Upload / Input Data</div>
              <div style={{display:"flex",gap:10,marginBottom:14}}>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{display:"none"}}/>
                <button className="pbtn" onClick={()=>fileRef.current.click()} style={btnP}>↑ Pilih File CSV</button>
                <button className="pbtn" onClick={loadDemo} style={{...btnP,background:T.ok}}>▶ Demo {param}</button>
              </div>
              <div style={{fontSize:11,color:T.textT,marginBottom:10,fontFamily:T.mono}}>Format CSV/TSV dengan header. Kolom numerik dideteksi otomatis.</div>
              <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
                placeholder={"Paste CSV di sini...\nContoh:\nHb\n12.5\n13.2\n11.8"}
                style={{width:"100%",height:160,background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:10,color:T.text,padding:14,fontSize:12,fontFamily:T.mono,resize:"vertical"}}/>
              <button className="pbtn" onClick={handlePaste} style={{...btnP,marginTop:12}}>▶ Proses Data</button>
            </div>
            {rawData&&(
              <div style={{...cardStyle,padding:20}}>
                <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Preview — {rawData.length} nilai</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(70px,1fr))",gap:5,maxHeight:260,overflowY:"auto"}}>
                  {rawData.slice(0,200).map((v,i)=>{
                    const inR=v>=cfg.refLow&&v<=cfg.refHigh;
                    return(<div key={i} style={{background:inR?"#ecfdf5":"#fef2f2",border:`1px solid ${inR?"#6ee7b7":"#fca5a5"}`,borderRadius:6,padding:"4px 6px",fontSize:11,fontFamily:T.mono,color:inR?"#065f46":"#991b1b",textAlign:"center"}}>{v.toFixed(2)}</div>);
                  })}
                </div>
                <div style={{marginTop:8,fontSize:11,color:T.textT}}>
                  <span style={{color:T.ok}}>■</span> Dalam ref &nbsp;<span style={{color:T.danger}}>■</span> Di luar ref
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ REPORT TAB ══ */}
        {tab==="report"&&(
          <div className="fi">
            {!stats?(
              <div style={{...cardStyle,padding:36,textAlign:"center"}}>
                <div style={{fontSize:14,color:T.textS,marginBottom:14}}>Belum ada data. Load data di tab Dashboard.</div>
                <button className="pbtn" onClick={()=>setTab("dashboard")} style={btnP}>← Ke Dashboard</button>
              </div>
            ):(
              <>
                <div style={{...cardStyle,padding:24,marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:16}}>Summary Report</div>
                  <div style={{background:T.surfB,borderRadius:10,padding:20,fontFamily:T.mono,fontSize:12,border:`1.5px solid ${T.border}`}}>
                    <div style={{color:T.blue,letterSpacing:2,fontSize:10,textTransform:"uppercase",marginBottom:10}}>PasienQuC · {cfg.label}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                      {[["Parameter",`${cfg.label} (${cfg.unit})`],["N Data",stats.n],["Block Size",blockSize],["AoN",useAoN?"Aktif":"Tidak"],["Mean",stats.mean.toFixed(3)],["SD",stats.sd.toFixed(3)],["CV%",stats.cv.toFixed(2)+"%"],["Median",stats.median.toFixed(3)]].map(([k,v])=>(
                        <div key={k}><span style={{color:T.textT}}>{k}: </span><span style={{color:T.text,fontWeight:600}}>{v}</span></div>
                      ))}
                    </div>
                    {limits&&(
                      <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                        {selMethods.map(m=>(
                          <div key={m} style={{marginBottom:6}}>
                            <span style={{color:METHODS[m].color,fontWeight:600}}>{METHODS[m].label}</span>
                            <span style={{color:T.textS}}> — Target:{limits[m].target.toFixed(3)} UCL:{limits[m].ucl.toFixed(3)} LCL:{limits[m].lcl.toFixed(3)} </span>
                            <span style={{color:violations?.[m]?.length>0?T.danger:T.ok,fontWeight:600}}>Viol:{violations?.[m]?.length??0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:10,marginTop:16}}>
                    <button className="pbtn" onClick={exportCSV} style={btnP}>↓ Export CSV</button>
                  </div>
                </div>
                {/* AI Narrative in report tab */}
                <NarrativeReport apiKey={apiKey} context={aiContext} param={param} stats={stats} limits={limits} violations={violations} selMethods={selMethods} mult={mult}/>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{borderTop:`1.5px solid ${T.border}`,background:T.surface,padding:"14px 32px",display:"flex",alignItems:"center",justifyContent:"center",gap:16,marginTop:28}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="13" height="13" viewBox="0 0 22 22" fill="none">
              <path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{fontSize:13,fontWeight:700,color:T.text}}>PasienQuC</span>
          <span style={{fontSize:10,color:T.textT,fontFamily:T.mono,background:T.blueL,padding:"2px 8px",borderRadius:6}}>v.0.2.0</span>
        </div>
        <div style={{width:1,height:18,background:T.border}}/>
        <div style={{fontSize:12,color:T.textS,fontFamily:T.mono}}>
          Aplikasi dibuat oleh <span style={{color:T.blue,fontWeight:600}}>dr. WIY</span>
        </div>
        <div style={{width:1,height:18,background:T.border}}/>
        <div style={{fontSize:12,color:T.textT,fontFamily:T.mono}}>April 2026</div>
        <div style={{width:1,height:18,background:T.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.textT,fontFamily:T.mono}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:T.ok}}/>
          LLaMA 3.3 70B via Groq
        </div>
      </div>
    </div>
  );
}
