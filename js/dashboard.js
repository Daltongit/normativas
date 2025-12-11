document.addEventListener('DOMContentLoaded', async function () {
    // Proteger página - requiere autenticación
    await protectPage();

    // Obtener usuario actual
    const user = await getCurrentUser();

    if (user) {
        // Mostrar nombre del usuario
        const userNameElement = document.getElementById('userName');
        const userInitialsElement = document.getElementById('userInitials');

        if (user.user_metadata && user.user_metadata.full_name) {
            userNameElement.textContent = user.user_metadata.full_name.split(' ')[0];
            const initials = user.user_metadata.full_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            userInitialsElement.textContent = initials;
        } else {
            userNameElement.textContent = user.email.split('@')[0];
            userInitialsElement.textContent = user.email[0].toUpperCase();
        }

        // Cargar datos del usuario
        await loadUserData(user.id);
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;

            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            alert('Error al cerrar sesión');
        }
    });

    // Navegación del sidebar
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// Función para cargar datos del usuario
async function loadUserData(userId) {
    try {
        // Obtener perfil del usuario
        const { data: profile, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error al cargar perfil:', profileError);
        }

        // Obtener estadísticas del usuario
        const { data: stats, error: statsError } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (stats) {
            updateStatsDisplay(stats);
        } else {
            // Si no hay estadísticas, crear valores por defecto
            await createDefaultStats(userId);
        }

        // Cargar cursos activos
        await loadActiveCourses(userId);

        // Cargar próximas clases
        await loadUpcomingClasses(userId);

        // Cargar actividad reciente
        await loadRecentActivity(userId);

    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
    }
}

// Actualizar visualización de estadísticas
function updateStatsDisplay(stats) {
    document.getElementById('completedLessons').textContent = stats.completed_lessons || 0;
    document.getElementById('studyHours').textContent = stats.study_hours || 0;
    document.getElementById('currentStreak').textContent = stats.current_streak || 0;
    document.getElementById('userLevel').textContent = stats.user_level || 'Principiante';
}

// Crear estadísticas por defecto
async function createDefaultStats(userId) {
    try {
        const { error } = await supabaseClient
            .from('user_stats')
            .insert([
                {
                    user_id: userId,
                    completed_lessons: 0,
                    study_hours: 0,
                    current_streak: 0,
                    user_level: 'Principiante'
                }
            ]);

        if (error && error.code !== '23505') {
            console.error('Error al crear estadísticas:', error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Cargar cursos activos
async function loadActiveCourses(userId) {
    try {
        const { data: courses, error } = await supabaseClient
            .from('user_courses')
            .select(`
                *,
                courses (
                    course_name,
                    language,
                    level
                )
            `)
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) throw error;

        const coursesContainer = document.getElementById('activeCourses');

        if (courses && courses.length > 0) {
            coursesContainer.innerHTML = courses.map(course => `
                <div class="course-item">
                    <div class="course-flag">${getLanguageFlag(course.courses.language)}</div>
                    <div class="course-info">
                        <h4>${course.courses.course_name}</h4>
                        <p>${course.courses.level} • ${course.progress_percentage}% completado</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${course.progress_percentage}%"></div>
                        </div>
                    </div>
                    <button class="btn-continue" onclick="continueCourse(${course.id})">Continuar</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error al cargar cursos:', error);
    }
}

// Cargar próximas clases
async function loadUpcomingClasses(userId) {
    try {
        const { data: classes, error } = await supabaseClient
            .from('user_classes')
            .select(`
                *,
                teachers (
                    full_name
                )
            `)
            .eq('user_id', userId)
            .gte('class_date', new Date().toISOString())
            .order('class_date', { ascending: true })
            .limit(5);

        if (error) throw error;

        const classesContainer = document.getElementById('upcomingClasses');

        if (classes && classes.length > 0) {
            classesContainer.innerHTML = classes.map(classItem => {
                const classDate = new Date(classItem.class_date);
                const isToday = isDateToday(classDate);

                return `
                    <div class="class-item">
                        <div class="class-time">
                            <span class="time">${formatTime(classDate)}</span>
                            <span class="date">${isToday ? 'Hoy' : formatDate(classDate)}</span>
                        </div>
                        <div class="class-info">
                            <h4>${classItem.class_name}</h4>
                            <p>con ${classItem.teachers.full_name}</p>
                        </div>
                        <button class="btn-${isToday ? 'join' : 'schedule'}" onclick="joinClass(${classItem.id})">
                            ${isToday ? 'Unirse' : 'Programado'}
                        </button>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error al cargar clases:', error);
    }
}

// Cargar actividad reciente
async function loadRecentActivity(userId) {
    try {
        const { data: activities, error } = await supabaseClient
            .from('user_activities')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const activityContainer = document.getElementById('recentActivity');

        if (activities && activities.length > 0) {
            activityContainer.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">${getActivityIcon(activity.activity_type)}</div>
                    <div class="activity-content">
                        <p><strong>${activity.activity_type}:</strong> ${activity.description}</p>
                        <span class="activity-time">${getRelativeTime(activity.created_at)}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error al cargar actividad:', error);
    }
}

// Funciones auxiliares
function getLanguageFlag(language) {
    const flags = {
        'Inglés': '🇬🇧',
        'Español': '🇪🇸',
        'Francés': '🇫🇷',
        'Alemán': '🇩🇪',
        'Italiano': '🇮🇹',
        'Japonés': '🇯🇵',
        'English': '🇬🇧',
        'Spanish': '🇪🇸',
        'French': '🇫🇷',
        'German': '🇩🇪',
        'Italian': '🇮🇹',
        'Japanese': '🇯🇵'
    };
    return flags[language] || '🌍';
}

function formatTime(date) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === tomorrow.toDateString()) {
        return 'Mañana';
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function isDateToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function getRelativeTime(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'Hace unos segundos';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
}

function getActivityIcon(type) {
    const icons = {
        'Lección completada': '✅',
        'Logro desbloqueado': '🏆',
        'Quiz completado': '📝',
        'Clase asistida': '👨‍🏫',
        'Nuevo curso': '📚'
    };
    return icons[type] || '📌';
}

// Funciones para interacción
function continueCourse(courseId) {
    console.log('Continuar curso:', courseId);
    // Aquí implementarías la lógica para continuar el curso
    alert('Funcionalidad de continuar curso próximamente');
}

function joinClass(classId) {
    console.log('Unirse a clase:', classId);
    // Aquí implementarías la lógica para unirse a la clase
    alert('Funcionalidad de unirse a clase próximamente');
}
