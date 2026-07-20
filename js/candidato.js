
document.addEventListener("DOMContentLoaded",async()=>{
  let app;
  try{app=JSON.parse(sessionStorage.getItem("pp_candidate_lookup")||"null")}catch{}
  if(!app){location.href="../status.html";return}
  document.querySelector("[data-greeting]").textContent=`Olá, ${app.characterName}.`;
  document.querySelector("[data-status]").textContent=app.status;
  document.querySelector("[data-protocol]").textContent=app.protocol;
  document.querySelector("[data-passport]").textContent=app.passport;
  document.querySelector("[data-discord]").textContent=app.discord;
  document.querySelector("[data-created]").textContent=ppFormatDate(app.createdAt);
  document.querySelector("[data-note]").textContent=app.publicNote;
  const steps=["Inscrição enviada","Triagem automática","Em análise","Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Curso de formação","Formatura"];
  const completed=new Set((app.timeline||[]).map(t=>t.status));
  document.querySelector("[data-candidate-timeline]").innerHTML=steps.map(step=>{
    const active=completed.has(step)||app.status===step;
    return `<div class="status-item"><strong>${active?"✓":"○"} ${step}</strong><span>${active?"Etapa registrada":"Aguardando"}</span></div>`;
  }).join("");
  const approved=["Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Curso de formação","Formatura"].includes(app.status);
  document.querySelector("[data-theoretical-message]").classList.toggle("hidden",!approved);
  try{
    const {data,error}=await supabaseClient.rpc("public_announcements_for_status",{p_status:app.status});
    if(error)throw error;
    const box=document.querySelector("[data-announcements]");
    box.classList.toggle("hidden",!data?.length);
    document.querySelector("[data-announcement-items]").innerHTML=(data||[]).map(item=>`
      <article class="announcement-card"><h3>${ppEscape(item.title)}</h3><p>${ppEscape(item.message)}</p><small>${ppFormatDate(item.created_at)}</small></article>`).join("");
  }catch{}
});
