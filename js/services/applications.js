
window.ApplicationsService = {
  async submit(payload) {
    requireConfig();
    const { data, error } = await supabaseClient.rpc("submit_recruitment_application", {
      p_application: payload
    });

    if (error) {
      const message = String(error.message || "");
      if (message.includes("DISCORD_ALREADY_USED")) {
        throw new Error("Esta conta do Discord já possui uma inscrição vinculada.");
      }
      if (message.includes("PASSPORT_ALREADY_USED")) {
        throw new Error("Este passaporte já foi utilizado em uma inscrição.");
      }
      if (message.includes("DISCORD_AUTH_REQUIRED")) {
        throw new Error("Conecte sua conta do Discord antes de enviar a inscrição.");
      }
      throw error;
    }

    return data;
  },

  async discordSession() {
    requireConfig();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session || null;
  },

  async connectDiscord() {
    requireConfig();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo,
        scopes: "identify"
      }
    });
    if (error) throw error;
    return data;
  },

  async disconnectDiscord() {
    requireConfig();
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  async registrationEligibility() {
    requireConfig();
    const { data, error } = await supabaseClient.rpc("candidate_registration_status");
    if (error) throw error;
    return data || { has_application: false };
  },

  async lookup(protocol, passport) {
    requireConfig();
    const { data, error } = await supabaseClient.rpc("lookup_recruitment_application", {
      p_protocol: protocol.trim(),
      p_passport: passport.trim()
    });
    if (error) throw error;
    return data;
  },

  async list() {
    const { data, error } = await supabaseClient
      .from("recruitment_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async update(id, patch) {
    const { data, error } = await supabaseClient
      .from("recruitment_applications")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAll(confirmation) {
    requireConfig();

    const { data, error } = await supabaseClient.functions.invoke(
      "manage-staff",
      {
        body: {
          action: "clearApplications",
          payload: { confirmation }
        }
      }
    );

    if (error) {
      let message = error.message || "Não foi possível executar a manutenção.";

      try {
        const context = error.context;
        if (context instanceof Response) {
          const payload = await context.clone().json();
          message = payload?.error || message;
        }
      } catch (_) {}

      throw new Error(message);
    }

    if (!data?.ok) {
      throw new Error(data?.error || "A manutenção não foi concluída.");
    }

    return {
      deletedApplications: Number(data.deletedApplications || 0),
      deletedIdentities: Number(data.deletedIdentities || 0)
    };
  }
};
