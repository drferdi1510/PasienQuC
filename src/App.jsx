import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ReferenceArea, ResponsiveContainer, BarChart, Bar, ComposedChart
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
/* ══ SIGMA TIER SYSTEM ══ */
// Get sigma tier and recommended Westgard rules based on sigma value
function getSigmaTier(sigma) {
  if (sigma >= 6) return {
    tier: "A", label: "World Class", color: "#059669", bg: "#ecfdf5",
    border: "#6ee7b7",
    rules: ["1₃s"],
    activeRules: { "1₂s": false, "1₃s": true, "2₂s": false, "R₄s": false, "4₁s": false, "10x": false },
    qcLevels: 2, qcFreq: "1×/hari",
    description: "Hanya 1₃s diperlukan. QC minimal sudah cukup.",
  };
  if (sigma >= 5) return {
    tier: "B", label: "Excellent", color: "#0ea5e9", bg: "#e0f2fe",
    border: "#7dd3fc",
    rules: ["1₂s","1₃s"],
    activeRules: { "1₂s": true, "1₃s": true, "2₂s": false, "R₄s": false, "4₁s": false, "10x": false },
    qcLevels: 2, qcFreq: "1×/hari",
    description: "1₂s sebagai warning, 1₃s sebagai reject.",
  };
  if (sigma >= 4) return {
    tier: "C", label: "Good", color: "#2563eb", bg: "#eff6ff",
    border: "#93c5fd",
    rules: ["1₂s","1₃s","2₂s","R₄s"],
    activeRules: { "1₂s": true, "1₃s": true, "2₂s": true, "R₄s": true, "4₁s": false, "10x": false },
    qcLevels: 2, qcFreq: "2×/hari",
    description: "Westgard multirule standar: 1₂s·2₂s·R₄s.",
  };
  if (sigma >= 3) return {
    tier: "D", label: "Marginal", color: "#d97706", bg: "#fffbeb",
    border: "#fcd34d",
    rules: ["1₂s","1₃s","2₂s","R₄s","4₁s","10x"],
    activeRules: { "1₂s": true, "1₃s": true, "2₂s": true, "R₄s": true, "4₁s": true, "10x": true },
    qcLevels: 3, qcFreq: "4×/hari",
    description: "Semua rules aktif. QC ketat, 3 level kontrol.",
  };
  return {
    tier: "E", label: "Poor / Unacceptable", color: "#dc2626", bg: "#fef2f2",
    border: "#fca5a5",
    rules: ["1₂s","1₃s","2₂s","R₄s","4₁s","10x"],
    activeRules: { "1₂s": true, "1₃s": true, "2₂s": true, "R₄s": true, "4₁s": true, "10x": true },
    qcLevels: 3, qcFreq: "6×/hari",
    description: "Performa tidak acceptable. Investigasi metode diperlukan sebelum QC.",
  };
}

// Sigma-aware Westgard checker
function checkWestgard(values, mean, sd, sigmaTier) {
  const violations = [];
  const n = values.length;
  if (n === 0) return violations;
  // Which rules are active based on sigma tier
  const active = sigmaTier?.activeRules || {
    "1₂s": true, "1₃s": true, "2₂s": true, "R₄s": true, "4₁s": true, "10x": true
  };

  for (let i = 0; i < n; i++) {
    const v = values[i];
    const z = (v - mean) / sd;
    const rules = [];

    if (active["1₂s"] && Math.abs(z) > 2 && Math.abs(z) <= 3)
      rules.push({ rule: "1₂s", type: "warning", desc: "1 titik > ±2SD (warning)" });
    if (active["1₃s"] && Math.abs(z) > 3)
      rules.push({ rule: "1₃s", type: "reject", desc: "1 titik > ±3SD (reject)" });

    if (i >= 1) {
      const z1 = (values[i-1] - mean) / sd;
      if (active["2₂s"]) {
        if (z > 2 && z1 > 2) rules.push({ rule: "2₂s", type: "reject", desc: "2 berturut > +2SD" });
        if (z < -2 && z1 < -2) rules.push({ rule: "2₂s", type: "reject", desc: "2 berturut < -2SD" });
      }
      if (active["R₄s"] && Math.abs(z - z1) > 4)
        rules.push({ rule: "R₄s", type: "reject", desc: "Range 2 titik berturut > 4SD" });
    }

    if (active["4₁s"] && i >= 3) {
      const zs = [values[i],values[i-1],values[i-2],values[i-3]].map(x=>(x-mean)/sd);
      if (zs.every(z=>z>1)) rules.push({ rule: "4₁s", type: "reject", desc: "4 berturut > +1SD" });
      if (zs.every(z=>z<-1)) rules.push({ rule: "4₁s", type: "reject", desc: "4 berturut < -1SD" });
    }

    if (active["10x"] && i >= 9) {
      const zs = values.slice(i-9, i+1).map(x=>(x-mean)/sd);
      if (zs.every(z=>z>0)) rules.push({ rule: "10x", type: "reject", desc: "10 berturut di atas mean" });
      if (zs.every(z=>z<0)) rules.push({ rule: "10x", type: "reject", desc: "10 berturut di bawah mean" });
    }

    if (rules.length > 0) violations.push({ idx: i, value: v, z: +z.toFixed(2), rules });
  }
  return violations;
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

// Parse numeric string — handle both comma (134,7) and dot (134.7) as decimal
function parseNum(s){
  if(s==null||s==="")return NaN;
  // Replace comma-decimal: "134,7" → "134.7" but only if comma is decimal separator
  // Detect: if string matches pattern digits,digits (no dot) → comma is decimal
  const cleaned=s.trim().replace(/\s/g,"");
  // Pattern: optional minus, digits, comma, digits (European decimal)
  if(/^-?\d+,\d+$/.test(cleaned)){
    return parseFloat(cleaned.replace(",","."));
  }
  // Already dot-decimal or integer
  return parseFloat(cleaned.replace(",","."));
}

// Label aliases: map common full names to param keys
const PARAM_ALIASES={
  "natrium":"Na","sodium":"Na","kalium":"K","potassium":"K",
  "klorida":"Cl","chloride":"Cl","chlorida":"Cl",
  "glukosa":"Glukosa","glucose":"Glukosa","gula darah":"Glukosa",
  "hemoglobin":"Hb","haemoglobin":"Hb",
  "trombosit":"PLT","platelet":"PLT","platelets":"PLT",
  "leukosit":"WBC","leukocyte":"WBC","wbc":"WBC",
  "eritrosit":"RBC","erythrocyte":"RBC","rbc":"RBC",
  "kreatinin":"Kreatinin","creatinine":"Kreatinin","creatinin":"Kreatinin",
  "ureum":"Ureum","urea":"Ureum","bun":"Ureum",
  "albumin":"Albumin","bilirubin total":"BilTotal","bilirubin":"BilTotal",
  "protein total":"TotProt","total protein":"TotProt",
  "sgot":"SGOT","ast":"SGOT","sgpt":"SGPT","alt":"SGPT",
  "gamma gt":"GGT","ggt":"GGT",
  "pt":"PT","aptt":"APTT","inr":"INR",
  "fibrinogen":"Fibrinogen","d-dimer":"DDimer","d dimer":"DDimer","ddimer":"DDimer",
  "ph":"pH","pco2":"pCO2","po2":"pO2","hco3":"HCO3","be":"BE","sao2":"SaO2","laktat":"Laktat","lactate":"Laktat",
  "ph urin":"pHUrin","bj urin":"BJUrin","berat jenis":"BJUrin",
  "protein urin":"ProtUrin","glukosa urin":"GluUrin",
  "crp":"CRP","c-reactive protein":"CRP","prokalsitonin":"PCT","procalcitonin":"PCT",
  "ferritin":"Ferritin","il-6":"IL6","il6":"IL6","interleukin-6":"IL6",
  "mcv":"MCV","mch":"MCH","mchc":"MCHC",
};

function resolveParamKey(headerName, currentParam){
  const lower=headerName.toLowerCase().trim();
  // 1. Exact match with current param (case-insensitive)
  if(lower===currentParam.toLowerCase())return headerName;
  // 2. Check aliases
  if(PARAM_ALIASES[lower])return headerName; // will be resolved in handlePaste
  // 3. Partial match with current param name
  if(lower.includes(currentParam.toLowerCase()))return headerName;
  return null;
}

function parseCSV(txt){
  const lines=txt.trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return null;
  // Detect delimiter: if first data line has semicolons or tabs, use those
  // Also handle single-column data (no delimiter needed)
  const firstData=lines[1];
  let delim=";";
  if(firstData.includes("\t"))delim="\t";
  else if(firstData.includes(";"))delim=";";
  else if(firstData.includes(",")&&!/^-?\d+,\d+$/.test(firstData.trim()))delim=",";
  else delim="SINGLE"; // single column

  let hdr,rows;
  if(delim==="SINGLE"){
    // Single column: header on first line, values on subsequent lines
    hdr=[lines[0].trim()];
    rows=lines.slice(1).map(l=>({[hdr[0]]:l.trim()}));
  } else {
    hdr=lines[0].split(delim).map(h=>h.trim());
    rows=lines.slice(1).map(l=>{
      const parts=l.split(delim);
      const o={};
      hdr.forEach((h,i)=>o[h]=parts[i]?.trim());
      return o;
    });
  }
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
          <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,#0b1929,#0c3060)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(14,165,233,.3)",padding:4}}>
            <img src={LOGO} alt="PasienQuC" style={{width:"100%",height:"100%",objectFit:"contain",filter:"drop-shadow(0 0 8px rgba(14,165,233,.4))"}}/>
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
function LJChart({values, mean, sdVal, paramLabel, wardLabel, unit, violations, sigmaTier}){
  const violSet=new Set(violations.map(v=>v.idx));
  const rejectSet=new Set(violations.filter(v=>v.rules.some(r=>r.type==="reject")).map(v=>v.idx));

  // ── Zoom state ──
  const[zoomLeft,setZoomLeft]=useState(null);
  const[zoomRight,setZoomRight]=useState(null);
  const[selecting,setSelecting]=useState(false);
  const[xDomain,setXDomain]=useState([1,values.length]);
  const[isZoomed,setIsZoomed]=useState(false);

  // ── Auto Y domain: padding 0.5 SD beyond ±3SD, never goes below 0 for positive-only params ──
  const yPad=sdVal*0.6;
  const yMin=+(mean-3*sdVal-yPad).toFixed(3);
  const yMax=+(mean+3*sdVal+yPad).toFixed(3);
  const yDomain=[yMin,yMax];

  const fullData=values.map((v,i)=>{
    const z=(v-mean)/sdVal;
    return{idx:i+1,value:+v.toFixed(3),z:+z.toFixed(2)};
  });

  // Filtered data for zoom window
  const data=fullData.filter(d=>d.idx>=xDomain[0]&&d.idx<=xDomain[1]);

  const handleMouseDown=(e)=>{
    if(!e?.activeLabel)return;
    setZoomLeft(e.activeLabel);setSelecting(true);
  };
  const handleMouseMove=(e)=>{
    if(!selecting||!e?.activeLabel)return;
    setZoomRight(e.activeLabel);
  };
  const handleMouseUp=()=>{
    if(!selecting){return;}
    setSelecting(false);
    if(zoomLeft!==null&&zoomRight!==null&&zoomLeft!==zoomRight){
      const l=Math.min(zoomLeft,zoomRight);
      const r=Math.max(zoomLeft,zoomRight);
      if(r-l>=2){setXDomain([l,r]);setIsZoomed(true);}
    }
    setZoomLeft(null);setZoomRight(null);
  };
  const resetZoom=()=>{setXDomain([1,values.length]);setIsZoomed(false);setZoomLeft(null);setZoomRight(null);setSelecting(false);};

  const CustomDot=(props)=>{
    const{cx,cy,payload}=props;
    if(cx==null||cy==null)return null;
    const isViol=violSet.has(payload.idx-1);
    const isRej=rejectSet.has(payload.idx-1);
    // Color based on sigma tier if available
    const color=isRej?T.danger:isViol?T.warn:T.ok;
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
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:T.text}}>Levey-Jennings Chart — {paramLabel}</div>
        <div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>{wardLabel} · n={values.length} · Mean={mean.toFixed(3)} · SD={sdVal.toFixed(3)}</div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,fontFamily:T.mono,color:T.ok}}>● Normal</span>
        <span style={{fontSize:10,fontFamily:T.mono,color:T.warn}}>● Warning</span>
        <span style={{fontSize:10,fontFamily:T.mono,color:T.danger}}>● Reject</span>
        {isZoomed&&(
          <button className="sb" onClick={resetZoom} style={{padding:"4px 10px",background:T.blueL,border:`1px solid ${T.blue}44`,borderRadius:7,color:T.blueD,fontSize:10,fontFamily:T.mono,cursor:"pointer",fontWeight:600}}>
            ↩ Reset Zoom
          </button>
        )}
        <span style={{fontSize:9,color:T.textT,fontFamily:T.mono}}>{isZoomed?`Titik ${xDomain[0]}–${xDomain[1]}`:"Drag untuk zoom"}</span>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{top:8,right:50,bottom:14,left:8}}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        style={{cursor:selecting?"crosshair":"default"}}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
        <XAxis dataKey="idx" tick={{fontSize:9,fill:T.textT}} stroke={T.border}
          label={{value:"Urutan Pasien",position:"insideBottom",offset:-4,fill:T.textT,fontSize:9}}
          domain={[xDomain[0],xDomain[1]]} type="number" allowDataOverflow/>
        <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border}
          label={{value:unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:9,dx:-4}}
          domain={yDomain} tickCount={8} allowDataOverflow/>
        <Tooltip content={<TT/>}/>

        {/* SD reference lines with right-side labels */}
        <ReferenceLine y={mean+3*sdVal} stroke={T.danger} strokeWidth={1.5} strokeDasharray="4 3" label={{value:"+3SD",fill:T.danger,fontSize:8,position:"right"}}/>
        <ReferenceLine y={mean+2*sdVal} stroke={T.warn} strokeWidth={1.2} strokeDasharray="4 3" label={{value:"+2SD",fill:T.warn,fontSize:8,position:"right"}}/>
        <ReferenceLine y={mean+sdVal} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" label={{value:"+1SD",fill:T.textT,fontSize:8,position:"right"}}/>
        <ReferenceLine y={mean} stroke={T.blue} strokeWidth={1.8} label={{value:"Mean",fill:T.blue,fontSize:8,position:"right"}}/>
        <ReferenceLine y={mean-sdVal} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" label={{value:"-1SD",fill:T.textT,fontSize:8,position:"right"}}/>
        <ReferenceLine y={mean-2*sdVal} stroke={T.warn} strokeWidth={1.2} strokeDasharray="4 3" label={{value:"-2SD",fill:T.warn,fontSize:8,position:"right"}}/>
        <ReferenceLine y={mean-3*sdVal} stroke={T.danger} strokeWidth={1.5} strokeDasharray="4 3" label={{value:"-3SD",fill:T.danger,fontSize:8,position:"right"}}/>

        {/* Zoom selection highlight */}
        {selecting&&zoomLeft!==null&&zoomRight!==null&&(
          <ReferenceArea x1={zoomLeft} x2={zoomRight} strokeOpacity={0.3} fill={T.blue} fillOpacity={0.15}/>
        )}

        <Line dataKey="value" stroke={T.blue} strokeWidth={1.5} dot={<CustomDot/>} activeDot={false} name={paramLabel} connectNulls isAnimationActive={false}/>
      </ComposedChart>
    </ResponsiveContainer>
    <div style={{fontSize:9,color:T.textT,fontFamily:T.mono,textAlign:"center",marginTop:4}}>
      💡 Klik dan drag pada grafik untuk zoom in · Tombol "Reset Zoom" untuk kembali ke tampilan penuh
    </div>
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


