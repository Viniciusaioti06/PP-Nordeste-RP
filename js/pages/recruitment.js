
document.addEventListener("DOMContentLoaded", async () => {
  const shell = document.querySelector("[data-form-shell]");
  const gate = document.querySelector("[data-discord-gate]");
  const connectedCard = document.querySelector("[data-discord-connected]");
  const connectButton = document.querySelector("[data-connect-discord]");
  const disconnectButton = document.querySelector("[data-disconnect-discord]");
  const authMessage = document.querySelector("[data-discord-auth-message]");
  const form = document.querySelector("#recruitment-form");
  const dynamic = document.querySelector("[data-dynamic-questions]");

  let questions = [];
  let settings = null;
  let current = 0;
  let initialized = false;
  let discordIdentity = null;

  const discordDetails = session => {
    if (!session?.user) return null;

    const identity = (session.user.identities || []).find(item => item.provider === "discord");
    const provider = session.user.app_metadata?.provider;

    if (!identity && provider !== "discord") return null;

    const metadata = identity?.identity_data || session.user.user_metadata || {};
    const username =
      metadata.global_name ||
      metadata.full_name ||
      metadata.name ||
      metadata.preferred_username ||
      metadata.user_name ||
      session.user.user_metadata?.full_name ||
      session.user.email ||
      "Usuário do Discord";

    const discordId =
      metadata.id ||
      metadata.sub ||
      identity?.id ||
      session.user.user_metadata?.provider_id ||
      "";

    return {
      username,
      discordId: String(discordId),
      avatarUrl:
        metadata.avatar_url ||
        metadata.picture ||
        session.user.user_metadata?.avatar_url ||
        ""
    };
  };

  const setConnectLoading = loading => {
    connectButton.disabled = loading;
    connectButton.innerHTML = loading
      ? '<span class="discord-auth-spinner"></span> Conectando...'
      : '<i class="bi bi-discord"></i> Conectar Discord';
  };

  const showAuthenticationGate = message => {
    gate.classList.remove("hidden");
    connectedCard.classList.add("hidden");
    shell.classList.add("hidden");
    if (message) authMessage.textContent = message;
  };

  const showConnectedIdentity = details => {
    gate.classList.add("hidden");
    connectedCard.classList.remove("hidden");

    connectedCard.querySelector("[data-discord-name]").textContent = details.username;
    connectedCard.querySelector("[data-discord-id]").textContent =
      details.discordId ? `ID do Discord: ${details.discordId}` : "Conta autenticada pelo Discord";

    const image = connectedCard.querySelector("[data-discord-avatar]");
    const fallback = connectedCard.querySelector("[data-discord-avatar-fallback]");

    if (details.avatarUrl) {
      image.src = details.avatarUrl;
      image.classList.remove("hidden");
      fallback.classList.add("hidden");
    } else {
      image.classList.add("hidden");
      fallback.classList.remove("hidden");
    }

    const discordInput = form.elements.discord;
    discordInput.value = details.username;
  };

  const renderQuestion = question => {
    const name = `question_${question.id}`;

    if (question.question_type === "open") {
      return `<label class="field"><span>${escapeHTML(question.title)}</span>
        <textarea name="${name}" rows="6" minlength="${question.min_length}" ${question.required ? "required" : ""}></textarea>
        <small class="error"></small></label><br>`;
    }

    return `<fieldset class="question-card"><legend>${escapeHTML(question.title)}</legend>
      ${(question.options || []).map(option =>
        `<label><input type="radio" name="${name}" value="${escapeHTML(option.id)}" ${question.required ? "required" : ""}> ${escapeHTML(option.label)}</label>`
      ).join("")}
      <small class="error"></small></fieldset>`;
  };

  const buildQuestions = () => {
    const groups = [
      ["objective", "Conhecimento e conduta"],
      ["eliminatory", "Critérios obrigatórios"],
      ["open", "Situações e perfil"]
    ];

    dynamic.innerHTML = groups.map(([type, title]) => {
      const list = questions.filter(question => question.question_type === type);
      if (!list.length) return "";

      return `<section class="form-step">
        <div class="step-heading">
          <span class="eyebrow">${title.toUpperCase()}</span>
          <h2>${title}</h2>
        </div>
        ${list.map(renderQuestion).join("")}
      </section>`;
    }).join("");
  };

  const getSteps = () => [...document.querySelectorAll(".form-step")];

  const render = () => {
    const steps = getSteps();
    const next = document.querySelector("[data-next]");
    const prev = document.querySelector("[data-prev]");
    const submit = document.querySelector("[data-submit]");

    steps.forEach((step, index) => step.classList.toggle("active", index === current));
    document.querySelector("[data-step-count]").textContent = `${current + 1} / ${steps.length}`;
    document.querySelector("[data-progress]").style.width = `${((current + 1) / steps.length) * 100}%`;

    prev.disabled = current === 0;
    next.classList.toggle("hidden", current === steps.length - 1);
    submit.classList.toggle("hidden", current !== steps.length - 1);

    window.scrollTo({
      top: Math.max(shell.offsetTop - 100, 0),
      behavior: "smooth"
    });
  };

  const validate = () => {
    const step = getSteps()[current];
    let valid = true;

    step.querySelectorAll(".error").forEach(element => {
      element.textContent = "";
    });

    step.querySelectorAll("[required]").forEach(input => {
      if (input.type === "radio") return;

      if (input.type === "checkbox" && !input.checked) {
        valid = false;
        input.closest(".check-row").nextElementSibling.textContent = "Confirmação obrigatória.";
      } else if (!String(input.value).trim()) {
        valid = false;
        const field = input.closest(".field");
        if (field?.querySelector(".error")) {
          field.querySelector(".error").textContent = "Campo obrigatório.";
        }
      } else if (input.minLength > 0 && input.value.trim().length < input.minLength) {
        valid = false;
        input.closest(".field").querySelector(".error").textContent =
          `Mínimo de ${input.minLength} caracteres.`;
      }
    });

    step.querySelectorAll("fieldset").forEach(fieldset => {
      if (fieldset.querySelector("input[required]") && !fieldset.querySelector("input:checked")) {
        valid = false;
        fieldset.querySelector(".error").textContent = "Selecione uma alternativa.";
      }
    });

    return valid;
  };

  const initializeForm = async () => {
    if (initialized) {
      shell.classList.remove("hidden");
      return;
    }

    try {
      [questions, settings] = await Promise.all([
        QuestionsService.publicList(),
        SettingsService.get()
      ]);
    } catch (error) {
      shell.classList.remove("hidden");
      shell.innerHTML = `<div class="empty-state"><h2>Falha ao conectar</h2><p>${escapeHTML(error.message)}</p></div>`;
      return;
    }

    if (!settings.recruitment_open) {
      shell.classList.remove("hidden");
      shell.innerHTML =
        '<div class="empty-state"><h2>Recrutamento encerrado</h2><p>As inscrições estão fechadas.</p></div>';
      return;
    }

    buildQuestions();
    initialized = true;
    shell.classList.remove("hidden");
    current = 0;
    render();
  };

  const verifyAuthentication = async () => {
    try {
      requireConfig();
      const session = await ApplicationsService.discordSession();
      const details = discordDetails(session);

      if (!details) {
        discordIdentity = null;
        showAuthenticationGate("Você será redirecionado ao Discord para autorizar a identificação.");
        return;
      }

      discordIdentity = details;
      showConnectedIdentity(details);

      const eligibility = await ApplicationsService.registrationEligibility();
      if (eligibility?.has_application) {
        shell.classList.add("hidden");
        connectedCard.insertAdjacentHTML("afterend", `
          <section class="duplicate-application-card" data-existing-application>
            <span class="eyebrow">INSCRIÇÃO JÁ REGISTRADA</span>
            <h2>Esta conta já participou do processo seletivo.</h2>
            <p>Não é permitido criar outra inscrição com a mesma conta do Discord ou passaporte.</p>
            ${eligibility.protocol ? `<div class="existing-protocol"><small>PROTOCOLO EXISTENTE</small><strong>${escapeHTML(eligibility.protocol)}</strong></div>` : ""}
            <a class="button primary" href="status.html">Consultar inscrição existente</a>
          </section>
        `);
        return;
      }

      await initializeForm();
    } catch (error) {
      console.error("Falha na autenticação do Discord:", error);
      showAuthenticationGate(error.message || "Não foi possível verificar sua conta do Discord.");
    }
  };

  connectButton.addEventListener("click", async () => {
    setConnectLoading(true);
    authMessage.textContent = "Abrindo a autorização segura do Discord...";

    try {
      await ApplicationsService.connectDiscord();
    } catch (error) {
      setConnectLoading(false);
      authMessage.textContent = error.message || "Não foi possível conectar ao Discord.";
    }
  });

  disconnectButton.addEventListener("click", async () => {
    disconnectButton.disabled = true;

    try {
      await ApplicationsService.disconnectDiscord();
      window.location.reload();
    } catch (error) {
      disconnectButton.disabled = false;
      showToast(error.message);
    }
  });

  document.querySelector("[data-next]").addEventListener("click", () => {
    if (validate()) {
      current += 1;
      render();
    }
  });

  document.querySelector("[data-prev]").addEventListener("click", () => {
    current -= 1;
    render();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!discordIdentity) {
      showToast("Conecte sua conta do Discord antes de enviar.");
      showAuthenticationGate();
      return;
    }

    if (!validate()) return;

    const values = Object.fromEntries(new FormData(form).entries());
    let autoScore = 0;
    let maxAutoScore = 0;
    let eliminatory = false;
    const answers = {};

    questions.forEach(question => {
      const value = values[`question_${question.id}`] ?? "";

      if (question.question_type === "open") {
        answers[question.id] = {
          question: question.title,
          type: "open",
          value: String(value).trim(),
          manualCriteria: question.manual_criteria,
          maxPoints: question.points
        };
      } else {
        const option = (question.options || []).find(item => item.id === value);
        const points = Number(option?.points || 0);

        autoScore += points;

        if (question.question_type === "objective") {
          maxAutoScore += Number(question.points || 0);
        }

        if (
          question.question_type === "eliminatory" &&
          (question.eliminatory_options || []).includes(value)
        ) {
          eliminatory = true;
        }

        answers[question.id] = {
          question: question.title,
          type: question.question_type,
          value,
          optionLabel: option?.label || "",
          points,
          maxPoints: question.points
        };
      }
    });

    const normalizedScore = maxAutoScore > 0
      ? Math.round((autoScore / maxAutoScore) * 100) / 10
      : 0;
    const minimumScore = Number(settings.minimum_score ?? 7);
    const status =
      eliminatory || normalizedScore < minimumScore
        ? "Reprovado automaticamente"
        : "Em análise";

    const now = new Date().toISOString();
    const payload = {
      protocol: `PP-${new Date().getFullYear()}-${crypto
        .getRandomValues(new Uint32Array(1))[0]
        .toString()
        .slice(-6)
        .padStart(6, "0")}`,
      character_name: values.characterName.trim(),
      passport: values.passport.trim(),
      discord: discordIdentity.username,
      character_age: Number(values.characterAge),
      city_time: values.cityTime.trim(),
      availability: values.availability.trim(),
      experience: values.experience.trim(),
      answers,
      automatic_score: normalizedScore,
      maximum_automatic_score: 10,
      status,
      public_note:
        status === "Em análise"
          ? "Sua inscrição aguarda análise da equipe."
          : "Sua inscrição não avançou na triagem inicial.",
      reviewer_notes: "",
      physical_recruiter: "",
      eliminatory_triggered: eliminatory,
      question_snapshot: questions,
      timeline: [
        { status: "Inscrição enviada", date: now },
        { status: "Triagem automática", date: now },
        { status, date: now }
      ]
    };

    const submitButton = document.querySelector("[data-submit]");
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    try {
      const created = await ApplicationsService.submit(payload);

      document.querySelector("[data-protocol]").textContent = created.protocol;

      const successModal = document.querySelector("#success-modal");
      successModal.showModal();
      successModal.classList.add("is-celebrating");

      window.setTimeout(() => {
        successModal.classList.remove("is-celebrating");
      }, 1400);

      form.reset();
      form.elements.discord.value = discordIdentity.username;
      current = 0;
      render();
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar inscrição";
    }
  });

  document.querySelector("[data-close-modal]").addEventListener("click", () => {
    document.querySelector("#success-modal").close();
  });

  document.querySelector("[data-copy-protocol]")?.addEventListener("click", async event => {
    const protocol = document.querySelector("[data-protocol]")?.textContent?.trim();
    if (!protocol) return;

    try {
      await navigator.clipboard.writeText(protocol);
      const button = event.currentTarget;
      const original = button.textContent;

      button.textContent = "Protocolo copiado!";
      button.classList.add("copied");

      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("copied");
      }, 1800);
    } catch {
      showToast("Copie o protocolo manualmente.");
    }
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && discordDetails(session)) {
      window.setTimeout(verifyAuthentication, 0);
    }
  });

  await verifyAuthentication();
});
