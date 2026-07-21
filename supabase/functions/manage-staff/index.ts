
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) throw new Error("Secrets do Supabase não disponíveis.");

    const authorization = request.headers.get("Authorization");
    if (!authorization) return Response.json({ error: "Não autenticado." }, { status: 401, headers: corsHeaders });

    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, service);

    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return Response.json({ error: "Sessão inválida." }, { status: 401, headers: corsHeaders });

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("active,permissions").eq("id", user.id).single();

    if (profileError || !profile?.active || !profile.permissions?.staff_manage) {
      return Response.json({ error: "Sem permissão para gerenciar a equipe." }, { status: 403, headers: corsHeaders });
    }

    const { action, userId, payload = {} } = await request.json();

    if (action === "create") {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          display_name: payload.name,
          username: payload.username,
          discord: payload.discord
        }
      });
      if (error) throw error;

      const { data: staff, error: staffError } = await admin
        .from("profiles")
        .update({
          display_name: payload.name,
          username: payload.username,
          email: payload.email,
          discord: payload.discord,
          role: payload.role,
          active: payload.active,
          permissions: payload.permissions,
          updated_at: new Date().toISOString()
        })
        .eq("id", created.user.id)
        .select()
        .single();

      if (staffError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw staffError;
      }
      return Response.json({ profile: staff }, { status: 201, headers: corsHeaders });
    }

    if (action === "update") {
      if (!userId) throw new Error("ID não informado.");
      const patch: Record<string, unknown> = {
        email: payload.email,
        user_metadata: {
          display_name: payload.name,
          username: payload.username,
          discord: payload.discord
        }
      };
      if (payload.password?.trim()) patch.password = payload.password;

      const { error: authError } = await admin.auth.admin.updateUserById(userId, patch);
      if (authError) throw authError;

      const { data: staff, error } = await admin
        .from("profiles")
        .update({
          display_name: payload.name,
          username: payload.username,
          email: payload.email,
          discord: payload.discord,
          role: payload.role,
          active: payload.active,
          permissions: payload.permissions,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      return Response.json({ profile: staff }, { headers: corsHeaders });
    }

    if (action === "delete") {
      if (!userId) throw new Error("ID não informado.");
      if (userId === user.id) throw new Error("Você não pode excluir o próprio usuário.");
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("manage-staff:", error);
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
