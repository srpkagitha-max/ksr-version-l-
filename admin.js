import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
let currentQuestions = [], currentExamId = "", resultsCache = [];

function msg(t,b=false){ $("loginMsg").innerHTML = b ? `<span class="bad">${t}</span>` : `<span class="ok">${t}</span>`; }
function safe(v){ return String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,""); }
function isoLocalValue(v){ if(!v) return ""; try { return new Date(v).toISOString(); } catch(e){ return ""; } }
function csvDownload(text,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"})); a.download=name; a.click(); }

$("loginBtn").addEventListener("click", async()=>{ try{ msg("Logging in..."); await signInWithEmailAndPassword(auth,$("email").value.trim(),$("pass").value); msg("Login success"); } catch(e){ msg(e.message,true); alert(e.message); }});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,(u)=>{ $("loginCard").classList.toggle("hide",!!u); $("app").classList.toggle("hide",!u); });

document.querySelectorAll(".sidebtn").forEach((b)=>b.addEventListener("click",()=>{ document.querySelectorAll(".sidebtn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); document.querySelectorAll(".view").forEach(v=>v.classList.add("hide")); $("view-"+b.dataset.view).classList.remove("hide"); }));
$("darkBtn").addEventListener("click",()=>document.body.classList.toggle("dark"));

$("saveInstituteBtn").addEventListener("click", async()=>{ const id=safe($("instId").value); if(!id || !$("instName").value.trim()) return alert("Institute ID + Name required"); const data={name:$("instName").value.trim(),adminEmail:$("instEmail").value.trim(),contact:$("instContact").value.trim(),plan:$("instPlan").value,status:$("instStatus").value,themeColor:$("instTheme").value,updatedAt:serverTimestamp(),version:"L1"}; await setDoc(doc(db,"institutes",id),data,{merge:true}); if(data.adminEmail){ await setDoc(doc(db,"instituteAdmins",data.adminEmail),{email:data.adminEmail,instituteId:id,instituteName:data.name,status:data.status},{merge:true}); } alert("Institute saved"); loadInstitutes(); });
async function loadInstitutes(){ const s=await getDocs(collection(db,"institutes")); let h=""; s.forEach(d=>{ const x=d.data(); h+=`<div class="inst-card"><b>${x.name||""}</b> <span class="pill">${d.id}</span><br>${x.status||""} | ${x.plan||""}<br><button class="s" onclick="window.useInstitute('${d.id}')">Use</button></div>`; }); $("institutesBox").innerHTML=h||"No institutes"; }
$("loadInstitutesBtn").addEventListener("click",loadInstitutes);
window.useInstitute = async(id)=>{ const d=await getDoc(doc(db,"institutes",id)); if(!d.exists()) return; const x=d.data(); $("examInstituteId").value=id; $("instId").value=id; $("instName").value=x.name||""; $("instEmail").value=x.adminEmail||""; $("instContact").value=x.contact||""; $("instPlan").value=x.plan||"Free"; $("instStatus").value=x.status||"Active"; $("instTheme").value=x.themeColor||"#0b57d0"; };

function optLine(line){ const m=line.match(/^([A-Da-d])[\.)]\s*(.*)$/); return m ? {idx:"ABCD".indexOf(m[1].toUpperCase()), txt:m[2]} : null; }
function parseBits(raw){ const qs=[]; let cur=null, subject="General"; function flush(){ if(cur && cur.o.length===4){ if(cur.a===null) cur.a=0; qs.push(cur); } cur=null; } raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{ if(line.startsWith("*") && line.endsWith("*")){ subject=line.replace(/\*/g,""); return; } const o=optLine(line); if(o && cur){ if(/[●⚫•*]/.test(o.txt)) cur.a=o.idx; cur.o.push(o.txt.replace(/[●⚫•*]/g,"").trim()); return; } if(/^\d+[\.)]/.test(line)){ flush(); cur={subject,q:line.replace(/^\d+[\.)]\s*/,""),o:[],a:null}; return; } if(cur) cur.q += "\n"+line; }); flush(); return qs; }
function genCodes(n,p="KSR"){ const a=[]; while(a.length<n){ const c=p+Math.floor(100000+Math.random()*900000); if(!a.includes(c)) a.push(c); } return a; }

$("saveExamBtn").addEventListener("click", async()=>{ const id=safe($("examId").value); let qs=parseBits($("bits").value); const old=await getDoc(doc(db,"exams",id)); if(!qs.length && old.exists()) qs=old.data().questions||[]; if(!id || !qs.length) return alert("Exam ID + questions required"); const startIso=isoLocalValue($("startTime").value); const endIso=isoLocalValue($("endTime").value); if(startIso && endIso && new Date(startIso)>=new Date(endIso)) return alert("End Time must be after Start Time"); await setDoc(doc(db,"exams",id),{title:$("examTitle").value||id,questions:qs,instituteId:safe($("examInstituteId").value),branding:{instituteName:$("instName").value||"KSR",examCategory:$("examCategory").value,themeColor:$("instTheme").value},startTime:startIso,endTime:endIso,passMark:Number($("passMark").value)||35,sec:Number($("sec").value)||45,marks:Number($("marks").value)||1,showResult:true,updatedAt:serverTimestamp(),version:"L1-TIME-SUBMIT-FIX"},{merge:true}); const codes=genCodes(Number($("count").value)||50); for(const c of codes){ await setDoc(doc(db,"exams",id,"codes",c),{code:c,used:false,active:true,createdAt:serverTimestamp()}); } $("codesBox").textContent=codes.join("\n"); alert("Exam saved"); });

