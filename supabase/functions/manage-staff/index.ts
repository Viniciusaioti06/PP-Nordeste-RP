import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StaffPayload = {
  name?: string;
  username?: string;
  email?: string;
  discord?: string;
  password?: string;
  role?: "admin" | "supervisor" | "recruiter";
  active?: boolean;
  permissions?: Record<string, boolean>;
};

type RequestBody = {
  action: "create" | "update" | "delete";
  userId?: string;
  payload?: StaffPayload;
};

deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Método não permitido." },
      {
        status: 405,
        headers: corsHeaders,
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        "As variáveis obrigatórias do Supabase não estão disponíveis.",
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Token de autenticação não informado." },
        {
          status: 401,
          headers: corsHeaders,
        },
      );
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return Response.json(
        {
          error: "Sessão inválida ou expirada.",
          details: callerError?.message,
        },
        {
          status: 401,
          headers: corsHeaders,
        },
      );
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, active, role, permissions")
      .eq("id", caller.id)
      .single();

    if (profileError) {
      throw new Error(
        `Não foi possível consultar o perfil: ${profileError.message}`,
      );
    }

    if (!callerProfile.active) {
      return Response.json(
        { error: "Este usuário está desativado." },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    if (!callerProfile.permissions?.staff_manage) {
      return Response.json(
        { error: "Sem permissão para gerenciar a equipe." },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    const body = (await req.json()) as RequestBody;
    const { action, userId, payload = {} } = body;

    if (action === "create") {
      if (
        !payload.email ||
        !payload.password ||
        !payload.name ||
        !payload.username ||
        !payload.role
      ) {
        return Response.json(
          { error: "Preencha todos os campos obrigatórios." },
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
          user_metadata: {
            display_name: payload.name,
            username: payload.username,
            discord: payload.discord ?? "",
          },
        });

      if (createError) {
        throw new Error(`Falha ao criar usuário: ${createError.message}`);
      }

      const { data: profile, error: updateError } = await adminClient
        .from("profiles")
        .update({
          display_name: payload.name,
          username: payload.username,
          email: payload.email,
          discord: payload.discord ?? "",
          role: payload.role,
          active: payload.active ?? true,
          permissions: payload.permissions ?? {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.user.id)
        .select()
        .single();

      if (updateError) {
        // Evita deixar um usuário órfão no Auth.
        await adminClient.auth.admin.deleteUser(created.user.id);

        throw new Error(
          `Falha ao configurar o perfil: ${updateError.message}`,
        );
      }

      return Response.json(
        {
          ok: true,
          profile,
        },
        {
          status: 201,
          headers: corsHeaders,
        },
      );
    }

    if (action === "update") {
      if (!userId) {
        return Response.json(
          { error: "ID do usuário não informado." },
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      const authChanges: {
        email?: string;
        password?: string;
        user_metadata?: Record<string, string>;
      } = {
        user_metadata: {
          display_name: payload.name ?? "",
          username: payload.username ?? "",
          discord: payload.discord ?? "",
        },
      };

      if (payload.email) {
        authChanges.email = payload.email;
      }

      if (payload.password?.trim()) {
        authChanges.password = payload.password;
      }

      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(
          userId,
          authChanges,
        );

      if (authUpdateError) {
        throw new Error(
          `Falha ao atualizar autenticação: ${authUpdateError.message}`,
        );
      }

      const { data: profile, error: profileUpdateError } =
        await adminClient
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
          .eq("id", userId)
          .select()
          .single();

      if (profileUpdateError) {
        throw new Error(
          `Falha ao atualizar perfil: ${profileUpdateError.message}`,
        );
      }

      return Response.json(
        {
          ok: true,
          profile,
        },
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    if (action === "delete") {
      if (!userId) {
        return Response.json(
          { error: "ID do usuário não informado." },
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      if (userId === caller.id) {
        return Response.json(
          { error: "Você não pode excluir o próprio usuário." },
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        throw new Error(
          `Falha ao excluir usuário: ${deleteError.message}`,
        );
      }

      return Response.json(
        { ok: true },
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    return Response.json(
      { error: "Ação inválida." },
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro interno desconhecido.";

    console.error("manage-staff:", error);

    return Response.json(
      { error: message },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});