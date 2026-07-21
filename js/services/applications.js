
window.ApplicationsService = {
  async submit(payload) {
    requireConfig();
    const { data, error } = await supabaseClient.rpc("submit_recruitment_application", {
      p_application: payload
    });
    if (error) throw error;
    return data;
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
  }
};
