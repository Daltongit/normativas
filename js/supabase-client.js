// Configuración de Supabase
const SUPABASE_URL = 'https://bgntffyfpioijkkdyhbs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbnRmZnlmcGlvaWpra2R5aGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NTU4ODAsImV4cCI6MjA4MTAzMTg4MH0.KVe5kEimdRIaoRlSn_NnZ-cJsS80ADzMXWlrD63Z3sk';

// Inicializar cliente de Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función para verificar sesión
async function checkSession() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    return session;
}

// Función para obtener usuario actual
async function getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) {
        console.error('Error al obtener usuario:', error.message);
        return null;
    }
    return user;
}

// Proteger páginas que requieren autenticación
async function protectPage() {
    const session = await checkSession();
    if (!session) {
        window.location.href = 'login.html';
    }
}

// Redirigir si ya está autenticado
async function redirectIfAuthenticated() {
    const session = await checkSession();
    if (session) {
        window.location.href = 'dashboard.html';
    }
}

console.log('Supabase client inicializado correctamente');
