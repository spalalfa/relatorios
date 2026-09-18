/* =========================================================
   ALFA TRANSPORTES • CONTROLE OPERACIONAL
   APP.JS
========================================================= */

const SUPABASE_URL =
    "https://ewawkukleqboozavhovb.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_WQ_vLGpDP9aveeUOtDNNJw_8Kg7L73y";


/* =========================================================
   ESTADO GLOBAL
========================================================= */

let supabaseClient = null;

let currentUser = null;
let currentSession = null;

let reports = [];
let processes = [];

let selectedWordFile = null;
let importedWordData = null;

let currentReport = null;

let isInitialized = false;
let isStartingSession = false;
let authSubscription = null;


/* =========================================================
   STATUS
========================================================= */

const STATUS = {
    WAITING_CONFERENCE: "AGUARDANDO CONFERÊNCIA",
    WAITING_RELEASE: "AGUARDANDO LIBERAÇÃO",
    RELEASED: "LIBERADA"
};


/* =========================================================
   ELEMENTOS
========================================================= */

const $ = (selector) => {
    return document.querySelector(selector);
};

const $$ = (selector) => {
    return [...document.querySelectorAll(selector)];
};


/* =========================================================
   UTILITÁRIOS
========================================================= */

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}


function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("pt-BR");
}


function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function todayISO() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function nowISO() {
    return new Date().toISOString();
}


function truncate(value, length = 80) {
    const text = String(value ?? "");

    if (text.length <= length) {
        return text;
    }

    return `${text.substring(0, length)}...`;
}


function getInitials(value) {
    const text = String(value ?? "").trim();

    if (!text) {
        return "A";
    }

    const parts = text.split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


/* =========================================================
   STATUS
========================================================= */

function normalizeStatus(status) {
    const normalized = normalizeText(status);

    if (
        normalized === normalizeText(STATUS.RELEASED) ||
        normalized === "liberado" ||
        normalized === "liberada"
    ) {
        return STATUS.RELEASED;
    }

    if (
        normalized === normalizeText(STATUS.WAITING_RELEASE) ||
        normalized === "aguardando liberacao" ||
        normalized === "aguardando senha"
    ) {
        return STATUS.WAITING_RELEASE;
    }

    return STATUS.WAITING_CONFERENCE;
}


function statusClass(status) {
    const normalized = normalizeStatus(status);

    if (normalized === STATUS.RELEASED) {
        return "success released";
    }

    if (normalized === STATUS.WAITING_RELEASE) {
        return "pending info";
    }

    return "waiting warning";
}


function statusBadge(status) {
    const normalized = normalizeStatus(status);

    return `
        <span class="status-badge ${statusClass(normalized)}">
            ${escapeHtml(normalized)}
        </span>
    `;
}


/* =========================================================
   IDENTIFICAÇÃO DO RELATÓRIO
========================================================= */

function reportNumber(report) {
    if (
        report &&
        report.report_number !== null &&
        report.report_number !== undefined &&
        report.report_number !== ""
    ) {
        return String(report.report_number);
    }

    return "—";
}


function reportLabel(report) {
    if (!report) {
        return "Relatório";
    }

    const number = reportNumber(report);

    return `Relatório #${number}`;
}


function reportTitle(report) {
    if (!report) {
        return "Relatório";
    }

    return `Relatório #${reportNumber(report)}`;
}


/* =========================================================
   TOAST
========================================================= */

let toastTimeout = null;

function showToast(message, type = "success") {
    let toast = $("#toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.className = `toast ${type}`;

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* =========================================================
   MENSAGENS
========================================================= */

function setMessage(element, message, type = "error") {
    if (!element) {
        return;
    }

    element.textContent = message || "";

    element.classList.remove(
        "success",
        "error",
        "warning"
    );

    if (message) {
        element.classList.add(type);
    }
}


/* =========================================================
   INICIALIZAÇÃO SUPABASE
========================================================= */

function initializeSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }

    if (
        typeof window.supabase === "undefined" ||
        !window.supabase.createClient
    ) {
        console.error(
            "Supabase JS não foi carregado."
        );

        return null;
    }

    supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

    return supabaseClient;
}


/* =========================================================
   AUTENTICAÇÃO
========================================================= */

async function initializeAuth() {
    if (!supabaseClient) {
        return;
    }

    if (isStartingSession) {
        return;
    }

    isStartingSession = true;

    try {
        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error(
                "Erro ao obter sessão:",
                error
            );
        }

        currentSession =
            data?.session || null;

        currentUser =
            currentSession?.user || null;

        updateAuthUI();

        if (currentUser) {
            await initializeApplication();
        } else {
            showLoginScreen();
        }
    } finally {
        isStartingSession = false;
    }

    if (!authSubscription) {
        const result =
            supabaseClient.auth.onAuthStateChange(
                async (event, session) => {
                    currentSession =
                        session || null;

                    currentUser =
                        session?.user || null;

                    updateAuthUI();

                    if (
                        event === "SIGNED_IN" &&
                        currentUser
                    ) {
                        await initializeApplication();
                    }

                    if (
                        event === "SIGNED_OUT"
                    ) {
                        showLoginScreen();
                    }
                }
            );

        authSubscription =
            result?.data?.subscription || null;
    }
}


/* =========================================================
   LOGIN UI
========================================================= */

function showLoginScreen() {
    const loginScreen = $("#loginScreen");
    const app = $("#app");

    if (loginScreen) {
        loginScreen.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }

    closeSidebar();
}


