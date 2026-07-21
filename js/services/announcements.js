
window.AnnouncementsService = {
  async list() {
    const { data, error } = await supabaseClient
      .from("announcements").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    return data;
  },

  async publicFor(status) {
    const { data, error } = await supabaseClient.rpc("public_announcements_for_status", {
      p_status: status
    });
    if (error) throw error;
    return data;
  },

  async save(item) {
    const query = item.id
      ? supabaseClient.from("announcements").update(item).eq("id", item.id)
      : supabaseClient.from("announcements").insert(item);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabaseClient.from("announcements").delete().eq("id",id);
    if (error) throw error;
  }
};
