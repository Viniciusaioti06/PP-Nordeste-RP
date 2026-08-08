document.addEventListener("DOMContentLoaded", async () => {
  const page = document.querySelector("[data-page]");
  let profile;

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value ?? "—";
  };

  const safeStatus = value => String(value || "Em análise");

  // Mantém compatibilidade com inscrições antigas e com qualquer variação de
  // formato que possa existir no JSON de answers. O snapshot da prova é usado
  // como fonte complementar para nunca perder a pergunta no dossiê.
  const normalizeAnswers = app => {
    const raw = app?.answers;
    const snapshot = Array.isArray(app?.question_snapshot) ? app.question_snapshot : [];
    const entries = [];

    if (Array.isArray(raw)) {
      raw.forEach((answer, index) => {
        const questionId = String(answer?.questionId || answer?.id || snapshot[index]?.id || `legacy-${index}`);
        entries.push([questionId, answer || {}]);
      });
    } else if (raw && typeof raw === "object") {
      Object.entries(raw).forEach(([questionId, answer]) => entries.push([String(questionId), answer || {}]));
    }

    const byId = new Map(entries);

    snapshot.forEach((question, index) => {
      const questionId = String(question?.id || `snapshot-${index}`);
      const existing = byId.get(questionId) || {};
      const answerValue = existing.value ?? existing.answer ?? existing.response ?? "";
      const selectedOption = (question.options || []).find(option => option.id === answerValue);

      byId.set(questionId, {
        question: existing.question || question.title || "Questão sem título",
        type: existing.type || question.question_type || "objective",
        value: answerValue,
        optionLabel: existing.optionLabel || selectedOption?.label || "",
        points: existing.points,
        maxPoints: existing.maxPoints ?? question.points,
        manualCriteria: existing.manualCriteria || question.manual_criteria || "",
        ...existing,
      });
    });

    return [...byId.entries()];
  };

  try {
    profile = await Auth.requireStaff("candidates_review");
  } catch (error) {
    alert(error.message);
    location.href = "dashboard.html";
    return;
  }

  const id = new URLSearchParams(location.search).get("id");
  let app;

  try {
    app = await ApplicationsService.getById(id);
  } catch (error) {
    page.innerHTML = `<div class="empty-state"><h2>Falha ao carregar o dossiê</h2><p>${escapeHTML(error.message)}</p><a class="button secondary" href="dashboard.html#candidatos">Voltar ao painel</a></div>`;
    return;
  }

  if (!app) {
    page.innerHTML = '<div class="empty-state"><h2>Candidato não encontrado</h2><p>Esta inscrição não existe ou foi removida.</p><a class="button secondary" href="dashboard.html#candidatos">Voltar ao painel</a></div>';
    return;
  }

  const checklistDefinitions = [
    ["maturity", "Demonstra maturidade", "Respostas equilibradas e postura compatível com a função."],
    ["hierarchy", "Compreende hierarquia", "Reconhece cadeia de comando, disciplina e responsabilidade."],
    ["writing", "Boa comunicação escrita", "Clareza, organização e linguagem adequada nas respostas."],
    ["coherence", "Coerência nas respostas", "As informações apresentadas não se contradizem."],
    ["serious_rp", "Demonstra RP sério", "Entende o compromisso e evita condutas incompatíveis."],
    ["conduct", "Conduta adequada", "Não apresenta conteúdo ofensivo, provocativo ou impróprio."],
    ["knowledge", "Conhecimento básico", "Demonstra estudo do edital, códigos e procedimentos."],
  ];

  const timeline = Array.isArray(app.timeline) ? app.timeline : [];
  const reviewEvents = timeline.filter(event => event?.type === "review_snapshot");
  const latestReview = reviewEvents.at(-1)?.data || {};
  const reviewState = {
    checklist: { ...(latestReview.checklist || {}) },
    questionReviews: { ...(latestReview.questionReviews || {}) },
  };

  const answerEntries = normalizeAnswers(app);
  const openAnswers = answerEntries.filter(([, answer]) => answer?.type === "open");
  let dirty = false;

  const scoreMaximum = Number(app.maximum_automatic_score || 0);
  const scoreValue = Number(app.automatic_score || 0);
  const scorePercent = scoreMaximum > 0
    ? Math.max(0, Math.min(100, Math.round((scoreValue / scoreMaximum) * 100)))
    : 0;
  const currentStatus = safeStatus(app.status);
  const statusClass = currentStatus.includes("Aprovado") ? "approved" : currentStatus.includes("Reprovado") ? "rejected" : "";

  setText("[data-name]", app.character_name || "Candidato sem nome");
  setText("[data-protocol]", app.protocol);
  setText("[data-passport]", app.passport);
  setText("[data-discord]", app.discord);
  setText("[data-character-age]", app.character_age ? `${app.character_age} anos` : "Não informado");
  setText("[data-city-time]", app.city_time || "Não informado");
  setText("[data-availability]", app.availability || "Não informado");
  setText("[data-experience]", app.experience || "Não informado");
  setText("[data-created]", formatDate(app.created_at));
  setText("[data-updated]", formatDate(app.updated_at || app.created_at));
  setText("[data-score]", `${scoreValue}/${scoreMaximum} pontos`);
  setText("[data-score-percent]", `${scorePercent}%`);
  setText("[data-decision-status]", currentStatus);
  setText("[data-eliminatory]", app.eliminatory_triggered ? "Ocorrência identificada" : "Nenhuma ocorrência");

  const statusElement = document.querySelector("[data-status]");
  if (statusElement) {
    statusElement.textContent = currentStatus;
    if (statusClass) statusElement.classList.add(statusClass);
  }

  const scoreRing = document.querySelector("[data-score-ring]");
  scoreRing?.style.setProperty("--score", scorePercent);

  const elapsedMs = Date.now() - new Date(app.created_at).getTime();
  const elapsedHours = Math.max(0, Math.floor(elapsedMs / 3600000));
  const elapsedDays = Math.floor(elapsedHours / 24);
  setText("[data-process-time]", elapsedDays > 0 ? `${elapsedDays} ${elapsedDays === 1 ? "dia" : "dias"}` : `${elapsedHours} ${elapsedHours === 1 ? "hora" : "horas"}`);

  const riskScore = (app.eliminatory_triggered ? 3 : 0) + (scorePercent < 70 ? 2 : scorePercent < 85 ? 1 : 0) + (String(app.experience || "").trim().length < 20 ? 1 : 0);
  const risk = riskScore >= 3 ? ["Alto", "high", "Requer análise cuidadosa"] : riskScore >= 1 ? ["Moderado", "medium", "Existem pontos para conferência"] : ["Baixo", "low", "Nenhum alerta relevante"];
  const riskElement = document.querySelector("[data-risk]");
  if (riskElement) {
    riskElement.textContent = risk[0];
    riskElement.classList.add(risk[1]);
  }
  setText("[data-risk-detail]", risk[2]);

  const notes = document.querySelector("[data-notes]");
  if (notes) {
    notes.value = app.reviewer_notes || "";
    notes.addEventListener("input", markDirty);
  }

  const checklistContainer = document.querySelector("[data-checklist]");
  if (checklistContainer) {
    checklistContainer.innerHTML = checklistDefinitions.map(([key, title, description]) => `
      <label class="evaluation-item ${reviewState.checklist[key] ? "checked" : ""}" data-check-item="${key}">
        <input type="checkbox" ${reviewState.checklist[key] ? "checked" : ""}>
        <span class="evaluation-check">${reviewState.checklist[key] ? "✓" : ""}</span>
        <span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></span>
      </label>
    `).join("");

    checklistContainer.querySelectorAll("[data-check-item]").forEach(label => {
      const input = label.querySelector("input");
      input.addEventListener("change", () => {
        reviewState.checklist[label.dataset.checkItem] = input.checked;
        label.classList.toggle("checked", input.checked);
        label.querySelector(".evaluation-check").textContent = input.checked ? "✓" : "";
        updateReviewSummary();
        markDirty();
      });
    });
  }

  function updateReviewSummary() {
    const checked = Object.values(reviewState.checklist).filter(Boolean).length;
    const reviewed = openAnswers.filter(([questionId]) => reviewState.questionReviews[questionId]?.quality).length;
    setText("[data-checklist-score]", `${checked}/${checklistDefinitions.length}`);
    setText("[data-decision-checklist]", `${checked}/${checklistDefinitions.length}`);
    setText("[data-reviewed-answers]", `${reviewed}/${openAnswers.length}`);
    const progress = document.querySelector("[data-checklist-progress]");
    if (progress) progress.style.width = `${checked / checklistDefinitions.length * 100}%`;
  }

  const typeLabels = { open: "Aberta", objective: "Objetiva", eliminatory: "Eliminatória" };
  const answersContainer = document.querySelector("[data-answers]");

  if (answersContainer) {
    answersContainer.innerHTML = answerEntries.length ? answerEntries.map(([questionId, answer], index) => {
      const review = reviewState.questionReviews[questionId] || {};
      const response = answer.optionLabel || answer.value || answer.answer || answer.response || "Não respondida";
      const criteria = answer.manualCriteria || "Avalie clareza, coerência, maturidade e adequação ao contexto apresentado.";
      const isOpen = answer.type === "open";
      const hasPoints = answer.points !== undefined && answer.points !== null && answer.points !== "";
      const hasMaxPoints = answer.maxPoints !== undefined && answer.maxPoints !== null && answer.maxPoints !== "";
      return `
        <article class="premium-answer" data-answer-type="${escapeHTML(answer.type || "objective")}" data-question-id="${escapeHTML(questionId)}">
          <header class="answer-top">
            <span class="answer-number">${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHTML(answer.question || "Questão sem título")}</h3>
            <span class="answer-type">${escapeHTML(typeLabels[answer.type] || "Questão")}</span>
          </header>
          <div class="answer-content">
            <div class="candidate-response">${escapeHTML(response)}</div>
            <div class="answer-facts">
              ${hasMaxPoints ? `<span>Valor máximo: ${Number(answer.maxPoints || 0)} ponto(s)</span>` : ""}
              ${hasPoints ? `<span>Pontuação obtida: ${Number(answer.points || 0)}</span>` : ""}
              ${answer.type === "eliminatory" ? `<span>${app.eliminatory_triggered ? "Alerta eliminatório registrado" : "Sem alerta nesta triagem"}</span>` : ""}
            </div>
            ${isOpen ? `
              <div class="expected-criteria"><strong>Critérios esperados</strong><p>${escapeHTML(criteria)}</p></div>
              <div class="answer-review-panel">
                <span>Avaliação qualitativa</span>
                <div class="quality-options">
                  ${["Excelente", "Boa", "Regular", "Fraca"].map(quality => `<button type="button" class="${review.quality === quality ? "active" : ""}" data-quality="${quality}">${quality}</button>`).join("")}
                </div>
                <textarea class="answer-review-note" placeholder="Observação específica desta resposta...">${escapeHTML(review.note || "")}</textarea>
              </div>
            ` : ""}
          </div>
        </article>
      `;
    }).join("") : '<div class="empty-state"><h3>Nenhuma questão encontrada</h3><p>Esta inscrição não possui respostas nem um snapshot do questionário.</p></div>';

    answersContainer.querySelectorAll(".premium-answer").forEach(card => {
      const questionId = card.dataset.questionId;
      const qualityButtons = card.querySelectorAll("[data-quality]");
      qualityButtons.forEach(button => button.addEventListener("click", () => {
        reviewState.questionReviews[questionId] ||= {};
        reviewState.questionReviews[questionId].quality = button.dataset.quality;
        qualityButtons.forEach(item => item.classList.toggle("active", item === button));
        updateReviewSummary();
        markDirty();
      }));
      const note = card.querySelector(".answer-review-note");
      note?.addEventListener("input", () => {
        reviewState.questionReviews[questionId] ||= {};
        reviewState.questionReviews[questionId].note = note.value;
        markDirty();
      });
    });
  }

  document.querySelectorAll("[data-answer-filter]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-answer-filter]").forEach(item => item.classList.toggle("active", item === button));
      const filter = button.dataset.answerFilter;
      answersContainer?.querySelectorAll(".premium-answer").forEach(card => {
        card.hidden = filter !== "all" && card.dataset.answerType !== filter;
      });
    });
  });

  const timelineContainer = document.querySelector("[data-timeline]");
  const visibleTimeline = timeline.filter(event => event?.type !== "review_snapshot");
  if (timelineContainer) {
    timelineContainer.innerHTML = visibleTimeline.length ? visibleTimeline.map((event, index) => `
      <div class="timeline-entry">
        <span class="timeline-dot">${index === visibleTimeline.length - 1 ? "●" : "✓"}</span>
        <div class="timeline-copy"><strong>${escapeHTML(event.status || event.action || "Atualização do processo")}</strong><small>${formatDate(event.date || event.created_at)}${event.actor ? ` • ${escapeHTML(event.actor)}` : ""}</small></div>
      </div>
    `).join("") : '<div class="empty-state">Ainda não há eventos registrados.</div>';
  }

  function markDirty() {
    dirty = true;
    const indicator = document.querySelector("[data-save-indicator]");
    if (!indicator) return;
    indicator.textContent = "Alterações não salvas";
    indicator.classList.add("visible", "saving");
  }

  async function saveReview(showFeedback = true) {
    const indicator = document.querySelector("[data-save-indicator]");
    if (indicator) {
      indicator.textContent = "Salvando análise...";
      indicator.classList.add("visible", "saving");
    }

    const snapshot = {
      type: "review_snapshot",
      date: new Date().toISOString(),
      actor: profile.display_name,
      actor_id: profile.id,
      data: {
        checklist: reviewState.checklist,
        questionReviews: reviewState.questionReviews,
      },
    };

    app = await ApplicationsService.update(app.id, {
      reviewer_notes: notes?.value.trim() || "",
      reviewer_id: profile.id,
      timeline: [...(Array.isArray(app.timeline) ? app.timeline : []), snapshot],
    });

    dirty = false;
    if (indicator) {
      indicator.textContent = "Alterações salvas";
      indicator.classList.remove("saving");
      setTimeout(() => indicator.classList.remove("visible"), 2200);
    }
    if (showFeedback) showToast("Análise salva com sucesso.");
  }

  document.querySelector("[data-save-review]")?.addEventListener("click", async () => {
    try {
      await saveReview();
    } catch (error) {
      showToast(error.message || "Não foi possível salvar.");
    }
  });

  async function decide(approved) {
    const permission = approved ? "candidates_approve" : "candidates_reject";
    if (!profile.permissions?.[permission]) {
      showToast(`Seu perfil não possui a permissão necessária: ${approved ? "aprovar" : "reprovar"} candidatos.`);
      return;
    }

    const confirmed = confirm(approved
      ? "Confirmar aprovação do candidato no teste teórico?"
      : "Confirmar reprovação do candidato no teste teórico?");
    if (!confirmed) return;

    try {
      if (dirty) await saveReview(false);
      const status = approved ? "Aprovado no teste teórico" : "Reprovado no teste teórico";
      app = await ApplicationsService.update(app.id, {
        status,
        reviewer_notes: notes?.value.trim() || "",
        reviewer_id: profile.id,
        physical_recruiter: approved ? profile.display_name : app.physical_recruiter,
        public_note: approved
          ? "Parabéns, você foi aprovado no teste teórico. Fique atento ao Discord para o teste físico coletivo."
          : "Sua inscrição não foi aprovada no teste teórico.",
        timeline: [...(Array.isArray(app.timeline) ? app.timeline : []), { status, date: new Date().toISOString(), actor: profile.display_name }],
      });
      try {
        await AuditService.write(approved ? "theoretical_approved" : "theoretical_rejected", "application", app.id, null, { status });
      } catch (auditError) {
        console.warn("Não foi possível registrar a auditoria da decisão:", auditError);
      }
      showToast("Decisão registrada.");
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      showToast(error.message || "Não foi possível registrar a decisão.");
    }
  }

  async function physicalDecision(passed) {
    if (!profile.permissions?.interviews_manage) {
      showToast("Você não possui permissão para gerenciar a etapa física.");
      return;
    }
    if (!["Aprovado no teste teórico", "Aguardando teste físico", "Aprovado no teste físico", "Reprovado no teste físico"].includes(safeStatus(app.status))) {
      showToast("O candidato ainda não está habilitado para a etapa física.");
      return;
    }
    const confirmed = confirm(passed ? "Confirmar aprovação no teste físico?" : "Confirmar reprovação no teste físico?");
    if (!confirmed) return;

    try {
      if (dirty) await saveReview(false);
      const status = passed ? "Aprovado no teste físico" : "Reprovado no teste físico";
      app = await ApplicationsService.update(app.id, {
        status,
        physical_recruiter: profile.display_name,
        public_note: passed ? "Você foi aprovado no teste físico. Aguarde o curso de formação." : "Você não foi aprovado no teste físico.",
        timeline: [...(Array.isArray(app.timeline) ? app.timeline : []), { status, date: new Date().toISOString(), actor: profile.display_name }],
      });
      try {
        await AuditService.write(passed ? "physical_approved" : "physical_rejected", "application", app.id, null, { status });
      } catch (auditError) {
        console.warn("Não foi possível registrar a auditoria da etapa física:", auditError);
      }
      showToast("Resultado físico registrado.");
      setTimeout(() => location.reload(), 500);
    } catch (error) {
      showToast(error.message || "Não foi possível registrar o resultado.");
    }
  }

  document.querySelector("[data-approve]")?.addEventListener("click", () => decide(true));
  document.querySelector("[data-reject]")?.addEventListener("click", () => decide(false));
  document.querySelector("[data-physical-approve]")?.addEventListener("click", () => physicalDecision(true));
  document.querySelector("[data-physical-reject]")?.addEventListener("click", () => physicalDecision(false));
  document.querySelector("[data-back]")?.addEventListener("click", () => location.href = "dashboard.html#candidatos");

  const physicalEnabled = ["Aprovado no teste teórico", "Aguardando teste físico", "Aprovado no teste físico", "Reprovado no teste físico"].includes(currentStatus);
  document.querySelectorAll("[data-physical-approve], [data-physical-reject]").forEach(button => {
    button.disabled = !physicalEnabled;
    button.title = physicalEnabled ? "" : "Disponível após aprovação no teste teórico";
  });

  updateReviewSummary();

  window.addEventListener("beforeunload", event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
});
