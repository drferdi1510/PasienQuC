import { useState, useMemo, useRef, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, BarChart, Bar } from "recharts";

(() => { const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap";document.head.appendChild(l); })();
(() => { const s=document.createElement("style");s.textContent=`*{box-sizing:border-box;}@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}.fu{animation:fadeUp .45s cubic-bezier(.22,1,.36,1) both}.fi{animation:fadeIn .35s ease both}.si{animation:slideIn .3s ease both}.card-h{transition:box-shadow .2s,transform .2s}.card-h:hover{box-shadow:0 8px 28px rgba(14,165,233,.11);transform:translateY(-2px)}.tb{transition:all .16s ease;cursor:pointer}.tb:hover{background:rgba(14,165,233,.07)!important}.pill{transition:all .14s ease;cursor:pointer}.pill:hover{transform:scale(1.03)}.pbtn{transition:all .16s ease;cursor:pointer}.pbtn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(14,165,233,.26)}.pbtn:active{transform:translateY(0)}.sbtn{transition:all .14s ease;cursor:pointer}.sbtn:hover{background:rgba(14,165,233,.06)!important}.tog{transition:background .2s;cursor:pointer}.spin{animation:spin .8s linear infinite}.pulse-txt{animation:pulse 1.5s ease infinite}.blink{animation:blink 1s step-end infinite}input:focus,select:focus,textarea:focus{outline:none;border-color:#0ea5e9!important}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(14,165,233,.22);border-radius:10px}.chat-bubble{line-height:1.68;white-space:pre-wrap;word-break:break-word}.ward-tag{transition:all .14s;cursor:pointer}.ward-tag:hover{transform:scale(1.04)}`;document.head.appendChild(s); })();

const T={bg:"#eef5ff",surface:"#ffffff",surfB:"#f5faff",border:"rgba(14,165,233,.14)",borderM:"rgba(14,165,233,.32)",blue:"#0ea5e9",blueD:"#0369a1",blueL:"#e0f2fe",text:"#0b1929",textS:"#3d5a7a",textT:"#7aa0bc",ok:"#10b981",warn:"#f59e0b",danger:"#ef4444",purple:"#8b5cf6",font:"'DM Sans',sans-serif",mono:"'DM Mono',monospace"};

const WARDS={IGD:{label:"IGD",color:"#ef4444",icon:"🚨"},RANAP:{label:"Rawat Inap",color:"#3b82f6",icon:"🏥"},ICU:{label:"ICU / HCU",color:"#8b5cf6",icon:"💊"},POLI:{label:"Poli Rawat Jalan",color:"#10b981",icon:"🩺"},OK:{label:"OK / Kamar Operasi",color:"#f59e0b",icon:"⚕️"}};

const PARAM_GROUPS={
  HEMATOLOGI:{label:"Hematologi CBC",icon:"🩸",color:"#ef4444",params:{Hb:{label:"Hemoglobin (Hb)",unit:"g/dL",refLow:12,refHigh:17.5,trim:.20,tea:1.5},MCV:{label:"MCV",unit:"fL",refLow:80,refHigh:100,trim:.15,tea:2.5},PLT:{label:"Trombosit",unit:"×10³/µL",refLow:150,refHigh:400,trim:.25,tea:9.0},WBC:{label:"Leukosit",unit:"×10³/µL",refLow:4,refHigh:11,trim:.25,tea:9.0},MCH:{label:"MCH",unit:"pg",refLow:27,refHigh:33,trim:.15,tea:2.5},MCHC:{label:"MCHC",unit:"g/dL",refLow:32,refHigh:36,trim:.15,tea:2.5},RBC:{label:"Eritrosit",unit:"×10⁶/µL",refLow:3.8,refHigh:6.0,trim:.20,tea:2.5}}},
  KIMIA:{label:"Kimia Klinik",icon:"⚗️",color:"#3b82f6",params:{Na:{label:"Natrium (Na)",unit:"mEq/L",refLow:135,refHigh:145,trim:.15,tea:1.5},K:{label:"Kalium (K)",unit:"mEq/L",refLow:3.5,refHigh:5.0,trim:.15,tea:5.0},Cl:{label:"Klorida (Cl)",unit:"mEq/L",refLow:96,refHigh:106,trim:.15,tea:2.0},Glukosa:{label:"Glukosa Darah",unit:"mg/dL",refLow:70,refHigh:100,trim:.25,tea:6.0},Ureum:{label:"Ureum",unit:"mg/dL",refLow:10,refHigh:50,trim:.20,tea:9.0},Kreatinin:{label:"Kreatinin",unit:"mg/dL",refLow:0.6,refHigh:1.2,trim:.20,tea:8.9},Albumin:{label:"Albumin",unit:"g/dL",refLow:3.5,refHigh:5.0,trim:.15,tea:5.0},BilTotal:{label:"Bilirubin Total",unit:"mg/dL",refLow:0.2,refHigh:1.2,trim:.25,tea:9.0},SGOT:{label:"SGOT (AST)",unit:"U/L",refLow:5,refHigh:40,trim:.25,tea:9.0},SGPT:{label:"SGPT (ALT)",unit:"U/L",refLow:5,refHigh:41,trim:.25,tea:9.0},GGT:{label:"Gamma GT",unit:"U/L",refLow:8,refHigh:61,trim:.25,tea:9.0},TotProt:{label:"Protein Total",unit:"g/dL",refLow:6.3,refHigh:8.2,trim:.15,tea:5.0}}},
  KOAGULASI:{label:"Koagulasi",icon:"🧬",color:"#8b5cf6",params:{PT:{label:"Prothrombin Time",unit:"detik",refLow:10,refHigh:14,trim:.15,tea:5.0},APTT:{label:"APTT",unit:"detik",refLow:25,refHigh:35,trim:.15,tea:5.0},INR:{label:"INR",unit:"",refLow:0.8,refHigh:1.2,trim:.15,tea:5.0},Fibrinogen:{label:"Fibrinogen",unit:"mg/dL",refLow:200,refHigh:400,trim:.20,tea:9.0},DDimer:{label:"D-Dimer",unit:"ng/mL",refLow:0,refHigh:500,trim:.25,tea:9.0}}},
  AGD:{label:"Analisis Gas Darah",icon:"💨",color:"#f59e0b",params:{pH:{label:"pH",unit:"",refLow:7.35,refHigh:7.45,trim:.10,tea:1.2},pCO2:{label:"pCO2",unit:"mmHg",refLow:35,refHigh:45,trim:.15,tea:5.0},pO2:{label:"pO2",unit:"mmHg",refLow:80,refHigh:100,trim:.20,tea:9.0},HCO3:{label:"HCO3⁻",unit:"mEq/L",refLow:22,refHigh:26,trim:.15,tea:5.0},BE:{label:"Base Excess",unit:"mEq/L",refLow:-2,refHigh:2,trim:.15,tea:5.0},SaO2:{label:"SaO2",unit:"%",refLow:95,refHigh:100,trim:.10,tea:2.0},Laktat:{label:"Laktat",unit:"mmol/L",refLow:0.5,refHigh:2.0,trim:.20,tea:9.0}}},
  URINALISIS:{label:"Urinalisis",icon:"🧪",color:"#10b981",params:{pHUrin:{label:"pH Urin",unit:"",refLow:4.5,refHigh:8.0,trim:.15,tea:5.0},BJUrin:{label:"Berat Jenis",unit:"",refLow:1.005,refHigh:1.030,trim:.10,tea:2.0},ProtUrin:{label:"Protein Urin",unit:"mg/dL",refLow:0,refHigh:14,trim:.25,tea:9.0},GluUrin:{label:"Glukosa Urin",unit:"mg/dL",refLow:0,refHigh:15,trim:.25,tea:9.0}}},
  IMUNOSEROLOGI:{label:"Imunoserologi",icon:"🛡️",color:"#06b6d4",params:{CRP:{label:"C-Reactive Protein",unit:"mg/L",refLow:0,refHigh:5,trim:.25,tea:9.0},PCT:{label:"Prokalsitonin",unit:"ng/mL",refLow:0,refHigh:0.5,trim:.25,tea:9.0},Ferritin:{label:"Ferritin",unit:"ng/mL",refLow:12,refHigh:300,trim:.25,tea:9.0},IL6:{label:"Interleukin-6",unit:"pg/mL",refLow:0,refHigh:7,trim:.25,tea:9.0}}}
};

const METHODS={MA:{label:"Moving Average",short:"MA",color:"#0ea5e9",dash:"none"},EWMA:{label:"EWMA",short:"EWMA",color:"#10b981",dash:"5 3"},TRIM:{label:"Trimmed Mean",short:"Trim",color:"#f59e0b",dash:"3 3"},MEDIAN:{label:"Median/AoN",short:"Med",color:"#8b5cf6",dash:"8 3"}};

const GROQ_EP=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"?"https://api.groq.com/openai/v1/chat/completions":"/api/groq/openai/v1/chat/completions";
async function aiChat(apiKey,messages,onChunk){
  const res=await fetch(GROQ_EP,{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"llama-3.3-70b-versatile",messages,max_tokens:1024,stream:true,temperature:0.4})});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error?.message||`Groq error: ${res.status}`);}
  const reader=res.body.getReader(),dec=new TextDecoder();let full="";
  while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value);for(const line of chunk.split("\n")){if(!line.startsWith("data: "))continue;const data=line.slice(6).trim();if(data==="[DONE]")break;try{const j=JSON.parse(data),t=j.choices?.[0]?.delta?.content||"";full+=t;onChunk?.(full);}catch{}}}
  return full;
}

