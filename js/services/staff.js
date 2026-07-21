
window.StaffService = {
  async list() {
    requireConfig();
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async invoke(action, payload = {}, userId = null) {
    requireConfig();

    const { data, error } = await supabaseClient.functions.invoke("manage-staff", {
      body: { action, userId, payload }
    });

    if (error) {
      let message = error.message || "Falha ao executar a operação.";
      try {
        const contextBody = await error.context?.json?.();
        if (contextBody?.error) message = contextBody.error;
      } catch {}
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data;
  }
};