function showApplication() {
    const loginScreen = $("#loginScreen");
    const app = $("#app");

    if (loginScreen) {
        loginScreen.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }
}


function updateAuthUI() {
    const emailElement = $("#userEmail");
    const roleElement = $("#userRole");
    const avatarElement = $("#userAvatar");

    const email =
        currentUser?.email || "Usuário";

    if (emailElement) {
        emailElement.textContent = email;
    }

    if (roleElement) {
        roleElement.textContent = "Administrador";
    }

    if (avatarElement) {
        avatarElement.textContent =
            getInitials(email);
    }
}


/* =========================================================
   LOGIN
========================================================= */

async function handleLogin(event) {
    event.preventDefault();

    if (!supabaseClient) {
        return;
    }

    const emailInput = $("#email");
    const passwordInput = $("#password");
    const message = $("#loginMessage");

    const email =
        emailInput?.value.trim() || "";

    const password =
        passwordInput?.value || "";

    if (!email || !password) {
        setMessage(
            message,
            "Informe seu e-mail e senha.",
            "error"
        );

        return;
    }

    setMessage(message, "");

    const button =
        $("#loginForm button[type='submit']");

    if (button) {
        button.disabled = true;
        button.dataset.originalText =
            button.textContent;
        button.textContent =
            "Entrando...";
    }

    try {
        const {
            data,
            error
        } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        currentSession =
            data?.session || null;

        currentUser =
            data?.user || null;

        showApplication();

        await initializeApplication();

    } catch (error) {
        console.error(
            "Erro no login:",
            error
        );

        setMessage(
            message,
            error?.message ||
            "Não foi possível entrar.",
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;

            button.textContent =
                button.dataset.originalText ||
                "Entrar";
        }
    }
}


/* =========================================================
   RECUPERAÇÃO DE SENHA
========================================================= */

