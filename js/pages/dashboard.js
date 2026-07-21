
document.addEventListener("DOMContentLoaded",async()=>{
  let profile;
  try{profile=await Auth.requireStaff()}catch(err){alert(err.message);location.href="login.html";return}

  const permissionFor={
    visao:"dashboard_view",candidatos:"candidates_view","teste-fisico":"interviews_manage",
    questoes:"questions_view",avisos:"announcements_manage",equipe:"staff_manage",
    auditoria:"audit_view",configuracoes:"settings_manage"
  };

  document.querySelector("[data-user-name]").textContent=profile.display_name;
  document.querySelector("[data-user-role]").textContent={admin:"Administrador",supervisor:"Supervisor",recruiter:"Recrutador"}[profile.role];
  document.querySelector("[data-user-avatar]").textContent=profile.display_name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
  document.querySelectorAll("[data-permission]").forEach(el=>{if(!profile.permissions?.[el.dataset.permission])el.hidden=true});
  document.querySelectorAll("[data-permission-action]").forEach(el=>{if(!profile.permissions?.[el.dataset.permissionAction])el.classList.add("hidden")});

  const sections=[...document.querySelectorAll(".admin-section")];
  const links=[...document.querySelectorAll("[data-section-link]")];
  const show=async id=>{
    if(permissionFor[id]&&!profile.permissions?.[permissionFor[id]]){showToast("Acesso negado.");return}
    links.forEach(link=>link.classList.toggle("active",link.dataset.sectionLink===id));
    sections.forEach(section=>section.classList.toggle("active",section.id===id));
    if(id==="candidatos")await renderApplications();
    if(id==="teste-fisico")await renderPhysical();
    if(id==="questoes")await renderQuestions();
    if(id==="avisos")await renderAnnouncements();
    if(id==="equipe")await renderStaff();
    if(id==="auditoria")await renderAudit();
    if(id==="configuracoes")await renderSettings();
  };
  links.forEach(link=>link.addEventListener("click",()=>show(link.dataset.sectionLink)));
  document.querySelector("[data-logout]").addEventListener("click",async()=>{await Auth.signOut();location.href="login.html"});

  let applications=await ApplicationsService.list();
  const renderStats=()=>{
    document.querySelector("[data-total]").textContent=applications.length;
    document.querySelector("[data-review]").textContent=applications.filter(a=>a.status==="Em análise").length;
    document.querySelector("[data-approved]").textContent=applications.filter(a=>a.status.includes("Aprovado")).length;
    document.querySelector("[data-rejected]").textContent=applications.filter(a=>a.status.includes("Reprovado")).length;
    const total=Math.max(applications.length,1);
    document.querySelector("[data-bar-review]").style.width=`${applications.filter(a=>a.status==="Em análise").length/total*100}%`;
    document.querySelector("[data-bar-approved]").style.width=`${applications.filter(a=>a.status.includes("Aprovado")).length/total*100}%`;
    document.querySelector("[data-bar-rejected]").style.width=`${applications.filter(a=>a.status.includes("Reprovado")).length/total*100}%`;
  };

  const renderApplications=async()=>{
    applications=await ApplicationsService.list();
    const term=(document.querySelector("[data-search]").value||"").toLowerCase();
    const filter=document.querySelector("[data-filter]").value;
    const list=applications.filter(app=>
      [app.character_name,app.passport,app.discord].some(v=>String(v).toLowerCase().includes(term)) &&
      (filter==="all"||app.status===filter)
    );
    document.querySelector("[data-table]").innerHTML=list.map(app=>`<tr>
      <td><div class="name-cell"><strong>${escapeHTML(app.character_name)}</strong><small>${escapeHTML(app.discord)}</small></div></td>
      <td>${escapeHTML(app.passport)}</td><td>${app.automatic_score}/${app.maximum_automatic_score}</td>
      <td><span class="status-pill ${app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":""}">${escapeHTML(app.status)}</span></td>
      <td>${formatDate(app.created_at)}</td><td><a class="button secondary small" href="candidato.html?id=${app.id}">Abrir</a></td></tr>`).join("");
    document.querySelector("[data-empty]").classList.toggle("hidden",list.length>0);
  };

  const renderPhysical=async()=>{
    applications=await ApplicationsService.list();
    const list=applications.filter(a=>["Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Reprovado no teste físico"].includes(a.status));
    document.querySelector("[data-physical-table]").innerHTML=list.map(app=>`<tr><td>${escapeHTML(app.character_name)}</td><td>${escapeHTML(app.protocol)}</td><td>${escapeHTML(app.discord)}</td><td>${escapeHTML(app.status)}</td><td>${escapeHTML(app.physical_recruiter||"—")}</td><td><a class="button secondary small" href="candidato.html?id=${app.id}">Abrir</a></td></tr>`).join("");
    document.querySelector("[data-physical-empty]").classList.toggle("hidden",list.length>0);
  };

  let questions=[];
  const renderQuestions=async()=>{
    questions=await QuestionsService.staffList();
    document.querySelector("[data-question-list]").innerHTML=questions.map((q,index)=>`<article class="question-editor-row">
      <div class="drag-handle">⋮⋮</div><div><span class="eyebrow">${escapeHTML(q.category)}</span><h3>${index+1}. ${escapeHTML(q.title)}</h3>
      <div class="question-meta"><span>${q.question_type}</span><span>${q.points} pontos</span><span>${q.active?"Ativa":"Inativa"}</span></div></div>
      <div class="question-row-actions">${profile.permissions.questions_manage?`<button class="button secondary small" data-edit-question="${q.id}">Editar</button>`:""}</div></article>`).join("");
    document.querySelector("[data-question-empty]").classList.toggle("hidden",questions.length>0);
    document.querySelectorAll("[data-edit-question]").forEach(btn=>btn.addEventListener("click",()=>openQuestion(btn.dataset.editQuestion)));
  };

  const questionModal=document.querySelector("[data-question-modal]");
  const questionForm=document.querySelector("#question-editor-form");
  const optionList=document.querySelector("[data-option-list]");
  const addOption=(option={})=>{
    const row=document.createElement("div");row.className="option-editor-row";row.dataset.id=option.id||crypto.randomUUID();
    row.innerHTML=`<input type="text" data-label value="${escapeHTML(option.label||"")}" placeholder="Alternativa"><input type="number" data-points value="${option.points||0}" min="0"><label class="option-check"><input type="radio" name="correct" ${option.correct?"checked":""}> Correta</label><label class="option-check"><input type="checkbox" data-eliminatory ${option.eliminatory?"checked":""}> Elimina</label><button class="icon-button" type="button">×</button>`;
    row.querySelector("button").addEventListener("click",()=>row.remove());optionList.appendChild(row);
  };
  const openQuestion=id=>{
    const q=questions.find(item=>item.id===id);
    questionForm.reset();optionList.innerHTML="";
    questionForm.id.value=q?.id||"";
    questionForm.title.value=q?.title||"";
    questionForm.description.value=q?.description||"";
    questionForm.category.value=q?.category||"Geral";
    questionForm.type.value=q?.question_type||"objective";
    questionForm.points.value=q?.points||0;
    questionForm.minLength.value=q?.min_length||50;
    questionForm.manualCriteria.value=q?.manual_criteria||"";
    questionForm.required.checked=q?.required!==false;
    questionForm.active.checked=q?.active!==false;
    (q?.options||[]).forEach(option=>addOption({...option,correct:q.correct_option===option.id,eliminatory:(q.eliminatory_options||[]).includes(option.id)}));
    if(!q){addOption();addOption()}
    questionModal.showModal();
  };
  document.querySelector("[data-new-question]")?.addEventListener("click",()=>openQuestion());
  document.querySelector("[data-add-option]")?.addEventListener("click",()=>addOption());
  document.querySelector("[data-question-modal-close]")?.addEventListener("click",()=>questionModal.close());
  document.querySelector("[data-question-cancel]")?.addEventListener("click",()=>questionModal.close());
  questionForm?.addEventListener("submit",async event=>{
    event.preventDefault();
    const options=[...optionList.children].map(row=>({
      id:row.dataset.id,label:row.querySelector("[data-label]").value.trim(),points:Number(row.querySelector("[data-points]").value||0),
      correct:row.querySelector('input[name="correct"]').checked,eliminatory:row.querySelector("[data-eliminatory]").checked
    })).filter(option=>option.label);
    const existing=questions.find(q=>q.id===questionForm.id.value);
    const payload={
      id:questionForm.id.value||crypto.randomUUID(),title:questionForm.title.value.trim(),
      description:questionForm.description.value.trim(),category:questionForm.category.value.trim(),
      question_type:questionForm.type.value,required:questionForm.required.checked,active:questionForm.active.checked,
      order_position:existing?.order_position||questions.length+1,points:Number(questionForm.points.value||0),
      options:questionForm.type.value==="open"?[]:options.map(({correct,eliminatory,...rest})=>rest),
      correct_option:options.find(o=>o.correct)?.id||null,
      eliminatory_options:options.filter(o=>o.eliminatory).map(o=>o.id),
      min_length:Number(questionForm.minLength.value||0),manual_criteria:questionForm.manualCriteria.value.trim()
    };
    await QuestionsService.save(payload);questionModal.close();await renderQuestions();showToast("Questão salva.");
  });

  const renderAnnouncements=async()=>{
    const list=await AnnouncementsService.list();
    document.querySelector("[data-announcement-list]").innerHTML=list.map(item=>`<article class="question-editor-row"><div>✦</div><div><span class="eyebrow">${escapeHTML(item.audience_status)}</span><h3>${escapeHTML(item.title)}</h3><p class="muted">${escapeHTML(item.message)}</p></div><div><button class="button secondary small" data-announcement="${item.id}">Editar</button></div></article>`).join("");
    document.querySelector("[data-announcement-empty]").classList.toggle("hidden",list.length>0);
  };

  const renderStaff=async()=>{
    const list=await StaffService.list();
    document.querySelector("[data-staff-table]").innerHTML=list.map(user=>`<tr><td>${escapeHTML(user.display_name)}</td><td>${escapeHTML(user.email)}</td><td>${escapeHTML(user.role)}</td><td>${user.active?"Ativo":"Inativo"}</td><td>${formatDate(user.last_login)}</td><td></td></tr>`).join("");
  };

  const renderAudit=async()=>{
    const list=await AuditService.list();
    document.querySelector("[data-audit-table]").innerHTML=list.map(log=>`<tr><td>${escapeHTML(log.actor_name)}</td><td>${escapeHTML(log.action)}</td><td>${escapeHTML(log.resource_type)}</td><td>${formatDate(log.created_at)}</td></tr>`).join("");
    document.querySelector("[data-audit-empty]").classList.toggle("hidden",list.length>0);
  };

  const renderSettings=async()=>{
    const item=await SettingsService.get();
    const form=document.querySelector("#settings-form");
    form.recruitmentOpen.checked=item.recruitment_open;
    form.minimumScore.value=item.minimum_score;
    form.retryDays.value=item.retry_days;
    form.showPublicReason.checked=item.show_public_reason;
  };
  document.querySelector("#settings-form")?.addEventListener("submit",async event=>{
    event.preventDefault();const form=event.currentTarget;
    await SettingsService.save({recruitment_open:form.recruitmentOpen.checked,minimum_score:Number(form.minimumScore.value),retry_days:Number(form.retryDays.value),show_public_reason:form.showPublicReason.checked});
    showToast("Configurações salvas.");
  });

  document.querySelector("[data-search]")?.addEventListener("input",renderApplications);
  document.querySelector("[data-filter]")?.addEventListener("change",renderApplications);
  renderStats();
});
