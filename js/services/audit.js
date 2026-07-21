
window.AuditService = {
  async list() {
    requireConfig();
    const { data, error } = await supabaseClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async write(action, resourceType, resourceId, oldData = null, newData = null) {
    requireConfig();

    const { data, error } = await supabaseClient.rpc("write_audit_event", {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId == null ? null : String(resourceId),
      p_old_data: oldData,
      p_new_data: newData
    });

    if (error) {
      console.error("Falha ao registrar auditoria:", error);
      throw error;
    }

    return data;
  }
};
