
window.SettingsService = {
  async get() {
    const { data, error } = await supabaseClient
      .from("recruitment_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },

  async save(patch) {
    const { data, error } = await supabaseClient
      .from("recruitment_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", 1).select().single();
    if (error) throw error;
    return data;
  }
};
