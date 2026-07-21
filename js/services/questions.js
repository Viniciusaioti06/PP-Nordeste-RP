
window.QuestionsService = {
  async publicList() {
    requireConfig();
    const { data, error } = await supabaseClient
      .from("recruitment_questions")
      .select("*")
      .eq("active", true)
      .order("order_position");
    if (error) throw error;
    return data;
  },

  async staffList() {
    const { data, error } = await supabaseClient
      .from("recruitment_questions")
      .select("*")
      .order("order_position");
    if (error) throw error;
    return data;
  },

  async save(question) {
    const { data, error } = await supabaseClient
      .from("recruitment_questions")
      .upsert(question)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async saveOrder(questions) {
    const payload = questions.map((question, index) => ({
      ...question,
      order_position: index + 1,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from("recruitment_questions").upsert(payload);
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await supabaseClient.from("recruitment_questions").delete().eq("id", id);
    if (error) throw error;
  }
};
