
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.querySelector("#status-form");
  const result=document.querySelector("[data-result]");
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(form).entries());
    const app=PPStore.findByProtocol(d.protocol);
    const error=form.querySelector(".error");error.textContent="";
    if(!app || String(app.passport)!==String(d.passport).trim()){
      result.classList.add("hidden");error.textContent="Protocolo ou passaporte inválido.";return;
    }
    result.querySelector("[data-name]").textContent=app.characterName;
    result.querySelector("[data-status]").textContent=app.status;
    result.querySelector("[data-status]").className="status-pill "+(app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":"");
    result.querySelector("[data-protocol]").textContent=app.protocol;
    result.querySelector("[data-passport]").textContent=app.passport;
    result.querySelector("[data-created]").textContent=ppFormatDate(app.createdAt);
    result.querySelector("[data-updated]").textContent=ppFormatDate(app.updatedAt);
    result.querySelector("[data-note]").textContent=app.publicNote;
    result.querySelector("[data-timeline]").innerHTML=app.timeline.map(i=>`<div class="status-item"><strong>${ppEscape(i.status)}</strong><span>${ppFormatDate(i.date)}</span></div>`).join("");
    result.classList.remove("hidden");
    PPStore.setCandidateSession(app.id);
  });
});
