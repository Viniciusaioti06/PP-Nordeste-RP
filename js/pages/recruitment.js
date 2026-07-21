
document.addEventListener("DOMContentLoaded", async () => {
  const shell = document.querySelector("[data-form-shell]");
  const form = document.querySelector("#recruitment-form");
  const dynamic = document.querySelector("[data-dynamic-questions]");
  let questions = [];
  let settings;

  try {
    requireConfig();
    [questions, settings] = await Promise.all([
      QuestionsService.publicList(),
      SettingsService.get()
    ]);
  } catch (err) {
    shell.innerHTML = `<div class="empty-state"><h2>Falha ao conectar</h2><p>${escapeHTML(err.message)}</p></div>`;
    return;
  }

  if (!settings.recruitment_open) {
    shell.innerHTML = '<div class="empty-state"><h2>Recrutamento encerrado</h2><p>As inscrições estão fechadas.</p></div>';
    return;
  }

  const renderQuestion = question => {
    const name = `question_${question.id}`;
    if (question.question_type === "open") {
      return `<label class="field"><span>${escapeHTML(question.title)}</span>
        <textarea name="${name}" rows="6" minlength="${question.min_length}" ${question.required?"required":""}></textarea>
        <small class="error"></small></label><br>`;
    }
    return `<fieldset class="question-card"><legend>${escapeHTML(question.title)}</legend>
      ${(question.options||[]).map(option => `<label><input type="radio" name="${name}" value="${escapeHTML(option.id)}" ${question.required?"required":""}> ${escapeHTML(option.label)}</label>`).join("")}
      <small class="error"></small></fieldset>`;
  };

  const groups = [
    ["objective","Conhecimento e conduta"],
    ["eliminatory","Critérios obrigatórios"],
    ["open","Situações e perfil"]
  ];
  dynamic.innerHTML = groups.map(([type,title]) => {
    const list = questions.filter(q=>q.question_type===type);
    if (!list.length) return "";
    return `<section class="form-step"><div class="step-heading"><span class="eyebrow">${title.toUpperCase()}</span><h2>${title}</h2></div>${list.map(renderQuestion).join("")}</section>`;
  }).join("");

  const steps = [...document.querySelectorAll(".form-step")];
  let current = 0;
  const next = document.querySelector("[data-next]");
  const prev = document.querySelector("[data-prev]");
  const submit = document.querySelector("[data-submit]");

  const render = () => {
    steps.forEach((step,index)=>step.classList.toggle("active",index===current));
    document.querySelector("[data-step-count]").textContent = `${current+1} / ${steps.length}`;
    document.querySelector("[data-progress]").style.width = `${(current+1)/steps.length*100}%`;
    prev.disabled = current===0;
    next.classList.toggle("hidden",current===steps.length-1);
    submit.classList.toggle("hidden",current!==steps.length-1);
  };

  const validate = () => {
    const step = steps[current];
    let valid = true;
    step.querySelectorAll(".error").forEach(el=>el.textContent="");
    step.querySelectorAll("[required]").forEach(input=>{
      if (input.type==="radio") return;
      if (input.type==="checkbox"&&!input.checked) {
        valid=false;
        input.closest(".check-row").nextElementSibling.textContent="Confirmação obrigatória.";
      } else if (!String(input.value).trim()) {
        valid=false;
        input.closest(".field")?.querySelector(".error") && (input.closest(".field").querySelector(".error").textContent="Campo obrigatório.");
      } else if (input.minLength>0&&input.value.trim().length<input.minLength) {
        valid=false;
        input.closest(".field").querySelector(".error").textContent=`Mínimo de ${input.minLength} caracteres.`;
      }
    });
    step.querySelectorAll("fieldset").forEach(fieldset=>{
      if (fieldset.querySelector("input[required]")&&!fieldset.querySelector("input:checked")) {
        valid=false;
        fieldset.querySelector(".error").textContent="Selecione uma alternativa.";
      }
    });
    return valid;
  };

  next.addEventListener("click",()=>{if(validate()){current++;render()}});
  prev.addEventListener("click",()=>{current--;render()});

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!validate()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    let autoScore=0, maxAutoScore=0, eliminatory=false;
    const answers={};

    questions.forEach(question=>{
      const value=values[`question_${question.id}`]??"";
      if(question.question_type==="open"){
        answers[question.id]={question:question.title,type:"open",value:String(value).trim(),manualCriteria:question.manual_criteria,maxPoints:question.points};
      }else{
        const option=(question.options||[]).find(item=>item.id===value);
        const points=Number(option?.points||0);
        autoScore+=points;
        if(question.question_type==="objective") maxAutoScore+=Number(question.points||0);
        if(question.question_type==="eliminatory"&&(question.eliminatory_options||[]).includes(value)) eliminatory=true;
        answers[question.id]={question:question.title,type:question.question_type,value,optionLabel:option?.label||"",points,maxPoints:question.points};
      }
    });

    const status = eliminatory || autoScore < settings.minimum_score ? "Reprovado automaticamente" : "Em análise";
    const now = new Date().toISOString();
    const payload = {
      protocol:`PP-${new Date().getFullYear()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6).padStart(6,"0")}`,
      character_name:values.characterName.trim(),
      passport:values.passport.trim(),
      discord:values.discord.trim(),
      character_age:Number(values.characterAge),
      city_time:values.cityTime.trim(),
      availability:values.availability.trim(),
      experience:values.experience.trim(),
      answers,
      automatic_score:autoScore,
      maximum_automatic_score:maxAutoScore,
      status,
      public_note:status==="Em análise"?"Sua inscrição aguarda análise da equipe.":"Sua inscrição não avançou na triagem inicial.",
      reviewer_notes:"",
      physical_recruiter:"",
      eliminatory_triggered:eliminatory,
      question_snapshot:questions,
      timeline:[
        {status:"Inscrição enviada",date:now},
        {status:"Triagem automática",date:now},
        {status,date:now}
      ]
    };

    try {
      const created = await ApplicationsService.submit(payload);
      document.querySelector("[data-protocol]").textContent = created.protocol;
      document.querySelector("#success-modal").showModal();
      form.reset();
      current=0;
      render();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.querySelector("[data-close-modal]").addEventListener("click",()=>document.querySelector("#success-modal").close());
  render();
});