async function loadExams(){ const s=await getDocs(collection(db,"exams")); let h=""; s.forEach(d=>{ const e=d.data(); h+=`<div class="exam-card"><b>${d.id}</b> ${e.title||""}<br>Start: ${e.startTime||"-"}<br>End: ${e.endTime||"-"}<br>Qs: ${(e.questions||[]).length}<br><button class="s" onclick="window.editQuestions('${d.id}')">Questions</button><button class="g" onclick="window.openResults('${d.id}')">Results</button></div>`; }); $("examsBox").innerHTML=h||"No exams"; }
$("loadExamsBtn").addEventListener("click",loadExams);

window.editQuestions=(id)=>{ $("qeExamId").value=id; document.querySelector('[data-view="questions"]').click(); loadQuestions(); };
$("loadQuestionsBtn").addEventListener("click",loadQuestions);
async function loadQuestions(){ currentExamId=safe($("qeExamId").value); const d=await getDoc(doc(db,"exams",currentExamId)); if(!d.exists()) return alert("Exam not found"); currentQuestions=JSON.parse(JSON.stringify(d.data().questions||[])); renderQuestions(); }
function esc(v){ return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
function renderQuestions(){ let h=`<button class="p" onclick="window.addQuestion()">Add Question</button><button class="g" onclick="window.saveQuestions()">Save All</button>`; currentQuestions.forEach((q,i)=>{ const o=q.o||["","","",""]; h+=`<div class="exam-card"><b>Q${i+1}</b><label>Question</label><textarea id="q_${i}">${esc(q.q)}</textarea><div class="grid"><input id="o_${i}_0" value="${esc(o[0])}"><input id="o_${i}_1" value="${esc(o[1])}"></div><div class="grid"><input id="o_${i}_2" value="${esc(o[2])}"><input id="o_${i}_3" value="${esc(o[3])}"></div><label>Correct Answer</label><select id="a_${i}"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select><button class="d" onclick="window.deleteQuestion(${i})">Delete</button></div>`; }); $("questionsBox").innerHTML=h; currentQuestions.forEach((q,i)=>{$("a_"+i).value=q.a||0;}); }
function syncQuestions(){ currentQuestions=currentQuestions.map((q,i)=>({subject:q.subject||"General",q:$("q_"+i).value,o:[$("o_"+i+"_0").value,$("o_"+i+"_1").value,$("o_"+i+"_2").value,$("o_"+i+"_3").value],a:Number($("a_"+i).value)})); }
window.addQuestion=()=>{ try{ syncQuestions(); }catch(e){} currentQuestions.push({subject:"General",q:"New question?",o:["A","B","C","D"],a:0}); renderQuestions(); };
window.deleteQuestion=(i)=>{ currentQuestions.splice(i,1); renderQuestions(); };
window.saveQuestions=async()=>{ syncQuestions(); await setDoc(doc(db,"exams",currentExamId),{questions:currentQuestions,updatedAt:serverTimestamp()},{merge:true}); alert("Questions saved"); };

async function loadStudents(){ const s=await getDocs(collection(db,"students")); let h="<table><tr><th>Name</th><th>Phone</th><th>Course</th></tr>"; s.forEach(d=>{ const x=d.data(); h+=`<tr><td>${x.name||""}</td><td>${x.phone||d.id}</td><td>${x.course||""}</td></tr>`; }); $("studentsBox").innerHTML=h+"</table>"; }
$("loadStudentsBtn").addEventListener("click",loadStudents);
$("exportStudentsBtn").addEventListener("click", async()=>{ const s=await getDocs(collection(db,"students")); const rows=["Name,Phone,Course"]; s.forEach(d=>{ const x=d.data(); rows.push(`"${x.name||""}","${x.phone||d.id}","${x.course||""}"`); }); csvDownload(rows.join("\n"),"students.csv"); });

async function loadResults(id){ if(!id) return alert("Enter Exam ID"); const s=await getDocs(collection(db,"exams",id,"attempts")); resultsCache=[]; s.forEach(d=>resultsCache.push(d.data())); let h="<table><tr><th>Name</th><th>Phone</th><th>Score</th><th>%</th></tr>"; resultsCache.forEach(r=>{ h+=`<tr><td>${r.name||""}</td><td>${r.phone||""}</td><td>${r.score||0}/${r.total||0}</td><td>${r.pct||""}</td></tr>`; }); $("resultsBox").innerHTML=h+"</table>"; }
$("loadResultsBtn").addEventListener("click",()=>loadResults(safe($("reportExamId").value)));
window.openResults=(id)=>{ document.querySelector('[data-view="reports"]').click(); $("reportExamId").value=id; loadResults(id); };
$("exportResultsBtn").addEventListener("click",()=>{ const rows=["Name,Phone,Code,Score,Total,Percent"]; resultsCache.forEach(r=>rows.push(`"${r.name||""}","${r.phone||""}","${r.code||""}",${r.score||0},${r.total||0},"${r.pct||""}"`)); csvDownload(rows.join("\n"),"results.csv"); });

$("loadStatsBtn").addEventListener("click", async()=>{ const ex=await getDocs(collection(db,"exams")); const st=await getDocs(collection(db,"students")); let attempts=0, qs=0; for(const d of ex.docs){ qs+=(d.data().questions||[]).length; const a=await getDocs(collection(db,"exams",d.id,"attempts")); attempts+=a.size; } $("statsBox").innerHTML=`<div class="stat"><div class="label">Students</div><div class="value">${st.size}</div></div><div class="stat"><div class="label">Exams</div><div class="value">${ex.size}</div></div><div class="stat"><div class="label">Questions</div><div class="value">${qs}</div></div><div class="stat"><div class="label">Attempts</div><div class="value">${attempts}</div></div>`; });
