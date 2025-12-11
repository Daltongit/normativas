document.addEventListener('DOMContentLoaded', async function() {
    // Proteger página - requiere autenticación
    await protectPage();

    // Obtener usuario actual
    const user = await getCurrentUser();
    
    if (user) {
        // Guardar usuario globalmente
        window.currentUser = user;
        
        // Mostrar nombre del usuario
        displayUserInfo(user);

        // Cargar datos del usuario
        await loadUserData(user.id);
    }

    // Navegación del sidebar
    setupNavigation();

    // Logout
    setupLogout();

    // Configuración
    setupSettings(user);

    // Botón explorar más cursos
    setupExploreCourses();
});

// Mostrar información del usuario
function displayUserInfo(user) {
    const userNameElement = document.getElementById('userName');
    const userInitialsElement = document.getElementById('userInitials');
    
    if (user.user_metadata && user.user_metadata.full_name) {
        const fullName = user.user_metadata.full_name;
        userNameElement.textContent = fullName.split(' ')[0];
        const initials = fullName
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
}

// Configurar navegación
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remover active de todos los items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Agregar active al item actual
            this.classList.add('active');
            
            // Ocultar todas las secciones
            sections.forEach(section => section.classList.remove('active'));
            
            // Mostrar la sección correspondiente
            const sectionName = this.getAttribute('data-section');
            const targetSection = document.getElementById(`${sectionName}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Cargar datos específicos de la sección
                loadSectionData(sectionName);
            }
        });
    });

    // Manejar enlaces "Ver todos"
    document.querySelectorAll('.view-all').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('href').substring(1);
            const targetNav = document.querySelector(`.nav-item[data-section="${targetSection}"]`);
            if (targetNav) {
                targetNav.click();
            }
        });
    });
}

// Cargar datos específicos de cada sección
async function loadSectionData(sectionName) {
    const user = window.currentUser;
    if (!user) return;

    switch(sectionName) {
        case 'courses':
            await loadAllCourses(user.id);
            break;
        case 'lessons':
            await loadLessons(user.id);
            break;
        case 'progress':
            await loadProgress(user.id);
            break;
        case 'teachers':
            await loadTeachers();
            break;
        case 'messages':
            loadMessages();
            break;
    }
}

// Configurar logout
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
                alert('Error al cerrar sesión');
            }
        }
    });
}

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
        let { data: stats, error: statsError } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (statsError && statsError.code === 'PGRST116') {
            // Si no hay estadísticas, crear valores por defecto
            await createDefaultStats(userId);
            // Obtener de nuevo las estadísticas
            const result = await supabaseClient
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single();
            stats = result.data;
        }

        if (stats) {
            updateStatsDisplay(stats);
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
                    longest_streak: 0,
                    user_level: 'Principiante',
                    total_points: 0
                }
            ]);

        if (error && error.code !== '23505') {
            throw error;
        }
    } catch (error) {
        console.error('Error al crear estadísticas:', error);
    }
}

// Cargar todos los cursos disponibles
async function loadAllCourses(userId) {
    try {
        const { data: courses, error } = await supabaseClient
            .from('courses')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        const coursesContainer = document.getElementById('allCoursesGrid');
        
        if (courses && courses.length > 0) {
            coursesContainer.innerHTML = courses.map(course => `
                <div class="dashboard-card course-card" data-course-id="${course.id}">
                    <div class="course-header">
                        <div class="course-flag">${getLanguageFlag(course.language)}</div>
                        <span class="course-level">${course.level}</span>
                    </div>
                    <h3>${course.course_name}</h3>
                    <p>${course.description || 'Curso completo para dominar el idioma'}</p>
                    <div class="course-meta">
                        <span><i class="fas fa-book"></i> ${course.total_lessons} lecciones</span>
                        <span><i class="fas fa-clock"></i> ${course.duration_hours}h</span>
                    </div>
                    <button class="btn-primary enroll-btn" data-course-id="${course.id}">
                        <i class="fas fa-plus"></i> Inscribirme
                    </button>
                </div>
            `).join('');

            // Agregar event listeners a los botones de inscripción
            document.querySelectorAll('.enroll-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const courseId = this.getAttribute('data-course-id');
                    enrollCourse(courseId, userId);
                });
            });
        } else {
            coursesContainer.innerHTML = '<p class="loading-message">No hay cursos disponibles</p>';
        }
    } catch (error) {
        console.error('Error al cargar cursos:', error);
        document.getElementById('allCoursesGrid').innerHTML = '<p class="loading-message">Error al cargar cursos</p>';
    }
}

// Cargar cursos activos
async function loadActiveCourses(userId) {
    try {
        const { data: userCourses, error } = await supabaseClient
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
        
        if (userCourses && userCourses.length > 0) {
            coursesContainer.innerHTML = userCourses.map(uc => `
                <div class="course-item">
                    <div class="course-flag">${getLanguageFlag(uc.courses.language)}</div>
                    <div class="course-info">
                        <h4>${uc.courses.course_name}</h4>
                        <p>${uc.courses.level} • ${uc.progress_percentage}% completado</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${uc.progress_percentage}%"></div>
                        </div>
                    </div>
                    <button class="btn-continue" data-course-id="${uc.id}">
                        Continuar <i class="fas fa-play"></i>
                    </button>
                </div>
            `).join('');

            // Agregar event listeners
            document.querySelectorAll('.btn-continue').forEach(btn => {
                btn.addEventListener('click', function() {
                    const courseId = this.getAttribute('data-course-id');
                    continueCourse(courseId);
                });
            });
        } else {
            coursesContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                        No tienes cursos activos. ¡Comienza tu viaje de aprendizaje!
                    </p>
                    <button class="btn-primary" onclick="document.querySelector('.nav-item[data-section=\\'courses\\']').click()">
                        <i class="fas fa-search"></i> Explorar Cursos
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error al cargar cursos activos:', error);
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
            .eq('status', 'scheduled')
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
                            <p><i class="fas fa-user"></i> ${classItem.teachers.full_name}</p>
                        </div>
                        ${isToday ? 
                            `<button class="btn-join" data-class-id="${classItem.id}" data-meeting-url="${classItem.meeting_url || '#'}">
                                Unirse <i class="fas fa-video"></i>
                            </button>` :
                            `<button class="btn-schedule">
                                Programado <i class="fas fa-check"></i>
                            </button>`
                        }
                    </div>
                `;
            }).join('');

            // Agregar event listeners
            document.querySelectorAll('.btn-join').forEach(btn => {
                btn.addEventListener('click', function() {
                    const meetingUrl = this.getAttribute('data-meeting-url');
                    joinClass(meetingUrl);
                });
            });
        } else {
            classesContainer.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    No tienes clases programadas. <a href="#teachers" style="color: var(--neon-orange); cursor: pointer;" onclick="document.querySelector('.nav-item[data-section=\\'teachers\\']').click()">Agenda una clase</a>
                </p>
            `;
        }
    } catch (error) {
        console.error('Error al cargar clases:', error);
        // Mostrar datos de ejemplo si no hay clases
        document.getElementById('upcomingClasses').innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                No tienes clases programadas
            </p>
        `;
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
                    <div class="activity-icon ${getActivityClass(activity.activity_type)}">
                        <i class="${getActivityIconClass(activity.activity_type)}"></i>
                    </div>
                    <div class="activity-content">
                        <p><strong>${activity.activity_type}:</strong> ${activity.description}</p>
                        <span class="activity-time">${getRelativeTime(activity.created_at)}</span>
                    </div>
                </div>
            `).join('');
        } else {
            activityContainer.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    No hay actividad reciente. ¡Comienza a aprender!
                </p>
            `;
        }
    } catch (error) {
        console.error('Error al cargar actividad:', error);
    }
}