async function handleForgotPassword(event) {
    event.preventDefault();

    if (!supabaseClient) {
        return;
    }

    const email =
        $("#email")?.value.trim();

    const message =
        $("#loginMessage");

    if (!email) {
        setMessage(
            message,
            "Informe seu e-mail para receber o link de recuperação.",
            "error"
        );

        return;
    }

    try {
        const {
            error
        } =
            await supabaseClient.auth.resetPasswordForEmail(
                email
            );

        if (error) {
            throw error;
        }

        setMessage(
            message,
            "Se o e-mail estiver cadastrado, o link de recuperação será enviado.",
            "success"
        );
    } catch (error) {
        console.error(error);

        setMessage(
            message,
            error?.message ||
            "Não foi possível solicitar a recuperação.",
            "error"
        );
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function handleLogout() {
    if (!supabaseClient) {
        return;
    }

    try {
        await supabaseClient.auth.signOut();
    } catch (error) {
        console.error(
            "Erro ao sair:",
            error
        );
    }
}


/* =========================================================
   INICIALIZAÇÃO DA APLICAÇÃO
========================================================= */

async function initializeApplication() {
    if (isInitialized) {
        showApplication();
        return;
    }

    showApplication();

    try {
        await loadAllData();

        updateDashboard();

        navigateTo("dashboard");

        isInitialized = true;

    } catch (error) {
        console.error(
            "Erro ao inicializar aplicação:",
            error
        );

        showToast(
            "Não foi possível carregar os dados.",
            "error"
        );
    }
}


/* =========================================================
   CARREGAR TODOS OS DADOS
========================================================= */

async function loadAllData() {
    await loadReports();
    await loadProcesses();

    renderReports();
    renderProcesses();
    renderEcolab();

    updateDashboard();
}


/* =========================================================
   RELATÓRIOS
========================================================= */

async function loadReports() {
    if (!supabaseClient) {
        return;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from("relatorios")
            .select(`
                id,
                report_number,
                report_date,
                imported_at,
                password,
                status,
                created_by,
                created_at,
                updated_at,
                password_generated_at,
                password_released_at
            `)
            .order(
                "report_date",
                {
                    ascending: false
                }
            );

    if (error) {
        console.error(
            "Erro ao carregar relatórios:",
            error
        );

        throw error;
    }

    reports =
        (data || []).map(report => ({
            ...report,
            status:
                normalizeStatus(report.status)
        }));
}


/* =========================================================
   PROCESSOS
========================================================= */

async function loadProcesses() {
    if (!supabaseClient) {
        return;
    }

    const {
        data,
        error
    } =
        await supabaseClient
            .from("processos")
            .select(`
                id,
                report_id,
                data,
                cte,
                nf,
                cliente,
                volume,
                acr,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {
        console.error(
            "Erro ao carregar processos:",
            error
        );

        throw error;
    }

    processes =
        (data || []).map(process => {
            const report =
                reports.find(
                    item =>
                        item.id ===
                        process.report_id
                );

            return {
                ...process,
                report:
                    report || null
            };
        });
}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {
    const totalReports =
        reports.length;

    const totalProcesses =
        processes.length;

    const waitingConference =
        reports.filter(
            report =>
                normalizeStatus(
                    report.status
                ) ===
                STATUS.WAITING_CONFERENCE
        ).length;

    const released =
        reports.filter(
            report =>
                normalizeStatus(
                    report.status
                ) ===
                STATUS.RELEASED
        ).length;

    const waitingRelease =
        reports.filter(
            report =>
                normalizeStatus(
                    report.status
                ) ===
                STATUS.WAITING_RELEASE
        ).length;

    setText(
        "#statReports",
        totalReports
    );

    setText(
        "#statProcesses",
        totalProcesses
    );

    setText(
        "#statWaiting",
        waitingConference
    );

    setText(
        "#statReleased",
        released
    );

    renderRecentReports();

    updateConnectionStatus(
        true,
        waitingRelease
    );
}


function setText(selector, value) {
    const element =
        $(selector);

    if (element) {
        element.textContent =
            String(value ?? "");
    }
}


function updateConnectionStatus(
    connected,
    waitingRelease = 0
) {
    const element =
        $("#connectionText");

    if (!element) {
        return;
    }

    if (connected) {
        element.textContent =
            `Conectado • ${waitingRelease} aguardando liberação`;
    } else {
        element.textContent =
            "Sem conexão";
    }
}


/* =========================================================
   RELATÓRIOS RECENTES
========================================================= */

function renderRecentReports() {
    const container =
        $("#recentReports");

    if (!container) {
        return;
    }

    if (!reports.length) {
        container.innerHTML = `
            <div class="empty">
                Nenhum relatório cadastrado.
            </div>
        `;

        return;
    }

    const recent =
        reports.slice(0, 6);

    container.innerHTML = `
        <div class="table-wrap">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nº</th>
                        <th>Relatório</th>
                        <th>Data</th>
                        <th>Status</th>
                    </tr>
                </thead>

                <tbody>
                    ${recent.map(report => `
                        <tr
                            class="clickable"
                            data-report-id="${escapeHtml(report.id)}"
                        >
                            <td>
                                <span class="report-number">
                                    ${escapeHtml(reportNumber(report))}
                                </span>
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(reportTitle(report))}
                                </strong>
                            </td>

                            <td>
                                ${escapeHtml(
                                    formatDate(
                                        report.report_date
                                    )
                                )}
                            </td>

                            <td>
                                ${statusBadge(report.status)}
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    container
        .querySelectorAll(
            "tr[data-report-id]"
        )
        .forEach(row => {
            row.addEventListener(
                "click",
                () => {
                    const id =
                        row.dataset.reportId;

                    openReportModal(id);
                }
            );
        });
}


/* =========================================================
   TABELA DE RELATÓRIOS
========================================================= */

function renderReports() {
    const container =
        $("#reportsTable");

    if (!container) {
        return;
    }

    if (!reports.length) {
        container.innerHTML = `
            <div class="empty">
                <strong>Nenhum relatório encontrado</strong>
                <span>
                    Importe um relatório Word para começar.
                </span>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Nº</th>
                    <th>Relatório</th>
                    <th>Importado em</th>
                    <th>Senha</th>
                    <th>Senha gerada</th>
                    <th>Senha liberada</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>

            <tbody>
                ${reports.map(report => `
                    <tr>
                        <td>
                            <span class="report-number">
                                ${escapeHtml(reportNumber(report))}
                            </span>
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(reportTitle(report))}
                            </strong>

                            <small>
                                Data do relatório:
                                ${escapeHtml(
                                    formatDate(
                                        report.report_date
                                    )
                                )}
                            </small>
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDateTime(
                                    report.imported_at
                                )
                            )}
                        </td>

                        <td>
                            ${
                                report.password
                                    ? `
                                        <span
                                            title="Senha do relatório"
                                        >
                                            ${escapeHtml(
                                                report.password
                                            )}
                                        </span>
                                    `
                                    : "—"
                            }
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDateTime(
                                    report.password_generated_at
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDateTime(
                                    report.password_released_at
                                )
                            )}
                        </td>

                        <td>
                            ${statusBadge(report.status)}
                        </td>

                        <td>
                            <div class="actions">

                                <button
                                    type="button"
                                    class="btn btn-secondary"
                                    data-action="view"
                                    data-report-id="${escapeHtml(report.id)}"
                                >
                                    Ver
                                </button>

                                ${
                                    normalizeStatus(
                                        report.status
                                    ) ===
                                    STATUS.WAITING_CONFERENCE
                                        ? `
                                            <button
                                                type="button"
                                                class="btn btn-primary"
                                                data-action="password"
                                                data-report-id="${escapeHtml(report.id)}"
                                            >
                                                Registrar senha
                                            </button>
                                        `
                                        : ""
                                }

                                ${
                                    normalizeStatus(
                                        report.status
                                    ) ===
                                        STATUS.WAITING_RELEASE &&
                                    report.password
                                        ? `
                                            <button
                                                type="button"
                                                class="btn btn-primary"
                                                data-action="release"
                                                data-report-id="${escapeHtml(report.id)}"
                                            >
                                                Liberar
                                            </button>
                                        `
                                        : ""
                                }

                            </div>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;

    bindReportActions();
}


/* =========================================================
   AÇÕES DA TABELA
========================================================= */

function bindReportActions() {
    const container =
        $("#reportsTable");

    if (!container) {
        return;
    }

    container
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                async event => {
                    event.stopPropagation();

                    const action =
                        button.dataset.action;

                    const reportId =
                        button.dataset.reportId;

                    if (!reportId) {
                        return;
                    }

                    if (action === "view") {
                        openReportModal(reportId);
                    }

                    if (action === "password") {
                        await openPasswordRegistration(
                            reportId
                        );
                    }

                    if (action === "release") {
                        await releaseReport(
                            reportId
                        );
                    }
                }
            );
        });
}


/* =========================================================
   PROCESSOS
========================================================= */

function renderProcesses() {
    const container =
        $("#processTable");

    if (!container) {
        return;
    }

    const filtered =
        getFilteredProcesses();

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty">
                Nenhum processo encontrado.
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>CT-e</th>
                    <th>NF</th>
                    <th>Cliente</th>
                    <th>Volume</th>
                    <th>ACR</th>
                    <th>Relatório</th>
                    <th>Status</th>
                </tr>
            </thead>

            <tbody>
                ${filtered.map(process => `
                    <tr>
                        <td>
                            ${escapeHtml(
                                formatDate(
                                    process.data
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.cte || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.nf || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.cliente || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.volume || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.acr || "—"
                            )}
                        </td>

                        <td>
                            ${
                                process.report
                                    ? `
                                        <strong>
                                            #${escapeHtml(
                                                reportNumber(
                                                    process.report
                                                )
                                            )}
                                        </strong>
                                    `
                                    : "—"
                            }
                        </td>

                        <td>
                            ${
                                process.report
                                    ? statusBadge(
                                        process.report.status
                                    )
                                    : "—"
                            }
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}


/* =========================================================
   FILTRO DE PROCESSOS
========================================================= */

function getFilteredProcesses() {
    const search =
        normalizeText(
            $("#processSearch")?.value
        );

    const status =
        $("#processStatus")?.value || "";

    const date =
        $("#processDate")?.value || "";

    return processes.filter(process => {
        const report =
            process.report;

        const searchable = normalizeText(
            [
                process.cte,
                process.nf,
                process.cliente,
                process.volume,
                process.acr,
                report?.password,
                report?.report_number,
                report?.report_date
            ]
                .filter(Boolean)
                .join(" ")
        );

        const matchesSearch =
            !search ||
            searchable.includes(search);

        const matchesStatus =
            !status ||
            normalizeStatus(
                report?.status
            ) === normalizeStatus(status);

        const matchesDate =
            !date ||
            process.data === date;

        return (
            matchesSearch &&
            matchesStatus &&
            matchesDate
        );
    });
}


function filterProcesses() {
    renderProcesses();
}


/* =========================================================
   ECOLAB
========================================================= */

function renderEcolab() {
    const container =
        $("#ecolabTable");

    if (!container) {
        return;
    }

    const ecolabProcesses =
        processes.filter(process => {
            const client =
                normalizeText(
                    process.cliente
                );

            return (
                client.includes("ecolab") ||
                client.includes("eco lab")
            );
        });

    if (!ecolabProcesses.length) {
        container.innerHTML = `
            <div class="empty">
                Nenhum processo ECOLAB encontrado.
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>CT-e</th>
                    <th>NF</th>
                    <th>Cliente</th>
                    <th>Volume</th>
                    <th>ACR</th>
                    <th>Relatório</th>
                    <th>Status</th>
                </tr>
            </thead>

            <tbody>
                ${ecolabProcesses.map(process => `
                    <tr>
                        <td>
                            ${escapeHtml(
                                formatDate(
                                    process.data
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.cte || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.nf || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.cliente || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.volume || "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                process.acr || "—"
                            )}
                        </td>

                        <td>
                            ${
                                process.report
                                    ? `
                                        #${escapeHtml(
                                            reportNumber(
                                                process.report
                                            )
                                        )}
                                    `
                                    : "—"
                            }
                        </td>

                        <td>
                            ${
                                process.report
                                    ? statusBadge(
                                        process.report.status
                                    )
                                    : "—"
                            }
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}


/* =========================================================
   BUSCA RÁPIDA
========================================================= */

function searchQuick() {
    const container =
        $("#quickResults");

    if (!container) {
        return;
    }

    const search =
        normalizeText(
            $("#quickSearch")?.value
        );

    if (!search) {
        container.innerHTML = `
            <div class="empty">
                Digite algo para pesquisar.
            </div>
        `;

        return;
    }

    const results = [];

    reports.forEach(report => {
        const searchable =
            normalizeText(
                [
                    report.report_number,
                    report.report_date,
                    report.password,
                    report.status
                ]
                    .filter(Boolean)
                    .join(" ")
            );

        if (
            searchable.includes(search)
        ) {
            results.push({
                type: "report",
                report
            });
        }
    });

    processes.forEach(process => {
        const report =
            process.report;

        const searchable =
            normalizeText(
                [
                    process.cte,
                    process.nf,
                    process.cliente,
                    process.volume,
                    process.acr,
                    report?.report_number,
                    report?.password
                ]
                    .filter(Boolean)
                    .join(" ")
            );

        if (
            searchable.includes(search)
        ) {
            results.push({
                type: "process",
                process
            });
        }
    });

    if (!results.length) {
        container.innerHTML = `
            <div class="empty">
                Nenhum resultado encontrado.
            </div>
        `;

        return;
    }

    container.innerHTML =
        results
            .slice(0, 20)
            .map(result => {
                if (
                    result.type ===
                    "report"
                ) {
                    const report =
                        result.report;

                    return `
                        <button
                            type="button"
                            class="quick-item"
                            data-report-id="${escapeHtml(report.id)}"
                        >
                            <strong>
                                ${escapeHtml(
                                    reportTitle(report)
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    formatDate(
                                        report.report_date
                                    )
                                )}
                                •
                                ${escapeHtml(
                                    report.status
                                )}
                            </span>
                        </button>
                    `;
                }

                const process =
                    result.process;

                return `
                    <button
                        type="button"
                        class="quick-item"
                        data-report-id="${
                            escapeHtml(
                                process.report?.id || ""
                            )
                        }"
                    >
                        <strong>
                            CT-e:
                            ${escapeHtml(
                                process.cte || "—"
                            )}
                        </strong>

                        <span>
                            NF:
                            ${escapeHtml(
                                process.nf || "—"
                            )}
                            •
                            ${escapeHtml(
                                process.cliente || "—"
                            )}
                        </span>
                    </button>
                `;
            })
            .join("");

    container
        .querySelectorAll(
            "[data-report-id]"
        )
        .forEach(item => {
            item.addEventListener(
                "click",
                () => {
                    const id =
                        item.dataset.reportId;

                    if (id) {
                        openReportModal(id);
                    }
                }
            );
        });
}


/* =========================================================
   MODAL DE RELATÓRIO
========================================================= */

function openReportModal(reportId) {
    const report =
        reports.find(
            item =>
                item.id === reportId
        );

    if (!report) {
        showToast(
            "Relatório não encontrado.",
            "error"
        );

        return;
    }

    currentReport =
        report;

    const modal =
        $("#reportModal");

    const title =
        $("#modalTitle");

    const body =
        $("#modalBody");

    if (!modal || !body) {
        return;
    }

    if (title) {
        title.textContent =
            reportTitle(report);
    }

    const relatedProcesses =
        processes.filter(
            process =>
                process.report_id ===
                report.id
        );

    body.innerHTML = `
        <div class="detail-grid">

            <div class="detail-item">
                <span>Nº do relatório</span>
                <strong>
                    #${escapeHtml(
                        reportNumber(report)
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Data do relatório</span>
                <strong>
                    ${escapeHtml(
                        formatDate(
                            report.report_date
                        )
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Importado em</span>
                <strong>
                    ${escapeHtml(
                        formatDateTime(
                            report.imported_at
                        )
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Status</span>
                <strong>
                    ${statusBadge(
                        report.status
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Senha</span>
                <strong>
                    ${
                        report.password
                            ? escapeHtml(
                                report.password
                            )
                            : "—"
                    }
                </strong>
            </div>

            <div class="detail-item">
                <span>Senha gerada em</span>
                <strong>
                    ${escapeHtml(
                        formatDateTime(
                            report.password_generated_at
                        )
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Senha liberada em</span>
                <strong>
                    ${escapeHtml(
                        formatDateTime(
                            report.password_released_at
                        )
                    )}
                </strong>
            </div>

            <div class="detail-item">
                <span>Última atualização</span>
                <strong>
                    ${escapeHtml(
                        formatDateTime(
                            report.updated_at
                        )
                    )}
                </strong>
            </div>

        </div>

        ${
            normalizeStatus(
                report.status
            ) === STATUS.WAITING_CONFERENCE
                ? `
                    <div class="modal-section">
                        <h4>
                            Registrar senha
                        </h4>

                        <div class="action-row">

                            <label>
                                Senha
                                <input
                                    id="modalPassword"
                                    type="text"
                                    placeholder="Digite a senha gerada"
                                    autocomplete="off"
                                >
                            </label>

                            <button
                                type="button"
                                class="btn btn-primary"
                                id="modalPasswordBtn"
                            >
                                Registrar senha
                            </button>

                        </div>
                    </div>
                `
                : ""
        }

        ${
            normalizeStatus(
                report.status
            ) === STATUS.WAITING_RELEASE &&
            report.password
                ? `
                    <div class="modal-section">

                        <div class="status-preview">
                            <span>
                                Senha registrada e aguardando liberação.
                            </span>

                            <strong>
                                AGUARDANDO LIBERAÇÃO
                            </strong>
                        </div>

                        <button
                            type="button"
                            class="btn btn-primary btn-block"
                            id="modalReleaseBtn"
                        >
                            Liberar senha
                        </button>

                    </div>
                `
                : ""
        }

        <div class="modal-section">
            <h4>
                Processos vinculados
                (${relatedProcesses.length})
            </h4>

            ${
                relatedProcesses.length
                    ? relatedProcesses
                        .map(process => `
                            <div class="modal-process">
                                <div>
                                    <strong>
                                        CT-e:
                                        ${escapeHtml(
                                            process.cte || "—"
                                        )}
                                    </strong>

                                    <div class="muted">
                                        NF:
                                        ${escapeHtml(
                                            process.nf || "—"
                                        )}
                                        •
                                        ${escapeHtml(
                                            process.cliente || "—"
                                        )}
                                    </div>
                                </div>

                                <div>
                                    ${escapeHtml(
                                        process.volume || "—"
                                    )}
                                </div>
                            </div>
                        `)
                        .join("")
                    : `
                        <div class="empty">
                            Nenhum processo vinculado.
                        </div>
                    `
            }
        </div>
    `;

    modal.classList.remove("hidden");

    const passwordButton =
        $("#modalPasswordBtn");

    if (passwordButton) {
        passwordButton.addEventListener(
            "click",
            async () => {
                const password =
                    $("#modalPassword")?.value.trim();

                await saveReportPassword(
                    report.id,
                    password
                );
            }
        );
    }

    const releaseButton =
        $("#modalReleaseBtn");

    if (releaseButton) {
        releaseButton.addEventListener(
            "click",
            async () => {
                await releaseReport(
                    report.id
                );
            }
        );
    }
}


function closeReportModal() {
    const modal =
        $("#reportModal");

    if (modal) {
        modal.classList.add("hidden");
    }

    currentReport = null;
}


/* =========================================================
   REGISTRAR SENHA
========================================================= */

async function openPasswordRegistration(
    reportId
) {
    const report =
        reports.find(
            item =>
                item.id === reportId
        );

    if (!report) {
        return;
    }

    openReportModal(reportId);

    setTimeout(() => {
        const input =
            $("#modalPassword");

        if (input) {
            input.focus();
        }
    }, 100);
}


async function saveReportPassword(
    reportId,
    password
) {
    if (!supabaseClient) {
        return;
    }

    const cleanPassword =
        String(password ?? "").trim();

    if (!cleanPassword) {
        showToast(
            "Digite a senha antes de continuar.",
            "error"
        );

        return;
    }

    const report =
        reports.find(
            item =>
                item.id === reportId
        );

    if (!report) {
        showToast(
            "Relatório não encontrado.",
            "error"
        );

        return;
    }

    const generatedAt =
        nowISO();

    const updatedAt =
        nowISO();

    try {
        const {
            data,
            error
        } =
            await supabaseClient
                .from("relatorios")
                .update({
                    password:
                        cleanPassword,

                    password_generated_at:
                        generatedAt,

                    status:
                        STATUS.WAITING_RELEASE,

                    updated_at:
                        updatedAt
                })
                .eq(
                    "id",
                    reportId
                )
                .select(`
                    id,
                    report_number,
                    report_date,
                    imported_at,
                    password,
                    status,
                    created_by,
                    created_at,
                    updated_at,
                    password_generated_at,
                    password_released_at
                `)
                .single();

        if (error) {
            throw error;
        }

        const index =
            reports.findIndex(
                item =>
                    item.id === reportId
            );

        if (index !== -1) {
            reports[index] = {
                ...data,
                status:
                    normalizeStatus(
                        data.status
                    )
            };
        }

        await refreshProcessReportReferences();

        renderReports();
        renderProcesses();
        renderEcolab();
        updateDashboard();

        openReportModal(reportId);

        showToast(
            "Senha registrada. O relatório agora está aguardando liberação.",
            "success"
        );

    } catch (error) {
        console.error(
            "Erro ao registrar senha:",
            error
        );

        showToast(
            error?.message ||
            "Não foi possível registrar a senha.",
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
    if (!supabaseClient) {
        return;
    }

    const report =
        reports.find(
            item =>
                item.id === reportId
        );

    if (!report) {
        showToast(
            "Relatório não encontrado.",
            "error"
        );

        return;
    }

    if (!report.password) {
        showToast(
            "A senha precisa ser registrada antes da liberação.",
            "error"
        );

        return;
    }

    const confirmed =
        window.confirm(
            `Liberar a senha do ${reportTitle(report)}?`
        );

    if (!confirmed) {
        return;
    }

    const releasedAt =
        nowISO();

    const updatedAt =
        nowISO();

    try {
        const {
            data,
            error
        } =
            await supabaseClient
                .from("relatorios")
                .update({
                    status:
                        STATUS.RELEASED,

                    password_released_at:
                        releasedAt,

                    updated_at:
                        updatedAt
                })
                .eq(
                    "id",
                    reportId
                )
                .select(`
                    id,
                    report_number,
                    report_date,
                    imported_at,
                    password,
                    status,
                    created_by,
                    created_at,
                    updated_at,
                    password_generated_at,
                    password_released_at
                `)
                .single();

        if (error) {
            throw error;
        }

        const index =
            reports.findIndex(
                item =>
                    item.id === reportId
            );

        if (index !== -1) {
            reports[index] = {
                ...data,
                status:
                    normalizeStatus(
                        data.status
                    )
            };
        }

        await refreshProcessReportReferences();

        renderReports();
        renderProcesses();
        renderEcolab();
        updateDashboard();

        openReportModal(reportId);

        showToast(
            "Senha liberada com sucesso.",
            "success"
        );

    } catch (error) {
        console.error(
            "Erro ao liberar relatório:",
            error
        );

        showToast(
            error?.message ||
            "Não foi possível liberar o relatório.",
            "error"
        );
    }
}


/* =========================================================
   ATUALIZAR RELAÇÃO PROCESSOS → RELATÓRIOS
========================================================= */

async function refreshProcessReportReferences() {
    processes =
        processes.map(process => {
            const report =
                reports.find(
                    item =>
                        item.id ===
                        process.report_id
                );

            return {
                ...process,
                report:
                    report || null
            };
        });
}


/* =========================================================
   IMPORTAÇÃO WORD
========================================================= */

async function handleWordFile(
    file
) {
    if (!file) {
        return;
    }

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();

    if (extension !== "docx") {
        showToast(
            "Selecione um arquivo Word .docx.",
            "error"
        );

        return;
    }

    selectedWordFile =
        file;

    const selectedFile =
        $("#selectedFile");

    if (selectedFile) {
        selectedFile.textContent =
            file.name;
        selectedFile.classList.remove(
            "hidden"
        );
    }

    await previewWordFile(file);
}


async function previewWordFile(file) {
    if (
        typeof mammoth ===
        "undefined"
    ) {
        showToast(
            "A biblioteca Mammoth não foi carregada.",
            "error"
        );

        return;
    }

    try {
        const arrayBuffer =
            await file.arrayBuffer();

        const result =
            await mammoth.extractRawText({
                arrayBuffer
            });

        importedWordData =
            result.value || "";

        const preview =
            $("#previewBox");

        if (preview) {
            preview.innerHTML = `
                <pre>${escapeHtml(
                    truncate(
                        importedWordData,
                        12000
                    )
                )}</pre>
            `;
        }

    } catch (error) {
        console.error(
            "Erro ao ler Word:",
            error
        );

        showToast(
            "Não foi possível ler o arquivo Word.",
            "error"
        );
    }
}


/* =========================================================
   PARSER DO WORD
========================================================= */

function parseWordProcesses(text) {
    if (!text) {
        return [];
    }

    const lines =
        text
            .split(/\r?\n/)
            .map(line =>
                line.trim()
            )
            .filter(Boolean);

    const result = [];

    for (const line of lines) {
        const normalized =
            normalizeText(line);

        if (
            normalized.includes("cte") ||
            normalized.includes("ct-e")
        ) {
            continue;
        }

        const parts =
            line
                .split(/\t+/)
                .map(item =>
                    item.trim()
                )
                .filter(Boolean);

        if (parts.length < 2) {
            continue;
        }

        const process = {
            data: null,
            cte: "",
            nf: "",
            cliente: "",
            volume: "",
            acr: ""
        };

        if (parts.length >= 6) {
            process.data =
                normalizeDateValue(
                    parts[0]
                );

            process.cte =
                parts[1] || "";

            process.nf =
                parts[2] || "";

            process.cliente =
                parts[3] || "";

            process.volume =
                parts[4] || "";

            process.acr =
                parts[5] || "";

            result.push(process);
        }
    }

    return result;
}


function normalizeDateValue(value) {
    if (!value) {
        return null;
    }

    const text =
        String(value).trim();

    let match =
        text.match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        );

    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }

    match =
        text.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

    if (match) {
        return text;
    }

    return null;
}


/* =========================================================
   IMPORTAR RELATÓRIO
========================================================= */

async function importReport() {
    if (!supabaseClient) {
        return;
    }

    if (!selectedWordFile) {
        showToast(
            "Selecione um arquivo Word antes de importar.",
            "error"
        );

        return;
    }

    const dateInput =
        $("#importDate");

    const date =
        dateInput?.value ||
        todayISO();

    const importButton =
        $("#importBtn");

    if (importButton) {
        importButton.disabled = true;
        importButton.dataset.originalText =
            importButton.textContent;
        importButton.textContent =
            "Importando...";
    }

    try {
        const now =
            nowISO();

        /*
         * IMPORTANTE:
         * Não enviamos report_number.
         *
         * O Supabase gera automaticamente
         * através da coluna IDENTITY.
         */

        const {
            data: report,
            error: reportError
        } =
            await supabaseClient
                .from("relatorios")
                .insert({
                    report_date:
                        date,

                    imported_at:
                        now,

                    password:
                        null,

                    status:
                        STATUS.WAITING_CONFERENCE,

                    created_by:
                        currentUser?.id ||
                        null,

                    created_at:
                        now,

                    updated_at:
                        now,

                    password_generated_at:
                        null,

                    password_released_at:
                        null
                })
                .select(`
                    id,
                    report_number,
                    report_date,
                    imported_at,
                    password,
                    status,
                    created_by,
                    created_at,
                    updated_at,
                    password_generated_at,
                    password_released_at
                `)
                .single();

        if (reportError) {
            throw reportError;
        }

        const parsedProcesses =
            parseWordProcesses(
                importedWordData || ""
            );

        if (parsedProcesses.length) {
            const rows =
                parsedProcesses.map(
                    process => ({
                        report_id:
                            report.id,

                        data:
                            process.data ||
                            date,

                        cte:
                            process.cte ||
                            "",

                        nf:
                            process.nf ||
                            "",

                        cliente:
                            process.cliente ||
                            null,

                        volume:
                            process.volume ||
                            null,

                        acr:
                            process.acr ||
                            null,

                        created_at:
                            now
                    })
                );

            const {
                error: processError
            } =
                await supabaseClient
                    .from("processos")
                    .insert(rows);

            if (processError) {
                console.error(
                    "Erro ao inserir processos:",
                    processError
                );

                /*
                 * O relatório já foi criado.
                 * Não escondemos esse erro.
                 */
                throw processError;
            }
        }

        reports.unshift({
            ...report,
            status:
                normalizeStatus(
                    report.status
                )
        });

        await loadProcesses();

        renderReports();
        renderProcesses();
        renderEcolab();
        updateDashboard();

        resetImportForm();

        showToast(
            `Relatório #${report.report_number} importado com sucesso.`,
            "success"
        );

        navigateTo("relatorios");

    } catch (error) {
        console.error(
            "Erro ao importar relatório:",
            error
        );

        const message =
            $("#importMessage");

        setMessage(
            message,
            error?.message ||
            "Não foi possível importar o relatório.",
            "error"
        );

        showToast(
            error?.message ||
            "Erro ao importar relatório.",
            "error"
        );
    } finally {
        if (importButton) {
            importButton.disabled = false;

            importButton.textContent =
                importButton.dataset.originalText ||
                "Importar relatório";
        }
    }
}


/* =========================================================
   RESET IMPORTAÇÃO
========================================================= */

function resetImportForm() {
    selectedWordFile = null;
    importedWordData = null;

    const fileInput =
        $("#wordFile");

    const selectedFile =
        $("#selectedFile");

    const preview =
        $("#previewBox");

    const password =
        $("#importPassword");

    const message =
        $("#importMessage");

    if (fileInput) {
        fileInput.value = "";
    }

    if (selectedFile) {
        selectedFile.textContent = "";
        selectedFile.classList.add(
            "hidden"
        );
    }

    if (preview) {
        preview.innerHTML = "";
    }

    if (password) {
        password.value = "";
    }

    if (message) {
        message.textContent = "";
    }

    const date =
        $("#importDate");

    if (date) {
        date.value =
            todayISO();
    }
}


/* =========================================================
   NAVEGAÇÃO
========================================================= */

const viewTitles = {
    dashboard: "Dashboard",
    processos: "Processos",
    relatorios: "Relatórios",
    ecolab: "ECOLAB",
    importar: "Importar relatório"
};


function navigateTo(view) {
    const views =
        $$(".view");

    views.forEach(element => {
        element.classList.add(
            "hidden"
        );
    });

    const target =
        $(`#view-${view}`);

    if (target) {
        target.classList.remove(
            "hidden"
        );
    }

    $$(".nav-item").forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.view === view
        );
    });

    const title =
        $("#pageTitle");

    if (title) {
        title.textContent =
            viewTitles[view] ||
            "Alfa Transportes";
    }

    closeSidebar();

    if (view === "dashboard") {
        updateDashboard();
    }

    if (view === "processos") {
        renderProcesses();
    }

    if (view === "relatorios") {
        renderReports();
    }

    if (view === "ecolab") {
        renderEcolab();
    }
}


/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {
    document.body.classList.add(
        "sidebar-open"
    );
}


function closeSidebar() {
    document.body.classList.remove(
        "sidebar-open"
    );
}


function toggleSidebar() {
    document.body.classList.toggle(
        "sidebar-open"
    );
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshData() {
    const button =
        $("#refreshBtn");

    if (button) {
        button.disabled = true;
    }

    try {
        await loadAllData();

        showToast(
            "Dados atualizados.",
            "success"
        );
    } catch (error) {
        console.error(error);

        showToast(
            "Não foi possível atualizar os dados.",
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}


/* =========================================================
   EVENTOS
========================================================= */

function bindEvents() {
    const loginForm =
        $("#loginForm");

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            handleLogin
        );
    }

    const forgotPassword =
        $("#forgotPassword");

    if (forgotPassword) {
        forgotPassword.addEventListener(
            "click",
            handleForgotPassword
        );
    }

    const logout =
        $("#logoutBtn");

    if (logout) {
        logout.addEventListener(
            "click",
            handleLogout
        );
    }

    $$(".nav-item").forEach(item => {
        item.addEventListener(
            "click",
            () => {
                const view =
                    item.dataset.view;

                if (view) {
                    navigateTo(view);
                }
            }
        );
    });

    const openSidebarButton =
        $("#openSidebar");

    if (openSidebarButton) {
        openSidebarButton.addEventListener(
            "click",
            toggleSidebar
        );
    }

    const closeSidebarButton =
        $("#closeSidebar");

    if (closeSidebarButton) {
        closeSidebarButton.addEventListener(
            "click",
            closeSidebar
        );
    }

    const refresh =
        $("#refreshBtn");

    if (refresh) {
        refresh.addEventListener(
            "click",
            refreshData
        );
    }

    const topImport =
        $("#topImportBtn");

    if (topImport) {
        topImport.addEventListener(
            "click",
            () => navigateTo("importar")
        );
    }

    const navImport =
        $("#navImportar");

    if (navImport) {
        navImport.addEventListener(
            "click",
            () => navigateTo("importar")
        );
    }

    const quickSearch =
        $("#quickSearch");

    if (quickSearch) {
        quickSearch.addEventListener(
            "input",
            searchQuick
        );
    }

    const processSearch =
        $("#processSearch");

    if (processSearch) {
        processSearch.addEventListener(
            "input",
            filterProcesses
        );
    }

    const processStatus =
        $("#processStatus");

    if (processStatus) {
        processStatus.addEventListener(
            "change",
            filterProcesses
        );
    }

    const processDate =
        $("#processDate");

    if (processDate) {
        processDate.addEventListener(
            "change",
            filterProcesses
        );
    }

    const wordFile =
        $("#wordFile");

    if (wordFile) {
        wordFile.addEventListener(
            "change",
            event => {
                const file =
                    event.target.files?.[0];

                if (file) {
                    handleWordFile(file);
                }
            }
        );
    }

    const dropzone =
        $("#dropzone");

    if (dropzone) {
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
            () => {
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

                if (file) {
                    handleWordFile(file);
                }
            }
        );
    }

    const importButton =
        $("#importBtn");

    if (importButton) {
        importButton.addEventListener(
            "click",
            importReport
        );
    }

    const modal =
        $("#reportModal");

    if (modal) {
        modal
            .querySelectorAll(
                "[data-close-modal]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    closeReportModal
                );
            });
    }

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape"
            ) {
                closeReportModal();
                closeSidebar();
            }
        }
    );

    document.addEventListener(
        "click",
        event => {
            const modal =
                $("#reportModal");

            if (
                modal &&
                !modal.classList.contains(
                    "hidden"
                ) &&
                event.target === modal
            ) {
                closeReportModal();
            }
        }
    );
}


/* =========================================================
   DATA DO IMPORT
========================================================= */

function initializeImportDate() {
    const date =
        $("#importDate");

    if (
        date &&
        !date.value
    ) {
        date.value =
            todayISO();
    }
}


/* =========================================================
   START
========================================================= */

async function startApplication() {
    try {
        bindEvents();

        initializeImportDate();

        initializeSupabase();

        await initializeAuth();

    } catch (error) {
        console.error(
            "Erro ao iniciar aplicação:",
            error
        );

        showToast(
            "Erro ao iniciar o sistema.",
            "error"
        );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    startApplication
);