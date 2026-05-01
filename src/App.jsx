import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, ComposedChart, Scatter
} from "recharts";

/* ─── Fonts ─── */
(() => { const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap";document.head.appendChild(l); })();

/* ─── CSS ─── */
(() => { const s=document.createElement("style");s.textContent=`
*{box-sizing:border-box;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes slideIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.fu{animation:fadeUp .42s cubic-bezier(.22,1,.36,1) both}
.fi{animation:fadeIn .32s ease both}
.si{animation:slideIn .28s ease both}
.ch{transition:box-shadow .2s,transform .2s}
.ch:hover{box-shadow:0 8px 26px rgba(14,165,233,.11);transform:translateY(-2px)}
.tb{transition:all .15s;cursor:pointer}.tb:hover{background:rgba(14,165,233,.07)!important}
.pill{transition:all .13s;cursor:pointer}.pill:hover{transform:scale(1.03)}
.pb{transition:all .15s;cursor:pointer}.pb:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(14,165,233,.25)}.pb:active{transform:translateY(0)}
.sb{transition:all .13s;cursor:pointer}.sb:hover{background:rgba(14,165,233,.06)!important}
.tog{transition:background .18s;cursor:pointer}
.wt{transition:all .13s;cursor:pointer}.wt:hover{transform:scale(1.03)}
.spin{animation:spin .8s linear infinite}
.pt{animation:pulse 1.5s ease infinite}
.bl{animation:blink 1s step-end infinite}
input:focus,select:focus,textarea:focus{outline:none;border-color:#0ea5e9!important}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(14,165,233,.2);border-radius:10px}
.cb{line-height:1.68;white-space:pre-wrap;word-break:break-word}
table{border-collapse:collapse;width:100%}
`;document.head.appendChild(s); })();

/* ══ TOKENS ══ */
const T={
  bg:"#eef5ff",surface:"#fff",surfB:"#f5faff",
  border:"rgba(14,165,233,.14)",borderM:"rgba(14,165,233,.32)",
  blue:"#0ea5e9",blueD:"#0369a1",blueL:"#e0f2fe",
  text:"#0b1929",textS:"#3d5a7a",textT:"#7aa0bc",
  ok:"#10b981",warn:"#f59e0b",danger:"#ef4444",purple:"#8b5cf6",
  font:"'DM Sans',sans-serif",mono:"'DM Mono',monospace",
};

/* ══ SUPABASE ══ */
const SB_URL="https://nlkacrxphnwhnusjsany.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sa2FjcnhwaG53aG51c2pzYW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzkwNzIsImV4cCI6MjA5MzIxNTA3Mn0.6unGuZd8Prssy-lJhPcMx491YJR4mpy9rFHUkm7bC_8";

async function sbFetch(path,opts={}){
  const res=await fetch(`${SB_URL}/rest/v1${path}`,{
    ...opts,
    headers:{
      "apikey":SB_KEY,
      "Authorization":`Bearer ${SB_KEY}`,
      "Content-Type":"application/json",
      "Prefer":"return=representation",
      ...(opts.headers||{}),
    },
  });
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.message||`Supabase error ${res.status}`);}
  const text=await res.text();
  return text?JSON.parse(text):[];
}

const db={
  async saveSessions(rows){ return sbFetch("/qc_sessions",{method:"POST",body:JSON.stringify(rows)}); },
  async getSessions(param,ward,limit=500){
    let q=`/qc_sessions?param=eq.${encodeURIComponent(param)}&ward=eq.${encodeURIComponent(ward)}&order=recorded_at.desc&limit=${limit}`;
    return sbFetch(q);
  },
  async getSessionsRange(param,ward,from,to){
    return sbFetch(`/qc_sessions?param=eq.${encodeURIComponent(param)}&ward=eq.${encodeURIComponent(ward)}&recorded_at=gte.${from}&recorded_at=lte.${to}&order=recorded_at.asc&limit=2000`);
  },
  async getMonthly(param,ward){
    return sbFetch(`/qc_monthly?param=eq.${encodeURIComponent(param)}&ward=eq.${encodeURIComponent(ward)}&order=month.asc`);
  },
};

/* ══ CONFIGS ══ */
const WARDS={IGD:{label:"IGD",color:"#ef4444",icon:"🚨"},RANAP:{label:"Rawat Inap",color:"#3b82f6",icon:"🏥"},ICU:{label:"ICU / HCU",color:"#8b5cf6",icon:"💊"},POLI:{label:"Poli Rawat Jalan",color:"#10b981",icon:"🩺"},OK:{label:"OK / Kamar Operasi",color:"#f59e0b",icon:"⚕️"}};

const PARAM_GROUPS={
  HEMATOLOGI:{label:"Hematologi CBC",icon:"🩸",color:"#ef4444",params:{Hb:{label:"Hemoglobin (Hb)",unit:"g/dL",refLow:12,refHigh:17.5,trim:.20,tea:1.5},MCV:{label:"MCV",unit:"fL",refLow:80,refHigh:100,trim:.15,tea:2.5},PLT:{label:"Trombosit",unit:"×10³/µL",refLow:150,refHigh:400,trim:.25,tea:9.0},WBC:{label:"Leukosit",unit:"×10³/µL",refLow:4,refHigh:11,trim:.25,tea:9.0},MCH:{label:"MCH",unit:"pg",refLow:27,refHigh:33,trim:.15,tea:2.5},MCHC:{label:"MCHC",unit:"g/dL",refLow:32,refHigh:36,trim:.15,tea:2.5},RBC:{label:"Eritrosit",unit:"×10⁶/µL",refLow:3.8,refHigh:6.0,trim:.20,tea:2.5}}},
  KIMIA:{label:"Kimia Klinik",icon:"⚗️",color:"#3b82f6",params:{Na:{label:"Natrium (Na)",unit:"mEq/L",refLow:135,refHigh:145,trim:.15,tea:1.5},K:{label:"Kalium (K)",unit:"mEq/L",refLow:3.5,refHigh:5.0,trim:.15,tea:5.0},Cl:{label:"Klorida (Cl)",unit:"mEq/L",refLow:96,refHigh:106,trim:.15,tea:2.0},Glukosa:{label:"Glukosa Darah",unit:"mg/dL",refLow:70,refHigh:100,trim:.25,tea:6.0},Ureum:{label:"Ureum",unit:"mg/dL",refLow:10,refHigh:50,trim:.20,tea:9.0},Kreatinin:{label:"Kreatinin",unit:"mg/dL",refLow:0.6,refHigh:1.2,trim:.20,tea:8.9},Albumin:{label:"Albumin",unit:"g/dL",refLow:3.5,refHigh:5.0,trim:.15,tea:5.0},BilTotal:{label:"Bilirubin Total",unit:"mg/dL",refLow:0.2,refHigh:1.2,trim:.25,tea:9.0},SGOT:{label:"SGOT (AST)",unit:"U/L",refLow:5,refHigh:40,trim:.25,tea:9.0},SGPT:{label:"SGPT (ALT)",unit:"U/L",refLow:5,refHigh:41,trim:.25,tea:9.0},GGT:{label:"Gamma GT",unit:"U/L",refLow:8,refHigh:61,trim:.25,tea:9.0},TotProt:{label:"Protein Total",unit:"g/dL",refLow:6.3,refHigh:8.2,trim:.15,tea:5.0}}},
  KOAGULASI:{label:"Koagulasi",icon:"🧬",color:"#8b5cf6",params:{PT:{label:"Prothrombin Time",unit:"detik",refLow:10,refHigh:14,trim:.15,tea:5.0},APTT:{label:"APTT",unit:"detik",refLow:25,refHigh:35,trim:.15,tea:5.0},INR:{label:"INR",unit:"",refLow:0.8,refHigh:1.2,trim:.15,tea:5.0},Fibrinogen:{label:"Fibrinogen",unit:"mg/dL",refLow:200,refHigh:400,trim:.20,tea:9.0},DDimer:{label:"D-Dimer",unit:"ng/mL",refLow:0,refHigh:500,trim:.25,tea:9.0}}},
  AGD:{label:"Analisis Gas Darah",icon:"💨",color:"#f59e0b",params:{pH:{label:"pH",unit:"",refLow:7.35,refHigh:7.45,trim:.10,tea:1.2},pCO2:{label:"pCO2",unit:"mmHg",refLow:35,refHigh:45,trim:.15,tea:5.0},pO2:{label:"pO2",unit:"mmHg",refLow:80,refHigh:100,trim:.20,tea:9.0},HCO3:{label:"HCO3",unit:"mEq/L",refLow:22,refHigh:26,trim:.15,tea:5.0},BE:{label:"Base Excess",unit:"mEq/L",refLow:-2,refHigh:2,trim:.15,tea:5.0},SaO2:{label:"SaO2",unit:"%",refLow:95,refHigh:100,trim:.10,tea:2.0},Laktat:{label:"Laktat",unit:"mmol/L",refLow:0.5,refHigh:2.0,trim:.20,tea:9.0}}},
  URINALISIS:{label:"Urinalisis",icon:"🧪",color:"#10b981",params:{pHUrin:{label:"pH Urin",unit:"",refLow:4.5,refHigh:8.0,trim:.15,tea:5.0},BJUrin:{label:"Berat Jenis",unit:"",refLow:1.005,refHigh:1.030,trim:.10,tea:2.0},ProtUrin:{label:"Protein Urin",unit:"mg/dL",refLow:0,refHigh:14,trim:.25,tea:9.0},GluUrin:{label:"Glukosa Urin",unit:"mg/dL",refLow:0,refHigh:15,trim:.25,tea:9.0}}},
  IMUNOSEROLOGI:{label:"Imunoserologi",icon:"🛡️",color:"#06b6d4",params:{CRP:{label:"C-Reactive Protein",unit:"mg/L",refLow:0,refHigh:5,trim:.25,tea:9.0},PCT:{label:"Prokalsitonin",unit:"ng/mL",refLow:0,refHigh:0.5,trim:.25,tea:9.0},Ferritin:{label:"Ferritin",unit:"ng/mL",refLow:12,refHigh:300,trim:.25,tea:9.0},IL6:{label:"Interleukin-6",unit:"pg/mL",refLow:0,refHigh:7,trim:.25,tea:9.0}}},
};

