
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.querySelector("#status-form");
  const result=document.querySelector("[data-result]");
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const d=Object.fromEntries(new FormData(form).entries());
    const error=form.querySelector(".error");error.textContent="";
    try{
      const app=await PPStore.findByProtocol(d.protocol,d.passport);
      if(!app){result.classList.add("hidden");error.textContent="Protocolo ou passaporte inválido.";return}
      result.querySelector("[data-name]").textContent=app.characterName;
      const status=result.querySelector("[data-status]");
      status.textContent=app.status;
      status.className="status-pill "+(app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":"");
      result.querySelector("[data-protocol]").textContent=app.protocol;
      result.querySelector("[data-passport]").textContent=app.passport;
      result.querySelector("[data-created]").textContent=ppFormatDate(app.createdAt);
      result.querySelector("[data-updated]").textContent=ppFormatDate(app.updatedAt);
      result.querySelector("[data-note]").textContent=app.publicNote;
      result.querySelector("[data-timeline]").innerHTML=(app.timeline||[]).map(i=>`<div class="status-item"><strong>${ppEscape(i.status)}</strong><span>${ppFormatDate(i.date)}</span></div>`).join("");
      sessionStorage.setItem("pp_candidate_lookup",JSON.stringify(app));
      result.classList.remove("hidden");
    }catch(err){error.textContent=err.message}
  });
});
