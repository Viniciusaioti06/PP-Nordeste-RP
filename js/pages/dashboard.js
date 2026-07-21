
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

  const sidebar=document.querySelector("[data-sidebar]");
  const sidebarToggle=document.querySelector("[data-sidebar-toggle]");
  const sidebarOverlay=document.querySelector("[data-sidebar-overlay]");

  const closeSidebar=()=>{
    sidebar?.classList.remove("open");
    sidebarOverlay?.classList.remove("open");
    sidebarToggle?.classList.remove("active");
    sidebarToggle?.setAttribute("aria-expanded","false");
    document.body.classList.remove("admin-menu-open");
  };

  const openSidebar=()=>{
    sidebar?.classList.add("open");
    sidebarOverlay?.classList.add("open");
    sidebarToggle?.classList.add("active");
    sidebarToggle?.setAttribute("aria-expanded","true");
    document.body.classList.add("admin-menu-open");
  };

  sidebarToggle?.addEventListener("click",()=>{
    sidebar?.classList.contains("open")?closeSidebar():openSidebar();
  });
  sidebarOverlay?.addEventListener("click",closeSidebar);
  window.addEventListener("resize",()=>{if(window.innerWidth>1000)closeSidebar()});


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
  links.forEach(link=>link.addEventListener("click",async()=>{await show(link.dataset.sectionLink);closeSidebar()}));
  document.querySelector("[data-logout]").addEventListener("click",async()=>{try{await AuditService.write("logout","session",profile.id,null,null)}catch{}await Auth.signOut();location.href="login.html"});

  let applications=await ApplicationsService.list();
  const renderStats=()=>{
    document.querySelector("[data-total]").textContent=applications.length;
    document.querySelector("[data-review]").textContent=applications.filter(a=>a.status==="Em análise").length;
    document.querySelector("[data-approved]").textContent=applications.filter(a=>a.status.includes("Aprovado")).length;
    document.querySelector("[data-rejected]").textContent=applications.filter(a=>a.status.includes("Reprovado")).length;
    const total=Math.max(applications.length,1);
    const reviewCount=applications.filter(a=>a.status==="Em análise").length;
    const approvedCount=applications.filter(a=>a.status.includes("Aprovado")).length;
    const rejectedCount=applications.filter(a=>a.status.includes("Reprovado")).length;

    document.querySelector("[data-bar-review]").style.width=`${reviewCount/total*100}%`;
    document.querySelector("[data-bar-approved]").style.width=`${approvedCount/total*100}%`;
    document.querySelector("[data-bar-rejected]").style.width=`${rejectedCount/total*100}%`;

    document.querySelector("[data-bar-review-count]").textContent=reviewCount;
    document.querySelector("[data-bar-approved-count]").textContent=approvedCount;
    document.querySelector("[data-bar-rejected-count]").textContent=rejectedCount;
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

  const announcementModal=document.querySelector("[data-announcement-modal]");
  const announcementForm=document.querySelector("#announcement-form");
  const announcementDeleteButton=document.querySelector("[data-delete-announcement]");
  let announcementItems=[];

  const openAnnouncementModal=(item=null)=>{
    announcementForm.reset();
    announcementForm.id.value=item?.id||"";
    announcementForm.title.value=item?.title||"";
    announcementForm.message.value=item?.message||"";
    announcementForm.audienceStatus.value=item?.audience_status||"Aprovado no teste teórico";
    announcementForm.active.checked=item?.active!==false;

    document.querySelector("[data-announcement-title]").textContent=
      item?"Editar aviso":"Novo aviso";
    announcementDeleteButton.classList.toggle("hidden",!item);
    announcementModal.showModal();
  };

  const renderAnnouncements=async()=>{
    if(!profile.permissions?.announcements_manage)return;
    const list=document.querySelector("[data-announcement-list]");
    list.innerHTML='<div class="muted">Carregando avisos...</div>';

    try{
      announcementItems=await AnnouncementsService.list();
      list.innerHTML=announcementItems.map(item=>`
        <article class="question-editor-row">
          <div class="drag-handle">✦</div>
          <div>
            <span class="eyebrow">${escapeHTML(item.audience_status)}</span>
            <h3>${escapeHTML(item.title)}</h3>
            <p class="muted">${escapeHTML(item.message)}</p>
            <div class="question-meta">
              <span>${item.active?"Ativo":"Inativo"}</span>
              <span>${formatDate(item.created_at)}</span>
            </div>
          </div>
          <div class="question-row-actions">
            <button class="button secondary small" type="button" data-edit-announcement="${item.id}">Editar</button>
          </div>
        </article>
      `).join("");
      document.querySelector("[data-announcement-empty]").classList.toggle("hidden",announcementItems.length>0);

      list.querySelectorAll("[data-edit-announcement]").forEach(button=>{
        button.addEventListener("click",()=>{
          const item=announcementItems.find(entry=>entry.id===button.dataset.editAnnouncement);
          if(item)openAnnouncementModal(item);
        });
      });
    }catch(error){
      list.innerHTML=`<div class="error">${escapeHTML(error.message)}</div>`;
    }
  };

  document.querySelector("[data-new-announcement]")?.addEventListener("click",()=>{
    if(!profile.permissions?.announcements_manage){
      showToast("Você não possui permissão para criar avisos.");
      return;
    }
    openAnnouncementModal();
  });

  document.querySelector("[data-announcement-close]")?.addEventListener("click",()=>announcementModal.close());
  document.querySelector("[data-announcement-cancel]")?.addEventListener("click",()=>announcementModal.close());

  announcementForm?.addEventListener("submit",async event=>{
    event.preventDefault();

    const id=announcementForm.id.value.trim();
    const submitButton=announcementForm.querySelector('button[type="submit"]');
    submitButton.disabled=true;
    submitButton.textContent="Salvando...";

    const payload={
      title:announcementForm.title.value.trim(),
      message:announcementForm.message.value.trim(),
      audience_status:announcementForm.audienceStatus.value,
      active:announcementForm.active.checked
    };

    try{
      if(id){
        await AnnouncementsService.update(id,payload);
        await AuditService.write("announcement_updated","announcement",id,null,payload);
        showToast("Aviso atualizado.");
      }else{
        const created=await AnnouncementsService.create(payload);
        await AuditService.write("announcement_created","announcement",created.id,null,payload);
        showToast("Aviso publicado.");
      }
      announcementModal.close();
      await renderAnnouncements();
    }catch(error){
      showToast(error.message);
      console.error("Erro ao salvar aviso:",error);
    }finally{
      submitButton.disabled=false;
      submitButton.textContent="Salvar aviso";
    }
  });

  announcementDeleteButton?.addEventListener("click",async()=>{
    const id=announcementForm.id.value.trim();
    if(!id)return;
    if(!confirm("Deseja excluir este aviso?"))return;

    announcementDeleteButton.disabled=true;
    try{
      await AnnouncementsService.remove(id);
      await AuditService.write("announcement_deleted","announcement",id,null,null);
      announcementModal.close();
      await renderAnnouncements();
      showToast("Aviso excluído.");
    }catch(error){
      showToast(error.message);
    }finally{
      announcementDeleteButton.disabled=false;
    }
  });

  const permissionDefinitions={
    dashboard_view:["Ver visão geral","Acessar os indicadores do painel."],
    candidates_view:["Ver candidatos","Visualizar inscrições e dados básicos."],
    candidates_review:["Analisar candidatos","Abrir respostas e observações internas."],
    candidates_approve:["Aprovar candidatos","Aprovar no teste teórico."],
    candidates_reject:["Reprovar candidatos","Registrar reprovações."],
    interviews_manage:["Gerenciar teste físico","Registrar resultados do teste físico coletivo."],
    questions_view:["Ver questionário","Visualizar o banco de questões."],
    questions_manage:["Editar questionário","Criar, editar e excluir questões."],
    announcements_manage:["Gerenciar avisos","Criar e editar comunicados coletivos."],
    settings_manage:["Alterar configurações","Modificar as regras gerais."],
    staff_manage:["Gerenciar equipe","Criar, editar e remover integrantes."],
    audit_view:["Ver auditoria","Consultar o histórico de ações."],
    applications_delete:["Excluir inscrições","Permissão administrativa sensível."]
  };

  const roleDefaults={
    recruiter:{
      dashboard_view:true,candidates_view:true,candidates_review:true,
      candidates_approve:true,candidates_reject:true,interviews_manage:true,
      questions_view:true,questions_manage:false,announcements_manage:false,
      settings_manage:false,staff_manage:false,audit_view:false,
      applications_delete:false
    },
    supervisor:{
      dashboard_view:true,candidates_view:true,candidates_review:true,
      candidates_approve:true,candidates_reject:true,interviews_manage:true,
      questions_view:true,questions_manage:true,announcements_manage:true,
      settings_manage:false,staff_manage:false,audit_view:true,
      applications_delete:false
    },
    admin:{
      dashboard_view:true,candidates_view:true,candidates_review:true,
      candidates_approve:true,candidates_reject:true,interviews_manage:true,
      questions_view:true,questions_manage:true,announcements_manage:true,
      settings_manage:true,staff_manage:true,audit_view:true,
      applications_delete:true
    }
  };

  const staffModal=document.querySelector("[data-staff-modal]");
  const staffForm=document.querySelector("#staff-form");
  const permissionGrid=document.querySelector("[data-permission-grid]");
  const staffDeleteButton=document.querySelector("[data-delete-staff]");
  let staffMembers=[];

  const roleLabel=role=>({
    admin:"Administrador",
    supervisor:"Supervisor",
    recruiter:"Recrutador"
  }[role]||role);

  const renderPermissionGrid=permissions=>{
    permissionGrid.innerHTML=Object.entries(permissionDefinitions).map(([key,[title,description]])=>`
      <label class="permission-item">
        <input type="checkbox" name="permission_${key}" ${permissions?.[key]?"checked":""}>
        <span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></span>
      </label>
    `).join("");
  };

  const collectPermissions=()=>Object.keys(permissionDefinitions).reduce((result,key)=>{
    result[key]=Boolean(staffForm.elements[`permission_${key}`]?.checked);
    return result;
  },{});

  const openStaffModal=(user=null)=>{
    staffForm.reset();
    staffForm.id.value=user?.id||"";
    staffForm.name.value=user?.display_name||"";
    staffForm.username.value=user?.username||"";
    staffForm.email.value=user?.email||"";
    staffForm.discord.value=user?.discord||"";
    staffForm.role.value=user?.role||"recruiter";
    staffForm.active.checked=user?.active!==false;
    staffForm.password.value="";
    staffForm.password.required=!user;

    document.querySelector("[data-staff-modal-title]").textContent=
      user?"Editar integrante":"Adicionar integrante";
    document.querySelector("[data-password-help]").textContent=
      user?"Deixe em branco para manter a senha atual.":"Mínimo de 8 caracteres.";
    staffDeleteButton.classList.toggle("hidden",!user||user.id===profile.id);

    renderPermissionGrid(user?.permissions||roleDefaults[staffForm.role.value]);
    staffModal.showModal();
  };

  const normalizeSearch=value=>String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim();

  const drawStaffTable=()=>{
    const table=document.querySelector("[data-staff-table]");
    const term=normalizeSearch(document.querySelector("[data-staff-search]")?.value);
    const filtered=staffMembers.filter(user=>{
      const haystack=[
        user.display_name,user.username,user.email,user.discord,
        roleLabel(user.role),user.active?"ativo":"inativo"
      ].map(normalizeSearch).join(" ");
      return !term||haystack.includes(term);
    });

    document.querySelector("[data-staff-result-count]").textContent=
      `${filtered.length} ${filtered.length===1?"integrante":"integrantes"}`;

    table.innerHTML=filtered.length?filtered.map(user=>`
      <tr>
        <td><div class="name-cell"><strong>${escapeHTML(user.display_name||"Sem nome")}</strong><small>${escapeHTML(user.email||"")}</small></div></td>
        <td>${escapeHTML(user.username||"—")}</td>
        <td><span class="role-badge ${user.role==="admin"?"admin":user.role==="supervisor"?"supervisor":""}">${escapeHTML(roleLabel(user.role))}</span></td>
        <td><span class="status-pill ${user.active?"approved":"rejected"}">${user.active?"Ativo":"Desativado"}</span></td>
        <td>${user.last_login?formatDate(user.last_login):"Nunca acessou"}</td>
        <td><button class="button secondary small" type="button" data-edit-staff="${user.id}">Editar</button></td>
      </tr>
    `).join(""):'<tr><td colspan="6" class="muted">Nenhum integrante encontrado.</td></tr>';

    table.querySelectorAll("[data-edit-staff]").forEach(button=>{
      button.addEventListener("click",()=>{
        const user=staffMembers.find(item=>item.id===button.dataset.editStaff);
        if(user)openStaffModal(user);
      });
    });
  };

  const renderStaff=async()=>{
    if(!profile.permissions?.staff_manage)return;
    const table=document.querySelector("[data-staff-table]");
    table.innerHTML='<tr><td colspan="6" class="muted">Carregando equipe...</td></tr>';

    try{
      staffMembers=await StaffService.list();
      drawStaffTable();
    }catch(error){
      table.innerHTML=`<tr><td colspan="6" class="error">${escapeHTML(error.message)}</td></tr>`;
    }
  };

  document.querySelector("[data-staff-search]")?.addEventListener("input",drawStaffTable);

  document.querySelector("[data-new-staff]")?.addEventListener("click",()=>{
    if(!profile.permissions?.staff_manage){
      showToast("Você não possui permissão para gerenciar a equipe.");
      return;
    }
    openStaffModal();
  });

  staffForm?.role.addEventListener("change",()=>{
    renderPermissionGrid(roleDefaults[staffForm.role.value]||{});
  });

  document.querySelector("[data-staff-modal-close]")?.addEventListener("click",()=>staffModal.close());
  document.querySelector("[data-staff-cancel]")?.addEventListener("click",()=>staffModal.close());

  staffForm?.addEventListener("submit",async event=>{
    event.preventDefault();

    if(!profile.permissions?.staff_manage){
      showToast("Você não possui permissão para esta ação.");
      return;
    }

    const id=staffForm.id.value.trim();
    const password=staffForm.password.value;
    if(!id&&password.length<8){
      showToast("A senha inicial deve possuir pelo menos 8 caracteres.");
      return;
    }
    if(id&&password&&password.length<8){
      showToast("A nova senha deve possuir pelo menos 8 caracteres.");
      return;
    }

    const submitButton=staffForm.querySelector('button[type="submit"]');
    submitButton.disabled=true;
    submitButton.textContent=id?"Salvando...":"Criando...";

    const payload={
      name:staffForm.name.value.trim(),
      username:staffForm.username.value.trim(),
      email:staffForm.email.value.trim(),
      discord:staffForm.discord.value.trim(),
      role:staffForm.role.value,
      password,
      active:staffForm.active.checked,
      permissions:collectPermissions()
    };

    try{
      if(id){
        await StaffService.invoke("update",payload,id);
        await AuditService.write("staff_updated","staff",id,null,{email:payload.email,role:payload.role});
        showToast("Integrante atualizado.");
      }else{
        const result=await StaffService.invoke("create",payload);
        await AuditService.write("staff_created","staff",result?.profile?.id||payload.email,null,{email:payload.email,role:payload.role});
        showToast("Integrante criado com sucesso.");
      }
      staffModal.close();
      await renderStaff();
    }catch(error){
      showToast(error.message);
      console.error("Erro ao salvar integrante:",error);
    }finally{
      submitButton.disabled=false;
      submitButton.textContent="Salvar integrante";
    }
  });

  staffDeleteButton?.addEventListener("click",async()=>{
    const id=staffForm.id.value.trim();
    if(!id)return;
    if(!confirm("Deseja remover este integrante permanentemente?"))return;

    staffDeleteButton.disabled=true;
    try{
      await StaffService.invoke("delete",{},id);
      await AuditService.write("staff_deleted","staff",id,null,null);
      staffModal.close();
      await renderStaff();
      showToast("Integrante removido.");
    }catch(error){
      showToast(error.message);
    }finally{
      staffDeleteButton.disabled=false;
    }
  });

  const auditActionLabel=action=>({
    login:"Login realizado",
    staff_created:"Integrante criado",
    staff_updated:"Integrante atualizado",
    staff_deleted:"Integrante removido",
    announcement_created:"Aviso publicado",
    announcement_updated:"Aviso atualizado",
    announcement_deleted:"Aviso excluído",
    application_updated:"Inscrição atualizada",
    application_deleted:"Inscrição excluída",
    question_created:"Questão criada",
    question_updated:"Questão atualizada",
    question_deleted:"Questão excluída",
    settings_updated:"Configurações alteradas",
    applications_cleared:"Todas as inscrições excluídas"
  }[action]||String(action||"Ação"));

  const auditResourceLabel=resource=>({
    session:"Sessão",
    staff:"Equipe",
    announcement:"Aviso",
    application:"Inscrição",
    question:"Questão",
    settings:"Configurações"
  }[resource]||String(resource||"—"));

  let auditItems=[];

  const drawAuditTable=()=>{
    const table=document.querySelector("[data-audit-table]");
    const term=normalizeSearch(document.querySelector("[data-audit-search]")?.value);
    const filtered=auditItems.filter(log=>{
      const haystack=[
        log.actor_name,log.actor_role,auditActionLabel(log.action),
        auditResourceLabel(log.resource_type),log.resource_id,
        formatDate(log.created_at)
      ].map(normalizeSearch).join(" ");
      return !term||haystack.includes(term);
    });

    document.querySelector("[data-audit-result-count]").textContent=
      `${filtered.length} ${filtered.length===1?"registro":"registros"}`;

    table.innerHTML=filtered.map(log=>`
      <tr>
        <td><div class="name-cell"><strong>${escapeHTML(log.actor_name||"Sistema")}</strong><small>${escapeHTML(roleLabel(log.actor_role)||log.actor_role||"")}</small></div></td>
        <td>${escapeHTML(auditActionLabel(log.action))}</td>
        <td>${escapeHTML(auditResourceLabel(log.resource_type))}</td>
        <td>${formatDate(log.created_at)}</td>
      </tr>
    `).join("");

    document.querySelector("[data-audit-empty]").classList.toggle("hidden",filtered.length>0);
  };

  const renderAudit=async()=>{
    const table=document.querySelector("[data-audit-table]");
    table.innerHTML='<tr><td colspan="4" class="muted">Carregando auditoria...</td></tr>';
    try{
      auditItems=await AuditService.list();
      drawAuditTable();
    }catch(error){
      table.innerHTML=`<tr><td colspan="4" class="error">${escapeHTML(error.message)}</td></tr>`;
    }
  };

  document.querySelector("[data-audit-search]")?.addEventListener("input",drawAuditTable);

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

  document.querySelector("[data-clear-demo]")?.addEventListener("click",async event=>{
    if(!profile.permissions?.settings_manage){
      showToast("Você não possui permissão para executar esta ação.");
      return;
    }

    const firstConfirmation=confirm(
      `Esta ação excluirá permanentemente ${applications.length} inscrição(ões).\n\nDeseja continuar?`
    );
    if(!firstConfirmation)return;

    const typed=prompt('Para confirmar, digite exatamente: EXCLUIR TODAS');
    if(typed!=="EXCLUIR TODAS"){
      showToast("Exclusão cancelada.");
      return;
    }

    const button=event.currentTarget;
    const status=document.querySelector("[data-clear-applications-status]");
    button.disabled=true;
    button.textContent="Excluindo...";
    if(status)status.textContent="Processando exclusão no Supabase...";

    try{
      const deletedCount=await ApplicationsService.deleteAll();
      applications=[];
      renderStats();
      await renderApplications();
      if(status)status.textContent=`${deletedCount} inscrição(ões) excluída(s).`;
      showToast(`${deletedCount} inscrição(ões) excluída(s) com sucesso.`);
    }catch(error){
      console.error("Erro ao excluir inscrições:",error);
      if(status)status.textContent="Não foi possível concluir a exclusão.";
      showToast(error.message||"Erro ao excluir as inscrições.");
    }finally{
      button.disabled=false;
      button.textContent="Excluir todas as inscrições";
    }
  });

  document.querySelector("[data-search]")?.addEventListener("input",renderApplications);
  document.querySelector("[data-filter]")?.addEventListener("change",renderApplications);
  renderStats();
});