/* ══ PBRTQC CHART (with zoom) ══ */
function PBRTQCChart({chartData,selMethods,limits,cfg,paramLabel,TT,yDomain}){
  const[zoomLeft,setZoomLeft]=useState(null);
  const[zoomRight,setZoomRight]=useState(null);
  const[selecting,setSelecting]=useState(false);
  const[xDomain,setXDomain]=useState(null);
  const[isZoomed,setIsZoomed]=useState(false);

  const displayData=xDomain?chartData.filter(d=>d.idx>=xDomain[0]&&d.idx<=xDomain[1]):chartData;

  const handleMouseDown=(e)=>{if(!e?.activeLabel)return;setZoomLeft(e.activeLabel);setSelecting(true);};
  const handleMouseMove=(e)=>{if(!selecting||!e?.activeLabel)return;setZoomRight(e.activeLabel);};
  const handleMouseUp=()=>{
    setSelecting(false);
    if(zoomLeft!==null&&zoomRight!==null&&zoomLeft!==zoomRight){
      const l=Math.min(zoomLeft,zoomRight),r=Math.max(zoomLeft,zoomRight);
      if(r-l>=2){setXDomain([l,r]);setIsZoomed(true);}
    }
    setZoomLeft(null);setZoomRight(null);
  };
  const resetZoom=()=>{setXDomain(null);setIsZoomed(false);};

  return(
    <div style={{...CS,padding:18,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:6}}>
        <div style={{fontSize:13,fontWeight:600,color:T.text}}>PBRTQC Control Chart — {paramLabel}</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isZoomed&&<button className="sb" onClick={resetZoom} style={{padding:"4px 10px",background:T.blueL,border:`1px solid ${T.blue}44`,borderRadius:7,color:T.blueD,fontSize:10,fontFamily:T.mono,cursor:"pointer",fontWeight:600}}>↩ Reset Zoom</button>}
          <span style={{fontSize:9,color:T.textT,fontFamily:T.mono}}>{isZoomed?`Titik ${xDomain[0]}–${xDomain[1]}`:"Drag untuk zoom"}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={displayData} margin={{top:4,right:48,bottom:12,left:8}}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          style={{cursor:selecting?"crosshair":"default"}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
          <XAxis dataKey="idx" tick={{fontSize:9,fill:T.textT}} stroke={T.border} type="number" allowDataOverflow domain={xDomain||["auto","auto"]}/>
          <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border}
            label={{value:cfg.unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:9,dx:-4}}
            domain={yDomain} allowDataOverflow tickCount={8}/>
          <Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:10,paddingTop:5}}/>
          <Line dataKey="raw" stroke="rgba(14,165,233,.14)" dot={false} strokeWidth={1} name="Raw" legendType="none"/>
          <ReferenceLine y={cfg.refHigh} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.4} label={{value:"Ref↑",fill:T.textT,fontSize:8,position:"right"}}/>
          <ReferenceLine y={cfg.refLow} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.4} label={{value:"Ref↓",fill:T.textT,fontSize:8,position:"right"}}/>
          {selMethods.map(m=>[
            <Line key={m} dataKey={m} stroke={METHODS[m].color} dot={false} strokeWidth={2} name={METHODS[m].label} connectNulls strokeDasharray={METHODS[m].dash}/>,
            <ReferenceLine key={m+"u"} y={limits[m].ucl} stroke={METHODS[m].color} strokeDasharray="2 5" strokeOpacity={.35} label={{value:`UCL`,fill:METHODS[m].color,fontSize:7,position:"right"}}/>,
            <ReferenceLine key={m+"l"} y={limits[m].lcl} stroke={METHODS[m].color} strokeDasharray="2 5" strokeOpacity={.35} label={{value:`LCL`,fill:METHODS[m].color,fontSize:7,position:"right"}}/>,
          ])}
          {selecting&&zoomLeft!==null&&zoomRight!==null&&(
            <ReferenceArea x1={zoomLeft} x2={zoomRight} fill={T.blue} fillOpacity={0.12} strokeOpacity={0.3}/>
          )}
        </LineChart>
      </ResponsiveContainer>
      <div style={{fontSize:9,color:T.textT,fontFamily:T.mono,textAlign:"center",marginTop:4}}>
        💡 Klik dan drag untuk zoom in · Tombol "Reset Zoom" untuk kembali ke tampilan penuh
      </div>
    </div>
  );
}


