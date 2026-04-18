import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["admin", "operacional", "consulta"] as const;
type AppRole = typeof VALID_ROLES[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validação do chamador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerId = userData.user.id;
    const { data: isAdminData, error: isAdminErr } = await supabaseAdmin.rpc("is_admin", {
      _user_id: callerId,
    });
    if (isAdminErr || !isAdminData) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem alterar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, name, email, password, isActive, role } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvaguarda: admin não pode rebaixar a si mesmo nem inativar a si mesmo
    if (userId === callerId) {
      if (role && role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Você não pode remover seu próprio papel de administrador" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (typeof isActive === "boolean" && !isActive) {
        return new Response(
          JSON.stringify({ error: "Você não pode inativar a si mesmo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update auth user (email/password if provided)
    const authUpdate: Record<string, unknown> = {};
    if (email) authUpdate.email = email;
    if (password) {
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authUpdate.password = password;
    }
    if (name) authUpdate.user_metadata = { name };

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update profile
    const profileUpdate: Record<string, unknown> = {};
    if (name) profileUpdate.name = name;
    if (email) profileUpdate.email = email;
    if (typeof isActive === "boolean") profileUpdate.is_active = isActive;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileError) {
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update role (replace strategy: delete existing + insert new)
    if (role) {
      if (!VALID_ROLES.includes(role as AppRole)) {
        return new Response(
          JSON.stringify({ error: "role inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (roleErr) {
        return new Response(
          JSON.stringify({ error: roleErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