const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
const std=a=>{const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const calcMA=(v,n)=>v.map((_,i)=>i<n-1?null:+avg(v.slice(i-n+1,i+1)).toFixed(3));
const calcEWMA=(v,l=.2)=>{let e=v[0];return v.map(x=>+(e=l*x+(1-l)*e).toFixed(3));};
const calcTrim=(v,n,f)=>v.map((_,i)=>{if(i<n-1)return null;const s=[...v.slice(i-n+1,i+1)].sort((a,b)=>a-b),k=Math.floor(s.length*f),t=s.slice(k,s.length-k);return +avg(t).toFixed(3);});
const calcMed=(v,n)=>v.map((_,i)=>i<n-1?null:+med(v.slice(i-n+1,i+1)).toFixed(3));
const getLimits=(v,mult)=>{const vals=v.filter(x=>x!==null),m=avg(vals),s=std(vals);return{target:m,ucl:m+mult*s,lcl:m-mult*s};};

function genDemo(cfg,ward,n=130){
  const mid=(cfg.refLow+cfg.refHigh)/2,span=(cfg.refHigh-cfg.refLow)*.55;
  const bias=ward==="ICU"?.15:ward==="IGD"?.10:ward==="POLI"?-.05:0;
  const spread=ward==="ICU"||ward==="IGD"?1.3:ward==="POLI"?.7:1.0;
  return Array.from({length:n},(_,i)=>{const drift=i>=90?(cfg.refHigh-mid)*.25:0;const v=mid*(1+bias)+drift+(Math.random()-.5)*span*spread+(Math.random()-.5)*span*.2;return +Math.max(cfg.refLow*.3,Math.min(cfg.refHigh*1.8,v)).toFixed(3);});
}
function parseCSV(txt){const lines=txt.trim().split(/\r?\n/).filter(Boolean);if(lines.length<2)return null;const hdr=lines[0].split(/[,;\t]/).map(h=>h.trim());const rows=lines.slice(1).map(l=>{const c=l.split(/[,;\t]/),o={};hdr.forEach((h,i)=>o[h]=c[i]?.trim());return o;});return{hdr,rows};}

const CS={background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:20,boxShadow:"0 2px 12px rgba(14,165,233,.05)"};
const LS={fontSize:10,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:8};
const SS={width:"100%",background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:T.font};
const IS={width:"100%",background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:14,fontFamily:T.mono};
const BP={padding:"9px 20px",background:T.blue,border:"none",borderRadius:9,color:"#fff",fontSize:12,fontFamily:T.font,fontWeight:600};
const BS={padding:"9px 20px",background:"transparent",border:`1.5px solid ${T.borderM}`,borderRadius:9,color:T.blue,fontSize:12,fontFamily:T.font};
function Spinner(){return <div className="spin" style={{width:15,height:15,border:`2px solid ${T.blueL}`,borderTop:`2px solid ${T.blue}`,borderRadius:"50%",display:"inline-block"}}/>;}

function ApiKeyPage({onConnect}){
  const[key,setKey]=useState(""),[show,setShow]=useState(false),[err,setErr]=useState("");
  const go=()=>{const t=key.trim();if(!t.startsWith("gsk_")||t.length<20){setErr("Format tidak valid. Harus diawali gsk_ (min 20 karakter).");return;}onConnect(t);};
  return(<div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div className="fu" style={{textAlign:"center",marginBottom:40}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:16}}>
        <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 22px rgba(14,165,233,.32)"}}>
          <svg width="26" height="26" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="14" r="1.5" fill="white"/><circle cx="19" cy="8" r="1.5" fill="white"/></svg>
        </div>
        <div style={{textAlign:"left"}}><div style={{fontSize:26,fontWeight:700,color:T.text,letterSpacing:-.5}}>PasienQuC</div><div style={{fontSize:11,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>v.0.3.0 · Multi-Parameter · Multi-Ward</div></div>
      </div>
      <div style={{fontSize:14,color:T.textS,maxWidth:500,lineHeight:1.7,margin:"0 auto"}}>PBRTQC untuk <strong>6 kelompok parameter</strong> laboratorium dan <strong>5 ruang perawatan</strong>, dilengkapi interpretasi AI, chatbot, dan narasi laporan otomatis.</div>
      <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap",marginTop:14}}>{Object.values(WARDS).map(w=><span key={w.label} style={{fontSize:11,padding:"4px 11px",borderRadius:20,background:w.color+"18",color:w.color,border:`1px solid ${w.color}44`,fontWeight:600}}>{w.icon} {w.label}</span>)}</div>
      <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap",marginTop:7}}>{Object.values(PARAM_GROUPS).map(g=><span key={g.label} style={{fontSize:11,padding:"4px 11px",borderRadius:20,background:g.color+"12",color:g.color,border:`1px solid ${g.color}33`}}>{g.icon} {g.label}</span>)}</div>
    </div>
    <div className="fu" style={{...CS,width:"100%",maxWidth:450,padding:30,animationDelay:"100ms"}}>
      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:5}}>Masukkan Groq API Key</div>
      <div style={{fontSize:12,color:T.textS,marginBottom:16,lineHeight:1.6}}>Daftar gratis di <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{color:T.blue,fontWeight:600,textDecoration:"none"}}>console.groq.com/keys ↗</a> · Key hanya disimpan lokal di session ini.</div>
      <div style={{position:"relative",marginBottom:12}}>
        <input type={show?"text":"password"} value={key} onChange={e=>{setKey(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="gsk_xxxxxxxxxxxxxxxxxxxx" style={{...IS,paddingRight:46,letterSpacing:show?0:2}}/>
        <button onClick={()=>setShow(!show)} style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textT,fontSize:17,padding:0}}>{show?"🙈":"👁"}</button>
      </div>
      {err&&<div style={{background:"#fef2f2",border:`1px solid ${T.danger}44`,borderRadius:8,padding:"8px 12px",fontSize:12,color:T.danger,marginBottom:11}}>{err}</div>}
      <button className="pbtn" onClick={go} disabled={!key.trim()} style={{...BP,width:"100%",opacity:!key.trim()?.6:1}}>▶ Masuk ke PasienQuC</button>
      <div style={{marginTop:16,padding:"12px 14px",background:T.surfB,borderRadius:10,border:`1px solid ${T.border}`}}>
        <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:5,letterSpacing:1.5}}>FITUR AI · Groq + LLaMA 3.3 70B</div>
        {["✦ Interpretasi otomatis per parameter & ruangan","✦ Chatbot analitik laboratorium","✦ Narasi laporan QC siap cetak"].map(f=><div key={f} style={{fontSize:12,color:T.textS,marginBottom:2}}>{f}</div>)}
      </div>
    </div>
    <div className="fu" style={{marginTop:20,fontSize:11,color:T.textT,fontFamily:T.mono,animationDelay:"180ms"}}>Aplikasi dibuat oleh dr. WIY · PasienQuC v.0.3.0 · April 2026</div>
  </div>);
}

