
window.Auth = {
  async session() {
    requireConfig();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async signIn(email, password) {
    requireConfig();
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { error: accessError } = await supabaseClient.rpc("register_staff_login");
    if (accessError) {
      console.warn("Não foi possível registrar o último acesso:", accessError.message);
    }

    const { error: auditError } = await supabaseClient.rpc("write_audit_event", {
      p_action: "login",
      p_resource_type: "session",
      p_resource_id: data.user?.id || null,
      p_old_data: null,
      p_new_data: { email: data.user?.email || email }
    });
    if (auditError) {
      console.warn("Não foi possível registrar o login na auditoria:", auditError.message);
    }

    return data;
  },

  async signOut() {
    if (window.supabaseClient) await supabaseClient.auth.signOut();
  },

  async profile() {
    const session = await this.session();
    if (!session) return null;
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    if (error) throw error;
    return data;
  },

  async requireStaff(permission = null) {
    const profile = await this.profile();
    if (!profile?.active) throw new Error("Acesso não autorizado.");
    if (permission && !profile.permissions?.[permission]) {
      throw new Error("Você não possui permissão para acessar esta área.");
    }
    return profile;
  },

  async needsBootstrap() {
    requireConfig();
    const { data, error } = await supabaseClient.rpc("needs_initial_admin");
    if (error) throw error;
    return Boolean(data);
  },

  async bootstrap(data) {
    requireConfig();
    const { data: signUp, error: signUpError } = await supabaseClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.name,
          username: data.username,
          discord: data.discord
        }
      }
    });
    if (signUpError) throw signUpError;
    if (!signUp.user) throw new Error("Usuário não criado. Verifique a confirmação de e-mail.");

    const { data: result, error } = await supabaseClient.rpc("bootstrap_first_admin", {
      p_display_name: data.name,
      p_username: data.username,
      p_discord: data.discord
    });
    if (error) throw error;
    return result;
  }
};