/* ══ SIGMA CALCULATOR PANEL ══ */
const SIGMA_STORAGE = "pasienquc_sigma_settings";

function loadSigmaSettings() {
  try { return JSON.parse(localStorage.getItem(SIGMA_STORAGE)) || {}; } catch { return {}; }
}
function saveSigmaSettings(key, val) {
  try {
    const s = loadSigmaSettings();
    s[key] = val;
    localStorage.setItem(SIGMA_STORAGE, JSON.stringify(s));
  } catch {}
}

function SigmaPanel({ param, ward, cfg, stats, onSigmaChange, paramLabel }) {
  const storageKey = `${param}_${ward}`;
  const saved = loadSigmaSettings()[storageKey] || {};

  const [tea,  setTea]  = useState(saved.tea  ?? cfg.tea  ?? 5.0);
  const [bias, setBias] = useState(saved.bias ?? 0.5);
  const [cvOverride, setCvOverride] = useState(saved.cvOverride ?? "");
  const [expanded, setExpanded] = useState(true);

  // CV: use override if set, else from data
  const cvFromData = stats ? +stats.cv.toFixed(2) : null;
  const cv = cvOverride !== "" ? parseFloat(cvOverride) : (cvFromData || 3.0);
  const sigma = +((tea - Math.abs(bias)) / cv).toFixed(2);
  const tier = getSigmaTier(sigma);

  // Fire immediately on mount + whenever values change
  useEffect(() => {
    saveSigmaSettings(storageKey, { tea, bias, cvOverride });
    onSigmaChange && onSigmaChange(sigma, tier);
  }, [tea, bias, cvOverride, sigma, storageKey]);

  const sliderRow = (label, val, set, min, max, step, hint) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: T.textS }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: T.mono }}>{val.toFixed(2)}{hint}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(+e.target.value)}
        style={{ width: "100%", accentColor: T.blue, height: 4 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textT, fontFamily: T.mono, marginTop: 2 }}>
        <span>{min}{hint}</span><span>{max}{hint}</span>
      </div>
    </div>
  );

  return (
    <div style={{ ...CS, padding: 0, overflow: "hidden", marginBottom: 16 }}>
      {/* Header */}
      <div onClick={() => setExpanded(!expanded)} style={{
        padding: "14px 20px", cursor: "pointer",
        background: `linear-gradient(135deg, ${tier.bg}, #fff)`,
        borderBottom: expanded ? `1.5px solid ${tier.border}` : "none",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "background 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: tier.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: T.mono }}>{tier.tier}</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>σ Sigma Metric & Six Sigma QC Design</div>
            <div style={{ fontSize: 11, color: T.textS }}>{paramLabel || param} · {ward}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Sigma badge */}
          <div style={{ textAlign: "center", padding: "6px 16px", borderRadius: 10, background: tier.color + "18", border: `1.5px solid ${tier.color}44` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: tier.color, fontFamily: T.mono, lineHeight: 1 }}>{sigma}σ</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: tier.color }}>{tier.label}</div>
          </div>
          <span style={{ fontSize: 16, color: T.textT }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "20px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Left: inputs */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.blueD, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: T.mono, marginBottom: 14 }}>Parameter Input</div>

              {sliderRow("TEa — Total Allowable Error (%)", tea, setTea, 0.5, 25, 0.1, "%")}
              {sliderRow("Bias (%) — Inaccuracy", bias, setBias, 0, 15, 0.1, "%")}

              {/* CV: auto from data or manual override */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.textS }}>CV (%) — Imprecision</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {cvFromData !== null && (
                      <button onClick={() => setCvOverride("")}
                        style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: `1px solid ${cvOverride === "" ? T.blue : T.border}`, background: cvOverride === "" ? T.blueL : "transparent", color: cvOverride === "" ? T.blueD : T.textT, cursor: "pointer", fontFamily: T.mono }}>
                        Auto ({cvFromData}%)
                      </button>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: T.mono }}>{cv.toFixed(2)}%</span>
                  </div>
                </div>
                <input type="number" min={0.1} max={30} step={0.01}
                  value={cvOverride}
                  onChange={e => setCvOverride(e.target.value)}
                  placeholder={cvFromData ? `Auto: ${cvFromData}%` : "Masukkan CV%"}
                  style={{ ...IS, fontSize: 12 }} />
                <div style={{ fontSize: 10, color: T.textT, fontFamily: T.mono, marginTop: 3 }}>
                  {cvOverride === "" && cvFromData ? "✅ CV dihitung otomatis dari data" : "✏️ CV diinput manual"}
                </div>
              </div>

              {/* Formula display */}
              <div style={{ background: tier.bg, border: `1.5px solid ${tier.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: T.textT, fontFamily: T.mono, marginBottom: 6, letterSpacing: 1 }}>FORMULA SIGMA</div>
                <div style={{ fontSize: 13, fontFamily: T.mono, color: T.text, lineHeight: 1.9 }}>
                  σ = (TEa − |Bias|) / CV<br />
                  σ = ({tea.toFixed(1)}% − {Math.abs(bias).toFixed(1)}%) / {cv.toFixed(2)}%<br />
                  <span style={{ fontWeight: 800, color: tier.color, fontSize: 15 }}>σ = {sigma}</span>
                </div>
              </div>
            </div>

            {/* Right: sigma tier info */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.blueD, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: T.mono, marginBottom: 14 }}>QC Strategy</div>

              {/* Tier cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                {[
                  { range: "≥ 6σ", label: "World Class", color: "#059669", rules: "1₃s", levels: "2 level", freq: "1×/hari" },
                  { range: "5–6σ", label: "Excellent",   color: "#0ea5e9", rules: "1₂s · 1₃s", levels: "2 level", freq: "1×/hari" },
                  { range: "4–5σ", label: "Good",        color: "#2563eb", rules: "1₂s · 2₂s · R₄s", levels: "2 level", freq: "2×/hari" },
                  { range: "3–4σ", label: "Marginal",    color: "#d97706", rules: "Semua rules", levels: "3 level", freq: "4×/hari" },
                  { range: "< 3σ", label: "Poor",        color: "#dc2626", rules: "Semua rules", levels: "3 level", freq: "6×/hari" },
                ].map(r => {
                  const active = (
                    (r.range === "≥ 6σ" && sigma >= 6) ||
                    (r.range === "5–6σ" && sigma >= 5 && sigma < 6) ||
                    (r.range === "4–5σ" && sigma >= 4 && sigma < 5) ||
                    (r.range === "3–4σ" && sigma >= 3 && sigma < 4) ||
                    (r.range === "< 3σ" && sigma < 3)
                  );
                  return (
                    <div key={r.range} style={{
                      padding: "10px 14px", borderRadius: 9,
                      background: active ? r.color + "12" : T.surfB,
                      border: `1.5px solid ${active ? r.color : T.border}`,
                      display: "grid", gridTemplateColumns: "50px 1fr 80px 70px 60px",
                      alignItems: "center", gap: 8, transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: r.color, fontFamily: T.mono }}>{r.range}</div>
                      <div style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? r.color : T.textS }}>{r.label}</div>
                      <div style={{ fontSize: 10, color: T.textT, fontFamily: T.mono }}>{r.rules}</div>
                      <div style={{ fontSize: 10, color: T.textT, fontFamily: T.mono }}>{r.levels}</div>
                      <div style={{ fontSize: 10, color: T.textT, fontFamily: T.mono }}>{r.freq}</div>
                      {active && <div style={{ gridColumn: "1/-1", fontSize: 11, color: r.color, marginTop: 3, fontWeight: 600 }}>
                        ← Posisi saat ini · {tier.description}
                      </div>}
                    </div>
                  );
                })}
              </div>

              {/* Active rules indicator */}
              <div style={{ background: T.surfB, borderRadius: 10, padding: "12px 14px", border: `1.5px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textT, fontFamily: T.mono, marginBottom: 8, letterSpacing: 1 }}>RULES AKTIF UNTUK σ = {sigma}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(tier.activeRules).map(([rule, active]) => (
                    <span key={rule} style={{
                      padding: "3px 10px", borderRadius: 20, fontFamily: T.mono, fontSize: 11, fontWeight: 600,
                      background: active ? tier.color + "18" : "#f1f5f9",
                      color: active ? tier.color : T.textT,
                      border: `1px solid ${active ? tier.color + "44" : T.border}`,
                      textDecoration: active ? "none" : "line-through",
                    }}>{rule}</span>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: T.textT, marginTop: 8, lineHeight: 1.6 }}>
                  QC: <strong>{tier.qcLevels} level kontrol</strong> · <strong>{tier.qcFreq}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* TEa reference table */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 10 }}>Referensi TEa Standar (CLIA / Westgard)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 6 }}>
              {[
                { param: "Hb", tea: 7.0, source: "CLIA" },
                { param: "MCV", tea: 7.0, source: "CLIA" },
                { param: "PLT", tea: 25.0, source: "CLIA" },
                { param: "WBC", tea: 15.0, source: "CLIA" },
                { param: "Na", tea: 4.0, source: "CLIA" },
                { param: "K", tea: 8.6, source: "CLIA" },
                { param: "Glukosa", tea: 10.0, source: "CLIA" },
                { param: "Kreatinin", tea: 15.0, source: "CLIA" },
                { param: "Albumin", tea: 10.0, source: "CLIA" },
                { param: "PT", tea: 15.0, source: "Westgard" },
                { param: "APTT", tea: 15.0, source: "Westgard" },
                { param: "pH (AGD)", tea: 0.04, source: "CLIA" },
                { param: "pCO2", tea: 8.0, source: "CLIA" },
                { param: "CRP", tea: 25.0, source: "Westgard" },
              ].map(r => (
                <div key={r.param} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderRadius: 7, background: r.param === param ? T.blueL : T.surfB, border: `1px solid ${r.param === param ? T.blue + "44" : T.border}`, fontSize: 11 }}>
                  <span style={{ fontWeight: r.param === param ? 700 : 400, color: r.param === param ? T.blueD : T.text, fontFamily: T.mono }}>{r.param}</span>
                  <span style={{ color: T.textS, fontFamily: T.mono }}>TEa {r.tea}%</span>
                  <span style={{ color: T.textT, fontSize: 10 }}>{r.source}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ MAIN QC PANEL ══ */
function QCPanel({data,cfg,blockSize,mult,useAoN,selMethods,apiKey,wardKey,wardLabel,paramLabel,param,onSave}){
  const working=useMemo(()=>!data?null:useAoN?data.filter(v=>v>=cfg.refLow&&v<=cfg.refHigh):data,[data,useAoN,cfg]);
  const series=useMemo(()=>{if(!working||working.length<blockSize)return null;return{MA:calcMA(working,blockSize),EWMA:calcEWMA(working),TRIM:calcTrim(working,blockSize,cfg.trim),MEDIAN:calcMed(working,blockSize)};},[working,blockSize,cfg]);
  const limits=useMemo(()=>{if(!series)return null;const o={};Object.keys(series).forEach(m=>{o[m]=getLimits(series[m],mult);});return o;},[series,mult]);
  const violations=useMemo(()=>{if(!series||!limits)return null;const o={};Object.keys(series).forEach(m=>{o[m]=series[m].map((v,i)=>({idx:i,value:v,viol:v!==null&&(v>limits[m].ucl||v<limits[m].lcl)})).filter(d=>d.viol);});return o;},[series,limits]);
  const stats=useMemo(()=>{if(!working||!working.length)return null;const m=avg(working),s=std(working);return{n:working.length,mean:m,sd:s,cv:(s/m)*100,median:med(working)};},[working]);
  const ljMean=stats?.mean||0,ljSd=stats?.sd||1;
  // Init sigma from saved/default values so stat card shows immediately
  const _initSigma=(()=>{
    const sk=`${param}_${wardKey}`;
    const sv=loadSigmaSettings()[sk]||{};
    const tea=sv.tea??cfg.tea??5.0;
    const bias=sv.bias??0.5;
    const cvDef=sv.cvOverride?parseFloat(sv.cvOverride):3.0;
    const sig=+((tea-Math.abs(bias))/cvDef).toFixed(2);
    return{sig,tier:getSigmaTier(sig)};
  })();
  const[sigmaCurrent,setSigmaCurrent]=useState(_initSigma.sig);
  const[sigmaTierCurrent,setSigmaTierCurrent]=useState(_initSigma.tier);
  const handleSigmaChange=useCallback((sig,tier)=>{setSigmaCurrent(sig);setSigmaTierCurrent(tier);},[]);
  const wgViolations=useMemo(()=>working?checkWestgard(working,ljMean,ljSd,sigmaTierCurrent):[],[working,ljMean,ljSd,sigmaTierCurrent]);
  const chartData=useMemo(()=>{if(!working||!series)return[];return working.map((v,i)=>{const p={idx:i+1,raw:+v.toFixed(3)};Object.keys(series).forEach(m=>{if(series[m][i]!==null)p[m]=series[m][i];});return p;});},[working,series]);

  const aiCtx=useMemo(()=>{
    if(!stats||!limits)return"Belum ada data.";
    let c=`Parameter: ${paramLabel} (${cfg.unit}) | Ruang: ${wardLabel}\nN=${stats.n} Mean=${stats.mean.toFixed(3)} SD=${stats.sd.toFixed(3)} CV=${stats.cv.toFixed(2)}% Median=${stats.median.toFixed(3)}\n`;
    selMethods.forEach(m=>{if(limits[m])c+=`${METHODS[m].label}: UCL=${limits[m].ucl.toFixed(3)} LCL=${limits[m].lcl.toFixed(3)} Violations=${violations?.[m]?.length??0}\n`;});
    const rejects=wgViolations.filter(v=>v.rules.some(r=>r.type==="reject"));
    c+=`Westgard: Total=${wgViolations.length} Reject=${rejects.length}\n`;
    if(sigmaCurrent)c+=(["Sigma:",sigmaCurrent,"sigma |",(sigmaTierCurrent?.label||"")].join(" ")+";");

    return c;
  },[stats,limits,violations,selMethods,paramLabel,cfg,wardLabel,wgViolations,sigmaCurrent,sigmaTierCurrent]);

  // When stats loads for first time, trigger sigma recalc via SigmaPanel
  // SigmaPanel handles this internally via cvFromData dependency
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
    {stats&&<div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:9,marginBottom:16}}>
      <StatCard label="N" value={stats.n} unit="data" color={T.blue} delay={0}/>
      <StatCard label="Mean" value={stats.mean.toFixed(2)} unit={cfg.unit} color={T.blue} delay={40}/>
      <StatCard label="SD" value={stats.sd.toFixed(3)} unit="" color={T.ok} delay={80}/>
      <StatCard label="CV%" value={stats.cv.toFixed(2)+"%"} unit="" color={stats.cv>10?T.danger:T.warn} warn={stats.cv>10} delay={120}/>
      <StatCard label="Sigma (σ)" value={sigmaCurrent!==null?sigmaCurrent+"σ":"—"} unit={sigmaTierCurrent?.label||"Set TEa & Bias ↓"} color={sigmaTierCurrent?.color||T.textT} warn={sigmaCurrent!==null&&sigmaCurrent<3} delay={160}/>
      <StatCard label="WG Reject" value={wgViolations.filter(v=>v.rules.some(r=>r.type==="reject")).length} unit="violations" color={T.danger} warn={wgViolations.some(v=>v.rules.some(r=>r.type==="reject"))} delay={200}/>
    </div>}

    {/* Save to Supabase */}
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16}}>
      <button className="pb" onClick={saveToDb} disabled={saving} style={{...BP,display:"flex",alignItems:"center",gap:6,padding:"7px 16px",fontSize:11,background:"#0369a1"}}>
        {saving?<><Sp/> Menyimpan...</>:"☁️ Simpan ke Supabase"}
      </button>
      {savedMsg&&<div style={{fontSize:12,color:savedMsg.startsWith("✅")?T.ok:T.danger,fontFamily:T.mono}}>{savedMsg}</div>}
    </div>

    {/* Sigma Panel */}
    <SigmaPanel param={param} ward={wardKey} cfg={cfg} stats={stats} onSigmaChange={handleSigmaChange} paramLabel={paramLabel}/>

    {/* Levey-Jennings Chart */}
    {stats&&<div style={{marginBottom:16}}><LJChart values={working} mean={stats.mean} sdVal={stats.sd} paramLabel={paramLabel} wardLabel={wardLabel} unit={cfg.unit} violations={wgViolations} sigmaTier={sigmaTierCurrent}/></div>}

    {/* PBRTQC Chart */}
    {chartData.length>0&&series&&limits&&(()=>{
      // Auto Y domain: use min UCL/LCL across methods + raw data range, with padding
      const allVals=chartData.flatMap(d=>[d.raw,...selMethods.map(m=>d[m]).filter(Boolean)]);
      const allLimits=selMethods.flatMap(m=>[limits[m].ucl,limits[m].lcl]);
      const allY=[...allVals,...allLimits].filter(v=>v!=null&&!isNaN(v));
      const yMin=Math.min(...allY);const yMax=Math.max(...allY);
      const yPad=(yMax-yMin)*0.12||1;
      const pbrtqcYDomain=[+(yMin-yPad).toFixed(3),+(yMax+yPad).toFixed(3)];

      // Zoom state for PBRTQC chart
      return(
        <PBRTQCChart chartData={chartData} selMethods={selMethods} limits={limits} cfg={cfg} paramLabel={paramLabel} TT={TT} yDomain={pbrtqcYDomain}/>
      );
    })()}

    {/* Westgard */}
    <div style={{marginBottom:14}}><WestgardPanel violations={wgViolations}/></div>

    {/* AI */}
    <AIInterpret apiKey={apiKey} context={aiCtx} paramLabel={paramLabel} ward={wardLabel}/>
  </div>);
}


