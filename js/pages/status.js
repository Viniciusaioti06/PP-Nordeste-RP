
document.addEventListener("DOMContentLoaded", () => {
  const form=document.querySelector("#status-form");
  const result=document.querySelector("[data-result]");
  const approvalModal=document.querySelector("[data-approval-modal]");

  document.querySelectorAll("[data-approval-close]").forEach(button=>{
    button.addEventListener("click",()=>approvalModal?.close());
  });

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(form).entries());
    const error=form.querySelector(".error");
    error.textContent="";

    try{
      const app=await ApplicationsService.lookup(values.protocol,values.passport);

      if(!app){
        result.classList.add("hidden");
        error.textContent="Protocolo ou passaporte inválido.";
        return;
      }

      result.querySelector("[data-name]").textContent=app.character_name;
      const badge=result.querySelector("[data-status]");
      badge.textContent=app.status;
      badge.className=`status-pill ${app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":""}`;

      result.querySelector("[data-protocol]").textContent=app.protocol;
      result.querySelector("[data-passport]").textContent=app.passport;
      result.querySelector("[data-created]").textContent=formatDate(app.created_at);
      result.querySelector("[data-updated]").textContent=formatDate(app.updated_at);
      result.querySelector("[data-note]").textContent=app.public_note;
      result.querySelector("[data-timeline]").innerHTML=(app.timeline||[])
        .map(item=>`<div class="status-item"><strong>${escapeHTML(item.status)}</strong><span>${formatDate(item.date)}</span></div>`)
        .join("");

      sessionStorage.setItem("candidate_application",JSON.stringify(app));
      result.classList.remove("hidden");
      result.scrollIntoView({behavior:"smooth",block:"start"});

      const approvedStatuses=[
        "Aprovado no teste teórico",
        "Aguardando teste físico",
        "Aprovado no teste físico",
        "Curso de formação",
        "Formatura"
      ];

      if(approvedStatuses.includes(app.status)&&approvalModal){
        approvalModal.querySelector("[data-approval-name]").textContent=
          app.character_name.split(" ")[0]||"candidato";
        window.setTimeout(()=>approvalModal.showModal(),420);
      }
    }catch(err){
      error.textContent=err.message;
    }
  });
});
