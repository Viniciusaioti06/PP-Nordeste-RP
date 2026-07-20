
/**
 * CONFIGURAÇÃO DO SUPABASE
 *
 * 1. Abra o painel do Supabase.
 * 2. Acesse Project Settings > API ou use o botão Connect.
 * 3. Cole a Project URL em SUPABASE_URL.
 * 4. Cole a Publishable Key ou anon public em SUPABASE_ANON_KEY.
 *
 * Nunca coloque a service_role neste arquivo.
 */
const SUPABASE_URL = "https://yfsdexvuzhjcwwnwxyiy.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlmc2RleHZ1emhqY3d3bnd4eWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MDI1NTMsImV4cCI6MjEwMDA3ODU1M30.e3yIfv_d-5ThLbmMyigAtIemcuYE0ivX6QL5Ty1RqZ0";

const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("COLE_AQUI") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes("COLE_AQUI");

const supabaseClient = SUPABASE_CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