function WardSelector({selected,onChange,multi=false}){
  const toggle=w=>{if(!multi){onChange([w]);return;}onChange(selected.includes(w)?selected.filter(x=>x!==w):[...selected,w]);};
  return(<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{Object.entries(WARDS).map(([k,v])=>{const on=selected.includes(k);return(<div key={k} className="ward-tag" onClick={()=>toggle(k)} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${on?v.color:T.border}`,background:on?v.color+"13":"transparent",color:on?v.color:T.textS,fontSize:12,fontWeight:on?600:400,display:"flex",alignItems:"center",gap:5}}><span>{v.icon}</span><span>{v.label}</span></div>);})}</div>);
}

function GroupSelector({selected,onChange}){
  return(<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{Object.entries(PARAM_GROUPS).map(([k,g])=>{const on=selected===k;return(<div key={k} className="ward-tag" onClick={()=>onChange(k)} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${on?g.color:T.border}`,background:on?g.color+"13":"transparent",color:on?g.color:T.textS,fontSize:12,fontWeight:on?600:400,display:"flex",alignItems:"center",gap:5}}><span>{g.icon}</span><span>{g.label}</span></div>);})}</div>);
}

function AIInterpret({apiKey,context,paramLabel,ward}){
  const[txt,setTxt]=useState(""),[loading,setLoading]=useState(false);
  const run=async()=>{setLoading(true);setTxt("");try{await aiChat(apiKey,[{role:"system",content:`Kamu konsultan QC laboratorium klinis senior (Sp.PK). Interpretasikan data PBRTQC singkat, klinis, actionable. Bahasa Indonesia formal. Paragraf pendek, maks 180 kata. Perhatikan konteks ruangan: ${ward||"umum"}.`},{role:"user",content:`Interpretasikan data QC:

${context}`}],t=>setTxt(t));}catch(e){setTxt(`❌ ${e.message}`);}finally{setLoading(false);}};
  return(<div style={{...CS,marginTop:16}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>✦ Interpretasi AI — {paramLabel}</div><div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>LLaMA 3.3 70B via Groq</div></div>
      <button className="pbtn" onClick={run} disabled={loading} style={{...BP,display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:11}}>{loading?<><Spinner/> Menganalisis...</>:"▶ Generate"}</button>
    </div>
    {(txt||loading)&&<div style={{background:T.surfB,borderRadius:10,padding:14,border:`1.5px solid ${T.border}`,minHeight:60}}>{!txt&&loading?<div style={{display:"flex",gap:7,alignItems:"center",color:T.textT}}><Spinner/><span className="pulse-txt" style={{fontSize:12,fontFamily:T.mono}}>AI menganalisis...</span></div>:<div style={{fontSize:13,color:T.text,lineHeight:1.75}} className="chat-bubble">{txt}{loading&&<span className="blink" style={{color:T.blue}}>▌</span>}</div>}</div>}
  </div>);
}

function Chatbot({apiKey,context}){
  const[msgs,setMsgs]=useState([{role:"assistant",content:"Halo! Tanyakan apapun tentang hasil QC, PBRTQC, atau interpretasi data laboratorium Anda."}]);
  const[input,setInput]=useState(""),[loading,setLoading]=useState(false);const endRef=useRef();
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const send=async()=>{if(!input.trim()||loading)return;const um={role:"user",content:input.trim()};setMsgs(p=>[...p,um,{role:"assistant",content:""}]);setInput("");setLoading(true);
    try{await aiChat(apiKey,[{role:"system",content:`Asisten analitik PBRTQC PasienQuC. Bahasa Indonesia profesional. Maks 150 kata. Konteks:
${context}`},...msgs.slice(-8),um],t=>setMsgs(p=>[...p.slice(0,-1),{role:"assistant",content:t}]));}
    catch(e){setMsgs(p=>[...p.slice(0,-1),{role:"assistant",content:`❌ ${e.message}`}]);}finally{setLoading(false);}};
  return(<div style={{...CS,display:"flex",flexDirection:"column",height:440}}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:2}}>✦ Chatbot Analitik</div>
    <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:10}}>Tanya bebas seputar QC & PBRTQC</div>
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:9,marginBottom:10,paddingRight:3}}>
      {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}} className="si">
        {m.role==="assistant"&&<div style={{width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:6,marginTop:2}}><svg width="11" height="11" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
        <div style={{maxWidth:"78%",padding:"8px 12px",borderRadius:10,fontSize:12,background:m.role==="user"?T.blue:T.surfB,color:m.role==="user"?"#fff":T.text,border:m.role==="assistant"?`1px solid ${T.border}`:"none",borderBottomRightRadius:m.role==="user"?2:10,borderBottomLeftRadius:m.role==="assistant"?2:10}} className="chat-bubble">
          {m.content||(loading&&i===msgs.length-1?<span className="pulse-txt">✦ Mengetik...</span>:"")}{loading&&i===msgs.length-1&&m.content&&<span className="blink" style={{color:T.blue}}>▌</span>}
        </div>
      </div>))}
      <div ref={endRef}/>
    </div>
    <div style={{display:"flex",gap:6}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ketik pertanyaan..." style={{...IS,flex:1,padding:"8px 12px",fontSize:12}} disabled={loading}/><button className="pbtn" onClick={send} disabled={loading||!input.trim()} style={{...BP,padding:"8px 14px",opacity:loading||!input.trim()?.6:1}}>{loading?<Spinner/>:"→"}</button></div>
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}>{["Kenapa CV tinggi?","Apa makna drift?","Rule QC yang tepat?","Layak dilaporkan?"].map(q=><button key={q} className="sbtn" onClick={()=>setInput(q)} style={{...BS,padding:"3px 9px",fontSize:10,borderRadius:20}}>{q}</button>)}</div>
  </div>);
}

