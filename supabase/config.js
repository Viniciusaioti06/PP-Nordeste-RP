/**
 * Configuração pública do Supabase.
 * Nunca coloque a service_role neste arquivo.
 */

window.SUPABASE_URL = "https://yfsdexvuzhjcwwnwxyiy.supabase.co";

window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc2RleHZ1emhqY3d3bnd4eWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MDI1NTMsImV4cCI6MjEwMDA3ODU1M30.e3yIfv_d-5ThLbmMyigAtIemcuYE0ivX6QL5Ty1RqZ0";

window.SUPABASE_CONFIGURED =
  window.SUPABASE_URL.startsWith("https://") &&
  window.SUPABASE_ANON_KEY.length > 30;

window.supabaseClient = window.SUPABASE_CONFIGURED
  ? window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    )
  : null;