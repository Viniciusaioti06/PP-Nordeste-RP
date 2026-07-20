
document.addEventListener("DOMContentLoaded",()=>{
  const id=PPStore.candidateSession();
  const app=PPStore.applications().find(a=>a.id===id);
  if(!app){window.location.href="../status.html";return;}
  document.querySelector("[data-greeting]").textContent=`Olá, ${app.characterName}.`;
  document.querySelector("[data-status]").textContent=app.status;
  document.querySelector("[data-protocol]").textContent=app.protocol;
  document.querySelector("[data-passport]").textContent=app.passport;
  document.querySelector("[data-discord]").textContent=app.discord;
  document.querySelector("[data-created]").textContent=ppFormatDate(app.createdAt);
  document.querySelector("[data-note]").textContent=app.publicNote;
  const steps=["Inscrição enviada","Triagem automática","Em análise","Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Curso de formação","Formatura"];
  const completed=new Set(app.timeline.map(t=>t.status));
  document.querySelector("[data-candidate-timeline]").innerHTML=steps.map((step,i)=>{
    const active=completed.has(step)||app.status===step||(step==="Em análise"&&app.status==="Em análise");
    return `<div class="status-item"><strong>${active?"✓":"○"} ${step}</strong><span>${active?"Etapa registrada":"Aguardando"}</span></div>`;
  }).join("");

  const theoreticalApproved=["Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Curso de formação","Formatura"].includes(app.status);
  document.querySelector("[data-theoretical-message]").classList.toggle("hidden",!theoreticalApproved);

  const announcements=[
    ...PPStore.announcementsForStatus(app.status),
    ...PPStore.announcementsForStatus("Todos")
  ];
  const announcementBox=document.querySelector("[data-announcements]");
  announcementBox.classList.toggle("hidden",announcements.length===0);
  document.querySelector("[data-announcement-items]").innerHTML=announcements.map(item=>`
    <article class="announcement-card">
      <h3>${ppEscape(item.title)}</h3>
      <p>${ppEscape(item.message)}</p>
      <small>${ppFormatDate(item.createdAt)} · ${ppEscape(item.createdBy)}</small>
    </article>`).join("");
});
