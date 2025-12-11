document.addEventListener('DOMContentLoaded', function () {
    // Redirigir si ya está autenticado
    redirectIfAuthenticated();

    const container = document.querySelector('.container');
    const signUpBtn = document.getElementById('sign-up-btn');
    const signInBtn = document.getElementById('sign-in-btn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');

    // Alternar entre formularios
    signUpBtn.addEventListener('click', () => {
        container.classList.add('sign-up-mode');
    });

    signInBtn.addEventListener('click', () => {
        container.classList.remove('sign-up-mode');
    });

    // Toggle password visibility
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function () {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.textContent = '🙈';
            } else {
                input.type = 'password';
                this.textContent = '👁️';
            }
        });
    });

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageDiv = document.getElementById('loginMessage');

        try {
            messageDiv.textContent = 'Iniciando sesión...';
            messageDiv.className = 'message';
            messageDiv.style.display = 'block';

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            messageDiv.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
            messageDiv.className = 'message success';

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            console.error('Error en login:', error);
            messageDiv.textContent = error.message || 'Error al iniciar sesión. Por favor verifica tus credenciales.';
            messageDiv.className = 'message error';
        }
    });

    // Register Form Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const messageDiv = document.getElementById('registerMessage');

        // Validaciones
        if (!acceptTerms) {
            messageDiv.textContent = 'Debes aceptar los términos y condiciones';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            return;
        }

        if (password !== confirmPassword) {
            messageDiv.textContent = 'Las contraseñas no coinciden';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            return;
        }

        if (password.length < 6) {
            messageDiv.textContent = 'La contraseña debe tener al menos 6 caracteres';
            messageDiv.className = 'message error';
            messageDiv.style.display = 'block';
            return;
        }

        try {
            messageDiv.textContent = 'Creando cuenta...';
            messageDiv.className = 'message';
            messageDiv.style.display = 'block';

            // Registrar usuario
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });

            if (authError) throw authError;

            // Crear perfil de usuario
            if (authData.user) {
                const { error: profileError } = await supabaseClient
                    .from('user_profiles')
                    .insert([
                        {
                            user_id: authData.user.id,
                            full_name: name,
                            email: email
                        }
                    ]);

                if (profileError && profileError.code !== '23505') { // Ignorar error de duplicado
                    console.error('Error al crear perfil:', profileError);
                }
            }

            messageDiv.textContent = '¡Cuenta creada exitosamente! Verifica tu email y luego inicia sesión.';
            messageDiv.className = 'message success';

            // Limpiar formulario
            registerForm.reset();

            // Cambiar a formulario de login después de 3 segundos
            setTimeout(() => {
                container.classList.remove('sign-up-mode');
                messageDiv.style.display = 'none';
            }, 3000);

        } catch (error) {
            console.error('Error en registro:', error);
            messageDiv.textContent = error.message || 'Error al crear la cuenta. Por favor intenta nuevamente.';
            messageDiv.className = 'message error';
        }
    });

    // Login con Google
    const googleLoginBtns = [
        document.getElementById('googleLogin'),
        document.getElementById('googleRegister')
    ];

    googleLoginBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                try {
                    const { data, error } = await supabaseClient.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: `${window.location.origin}/dashboard.html`
                        }
                    });

                    if (error) throw error;
                } catch (error) {
                    console.error('Error con Google login:', error);
                    alert('Error al iniciar sesión con Google');
                }
            });
        }
    });

    // Login con GitHub
    const githubLoginBtns = [
        document.getElementById('githubLogin'),
        document.getElementById('githubRegister')
    ];

    githubLoginBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                try {
                    const { data, error } = await supabaseClient.auth.signInWithOAuth({
                        provider: 'github',
                        options: {
                            redirectTo: `${window.location.origin}/dashboard.html`
                        }
                    });

                    if (error) throw error;
                } catch (error) {
                    console.error('Error con GitHub login:', error);
                    alert('Error al iniciar sesión con GitHub');
                }
            });
        }
    });

    // Forgot Password
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;

            if (!email) {
                alert('Por favor ingresa tu email primero');
                return;
            }

            try {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password.html`
                });

                if (error) throw error;

                alert('Se ha enviado un link de recuperación a tu email');
            } catch (error) {
                console.error('Error al resetear contraseña:', error);
                alert('Error al enviar email de recuperación');
            }
        });
    }
});
