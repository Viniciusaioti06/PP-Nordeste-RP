
document.addEventListener("DOMContentLoaded",()=>{
  const settings=PPStore.settings();
  const shell=document.querySelector("[data-form-shell]");
  if(!settings.recruitmentOpen){
    shell.innerHTML='<div class="empty-state"><h2>Recrutamento encerrado</h2><p>As inscrições estão temporariamente fechadas.</p></div>';
    return;
  }

  const form=document.querySelector("#recruitment-form");
  const dynamicContainer=document.querySelector("[data-dynamic-questions]");
  const activeQuestions=PPStore.questions().filter(q=>q.active).sort((a,b)=>a.order-b.order);
  renderDynamicQuestions(activeQuestions);

  const steps=[...document.querySelectorAll(".form-step")];
  const next=document.querySelector("[data-next]");
  const prev=document.querySelector("[data-prev]");
  const submit=document.querySelector("[data-submit]");
  const progress=document.querySelector("[data-progress]");
  const count=document.querySelector("[data-step-count]");
  let current=0;

  function renderDynamicQuestions(questions){
    const groups=[
      {key:"objective",title:"Conhecimento e conduta",description:"Escolha a alternativa mais compatível com os princípios da corporação."},
      {key:"eliminatory",title:"Critérios obrigatórios",description:"Algumas respostas podem eliminar automaticamente a candidatura."},
      {key:"open",title:"Situações e perfil",description:"Responda com suas próprias palavras. Estas respostas serão analisadas manualmente."}
    ];

    dynamicContainer.innerHTML=groups.map(group=>{
      const list=questions.filter(q=>q.type===group.key);
      if(!list.length) return "";
      return `<section class="form-step" data-question-group="${group.key}">
        <div class="step-heading"><span class="eyebrow">${ppEscape(group.title.toUpperCase())}</span>
        <h2>${ppEscape(group.title)}</h2><p>${ppEscape(group.description)}</p></div>
        ${list.map(renderQuestion).join("")}
      </section>`;
    }).join("");
  }

  function renderQuestion(q){
    const req=q.required?"required":"";
    if(q.type==="open"){
      return `<label class="field dynamic-question" data-question-id="${q.id}">
        <span>${ppEscape(q.title)}${q.required?" *":""}</span>
        ${q.description?`<small class="muted">${ppEscape(q.description)}</small>`:""}
        <textarea name="question_${q.id}" rows="6" minlength="${q.minLength||0}" ${req}></textarea>
        <small class="error"></small>
      </label><br>`;
    }
    return `<fieldset class="question-card dynamic-question" data-question-id="${q.id}">
      <legend>${ppEscape(q.title)}${q.required?" *":""}</legend>
      ${q.description?`<p class="muted">${ppEscape(q.description)}</p>`:""}
      ${(q.options||[]).map(opt=>`<label><input type="radio" name="question_${q.id}" value="${ppEscape(opt.id)}" ${req}> ${ppEscape(opt.label)}</label>`).join("")}
      <small class="error"></small>
    </fieldset>`;
  }

  const refreshedSteps=()=>[...document.querySelectorAll(".form-step")];

  const render=()=>{
    const all=refreshedSteps();
    all.forEach((s,i)=>s.classList.toggle("active",i===current));
    count.textContent=`${current+1} / ${all.length}`;
    progress.style.width=`${((current+1)/all.length)*100}%`;
    prev.disabled=current===0;
    next.classList.toggle("hidden",current===all.length-1);
    submit.classList.toggle("hidden",current!==all.length-1);
    if(current===all.length-1) renderReview();
    shell.scrollIntoView({behavior:"smooth",block:"start"});
  };

  const validate=()=>{
    const step=refreshedSteps()[current];
    let ok=true;
    step.querySelectorAll(".error").forEach(e=>e.textContent="");
    step.querySelectorAll("[required]").forEach(input=>{
      if(input.type==="radio") return;
      if(input.type==="checkbox"){
        if(!input.checked){ok=false;input.closest(".check-row").nextElementSibling.textContent="Confirmação obrigatória."}
        return;
      }
      if(!String(input.value).trim()){
        ok=false;input.closest(".field").querySelector(".error").textContent="Campo obrigatório.";
      }else if(input.minLength>0&&input.value.trim().length<input.minLength){
        ok=false;input.closest(".field").querySelector(".error").textContent=`Mínimo de ${input.minLength} caracteres.`;
      }
    });
    step.querySelectorAll("fieldset").forEach(fs=>{
      const required=fs.querySelector("input[required]");
      if(required&&!fs.querySelector("input:checked")){ok=false;fs.querySelector(".error").textContent="Selecione uma alternativa."}
    });
    return ok;
  };

  const renderReview=()=>{
    const d=Object.fromEntries(new FormData(form).entries());
    document.querySelector("[data-review]").innerHTML=`
      <div><span>Personagem</span><strong>${ppEscape(d.characterName)}</strong></div>
      <div><span>Passaporte</span><strong>${ppEscape(d.passport)}</strong></div>
      <div><span>Discord</span><strong>${ppEscape(d.discord)}</strong></div>
      <div><span>Disponibilidade</span><strong>${ppEscape(d.availability)}</strong></div>
      <div><span>Questões ativas</span><strong>${activeQuestions.length}</strong></div>
      <div><span>Tempo de cidade</span><strong>${ppEscape(d.cityTime)}</strong></div>`;
  };

  next.addEventListener("click",()=>{if(validate()){current++;render();}});
  prev.addEventListener("click",()=>{current--;render();});

  form.addEventListener("submit",e=>{
    e.preventDefault();if(!validate())return;
    const d=Object.fromEntries(new FormData(form).entries());
    let autoScore=0;
    let maxAutoScore=0;
    let eliminatory=false;
    const answers={};

    activeQuestions.forEach(q=>{
      const value=d[`question_${q.id}`]??"";
      if(q.type==="open"){
        answers[q.id]={question:q.title,type:q.type,value:String(value).trim(),manualCriteria:q.manualCriteria||"",maxPoints:q.points||0};
      }else{
        const option=(q.options||[]).find(o=>o.id===value);
        const points=Number(option?.points||0);
        autoScore+=points;
        maxAutoScore+=Number(q.points||0);
        if(q.type==="eliminatory"&&(q.eliminatoryOptions||[]).includes(value)) eliminatory=true;
        answers[q.id]={question:q.title,type:q.type,value,optionLabel:option?.label||"",points,maxPoints:q.points||0};
      }
    });

    const objectiveQuestions=activeQuestions.filter(q=>q.type==="objective");
    const objectiveMax=objectiveQuestions.reduce((sum,q)=>sum+Number(q.points||0),0);
    const lowScore=objectiveMax>0&&autoScore<Number(settings.minimumScore||0);
    const status=(eliminatory||lowScore)?"Reprovado automaticamente":"Em análise";
    const note=status.includes("Reprovado")?"A inscrição não avançou na triagem inicial.":"Sua inscrição foi recebida e aguarda análise da equipe.";
    const now=new Date().toISOString();
    const app={
      id:crypto.randomUUID?.()||String(Date.now()),protocol:PPStore.generateProtocol(),
      characterName:d.characterName.trim(),passport:d.passport.trim(),discord:d.discord.trim(),
      characterAge:Number(d.characterAge),cityTime:d.cityTime.trim(),availability:d.availability.trim(),
      experience:d.experience.trim(),answers,autoScore,manualScore:null,maxAutoScore,
      status,publicNote:note,reviewerNotes:"",createdAt:now,updatedAt:now,eliminatory,
      questionSnapshot:activeQuestions,timeline:[{status:"Inscrição enviada",date:now},{status:"Triagem automática",date:now},{status,date:now}]
    };
    PPStore.createApplication(app);
    document.querySelector("[data-protocol]").textContent=app.protocol;
    document.querySelector("#success-modal").showModal();
    form.reset();current=0;render();
  });

  document.querySelector("[data-close-modal]").addEventListener("click",()=>document.querySelector("#success-modal").close());
  render();
});