function NarrativeReport({apiKey,context,paramLabel,ward}){
  const[txt,setTxt]=useState(""),[loading,setLoading]=useState(false),[done,setDone]=useState(false),[fmt,setFmt]=useState("formal");
  const fmts={formal:"Laporan formal ISO 15189",ringkas:"Ringkasan eksekutif",rekomendasi:"Action plan teknis"};
  const run=async()=>{setLoading(true);setTxt("");setDone(false);const date=new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
    try{await aiChat(apiKey,[{role:"system",content:`Konsultan QC senior. Tulis narasi laporan QC profesional. Format: ${fmts[fmt]}. Bahasa Indonesia formal, paragraf mengalir, siap cetak. Sertakan: tanggal, parameter, ruangan, performa, temuan, rekomendasi. 250-320 kata.`},{role:"user",content:`Tulis laporan QC tanggal ${date} untuk ${paramLabel} dari ruang ${ward||"umum"}.

${context}`}],t=>setTxt(t));setDone(true);}
    catch(e){setTxt(`❌ ${e.message}`);setDone(true);}finally{setLoading(false);}};
  return(<div style={CS}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:2}}>✦ Narasi Laporan Otomatis</div>
    <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:12}}>AI menulis laporan QC siap cetak</div>
    <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      {Object.entries(fmts).map(([k,v])=><button key={k} className="pill" onClick={()=>setFmt(k)} style={{padding:"5px 13px",borderRadius:20,border:`1.5px solid ${fmt===k?T.blue:T.border}`,background:fmt===k?T.blueL:"transparent",color:fmt===k?T.blueD:T.textS,fontSize:11,fontWeight:fmt===k?600:400}}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>)}
      <button className="pbtn" onClick={run} disabled={loading} style={{...BP,marginLeft:"auto",display:"flex",alignItems:"center",gap:6,padding:"6px 14px",fontSize:11}}>{loading?<><Spinner/> Menulis...</>:"▶ Generate Laporan"}</button>
    </div>
    {(txt||loading)&&<div style={{background:T.surfB,borderRadius:10,padding:16,border:`1.5px solid ${T.border}`,minHeight:90}}>
      {!txt&&loading?<div style={{display:"flex",gap:7,alignItems:"center",color:T.textT}}><Spinner/><span className="pulse-txt" style={{fontSize:12,fontFamily:T.mono}}>AI menyusun narasi...</span></div>:
      <><div style={{fontSize:13,color:T.text,lineHeight:1.85,whiteSpace:"pre-wrap"}} className="chat-bubble">{txt}{loading&&<span className="blink" style={{color:T.blue}}>▌</span>}</div>
      {done&&<div style={{display:"flex",gap:8,marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
        <button className="sbtn" onClick={()=>navigator.clipboard.writeText(txt)} style={{...BS,padding:"5px 13px",fontSize:11}}>⎘ Salin</button>
        <button className="sbtn" onClick={()=>{const b=new Blob([txt],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`PasienQuC_${paramLabel}_${new Date().toISOString().slice(0,10)}.txt`;a.click();}} style={{...BS,padding:"5px 13px",fontSize:11}}>↓ Download</button>
      </div>}</>}
    </div>}
  </div>);
}

function StatCard({label,value,unit,color,delay=0,warn=false}){
  return(<div className="card-h fu" style={{animationDelay:`${delay}ms`,background:T.surface,border:`1.5px solid ${warn?T.danger:T.border}`,borderRadius:13,padding:"12px 15px",borderTop:`3px solid ${color||T.blue}`,minWidth:0}}>
    <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:T.textT,fontFamily:T.mono,marginBottom:4}}>{label}</div>
    <div style={{fontSize:21,fontWeight:700,color:warn?T.danger:T.text,lineHeight:1}}>{value}</div>
    <div style={{fontSize:10,color:T.textS,marginTop:2,fontFamily:T.mono}}>{unit}</div>
  </div>);
}