const METHODS={MA:{label:"Moving Average",short:"MA",color:"#0ea5e9",dash:"none"},EWMA:{label:"EWMA",short:"EWMA",color:"#10b981",dash:"5 3"},TRIM:{label:"Trimmed Mean",short:"Trim",color:"#f59e0b",dash:"3 3"},MEDIAN:{label:"Median/AoN",short:"Med",color:"#8b5cf6",dash:"8 3"}};

/* ══ GROQ ══ */
const GROQ_EP=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"
  ?"https://api.groq.com/openai/v1/chat/completions"
  :"/api/groq/openai/v1/chat/completions";

async function aiChat(apiKey,messages,onChunk){
  const res=await fetch(GROQ_EP,{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages,max_tokens:1024,stream:true,temperature:0.4})});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`Groq error: ${res.status}`);}
  const reader=res.body.getReader(),dec=new TextDecoder();let full="";
  while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value);for(const line of chunk.split("\n")){if(!line.startsWith("data: "))continue;const data=line.slice(6).trim();if(data==="[DONE]")break;try{const j=JSON.parse(data),t=j.choices?.[0]?.delta?.content||"";full+=t;onChunk?.(full);}catch{}}}
  return full;
}

/* ══ MATH ══ */
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
const std=a=>{const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const calcMA=(v,n)=>v.map((_,i)=>i<n-1?null:+avg(v.slice(i-n+1,i+1)).toFixed(3));
const calcEWMA=(v,l=.2)=>{let e=v[0];return v.map(x=>+(e=l*x+(1-l)*e).toFixed(3));};
const calcTrim=(v,n,f)=>v.map((_,i)=>{if(i<n-1)return null;const s=[...v.slice(i-n+1,i+1)].sort((a,b)=>a-b),k=Math.floor(s.length*f),t=s.slice(k,s.length-k);return +avg(t).toFixed(3);});
const calcMed=(v,n)=>v.map((_,i)=>i<n-1?null:+med(v.slice(i-n+1,i+1)).toFixed(3));
const getLimits=(v,mult)=>{const vals=v.filter(x=>x!==null),m=avg(vals),s=std(vals);return{target:m,ucl:m+mult*s,lcl:m-mult*s,sd:s};};

/* ══ WESTGARD RULES ══ */
function checkWestgard(values, mean, sd) {
  const violations = [];
  const n = values.length;
  if (n === 0) return violations;

  for (let i = 0; i < n; i++) {
    const v = values[i];
    const z = (v - mean) / sd;
    const rules = [];

    // 1_2s — warning
    if (Math.abs(z) > 2) rules.push({ rule: "1₂s", type: "warning", desc: "1 titik > ±2SD (warning)" });
    // 1_3s — rejection
    if (Math.abs(z) > 3) rules.push({ rule: "1₃s", type: "reject", desc: "1 titik > ±3SD (reject)" });

    // 2_2s — 2 consecutive > 2SD same side
    if (i >= 1) {
      const z1 = (values[i-1] - mean) / sd;
      if (z > 2 && z1 > 2) rules.push({ rule: "2₂s", type: "reject", desc: "2 berturut > +2SD" });
      if (z < -2 && z1 < -2) rules.push({ rule: "2₂s", type: "reject", desc: "2 berturut < -2SD" });
      // R_4s — range > 4SD
      if (Math.abs(z - z1) > 4) rules.push({ rule: "R₄s", type: "reject", desc: "Range 2 titik berturut > 4SD" });
    }

    // 4_1s — 4 consecutive > 1SD same side
    if (i >= 3) {
      const zs = [values[i],values[i-1],values[i-2],values[i-3]].map(x=>(x-mean)/sd);
      if (zs.every(z=>z>1)) rules.push({ rule: "4₁s", type: "reject", desc: "4 berturut > +1SD" });
      if (zs.every(z=>z<-1)) rules.push({ rule: "4₁s", type: "reject", desc: "4 berturut < -1SD" });
    }

    // 10x — 10 consecutive same side of mean
    if (i >= 9) {
      const zs = values.slice(i-9, i+1).map(x=>(x-mean)/sd);
      if (zs.every(z=>z>0)) rules.push({ rule: "10x", type: "reject", desc: "10 berturut di atas mean" });
      if (zs.every(z=>z<0)) rules.push({ rule: "10x", type: "reject", desc: "10 berturut di bawah mean" });
    }

    if (rules.length > 0) violations.push({ idx: i, value: v, z: +z.toFixed(2), rules });
  }
  return violations;
}

/* ══ LJ ZONE COLOR ══ */
function ljColor(z) {
  const az = Math.abs(z);
  if (az > 3) return T.danger;
  if (az > 2) return T.warn;
  if (az > 1) return "#f97316";
  return T.ok;
}

/* ══ DEMO DATA ══ */
function genDemo(cfg,ward,n=120){
  const mid=(cfg.refLow+cfg.refHigh)/2,span=(cfg.refHigh-cfg.refLow)*.55;
  const bias=ward==="ICU"?.15:ward==="IGD"?.10:ward==="POLI"?-.05:0;
  const spread=ward==="ICU"||ward==="IGD"?1.3:ward==="POLI"?.7:1.0;
  return Array.from({length:n},(_,i)=>{
    const drift=i>=90?(cfg.refHigh-mid)*.25:0;
    const v=mid*(1+bias)+drift+(Math.random()-.5)*span*spread+(Math.random()-.5)*span*.2;
    return +Math.max(cfg.refLow*.3,Math.min(cfg.refHigh*1.8,v)).toFixed(3);
  });
}

function parseCSV(txt){
  const lines=txt.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return null;
  const hdr=lines[0].split(/[,;\t]/).map(h=>h.trim());
  const rows=lines.slice(1).map(l=>{const c=l.split(/[,;\t]/),o={};hdr.forEach((h,i)=>o[h]=c[i]?.trim());return o;});
  return{hdr,rows};
}

/* ══ SHARED STYLES ══ */
const CS={background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:20,boxShadow:"0 2px 12px rgba(14,165,233,.05)"};
const LS={fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:8};
const SS={width:"100%",background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font};
const IS={width:"100%",background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.mono};
const BP={padding:"8px 18px",background:T.blue,border:"none",borderRadius:9,color:"#fff",fontSize:12,fontFamily:T.font,fontWeight:600};
const BS={padding:"8px 18px",background:"transparent",border:`1.5px solid ${T.borderM}`,borderRadius:9,color:T.blue,fontSize:12,fontFamily:T.font};

function Sp(){return <div className="spin" style={{width:14,height:14,border:`2px solid ${T.blueL}`,borderTop:`2px solid ${T.blue}`,borderRadius:"50%",display:"inline-block"}}/>;}

/* ══ API KEY PAGE ══ */
function ApiKeyPage({onConnect}){
  const[key,setKey]=useState(""),[show,setShow]=useState(false),[err,setErr]=useState("");
  const go=()=>{const t=key.trim();if(!t.startsWith("gsk_")||t.length<20){setErr("Harus diawali gsk_ (min 20 karakter).");return;}onConnect(t);};
  return(
    <div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div className="fu" style={{textAlign:"center",marginBottom:36}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:13,marginBottom:14}}>
          <div style={{width:50,height:50,borderRadius:15,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(14,165,233,.3)"}}>
            <svg width="25" height="25" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="14" r="1.5" fill="white"/><circle cx="19" cy="8" r="1.5" fill="white"/></svg>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:24,fontWeight:700,color:T.text,letterSpacing:-.5}}>PasienQuC</div>
            <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>v.0.4.0 · LJ Chart · Westgard · Tren · Supabase</div>
          </div>
        </div>
        <div style={{fontSize:13,color:T.textS,maxWidth:480,lineHeight:1.7,margin:"0 auto"}}>
          PBRTQC lengkap dengan <strong>Levey-Jennings chart detail</strong>, <strong>Westgard rules checker otomatis</strong>, <strong>tren historis</strong>, dan <strong>database Supabase</strong>.
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginTop:12}}>
          {["📈 LJ Chart Detail","⚠️ Westgard Auto","📅 Tren Historis","☁️ Supabase DB","🤖 AI Groq"].map(f=>
            <span key={f} style={{fontSize:11,padding:"3px 11px",borderRadius:20,background:T.blueL,color:T.blueD,fontWeight:600}}>{f}</span>
          )}
        </div>
      </div>
      <div className="fu" style={{...CS,width:"100%",maxWidth:420,padding:28,animationDelay:"100ms"}}>
        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:5}}>Masukkan Groq API Key</div>
        <div style={{fontSize:12,color:T.textS,marginBottom:14,lineHeight:1.6}}>
          Daftar gratis di <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{color:T.blue,fontWeight:600,textDecoration:"none"}}>console.groq.com/keys ↗</a>
        </div>
        <div style={{position:"relative",marginBottom:11}}>
          <input type={show?"text":"password"} value={key} onChange={e=>{setKey(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&go()} placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
            style={{...IS,paddingRight:44,letterSpacing:show?0:2}}/>
          <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textT,fontSize:16,padding:0}}>{show?"🙈":"👁"}</button>
        </div>
        {err&&<div style={{background:"#fef2f2",border:`1px solid ${T.danger}44`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.danger,marginBottom:10}}>{err}</div>}
        <button className="pb" onClick={go} disabled={!key.trim()} style={{...BP,width:"100%",opacity:!key.trim()?.6:1}}>▶ Masuk ke PasienQuC</button>
        <div style={{marginTop:14,fontSize:10,color:T.textT,fontFamily:T.mono,textAlign:"center"}}>Data tersimpan di Supabase · aman & terenkripsi</div>
      </div>
      <div className="fu" style={{marginTop:18,fontSize:11,color:T.textT,fontFamily:T.mono,animationDelay:"160ms"}}>
        Aplikasi dibuat oleh dr. WIY · PasienQuC v.0.4.0 · April 2026
      </div>
    </div>
  );
}