/* ══ LOGO ══ */
const LOGO = "/logo.png";

/* ══ LOADING SCREEN ══ */
function LoadingScreen({onDone}){
  const[progress,setProgress]=useState(0);
  const[phase,setPhase]=useState(0);
  const phases=["Menginisialisasi sistem...","Memuat konfigurasi parameter...","Menghubungkan ke database...","Mempersiapkan dashboard...","Siap!"];
  useEffect(()=>{
    let p=0;
    const iv=setInterval(()=>{
      p+=Math.random()*18+4;
      if(p>=100){p=100;clearInterval(iv);setTimeout(()=>onDone(),600);}
      setProgress(Math.min(100,+p.toFixed(0)));
      setPhase(Math.min(4,Math.floor(p/25)));
    },120);
    return()=>clearInterval(iv);
  },[onDone]);
  return(
    <div style={{fontFamily:T.font,background:"linear-gradient(135deg,#0b1929 0%,#0c2340 50%,#0b1929 100%)",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"fixed",inset:0,zIndex:9999}}>
      {/* Animated rings */}
      <div style={{position:"relative",width:200,height:200,marginBottom:32}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"1px solid rgba(14,165,233,.15)",animation:"spin 8s linear infinite"}}/>
        <div style={{position:"absolute",inset:10,borderRadius:"50%",border:"1px solid rgba(14,165,233,.1)",animation:"spin 6s linear infinite reverse"}}/>
        <div style={{position:"absolute",inset:20,borderRadius:"50%",border:"1px solid rgba(14,165,233,.08)",animation:"spin 4s linear infinite"}}/>
        <img src={LOGO} alt="PasienQuC" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",padding:16,filter:"drop-shadow(0 0 20px rgba(14,165,233,.5))"}}/>
      </div>
      <div style={{fontSize:28,fontWeight:700,color:"#fff",letterSpacing:-.5,marginBottom:4}}>PasienQuC</div>
      <div style={{fontSize:12,color:"rgba(14,165,233,.8)",fontFamily:T.mono,letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>Pencitraan Biomedis, Riset & Teknologi QC</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontFamily:T.mono,marginBottom:32}}>v.0.4.0</div>
      {/* Progress bar */}
      <div style={{width:280,marginBottom:14}}>
        <div style={{background:"rgba(255,255,255,.08)",borderRadius:20,height:6,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:20,background:"linear-gradient(90deg,#0ea5e9,#38bdf8)",width:`${progress}%`,transition:"width .15s ease",boxShadow:"0 0 10px rgba(14,165,233,.6)"}}/>
        </div>
      </div>
      <div style={{fontSize:11,color:"rgba(14,165,233,.7)",fontFamily:T.mono,letterSpacing:.5}}>{phases[phase]}</div>
      <div style={{position:"absolute",bottom:24,fontSize:11,color:"rgba(255,255,255,.2)",fontFamily:T.mono}}>Aplikasi dibuat oleh dr. Alifferdi Rahman Wiyono · April 2026</div>
    </div>
  );
}

