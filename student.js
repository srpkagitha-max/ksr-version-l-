import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
let EXAM=null,Q=[],cur=0,ans=[],rev=[],sec=0,totalSec=0,timer=null,student="",phone="",eid="",code="",started=false,submitted=false;

function shuf(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function tick(){ const m=Math.floor(sec/60), s=sec%60; $("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0"); }
function now(){ return new Date(); }

$("startBtn").addEventListener("click", async()=>{
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

$("hallBtn").addEventListener("click",()=>{ const w=window.open("","_blank"); w.document.write(`<html><body style="font-family:Arial;text-align:center"><h1>Hall Ticket</h1><p>Name: ${$("stName").value}</p><p>Phone: ${$("stPhone").value}</p><p>Exam ID: ${$("stExamId").value}</p><p>Code: ${$("stCode").value}</p><button onclick="window.print()">Print</button></body></html>`); w.document.close(); });
window.addEventListener("beforeunload",(e)=>{ if(started&&!submitted){ e.preventDefault(); e.returnValue="Exam running"; } });