function WardComparisonChart({wardData,paramLabel,unit}){
  const data=Object.entries(wardData).map(([k,v])=>({ward:WARDS[k].label,mean:v.stats?+v.stats.mean.toFixed(2):0,cv:v.stats?+v.stats.cv.toFixed(2):0,n:v.stats?.n||0,color:WARDS[k].color})).filter(d=>d.n>0);
  if(!data.length)return null;
  return(<div style={{...CS,padding:20}}>
    <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>Perbandingan Antar Ruangan — {paramLabel}</div>
    <div style={{fontSize:10,color:T.textT,fontFamily:T.mono,marginBottom:14}}>Mean per ruang perawatan</div>
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{top:4,right:14,bottom:4,left:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
        <XAxis dataKey="ward" tick={{fontSize:10,fill:T.textT}} stroke={T.border}/>
        <YAxis tick={{fontSize:10,fill:T.textT}} stroke={T.border} label={{value:unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:9}}/>
        <Tooltip contentStyle={{background:T.surface,border:`1.5px solid ${T.borderM}`,fontSize:11,fontFamily:T.mono,borderRadius:8}}/>
        <Bar dataKey="mean" radius={[6,6,0,0]} fill={T.blue}/>
      </BarChart>
    </ResponsiveContainer>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:9,marginTop:14}}>
      {data.map(d=><div key={d.ward} style={{background:T.surfB,borderRadius:8,padding:"9px 11px",borderLeft:`3px solid ${d.color}`}}>
        <div style={{fontSize:11,fontWeight:600,color:d.color,marginBottom:3}}>{d.ward}</div>
        <div style={{fontSize:11,fontFamily:T.mono,color:T.text}}>Mean: {d.mean}</div>
        <div style={{fontSize:11,fontFamily:T.mono,color:T.textS}}>CV%: <span style={{color:d.cv>10?T.danger:d.cv>5?T.warn:T.ok,fontWeight:600}}>{d.cv}%</span></div>
        <div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>n={d.n}</div>
      </div>)}
    </div>
  </div>);
}

