
window.AnnouncementsService = {
  async list() {
    requireConfig();
    const { data, error } = await supabaseClient
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async publicFor(status) {
    requireConfig();
    const { data, error } = await supabaseClient.rpc(
      "public_announcements_for_status",
      { p_status: status }
    );

    if (error) throw error;
    return data || [];
  },

  async create(item) {
    requireConfig();
    const profile = await Auth.profile();
    const { data, error } = await supabaseClient
      .from("announcements")
      .insert({
        title: item.title,
        message: item.message,
        audience_status: item.audience_status,
        active: item.active,
        created_by: profile?.id || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, item) {
    requireConfig();
    const { data, error } = await supabaseClient
      .from("announcements")
      .update({
        title: item.title,
        message: item.message,
        audience_status: item.audience_status,
        active: item.active,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id) {
    requireConfig();
    const { error } = await supabaseClient
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }
};