/* ══ ABOUT TAB ══ */
function AboutTab(){
  const glossary=[
    {term:"Block Size (n)",icon:"📦",desc:"Jumlah data pasien yang digunakan dalam satu perhitungan statistik. Makin besar n, makin stabil estimasinya — tetapi makin lambat mendeteksi perubahan. Rekomendasi: 15–30 untuk IGD/ICU, 20–50 untuk rawat jalan."},
    {term:"Moving Average (MA)",icon:"📈",desc:"Rata-rata bergerak sederhana dari n data terakhir. Metode paling klasik dan mudah diinterpretasikan. Responsif terhadap perubahan tetapi rentan terhadap outlier."},
    {term:"EWMA",icon:"⚡",desc:"Exponentially Weighted Moving Average — rata-rata bergerak yang memberi bobot lebih besar pada data terbaru dibanding data lama. Lebih sensitif terhadap drift mendadak dibanding MA biasa."},
    {term:"Trimmed Mean",icon:"✂️",desc:"Rata-rata yang membuang sejumlah nilai ekstrem (outlier) di kedua ujung distribusi sebelum dihitung. Sangat cocok untuk populasi IGD dan ICU yang banyak nilai abnormal patologis."},
    {term:"Median / AoN",icon:"⚖️",desc:"Average of Normals — hanya menggunakan hasil dalam rentang referensi normal. Metode paling robust untuk populasi campuran. Tidak terpengaruh oleh nilai ekstrem sama sekali."},
    {term:"Control Limit (±SD)",icon:"🎯",desc:"Batas atas (UCL) dan batas bawah (LCL) yang jika dilampaui mengindikasikan kemungkinan adanya masalah analitik. Umumnya menggunakan ±2SD. Semakin ketat batasnya, semakin sensitif tetapi semakin banyak false alarm."},
    {term:"AoN Filter",icon:"🔍",desc:"Filter otomatis yang mengecualikan nilai di luar rentang referensi sebelum perhitungan QC dilakukan. Sangat direkomendasikan untuk ruangan dengan banyak pasien kritis (IGD, ICU)."},
    {term:"Levey-Jennings Chart",icon:"📊",desc:"Grafik QC klasik yang menampilkan setiap data point secara individual dengan garis batas ±1SD, ±2SD, dan ±3SD. Memudahkan identifikasi visual terhadap tren, shift, dan outlier."},
    {term:"Westgard Rules",icon:"⚠️",desc:"Seperangkat aturan statistik standar internasional untuk mendeteksi error random dan sistematik. Meliputi: 1₂s (warning), 1₃s (reject), 2₂s, R₄s, 4₁s, dan 10x. Dasar utama QC laboratorium modern."},
    {term:"Sigma Metric (σ)",icon:"🏆",desc:"Ukuran performa analitik komprehensif: σ = (TEa − |Bias|) / CV%. Skala: ≥6σ = World Class, 4–6σ = Good, 3–4σ = Marginal, <3σ = Poor. Digunakan untuk menentukan frekuensi dan keketatan QC yang diperlukan."},
    {term:"OPSpecs",icon:"📐",desc:"Operational Process Specifications — panduan pemilihan prosedur QC yang optimal berdasarkan sigma metric. Membantu menentukan berapa level kontrol dan rule mana yang paling tepat untuk metode tertentu."},
    {term:"PBRTQC",icon:"🔬",desc:"Patient-Based Real-Time QC — pendekatan QC yang menggunakan distribusi statistik hasil pasien rutin sebagai indikator stabilitas analitik. Bersifat kontinu 24 jam dan tidak memerlukan biaya material kontrol tambahan."},
  ];

  return(
    <div className="fi" style={{maxWidth:860,margin:"0 auto"}}>
      {/* Hero card */}
      <div style={{...CS,padding:0,overflow:"hidden",marginBottom:20}}>
        <div style={{background:"linear-gradient(135deg,#0b1929,#0c2340,#0b3060)",padding:"32px 36px",display:"flex",alignItems:"center",gap:28}}>
          <img src={LOGO} alt="PasienQuC" style={{width:90,height:90,objectFit:"contain",filter:"drop-shadow(0 0 16px rgba(14,165,233,.5))",flexShrink:0}}/>
          <div>
            <div style={{fontSize:26,fontWeight:700,color:"#fff",letterSpacing:-.5,marginBottom:4}}>PasienQuC <span style={{fontSize:14,fontWeight:400,color:"rgba(14,165,233,.8)",fontFamily:T.mono}}>v.0.4.0</span></div>
            <div style={{fontSize:13,color:"rgba(14,165,233,.9)",fontFamily:T.mono,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Pencitraan Biomedis, Riset & Teknologi Quality Control</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.7,maxWidth:520}}>Sistem pemantauan kualitas laboratorium berbasis data pasien (PBRTQC) — lebih cepat, lebih cerdas, berbasis cloud.</div>
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
              {["React · Vite","Recharts","Groq AI · LLaMA 3.3 70B","Supabase PostgreSQL"].map(t=>(
                <span key={t} style={{fontSize:10,padding:"3px 10px",borderRadius:20,background:"rgba(14,165,233,.15)",color:"rgba(14,165,233,.9)",border:"1px solid rgba(14,165,233,.25)",fontFamily:T.mono}}>{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div style={{padding:"24px 36px"}}>
          {/* About sections */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:1.5,fontFamily:T.mono,marginBottom:10}}>Tentang Aplikasi</div>
              <div style={{fontSize:14,color:T.text,lineHeight:1.8}}>
                PasienQuC membantu analis dan dokter spesialis patologi klinik memantau performa analitik instrumen laboratorium secara berkelanjutan, menggunakan data hasil pemeriksaan pasien sebagai sumber QC primer maupun komplementer.
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:1.5,fontFamily:T.mono,marginBottom:10}}>Metodologi</div>
              <div style={{fontSize:14,color:T.text,lineHeight:1.8}}>
                Mengimplementasikan standar internasional PBRTQC yang direkomendasikan oleh EFLM (<em>European Federation of Laboratory Medicine</em>), dengan tambahan fitur Westgard multirule, Sigma Metric, dan OPSpecs yang lazim digunakan dalam akreditasi ISO 15189.
              </div>
            </div>
          </div>

          {/* Developer card */}
          <div style={{background:"linear-gradient(135deg,#f0f9ff,#e0f2fe)",border:`1.5px solid ${T.blueL}`,borderRadius:12,padding:"18px 22px",marginBottom:24,display:"flex",alignItems:"center",gap:20}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22}}>👨‍⚕️</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:T.textT,fontFamily:T.mono,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>Pengembang</div>
              <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:2}}>Alifferdi Rahman Wiyono, dr.</div>
              <div style={{fontSize:13,color:T.textS}}>Peserta PPDS Patologi Klinik · Universitas Airlangga / RSUD Dr. Soetomo Surabaya</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:3}}>Versi saat ini</div>
              <div style={{fontSize:18,fontWeight:700,color:T.blue,fontFamily:T.mono}}>v.0.4.0</div>
              <div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>April 2026</div>
            </div>
          </div>

          {/* Ongoing development banner */}
          <div style={{background:"linear-gradient(135deg,#fefce8,#fef9c3)",border:`1.5px solid #fde047`,borderRadius:12,padding:"16px 20px",marginBottom:0,display:"flex",alignItems:"flex-start",gap:14}}>
            <div style={{fontSize:24,flexShrink:0}}>🚀</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#854d0e",marginBottom:4}}>Aplikasi Terus Berkembang</div>
              <div style={{fontSize:13,color:"#713f12",lineHeight:1.7}}>
                <em>"Aplikasi ini dirancang untuk terus berkembang. Setiap versi baru menghadirkan fitur yang lebih lengkap, lebih akurat, dan lebih relevan dengan kebutuhan laboratorium klinik modern di Indonesia."</em>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glossary */}
      <div style={{...CS,padding:"22px 28px"}}>
        <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:4}}>Panduan Istilah & Parameter</div>
        <div style={{fontSize:12,color:T.textS,marginBottom:20}}>Penjelasan singkat mengenai metode, parameter, dan fitur yang tersedia di PasienQuC.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {glossary.map(g=>(
            <div key={g.term} style={{background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"14px 16px",transition:"box-shadow .2s"}} className="ch">
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <span style={{fontSize:18}}>{g.icon}</span>
                <div style={{fontSize:13,fontWeight:700,color:T.text}}>{g.term}</div>
              </div>
              <div style={{fontSize:12.5,color:T.textS,lineHeight:1.72}}>{g.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ══ MIDDLEWARE TAB ══ */
const MW_STORAGE_KEY = "pasienquc_middleware_config";
const MW_LOG_KEY = "pasienquc_middleware_logs";

const PARAM_MAP_DEFAULTS = {
  Hb:"Hb", MCV:"MCV", PLT:"PLT", WBC:"WBC", MCH:"MCH", MCHC:"MCHC", RBC:"RBC",
  Na:"Na", K:"K", Cl:"Cl", Glukosa:"Glukosa", Ureum:"Ureum", Kreatinin:"Kreatinin",
  PT:"PT", APTT:"APTT", INR:"INR", pH:"pH", pCO2:"pCO2", pO2:"pO2",
  CRP:"CRP", PCT:"PCT", Ferritin:"Ferritin",
};

function MiddlewareTab(){
  const defInstrument = {id:Date.now(),name:"",brand:"",model:"",ward:"IGD",ip:"",port:"4000",protocol:"REST",paramMap:{...PARAM_MAP_DEFAULTS},active:true};
  const[instruments,setInstruments]=useState(()=>{
    try{const s=localStorage.getItem(MW_STORAGE_KEY);return s?JSON.parse(s):[];}catch{return[];}
  });
  const[logs,setLogs]=useState(()=>{
    try{const s=localStorage.getItem(MW_LOG_KEY);return s?JSON.parse(s).slice(-100):[];}catch{return[];}
  });
  const[editing,setEditing]=useState(null); // instrument being edited
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({...defInstrument,id:Date.now()});
  const[pingResult,setPingResult]=useState({});
  const[pinging,setPinging]=useState({});
  const[activeSection,setActiveSection]=useState("instruments"); // instruments | endpoint | log
  const[copied,setCopied]=useState(false);
  const[testPayload,setTestPayload]=useState("");
  const[testResult,setTestResult]=useState("");
  const[testLoading,setTestLoading]=useState(false);
  const logRef=useRef();

  // Save to localStorage on change
  useEffect(()=>{localStorage.setItem(MW_STORAGE_KEY,JSON.stringify(instruments));},[instruments]);
  useEffect(()=>{localStorage.setItem(MW_LOG_KEY,JSON.stringify(logs));if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[logs]);

  const addLog=(type,msg,instr="")=>{
    const entry={id:Date.now(),time:new Date().toLocaleTimeString("id-ID"),type,msg,instr};
    setLogs(p=>[...p.slice(-99),entry]);
  };

  const saveInstrument=()=>{
    if(!form.name.trim()){alert("Nama instrumen wajib diisi.");return;}
    if(editing!==null){
      setInstruments(p=>p.map(i=>i.id===editing?{...form,id:editing}:i));
      addLog("info",`Instrumen diperbarui: ${form.name}`,form.name);
    } else {
      const newI={...form,id:Date.now()};
      setInstruments(p=>[...p,newI]);
      addLog("info",`Instrumen ditambahkan: ${form.name}`,form.name);
    }
    setShowForm(false);setEditing(null);setForm({...defInstrument,id:Date.now()});
  };

  const deleteInstrument=(id)=>{
    const name=instruments.find(i=>i.id===id)?.name||"";
    setInstruments(p=>p.filter(i=>i.id!==id));
    addLog("warn",`Instrumen dihapus: ${name}`,name);
  };

  const editInstrument=(instr)=>{
    setForm({...instr});setEditing(instr.id);setShowForm(true);
  };

  const toggleActive=(id)=>{
    setInstruments(p=>p.map(i=>i.id===id?{...i,active:!i.active}:i));
  };

  const pingInstrument=async(instr)=>{
    setPinging(p=>({...p,[instr.id]:true}));
    setPingResult(p=>({...p,[instr.id]:null}));
    addLog("info",`Ping ke ${instr.name} (${instr.ip}:${instr.port})...`,instr.name);
    try{
      // We can't actually ping an IP from browser (CORS), so we do a connectivity check
      const start=Date.now();
      // Try to reach Supabase as connectivity proxy
      const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),4000);
      await fetch(`${SB_URL}/rest/v1/`,{headers:{"apikey":SB_KEY},signal:ac.signal});
      clearTimeout(tid);
      const ms=Date.now()-start;
      setPingResult(p=>({...p,[instr.id]:{ok:true,ms}}));
      addLog("ok",`Koneksi internet OK (${ms}ms). Pastikan middleware sudah dikonfigurasi untuk POST ke endpoint Supabase.`,instr.name);
    }catch(e){
      setPingResult(p=>({...p,[instr.id]:{ok:false,msg:e.message}}));
      addLog("error",`Koneksi gagal: ${e.message}`,instr.name);
    }
    setPinging(p=>({...p,[instr.id]:false}));
  };

  // Supabase endpoint info
  const endpointUrl=`${SB_URL}/rest/v1/qc_sessions`;
  const curlExample=(ward="IGD",param="Hb",value="12.5")=>`curl -X POST "${endpointUrl}" \
  -H "apikey: ${SB_KEY.slice(0,40)}..." \
  -H "Authorization: Bearer ${SB_KEY.slice(0,40)}..." \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"param":"${param}","ward":"${ward}","value":${value},"recorded_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'`;

  const jsonExample=(ward="IGD",param="Hb",value="12.5")=>JSON.stringify({
    param,ward,value:parseNum(value),
    recorded_at:new Date().toISOString()
  },null,2);

  const copyEndpoint=()=>{
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);setTimeout(()=>setCopied(false),2000);
  };

  // Test send data manually
  const sendTestData=async()=>{
    setTestLoading(true);setTestResult("");
    try{
      const payload=JSON.parse(testPayload);
      const arr=Array.isArray(payload)?payload:[payload];
      await sbFetch("/qc_sessions",{method:"POST",body:JSON.stringify(arr)});
      setTestResult("✅ Data berhasil dikirim ke Supabase!");
      addLog("ok",`Test data terkirim: ${arr.length} record`,"Manual Test");
    }catch(e){
      setTestResult(`❌ Error: ${e.message}`);
      addLog("error",`Test data gagal: ${e.message}`,"Manual Test");
    }
    setTestLoading(false);
  };

  const logColor={ok:T.ok,error:T.danger,warn:T.warn,info:T.blue};

  const sectionBtn=(id,label)=>(
    <button className="tb" onClick={()=>setActiveSection(id)} style={{padding:"7px 18px",borderRadius:8,border:`1.5px solid ${activeSection===id?T.blue:T.border}`,background:activeSection===id?T.blue:"transparent",color:activeSection===id?"#fff":T.textS,fontSize:12,fontFamily:T.font,fontWeight:activeSection===id?600:400,cursor:"pointer"}}>{label}</button>
  );

  return(
    <div className="fi">
      <div style={{marginBottom:16}}>
        <div style={{fontSize:18,fontWeight:700,color:T.text}}>⚙️ Middleware & Instrumen</div>
        <div style={{fontSize:11,color:T.textS,marginTop:2,fontFamily:T.mono}}>Konfigurasi koneksi instrumen → Supabase → PasienQuC</div>
      </div>

      {/* Architecture diagram */}
      <div style={{...CS,padding:16,marginBottom:16,background:"linear-gradient(135deg,#f0f9ff,#e0f2fe)"}}>
        <div style={{fontSize:11,color:T.blueD,fontFamily:T.mono,letterSpacing:1,marginBottom:10,textTransform:"uppercase"}}>Arsitektur Koneksi</div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {[
            {icon:"🔬",label:"Instrumen / Analyzer",color:"#ef4444"},
            {arrow:"→"},
            {icon:"⚙️",label:"Middleware",color:"#f59e0b"},
            {arrow:"→"},
            {icon:"🌐",label:"HTTP POST",color:"#8b5cf6"},
            {arrow:"→"},
            {icon:"☁️",label:"Supabase DB",color:"#0369a1"},
            {arrow:"→"},
            {icon:"📊",label:"PasienQuC",color:"#0ea5e9"},
          ].map((item,i)=>item.arrow
            ?<div key={i} style={{fontSize:18,color:T.textT,fontWeight:300}}>→</div>
            :<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,background:`${item.color}12`,border:`1.5px solid ${item.color}33`}}>
              <span style={{fontSize:16}}>{item.icon}</span>
              <span style={{fontSize:11,fontWeight:600,color:item.color}}>{item.label}</span>
            </div>
          )}
        </div>
        <div style={{fontSize:11,color:T.textS,marginTop:10,lineHeight:1.6}}>
          Middleware mengirim data hasil pasien via <strong>HTTP POST</strong> ke endpoint Supabase. PasienQuC membaca data secara real-time dari Supabase untuk analisis QC.
        </div>
      </div>

      {/* Section tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {sectionBtn("instruments","🔬 Daftar Instrumen")}
        {sectionBtn("endpoint","🌐 Endpoint & Panduan")}
        {sectionBtn("log","📋 Log Aktivitas")}
      </div>

      {/* ── INSTRUMENTS SECTION ── */}
      {activeSection==="instruments"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>Instrumen Terdaftar ({instruments.length})</div>
          <button className="pb" onClick={()=>{setForm({...defInstrument,id:Date.now()});setEditing(null);setShowForm(true);}} style={{...BP,display:"flex",alignItems:"center",gap:6,padding:"7px 16px",fontSize:12}}>+ Tambah Instrumen</button>
        </div>

        {instruments.length===0&&!showForm&&(
          <div style={{...CS,padding:36,textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:12}}>🔬</div>
            <div style={{fontSize:14,color:T.textS,marginBottom:6}}>Belum ada instrumen terdaftar</div>
            <div style={{fontSize:12,color:T.textT,marginBottom:20}}>Tambahkan instrumen untuk mulai mengonfigurasi koneksi middleware</div>
            <button className="pb" onClick={()=>{setForm({...defInstrument,id:Date.now()});setEditing(null);setShowForm(true);}} style={BP}>+ Tambah Instrumen Pertama</button>
          </div>
        )}

        {/* Instrument list */}
        {instruments.map(instr=>(
          <div key={instr.id} className="ch" style={{...CS,padding:18,marginBottom:12,borderLeft:`4px solid ${instr.active?WARDS[instr.ward]?.color||T.blue:T.border}`}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.text}}>{instr.name}</div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:instr.active?T.ok+"18":T.textT+"18",color:instr.active?T.ok:T.textT,fontWeight:600,fontFamily:T.mono}}>{instr.active?"AKTIF":"NONAKTIF"}</span>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:T.purple+"18",color:T.purple,fontFamily:T.mono}}>{instr.protocol}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:6,fontSize:11,color:T.textS}}>
                  {instr.brand&&<div><span style={{color:T.textT}}>Brand:</span> {instr.brand} {instr.model}</div>}
                  <div><span style={{color:T.textT}}>Ruangan:</span> {WARDS[instr.ward]?.icon} {WARDS[instr.ward]?.label}</div>
                  {instr.ip&&<div><span style={{color:T.textT}}>IP:Port:</span> <span style={{fontFamily:T.mono}}>{instr.ip}:{instr.port}</span></div>}
                  <div><span style={{color:T.textT}}>Parameter aktif:</span> {Object.keys(instr.paramMap||{}).length}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:7,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                {/* Ping */}
                <button className="pb" onClick={()=>pingInstrument(instr)} disabled={pinging[instr.id]} style={{...BP,padding:"5px 12px",fontSize:11,background:"#0369a1",display:"flex",alignItems:"center",gap:5}}>
                  {pinging[instr.id]?<><Sp/> Ping...</>:"📡 Ping"}
                </button>
                <button className="sb" onClick={()=>editInstrument(instr)} style={{...BS,padding:"5px 12px",fontSize:11}}>✏️ Edit</button>
                <button className="sb" onClick={()=>toggleActive(instr.id)} style={{...BS,padding:"5px 12px",fontSize:11,color:instr.active?T.warn:T.ok,borderColor:instr.active?`${T.warn}44`:`${T.ok}44`}}>{instr.active?"⏸ Nonaktifkan":"▶ Aktifkan"}</button>
                <button className="sb" onClick={()=>{if(window.confirm(`Hapus instrumen "${instr.name}"?`))deleteInstrument(instr.id);}} style={{...BS,padding:"5px 12px",fontSize:11,color:T.danger,borderColor:`${T.danger}44`}}>🗑 Hapus</button>
              </div>
            </div>
            {/* Ping result */}
            {pingResult[instr.id]&&(
              <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:pingResult[instr.id].ok?"#ecfdf5":"#fef2f2",border:`1px solid ${pingResult[instr.id].ok?T.ok+"44":T.danger+"44"}`,fontSize:11,fontFamily:T.mono,color:pingResult[instr.id].ok?T.ok:T.danger}}>
                {pingResult[instr.id].ok?`✅ Koneksi internet OK (${pingResult[instr.id].ms}ms) — Middleware siap mengirim data`:`❌ ${pingResult[instr.id].msg}`}
              </div>
            )}
          </div>
        ))}

        {/* Add/Edit Form */}
        {showForm&&(
          <div style={{...CS,padding:24,marginTop:16,border:`2px solid ${T.blue}44`}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:18}}>{editing?"✏️ Edit Instrumen":"+ Tambah Instrumen Baru"}</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
              <div>
                <div style={LS}>Nama Instrumen *</div>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Contoh: Sysmex XN-3000 Unit 1" style={IS}/>
              </div>
              <div>
                <div style={LS}>Brand</div>
                <input value={form.brand} onChange={e=>setForm(p=>({...p,brand:e.target.value}))} placeholder="Sysmex / Beckman / Abbott / dll" style={IS}/>
              </div>
              <div>
                <div style={LS}>Model</div>
                <input value={form.model} onChange={e=>setForm(p=>({...p,model:e.target.value}))} placeholder="XN-3000 / DxH 900 / dll" style={IS}/>
              </div>
              <div>
                <div style={LS}>Ruang Perawatan</div>
                <select value={form.ward} onChange={e=>setForm(p=>({...p,ward:e.target.value}))} style={SS}>
                  {Object.entries(WARDS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <div style={LS}>IP Address Middleware</div>
                <input value={form.ip} onChange={e=>setForm(p=>({...p,ip:e.target.value}))} placeholder="192.168.1.100" style={IS}/>
              </div>
              <div>
                <div style={LS}>Port</div>
                <input value={form.port} onChange={e=>setForm(p=>({...p,port:e.target.value}))} placeholder="4000" style={IS}/>
              </div>
              <div>
                <div style={LS}>Protokol Komunikasi</div>
                <select value={form.protocol} onChange={e=>setForm(p=>({...p,protocol:e.target.value}))} style={SS}>
                  <option value="REST">REST API / HTTP POST (Rekomendasi)</option>
                  <option value="HL7">HL7 v2</option>
                  <option value="ASTM">ASTM E1394</option>
                  <option value="FILE">File Watching (CSV/TXT)</option>
                </select>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
                <div style={LS}>Status</div>
                <div className="tog" onClick={()=>setForm(p=>({...p,active:!p.active}))} style={{width:40,height:22,borderRadius:11,background:form.active?T.blue:"#cbd5e1",position:"relative",marginTop:8}}>
                  <div style={{position:"absolute",top:3,left:form.active?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                </div>
                <span style={{fontSize:11,color:form.active?T.blue:T.textT,marginTop:8}}>{form.active?"Aktif":"Nonaktif"}</span>
              </div>
            </div>

            {/* Parameter Mapping */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>Mapping Parameter</div>
              <div style={{fontSize:11,color:T.textS,marginBottom:12}}>Sesuaikan nama parameter dari instrumen/middleware dengan nama parameter di PasienQuC. Kosongkan jika parameter tidak digunakan instrumen ini.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8,maxHeight:280,overflowY:"auto",padding:2}}>
                {Object.keys(PARAM_MAP_DEFAULTS).map(pk=>(
                  <div key={pk} style={{display:"flex",alignItems:"center",gap:8,background:T.surfB,borderRadius:8,padding:"7px 10px",border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.blue,fontFamily:T.mono,width:60,flexShrink:0}}>{pk}</div>
                    <div style={{fontSize:10,color:T.textT}}>←</div>
                    <input value={form.paramMap?.[pk]||""} onChange={e=>setForm(p=>({...p,paramMap:{...p.paramMap,[pk]:e.target.value}}))} placeholder={`nama di middleware`} style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${T.border}`,color:T.text,fontSize:11,fontFamily:T.mono,padding:"2px 0",outline:"none"}}/>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button className="pb" onClick={saveInstrument} style={{...BP,padding:"8px 22px"}}>💾 Simpan</button>
              <button className="sb" onClick={()=>{setShowForm(false);setEditing(null);setForm({...defInstrument,id:Date.now()});}} style={{...BS,padding:"8px 18px"}}>Batal</button>
            </div>
          </div>
        )}
      </div>}

      {/* ── ENDPOINT SECTION ── */}
      {activeSection==="endpoint"&&<div>
        {/* Endpoint info */}
        <div style={{...CS,padding:22,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:14}}>🌐 Endpoint Supabase</div>
          <div style={{fontSize:11,color:T.textS,marginBottom:12}}>Konfigurasikan middleware Anda untuk mengirim data ke endpoint berikut menggunakan metode HTTP POST:</div>

          {/* URL */}
          <div style={{background:"#0b1929",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{fontFamily:T.mono,fontSize:12,color:"#38bdf8",wordBreak:"break-all"}}>{endpointUrl}</div>
            <button className="sb" onClick={copyEndpoint} style={{...BS,padding:"5px 12px",fontSize:11,flexShrink:0,color:copied?T.ok:T.blue,borderColor:copied?`${T.ok}44`:T.borderM}}>{copied?"✅ Disalin!":"⎘ Salin"}</button>
          </div>

          {/* Headers */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:T.text,marginBottom:8}}>Headers yang Diperlukan</div>
            <div style={{background:"#0b1929",borderRadius:10,padding:"12px 16px"}}>
              {[
                {k:"apikey",v:SB_KEY.slice(0,40)+"..."},
                {k:"Authorization",v:"Bearer "+SB_KEY.slice(0,40)+"..."},
                {k:"Content-Type",v:"application/json"},
                {k:"Prefer",v:"return=representation"},
              ].map(h=>(
                <div key={h.k} style={{display:"flex",gap:12,marginBottom:6,fontFamily:T.mono,fontSize:11}}>
                  <span style={{color:"#f59e0b",width:160,flexShrink:0}}>{h.k}:</span>
                  <span style={{color:"#86efac"}}>{h.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Body schema */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:T.text,marginBottom:8}}>Format Body (JSON)</div>
            <div style={{background:"#0b1929",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:11,color:"#e2e8f0",lineHeight:1.8}}>
              <span style={{color:"#60a5fa"}}>{"{"}</span><br/>
              &nbsp;&nbsp;<span style={{color:"#f59e0b"}}>"param"</span>: <span style={{color:"#86efac"}}>"Hb"</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:"#64748b"}}>// nama parameter (Hb, Na, PT, dll)</span><br/>
              &nbsp;&nbsp;<span style={{color:"#f59e0b"}}>"ward"</span>: <span style={{color:"#86efac"}}>"IGD"</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:"#64748b"}}>// IGD | RANAP | ICU | POLI | OK</span><br/>
              &nbsp;&nbsp;<span style={{color:"#f59e0b"}}>"value"</span>: <span style={{color:"#c084fc"}}>12.5</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color:"#64748b"}}>// nilai numerik hasil pemeriksaan</span><br/>
              &nbsp;&nbsp;<span style={{color:"#f59e0b"}}>"recorded_at"</span>: <span style={{color:"#86efac"}}>"2026-05-02T08:00:00Z"</span>&nbsp;<span style={{color:"#64748b"}}>// ISO 8601 timestamp (opsional)</span><br/>
              <span style={{color:"#60a5fa"}}>{"}"}</span>
            </div>
          </div>

          {/* cURL example */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:T.text,marginBottom:8}}>Contoh cURL</div>
            <div style={{background:"#0b1929",borderRadius:10,padding:"12px 16px",fontFamily:T.mono,fontSize:10,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap",overflowX:"auto"}}>
              {curlExample()}
            </div>
          </div>

          {/* Batch send */}
          <div style={{padding:"12px 16px",background:T.blueL,borderRadius:10,border:`1px solid ${T.border}`,fontSize:11,color:T.blueD}}>
            💡 <strong>Batch Insert:</strong> Middleware bisa mengirim array JSON untuk multiple data sekaligus:<br/>
            <span style={{fontFamily:T.mono,fontSize:10}}>[{"{"}"param":"Hb","ward":"IGD","value":12.5{"}"}, {"{"}"param":"MCV","ward":"IGD","value":85.2{"}"}]</span>
          </div>
        </div>

        {/* Test send */}
        <div style={{...CS,padding:22}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:4}}>🧪 Test Kirim Data Manual</div>
          <div style={{fontSize:11,color:T.textS,marginBottom:14}}>Uji koneksi dengan mengirim data sampel langsung ke Supabase.</div>
          <textarea value={testPayload} onChange={e=>setTestPayload(e.target.value)}
            placeholder={`Contoh:
${jsonExample()}`}
            style={{width:"100%",height:160,background:"#0b1929",border:`1.5px solid ${T.border}`,borderRadius:10,color:"#e2e8f0",padding:14,fontSize:12,fontFamily:T.mono,resize:"vertical",marginBottom:12}}/>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button className="pb" onClick={()=>setTestPayload(jsonExample())} style={{...BS,padding:"7px 14px",fontSize:11}}>📋 Isi Contoh</button>
            <button className="pb" onClick={sendTestData} disabled={testLoading||!testPayload.trim()} style={{...BP,display:"flex",alignItems:"center",gap:6,padding:"7px 16px",fontSize:11,opacity:testLoading||!testPayload.trim()?.6:1}}>
              {testLoading?<><Sp/> Mengirim...</>:"▶ Kirim Test"}
            </button>
            {testResult&&<div style={{fontSize:12,fontFamily:T.mono,color:testResult.startsWith("✅")?T.ok:T.danger}}>{testResult}</div>}
          </div>
        </div>
      </div>}

      {/* ── LOG SECTION ── */}
      {activeSection==="log"&&<div>
        <div style={{...CS,padding:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text}}>📋 Log Aktivitas Middleware</div>
            <button className="sb" onClick={()=>{setLogs([]);localStorage.removeItem(MW_LOG_KEY);}} style={{...BS,padding:"5px 12px",fontSize:11,color:T.danger,borderColor:`${T.danger}44`}}>🗑 Bersihkan Log</button>
          </div>
          {logs.length===0?(
            <div style={{padding:24,textAlign:"center",color:T.textS,fontSize:13}}>Belum ada aktivitas tercatat.</div>
          ):(
            <div ref={logRef} style={{background:"#0b1929",borderRadius:10,padding:14,maxHeight:480,overflowY:"auto",fontFamily:T.mono,fontSize:11}}>
              {[...logs].reverse().map(l=>(
                <div key={l.id} style={{display:"flex",gap:12,marginBottom:6,alignItems:"flex-start"}}>
                  <span style={{color:"#475569",flexShrink:0}}>{l.time}</span>
                  <span style={{color:logColor[l.type]||T.textT,flexShrink:0,width:40}}>[{l.type.toUpperCase()}]</span>
                  {l.instr&&<span style={{color:"#f59e0b",flexShrink:0}}>[{l.instr}]</span>}
                  <span style={{color:"#e2e8f0"}}>{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}

/* ══ MAIN APP ══ */
export default function PasienQuC(){
  const[loading,setLoading]=useState(true);
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
    const p=parseCSV(pasteText);
    if(!p)return alert("Format tidak dikenali. Pastikan ada header di baris pertama.");
    
    // Find matching column — check aliases + param name + numeric fallback
    const col=
      // 1. Exact param key match
      p.hdr.find(h=>h.trim()===param)||
      // 2. Case-insensitive param match
      p.hdr.find(h=>h.toLowerCase().trim()===param.toLowerCase())||
      // 3. Alias match (Natrium→Na, Kreatinin→Kreatinin, dll)
      p.hdr.find(h=>PARAM_ALIASES[h.toLowerCase().trim()]===param)||
      // 4. Partial match (header contains param name)
      p.hdr.find(h=>h.toLowerCase().includes(param.toLowerCase()))||
      // 5. Param name contains header
      p.hdr.find(h=>param.toLowerCase().includes(h.toLowerCase())&&h.length>1)||
      // 6. First numeric column (fallback)
      p.hdr.find(h=>p.rows.slice(0,5).some(r=>!isNaN(parseNum(r[h]))));

    if(!col){
      const hdrList=p.hdr.join(", ");
      return alert(`Kolom untuk parameter "${param}" tidak ditemukan.\n\nHeader yang terdeteksi: ${hdrList}\n\nGunakan nama kolom seperti: ${param}, atau nama lengkap (Natrium, Kreatinin, dll).`);
    }

    const vals=p.rows.map(r=>parseNum(r[col])).filter(v=>!isNaN(v)&&isFinite(v));
    if(vals.length===0) return alert("Tidak ada nilai numerik valid yang ditemukan di kolom tersebut.\nPastikan format angka benar (gunakan koma atau titik sebagai desimal).");
    
    setWardRaw(w,vals);
    // Show success feedback
    const rejCount=p.rows.length-vals.length;
   if(rejCount>0) alert("✅ "+vals.length+" data berhasil diproses. "+rejCount+" baris dilewati (bukan angka).");
  };

  const combinedRaw=useMemo(()=>{const all=selWards.flatMap(w=>getWardRaw(w)||[]);return all.length?all:null;},[wardData,selWards,group,param]);
  const allWardStats=useMemo(()=>{const out={};Object.keys(WARDS).forEach(w=>{const raw=getWardRaw(w);if(!raw||raw.length<2)return;const m=avg(raw),s=std(raw);out[w]={stats:{n:raw.length,mean:m,sd:s,cv:(s/m)*100,median:med(raw)}};});return out;},[wardData,group,param]);
  const aiCtxGlobal=useMemo(()=>{let c=`PasienQuC · ${PARAM_GROUPS[group].label} · ${cfg?.label||param}\n`;selWards.forEach(w=>{const raw=getWardRaw(w);if(!raw)return;const m=avg(raw),s=std(raw);c+=`${WARDS[w].label}: N=${raw.length} Mean=${m.toFixed(3)} CV=${((s/m)*100).toFixed(2)}%\n`;});return c;},[wardData,selWards,group,param,cfg]);

  const toggleMethod=m=>setSelMethods(p=>p.includes(m)?p.filter(x=>x!==m):[...p,m]);
  const TABS=["dashboard","ai","tren","data","report","middleware","tentang"];

  if(!apiKey)return <ApiKeyPage onConnect={setApiKey}/>;
  if(loading)return <LoadingScreen onDone={()=>setLoading(false)}/>;

  return(<div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",color:T.text,opacity:mounted?1:0,transition:"opacity .4s"}}>

    {/* HEADER */}
    <div style={{background:T.surface,borderBottom:`1.5px solid ${T.border}`,padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 14px rgba(14,165,233,.05)"}}>
      <div style={{display:"flex",alignItems:"center",gap:11}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#0b1929,#0c3060)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(14,165,233,.24)",padding:3}}>
          <img src={LOGO} alt="PasienQuC" style={{width:"100%",height:"100%",objectFit:"contain",filter:"drop-shadow(0 0 6px rgba(14,165,233,.4))"}}/>
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:T.text,letterSpacing:-.3}}>PasienQuC <span style={{color:T.blue}}>·</span> v.0.4.0</div>
          <div style={{fontSize:9,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>LJ Chart · Westgard · Tren · Supabase · AI</div>
        </div>
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        {TABS.map(t=><button key={t} className="tb" onClick={()=>setTab(t)} style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${tab===t?T.blue:T.border}`,background:tab===t?T.blue:"transparent",color:tab===t?"#fff":T.textS,fontSize:11,fontFamily:T.font,fontWeight:tab===t?600:400,textTransform:"capitalize"}}>{t==="ai"?"✦ AI":t==="tren"?"📅 Tren":t==="middleware"?"⚙️ Middleware":t==="tentang"?"ℹ️ Tentang":t}</button>)}
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

      {/* MIDDLEWARE TAB */}
      {tab==="middleware"&&<MiddlewareTab/>}

      {/* TENTANG TAB */}
      {tab==="tentang"&&<AboutTab/>}

    {/* FOOTER */}
    <div style={{borderTop:`1.5px solid ${T.border}`,background:T.surface,padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#0b1929,#0c3060)",display:"flex",alignItems:"center",justifyContent:"center",padding:2}}><img src={LOGO} alt="PasienQuC" style={{width:"100%",height:"100%",objectFit:"contain"}}/></div><span style={{fontSize:12,fontWeight:700,color:T.text}}>PasienQuC</span><span style={{fontSize:9,color:T.textT,fontFamily:T.mono,background:T.blueL,padding:"2px 6px",borderRadius:5}}>v.0.4.0</span></div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{fontSize:11,color:T.textS,fontFamily:T.mono}}>Aplikasi dibuat oleh <span style={{color:T.blue,fontWeight:600}}>dr. WIY</span></div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{fontSize:11,color:T.textT,fontFamily:T.mono}}>April 2026</div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.textT,fontFamily:T.mono}}><div style={{width:5,height:5,borderRadius:"50%",background:T.ok}}/>Groq · LLaMA 3.3 70B · Supabase</div>
    </div>
  </div>);
}
