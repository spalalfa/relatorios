// ====== CONFIGURAÇÃO ======
// Depois de criar o projeto no Supabase, cole aqui a URL e a chave anon.
// Se deixar vazio, o sistema funciona em modo DEMO usando localStorage.
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const sb = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) ? supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY) : null;

let records = JSON.parse(localStorage.getItem("spal_ecolab_records") || "[]");
let pendingImport = [];
let editingId = null;

const demo = [
 {id:"demo-1",data:"17/09/2026",cte:"10/13152815",nf:"867137",cliente:"ECOLAB",volume:"08",acr:"6545516",senha:"",status:"GERADA"},
 {id:"demo-2",data:"17/09/2026",cte:"11/8025995",nf:"398570",cliente:"ELETRO NACIONAL",volume:"1",acr:"6542737",senha:"",status:"GERADA"},
 {id:"demo-3",data:"17/09/2026",cte:"263/13153216",nf:"578090",cliente:"ECOLAB",volume:"2",acr:"6546099",senha:"",status:"GERADA"},
 {id:"demo-4",data:"17/09/2026",cte:"263/13152967",nf:"777621",cliente:"KLUBER",volume:"1",acr:"6545691",senha:"",status:"GERADA"},
 {id:"demo-5",data:"09/09/2026",cte:"10/13104576",nf:"865440",cliente:"ECOLAB",volume:"2",acr:"6467316",senha:"37742",status:"ABERTA"},
 {id:"demo-6",data:"09/09/2026",cte:"263/13106595",nf:"573683",cliente:"ECOLAB",volume:"1",acr:"6470384",senha:"37742",status:"ABERTA"},
 {id:"demo-7",data:"09/09/2026",cte:"263/13115582",nf:"8425",cliente:"PROFILTRO",volume:"1",acr:"6485136",senha:"37742",status:"ABERTA"},
 {id:"demo-8",data:"09/09/2026",cte:"263/13115583",nf:"8426",cliente:"PROFILTRO",volume:"1",acr:"6485137",senha:"37742",status:"ABERTA"},
 {id:"demo-9",data:"09/09/2026",cte:"52/13120478",nf:"15975",cliente:"MOVEX",volume:"1",acr:"6493342",senha:"37742",status:"ABERTA"}
];
if(!records.length){records=demo; persistLocal();}

