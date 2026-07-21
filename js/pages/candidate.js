
document.addEventListener("DOMContentLoaded",async()=>{
  const app=JSON.parse(sessionStorage.getItem("candidate_application")||"null");
  if(!app){location.href="../status.html";return}
  document.querySelector("[data-greeting]").textContent=`Olá, ${app.character_name}.`;
  document.querySelector("[data-status]").textContent=app.status;
  document.querySelector("[data-protocol]").textContent=app.protocol;
  document.querySelector("[data-passport]").textContent=app.passport;
  document.querySelector("[data-discord]").textContent=app.discord;
  document.querySelector("[data-created]").textContent=formatDate(app.created_at);
  document.querySelector("[data-note]").textContent=app.public_note;
  const steps=["Inscrição enviada","Triagem automática","Em análise","Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Curso de formação","Formatura"];
  const completed=new Set((app.timeline||[]).map(item=>item.status));
  document.querySelector("[data-candidate-timeline]").innerHTML=steps.map(step=>`<div class="status-item"><strong>${completed.has(step)||app.status===step?"✓":"○"} ${step}</strong></div>`).join("");
  const approved=["Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Curso de formação","Formatura"].includes(app.status);
  document.querySelector("[data-theoretical-message]").classList.toggle("hidden",!approved);
  try{
    const announcements=await AnnouncementsService.publicFor(app.status);
    const box=document.querySelector("[data-announcements]");
    box.classList.toggle("hidden",!announcements.length);
    document.querySelector("[data-announcement-items]").innerHTML=announcements.map(item=>`<article class="announcement-card"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.message)}</p><small>${formatDate(item.created_at)}</small></article>`).join("");
  }catch{}
});
