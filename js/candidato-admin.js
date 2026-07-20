
document.addEventListener("DOMContentLoaded",async()=>{
  try{if(!(await PPStore.initializeStaff())){location.href="login.html";return;}}catch(err){alert(err.message);location.href="login.html";return;}
  if(!PPStore.hasPermission("candidates_review")){
    document.querySelector("[data-page]").innerHTML='<div class="empty-state"><h2>Acesso negado</h2><p>Você não possui permissão para analisar candidatos.</p><a class="button primary" href="dashboard.html">Voltar ao painel</a></div>';
    return;
  }
  const id=new URLSearchParams(location.search).get("id");
  const app=PPStore.applications().find(a=>a.id===id);
  if(!app){document.querySelector("[data-page]").innerHTML='<div class="empty-state">Candidato não encontrado.</div>';return;}
  document.querySelector("[data-name]").textContent=app.characterName;
  document.querySelector("[data-status]").textContent=app.status;
  document.querySelector("[data-status]").className="status-pill "+(app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":"");
  ["protocol","passport","discord","availability","experience"].forEach(k=>{
    const el=document.querySelector(`[data-${k}]`); if(el) el.textContent=app[k]||"Não informado";
  });
  document.querySelector("[data-score]").textContent=`${app.autoScore}/${app.maxAutoScore||0}`;
  document.querySelector("[data-created]").textContent=ppFormatDate(app.createdAt);
  const answerEntries=Object.values(app.answers||{});
  document.querySelector("[data-answers]").innerHTML=answerEntries.map(answer=>`
    <div class="answer-block">
      <span>${ppEscape(answer.question||"Questão")}</span>
      <p>${ppEscape(answer.optionLabel||answer.value||"Sem resposta")}</p>
      ${answer.type==="open"&&answer.manualCriteria?`<small class="muted"><strong>Critério de análise:</strong> ${ppEscape(answer.manualCriteria)}</small>`:""}
      ${answer.type!=="open"?`<small class="muted">Pontuação: ${Number(answer.points||0)}/${Number(answer.maxPoints||0)}</small>`:""}
    </div>`).join("");
  document.querySelector("[data-notes]").value=app.reviewerNotes||"";
  const decide=async(approved)=>{
    const needed=approved?"candidates_approve":"candidates_reject";
    if(!PPStore.hasPermission(needed)){ppToast("Você não possui permissão para esta decisão.");return;}
    const status=approved?"Aprovado no teste teórico":"Reprovado no teste teórico";
    const now=new Date().toISOString();
    const oldData={status:app.status,reviewerNotes:app.reviewerNotes};
    await PPStore.updateApplication(app.id,{
      status,reviewerNotes:document.querySelector("[data-notes]").value.trim(),
      interviewRecruiter:approved?PPStore.currentUser()?.name:app.interviewRecruiter,
      publicNote:approved
        ?"Parabéns, você foi aprovado no teste teórico. Fique atento ao Discord oficial para acompanhar a divulgação do dia e horário do teste físico coletivo."
        :"Sua inscrição não foi aprovada no teste teórico.",
      physicalRecruiter:approved?PPStore.currentUser()?.name:app.physicalRecruiter,
      timeline:[...app.timeline,{status,date:now}]
    });
    await PPStore.addAudit(approved?"theoretical_test_approved":"theoretical_test_rejected","application",app.id,oldData,{status});
    ppToast("Decisão registrada.");setTimeout(()=>location.reload(),500);
  };
  document.querySelector("[data-approve]").addEventListener("click",()=>decide(true));
  document.querySelector("[data-reject]").addEventListener("click",()=>decide(false));

  const physicalApprove=document.querySelector("[data-physical-approve]");
  const physicalReject=document.querySelector("[data-physical-reject]");
  const isPhysicalStage=["Aprovado no teste teórico","Aguardando teste físico"].includes(app.status);
  physicalApprove.classList.toggle("hidden",!isPhysicalStage);
  physicalReject.classList.toggle("hidden",!isPhysicalStage);

  const registerPhysicalResult=async passed=>{
    if(!PPStore.hasPermission("interviews_manage")){ppToast("Você não possui permissão para registrar o teste físico.");return;}
    const status=passed?"Aprovado no teste físico":"Reprovado no teste físico";
    const now=new Date().toISOString();
    const oldData={status:app.status};
    await PPStore.updateApplication(app.id,{
      status,
      physicalRecruiter:PPStore.currentUser()?.name,
      publicNote:passed
        ?"Parabéns, você foi aprovado no teste físico. Aguarde novas orientações sobre o curso de formação."
        :"Você não foi aprovado no teste físico desta turma.",
      timeline:[...app.timeline,{status,date:now}]
    });
    await PPStore.addAudit(passed?"physical_test_approved":"physical_test_rejected","application",app.id,oldData,{status});
    ppToast("Resultado do teste físico registrado.");
    setTimeout(()=>location.reload(),500);
  };

  physicalApprove.addEventListener("click",()=>registerPhysicalResult(true));
  physicalReject.addEventListener("click",()=>registerPhysicalResult(false));

  document.querySelector("[data-back]").addEventListener("click",()=>history.back());
});
