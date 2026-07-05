import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
let EXAM=null,Q=[],cur=0,ans=[],rev=[],sec=0,totalSec=0,timer=null,student="",phone="",eid="",code="",started=false,submitted=false;

function shuf(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function tick(){ const m=Math.floor(sec/60), s=sec%60; $("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"); }
function now(){ return new Date(); }

$("startBtn").addEventListener("click", async()=>{ try { $("startBtn").disabled=true;
  student=$("stName").value.trim(); phone=$("stPhone").value.trim(); eid=$("stExamId").value.trim().toUpperCase(); code=$("stCode").value.trim().toUpperCase();
  if(!student||!phone||!eid||!code) return alert("All fields required");
  const ex=await getDoc(doc(db,"exams",eid)); if(!ex.exists()) return alert("Invalid Exam ID"); EXAM=ex.data();
  if(EXAM.startTime && now()<new Date(EXAM.startTime)) return alert("Exam not started yet");
  if(EXAM.endTime && now()>new Date(EXAM.endTime)) return alert("Exam time is over");
  const cd=await getDoc(doc(db,"exams",eid,"codes",code)); if(!cd.exists()) return alert("Invalid code"); if(cd.data().used) return alert("Code already used");
  if(!EXAM.questions || !EXAM.questions.length) return alert("No questions found");
  Q=JSON.parse(JSON.stringify(EXAM.questions)).map((q,qi)=>({originalIndex:qi,q:q.q,subject:q.subject,o:q.o.map((x,i)=>({text:x,correct:i===q.a}))}));
  shuf(Q); Q.forEach(q=>shuf(q.o));
  ans=Array(Q.length).fill(null); rev=Array(Q.length).fill(false);
  const perQ=Number(EXAM.sec)||45; const normalSec=Q.length*perQ;
  const endLeft=EXAM.endTime ? Math.max(1, Math.floor((new Date(EXAM.endTime)-now())/1000)) : normalSec;
  sec=Math.min(normalSec,endLeft); totalSec=sec;
  $("examTitle").textContent=EXAM.title||eid; $("login").classList.add("hide"); $("exam").classList.remove("hide"); started=true; show(); tick();
  timer=setInterval(()=>{ sec--; tick(); if(sec<=0) submit(true); },1000);
  } catch(e) { alert("Start exam failed: "+e.message); } finally { $("startBtn").disabled=false; }
});

function show(){
  const q=Q[cur]; let h=`<div class="q">${q.q}</div>`;
  q.o.forEach((o,i)=>{ h+=`<label class="opt"><input type="radio" name="op" ${ans[cur]===i?"checked":""} onchange="window.selectOption(${i})"> ${String.fromCharCode(65+i)}) ${o.text}</label>`; });
  $("qcard").innerHTML=h; $("prog").textContent=`Question ${cur+1} of ${Q.length}`; palette();
}
window.selectOption=(i)=>{ ans[cur]=i; palette(); };
$("nextBtn").addEventListener("click",()=>{ if(cur<Q.length-1){ cur++; show(); } });
$("prevBtn").addEventListener("click",()=>{ if(cur>0){ cur--; show(); } });
$("markBtn").addEventListener("click",()=>{ rev[cur]=!rev[cur]; palette(); });
$("submitBtn").addEventListener("click",()=>submit(false));

function palette(){ let h=""; for(let i=0;i<Q.length;i++){ h+=`<div class="num ${ans[i]!==null?"ans ":""}${rev[i]?"rev ":""}${i===cur?"cur":""}" onclick="window.gotoQ(${i})">${i+1}</div>`; } $("palette").innerHTML=h; }
window.gotoQ=(i)=>{ cur=i; show(); };

async function submit(auto){
  if(submitted) return;
  if(!auto && !confirm("Submit exam?")) return;
  submitted=true;
  $("submitBtn").disabled=true; $("submitBtn").textContent="Submitting...";
  if(timer) clearInterval(timer);
  try{
    let correct=0,wrong=0,attempted=0; const details=[];
    Q.forEach((q,i)=>{ const selected=ans[i]!==null?q.o[ans[i]]:null; const corr=q.o.find(x=>x.correct); if(selected){ attempted++; if(selected.correct) correct++; else wrong++; } details.push({originalIndex:q.originalIndex,question:q.q,selectedText:selected?selected.text:"",correctText:corr?corr.text:"",isCorrect:!!(selected&&selected.correct)}); });
    const score=correct*(Number(EXAM.marks)||1), total=Q.length*(Number(EXAM.marks)||1), pct=Math.round((score/total)*10000)/100+"%";
    await setDoc(doc(db,"exams",eid,"attempts",code),{name:student,phone,code,score,total,pct,correct,wrong,attempted,timeTakenSec:totalSec-sec,answerDetails:details,submittedAt:serverTimestamp()});
    await setDoc(doc(db,"exams",eid,"codes",code),{used:true,studentName:student,phone,usedAt:serverTimestamp()},{merge:true});
    $("exam").classList.add("hide"); $("result").classList.remove("hide"); $("result").innerHTML=`<h2>Submitted Successfully</h2><p>Score: <b>${score}/${total}</b></p><p>Percentage: <b>${pct}</b></p>`;
  }catch(e){
    submitted=false; $("submitBtn").disabled=false; $("submitBtn").textContent="Submit"; alert("Submit failed: "+e.message);
  }
}


$("hallBtn").addEventListener("click", async()=>{
  const name = $("stName").value.trim() || "Student";
  const ph = $("stPhone").value.trim() || "-";
  const exId = $("stExamId").value.trim().toUpperCase() || "-";
  const exCode = $("stCode").value.trim().toUpperCase() || "-";
  let examTitle = "-";
  let startText = "-";
  let endText = "-";
  let durationText = "-";
  try {
    if (exId !== "-") {
      const exSnap = await getDoc(doc(db,"exams",exId));
      if (exSnap.exists()) {
        const e = exSnap.data();
        examTitle = e.title || exId;
        if (e.startTime) startText = new Date(e.startTime).toLocaleString();
        if (e.endTime) endText = new Date(e.endTime).toLocaleString();
        if (e.startTime && e.endTime) {
          const mins = Math.max(0, Math.round((new Date(e.endTime)-new Date(e.startTime))/60000));
          durationText = mins + " minutes";
        } else if (e.sec && e.questions) {
          durationText = Math.round((Number(e.sec) * (e.questions.length || 0))/60) + " minutes";
        }
      }
    }
  } catch(e) {}
  const ht = "KSR-" + exId + "-" + (ph.replace(/\D/g,"").slice(-4) || "0000") + "-" + Date.now().toString().slice(-5);
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>Hall Ticket</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{font-family:Arial,sans-serif;background:#eef2f7;margin:0;padding:16px;color:#111}
  .hall-card{max-width:760px;margin:20px auto;background:#fff;border:2px solid #0b57d0;border-radius:18px;overflow:hidden}
  .hall-head{background:linear-gradient(135deg,#0b57d0,#071a3d);color:#fff;padding:22px;text-align:center}
  .hall-head h1{margin:0;font-size:28px}.hall-head p{margin:8px 0 0;font-size:16px}
  .hall-body{padding:22px}.hall-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .hall-box{border:1px solid #d1d5db;border-radius:12px;padding:12px;background:#f8fafc}
  .hall-label{font-size:12px;color:#555;font-weight:900;text-transform:uppercase}.hall-value{font-size:18px;font-weight:900;margin-top:5px}
  .hall-inst{margin-top:18px;padding:14px;border-left:6px solid #fbbc04;background:#fff8db;border-radius:12px;line-height:1.6}
  .hall-actions{text-align:center;margin:20px}.btn{border:0;border-radius:12px;padding:12px 18px;font-weight:900;background:#0b57d0;color:#fff}
  .hall-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:22px;border-top:1px dashed #aaa;padding-top:18px}
  @media print{body{background:white}.hall-actions{display:none}.hall-card{box-shadow:none;border-radius:0;margin:0;max-width:100%}}
  @media(max-width:700px){.hall-grid{grid-template-columns:1fr}.hall-head h1{font-size:24px}}
  </style></head><body>
  <div class="hall-card">
    <div class="hall-head"><h1>KSR Online Exam Platform</h1><p>Professional Hall Ticket</p></div>
    <div class="hall-body">
      <div class="hall-grid">
        <div class="hall-box"><div class="hall-label">Hall Ticket No</div><div class="hall-value">${ht}</div></div>
        <div class="hall-box"><div class="hall-label">Student Name</div><div class="hall-value">${name}</div></div>
        <div class="hall-box"><div class="hall-label">Phone</div><div class="hall-value">${ph}</div></div>
        <div class="hall-box"><div class="hall-label">Exam Title</div><div class="hall-value">${examTitle}</div></div>
        <div class="hall-box"><div class="hall-label">Exam ID</div><div class="hall-value">${exId}</div></div>
        <div class="hall-box"><div class="hall-label">Exam Code</div><div class="hall-value">${exCode}</div></div>
        <div class="hall-box"><div class="hall-label">Start Time</div><div class="hall-value">${startText}</div></div>
        <div class="hall-box"><div class="hall-label">End Time</div><div class="hall-value">${endText}</div></div>
        <div class="hall-box"><div class="hall-label">Duration</div><div class="hall-value">${durationText}</div></div>
        <div class="hall-box"><div class="hall-label">Status</div><div class="hall-value">Eligible</div></div>
      </div>
      <div class="hall-inst"><b>Instructions:</b><br>1. Exam ID and Exam Code must be entered exactly as shown.<br>2. Do not refresh or close the browser during exam.<br>3. Submit before time ends. Auto submit will happen at end time.</div>
      <div class="hall-foot"><div>Student Signature</div><div>Invigilator Signature</div></div>
    </div>
  </div>
  <div class="hall-actions"><button class="btn" onclick="window.print()">Print / Save PDF</button></div>
  </body></html>`);
  w.document.close();
});

window.addEventListener("beforeunload",(e)=>{ if(started&&!submitted){ e.preventDefault(); e.returnValue="Exam running"; } });
