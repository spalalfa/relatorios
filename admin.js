(() => {
    "use strict";

    const supabase = window.supabaseClient;

    const STATUS = window.STATUS || {
        WAITING_CONFERENCE: "AGUARDANDO CONFERÊNCIA",
        RELEASED: "LIBERADA"
    };

    let currentUser = null;
    let selectedFile = null;
    let parsedProcesses = [];

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];

    /* =========================================================
       UTILITÁRIOS
    ========================================================= */

    function showMessage(message = "", type = "error") {
        const element = $("#loginMessage");

        if (!element) return;

        element.textContent = message;
        element.className = `login-message ${type}`;
        element.hidden = !message;
    }

    function showToast(message, type = "success") {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
            return;
        }

        const container = $("#toastContainer");

        if (!container) return;

        const toast = document.createElement("div");

        toast.className = `toast ${type}`;

        toast.innerHTML = `
            <div class="toast-content">
                ${escapeHtml(message)}
            </div>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        setTimeout(() => {
            toast.classList.remove("show");

            setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }

    function escapeHtml(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function todayISO() {
        const date = new Date();

        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }


    /* =========================================================
       LOGIN
    ========================================================= */

    /*
     * IMPORTANTE:
     *
     * Este é um painel HTML separado para administração.
     *
     * Portanto, qualquer usuário que consiga autenticar
     * nesta página será tratado como administrador.
     *
     * Não vamos depender de:
     *
     * user.app_metadata.role
     *
     * porque isso estava fazendo o login entrar no Supabase
     * e imediatamente voltar para a tela de login.
     */

    function isAdminUser(user) {
        return !!user;
    }


    async function login(event) {

        if (event) {
            event.preventDefault();
        }

        const email =
            $("#loginEmail")?.value.trim();

        const password =
            $("#loginPassword")?.value || "";

        if (!email || !password) {
            showMessage(
                "Informe seu e-mail e senha.",
                "error"
            );

            return;
        }

        if (!supabase) {
            showMessage(
                "Supabase não foi carregado.",
                "error"
            );

            console.error(
                "window.supabaseClient não encontrado."
            );

            return;
        }

        const button = $("#loginBtn");

        if (button) {
            button.disabled = true;
            button.textContent = "Entrando...";
        }

        showMessage("");

        try {

            const {
                data,
                error
            } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error(
                    "Erro Supabase:",
                    error
                );

                showMessage(
                    error.message ||
                    "E-mail ou senha inválidos.",
                    "error"
                );

                if (button) {
                    button.disabled = false;
                    button.textContent = "Entrar";
                }

                return;
            }

            currentUser =
                data?.user || null;

            if (!currentUser) {
                throw new Error(
                    "O Supabase não retornou o usuário."
                );
            }

            console.log(
                "LOGIN REALIZADO:",
                currentUser
            );

            /*
             * MOSTRA O PAINEL IMEDIATAMENTE.
             */

            showAdminApp();

            if (button) {
                button.disabled = false;
                button.textContent = "Entrar";
            }

        } catch (error) {

            console.error(
                "Erro ao fazer login:",
                error
            );

            showMessage(
                error.message ||
                "Não foi possível entrar.",
                "error"
            );

            if (button) {
                button.disabled = false;
                button.textContent = "Entrar";
            }
        }
    }


    /* =========================================================
       MOSTRAR / ESCONDER PAINEL
    ========================================================= */

    function showLogin() {

        const login =
            $("#loginScreen");

        const app =
            $("#app");

        if (login) {

            login.hidden = false;

            login.style.display = "grid";
        }

        if (app) {

            app.hidden = true;

            app.style.display = "none";
        }
    }


    function showAdminApp() {

        if (!currentUser) {
            showLogin();
            return;
        }

        const login =
            $("#loginScreen");

        const app =
            $("#app");


        /*
         * Aqui usamos BOTH:
         *
         * hidden
         * +
         * display
         *
         * para não depender de nenhuma regra CSS.
         */

        if (login) {

            login.hidden = true;

            login.style.display = "none";
        }


        if (app) {

            app.hidden = false;

            app.style.display = "block";
        }


        /*
         * Usuário.
         */

        const email =
            $("#userEmail");

        if (email) {

            email.textContent =
                currentUser.email ||
                "Administrador";
        }


        const avatar =
            $("#userAvatar");

        if (avatar) {

            avatar.textContent =
                (
                    currentUser.email?.charAt(0) ||
                    "A"
                ).toUpperCase();
        }


        /*
         * Garante que o Dashboard esteja aberto.
         */

        navigateTo("dashboard");


        /*
         * Carrega os dados somente depois
         * do login.
         */

        if (
            typeof window.loadAllData ===
            "function"
        ) {

            window.loadAllData()
                .catch(error => {

                    console.error(
                        "Erro ao carregar dados:",
                        error
                    );
                });
        }
    }


    /* =========================================================
       SESSÃO
    ========================================================= */

    async function checkSession() {

        if (!supabase) {
            showLogin();
            return;
        }

        try {

            const {
                data,
                error
            } = await supabase.auth.getSession();

            if (error) {
                throw error;
            }

            const session =
                data?.session;

            if (
                session &&
                session.user
            ) {

                currentUser =
                    session.user;

                showAdminApp();

            } else {

                currentUser = null;

                showLogin();
            }

        } catch (error) {

            console.error(
                "Erro ao verificar sessão:",
                error
            );

            currentUser = null;

            showLogin();
        }
    }


    /* =========================================================
       LOGOUT
    ========================================================= */

    async function logout() {

        try {

            if (supabase) {
                await supabase.auth.signOut();
            }

        } catch (error) {

            console.error(
                "Erro ao sair:",
                error
            );
        }

        currentUser = null;

        showLogin();

        const password =
            $("#loginPassword");

        if (password) {
            password.value = "";
        }
    }


    /* =========================================================
       RECUPERAR SENHA
    ========================================================= */

    async function forgotPassword() {

        const email =
            $("#loginEmail")?.value.trim();

        if (!email) {

            showMessage(
                "Informe seu e-mail primeiro.",
                "error"
            );

            return;
        }

        try {

            const {
                error
            } =
                await supabase.auth
                    .resetPasswordForEmail(
                        email,
                        {
                            redirectTo:
                                window.location.origin +
                                window.location.pathname
                        }
                    );

            if (error) {
                throw error;
            }

            showMessage(
                "Link de recuperação enviado.",
                "success"
            );

        } catch (error) {

            console.error(
                error
            );

            showMessage(
                "Não foi possível enviar o e-mail.",
                "error"
            );
        }
    }


    /* =========================================================
       NAVEGAÇÃO
    ========================================================= */

    function navigateTo(viewName) {

        const sections =
            $$(".view-section");

        sections.forEach(section => {

            const active =
                section.id ===
                `view-${viewName}`;

            section.classList.toggle(
                "active",
                active
            );

            /*
             * Força display para impedir
             * conflito com CSS.
             */

            section.style.display =
                active
                    ? "block"
                    : "none";
        });


        const navItems =
            $$(".nav-item");

        navItems.forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.view === viewName
            );
        });


        const titles = {

            dashboard:
                "Dashboard",

            processos:
                "Processos",

            relatorios:
                "Relatórios",

            ecolab:
                "ECOLAB",

            importar:
                "Importar relatório"
        };


        const pageTitle =
            $("#pageTitle");

        if (pageTitle) {

            pageTitle.textContent =
                titles[viewName] ||
                "ALFA";
        }


        const sidebar =
            $("#sidebar");

        if (sidebar) {

            sidebar.classList.remove(
                "mobile-open"
            );
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    function setupNavigation() {

        $$(".nav-item")
            .forEach(item => {

                /*
                 * Remove possível comportamento de link.
                 */

                item.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        const view =
                            item.dataset.view;

                        if (view) {
                            navigateTo(view);
                        }
                    }
                );
            });


        /*
         * Menu mobile.
         */

        const toggle =
            $("#sidebarToggle");

        const sidebar =
            $("#sidebar");

        if (
            toggle &&
            sidebar
        ) {

            toggle.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    sidebar.classList.toggle(
                        "mobile-open"
                    );
                }
            );
        }
    }


    /* =========================================================
       BOTÕES DE NAVEGAÇÃO
    ========================================================= */

    function setupActionButtons() {

        const topImport =
            $("#topImportBtn");

        if (topImport) {

            topImport.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    navigateTo(
                        "importar"
                    );
                }
            );
        }


        const newReport =
            $("#newReportBtn");

        if (newReport) {

            newReport.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    navigateTo(
                        "importar"
                    );
                }
            );
        }


        /*
         * Botões "Ver todos".
         */

        $$("[data-view-target]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        const view =
                            button.dataset
                                .viewTarget;

                        if (view) {
                            navigateTo(view);
                        }
                    }
                );
            });
    }


    /* =========================================================
       DROPZONE
    ========================================================= */

    function setupDropzone() {

        const dropzone =
            $("#dropzone");

        const input =
            $("#wordFile");

        if (
            !dropzone ||
            !input
        ) {
            return;
        }


        dropzone.addEventListener(
            "click",
            event => {

                if (
                    event.target === input
                ) {
                    return;
                }

                input.click();
            }
        );


        input.addEventListener(
            "change",
            event => {

                const file =
                    event.target.files?.[0];

                if (file) {
                    selectedFile =
                        file;

                    showSelectedFile(
                        file
                    );
                }
            }
        );


        dropzone.addEventListener(
            "dragover",
            event => {

                event.preventDefault();

                dropzone.classList.add(
                    "dragging"
                );
            }
        );


        dropzone.addEventListener(
            "dragleave",
            event => {

                event.preventDefault();

                dropzone.classList.remove(
                    "dragging"
                );
            }
        );


        dropzone.addEventListener(
            "drop",
            event => {

                event.preventDefault();

                dropzone.classList.remove(
                    "dragging"
                );

                const file =
                    event.dataTransfer
                        ?.files?.[0];

                if (!file) return;

                if (
                    !file.name
                        .toLowerCase()
                        .endsWith(".docx")
                ) {

                    showToast(
                        "Selecione um arquivo .DOCX.",
                        "error"
                    );

                    return;
                }

                selectedFile =
                    file;

                showSelectedFile(
                    file
                );
            }
        );
    }


    function showSelectedFile(file) {

        const preview =
            $("#filePreview");

        if (!preview) return;

        const size =
            (file.size / 1024)
                .toFixed(1);

        preview.innerHTML = `
            <div class="file-preview-icon">
                DOC
            </div>

            <div class="file-preview-info">

                <strong>
                    ${escapeHtml(file.name)}
                </strong>

                <span>
                    ${size} KB
                </span>

            </div>
        `;

        preview.classList.add(
            "visible"
        );
    }


    /* =========================================================
       REGISTRAR SENHA
    ========================================================= */

    async function registerPassword(
        reportId
    ) {

        const password =
            window.prompt(
                "Digite a senha gerada para este relatório:"
            );

        if (!password) {
            return;
        }

        try {

            const now =
                new Date().toISOString();

            const {
                error
            } =
                await supabase
                    .from("relatorios")
                    .update({

                        password:
                            password.trim(),

                        password_generated_at:
                            now,

                        status:
                            STATUS.WAITING_CONFERENCE,

                        updated_at:
                            now

                    })
                    .eq(
                        "id",
                        reportId
                    );

            if (error) {
                throw error;
            }

            showToast(
                "Senha registrada. O relatório continua aguardando conferência.",
                "success"
            );

            await window.loadAllData?.();

        } catch (error) {

            console.error(
                error
            );

            showToast(
                error.message ||
                "Erro ao registrar senha.",
                "error"
            );
        }
    }


    /* =========================================================
       LIBERAR RELATÓRIO
    ========================================================= */

    async function releaseReport(
        reportId
    ) {

        const confirmed =
            window.confirm(
                "Deseja realmente liberar este relatório?"
            );

        if (!confirmed) {
            return;
        }

        try {

            const {
                data: report,
                error: findError
            } =
                await supabase
                    .from("relatorios")
                    .select(
                        "id,password,status"
                    )
                    .eq(
                        "id",
                        reportId
                    )
                    .single();

            if (findError) {
                throw findError;
            }

            if (!report.password) {

                showToast(
                    "Registre a senha antes de liberar.",
                    "error"
                );

                return;
            }

            const now =
                new Date().toISOString();

            const {
                error
            } =
                await supabase
                    .from("relatorios")
                    .update({

                        status:
                            STATUS.RELEASED,

                        password_released_at:
                            now,

                        updated_at:
                            now

                    })
                    .eq(
                        "id",
                        reportId
                    );

            if (error) {
                throw error;
            }

            showToast(
                "Relatório liberado com sucesso.",
                "success"
            );

            await window.loadAllData?.();

        } catch (error) {

            console.error(
                error
            );

            showToast(
                error.message ||
                "Erro ao liberar relatório.",
                "error"
            );
        }
    }


    /* =========================================================
       RESET
    ========================================================= */

    function resetImportForm() {

        selectedFile = null;

        parsedProcesses = [];


        const input =
            $("#wordFile");

        if (input) {
            input.value = "";
        }


        const preview =
            $("#filePreview");

        if (preview) {

            preview.innerHTML = "";

            preview.classList.remove(
                "visible"
            );
        }


        const date =
            $("#reportDate");

        if (date) {
            date.value =
                todayISO();
        }


        const button =
            $("#importBtn");

        if (button) {

            button.disabled = true;

            button.textContent =
                "Importar relatório";
        }
    }


    /* =========================================================
       EVENTOS
    ========================================================= */

    function setupEvents() {

        const form =
            $("#loginForm");

        if (form) {

            form.addEventListener(
                "submit",
                login
            );
        }


        const logoutButton =
            $("#logoutBtn");

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logout
            );
        }


        const forgotButton =
            $("#forgotPasswordBtn");

        if (forgotButton) {

            forgotButton.addEventListener(
                "click",
                forgotPassword
            );
        }


        const password =
            $("#loginPassword");

        if (password) {

            password.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        login(event);
                    }
                }
            );
        }


        const reset =
            $("#resetImportBtn");

        if (reset) {

            reset.addEventListener(
                "click",
                resetImportForm
            );
        }


        setupNavigation();

        setupActionButtons();

        setupDropzone();
    }


    /* =========================================================
       EXPORTAR
    ========================================================= */

    window.login =
        login;

    window.logout =
        logout;

    window.forgotPassword =
        forgotPassword;

    window.navigateTo =
        navigateTo;

    window.registerPassword =
        registerPassword;

    window.releaseReport =
        releaseReport;

    window.resetImportForm =
        resetImportForm;


    /* =========================================================
       INICIALIZAÇÃO
    ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            console.log(
                "ALFA ADMIN • inicializando"
            );

            setupEvents();

            const reportDate =
                $("#reportDate");

            if (
                reportDate &&
                !reportDate.value
            ) {

                reportDate.value =
                    todayISO();
            }

            checkSession();
        }
    );

})();