// Cargar lecciones
async function loadLessons(userId) {
    const lessonsSection = document.getElementById('lessons-section');
    if (!lessonsSection) return;

    lessonsSection.innerHTML = `
        <div class="section-title">
            <h2><i class="fas fa-graduation-cap"></i> Mis Lecciones</h2>
        </div>
        <div class="lessons-container">
            <p style="text-align: center; color: var(--text-secondary); padding: 3rem;">
                Las lecciones se mostrarán aquí cuando te inscribas en un curso.
            </p>
        </div>
    `;
}

// Cargar progreso
async function loadProgress(userId) {
    const progressSection = document.getElementById('progress-section');
    if (!progressSection) return;

    try {
        const { data: stats, error } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;

        progressSection.innerHTML = `
            <div class="section-title">
                <h2><i class="fas fa-trophy"></i> Mi Progreso</h2>
            </div>
            <div class="progress-container">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-content">
                            <p class="stat-label">Lecciones Completadas</p>
                            <h3 class="stat-value">${stats.completed_lessons || 0}</h3>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-content">
                            <p class="stat-label">Horas de Estudio</p>
                            <h3 class="stat-value">${stats.study_hours || 0}</h3>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div class="stat-content">
                            <p class="stat-label">Racha Actual</p>
                            <h3 class="stat-value">${stats.current_streak || 0}</h3>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="stat-content">
                            <p class="stat-label">Puntos Totales</p>
                            <h3 class="stat-value">${stats.total_points || 0}</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error al cargar progreso:', error);
    }
}

// Cargar profesores
async function loadTeachers() {
    try {
        const { data: teachers, error } = await supabaseClient
            .from('teachers')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        const teachersSection = document.getElementById('teachers-section');
        
        teachersSection.innerHTML = `
            <div class="section-title">
                <h2><i class="fas fa-chalkboard-teacher"></i> Profesores</h2>
            </div>
            <div class="teachers-grid">
                ${teachers && teachers.length > 0 ? teachers.map(teacher => `
                    <div class="dashboard-card teacher-card">
                        <div class="teacher-avatar">
                            ${teacher.avatar_url ? 
                                `<img src="${teacher.avatar_url}" alt="${teacher.full_name}">` :
                                `<div class="avatar-placeholder">${teacher.full_name.charAt(0)}</div>`
                            }
                        </div>
                        <h3>${teacher.full_name}</h3>
                        <p class="teacher-spec">${teacher.specialization}</p>
                        <div class="teacher-rating">
                            <i class="fas fa-star"></i> ${teacher.rating} 
                            <span>(${teacher.total_reviews} reseñas)</span>
                        </div>
                        <div class="teacher-languages">
                            ${teacher.languages ? teacher.languages.map(lang => 
                                `<span class="language-badge">${lang}</span>`
                            ).join('') : ''}
                        </div>
                        <p class="teacher-bio">${teacher.bio || 'Profesor experimentado'}</p>
                        <button class="btn-primary schedule-class-btn" data-teacher-id="${teacher.id}">
                            <i class="fas fa-calendar"></i> Agendar Clase
                        </button>
                    </div>
                `).join('') : '<p class="loading-message">No hay profesores disponibles</p>'}
            </div>
        `;

        // Agregar event listeners
        document.querySelectorAll('.schedule-class-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const teacherId = this.getAttribute('data-teacher-id');
                scheduleClass(teacherId);
            });
        });
    } catch (error) {
        console.error('Error al cargar profesores:', error);
    }
}

// Cargar mensajes
function loadMessages() {
    const messagesSection = document.getElementById('messages-section');
    if (!messagesSection) return;

    messagesSection.innerHTML = `
        <div class="section-title">
            <h2><i class="fas fa-comments"></i> Mensajes</h2>
        </div>
        <div class="messages-container">
            <p style="text-align: center; color: var(--text-secondary); padding: 3rem;">
                Sistema de mensajería próximamente disponible
            </p>
        </div>
    `;
}

// Inscribirse en un curso
async function enrollCourse(courseId, userId) {
    try {
        // Verificar si ya está inscrito
        const { data: existing, error: checkError } = await supabaseClient
            .from('user_courses')
            .select('*')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .single();

        if (existing) {
            alert('Ya estás inscrito en este curso');
            return;
        }

        const { data, error } = await supabaseClient
            .from('user_courses')
            .insert([
                {
                    user_id: userId,
                    course_id: courseId,
                    progress_percentage: 0,
                    is_active: true
                }
            ])
            .select();

        if (error) throw error;

        // Registrar actividad
        await supabaseClient
            .from('user_activities')
            .insert([
                {
                    user_id: userId,
                    activity_type: 'Nuevo curso',
                    description: 'Te inscribiste en un nuevo curso',
                    points_earned: 10
                }
            ]);

        alert('¡Te has inscrito exitosamente en el curso! 🎉');
        
        // Recargar cursos activos y cambiar a dashboard
        await loadActiveCourses(userId);
        document.querySelector('.nav-item[data-section="dashboard"]').click();
        
    } catch (error) {
        console.error('Error al inscribirse:', error);
        alert('Error al inscribirse en el curso. Por favor intenta de nuevo.');
    }
}

// Continuar curso
function continueCourse(courseId) {
    alert('Abriendo lecciones del curso... (Funcionalidad en desarrollo)');
    // Aquí implementarías la navegación a las lecciones del curso
}

// Unirse a clase
function joinClass(meetingUrl) {
    if (meetingUrl && meetingUrl !== '#') {
        window.open(meetingUrl, '_blank');
    } else {
        alert('El enlace de la reunión estará disponible 10 minutos antes de la clase');
    }
}

// Agendar clase
async function scheduleClass(teacherId) {
    const user = window.currentUser;
    if (!user) return;

    // Aquí podrías implementar un modal para seleccionar fecha/hora
    const confirmSchedule = confirm('¿Deseas agendar una clase con este profesor?');
    
    if (confirmSchedule) {
        try {
            // Crear clase de ejemplo (en producción tendrías un formulario)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(15, 0, 0, 0);

            const { error } = await supabaseClient
                .from('user_classes')
                .insert([
                    {
                        user_id: user.id,
                        teacher_id: teacherId,
                        class_name: 'Clase de Conversación',
                        class_date: tomorrow.toISOString(),
                        duration_minutes: 60,
                        status: 'scheduled'
                    }
                ]);

            if (error) throw error;

            alert('¡Clase agendada exitosamente! 📅');
            await loadUpcomingClasses(user.id);
            document.querySelector('.nav-item[data-section="dashboard"]').click();
            
        } catch (error) {
            console.error('Error al agendar clase:', error);
            alert('Error al agendar la clase');
        }
    }
}

// Configurar botón explorar más cursos
function setupExploreCourses() {
    const exploreBtn = document.getElementById('btnExploreMoreCourses');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', function() {
            const user = window.currentUser;
            if (user) {
                loadAllCourses(user.id);
            }
        });
    }
}

// Configurar settings
function setupSettings(user) {
    const profileForm = document.getElementById('profileForm');
    const settingsEmail = document.getElementById('settingsEmail');
    const settingsFullName = document.getElementById('settingsFullName');
    const settingsBio = document.getElementById('settingsBio');

    if (user) {
        settingsEmail.value = user.email;
        if (user.user_metadata && user.user_metadata.full_name) {
            settingsFullName.value = user.user_metadata.full_name;
        }

        // Cargar perfil existente
        supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()
            .then(({ data, error }) => {
                if (data) {
                    if (data.full_name) settingsFullName.value = data.full_name;
                    if (data.bio) settingsBio.value = data.bio;
                }
            });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = settingsFullName.value;
            const bio = settingsBio.value;

            try {
                // Actualizar perfil en user_profiles
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .upsert([
                        {
                            user_id: user.id,
                            full_name: fullName,
                            email: user.email,
                            bio: bio
                        }
                    ]);

                if (error) throw error;

                // Actualizar metadata del usuario
                const { error: updateError } = await supabaseClient.auth.updateUser({
                    data: { full_name: fullName }
                });

                if (updateError) throw updateError;

                alert('¡Perfil actualizado exitosamente! ✅');
                
                // Actualizar display del nombre
                user.user_metadata.full_name = fullName;
                displayUserInfo(user);
            } catch (error) {
                console.error('Error al actualizar perfil:', error);
                alert('Error al actualizar perfil');
            }
        });
    }
}

// ==================== FUNCIONES AUXILIARES ====================

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

function getActivityIconClass(type) {
    const icons = {
        'Lección completada': 'fas fa-check',
        'Logro desbloqueado': 'fas fa-trophy',
        'Quiz completado': 'fas fa-file-alt',
        'Clase asistida': 'fas fa-video',
        'Nuevo curso': 'fas fa-book'
    };
    return icons[type] || 'fas fa-bell';
}

function getActivityClass(type) {
    const classes = {
        'Lección completada': 'success',
        'Logro desbloqueado': 'trophy',
        'Quiz completado': 'quiz',
        'Clase asistida': '',
        'Nuevo curso': ''
    };
    return classes[type] || '';
}
