
document.addEventListener("DOMContentLoaded",async()=>{
  let profile;
  try{profile=await Auth.requireStaff("candidates_review")}catch(err){alert(err.message);location.href="dashboard.html";return}
  const id=new URLSearchParams(location.search).get("id");
  const apps=await ApplicationsService.list();
  let app=apps.find(item=>item.id===id);
  if(!app){document.querySelector("[data-page]").innerHTML='<div class="empty-state">Candidato não encontrado.</div>';return}
  document.querySelector("[data-name]").textContent=app.character_name;
  document.querySelector("[data-status]").textContent=app.status;
  document.querySelector("[data-protocol]").textContent=app.protocol;
  document.querySelector("[data-passport]").textContent=app.passport;
  document.querySelector("[data-discord]").textContent=app.discord;
  document.querySelector("[data-availability]").textContent=app.availability;
  document.querySelector("[data-experience]").textContent=app.experience||"Não informado";
  document.querySelector("[data-score]").textContent=`${app.automatic_score}/${app.maximum_automatic_score}`;
  document.querySelector("[data-created]").textContent=formatDate(app.created_at);
  document.querySelector("[data-answers]").innerHTML=Object.values(app.answers||{}).map(answer=>`<div class="answer-block"><span>${escapeHTML(answer.question)}</span><p>${escapeHTML(answer.optionLabel||answer.value||"Sem resposta")}</p></div>`).join("");
  document.querySelector("[data-notes]").value=app.reviewer_notes||"";

  const decide=async approved=>{
    const permission=approved?"candidates_approve":"candidates_reject";
    if(!profile.permissions?.[permission]){showToast("Sem permissão.");return}
    const status=approved?"Aprovado no teste teórico":"Reprovado no teste teórico";
    const timeline=[...(app.timeline||[]),{status,date:new Date().toISOString()}];
    app=await ApplicationsService.update(app.id,{
      status,
      reviewer_notes:document.querySelector("[data-notes]").value.trim(),
      physical_recruiter:approved?profile.display_name:app.physical_recruiter,
      public_note:approved?"Parabéns, você foi aprovado no teste teórico. Fique atento ao Discord para o teste físico coletivo.":"Sua inscrição não foi aprovada no teste teórico.",
      timeline
    });
    await AuditService.write(approved?"theoretical_approved":"theoretical_rejected","application",app.id,null,{status});
    location.reload();
  };
  document.querySelector("[data-approve]").addEventListener("click",()=>decide(true));
  document.querySelector("[data-reject]").addEventListener("click",()=>decide(false));

  const physicalStage=["Aprovado no teste teórico","Aguardando teste físico"].includes(app.status);
  document.querySelector("[data-physical-approve]").classList.toggle("hidden",!physicalStage);
  document.querySelector("[data-physical-reject]").classList.toggle("hidden",!physicalStage);
  const physical=async passed=>{
    if(!profile.permissions?.interviews_manage){showToast("Sem permissão.");return}
    const status=passed?"Aprovado no teste físico":"Reprovado no teste físico";
    await ApplicationsService.update(app.id,{status,physical_recruiter:profile.display_name,public_note:passed?"Você foi aprovado no teste físico. Aguarde o curso de formação.":"Você não foi aprovado no teste físico.",timeline:[...(app.timeline||[]),{status,date:new Date().toISOString()}]});
    await AuditService.write(passed?"physical_approved":"physical_rejected","application",app.id,null,{status});
    location.reload();
  };
  document.querySelector("[data-physical-approve]").addEventListener("click",()=>physical(true));
  document.querySelector("[data-physical-reject]").addEventListener("click",()=>physical(false));
  document.querySelector("[data-back]").addEventListener("click",()=>history.back());
});