/* ══ WARD SELECTOR ══ */
function WardSel({selected,onChange,multi=false}){
  const toggle=w=>{if(!multi){onChange([w]);return;}onChange(selected.includes(w)?selected.filter(x=>x!==w):[...selected,w]);};
  return(<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(WARDS).map(([k,v])=>{const on=selected.includes(k);return(<div key={k} className="wt" onClick={()=>toggle(k)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${on?v.color:T.border}`,background:on?v.color+"13":"transparent",color:on?v.color:T.textS,fontSize:12,fontWeight:on?600:400,display:"flex",alignItems:"center",gap:4}}><span>{v.icon}</span><span>{v.label}</span></div>);})}</div>);
}

/* ══ GROUP SELECTOR ══ */
function GroupSel({selected,onChange}){
  return(<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(PARAM_GROUPS).map(([k,g])=>{const on=selected===k;return(<div key={k} className="wt" onClick={()=>onChange(k)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${on?g.color:T.border}`,background:on?g.color+"13":"transparent",color:on?g.color:T.textS,fontSize:12,fontWeight:on?600:400,display:"flex",alignItems:"center",gap:5}}><span>{g.icon}</span><span>{g.label}</span></div>);})}</div>);
}

/* ══ LEVEY-JENNINGS CHART ══ */
function LJChart({values, mean, sdVal, paramLabel, wardLabel, unit, violations}){
  const violSet=new Set(violations.map(v=>v.idx));
  const rejectSet=new Set(violations.filter(v=>v.rules.some(r=>r.type==="reject")).map(v=>v.idx));

  const data=values.map((v,i)=>{
    const z=(v-mean)/sdVal;
    return{idx:i+1,value:+v.toFixed(3),z:+z.toFixed(2),
      p3sd:+(mean+3*sdVal).toFixed(3),p2sd:+(mean+2*sdVal).toFixed(3),p1sd:+(mean+1*sdVal).toFixed(3),
      m3sd:+(mean-3*sdVal).toFixed(3),m2sd:+(mean-2*sdVal).toFixed(3),m1sd:+(mean-1*sdVal).toFixed(3),
      mn:+mean.toFixed(3),
      fill:rejectSet.has(i)?T.danger:violSet.has(i)?T.warn:T.ok,
    };
  });

  const CustomDot=(props)=>{
    const{cx,cy,payload}=props;
    if(cx==null||cy==null)return null;
    const isViol=violSet.has(payload.idx-1);
    const isRej=rejectSet.has(payload.idx-1);
    const color=isRej?T.danger:isViol?T.warn:T.blue;
    const r=isRej?6:isViol?5:3.5;
    return<circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={1.5}/>;
  };

  const TT=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    const p=payload[0]?.payload;
    const viol=violations.find(v=>v.idx===label-1);
    return(<div style={{background:T.surface,border:`1.5px solid ${T.borderM}`,borderRadius:9,padding:"10px 13px",fontFamily:T.mono,fontSize:11,boxShadow:"0 4px 14px rgba(14,165,233,.1)",maxWidth:220}}>
      <div style={{color:T.textS,marginBottom:4}}>Titik #{label}</div>
      <div style={{color:T.text,fontWeight:600}}>{p?.value} {unit}</div>
      <div style={{color:T.textT}}>z = {p?.z}</div>
      {viol&&<div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${T.border}`}}>
        {viol.rules.map(r=><div key={r.rule} style={{color:r.type==="reject"?T.danger:T.warn,fontSize:10}}>{r.rule}: {r.desc}</div>)}
      </div>}
    </div>);
  };

  return(<div style={{...CS,padding:20}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:T.text}}>Levey-Jennings Chart — {paramLabel}</div>
        <div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>{wardLabel} · n={values.length} · Mean={mean.toFixed(3)} · SD={sdVal.toFixed(3)}</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",fontSize:10,fontFamily:T.mono}}>
        <span style={{color:T.ok}}>● Normal</span>
        <span style={{color:T.warn}}>● Warning</span>
        <span style={{color:T.danger}}>● Reject</span>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{top:8,right:14,bottom:14,left:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
        <XAxis dataKey="idx" tick={{fontSize:9,fill:T.textT}} stroke={T.border} label={{value:"Urutan",position:"insideBottom",offset:-4,fill:T.textT,fontSize:9}}/>
        <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border} label={{value:unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:9}}/>
        <Tooltip content={<TT/>}/>

        {/* SD zone fills via reference lines */}
        <ReferenceLine y={mean+3*sdVal} stroke={T.danger} strokeWidth={1.5} strokeDasharray="4 3" label={{value:"+3SD",fill:T.danger,fontSize:8,position:"insideTopRight"}}/>
        <ReferenceLine y={mean+2*sdVal} stroke={T.warn} strokeWidth={1.2} strokeDasharray="4 3" label={{value:"+2SD",fill:T.warn,fontSize:8,position:"insideTopRight"}}/>
        <ReferenceLine y={mean+sdVal} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" label={{value:"+1SD",fill:T.textT,fontSize:8,position:"insideTopRight"}}/>
        <ReferenceLine y={mean} stroke={T.blue} strokeWidth={1.5} label={{value:"Mean",fill:T.blue,fontSize:8,position:"insideTopRight"}}/>
        <ReferenceLine y={mean-sdVal} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" label={{value:"-1SD",fill:T.textT,fontSize:8,position:"insideBottomRight"}}/>
        <ReferenceLine y={mean-2*sdVal} stroke={T.warn} strokeWidth={1.2} strokeDasharray="4 3" label={{value:"-2SD",fill:T.warn,fontSize:8,position:"insideBottomRight"}}/>
        <ReferenceLine y={mean-3*sdVal} stroke={T.danger} strokeWidth={1.5} strokeDasharray="4 3" label={{value:"-3SD",fill:T.danger,fontSize:8,position:"insideBottomRight"}}/>

        <Line dataKey="value" stroke={T.blue} strokeWidth={1.5} dot={<CustomDot/>} activeDot={false} name={paramLabel} connectNulls isAnimationActive={false}/>
      </ComposedChart>
    </ResponsiveContainer>
  </div>);
}

/* ══ WESTGARD PANEL ══ */
function WestgardPanel({violations}){
  if(!violations||violations.length===0) return(
    <div style={{...CS,padding:18}}>
      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>⚠️ Westgard Rules Checker</div>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#ecfdf5",borderRadius:10,border:`1.5px solid ${T.ok}44`}}>
        <div style={{fontSize:22}}>✅</div>
        <div><div style={{fontSize:13,fontWeight:600,color:T.ok}}>Semua rules terpenuhi</div><div style={{fontSize:11,color:T.textS}}>Tidak ada pelanggaran Westgard terdeteksi</div></div>
      </div>
    </div>
  );

  const ruleCount={};
  violations.forEach(v=>v.rules.forEach(r=>{ruleCount[r.rule]=(ruleCount[r.rule]||0)+1;}));
  const rejects=violations.filter(v=>v.rules.some(r=>r.type==="reject"));
  const warnings=violations.filter(v=>v.rules.every(r=>r.type==="warning"));

  return(<div style={{...CS,padding:18}}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>⚠️ Westgard Rules Checker</div>

    {/* Summary badges */}
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <div style={{padding:"8px 16px",borderRadius:10,background:T.danger+"12",border:`1.5px solid ${T.danger}44`,textAlign:"center"}}>
        <div style={{fontSize:22,fontWeight:700,color:T.danger,fontFamily:T.mono}}>{rejects.length}</div>
        <div style={{fontSize:10,color:T.danger}}>Rejection</div>
      </div>
      <div style={{padding:"8px 16px",borderRadius:10,background:T.warn+"12",border:`1.5px solid ${T.warn}44`,textAlign:"center"}}>
        <div style={{fontSize:22,fontWeight:700,color:T.warn,fontFamily:T.mono}}>{warnings.length}</div>
        <div style={{fontSize:10,color:T.warn}}>Warning</div>
      </div>
      {Object.entries(ruleCount).map(([rule,count])=>(
        <div key={rule} style={{padding:"8px 16px",borderRadius:10,background:T.surfB,border:`1.5px solid ${T.border}`,textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:700,color:T.text,fontFamily:T.mono}}>{count}x</div>
          <div style={{fontSize:11,fontWeight:600,color:T.purple,fontFamily:T.mono}}>{rule}</div>
        </div>
      ))}
    </div>

    {/* Violations table */}
    <div style={{overflowX:"auto",maxHeight:240,overflowY:"auto"}}>
      <table style={{fontSize:11}}>
        <thead>
          <tr style={{background:T.blueL}}>
            {["#","Titik","Nilai","z-score","Rule(s)","Tipe"].map(h=>(
              <th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:T.blueD,fontSize:10,letterSpacing:.5,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {violations.map((v,i)=>{
            const isRej=v.rules.some(r=>r.type==="reject");
            return(
              <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"transparent":T.surfB}}>
                <td style={{padding:"6px 10px",color:T.textT,fontFamily:T.mono}}>{i+1}</td>
                <td style={{padding:"6px 10px",color:T.text,fontFamily:T.mono}}>#{v.idx+1}</td>
                <td style={{padding:"6px 10px",color:T.text,fontFamily:T.mono,fontWeight:600}}>{v.value.toFixed(3)}</td>
                <td style={{padding:"6px 10px",color:isRej?T.danger:T.warn,fontFamily:T.mono,fontWeight:600}}>{v.z > 0 ? "+" : ""}{v.z}</td>
                <td style={{padding:"6px 10px"}}>
                  {v.rules.map(r=>(
                    <span key={r.rule} style={{display:"inline-block",padding:"1px 7px",borderRadius:10,background:r.type==="reject"?T.danger+"18":T.warn+"18",color:r.type==="reject"?T.danger:T.warn,fontSize:10,fontFamily:T.mono,fontWeight:600,marginRight:4}}>{r.rule}</span>
                  ))}
                </td>
                <td style={{padding:"6px 10px"}}>
                  <span style={{fontSize:10,fontWeight:600,color:isRej?T.danger:T.warn}}>{isRej?"REJECT":"WARNING"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Rules legend */}
    <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
      <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:8,letterSpacing:1}}>KETERANGAN RULES</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
        {[
          {rule:"1₂s",desc:"1 titik > ±2SD → Warning"},
          {rule:"1₃s",desc:"1 titik > ±3SD → Reject"},
          {rule:"2₂s",desc:"2 berturut > ±2SD → Reject"},
          {rule:"R₄s",desc:"Range 2 titik > 4SD → Reject"},
          {rule:"4₁s",desc:"4 berturut > ±1SD → Reject"},
          {rule:"10x",desc:"10 berturut 1 sisi → Reject"},
        ].map(r=>(
          <div key={r.rule} style={{fontSize:10,fontFamily:T.mono,color:T.textS}}>
            <span style={{fontWeight:700,color:T.purple}}>{r.rule}</span> — {r.desc}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ══ TREND PANEL ══ */
function TrendPanel({param, ward, paramLabel, unit}){
  const[trendData,setTrendData]=useState([]);
  const[loading,setLoading]=useState(false);
  const[period,setPeriod]=useState("monthly");
  const[dateFrom,setDateFrom]=useState(()=>new Date(Date.now()-90*86400000).toISOString().slice(0,10));
  const[dateTo,setDateTo]=useState(()=>new Date().toISOString().slice(0,10));
  const[err,setErr]=useState("");

  const loadTrend=useCallback(async()=>{
    setLoading(true);setErr("");
    try{
      let rows=[];
      if(period==="monthly"){
        rows=await db.getMonthly(param,ward);
      } else {
        const raw=await db.getSessionsRange(param,ward,dateFrom+"T00:00:00",dateTo+"T23:59:59");
        if(!raw.length){setTrendData([]);return;}

        // Group by period
        const groups={};
        raw.forEach(r=>{
          const d=new Date(r.recorded_at);
          let key;
          if(period==="weekly"){
            const wn=Math.ceil((d.getDate()-d.getDay()+1)/7);
            key=`${d.getFullYear()}-W${String(wn).padStart(2,"0")}`;
          } else if(period==="shift"){
            const h=d.getHours();
            const shift=h<8?"Malam":h<14?"Pagi":h<20?"Siang":"Malam";
            key=`${d.toLocaleDateString("id-ID",{day:"2-digit",month:"short"})} ${shift}`;
          } else {
            key=d.toISOString().slice(0,10);
          }
          if(!groups[key]) groups[key]=[];
          groups[key].push(r.value);
        });
        rows=Object.entries(groups).map(([k,vals])=>{
          const m=avg(vals),s=std(vals);
          return{period:k,mean_val:+m.toFixed(3),sd_val:+s.toFixed(3),cv_pct:+((s/m)*100).toFixed(2),n_count:vals.length};
        });
      }
      setTrendData(rows);
    }catch(e){setErr(e.message);}
    finally{setLoading(false);}
  },[param,ward,period,dateFrom,dateTo]);

  useEffect(()=>{loadTrend();},[loadTrend]);

  const TT=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    return(<div style={{background:T.surface,border:`1.5px solid ${T.borderM}`,borderRadius:9,padding:"9px 13px",fontFamily:T.mono,fontSize:11}}>
      <div style={{color:T.textS,marginBottom:4}}>{label}</div>
      {payload.map(p=><div key={p.dataKey} style={{color:p.color||T.text}}>{p.name}: {p.value}</div>)}
    </div>);
  };

  return(<div style={{...CS,padding:20}}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>📅 Tren Historis — {paramLabel} · {WARDS[ward]?.label}</div>

    {/* Filter controls */}
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div>
        <div style={LS}>Periode</div>
        <select value={period} onChange={e=>setPeriod(e.target.value)} style={{...SS,width:160}}>
          <option value="monthly">Per Bulan</option>
          <option value="weekly">Per Minggu</option>
          <option value="daily">Per Hari</option>
          <option value="shift">Per Shift</option>
        </select>
      </div>
      {period!=="monthly"&&<>
        <div><div style={LS}>Dari</div><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...IS,width:150}}/></div>
        <div><div style={LS}>Sampai</div><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...IS,width:150}}/></div>
      </>}
      <button className="pb" onClick={loadTrend} style={{...BP,display:"flex",alignItems:"center",gap:6}}>
        {loading?<><Sp/> Loading...</>:"↻ Refresh"}
      </button>
    </div>

    {err&&<div style={{color:T.danger,fontSize:12,marginBottom:10,fontFamily:T.mono}}>❌ {err}</div>}

    {!trendData.length&&!loading&&(
      <div style={{padding:24,textAlign:"center",color:T.textS,fontSize:13}}>Belum ada data historis tersimpan di Supabase untuk kombinasi ini.</div>
    )}

    {trendData.length>0&&(
      <>
        {/* Mean trend */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,marginBottom:8}}>Tren Mean ({unit})</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{top:4,right:14,bottom:14,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
              <XAxis dataKey={trendData[0]?.month!==undefined?"month":"period"} tick={{fontSize:9,fill:T.textT}} stroke={T.border}/>
              <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border}/>
              <Tooltip content={<TT/>}/>
              <Line dataKey="mean_val" stroke={T.blue} strokeWidth={2} dot={{r:4,fill:T.blue}} name={`Mean (${unit})`} connectNulls/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CV% trend */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,marginBottom:8}}>Tren CV% (Imprecision)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trendData} margin={{top:4,right:14,bottom:14,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
              <XAxis dataKey={trendData[0]?.month!==undefined?"month":"period"} tick={{fontSize:9,fill:T.textT}} stroke={T.border}/>
              <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border}/>
              <Tooltip content={<TT/>}/>
              <ReferenceLine y={5} stroke={T.warn} strokeDasharray="4 3" label={{value:"5%",fill:T.warn,fontSize:9}}/>
              <ReferenceLine y={10} stroke={T.danger} strokeDasharray="4 3" label={{value:"10%",fill:T.danger,fontSize:9}}/>
              <Bar dataKey="cv_pct" name="CV%" radius={[5,5,0,0]}
                fill={T.ok}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div style={{overflowX:"auto"}}>
          <table style={{fontSize:11}}>
            <thead>
              <tr style={{background:T.blueL}}>
                {["Periode","N","Mean","SD","CV%"].map(h=>(
                  <th key={h} style={{padding:"7px 12px",textAlign:"left",fontWeight:600,color:T.blueD,fontSize:10}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trendData.map((d,i)=>{
                const cv=d.cv_pct||0;
                const key=d.month||d.period;
                return(
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?"transparent":T.surfB}}>
                    <td style={{padding:"6px 12px",fontFamily:T.mono,color:T.text,fontWeight:600}}>{key}</td>
                    <td style={{padding:"6px 12px",fontFamily:T.mono,color:T.textS}}>{d.n_count}</td>
                    <td style={{padding:"6px 12px",fontFamily:T.mono,color:T.text}}>{d.mean_val?.toFixed(3)}</td>
                    <td style={{padding:"6px 12px",fontFamily:T.mono,color:T.textS}}>{d.sd_val?.toFixed(3)}</td>
                    <td style={{padding:"6px 12px",fontFamily:T.mono,fontWeight:600,color:cv>10?T.danger:cv>5?T.warn:T.ok}}>{cv?.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>);
}

/* ══ AI INTERPRET ══ */
function AIInterpret({apiKey,context,paramLabel,ward}){
  const[txt,setTxt]=useState(""),[loading,setLoading]=useState(false);
  const run=async()=>{setLoading(true);setTxt("");
    try{await aiChat(apiKey,[
      {role:"system",content:`Kamu konsultan QC laboratorium klinis senior (Sp.PK). Interpretasikan data PBRTQC secara singkat, klinis, dan actionable. Bahasa Indonesia formal. Paragraf pendek, maks 180 kata. Perhatikan konteks ruangan: ${ward||"umum"}.`},
      {role:"user",content:`Interpretasikan data QC:\n\n${context}`}
    ],t=>setTxt(t));}
    catch(e){setTxt(`❌ ${e.message}`);}finally{setLoading(false);}};
  return(<div style={{...CS,marginTop:16}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>✦ Interpretasi AI — {paramLabel}</div><div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>LLaMA 3.3 70B via Groq</div></div>
      <button className="pb" onClick={run} disabled={loading} style={{...BP,display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:11}}>{loading?<><Sp/> Menganalisis...</>:"▶ Generate"}</button>
    </div>
    {(txt||loading)&&<div style={{background:T.surfB,borderRadius:10,padding:14,border:`1.5px solid ${T.border}`,minHeight:60}}>
      {!txt&&loading?<div style={{display:"flex",gap:7,alignItems:"center",color:T.textT}}><Sp/><span className="pt" style={{fontSize:12,fontFamily:T.mono}}>AI menganalisis...</span></div>
      :<div style={{fontSize:13,color:T.text,lineHeight:1.75}} className="cb">{txt}{loading&&<span className="bl" style={{color:T.blue}}>▌</span>}</div>}
    </div>}
  </div>);
}

/* ══ CHATBOT ══ */
function Chatbot({apiKey,context}){
  const[msgs,setMsgs]=useState([{role:"assistant",content:"Halo! Tanyakan apapun tentang hasil QC, Westgard rules, atau interpretasi data laboratorium Anda."}]);
  const[input,setInput]=useState(""),[loading,setLoading]=useState(false);const endRef=useRef();
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const send=async()=>{if(!input.trim()||loading)return;const um={role:"user",content:input.trim()};setMsgs(p=>[...p,um,{role:"assistant",content:""}]);setInput("");setLoading(true);
    try{await aiChat(apiKey,[{role:"system",content:`Asisten analitik PBRTQC PasienQuC. Jawab dalam bahasa Indonesia profesional, maks 150 kata. Konteks:\n${context}`},...msgs.slice(-8),um],t=>setMsgs(p=>[...p.slice(0,-1),{role:"assistant",content:t}]));}
    catch(e){setMsgs(p=>[...p.slice(0,-1),{role:"assistant",content:`❌ ${e.message}`}]);}finally{setLoading(false);}};
  return(<div style={{...CS,display:"flex",flexDirection:"column",height:420}}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:2}}>✦ Chatbot Analitik</div>
    <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:10}}>Tanya bebas seputar QC & Westgard</div>
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:10,paddingRight:3}}>
      {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}} className="si">
        {m.role==="assistant"&&<div style={{width:22,height:22,borderRadius:7,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:6,marginTop:2}}><svg width="10" height="10" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
        <div style={{maxWidth:"78%",padding:"8px 11px",borderRadius:10,fontSize:12,background:m.role==="user"?T.blue:T.surfB,color:m.role==="user"?"#fff":T.text,border:m.role==="assistant"?`1px solid ${T.border}`:"none",borderBottomRightRadius:m.role==="user"?2:10,borderBottomLeftRadius:m.role==="assistant"?2:10}} className="cb">
          {m.content||(loading&&i===msgs.length-1?<span className="pt">✦ Mengetik...</span>:"")}{loading&&i===msgs.length-1&&m.content&&<span className="bl" style={{color:T.blue}}>▌</span>}
        </div>
      </div>))}
      <div ref={endRef}/>
    </div>
    <div style={{display:"flex",gap:6}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ketik pertanyaan..." style={{...IS,flex:1,padding:"7px 11px",fontSize:12}} disabled={loading}/><button className="pb" onClick={send} disabled={loading||!input.trim()} style={{...BP,padding:"7px 14px",opacity:loading||!input.trim()?.6:1}}>{loading?<Sp/>:"→"}</button></div>
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}>{["Kenapa CV tinggi?","Westgard 1₃s artinya?","Apa tindakan jika reject?","Drift vs Shift bedanya?"].map(q=><button key={q} className="sb" onClick={()=>setInput(q)} style={{...BS,padding:"3px 9px",fontSize:10,borderRadius:20}}>{q}</button>)}</div>
  </div>);
}

/* ══ NARRATIVE REPORT ══ */
function NarrativeReport({apiKey,context,paramLabel,ward}){
  const[txt,setTxt]=useState(""),[loading,setLoading]=useState(false),[done,setDone]=useState(false),[fmt,setFmt]=useState("formal");
  const fmts={formal:"Laporan formal ISO 15189",ringkas:"Ringkasan eksekutif",rekomendasi:"Action plan teknis"};
  const run=async()=>{setLoading(true);setTxt("");setDone(false);const date=new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
    try{await aiChat(apiKey,[{role:"system",content:`Konsultan QC senior. Tulis narasi laporan QC profesional. Format: ${fmts[fmt]}. Bahasa Indonesia formal, paragraf mengalir, siap cetak. Sertakan: tanggal, parameter, ruangan, performa, temuan Westgard, rekomendasi. 250-320 kata.`},{role:"user",content:`Tulis laporan QC tanggal ${date} untuk ${paramLabel} dari ruang ${ward||"umum"}.\n\n${context}`}],t=>setTxt(t));setDone(true);}
    catch(e){setTxt(`❌ ${e.message}`);setDone(true);}finally{setLoading(false);}};
  return(<div style={CS}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:2}}>✦ Narasi Laporan Otomatis</div>
    <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:12}}>AI menulis laporan QC siap cetak</div>
    <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      {Object.entries(fmts).map(([k])=><button key={k} className="pill" onClick={()=>setFmt(k)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${fmt===k?T.blue:T.border}`,background:fmt===k?T.blueL:"transparent",color:fmt===k?T.blueD:T.textS,fontSize:11,fontWeight:fmt===k?600:400}}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>)}
      <button className="pb" onClick={run} disabled={loading} style={{...BP,marginLeft:"auto",display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:11}}>{loading?<><Sp/> Menulis...</>:"▶ Generate"}</button>
    </div>
    {(txt||loading)&&<div style={{background:T.surfB,borderRadius:10,padding:16,border:`1.5px solid ${T.border}`,minHeight:90}}>
      {!txt&&loading?<div style={{display:"flex",gap:7,alignItems:"center",color:T.textT}}><Sp/><span className="pt" style={{fontSize:12,fontFamily:T.mono}}>AI menyusun narasi...</span></div>
      :<><div style={{fontSize:13,color:T.text,lineHeight:1.85,whiteSpace:"pre-wrap"}} className="cb">{txt}{loading&&<span className="bl" style={{color:T.blue}}>▌</span>}</div>
      {done&&<div style={{display:"flex",gap:8,marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
        <button className="sb" onClick={()=>navigator.clipboard.writeText(txt)} style={{...BS,padding:"5px 12px",fontSize:11}}>⎘ Salin</button>
        <button className="sb" onClick={()=>{const b=new Blob([txt],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`PasienQuC_${paramLabel}_${new Date().toISOString().slice(0,10)}.txt`;a.click();}} style={{...BS,padding:"5px 12px",fontSize:11}}>↓ Download</button>
      </div>}</>}
    </div>}
  </div>);
}

/* ══ STAT CARD ══ */
function StatCard({label,value,unit,color,delay=0,warn=false}){
  return(<div className="ch fu" style={{animationDelay:`${delay}ms`,background:T.surface,border:`1.5px solid ${warn?T.danger:T.border}`,borderRadius:13,padding:"12px 15px",borderTop:`3px solid ${color||T.blue}`,minWidth:0}}>
    <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:4}}>{label}</div>
    <div style={{fontSize:20,fontWeight:700,color:warn?T.danger:T.text,lineHeight:1}}>{value}</div>
    <div style={{fontSize:10,color:T.textS,marginTop:2,fontFamily:T.mono}}>{unit}</div>
  </div>);
}

