
document.addEventListener("DOMContentLoaded",()=>{
  if(!PPStore.hasAdminSession()){location.href="login.html";return;}
  const currentUser=PPStore.currentUser();
  if(!currentUser||!currentUser.active){PPStore.logoutStaff();location.href="login.html";return;}

  document.querySelector("[data-user-name]").textContent=currentUser.name;
  document.querySelector("[data-user-role]").textContent={admin:"Administrador",supervisor:"Supervisor",recruiter:"Recrutador"}[currentUser.role]||"Usuário";
  document.querySelector("[data-user-avatar]").textContent=currentUser.name.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase();

  document.querySelectorAll("[data-permission]").forEach(element=>{
    if(!PPStore.hasPermission(element.dataset.permission)) element.hidden=true;
  });
  document.querySelectorAll("[data-permission-action]").forEach(element=>{
    if(!PPStore.hasPermission(element.dataset.permissionAction)) element.classList.add("hidden");
  });

  const links=[...document.querySelectorAll("[data-section-link]")];
  const sections=[...document.querySelectorAll(".admin-section")];
  const sectionPermissions={
    visao:"dashboard_view",candidatos:"candidates_view","teste-fisico":"interviews_manage",
    avisos:"announcements_manage",questoes:"questions_view",equipe:"staff_manage",auditoria:"audit_view",configuracoes:"settings_manage"
  };
  const show=id=>{
    const permission=sectionPermissions[id];
    if(permission&&!PPStore.hasPermission(permission)){
      document.querySelector("[data-access-denied]").showModal();
      return;
    }
    links.forEach(l=>l.classList.toggle("active",l.dataset.sectionLink===id));
    sections.forEach(s=>s.classList.toggle("active",s.id===id));
    if(id==="equipe") renderStaff();
    if(id==="auditoria") renderAudit();
    if(id==="teste-fisico") renderPhysicalTests();
    if(id==="avisos") renderAnnouncements();
  };
  links.forEach(l=>l.addEventListener("click",()=>show(l.dataset.sectionLink)));
  document.querySelector("[data-logout]").addEventListener("click",()=>{PPStore.logoutStaff();location.href="login.html"});
  document.querySelector("[data-open-candidates]")?.addEventListener("click",()=>show("candidatos"));

  const renderStats=()=>{
    const apps=PPStore.applications();
    document.querySelector("[data-total]").textContent=apps.length;
    document.querySelector("[data-review]").textContent=apps.filter(a=>a.status==="Em análise").length;
    document.querySelector("[data-approved]").textContent=apps.filter(a=>a.status.includes("Aprovado")).length;
    document.querySelector("[data-rejected]").textContent=apps.filter(a=>a.status.includes("Reprovado")).length;
    const total=Math.max(apps.length,1);
    document.querySelector("[data-bar-review]").style.width=`${apps.filter(a=>a.status==="Em análise").length/total*100}%`;
    document.querySelector("[data-bar-approved]").style.width=`${apps.filter(a=>a.status.includes("Aprovado")).length/total*100}%`;
    document.querySelector("[data-bar-rejected]").style.width=`${apps.filter(a=>a.status.includes("Reprovado")).length/total*100}%`;
  };

  const renderTable=()=>{
    const term=document.querySelector("[data-search]").value.toLowerCase();
    const status=document.querySelector("[data-filter]").value;
    const apps=PPStore.applications().filter(a=>{
      const match=[a.characterName,a.passport,a.discord].some(v=>String(v).toLowerCase().includes(term));
      return match&&(status==="all"||a.status===status);
    });
    const body=document.querySelector("[data-table]");
    body.innerHTML=apps.map(a=>`<tr>
      <td><div class="name-cell"><strong>${ppEscape(a.characterName)}</strong><small>${ppEscape(a.discord)}</small></div></td>
      <td>${ppEscape(a.passport)}</td><td>${a.autoScore}/${a.maxAutoScore||0}</td>
      <td><span class="status-pill ${a.status.includes("Aprovado")?"approved":a.status.includes("Reprovado")?"rejected":""}">${ppEscape(a.status)}</span></td>
      <td>${ppFormatDate(a.createdAt)}</td>
      <td><a class="icon-button" href="candidato.html?id=${encodeURIComponent(a.id)}">Abrir</a></td></tr>`).join("");
    document.querySelector("[data-empty]").classList.toggle("hidden",apps.length>0);
  };

  const questionModal=document.querySelector("[data-question-modal]");
  const editorForm=document.querySelector("#question-editor-form");
  const optionList=document.querySelector("[data-option-list]");

  const typeLabel=type=>({objective:"Objetiva",eliminatory:"Eliminatória",open:"Resposta aberta"}[type]||type);

  const renderQuestions=()=>{
    const questions=PPStore.questions().sort((a,b)=>a.order-b.order);
    const list=document.querySelector("[data-question-list]");
    list.innerHTML=questions.map((q,index)=>`
      <article class="question-editor-row" draggable="true" data-question-row="${q.id}">
        <div class="drag-handle" title="Arrastar para ordenar">⋮⋮</div>
        <div>
          <span class="eyebrow">${ppEscape(q.category)}</span>
          <h3>${index+1}. ${ppEscape(q.title)}</h3>
          <div class="question-meta">
            <span>${typeLabel(q.type)}</span>
            <span>${q.points||0} pontos</span>
            <span>${q.required?"Obrigatória":"Opcional"}</span>
            <span>${q.active?"Ativa":"Inativa"}</span>
            ${q.type!=="open"?`<span>${(q.options||[]).length} alternativas</span>`:""}
          </div>
        </div>
        <div class="question-row-actions">
          ${PPStore.hasPermission("questions_manage")?`
          <button class="icon-button" type="button" data-move-up="${q.id}" title="Mover para cima">↑</button>
          <button class="icon-button" type="button" data-move-down="${q.id}" title="Mover para baixo">↓</button>
          <button class="icon-button" type="button" data-duplicate="${q.id}">Duplicar</button>
          <button class="button secondary small" type="button" data-edit-question="${q.id}">Editar</button>`:"<span class='muted'>Somente visualização</span>"}
        </div>
      </article>`).join("");
    document.querySelector("[data-question-empty]").classList.toggle("hidden",questions.length>0);

    list.querySelectorAll("[data-edit-question]").forEach(b=>b.addEventListener("click",()=>openQuestionEditor(b.dataset.editQuestion)));
    list.querySelectorAll("[data-duplicate]").forEach(b=>b.addEventListener("click",()=>duplicateQuestion(b.dataset.duplicate)));
    list.querySelectorAll("[data-move-up]").forEach(b=>b.addEventListener("click",()=>moveQuestion(b.dataset.moveUp,-1)));
    list.querySelectorAll("[data-move-down]").forEach(b=>b.addEventListener("click",()=>moveQuestion(b.dataset.moveDown,1)));

    let draggedId=null;
    list.querySelectorAll("[data-question-row]").forEach(row=>{
      row.addEventListener("dragstart",()=>{draggedId=row.dataset.questionRow;});
      row.addEventListener("dragover",e=>e.preventDefault());
      row.addEventListener("drop",e=>{
        e.preventDefault();
        const targetId=row.dataset.questionRow;
        if(draggedId&&draggedId!==targetId) reorderByDrop(draggedId,targetId);
      });
    });
  };

  const normalizeOrder=questions=>{
    questions.sort((a,b)=>a.order-b.order).forEach((q,i)=>q.order=i+1);
    return questions;
  };

  const moveQuestion=(id,direction)=>{
    if(!PPStore.hasPermission("questions_manage"))return;
    const qs=normalizeOrder(PPStore.questions());
    const index=qs.findIndex(q=>q.id===id);
    const target=index+direction;
    if(index<0||target<0||target>=qs.length)return;
    [qs[index],qs[target]]=[qs[target],qs[index]];
    normalizeOrder(qs);PPStore.saveQuestions(qs);renderQuestions();
  };

  const reorderByDrop=(sourceId,targetId)=>{
    if(!PPStore.hasPermission("questions_manage"))return;
    const qs=normalizeOrder(PPStore.questions());
    const sourceIndex=qs.findIndex(q=>q.id===sourceId);
    const targetIndex=qs.findIndex(q=>q.id===targetId);
    const [item]=qs.splice(sourceIndex,1);qs.splice(targetIndex,0,item);
    normalizeOrder(qs);PPStore.saveQuestions(qs);renderQuestions();
  };

  const duplicateQuestion=id=>{
    if(!PPStore.hasPermission("questions_manage"))return;
    const qs=normalizeOrder(PPStore.questions());
    const source=qs.find(q=>q.id===id);if(!source)return;
    const copy=structuredClone(source);
    copy.id=`q-${Date.now()}`;copy.title=`${copy.title} (cópia)`;copy.order=qs.length+1;
    copy.options=(copy.options||[]).map((o,i)=>({...o,id:`opt-${Date.now()}-${i}`}));
    copy.correctOption="";
    copy.eliminatoryOptions=[];
    qs.push(copy);PPStore.saveQuestions(qs);renderQuestions();ppToast("Questão duplicada.");
  };

  const addOptionRow=(option={})=>{
    const row=document.createElement("div");
    row.className="option-editor-row";
    row.dataset.optionId=option.id||`opt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    row.innerHTML=`
      <input type="text" data-option-label placeholder="Texto da alternativa" value="${ppEscape(option.label||"")}" required>
      <input type="number" data-option-points min="0" value="${Number(option.points||0)}" title="Pontos">
      <label class="option-check"><input type="radio" name="correctOption" data-correct-option ${option.correct?"checked":""}> Correta</label>
      <label class="option-check"><input type="checkbox" data-eliminatory-option ${option.eliminatory?"checked":""}> Elimina</label>
      <button class="icon-button" type="button" data-remove-option>×</button>`;
    row.querySelector("[data-remove-option]").addEventListener("click",()=>row.remove());
    optionList.appendChild(row);
  };

  const updateEditorVisibility=()=>{
    const type=editorForm.type.value;
    document.querySelector("[data-options-editor]").classList.toggle("hidden",type==="open");
    document.querySelector("[data-min-length-field]").classList.toggle("hidden",type!=="open");
    document.querySelector("[data-manual-criteria-field]").classList.toggle("hidden",type!=="open");
    optionList.querySelectorAll("[data-eliminatory-option]").forEach(el=>el.closest(".option-check").classList.toggle("hidden",type!=="eliminatory"));
  };

  const openQuestionEditor=id=>{
    if(!PPStore.hasPermission("questions_manage")){document.querySelector("[data-access-denied]").showModal();return;}
    editorForm.reset();optionList.innerHTML="";
    const q=id?PPStore.questions().find(x=>x.id===id):null;
    document.querySelector("[data-editor-eyebrow]").textContent=q?"EDITAR QUESTÃO":"NOVA QUESTÃO";
    editorForm.id.value=q?.id||"";
    editorForm.title.value=q?.title||"";
    editorForm.description.value=q?.description||"";
    editorForm.category.value=q?.category||"Geral";
    editorForm.type.value=q?.type||"objective";
    editorForm.points.value=q?.points??0;
    editorForm.minLength.value=q?.minLength??50;
    editorForm.manualCriteria.value=q?.manualCriteria||"";
    editorForm.required.checked=q?.required!==false;
    editorForm.active.checked=q?.active!==false;
    const options=q?.options||[];
    if(options.length){
      options.forEach(opt=>addOptionRow({...opt,correct:q.correctOption===opt.id,eliminatory:(q.eliminatoryOptions||[]).includes(opt.id)}));
    }else{
      addOptionRow();addOptionRow();
    }
    document.querySelector("[data-delete-current]").classList.toggle("hidden",!q);
    updateEditorVisibility();questionModal.showModal();
  };

  const collectOptions=()=>[...optionList.querySelectorAll(".option-editor-row")].map(row=>({
    id:row.dataset.optionId,
    label:row.querySelector("[data-option-label]").value.trim(),
    points:Number(row.querySelector("[data-option-points]").value||0),
    correct:row.querySelector("[data-correct-option]").checked,
    eliminatory:row.querySelector("[data-eliminatory-option]").checked
  })).filter(o=>o.label);

  editorForm.addEventListener("submit",e=>{
    if(!PPStore.hasPermission("questions_manage"))return;
    e.preventDefault();
    const qs=normalizeOrder(PPStore.questions());
    const id=editorForm.id.value||`q-${Date.now()}`;
    const existing=qs.find(q=>q.id===id);
    const options=editorForm.type.value==="open"?[]:collectOptions();
    if(editorForm.type.value!=="open"&&options.length<2){ppToast("Cadastre pelo menos duas alternativas.");return;}
    const question={
      id,title:editorForm.title.value.trim(),description:editorForm.description.value.trim(),
      category:editorForm.category.value.trim(),type:editorForm.type.value,
      required:editorForm.required.checked,active:editorForm.active.checked,
      order:existing?.order||qs.length+1,points:Number(editorForm.points.value||0),
      options:options.map(({correct,eliminatory,...o})=>o),
      correctOption:options.find(o=>o.correct)?.id||"",
      eliminatoryOptions:options.filter(o=>o.eliminatory).map(o=>o.id),
      minLength:Number(editorForm.minLength.value||0),
      manualCriteria:editorForm.manualCriteria.value.trim()
    };
    if(existing)Object.assign(existing,question);else qs.push(question);
    PPStore.saveQuestions(normalizeOrder(qs));questionModal.close();renderQuestions();ppToast("Questão salva.");
  });

  const deleteCurrent=()=>{
    if(!PPStore.hasPermission("questions_manage"))return;
    const id=editorForm.id.value;if(!id)return;
    if(!confirm("Excluir esta questão permanentemente?"))return;
    PPStore.saveQuestions(normalizeOrder(PPStore.questions().filter(q=>q.id!==id)));
    questionModal.close();renderQuestions();ppToast("Questão excluída.");
  };

  document.querySelector("[data-new-question]").addEventListener("click",()=>openQuestionEditor());
  document.querySelector("[data-add-option]").addEventListener("click",()=>{addOptionRow();updateEditorVisibility();});
  editorForm.type.addEventListener("change",updateEditorVisibility);
  document.querySelector("[data-question-modal-close]").addEventListener("click",()=>questionModal.close());
  document.querySelector("[data-question-cancel]").addEventListener("click",()=>questionModal.close());
  document.querySelector("[data-delete-current]").addEventListener("click",deleteCurrent);

  const renderSettings=()=>{
    const s=PPStore.settings();
    document.querySelector("[name=recruitmentOpen]").checked=s.recruitmentOpen;
    document.querySelector("[name=minimumScore]").value=s.minimumScore;
    document.querySelector("[name=retryDays]").value=s.retryDays;
    document.querySelector("[name=showPublicReason]").checked=s.showPublicReason;
  };
  document.querySelector("#settings-form").addEventListener("submit",e=>{
    e.preventDefault();
    if(!PPStore.hasPermission("announcements_manage")){document.querySelector("[data-access-denied]").showModal();return;}
    const f=e.currentTarget;
    const oldSettings=PPStore.settings();
    PPStore.saveSettings({
      recruitmentOpen:f.recruitmentOpen.checked,
      minimumScore:Number(f.minimumScore.value),
      retryDays:Number(f.retryDays.value),
      showPublicReason:f.showPublicReason.checked
    });
    PPStore.addAudit("settings_updated","settings","recruitment",oldSettings,PPStore.settings());
    ppToast("Configurações salvas.");
  });
  document.querySelector("[data-clear-demo]").addEventListener("click",()=>{
    if(!PPStore.hasPermission("applications_delete")){document.querySelector("[data-access-denied]").showModal();return;}
    if(confirm("Deseja remover todas as inscrições locais?")){
      const oldData=PPStore.applications();
      PPStore.saveApplications([]);
      PPStore.addAudit("applications_cleared","applications","all",{count:oldData.length},{count:0});
      renderStats();renderTable();ppToast("Inscrições removidas.");
    }
  });
  document.querySelector("[data-search]").addEventListener("input",renderTable);
  document.querySelector("[data-filter]").addEventListener("change",renderTable);

  const permissionLabels={
    dashboard_view:["Ver dashboard","Acessar a visão geral."],
    candidates_view:["Ver candidatos","Visualizar inscrições e dados básicos."],
    candidates_review:["Analisar candidatos","Abrir respostas e observações."],
    candidates_approve:["Aprovar candidatos","Encaminhar candidatos para entrevista."],
    candidates_reject:["Reprovar candidatos","Registrar reprovação administrativa."],
    interviews_manage:["Gerenciar entrevistas","Visualizar e atualizar a etapa de entrevistas."],
    questions_view:["Ver questionário","Visualizar o banco de questões."],
    questions_manage:["Editar questionário","Criar, editar, excluir e ordenar questões."],
    settings_manage:["Alterar configurações","Modificar regras gerais do recrutamento."],
    staff_manage:["Gerenciar equipe","Adicionar, editar e remover integrantes."],
    audit_view:["Ver auditoria","Consultar o histórico de ações."],
    applications_delete:["Excluir inscrições","Limpar ou excluir dados de candidaturas."]
  };

  const staffModal=document.querySelector("[data-staff-modal]");
  const staffForm=document.querySelector("#staff-form");
  const permissionGrid=document.querySelector("[data-permission-grid]");

  const renderPermissionGrid=(permissions={})=>{
    permissionGrid.innerHTML=Object.entries(permissionLabels).map(([key,[title,description]])=>`
      <label class="permission-item">
        <input type="checkbox" name="permission_${key}" ${permissions[key]?"checked":""}>
        <span><strong>${title}</strong><small>${description}</small></span>
      </label>`).join("");
  };

  const collectPermissions=()=>Object.keys(permissionLabels).reduce((acc,key)=>{
    acc[key]=staffForm[`permission_${key}`].checked;
    return acc;
  },{});

  const applyRolePreset=()=>{
    const role=staffForm.role.value;
    renderPermissionGrid({...PPStore.defaultPermissions[role]});
  };

  const openStaffEditor=id=>{
    if(!PPStore.hasPermission("staff_manage"))return;
    const user=id?PPStore.users().find(u=>u.id===id):null;
    staffForm.reset();
    staffForm.id.value=user?.id||"";
    staffForm.name.value=user?.name||"";
    staffForm.username.value=user?.username||"";
    staffForm.email.value=user?.email||"";
    staffForm.discord.value=user?.discord||"";
    staffForm.role.value=user?.role||"recruiter";
    staffForm.password.value=user?.password||"";
    staffForm.active.checked=user?.active!==false;
    renderPermissionGrid(user?.permissions||PPStore.defaultPermissions[staffForm.role.value]);
    document.querySelector("[data-staff-modal-title]").textContent=user?"Editar integrante":"Adicionar integrante";
    document.querySelector("[data-delete-staff]").classList.toggle("hidden",!user||user.id===currentUser.id);
    staffModal.showModal();
  };

  const renderStaff=()=>{
    if(!PPStore.hasPermission("staff_manage"))return;
    document.querySelector("[data-staff-table]").innerHTML=PPStore.users().map(user=>`
      <tr>
        <td><div class="name-cell"><strong>${ppEscape(user.name)}</strong><small>${ppEscape(user.email)}</small></div></td>
        <td>${ppEscape(user.username)}</td>
        <td><span class="role-badge ${user.role==="admin"?"admin":user.role==="supervisor"?"supervisor":""}">${user.role==="admin"?"Administrador":user.role==="supervisor"?"Supervisor":"Recrutador"}</span></td>
        <td><span class="status-pill ${user.active?"approved":"rejected"}">${user.active?"Ativo":"Desativado"}</span></td>
        <td>${user.lastLogin?ppFormatDate(user.lastLogin):"Nunca"}</td>
        <td><button class="button secondary small" data-edit-staff="${user.id}">Editar</button></td>
      </tr>`).join("");
    document.querySelectorAll("[data-edit-staff]").forEach(button=>button.addEventListener("click",()=>openStaffEditor(button.dataset.editStaff)));
  };

  staffForm.addEventListener("submit",event=>{
    event.preventDefault();
    if(!PPStore.hasPermission("staff_manage"))return;
    const id=staffForm.id.value;
    const duplicate=PPStore.users().find(user=>user.username.toLowerCase()===staffForm.username.value.trim().toLowerCase()&&user.id!==id);
    if(duplicate){ppToast("Já existe um usuário com esse nome.");return;}
    const data={
      name:staffForm.name.value.trim(),username:staffForm.username.value.trim(),
      email:staffForm.email.value.trim(),discord:staffForm.discord.value.trim(),
      role:staffForm.role.value,password:staffForm.password.value,
      active:staffForm.active.checked,permissions:collectPermissions()
    };
    if(id) PPStore.updateStaffUser(id,data); else PPStore.createStaffUser(data);
    staffModal.close();renderStaff();renderAudit();ppToast("Integrante salvo.");
  });

  document.querySelector("[data-delete-staff]").addEventListener("click",()=>{
    const id=staffForm.id.value;
    if(!id||!confirm("Remover este integrante da equipe?"))return;
    const result=PPStore.deleteStaffUser(id);
    if(!result.ok){ppToast(result.reason==="self"?"Você não pode remover seu próprio usuário.":"Não foi possível remover.");return;}
    staffModal.close();renderStaff();renderAudit();ppToast("Integrante removido.");
  });

  staffForm.role.addEventListener("change",applyRolePreset);
  document.querySelector("[data-new-staff]").addEventListener("click",()=>openStaffEditor());
  document.querySelector("[data-staff-modal-close]").addEventListener("click",()=>staffModal.close());
  document.querySelector("[data-staff-cancel]").addEventListener("click",()=>staffModal.close());

  const renderAudit=()=>{
    if(!PPStore.hasPermission("audit_view"))return;
    const logs=PPStore.auditLogs();
    document.querySelector("[data-audit-table]").innerHTML=logs.map(log=>`
      <tr><td><div class="name-cell"><strong>${ppEscape(log.actorName)}</strong><small>${ppEscape(log.actorRole)}</small></div></td>
      <td>${ppEscape(log.action)}</td><td>${ppEscape(log.resourceType)} · ${ppEscape(log.resourceId||"-")}</td><td>${ppFormatDate(log.createdAt)}</td></tr>`).join("");
    document.querySelector("[data-audit-empty]").classList.toggle("hidden",logs.length>0);
  };

  const renderPhysicalTests=()=>{
    const apps=PPStore.applications().filter(app=>
      ["Aprovado no teste teórico","Aguardando teste físico","Aprovado no teste físico","Reprovado no teste físico"].includes(app.status)
    );
    document.querySelector("[data-physical-table]").innerHTML=apps.map(app=>`
      <tr><td><strong>${ppEscape(app.characterName)}</strong></td><td>${ppEscape(app.protocol)}</td>
      <td>${ppEscape(app.discord)}</td><td><span class="status-pill ${app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":""}">${ppEscape(app.status)}</span></td>
      <td>${ppEscape(app.physicalRecruiter||app.interviewRecruiter||"Não definido")}</td>
      <td><a class="button secondary small" href="candidato.html?id=${encodeURIComponent(app.id)}">Abrir</a></td></tr>`).join("");
    document.querySelector("[data-physical-empty]").classList.toggle("hidden",apps.length>0);
  };

  document.querySelector("[data-close-access-denied]").addEventListener("click",()=>document.querySelector("[data-access-denied]").close());


  const announcementModal=document.querySelector("[data-announcement-modal]");
  const announcementForm=document.querySelector("#announcement-form");

  const renderAnnouncements=()=>{
    if(!PPStore.hasPermission("announcements_manage"))return;
    const items=PPStore.announcements();
    const list=document.querySelector("[data-announcement-list]");
    list.innerHTML=items.map(item=>`
      <article class="question-editor-row">
        <div class="drag-handle">✦</div>
        <div>
          <span class="eyebrow">${ppEscape(item.audienceStatus)}</span>
          <h3>${ppEscape(item.title)}</h3>
          <p class="muted">${ppEscape(item.message)}</p>
          <div class="question-meta"><span>${item.active?"Ativo":"Inativo"}</span><span>${ppFormatDate(item.createdAt)}</span><span>${ppEscape(item.createdBy)}</span></div>
        </div>
        <div class="question-row-actions"><button class="button secondary small" type="button" data-edit-announcement="${item.id}">Editar</button></div>
      </article>`).join("");
    document.querySelector("[data-announcement-empty]").classList.toggle("hidden",items.length>0);
    list.querySelectorAll("[data-edit-announcement]").forEach(button=>button.addEventListener("click",()=>openAnnouncementEditor(button.dataset.editAnnouncement)));
  };

  const openAnnouncementEditor=id=>{
    if(!PPStore.hasPermission("settings_manage"))return;
    announcementForm.reset();
    const item=id?PPStore.announcements().find(a=>a.id===id):null;
    announcementForm.id.value=item?.id||"";
    announcementForm.title.value=item?.title||"";
    announcementForm.message.value=item?.message||"";
    announcementForm.audienceStatus.value=item?.audienceStatus||"Aprovado no teste teórico";
    announcementForm.active.checked=item?.active!==false;
    document.querySelector("[data-announcement-title]").textContent=item?"Editar aviso":"Novo aviso";
    document.querySelector("[data-delete-announcement]").classList.toggle("hidden",!item);
    announcementModal.showModal();
  };

  announcementForm.addEventListener("submit",event=>{
    event.preventDefault();
    const data={
      title:announcementForm.title.value.trim(),
      message:announcementForm.message.value.trim(),
      audienceStatus:announcementForm.audienceStatus.value,
      active:announcementForm.active.checked
    };
    const id=announcementForm.id.value;
    if(id)PPStore.updateAnnouncement(id,data);else PPStore.createAnnouncement(data);
    announcementModal.close();renderAnnouncements();renderAudit();ppToast("Aviso salvo.");
  });

  document.querySelector("[data-delete-announcement]").addEventListener("click",()=>{
    const id=announcementForm.id.value;
    if(!id||!confirm("Excluir este aviso?"))return;
    PPStore.deleteAnnouncement(id);announcementModal.close();renderAnnouncements();renderAudit();ppToast("Aviso excluído.");
  });

  document.querySelector("[data-new-announcement]").addEventListener("click",()=>openAnnouncementEditor());
  document.querySelector("[data-announcement-close]").addEventListener("click",()=>announcementModal.close());
  document.querySelector("[data-announcement-cancel]").addEventListener("click",()=>announcementModal.close());

  renderStats();renderTable();renderQuestions();renderSettings();
});
