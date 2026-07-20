
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) throw new Error("Não autenticado.");

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles").select("active,permissions").eq("id", callerData.user.id).single();
    if (profileError || !callerProfile?.active || !callerProfile.permissions?.staff_manage) {
      throw new Error("Sem permissão para gerenciar a equipe.");
    }

    const body = await req.json();
    const { action, userId, payload = {} } = body;

    if (action === "create") {
      const { data: created, error } = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          display_name: payload.name,
          username: payload.username,
          discord: payload.discord,
        },
      });
      if (error) throw error;
      const { data: profile, error: updateError } = await adminClient
        .from("profiles")
        .update({
          display_name: payload.name,
          username: payload.username,
          email: payload.email,
          discord: payload.discord,
          role: payload.role,
          active: payload.active,
          permissions: payload.permissions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.user.id).select().single();
      if (updateError) throw updateError;
      return Response.json({ profile }, { headers: corsHeaders });
    }

    if (action === "update") {
      if (payload.password) {
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          password: payload.password,
          email: payload.email,
        });
        if (error) throw error;
      }
      const { data: profile, error } = await adminClient
        .from("profiles")
        .update({
          display_name: payload.name,
          username: payload.username,
          email: payload.email,
          discord: payload.discord,
          role: payload.role,
          active: payload.active,
          permissions: payload.permissions,
          updated_at: new Date().toISOString(),
        }).eq("id", userId).select().single();
      if (error) throw error;
      return Response.json({ profile }, { headers: corsHeaders });
    }

    if (action === "delete") {
      if (userId === callerData.user.id) throw new Error("Você não pode excluir seu próprio usuário.");
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
  }
});