/* ══ MAIN QC PANEL ══ */
function QCPanel({data,cfg,blockSize,mult,useAoN,selMethods,apiKey,wardKey,wardLabel,paramLabel,param,onSave}){
  const working=useMemo(()=>!data?null:useAoN?data.filter(v=>v>=cfg.refLow&&v<=cfg.refHigh):data,[data,useAoN,cfg]);
  const series=useMemo(()=>{if(!working||working.length<blockSize)return null;return{MA:calcMA(working,blockSize),EWMA:calcEWMA(working),TRIM:calcTrim(working,blockSize,cfg.trim),MEDIAN:calcMed(working,blockSize)};},[working,blockSize,cfg]);
  const limits=useMemo(()=>{if(!series)return null;const o={};Object.keys(series).forEach(m=>{o[m]=getLimits(series[m],mult);});return o;},[series,mult]);
  const violations=useMemo(()=>{if(!series||!limits)return null;const o={};Object.keys(series).forEach(m=>{o[m]=series[m].map((v,i)=>({idx:i,value:v,viol:v!==null&&(v>limits[m].ucl||v<limits[m].lcl)})).filter(d=>d.viol);});return o;},[series,limits]);
  const stats=useMemo(()=>{if(!working||!working.length)return null;const m=avg(working),s=std(working);return{n:working.length,mean:m,sd:s,cv:(s/m)*100,median:med(working)};},[working]);
  const ljMean=stats?.mean||0,ljSd=stats?.sd||1;
  const wgViolations=useMemo(()=>working?checkWestgard(working,ljMean,ljSd):[],[working,ljMean,ljSd]);
  const chartData=useMemo(()=>{if(!working||!series)return[];return working.map((v,i)=>{const p={idx:i+1,raw:+v.toFixed(3)};Object.keys(series).forEach(m=>{if(series[m][i]!==null)p[m]=series[m][i];});return p;});},[working,series]);

  const aiCtx=useMemo(()=>{
    if(!stats||!limits)return"Belum ada data.";
    let c=`Parameter: ${paramLabel} (${cfg.unit}) | Ruang: ${wardLabel}\nN=${stats.n} Mean=${stats.mean.toFixed(3)} SD=${stats.sd.toFixed(3)} CV=${stats.cv.toFixed(2)}% Median=${stats.median.toFixed(3)}\n`;
    selMethods.forEach(m=>{if(limits[m])c+=`${METHODS[m].label}: UCL=${limits[m].ucl.toFixed(3)} LCL=${limits[m].lcl.toFixed(3)} Violations=${violations?.[m]?.length??0}\n`;});
    const rejects=wgViolations.filter(v=>v.rules.some(r=>r.type==="reject"));
    c+=`Westgard: Total=${wgViolations.length} Reject=${rejects.length}\n`;
    return c;
  },[stats,limits,violations,selMethods,paramLabel,cfg,wardLabel,wgViolations]);

  const[saving,setSaving]=useState(false),[savedMsg,setSavedMsg]=useState("");
  const saveToDb=async()=>{
    if(!working||!stats)return;
    setSaving(true);setSavedMsg("");
    try{
      const rows=working.map((v,i)=>({
        param,ward:wardKey,value:v,
        recorded_at:new Date(Date.now()-((working.length-1-i)*3600000)).toISOString(),
      }));
      await db.saveSessions(rows);
      setSavedMsg(`✅ ${rows.length} data tersimpan ke Supabase`);
      onSave&&onSave();
    }catch(e){setSavedMsg(`❌ ${e.message}`);}
    finally{setSaving(false);}
  };

  const TT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:T.surface,border:`1.5px solid ${T.borderM}`,borderRadius:8,padding:"8px 12px",fontFamily:T.mono,fontSize:10,boxShadow:"0 4px 14px rgba(14,165,233,.09)"}}><div style={{color:T.textS,marginBottom:3}}>Pasien #{label}</div>{payload.map(p=><div key={p.dataKey} style={{color:p.color||T.text,marginBottom:1}}>{p.dataKey}: {typeof p.value==="number"?p.value.toFixed(3):p.value}</div>)}</div>);};

  if(!data||data.length<blockSize)return(<div style={{...CS,textAlign:"center",padding:28}}>
    <div style={{fontSize:13,color:T.textS}}>Belum ada data — {wardLabel}</div>
    <div style={{fontSize:10,color:T.textT,marginTop:5,fontFamily:T.mono}}>Min {blockSize} data diperlukan</div>
  </div>);

  return(<div>
    {/* Stats */}
    {stats&&<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:9,marginBottom:16}}>
      <StatCard label="N" value={stats.n} unit="data" color={T.blue} delay={0}/>
      <StatCard label="Mean" value={stats.mean.toFixed(2)} unit={cfg.unit} color={T.blue} delay={50}/>
      <StatCard label="SD" value={stats.sd.toFixed(3)} unit="" color={T.ok} delay={100}/>
      <StatCard label="CV%" value={stats.cv.toFixed(2)+"%"} unit="" color={stats.cv>10?T.danger:T.warn} warn={stats.cv>10} delay={150}/>
      <StatCard label="WG Violations" value={wgViolations.filter(v=>v.rules.some(r=>r.type==="reject")).length} unit="rejections" color={T.danger} warn={wgViolations.some(v=>v.rules.some(r=>r.type==="reject"))} delay={200}/>
    </div>}

    {/* Save to Supabase */}
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16}}>
      <button className="pb" onClick={saveToDb} disabled={saving} style={{...BP,display:"flex",alignItems:"center",gap:6,padding:"7px 16px",fontSize:11,background:"#0369a1"}}>
        {saving?<><Sp/> Menyimpan...</>:"☁️ Simpan ke Supabase"}
      </button>
      {savedMsg&&<div style={{fontSize:12,color:savedMsg.startsWith("✅")?T.ok:T.danger,fontFamily:T.mono}}>{savedMsg}</div>}
    </div>

    {/* Levey-Jennings Chart */}
    {stats&&<div style={{marginBottom:16}}><LJChart values={working} mean={stats.mean} sdVal={stats.sd} paramLabel={paramLabel} wardLabel={wardLabel} unit={cfg.unit} violations={wgViolations}/></div>}

    {/* PBRTQC Chart */}
    {chartData.length>0&&series&&limits&&<div style={{...CS,padding:18,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>PBRTQC Control Chart — {paramLabel}</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{top:4,right:12,bottom:12,left:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
          <XAxis dataKey="idx" tick={{fontSize:9,fill:T.textT}} stroke={T.border}/>
          <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border} label={{value:cfg.unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:9}}/>
          <Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:10,paddingTop:5}}/>
          <Line dataKey="raw" stroke="rgba(14,165,233,.14)" dot={false} strokeWidth={1} name="Raw" legendType="none"/>
          <ReferenceLine y={cfg.refHigh} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.4}/>
          <ReferenceLine y={cfg.refLow} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.4}/>
          {selMethods.map(m=>[
            <Line key={m} dataKey={m} stroke={METHODS[m].color} dot={false} strokeWidth={2} name={METHODS[m].label} connectNulls strokeDasharray={METHODS[m].dash}/>,
            <ReferenceLine key={m+"u"} y={limits[m].ucl} stroke={METHODS[m].color} strokeDasharray="2 5" strokeOpacity={.3}/>,
            <ReferenceLine key={m+"l"} y={limits[m].lcl} stroke={METHODS[m].color} strokeDasharray="2 5" strokeOpacity={.3}/>,
          ])}
        </LineChart>
      </ResponsiveContainer>
    </div>}

    {/* Westgard */}
    <div style={{marginBottom:14}}><WestgardPanel violations={wgViolations}/></div>

    {/* AI */}
    <AIInterpret apiKey={apiKey} context={aiCtx} paramLabel={paramLabel} ward={wardLabel}/>
  </div>);
}

