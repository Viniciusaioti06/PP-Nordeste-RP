
window.SupabaseHealth = {
  async check() {
    requireConfig();
    const { data, error } = await supabaseClient
      .from("recruitment_settings")
      .select("id,recruitment_open")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("[Polícia Penal] Erro de conexão:", error);
      throw error;
    }

    console.info("[Polícia Penal] Supabase conectado.", data);
    return data;
  }
};
