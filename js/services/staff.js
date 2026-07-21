
window.StaffService = {
  async list() {
    const { data, error } = await supabaseClient.from("profiles").select("*").order("created_at");
    if (error) throw error;
    return data;
  },

  async invoke(action, payload = {}, userId = null) {
    const { data, error } = await supabaseClient.functions.invoke("manage-staff", {
      body: { action, userId, payload }
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }
};