/* ══ MAIN APP ══ */
export default function PasienQuC(){
  const[apiKey,setApiKey]=useState("");
  const[tab,setTab]=useState("dashboard");
  const[group,setGroup]=useState("HEMATOLOGI");
  const[param,setParam]=useState("Hb");
  const[selWards,setSelWards]=useState(["IGD"]);
  const[viewMode,setViewMode]=useState("single");
  const[blockSize,setBlockSize]=useState(20);
  const[mult,setMult]=useState(2);
  const[useAoN,setUseAoN]=useState(false);
  const[selMethods,setSelMethods]=useState(["MA","EWMA","TRIM","MEDIAN"]);
  const[wardData,setWardData]=useState({});
  const[pasteText,setPasteText]=useState("");
  const[mounted,setMounted]=useState(false);
  const fileRef=useRef();

  useEffect(()=>{setTimeout(()=>setMounted(true),60);},[]);
  useEffect(()=>{const first=Object.keys(PARAM_GROUPS[group].params)[0];setParam(first);},[group]);

  const cfg=PARAM_GROUPS[group]?.params[param];
  const currentWard=selWards[0]||"IGD";
  const key=(g,p,w)=>`${g}_${p}_${w}`;
  const getWardRaw=w=>wardData?.[key(group,param,w)]?.raw||null;
  const setWardRaw=(w,raw)=>setWardData(p=>({...p,[key(group,param,w)]:{raw}}));
  const loadDemo=w=>{if(cfg)setWardRaw(w,genDemo(cfg,w,130));};

  const handleFile=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPasteText(ev.target.result);r.readAsText(f);};
  const handlePaste=w=>{
    const p=parseCSV(pasteText);if(!p)return alert("Format tidak dikenali.");
    const col=p.hdr.find(h=>h.toLowerCase().includes(param.toLowerCase()))||p.hdr.find(h=>p.rows.every(r=>!isNaN(parseFloat(r[h]))));
    if(!col)return alert("Kolom numerik tidak ditemukan.");
    setWardRaw(w,p.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v)));
  };

  const combinedRaw=useMemo(()=>{const all=selWards.flatMap(w=>getWardRaw(w)||[]);return all.length?all:null;},[wardData,selWards,group,param]);
  const allWardStats=useMemo(()=>{const out={};Object.keys(WARDS).forEach(w=>{const raw=getWardRaw(w);if(!raw||raw.length<2)return;const m=avg(raw),s=std(raw);out[w]={stats:{n:raw.length,mean:m,sd:s,cv:(s/m)*100,median:med(raw)}};});return out;},[wardData,group,param]);
  const aiCtxGlobal=useMemo(()=>{let c=`PasienQuC · ${PARAM_GROUPS[group].label} · ${cfg?.label||param}\n`;selWards.forEach(w=>{const raw=getWardRaw(w);if(!raw)return;const m=avg(raw),s=std(raw);c+=`${WARDS[w].label}: N=${raw.length} Mean=${m.toFixed(3)} CV=${((s/m)*100).toFixed(2)}%\n`;});return c;},[wardData,selWards,group,param,cfg]);

  const toggleMethod=m=>setSelMethods(p=>p.includes(m)?p.filter(x=>x!==m):[...p,m]);
  const TABS=["dashboard","ai","tren","data","report"];

  if(!apiKey)return <ApiKeyPage onConnect={setApiKey}/>;

  return(<div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",color:T.text,opacity:mounted?1:0,transition:"opacity .4s"}}>

    {/* HEADER */}
    <div style={{background:T.surface,borderBottom:`1.5px solid ${T.border}`,padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 14px rgba(14,165,233,.05)"}}>
      <div style={{display:"flex",alignItems:"center",gap:11}}>
        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(14,165,233,.24)"}}><svg width="17" height="17" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="14" r="1.5" fill="white"/><circle cx="19" cy="8" r="1.5" fill="white"/></svg></div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:T.text,letterSpacing:-.3}}>PasienQuC <span style={{color:T.blue}}>·</span> v.0.4.0</div>
          <div style={{fontSize:9,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>LJ Chart · Westgard · Tren · Supabase · AI</div>
        </div>
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        {TABS.map(t=><button key={t} className="tb" onClick={()=>setTab(t)} style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${tab===t?T.blue:T.border}`,background:tab===t?T.blue:"transparent",color:tab===t?"#fff":T.textS,fontSize:11,fontFamily:T.font,fontWeight:tab===t?600:400,textTransform:"capitalize"}}>{t==="ai"?"✦ AI":t==="tren"?"📅 Tren":t}</button>)}
        <div style={{marginLeft:5,display:"flex",alignItems:"center",gap:4,padding:"4px 8px",background:T.surfB,borderRadius:6,border:`1px solid ${T.border}`}}><div style={{width:5,height:5,borderRadius:"50%",background:T.ok}}/><span style={{fontSize:9,color:T.textS,fontFamily:T.mono}}>Supabase</span></div>
        <button className="sb" onClick={()=>setApiKey("")} style={{padding:"4px 9px",background:"transparent",border:`1.5px solid ${T.danger}44`,borderRadius:7,color:T.danger,fontSize:11,fontFamily:T.font,cursor:"pointer"}}>Logout</button>
      </div>
    </div>

    <div style={{padding:"18px 24px"}}>

      {/* GLOBAL CONTROLS */}
      <div className="fu" style={{...CS,padding:15,marginBottom:15}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:11}}>
          <div><div style={LS}>Kelompok Parameter</div><GroupSel selected={group} onChange={setGroup}/></div>
          <div><div style={LS}>Parameter</div><select value={param} onChange={e=>setParam(e.target.value)} style={SS}>{Object.entries(PARAM_GROUPS[group]?.params||{}).map(([k,v])=><option key={k} value={k}>{v.label} ({v.unit})</option>)}</select></div>
        </div>
        <div style={{marginBottom:11}}><div style={LS}>Ruang Perawatan</div><WardSel selected={selWards} onChange={setSelWards} multi={true}/></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
          <div><div style={LS}>Tampilan</div><select value={viewMode} onChange={e=>setViewMode(e.target.value)} style={SS}><option value="single">Per Ruangan</option><option value="combined">Gabungan</option><option value="compare">Perbandingan</option></select></div>
          <div><div style={LS}>Block Size (n)</div><input type="number" min={5} max={100} value={blockSize} onChange={e=>setBlockSize(+e.target.value)} style={IS}/></div>
          <div><div style={LS}>Control Limit</div><select value={mult} onChange={e=>setMult(+e.target.value)} style={SS}>{[1.5,2,2.5,3].map(v=><option key={v} value={v}>± {v} SD</option>)}</select></div>
          <div><div style={LS}>AoN Filter</div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:7}}>
              <div className="tog" onClick={()=>setUseAoN(!useAoN)} style={{width:36,height:20,borderRadius:10,background:useAoN?T.blue:"#cbd5e1",position:"relative"}}><div style={{position:"absolute",top:2,left:useAoN?17:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.12)"}}/></div>
              <span style={{fontSize:11,color:useAoN?T.blue:T.textT}}>{useAoN?"Aktif":"Nonaktif"}</span>
            </div>
            <div style={{fontSize:9,color:T.textT,fontFamily:T.mono,marginTop:2}}>{cfg?.refLow}–{cfg?.refHigh} {cfg?.unit}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {Object.entries(METHODS).map(([k,v])=>{const on=selMethods.includes(k);return(<div key={k} className="pill" onClick={()=>toggleMethod(k)} style={{padding:"4px 11px",borderRadius:20,border:`1.5px solid ${on?v.color:T.border}`,background:on?v.color+"10":"transparent",color:on?v.color:T.textS,fontSize:11,fontWeight:on?600:400}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:on?v.color:T.border,marginRight:4,verticalAlign:"middle"}}/>{v.label}</div>);})}
        </div>
      </div>

      {/* DASHBOARD */}
      {tab==="dashboard"&&<div className="fi">
        {viewMode==="single"&&<div>
          {selWards.length===0&&<div style={{...CS,padding:26,textAlign:"center",color:T.textS}}>Pilih minimal satu ruang perawatan.</div>}
          {selWards.map(w=>{const raw=getWardRaw(w);return(<div key={w} style={{marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:11}}>
              <div style={{width:32,height:32,borderRadius:9,background:WARDS[w].color+"15",border:`2px solid ${WARDS[w].color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{WARDS[w].icon}</div>
              <div><div style={{fontSize:14,fontWeight:700,color:T.text}}>{WARDS[w].label}</div><div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>{PARAM_GROUPS[group].label} · {cfg?.label}</div></div>
              <div style={{marginLeft:"auto",display:"flex",gap:7}}>
                <button className="pb" onClick={()=>loadDemo(w)} style={{...BP,padding:"5px 12px",fontSize:11}}>▶ Demo</button>
                <button className="sb" onClick={()=>setTab("data")} style={{...BS,padding:"5px 12px",fontSize:11}}>↑ Upload</button>
              </div>
            </div>
            {!raw?<div style={{...CS,padding:20,textAlign:"center"}}>
              <div style={{fontSize:13,color:T.textS,marginBottom:10}}>Belum ada data untuk {WARDS[w].label}</div>
              <div style={{display:"flex",gap:7,justifyContent:"center"}}>
                <button className="pb" onClick={()=>loadDemo(w)} style={BP}>▶ Load Demo</button>
                <button className="sb" onClick={()=>setTab("data")} style={BS}>↑ Upload CSV</button>
              </div>
            </div>:
            <QCPanel data={raw} cfg={cfg} blockSize={blockSize} mult={mult} useAoN={useAoN} selMethods={selMethods} apiKey={apiKey} wardKey={w} wardLabel={WARDS[w].label} paramLabel={cfg?.label} param={param}/>}
          </div>);})}
        </div>}

        {viewMode==="combined"&&<div>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Gabungan — {selWards.map(w=>WARDS[w].label).join(" + ")}</div>
            {selWards.filter(w=>!getWardRaw(w)).map(w=><button key={w} className="pb" onClick={()=>loadDemo(w)} style={{...BP,padding:"4px 10px",fontSize:10}}>{WARDS[w].icon} Demo {WARDS[w].label}</button>)}
          </div>
          {!combinedRaw?<div style={{...CS,padding:26,textAlign:"center"}}>
            <div style={{fontSize:13,color:T.textS,marginBottom:11}}>Load data untuk setiap ruangan yang dipilih.</div>
            <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>{selWards.map(w=><button key={w} className="pb" onClick={()=>loadDemo(w)} style={{...BP,padding:"6px 12px",fontSize:11}}>{WARDS[w].icon} {WARDS[w].label}</button>)}</div>
          </div>:
          <QCPanel data={combinedRaw} cfg={cfg} blockSize={blockSize} mult={mult} useAoN={useAoN} selMethods={selMethods} apiKey={apiKey} wardKey={currentWard} wardLabel="Gabungan" paramLabel={cfg?.label} param={param}/>}
        </div>}

        {viewMode==="compare"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Perbandingan Ruangan — {cfg?.label}</div>
            <div style={{display:"flex",gap:6}}>{selWards.map(w=><button key={w} className="pb" onClick={()=>loadDemo(w)} style={{...BP,padding:"4px 10px",fontSize:10}}>{WARDS[w].icon} Demo</button>)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {selWards.map(w=>{const raw=getWardRaw(w);const s=allWardStats[w]?.stats;
              if(!raw)return(<div key={w} style={{...CS,padding:18,textAlign:"center"}}><div style={{fontSize:22,marginBottom:5}}>{WARDS[w].icon}</div><div style={{fontSize:12,fontWeight:600,color:WARDS[w].color,marginBottom:7}}>{WARDS[w].label}</div><button className="pb" onClick={()=>loadDemo(w)} style={{...BP,padding:"5px 12px",fontSize:11}}>▶ Load Demo</button></div>);
              const wgV=checkWestgard(raw,s.mean,s.sd);
              const rejCount=wgV.filter(v=>v.rules.some(r=>r.type==="reject")).length;
              return(<div key={w} style={{...CS,padding:16,borderTop:`3px solid ${WARDS[w].color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><span style={{fontSize:18}}>{WARDS[w].icon}</span><div style={{fontSize:13,fontWeight:700,color:WARDS[w].color}}>{WARDS[w].label}</div><div style={{marginLeft:"auto",fontSize:10,fontFamily:T.mono,color:T.textT}}>n={s?.n}</div></div>
                {s&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7}}>
                  {[["Mean",s.mean.toFixed(2),T.blue],["CV%",s.cv.toFixed(2)+"%",s.cv>10?T.danger:T.warn],["Median",s.median.toFixed(2),T.purple],["WG Rej",rejCount,rejCount>0?T.danger:T.ok]].map(([l,v,c])=>(
                    <div key={l} style={{background:T.surfB,borderRadius:7,padding:"7px 9px",textAlign:"center"}}>
                      <div style={{fontSize:9,color:T.textT,fontFamily:T.mono,marginBottom:2,letterSpacing:1}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>}
              </div>);
            })}
          </div>
        </div>}
      </div>}

      {/* AI TAB */}
      {tab==="ai"&&<div className="fi">
        <div style={{marginBottom:14}}><div style={{fontSize:18,fontWeight:700,color:T.text}}>✦ Fitur AI PasienQuC</div><div style={{fontSize:11,color:T.textS,marginTop:2,fontFamily:T.mono}}>LLaMA 3.3 70B via Groq · {cfg?.label} ({cfg?.unit})</div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <AIInterpret apiKey={apiKey} context={aiCtxGlobal} paramLabel={cfg?.label} ward={selWards.map(w=>WARDS[w].label).join(", ")}/>
          <Chatbot apiKey={apiKey} context={aiCtxGlobal}/>
        </div>
        <NarrativeReport apiKey={apiKey} context={aiCtxGlobal} paramLabel={cfg?.label} ward={selWards.map(w=>WARDS[w].label).join(", ")}/>
      </div>}

      {/* TREN TAB */}
      {tab==="tren"&&<div className="fi">
        <div style={{marginBottom:14}}><div style={{fontSize:18,fontWeight:700,color:T.text}}>📅 Tren Historis</div><div style={{fontSize:11,color:T.textS,marginTop:2,fontFamily:T.mono}}>Data dari Supabase · {cfg?.label}</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {selWards.map(w=><TrendPanel key={w} param={param} ward={w} paramLabel={cfg?.label} unit={cfg?.unit}/>)}
        </div>
      </div>}

      {/* DATA TAB */}
      {tab==="data"&&<div className="fi">
        <div style={{...CS,padding:20,marginBottom:15}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Upload / Input Data</div>
          <div style={{marginBottom:11}}><div style={LS}>Pilih Ruangan Target</div><WardSel selected={[currentWard]} onChange={w=>setSelWards([w[0]])} multi={false}/></div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{display:"none"}}/>
            <button className="pb" onClick={()=>fileRef.current.click()} style={BP}>↑ Pilih File CSV</button>
            <button className="pb" onClick={()=>loadDemo(currentWard)} style={{...BP,background:T.ok}}>▶ Demo {WARDS[currentWard].icon} {WARDS[currentWard].label}</button>
          </div>
          <div style={{fontSize:10,color:T.textT,marginBottom:8,fontFamily:T.mono}}>Format CSV dengan header nama parameter. Contoh: Hb, Na, PT, pH, CRP, dll.</div>
          <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={"Paste CSV...\nContoh:\nHb\n12.5\n13.2"} style={{width:"100%",height:120,background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:9,color:T.text,padding:12,fontSize:12,fontFamily:T.mono,resize:"vertical"}}/>
          <button className="pb" onClick={()=>handlePaste(currentWard)} style={{...BP,marginTop:9}}>▶ Proses ke {WARDS[currentWard].label}</button>
        </div>
        <div style={{...CS,padding:18}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Status Data — {cfg?.label}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
            {Object.entries(WARDS).map(([k,v])=>{const raw=getWardRaw(k);return(<div key={k} style={{background:raw?v.color+"0c":T.surfB,border:`1.5px solid ${raw?v.color+"44":T.border}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:17,marginBottom:3}}>{v.icon}</div>
              <div style={{fontSize:12,fontWeight:600,color:raw?v.color:T.textS}}>{v.label}</div>
              {raw?<><div style={{fontSize:13,fontWeight:700,color:T.text,marginTop:4,fontFamily:T.mono}}>{raw.length} <span style={{fontSize:10,color:T.textT}}>data</span></div>
              <button className="sb" onClick={()=>setWardData(p=>{const n={...p};delete n[key(group,param,k)];return n;})} style={{...BS,padding:"2px 8px",fontSize:10,marginTop:6,borderRadius:6,color:T.danger,borderColor:`${T.danger}44`}}>Hapus</button>
              </>:<div style={{fontSize:11,color:T.textT,marginTop:4}}>Belum ada data</div>}
            </div>);})}
          </div>
        </div>
      </div>}

      {/* REPORT TAB */}
      {tab==="report"&&<div className="fi">
        <div style={{marginBottom:14}}><div style={{fontSize:18,fontWeight:700,color:T.text}}>Laporan QC</div><div style={{fontSize:11,color:T.textS,marginTop:2,fontFamily:T.mono}}>{cfg?.label} · {selWards.map(w=>WARDS[w].label).join(", ")}</div></div>
        <div style={{...CS,padding:20,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:11}}>Ringkasan Data</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
            {selWards.map(w=>{const raw=getWardRaw(w);if(!raw)return null;const m=avg(raw),s=std(raw),c=(s/m)*100,wgV=checkWestgard(raw,m,s),rej=wgV.filter(v=>v.rules.some(r=>r.type==="reject")).length;return(<div key={w} style={{background:T.surfB,borderRadius:9,padding:14,borderLeft:`3px solid ${WARDS[w].color}`}}>
              <div style={{fontSize:12,fontWeight:600,color:WARDS[w].color,marginBottom:6}}>{WARDS[w].icon} {WARDS[w].label}</div>
              <div style={{fontSize:11,fontFamily:T.mono,color:T.text,lineHeight:1.9}}>
                N: {raw.length}<br/>Mean: {m.toFixed(3)} {cfg?.unit}<br/>SD: {s.toFixed(3)}<br/>
                CV%: <span style={{color:c>10?T.danger:c>5?T.warn:T.ok,fontWeight:600}}>{c.toFixed(2)}%</span><br/>
                WG Reject: <span style={{color:rej>0?T.danger:T.ok,fontWeight:600}}>{rej}</span>
              </div>
            </div>);})}
          </div>
          <button className="pb" onClick={()=>{
            const rows=["Ruangan,N,Mean,SD,CV%,Median,WG_Reject"];
            selWards.forEach(w=>{const raw=getWardRaw(w);if(!raw)return;const m=avg(raw),s=std(raw),wgV=checkWestgard(raw,m,s),rej=wgV.filter(v=>v.rules.some(r=>r.type==="reject")).length;rows.push(`${WARDS[w].label},${raw.length},${m.toFixed(3)},${s.toFixed(3)},${((s/m)*100).toFixed(2)}%,${med(raw).toFixed(3)},${rej}`);});
            const blob=new Blob([rows.join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`PasienQuC_${param}_summary.csv`;a.click();
          }} style={{...BP,marginTop:12}}>↓ Export Summary CSV</button>
        </div>
        <NarrativeReport apiKey={apiKey} context={aiCtxGlobal} paramLabel={cfg?.label} ward={selWards.map(w=>WARDS[w].label).join(", ")}/>
      </div>}
    </div>

    {/* FOOTER */}
    <div style={{borderTop:`1.5px solid ${T.border}`,background:T.surface,padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="11" height="11" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></div><span style={{fontSize:12,fontWeight:700,color:T.text}}>PasienQuC</span><span style={{fontSize:9,color:T.textT,fontFamily:T.mono,background:T.blueL,padding:"2px 6px",borderRadius:5}}>v.0.4.0</span></div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{fontSize:11,color:T.textS,fontFamily:T.mono}}>Aplikasi dibuat oleh <span style={{color:T.blue,fontWeight:600}}>dr. WIY</span></div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{fontSize:11,color:T.textT,fontFamily:T.mono}}>April 2026</div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.textT,fontFamily:T.mono}}><div style={{width:5,height:5,borderRadius:"50%",background:T.ok}}/>Groq · LLaMA 3.3 70B · Supabase</div>
    </div>
  </div>);
}
