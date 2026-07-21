/**
 * Cliente público do Supabase.
 * A chave anon é pública e a segurança dos dados é feita pelas políticas RLS.
 * Nunca coloque a service_role neste arquivo.
 */

window.SUPABASE_URL = "https://yfsdexvuzhjcwwnwxyiy.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc2RleHZ1emhqY3d3bnd4eWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MDI1NTMsImV4cCI6MjEwMDA3ODU1M30.e3yIfv_d-5ThLbmMyigAtIemcuYE0ivX6QL5Ty1RqZ0";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("A biblioteca supabase-js não foi carregada.");
}

window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

/* Compatibilidade com versões anteriores do projeto. */
window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: window.SUPABASE_URL,
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY
});
window.APP_CONFIGURED = true;
window.SUPABASE_CONFIGURED = true;

console.info("[Polícia Penal] Cliente Supabase inicializado.");
