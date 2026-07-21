
window.AuditService = {
  async list() {
    const { data, error } = await supabaseClient
      .from("audit_logs").select("*").order("created_at",{ascending:false}).limit(500);
    if (error) throw error;
    return data;
  },

  async write(action, resourceType, resourceId, oldData = null, newData = null) {
    const profile = await Auth.profile();
    if (!profile) return;
    const { error } = await supabaseClient.from("audit_logs").insert({
      actor_id: profile.id,
      actor_name: profile.display_name,
      actor_role: profile.role,
      action,
      resource_type: resourceType,
      resource_id: String(resourceId ?? ""),
      old_data: oldData,
      new_data: newData
    });
    if (error) console.warn("Falha ao registrar auditoria:", error.message);
  }
};