function QCPanel({data,cfg,blockSize,mult,useAoN,selMethods,apiKey,wardLabel,paramLabel}){
  const working=useMemo(()=>!data?null:useAoN?data.filter(v=>v>=cfg.refLow&&v<=cfg.refHigh):data,[data,useAoN,cfg]);
  const series=useMemo(()=>{if(!working||working.length<blockSize)return null;return{MA:calcMA(working,blockSize),EWMA:calcEWMA(working),TRIM:calcTrim(working,blockSize,cfg.trim),MEDIAN:calcMed(working,blockSize)};},[working,blockSize,cfg]);
  const limits=useMemo(()=>{if(!series)return null;const o={};Object.keys(series).forEach(m=>{o[m]=getLimits(series[m],mult);});return o;},[series,mult]);
  const violations=useMemo(()=>{if(!series||!limits)return null;const o={};Object.keys(series).forEach(m=>{o[m]=series[m].map((v,i)=>({idx:i,value:v,viol:v!==null&&(v>limits[m].ucl||v<limits[m].lcl)})).filter(d=>d.viol);});return o;},[series,limits]);
  const stats=useMemo(()=>{if(!working||!working.length)return null;const m=avg(working),s=std(working);return{n:working.length,mean:m,sd:s,cv:(s/m)*100,median:med(working)};},[working]);
  const chartData=useMemo(()=>{if(!working||!series)return[];return working.map((v,i)=>{const p={idx:i+1,raw:+v.toFixed(3)};Object.keys(series).forEach(m=>{if(series[m][i]!==null)p[m]=series[m][i];});return p;});},[working,series]);
  const aiCtx=useMemo(()=>{if(!stats||!limits)return"Belum ada data.";let c=`Parameter: ${paramLabel} (${cfg.unit}) | Ruang: ${wardLabel}
N=${stats.n} Mean=${stats.mean.toFixed(3)} SD=${stats.sd.toFixed(3)} CV=${stats.cv.toFixed(2)}% Median=${stats.median.toFixed(3)}
`;selMethods.forEach(m=>{if(limits[m])c+=`${METHODS[m].label}: UCL=${limits[m].ucl.toFixed(3)} LCL=${limits[m].lcl.toFixed(3)} Violations=${violations?.[m]?.length??0}
`;});return c;},[stats,limits,violations,selMethods,paramLabel,cfg,wardLabel]);
  const TT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:T.surface,border:`1.5px solid ${T.borderM}`,borderRadius:8,padding:"8px 12px",fontFamily:T.mono,fontSize:10,boxShadow:"0 4px 14px rgba(14,165,233,.09)"}}><div style={{color:T.textS,marginBottom:3}}>Pasien #{label}</div>{payload.map(p=><div key={p.dataKey} style={{color:p.color||T.text,marginBottom:1}}>{p.dataKey}: {typeof p.value==="number"?p.value.toFixed(3):p.value}</div>)}</div>);};
  if(!data||data.length<blockSize)return(<div style={{...CS,textAlign:"center",padding:28}}><div style={{fontSize:13,color:T.textS}}>Belum ada data — {wardLabel}</div><div style={{fontSize:10,color:T.textT,marginTop:5,fontFamily:T.mono}}>Min {blockSize} data diperlukan</div></div>);
  return(<div>
    {stats&&<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:9,marginBottom:16}}><StatCard label="N" value={stats.n} unit="data" color={T.blue} delay={0}/><StatCard label="Mean" value={stats.mean.toFixed(2)} unit={cfg.unit} color={T.blue} delay={50}/><StatCard label="SD" value={stats.sd.toFixed(3)} unit="" color={T.ok} delay={100}/><StatCard label="CV%" value={stats.cv.toFixed(2)+"%"} unit="" color={stats.cv>10?T.danger:T.warn} warn={stats.cv>10} delay={150}/><StatCard label="Median" value={stats.median.toFixed(2)} unit={cfg.unit} color={T.purple} delay={200}/></div>}
    {chartData.length>0&&series&&limits&&<div style={{...CS,padding:18,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Control Chart — {paramLabel} · {wardLabel}</div>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={chartData} margin={{top:4,right:12,bottom:12,left:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,.07)"/>
          <XAxis dataKey="idx" tick={{fontSize:9,fill:T.textT}} stroke={T.border}/>
          <YAxis tick={{fontSize:9,fill:T.textT}} stroke={T.border} label={{value:cfg.unit,angle:-90,position:"insideLeft",fill:T.textT,fontSize:9}}/>
          <Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:10,paddingTop:5}}/>
          <Line dataKey="raw" stroke="rgba(14,165,233,.14)" dot={false} strokeWidth={1} name="Raw" legendType="none"/>
          <ReferenceLine y={cfg.refHigh} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.4}/>
          <ReferenceLine y={cfg.refLow} stroke={T.textT} strokeDasharray="4 4" strokeOpacity={.4}/>
          {selMethods.map(m=>[<Line key={m} dataKey={m} stroke={METHODS[m].color} dot={false} strokeWidth={2} name={METHODS[m].label} connectNulls strokeDasharray={METHODS[m].dash}/>,<ReferenceLine key={m+"u"} y={limits[m].ucl} stroke={METHODS[m].color} strokeDasharray="2 5" strokeOpacity={.3}/>,<ReferenceLine key={m+"l"} y={limits[m].lcl} stroke={METHODS[m].color} strokeDasharray="2 5" strokeOpacity={.3}/>])}
        </LineChart>
      </ResponsiveContainer>
    </div>}
    {violations&&<div style={{...CS,padding:16,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:10}}>Violations per Metode</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
        {selMethods.map(m=>{const v=violations[m]??[],ok=v.length===0;return(<div key={m} style={{background:T.surfB,borderRadius:9,padding:"10px 12px",borderLeft:`3px solid ${METHODS[m].color}`}}><div style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",color:METHODS[m].color,fontFamily:T.mono,marginBottom:4}}>{METHODS[m].short}</div><div style={{fontSize:22,fontWeight:700,color:ok?T.ok:T.danger,fontFamily:T.mono}}>{v.length}</div><div style={{fontSize:10,color:T.textS}}>violations</div>{limits?.[m]&&<div style={{fontSize:9,color:T.textT,fontFamily:T.mono,marginTop:3}}>UCL {limits[m].ucl.toFixed(2)}</div>}</div>);})}
      </div>
    </div>}
    <AIInterpret apiKey={apiKey} context={aiCtx} paramLabel={paramLabel} ward={wardLabel}/>
  </div>);
}

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
  const getWardRaw=w=>wardData?.[`${group}_${param}_${w}`]?.raw||null;
  const setWardRaw=(w,raw)=>setWardData(p=>({...p,[`${group}_${param}_${w}`]:{raw}}));
  const loadDemo=w=>{if(cfg)setWardRaw(w,genDemo(cfg,w,130));};
  const handleFile=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPasteText(ev.target.result);r.readAsText(f);};
  const handlePaste=w=>{const p=parseCSV(pasteText);if(!p)return alert("Format tidak dikenali.");const col=p.hdr.find(h=>h.toLowerCase().includes(param.toLowerCase()))||p.hdr.find(h=>p.rows.every(r=>!isNaN(parseFloat(r[h]))));if(!col)return alert("Kolom numerik tidak ditemukan.");setWardRaw(w,p.rows.map(r=>parseFloat(r[col])).filter(v=>!isNaN(v)));};
  const combinedRaw=useMemo(()=>{const all=selWards.flatMap(w=>getWardRaw(w)||[]);return all.length?all:null;},[wardData,selWards,group,param]);
  const allWardStats=useMemo(()=>{const out={};Object.keys(WARDS).forEach(w=>{const raw=getWardRaw(w);if(!raw||raw.length<2)return;const m=avg(raw),s=std(raw);out[w]={stats:{n:raw.length,mean:m,sd:s,cv:(s/m)*100,median:med(raw)}};});return out;},[wardData,group,param]);
  const aiCtxGlobal=useMemo(()=>{let c=`PasienQuC · ${PARAM_GROUPS[group].label} · ${cfg?.label||param}
`;selWards.forEach(w=>{const raw=getWardRaw(w);if(!raw)return;const m=avg(raw),s=std(raw);c+=`${WARDS[w].label}: N=${raw.length} Mean=${m.toFixed(3)} CV=${((s/m)*100).toFixed(2)}%
`;});return c;},[wardData,selWards,group,param,cfg]);
  const toggleMethod=m=>setSelMethods(p=>p.includes(m)?p.filter(x=>x!==m):[...p,m]);

  if(!apiKey)return <ApiKeyPage onConnect={setApiKey}/>;

  return(<div style={{fontFamily:T.font,background:T.bg,minHeight:"100vh",color:T.text,opacity:mounted?1:0,transition:"opacity .4s"}}>
    {/* HEADER */}
    <div style={{background:T.surface,borderBottom:`1.5px solid ${T.border}`,padding:"12px 26px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 14px rgba(14,165,233,.05)"}}>
      <div style={{display:"flex",alignItems:"center",gap:11}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(14,165,233,.26)"}}><svg width="18" height="18" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="14" r="1.5" fill="white"/><circle cx="19" cy="8" r="1.5" fill="white"/></svg></div>
        <div><div style={{fontSize:15,fontWeight:700,color:T.text,letterSpacing:-.3}}>PasienQuC <span style={{color:T.blue}}>·</span> Multi-Parameter QC</div><div style={{fontSize:9,color:T.textT,fontFamily:T.mono,letterSpacing:1}}>v.0.3.0 · 6 Kelompok · 5 Ruangan · AI-Powered</div></div>
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        {["dashboard","ai","data","report"].map(t=><button key={t} className="tb" onClick={()=>setTab(t)} style={{padding:"5px 13px",borderRadius:7,border:`1.5px solid ${tab===t?T.blue:T.border}`,background:tab===t?T.blue:"transparent",color:tab===t?"#fff":T.textS,fontSize:11,fontFamily:T.font,fontWeight:tab===t?600:400,textTransform:"capitalize"}}>{t==="ai"?"✦ AI":t}</button>)}
        <div style={{marginLeft:5,display:"flex",alignItems:"center",gap:4,padding:"4px 9px",background:T.surfB,borderRadius:6,border:`1px solid ${T.border}`}}><div style={{width:6,height:6,borderRadius:"50%",background:T.ok}}/><span style={{fontSize:10,color:T.textS,fontFamily:T.mono}}>Groq</span></div>
        <button className="sbtn" onClick={()=>setApiKey("")} style={{padding:"4px 10px",background:"transparent",border:`1.5px solid ${T.danger}44`,borderRadius:7,color:T.danger,fontSize:11,fontFamily:T.font,cursor:"pointer"}}>Logout</button>
      </div>
    </div>

    <div style={{padding:"20px 26px"}}>
      {/* GLOBAL CONTROLS */}
      <div className="fu" style={{...CS,padding:16,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:12}}>
          <div><div style={LS}>Kelompok Parameter</div><GroupSelector selected={group} onChange={setGroup}/></div>
          <div><div style={LS}>Parameter</div><select value={param} onChange={e=>setParam(e.target.value)} style={SS}>{Object.entries(PARAM_GROUPS[group]?.params||{}).map(([k,v])=><option key={k} value={k}>{v.label} ({v.unit})</option>)}</select></div>
        </div>
        <div style={{marginBottom:12}}><div style={LS}>Ruang Perawatan</div><WardSelector selected={selWards} onChange={setSelWards} multi={true}/></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
          <div><div style={LS}>Tampilan</div><select value={viewMode} onChange={e=>setViewMode(e.target.value)} style={SS}><option value="single">Per Ruangan</option><option value="combined">Gabungan Semua</option><option value="compare">Perbandingan</option></select></div>
          <div><div style={LS}>Block Size (n)</div><input type="number" min={5} max={100} value={blockSize} onChange={e=>setBlockSize(+e.target.value)} style={IS}/></div>
          <div><div style={LS}>Control Limit</div><select value={mult} onChange={e=>setMult(+e.target.value)} style={SS}>{[1.5,2,2.5,3].map(v=><option key={v} value={v}>± {v} SD</option>)}</select></div>
          <div><div style={LS}>AoN Filter</div><div style={{display:"flex",alignItems:"center",gap:7,marginTop:7}}><div className="tog" onClick={()=>setUseAoN(!useAoN)} style={{width:38,height:20,borderRadius:10,background:useAoN?T.blue:"#cbd5e1",position:"relative"}}><div style={{position:"absolute",top:2,left:useAoN?19:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.12)"}}/></div><span style={{fontSize:11,color:useAoN?T.blue:T.textT}}>{useAoN?"Aktif":"Nonaktif"}</span></div><div style={{fontSize:9,color:T.textT,fontFamily:T.mono,marginTop:2}}>{cfg?.refLow}–{cfg?.refHigh} {cfg?.unit}</div></div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {Object.entries(METHODS).map(([k,v])=>{const on=selMethods.includes(k);return(<div key={k} className="pill" onClick={()=>toggleMethod(k)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${on?v.color:T.border}`,background:on?v.color+"10":"transparent",color:on?v.color:T.textS,fontSize:11,fontWeight:on?600:400}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:on?v.color:T.border,marginRight:4,verticalAlign:"middle"}}/>{v.label}</div>);})}
        </div>
      </div>

      {/* DASHBOARD */}
      {tab==="dashboard"&&<div className="fi">
        {viewMode==="single"&&<div>
          {selWards.length===0&&<div style={{...CS,padding:28,textAlign:"center",color:T.textS}}>Pilih minimal satu ruang perawatan.</div>}
          {selWards.map(w=>{const raw=getWardRaw(w);return(<div key={w} style={{marginBottom:22}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
              <div style={{width:34,height:34,borderRadius:9,background:WARDS[w].color+"16",border:`2px solid ${WARDS[w].color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{WARDS[w].icon}</div>
              <div><div style={{fontSize:14,fontWeight:700,color:T.text}}>{WARDS[w].label}</div><div style={{fontSize:10,color:T.textT,fontFamily:T.mono}}>{PARAM_GROUPS[group].label} · {cfg?.label}</div></div>
              <div style={{marginLeft:"auto",display:"flex",gap:7}}>
                <button className="pbtn" onClick={()=>loadDemo(w)} style={{...BP,padding:"5px 12px",fontSize:11}}>▶ Demo</button>
                {raw&&<button className="sbtn" onClick={()=>setTab("data")} style={{...BS,padding:"5px 12px",fontSize:11}}>↑ Upload</button>}
              </div>
            </div>
            {!raw?<div style={{...CS,padding:22,textAlign:"center"}}><div style={{fontSize:13,color:T.textS,marginBottom:11}}>Belum ada data untuk {WARDS[w].label}</div><div style={{display:"flex",gap:7,justifyContent:"center"}}><button className="pbtn" onClick={()=>loadDemo(w)} style={BP}>▶ Load Demo</button><button className="sbtn" onClick={()=>setTab("data")} style={BS}>↑ Upload CSV</button></div></div>:
            <QCPanel data={raw} cfg={cfg} blockSize={blockSize} mult={mult} useAoN={useAoN} selMethods={selMethods} apiKey={apiKey} wardLabel={WARDS[w].label} paramLabel={cfg?.label}/>}
          </div>);})}
        </div>}

        {viewMode==="combined"&&<div>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Gabungan — {selWards.map(w=>WARDS[w].label).join(" + ")}</div>
            {selWards.filter(w=>!getWardRaw(w)).map(w=><button key={w} className="pbtn" onClick={()=>loadDemo(w)} style={{...BP,padding:"4px 11px",fontSize:10}}>{WARDS[w].icon} Demo {WARDS[w].label}</button>)}
          </div>
          {!combinedRaw?<div style={{...CS,padding:28,textAlign:"center"}}><div style={{fontSize:13,color:T.textS,marginBottom:12}}>Load data untuk setiap ruangan yang dipilih.</div><div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>{selWards.map(w=><button key={w} className="pbtn" onClick={()=>loadDemo(w)} style={{...BP,padding:"6px 13px",fontSize:11}}>{WARDS[w].icon} {WARDS[w].label}</button>)}</div></div>:
          <QCPanel data={combinedRaw} cfg={cfg} blockSize={blockSize} mult={mult} useAoN={useAoN} selMethods={selMethods} apiKey={apiKey} wardLabel="Gabungan" paramLabel={cfg?.label}/>}
        </div>}

        {viewMode==="compare"&&<div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Perbandingan Ruangan — {cfg?.label}</div>
            <div style={{display:"flex",gap:6}}>{selWards.map(w=><button key={w} className="pbtn" onClick={()=>loadDemo(w)} style={{...BP,padding:"4px 11px",fontSize:10}}>{WARDS[w].icon} Demo</button>)}</div>
          </div>
          <WardComparisonChart wardData={allWardStats} paramLabel={cfg?.label} unit={cfg?.unit}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:16}}>
            {selWards.map(w=>{const raw=getWardRaw(w);const s=allWardStats[w]?.stats;
              if(!raw)return(<div key={w} style={{...CS,padding:18,textAlign:"center"}}><div style={{fontSize:22,marginBottom:5}}>{WARDS[w].icon}</div><div style={{fontSize:12,fontWeight:600,color:WARDS[w].color,marginBottom:8}}>{WARDS[w].label}</div><button className="pbtn" onClick={()=>loadDemo(w)} style={{...BP,padding:"5px 13px",fontSize:11}}>▶ Load Demo</button></div>);
              return(<div key={w} style={{...CS,padding:16,borderTop:`3px solid ${WARDS[w].color}`}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}><span style={{fontSize:18}}>{WARDS[w].icon}</span><div style={{fontSize:13,fontWeight:700,color:WARDS[w].color}}>{WARDS[w].label}</div><div style={{marginLeft:"auto",fontSize:10,fontFamily:T.mono,color:T.textT}}>n={s?.n}</div></div>
              {s&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>{[["Mean",s.mean.toFixed(2),T.blue],["CV%",s.cv.toFixed(2)+"%",s.cv>10?T.danger:T.warn],["Median",s.median.toFixed(2),T.purple]].map(([l,v,c])=><div key={l} style={{background:T.surfB,borderRadius:7,padding:"7px 9px",textAlign:"center"}}><div style={{fontSize:9,color:T.textT,fontFamily:T.mono,marginBottom:2,letterSpacing:1}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div></div>)}</div>}</div>);
            })}
          </div>
        </div>}
      </div>}

      {/* AI TAB */}
      {tab==="ai"&&<div className="fi">
        <div style={{marginBottom:16}}><div style={{fontSize:18,fontWeight:700,color:T.text}}>✦ Fitur AI PasienQuC</div><div style={{fontSize:11,color:T.textS,marginTop:2,fontFamily:T.mono}}>LLaMA 3.3 70B via Groq · {cfg?.label} ({cfg?.unit})</div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
          <AIInterpret apiKey={apiKey} context={aiCtxGlobal} paramLabel={cfg?.label} ward={selWards.map(w=>WARDS[w].label).join(", ")}/>
          <Chatbot apiKey={apiKey} context={aiCtxGlobal}/>
        </div>
        <NarrativeReport apiKey={apiKey} context={aiCtxGlobal} paramLabel={cfg?.label} ward={selWards.map(w=>WARDS[w].label).join(", ")}/>
      </div>}

      {/* DATA TAB */}
      {tab==="data"&&<div className="fi">
        <div style={{...CS,padding:20,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Upload / Input Data</div>
          <div style={{marginBottom:12}}><div style={LS}>Pilih Ruangan Target</div><WardSelector selected={[currentWard]} onChange={w=>setSelWards([w[0]])} multi={false}/></div>
          <div style={{display:"flex",gap:8,marginBottom:10}}><input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{display:"none"}}/><button className="pbtn" onClick={()=>fileRef.current.click()} style={BP}>↑ Pilih File CSV</button><button className="pbtn" onClick={()=>loadDemo(currentWard)} style={{...BP,background:T.ok}}>▶ Demo {WARDS[currentWard].icon} {WARDS[currentWard].label}</button></div>
          <div style={{fontSize:10,color:T.textT,marginBottom:8,fontFamily:T.mono}}>Format CSV dengan header nama parameter. Contoh: Hb, Na, PT, pH, CRP, dll.</div>
          <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={"Paste CSV...\nContoh:\nHb\n12.5\n13.2"} style={{width:"100%",height:120,background:T.surfB,border:`1.5px solid ${T.border}`,borderRadius:9,color:T.text,padding:12,fontSize:12,fontFamily:T.mono,resize:"vertical"}}/>
          <button className="pbtn" onClick={()=>handlePaste(currentWard)} style={{...BP,marginTop:9}}>▶ Proses → {WARDS[currentWard].label}</button>
        </div>
        <div style={{...CS,padding:18}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:12}}>Status Data — {cfg?.label}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
            {Object.entries(WARDS).map(([k,v])=>{const raw=getWardRaw(k);return(<div key={k} style={{background:raw?v.color+"0c":T.surfB,border:`1.5px solid ${raw?v.color+"44":T.border}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:17,marginBottom:4}}>{v.icon}</div>
              <div style={{fontSize:12,fontWeight:600,color:raw?v.color:T.textS}}>{v.label}</div>
              {raw?<><div style={{fontSize:13,fontWeight:700,color:T.text,marginTop:5,fontFamily:T.mono}}>{raw.length} <span style={{fontSize:10,color:T.textT}}>data</span></div><button className="sbtn" onClick={()=>setWardData(p=>{const n={...p};delete n[`${group}_${param}_${k}`];return n;})} style={{...BS,padding:"2px 8px",fontSize:10,marginTop:7,borderRadius:6,color:T.danger,borderColor:`${T.danger}44`}}>Hapus</button></>:<div style={{fontSize:11,color:T.textT,marginTop:5}}>Belum ada data</div>}
            </div>);})}
          </div>
        </div>
      </div>}

      {/* REPORT TAB */}
      {tab==="report"&&<div className="fi">
        <div style={{marginBottom:16}}><div style={{fontSize:18,fontWeight:700,color:T.text}}>Laporan QC</div><div style={{fontSize:11,color:T.textS,marginTop:2,fontFamily:T.mono}}>{cfg?.label} · {selWards.map(w=>WARDS[w].label).join(", ")}</div></div>
        <div style={{...CS,padding:20,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:12}}>Ringkasan Data</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
            {selWards.map(w=>{const raw=getWardRaw(w);if(!raw)return null;const m=avg(raw),s=std(raw),c=(s/m)*100;return(<div key={w} style={{background:T.surfB,borderRadius:9,padding:14,borderLeft:`3px solid ${WARDS[w].color}`}}>
              <div style={{fontSize:12,fontWeight:600,color:WARDS[w].color,marginBottom:7}}>{WARDS[w].icon} {WARDS[w].label}</div>
              <div style={{fontSize:11,fontFamily:T.mono,color:T.text,lineHeight:1.9}}>N: {raw.length}<br/>Mean: {m.toFixed(3)} {cfg?.unit}<br/>SD: {s.toFixed(3)}<br/>CV%: <span style={{color:c>10?T.danger:c>5?T.warn:T.ok,fontWeight:600}}>{c.toFixed(2)}%</span></div>
            </div>);})}
          </div>
          <button className="pbtn" onClick={()=>{const rows=["Ruangan,N,Mean,SD,CV%,Median"];selWards.forEach(w=>{const raw=getWardRaw(w);if(!raw)return;const m=avg(raw),s=std(raw);rows.push(`${WARDS[w].label},${raw.length},${m.toFixed(3)},${s.toFixed(3)},${((s/m)*100).toFixed(2)}%,${med(raw).toFixed(3)}`);});const blob=new Blob([rows.join("\n")],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`PasienQuC_${param}_summary.csv`;a.click();}} style={{...BP,marginTop:12}}>↓ Export Summary CSV</button>
        </div>
        <NarrativeReport apiKey={apiKey} context={aiCtxGlobal} paramLabel={cfg?.label} ward={selWards.map(w=>WARDS[w].label).join(", ")}/>
      </div>}
    </div>

    {/* FOOTER */}
    <div style={{borderTop:`1.5px solid ${T.border}`,background:T.surface,padding:"12px 26px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:22}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="11" height="11" viewBox="0 0 22 22" fill="none"><path d="M3 14 L7 9 L11 12 L15 5 L19 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg></div><span style={{fontSize:12,fontWeight:700,color:T.text}}>PasienQuC</span><span style={{fontSize:9,color:T.textT,fontFamily:T.mono,background:T.blueL,padding:"2px 6px",borderRadius:5}}>v.0.3.0</span></div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{fontSize:11,color:T.textS,fontFamily:T.mono}}>Aplikasi dibuat oleh <span style={{color:T.blue,fontWeight:600}}>dr. WIY</span></div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{fontSize:11,color:T.textT,fontFamily:T.mono}}>April 2026</div>
      <div style={{width:1,height:14,background:T.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.textT,fontFamily:T.mono}}><div style={{width:6,height:6,borderRadius:"50%",background:T.ok}}/>Groq · LLaMA 3.3 70B</div>
    </div>
  </div>);
}
