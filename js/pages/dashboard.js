
document.addEventListener("DOMContentLoaded",async()=>{
  let profile;
  try{profile=await Auth.requireStaff()}catch(err){alert(err.message);location.href="login.html";return}

  const permissionFor={
    visao:"dashboard_view",candidatos:"candidates_view",analises:"leadership_only",
    questoes:"questions_view",avisos:"announcements_manage",equipe:"staff_manage",
    auditoria:"audit_view",configuracoes:"settings_manage"
  };

  document.querySelector("[data-user-name]").textContent=profile.display_name;
  document.querySelector("[data-user-role]").textContent={admin:"Administrador",supervisor:"Supervisor",recruiter:"Recrutador"}[profile.role];
  document.querySelector("[data-user-avatar]").textContent=profile.display_name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
  document.querySelectorAll("[data-permission]").forEach(el=>{if(!profile.permissions?.[el.dataset.permission])el.hidden=true});
  document.querySelectorAll("[data-permission-action]").forEach(el=>{if(!profile.permissions?.[el.dataset.permissionAction])el.classList.add("hidden")});
  const isLeadership=["supervisor","admin"].includes(profile.role);
  document.querySelectorAll("[data-leadership-only]").forEach(el=>{if(!isLeadership)el.hidden=true});

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
    if(id==="analises"&&!isLeadership){showToast("Área exclusiva para supervisores e administradores.");return}
    if(permissionFor[id]&&permissionFor[id]!=="leadership_only"&&!profile.permissions?.[permissionFor[id]]){showToast("Acesso negado.");return}
    links.forEach(link=>link.classList.toggle("active",link.dataset.sectionLink===id));
    sections.forEach(section=>section.classList.toggle("active",section.id===id));
    if(id==="candidatos")await renderApplications();
    if(id==="analises")await renderReviewSupervision();
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
      <td>${escapeHTML(app.passport)}</td><td><strong>${app.maximum_automatic_score?Math.round(app.automatic_score/app.maximum_automatic_score*100):0}%</strong><small class="score-detail">${app.automatic_score}/${app.maximum_automatic_score}</small></td>
      <td><span class="status-pill ${app.status.includes("Aprovado")?"approved":app.status.includes("Reprovado")?"rejected":""}">${escapeHTML(app.status)}</span></td>
      <td>${formatDate(app.created_at)}</td><td><a class="button secondary small" href="candidato.html?id=${app.id}">Analisar</a></td></tr>`).join("");
    document.querySelector("[data-empty]").classList.toggle("hidden",list.length>0);
  };


  const REVIEW_CHECKLIST_TOTAL=7;
  let supervisionStaff=[];
  let supervisionRows=[];

  const reviewSnapshotsFor=app=>(app.timeline||[]).filter(event=>event?.type==="review_snapshot");
  const latestSnapshotFor=app=>reviewSnapshotsFor(app).at(-1)||null;
  const openAnswerCount=app=>Object.values(app.answers||{}).filter(answer=>answer?.type==="open").length;
  const snapshotCompletion=(app,snapshot)=>{
    if(!snapshot)return 0;
    const checklist=snapshot.data?.checklist||{};
    const questionReviews=snapshot.data?.questionReviews||{};
    const checklistDone=Object.values(checklist).filter(Boolean).length;
    const openTotal=openAnswerCount(app);
    const openDone=Object.values(questionReviews).filter(item=>item?.quality).length;
    const checklistPercent=checklistDone/REVIEW_CHECKLIST_TOTAL*100;
    const answerPercent=openTotal?Math.min(openDone/openTotal,1)*100:100;
    return Math.round((checklistPercent+answerPercent)/2);
  };
  const reviewStateLabel=value=>value>=95?"Completa":value>0?"Parcial":"Sem análise";
  const reviewStateClass=value=>value>=95?"complete":value>0?"partial":"none";

  const buildSupervisionRows=()=>applications.map(app=>{
    const snapshots=reviewSnapshotsFor(app);
    const snapshot=snapshots.at(-1)||null;
    const reviewerId=app.reviewer_id||snapshot?.actor_id||"";
    const staff=supervisionStaff.find(member=>member.id===reviewerId);
    const reviewerName=snapshot?.actor||staff?.display_name||"Não atribuído";
    const completion=snapshotCompletion(app,snapshot);
    return {app,snapshots,snapshot,reviewerId,reviewerName,completion};
  });

  const renderReviewSupervision=async()=>{
    if(!isLeadership)return;
    applications=await ApplicationsService.list();
    try{supervisionStaff=await StaffService.list()}catch{supervisionStaff=[]}
    supervisionRows=buildSupervisionRows();

    const allSnapshots=supervisionRows.flatMap(row=>row.snapshots.map(snapshot=>({...snapshot,app:row.app,reviewerName:snapshot.actor||row.reviewerName})));
    const reviewed=supervisionRows.filter(row=>row.snapshot);
    const average=reviewed.length?Math.round(reviewed.reduce((sum,row)=>sum+row.completion,0)/reviewed.length):0;
    document.querySelector("[data-reviews-total]").textContent=allSnapshots.length;
    document.querySelector("[data-reviewed-candidates]").textContent=reviewed.length;
    document.querySelector("[data-unreviewed-candidates]").textContent=supervisionRows.length-reviewed.length;
    document.querySelector("[data-review-completion]").textContent=`${average}%`;

    const grouped=new Map();
    reviewed.forEach(row=>{
      const key=row.reviewerId||row.reviewerName;
      if(!grouped.has(key))grouped.set(key,{name:row.reviewerName,count:0,total:0,complete:0,last:null});
      const item=grouped.get(key);item.count++;item.total+=row.completion;if(row.completion>=95)item.complete++;
      const date=row.snapshot?.date||row.app.updated_at;
      if(!item.last||new Date(date)>new Date(item.last))item.last=date;
    });
    const performance=[...grouped.values()].sort((a,b)=>b.count-a.count);
    const perfContainer=document.querySelector("[data-recruiter-performance]");
    perfContainer.innerHTML=performance.map(item=>{
      const avg=Math.round(item.total/item.count);
      return `<article class="recruiter-performance-item"><div class="recruiter-avatar">${escapeHTML(item.name.split(" ").map(part=>part[0]).slice(0,2).join("").toUpperCase())}</div><div class="recruiter-performance-copy"><header><strong>${escapeHTML(item.name)}</strong><span>${item.count} ${item.count===1?"análise":"análises"}</span></header><div class="review-progress"><span style="width:${avg}%"></span></div><small>${item.complete} completas • média de ${avg}% • última ${formatDate(item.last)}</small></div></article>`;
    }).join("");
    document.querySelector("[data-recruiter-empty]").classList.toggle("hidden",performance.length>0);

    const recent=allSnapshots.sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,7);
    document.querySelector("[data-review-feed]").innerHTML=recent.map(item=>`<button type="button" class="supervision-feed-item" data-inspect-review="${item.app.id}"><span class="feed-dot"></span><span><strong>${escapeHTML(item.reviewerName)}</strong> salvou uma análise de <b>${escapeHTML(item.app.character_name||"candidato")}</b><small>${formatDate(item.date)}</small></span></button>`).join("");
    document.querySelector("[data-review-feed-empty]").classList.toggle("hidden",recent.length>0);

    const recruiterSelect=document.querySelector("[data-review-recruiter]");
    const selected=recruiterSelect.value||"all";
    recruiterSelect.innerHTML='<option value="all">Todos os recrutadores</option>'+performance.map(item=>`<option value="${escapeHTML(item.name)}">${escapeHTML(item.name)}</option>`).join("");
    if([...recruiterSelect.options].some(option=>option.value===selected))recruiterSelect.value=selected;
    renderReviewTable();
  };

  const renderReviewTable=()=>{
    const term=(document.querySelector("[data-review-search]")?.value||"").toLowerCase();
    const state=document.querySelector("[data-review-status]")?.value||"all";
    const recruiter=document.querySelector("[data-review-recruiter]")?.value||"all";
    const rows=supervisionRows.filter(row=>{
      const stateClass=reviewStateClass(row.completion);
      return [row.app.character_name,row.app.passport,row.reviewerName].some(value=>String(value||"").toLowerCase().includes(term))&&(state==="all"||state===stateClass)&&(recruiter==="all"||row.reviewerName===recruiter);
    });
    document.querySelector("[data-review-table]").innerHTML=rows.map(row=>`<tr><td><div class="name-cell"><strong>${escapeHTML(row.app.character_name||"Sem nome")}</strong><small>${escapeHTML(row.app.passport||row.app.protocol||"")}</small></div></td><td>${row.snapshot?`<div class="name-cell"><strong>${escapeHTML(row.reviewerName)}</strong><small>${row.snapshots.length} ${row.snapshots.length===1?"versão":"versões"}</small></div>`:'<span class="muted">Não atribuído</span>'}</td><td><div class="table-review-progress"><div class="review-progress"><span style="width:${row.completion}%"></span></div><small>${row.completion}% • ${reviewStateLabel(row.completion)}</small></div></td><td><span class="review-state ${reviewStateClass(row.completion)}">${reviewStateLabel(row.completion)}</span></td><td>${row.snapshot?formatDate(row.snapshot.date):"—"}</td><td><div class="row-actions"><button class="button secondary small" type="button" data-inspect-review="${row.app.id}">${row.snapshot?"Revisar":"Ver candidato"}</button><a class="button ghost small" href="candidato.html?id=${row.app.id}">Dossiê</a></div></td></tr>`).join("");
    document.querySelector("[data-review-empty]").classList.toggle("hidden",rows.length>0);
  };

  const inspectReview=applicationId=>{
    const row=supervisionRows.find(item=>item.app.id===applicationId);
    if(!row)return;
    if(!row.snapshot){location.href=`candidato.html?id=${row.app.id}`;return}
    const data=row.snapshot.data||{};
    const checklist=data.checklist||{};
    const questionReviews=data.questionReviews||{};
    const checklistDone=Object.values(checklist).filter(Boolean).length;
    const qualities=Object.values(questionReviews).reduce((acc,item)=>{if(item?.quality)acc[item.quality]=(acc[item.quality]||0)+1;return acc},{});
    const modal=document.querySelector("[data-review-inspection-modal]");
    document.querySelector("[data-review-inspection-content]").innerHTML=`<span class="eyebrow">PARECER DO RECRUTADOR</span><h2>${escapeHTML(row.app.character_name||"Candidato")}</h2><p class="muted">Analisado por ${escapeHTML(row.reviewerName)} em ${formatDate(row.snapshot.date)}.</p><div class="inspection-summary"><div><span>Conclusão</span><strong>${row.completion}%</strong></div><div><span>Checklist</span><strong>${checklistDone}/${REVIEW_CHECKLIST_TOTAL}</strong></div><div><span>Respostas avaliadas</span><strong>${Object.values(questionReviews).filter(item=>item?.quality).length}/${openAnswerCount(row.app)}</strong></div><div><span>Versões salvas</span><strong>${row.snapshots.length}</strong></div></div><div class="inspection-block"><h3>Distribuição qualitativa</h3><div class="quality-summary">${["Excelente","Boa","Regular","Fraca"].map(label=>`<span><b>${qualities[label]||0}</b>${label}</span>`).join("")}</div></div><div class="inspection-block"><h3>Parecer geral</h3><p class="inspection-note">${escapeHTML(row.app.reviewer_notes||"Nenhuma observação geral registrada.")}</p></div><div class="modal-actions"><a class="button primary" href="candidato.html?id=${row.app.id}">Abrir dossiê completo</a><button class="button secondary" value="cancel">Fechar</button></div>`;
    modal.showModal();
  };

  document.querySelector("[data-refresh-reviews]")?.addEventListener("click",renderReviewSupervision);
  document.querySelector("[data-review-search]")?.addEventListener("input",renderReviewTable);
  document.querySelector("[data-review-status]")?.addEventListener("change",renderReviewTable);
  document.querySelector("[data-review-recruiter]")?.addEventListener("change",renderReviewTable);
  document.addEventListener("click",event=>{const target=event.target.closest("[data-inspect-review]");if(target)inspectReview(target.dataset.inspectReview)});



  let questions=[];
  let draggedQuestionId=null;
  let questionOrderSaving=false;

  const persistQuestionOrder=async()=>{
    if(questionOrderSaving)return;
    questionOrderSaving=true;
    const list=document.querySelector("[data-question-list]");
    list?.classList.add("is-saving");
    try{
      await QuestionsService.saveOrder(questions);
      try{await AuditService.write("questions_reordered","questionnaire",null,null,{order:questions.map(q=>q.id)})}catch{}
      showToast("Ordem das questões atualizada.");
    }catch(error){
      console.error(error);
      showToast("Não foi possível salvar a nova ordem.");
      await renderQuestions();
    }finally{
      questionOrderSaving=false;
      list?.classList.remove("is-saving");
    }
  };

  const moveQuestion=async(id,direction)=>{
    if(!profile.permissions.questions_manage||questionOrderSaving)return;
    const from=questions.findIndex(question=>question.id===id);
    const to=from+direction;
    if(from<0||to<0||to>=questions.length)return;
    [questions[from],questions[to]]=[questions[to],questions[from]];
    renderQuestionRows();
    await persistQuestionOrder();
  };

  const reorderQuestion=async(sourceId,targetId,placeAfter=false)=>{
    if(!profile.permissions.questions_manage||questionOrderSaving||sourceId===targetId)return;
    const from=questions.findIndex(question=>question.id===sourceId);
    let to=questions.findIndex(question=>question.id===targetId);
    if(from<0||to<0)return;
    const [moved]=questions.splice(from,1);
    to=questions.findIndex(question=>question.id===targetId);
    questions.splice(to+(placeAfter?1:0),0,moved);
    renderQuestionRows();
    await persistQuestionOrder();
  };

  const renderQuestionRows=()=>{
    const list=document.querySelector("[data-question-list]");
    list.innerHTML=questions.map((q,index)=>`<article class="question-editor-row" data-question-row="${q.id}" draggable="${profile.permissions.questions_manage?'true':'false'}">
      <button class="drag-handle" type="button" aria-label="Arrastar questão ${index+1} para reorganizar" title="Arraste para reorganizar" ${profile.permissions.questions_manage?'':'disabled'}>⋮⋮</button>
      <div><span class="eyebrow">${escapeHTML(q.category)}</span><h3>${index+1}. ${escapeHTML(q.title)}</h3>
      <div class="question-meta"><span>${q.question_type}</span><span>${q.points} pontos</span><span>${q.active?"Ativa":"Inativa"}</span></div></div>
      <div class="question-row-actions">
        ${profile.permissions.questions_manage?`<div class="order-buttons" aria-label="Alterar posição"><button class="icon-button order-button" type="button" data-move-question="up" data-question-id="${q.id}" ${index===0?'disabled':''} aria-label="Mover para cima">↑</button><button class="icon-button order-button" type="button" data-move-question="down" data-question-id="${q.id}" ${index===questions.length-1?'disabled':''} aria-label="Mover para baixo">↓</button></div><button class="button secondary small" data-edit-question="${q.id}">Editar</button>`:""}
      </div></article>`).join("");
    document.querySelector("[data-question-empty]").classList.toggle("hidden",questions.length>0);

    list.querySelectorAll("[data-edit-question]").forEach(btn=>btn.addEventListener("click",()=>openQuestion(btn.dataset.editQuestion)));
    list.querySelectorAll("[data-move-question]").forEach(btn=>btn.addEventListener("click",()=>moveQuestion(btn.dataset.questionId,btn.dataset.moveQuestion==="up"?-1:1)));

    list.querySelectorAll("[data-question-row]").forEach(row=>{
      row.addEventListener("dragstart",event=>{
        if(!profile.permissions.questions_manage||questionOrderSaving){event.preventDefault();return}
        draggedQuestionId=row.dataset.questionRow;
        row.classList.add("is-dragging");
        event.dataTransfer.effectAllowed="move";
        event.dataTransfer.setData("text/plain",draggedQuestionId);
      });
      row.addEventListener("dragover",event=>{
        if(!draggedQuestionId||draggedQuestionId===row.dataset.questionRow)return;
        event.preventDefault();
        event.dataTransfer.dropEffect="move";
        list.querySelectorAll(".drag-over-before,.drag-over-after").forEach(item=>item.classList.remove("drag-over-before","drag-over-after"));
        const rect=row.getBoundingClientRect();
        row.classList.add(event.clientY>rect.top+rect.height/2?"drag-over-after":"drag-over-before");
      });
      row.addEventListener("drop",async event=>{
        event.preventDefault();
        const rect=row.getBoundingClientRect();
        const after=event.clientY>rect.top+rect.height/2;
        const sourceId=draggedQuestionId||event.dataTransfer.getData("text/plain");
        list.querySelectorAll(".drag-over-before,.drag-over-after").forEach(item=>item.classList.remove("drag-over-before","drag-over-after"));
        await reorderQuestion(sourceId,row.dataset.questionRow,after);
      });
      row.addEventListener("dragend",()=>{
        draggedQuestionId=null;
        list.querySelectorAll(".is-dragging,.drag-over-before,.drag-over-after").forEach(item=>item.classList.remove("is-dragging","drag-over-before","drag-over-after"));
      });
    });
  };

  const renderQuestions=async()=>{
    questions=await QuestionsService.staffList();
    renderQuestionRows();
  };

  const questionModal=document.querySelector("[data-question-modal]");
  const questionForm=document.querySelector("#question-editor-form");
  const optionList=document.querySelector("[data-option-list]");
  const addOption=(option={})=>{
    const row=document.createElement("div");row.className="option-editor-row";row.dataset.id=option.id||crypto.randomUUID();
    row.innerHTML=`<input type="text" data-label value="${escapeHTML(option.label||"")}" placeholder="Alternativa"><input type="number" data-points value="${option.points||0}" min="0"><label class="option-check"><input type="radio" name="correct" ${option.correct?"checked":""}> Correta</label><label class="option-check"><input type="checkbox" data-eliminatory ${option.eliminatory?"checked":""}> Elimina</label><button class="icon-button" type="button">×</button>`;
    row.querySelector("button").addEventListener("click",()=>row.remove());optionList.appendChild(row);
  };

  const syncQuestionEditor=()=>{
    const type=questionForm.type.value;
    const isOpen=type==="open";
    const isObjective=type==="objective";
    const scoringSection=document.querySelector("[data-scoring-section]");
    const openSettings=document.querySelector("[data-open-settings]");
    const optionsEditor=document.querySelector("[data-options-editor]");
    const guideTitle=document.querySelector("[data-type-guide-title]");
    const guideText=document.querySelector("[data-type-guide-text]");
    const optionsHelp=document.querySelector("[data-options-help]");
    const finalStep=document.querySelector("[data-final-step]");

    scoringSection?.classList.toggle("hidden",!isObjective);
    openSettings?.classList.toggle("hidden",!isOpen);
    optionsEditor?.classList.toggle("hidden",isOpen);
    if(finalStep)finalStep.textContent=isOpen?"3":"4";

    const guides={
      objective:["Questão objetiva","O candidato escolhe uma alternativa. Os pontos são convertidos para a nota automática de 0 a 10."],
      eliminatory:["Questão eliminatória","Uma alternativa marcada como eliminatória reprova o candidato independentemente da nota."],
      open:["Questão aberta","A resposta será lida pelo recrutador e não terá pontuação automática."]
    };
    const [title,text]=guides[type]||guides.objective;
    if(guideTitle)guideTitle.textContent=title;
    if(guideText)guideText.textContent=text;
    if(optionsHelp)optionsHelp.textContent=isObjective
      ?"Cadastre as opções e informe quantos pontos cada resposta concede."
      :"Cadastre as opções e marque somente as respostas que devem eliminar o candidato.";

    optionList.querySelectorAll("[data-points]").forEach(input=>{
      input.closest(".option-editor-row")?.classList.toggle("hide-option-points",!isObjective);
      input.disabled=!isObjective;
      if(!isObjective)input.value=0;
    });
    optionList.querySelectorAll('input[name="correct"]').forEach(input=>{
      input.closest(".option-check")?.classList.toggle("hidden",!isObjective);
    });
    optionList.querySelectorAll("[data-eliminatory]").forEach(input=>{
      input.closest(".option-check")?.classList.toggle("hidden",type!=="eliminatory");
      if(type!=="eliminatory")input.checked=false;
    });
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
    syncQuestionEditor();
    questionModal.showModal();
  };
  document.querySelector("[data-new-question]")?.addEventListener("click",()=>openQuestion());
  document.querySelector("[data-add-option]")?.addEventListener("click",()=>{addOption();syncQuestionEditor()});
  questionForm?.type.addEventListener("change",syncQuestionEditor);
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
      order_position:existing?.order_position||questions.length+1,
      points:questionForm.type.value==="objective"?Number(questionForm.points.value||0):0,
      options:questionForm.type.value==="open"?[]:options.map(({correct,eliminatory,...rest})=>({
        ...rest,points:questionForm.type.value==="objective"?rest.points:0
      })),
      correct_option:questionForm.type.value==="objective"?(options.find(o=>o.correct)?.id||null):null,
      eliminatory_options:questionForm.type.value==="eliminatory"?options.filter(o=>o.eliminatory).map(o=>o.id):[],
      min_length:questionForm.type.value==="open"?Number(questionForm.minLength.value||0):0,
      manual_criteria:questionForm.type.value==="open"?questionForm.manualCriteria.value.trim():""
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
    form.minimumScore.value=item.minimum_score ?? 7;
    updateMinimumScoreStatus(item.minimum_score ?? 7);
    form.retryDays.value=item.retry_days;
    form.showPublicReason.checked=item.show_public_reason;
  };
  const updateMinimumScoreStatus=value=>{
    const status=document.querySelector("[data-minimum-score-status]");
    if(status)status.textContent=`Regra atual: mínimo de ${Number(value).toFixed(1).replace(".",",")} em 10 pontos.`;
  };
  document.querySelector("#settings-form")?.minimumScore?.addEventListener("input",event=>updateMinimumScoreStatus(event.target.value||0));
  document.querySelector("#settings-form")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const minimumScore=Number(form.minimumScore.value);
    const error=document.querySelector("[data-minimum-score-error]");
    if(!Number.isFinite(minimumScore)||minimumScore<0||minimumScore>10){
      if(error)error.textContent="Informe uma nota entre 0 e 10.";
      form.minimumScore.focus();
      return;
    }
    if(error)error.textContent="";
    const button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    button.textContent="Salvando...";
    try{
      const saved=await SettingsService.save({recruitment_open:form.recruitmentOpen.checked,minimum_score:minimumScore,retry_days:Number(form.retryDays.value),show_public_reason:form.showPublicReason.checked});
      form.minimumScore.value=saved.minimum_score;
      updateMinimumScoreStatus(saved.minimum_score);
      showToast("Configurações salvas. A nova nota mínima já está ativa.");
    }catch(error){
      showToast(error.message||"Não foi possível salvar as configurações.");
    }finally{
      button.disabled=false;
      button.textContent="Salvar configurações";
    }
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