async function loadRecords(){
 if(!sb){renderAll();return;}
 const {data,error}=await sb.from("processos").select("*").order("created_at",{ascending:false});
 if(error){console.error(error); alert("Supabase não respondeu. O sistema seguirá em modo local."); return;}
 records=data||[]; renderAll();
}
async function saveRecord(r){
 if(sb){
   const {error}=await sb.from("processos").upsert(r);
   if(error){console.error(error); alert("Erro ao salvar no Supabase."); return false;}
 } else { records.push(r); persistLocal(); }
 return true;
}
async function updateRecord(r){
 if(sb){
   const {error}=await sb.from("processos").update({senha:r.senha,status:r.status}).eq("id",r.id);
   if(error){alert("Erro ao atualizar.");return false;}
 } else { const i=records.findIndex(x=>x.id===r.id); if(i>=0)records[i]=r; persistLocal(); }
 return true;
}
function persistLocal(){localStorage.setItem("spal_ecolab_records",JSON.stringify(records));}
function norm(v){return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function badge(s){return `<span class="badge ${norm(s)}">${s}</span>`}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function renderAll(){renderKPIs();renderRecent();renderProcessos();renderEcolab();}
function renderKPIs(){
 const ecolab=records.filter(r=>norm(r.cliente)==="ecolab"), abertas=records.filter(r=>r.status==="ABERTA"), lib=records.filter(r=>r.status==="LIBERADA");
 ["kpiTotal","kpiEcolab","kpiAbertas","kpiLiberadas"].forEach((id,i)=>document.getElementById(id).textContent=[records.length,ecolab.length,abertas.length,lib.length][i]);
 document.getElementById("ecTotal").textContent=ecolab.length;
 document.getElementById("ecSenha").textContent=ecolab.filter(r=>r.senha).length;
 document.getElementById("ecAberta").textContent=ecolab.filter(r=>r.status==="ABERTA").length;
 document.getElementById("ecLib").textContent=ecolab.filter(r=>r.status==="LIBERADA").length;
}
function renderRecent(){
 document.getElementById("recentTable").innerHTML=records.slice(0,8).map(r=>`<tr><td>${esc(r.nf)}</td><td>${esc(r.cte)}</td><td>${esc(r.cliente)}</td><td>${esc(r.acr)}</td><td>${esc(r.senha)||"—"}</td><td>${badge(r.status)}</td></tr>`).join("")||emptyRow(6);
}
function matches(r,q){return !q||[r.cte,r.nf,r.acr,r.cliente,r.senha,r.data].some(x=>norm(x).includes(norm(q)))}
function renderProcessos(){
 const q=document.getElementById("processSearch")?.value||"", st=document.getElementById("statusFilter")?.value||"";
 const arr=records.filter(r=>matches(r,q)&&(!st||r.status===st));
 document.getElementById("processTable").innerHTML=arr.map(r=>`<tr><td>${esc(r.data)}</td><td>${esc(r.nf)}</td><td>${esc(r.cte)}</td><td>${esc(r.cliente)}</td><td>${esc(r.volume)}</td><td>${esc(r.acr)}</td><td>${esc(r.senha)||"—"}</td><td>${badge(r.status)}</td><td><button class="action" onclick="openModal('${r.id}')">Atualizar</button></td></tr>`).join("")||emptyRow(9);
}
function renderEcolab(){
 const q=document.getElementById("ecSearch")?.value||"";
 const arr=records.filter(r=>norm(r.cliente)==="ecolab"&&matches(r,q));
 document.getElementById("ecTable").innerHTML=arr.map(r=>`<tr><td>${esc(r.data)}</td><td>${esc(r.nf)}</td><td>${esc(r.cte)}</td><td>${esc(r.volume)}</td><td>${esc(r.acr)}</td><td>${esc(r.senha)||"—"}</td><td>${badge(r.status)}</td><td><button class="action" onclick="openModal('${r.id}')">Atualizar</button></td></tr>`).join("")||emptyRow(8);
}
function emptyRow(n){return `<tr><td colspan="${n}" style="text-align:center;color:#89949c;padding:25px">Nenhum registro encontrado.</td></tr>`}
function showView(name){
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 document.getElementById(name).classList.add("active");
 document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
 document.getElementById("pageTitle").textContent={dashboard:"Dashboard",processos:"Processos",ecolab:"ECOLAB",importar:"Importar Word"}[name];
 renderAll();
}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.getElementById("refreshBtn").onclick=loadRecords;
function searchAll(){const q=document.getElementById("globalSearch").value;document.getElementById("processSearch").value=q;showView("processos");}
document.getElementById("globalSearch").addEventListener("keydown",e=>{if(e.key==="Enter")searchAll()});

function openModal(id){
 const r=records.find(x=>x.id===id); if(!r)return; editingId=id;
 document.getElementById("modalDesc").textContent=`NF ${r.nf} • CT-e ${r.cte} • ${r.cliente} • ACR ${r.acr}`;
 document.getElementById("modalSenha").value=r.senha||"";
 document.getElementById("modalStatus").value=r.status||"GERADA";
 document.getElementById("modal").classList.remove("hidden");
}
function closeModal(){document.getElementById("modal").classList.add("hidden");editingId=null}
async function saveModal(){
 const r=records.find(x=>x.id===editingId);if(!r)return;
 r.senha=document.getElementById("modalSenha").value.trim();r.status=document.getElementById("modalStatus").value;
 if(await updateRecord(r)){closeModal();renderAll();}
}

document.getElementById("wordFile").addEventListener("change",e=>handleWord(e.target.files[0]));
const dz=document.getElementById("dropZone");
dz.addEventListener("dragover",e=>{e.preventDefault();dz.style.borderColor="#e31b23"});
dz.addEventListener("dragleave",()=>dz.style.borderColor="");
dz.addEventListener("drop",e=>{e.preventDefault();dz.style.borderColor="";handleWord(e.dataTransfer.files[0])});

async function handleWord(file){
 if(!file||!file.name.toLowerCase().endsWith(".docx"))return alert("Selecione um arquivo .docx.");
 const buf=await file.arrayBuffer();
 const result=await mammoth.convertToHtml({arrayBuffer:buf});
 const doc=new DOMParser().parseFromString(result.value,"text/html");
 const tables=[...doc.querySelectorAll("table")];
 if(!tables.length)return alert("Não encontrei uma tabela no Word.");
 let dataDate="",senha="";
 const txt=doc.body.innerText;
 const dm=txt.match(/DATA\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i); if(dm)dataDate=dm[1];
 const sm=txt.match(/SENHA\s*:\s*([0-9]+)/i); if(sm)senha=sm[1];
 let rows=[];
 tables.forEach(t=>[...t.rows].forEach(tr=>{
   const cells=[...tr.cells].map(c=>c.innerText.trim().replace(/\s+/g," "));
   if(cells.length>=5 && cells[0] && !/CTE/i.test(cells[0])) rows.push(cells);
 }));
 pendingImport=rows.filter(x=>x[0]&&x[1]).map(x=>({id:crypto.randomUUID(),data:dataDate,cte:x[0],nf:x[1],cliente:x[2]||"",volume:x[3]||"",acr:x[4]||"",senha:senha,status:senha?"ABERTA":"GERADA"}));
 const p=document.getElementById("importPreview");p.classList.remove("hidden");
 p.innerHTML=`<strong>${esc(file.name)}</strong><br>${pendingImport.length} registros encontrados • Data: ${esc(dataDate||"não identificada")} • Senha: ${esc(senha||"não informada")}<hr>`+pendingImport.map(r=>`${esc(r.nf)} • ${esc(r.cliente)} • ACR ${esc(r.acr)}`).join("<br>");
 document.getElementById("confirmImport").classList.remove("hidden");
}
document.getElementById("confirmImport").onclick=async()=>{
 let ok=0;
 for(const r of pendingImport){if(await saveRecord(r))ok++;}
 if(!sb){records=[...records,...pendingImport];persistLocal();} // saveRecord already persists; harmless de-dup is prevented below
 if(!sb){ // remove duplicate copies caused by local saveRecord + batch update
   const map=new Map(records.map(r=>[r.id,r])); records=[...map.values()];persistLocal();
 }
 pendingImport=[];document.getElementById("confirmImport").classList.add("hidden");document.getElementById("importPreview").classList.add("hidden");
 alert(`${ok} registro(s) importado(s).`);renderAll();showView("processos");
};

loadRecords();
