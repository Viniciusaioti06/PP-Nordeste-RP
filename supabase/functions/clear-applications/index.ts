import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Secrets obrigatórios do Supabase não estão disponíveis.");
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return json({ error: "Sessão não informada." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Sessão inválida ou expirada." }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id,display_name,email,role,active,permissions")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.active) {
      return json({ error: "Perfil interno ativo não encontrado." }, 403);
    }

    // A limpeza geral é exclusiva do cargo Administrador.
    if (profile.role !== "admin") {
      return json(
        { error: "Somente administradores podem excluir todas as inscrições." },
        403,
      );
    }

    if (
      !profile.permissions?.settings_manage ||
      !profile.permissions?.applications_delete
    ) {
      return json(
        { error: "Seu usuário não possui as permissões de manutenção necessárias." },
        403,
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body?.confirmation !== "EXCLUIR TODAS") {
      return json({ error: "Confirmação de segurança inválida." }, 400);
    }

    const actorName =
      profile.display_name?.trim() ||
      profile.email?.trim() ||
      "Administrador";

    const { data, error } = await adminClient.rpc(
      "admin_clear_recruitment_data",
      {
        p_actor_id: user.id,
        p_actor_name: actorName,
        p_actor_role: profile.role,
      },
    );

    if (error) throw error;

    const result = data ?? {
      deleted_applications: 0,
      deleted_identities: 0,
    };

    return json({
      ok: true,
      deletedApplications: Number(result.deleted_applications || 0),
      deletedIdentities: Number(result.deleted_identities || 0),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno na manutenção.";
    console.error("clear-applications:", error);
    return json({ error: message }, 400);
  }
});
