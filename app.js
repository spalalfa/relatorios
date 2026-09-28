(() => {
    "use strict";

    // ============================================================
    // CONFIGURAÇÃO SUPABASE
    // ============================================================

    const SUPABASE_URL = "https://ewawkukleqboozavhovb.supabase.co";

    const SUPABASE_KEY =
        "sb_publishable_WQ_vLGpDP9aveeUOtDNNJw_8Kg7L73y";

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    window.supabaseClient = supabaseClient;

    // ============================================================
    // STATUS
    // ============================================================

    const STATUS = {
        WAITING_CONFERENCE: "AGUARDANDO CONFERÊNCIA",
        RELEASED: "LIBERADA"
    };

    window.STATUS = STATUS;

    // ============================================================
    // ESTADO
    // ============================================================

    let reports = [];
    let processes = [];

    let currentReport = null;

    // ============================================================
    // HELPERS
    // ============================================================

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        [...parent.querySelectorAll(selector)];

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return "—";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function safeValue(value) {
        if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
        ) {
            return "—";
        }

        return escapeHtml(value);
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return safeValue(value);
        }

        return date.toLocaleDateString("pt-BR", {
            timeZone: "UTC"
        });
    }

    function formatDateTime(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return safeValue(value);
        }

        return date.toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short"
        });
    }

    function formatNumber(value) {
        if (value === null || value === undefined || value === "") {
            return "0";
        }

        const number = Number(value);

        if (Number.isNaN(number)) {
            return safeValue(value);
        }

        return number.toLocaleString("pt-BR");
    }

    function truncate(value, length = 40) {
        if (!value) return "—";

        const text = String(value);

        if (text.length <= length) {
            return escapeHtml(text);
        }

        return escapeHtml(text.substring(0, length) + "...");
    }

    function getStatusClass(status) {
        const normalized = normalizeText(status);

        if (normalized === normalizeText(STATUS.RELEASED)) {
            return "status-released";
        }

        return "status-waiting";
    }

    function statusBadge(status) {
        const value = status || STATUS.WAITING_CONFERENCE;

        return `
            <span class="status-badge ${getStatusClass(value)}">
                <span class="status-dot"></span>
                ${escapeHtml(value)}
            </span>
        `;
    }

    function showToast(message, type = "success") {
        const container = $("#toastContainer");

        if (!container) return;

        const toast = document.createElement("div");

        toast.className = `toast toast-${type}`;

        toast.innerHTML = `
            <div class="toast-icon">
                ${type === "success" ? "✓" : type === "error" ? "!" : "i"}
            </div>

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
            }, 300);
        }, 3500);
    }

    window.showToast = showToast;

    // ============================================================
    // CONEXÃO
    // ============================================================

    function setConnectionStatus(connected, message) {
        const dot = $("#connectionDot");
        const text = $("#connectionText");

        if (dot) {
            dot.classList.toggle("offline", !connected);
        }

        if (text) {
            text.textContent =
                message ||
                (connected ? "Conectado" : "Sem conexão");
        }
    }

    // ============================================================
    // CARREGAR DADOS
    // ============================================================

    async function loadAllData() {
        try {
            setConnectionStatus(true, "Carregando...");

            await Promise.all([
                loadReports(),
                loadProcesses()
            ]);

            renderDashboard();
            renderRecentReports();
            renderReportsTable();
            renderProcessesTable();
            renderEcolabTable();
            setupSearches();

            setConnectionStatus(true, "Sistema conectado");
        } catch (error) {
            console.error("Erro ao carregar dados:", error);

            setConnectionStatus(false, "Erro de conexão");

            showToast(
                "Não foi possível carregar os dados.",
                "error"
            );
        }
    }

    async function loadReports() {
        const { data, error } = await supabaseClient
            .from("relatorios")
            .select(`
                id,
                report_number,
                report_date,
                imported_at,
                password,
                status,
                created_at,
                updated_at,
                password_generated_at,
                password_released_at
            `)
            .order("report_date", {
                ascending: false
            });

        if (error) {
            console.error("Erro ao buscar relatórios:", error);
            throw error;
        }

        reports = data || [];

        window.reports = reports;

        return reports;
    }

    async function loadProcesses() {
        const { data, error } = await supabaseClient
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
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error("Erro ao buscar processos:", error);
            throw error;
        }

        processes = data || [];

        window.processes = processes;

        return processes;
    }

    // ============================================================
    // DASHBOARD
    // ============================================================

    function renderDashboard() {
        const totalReports = reports.length;

        const waitingReports = reports.filter(
            report =>
                normalizeText(report.status) ===
                normalizeText(STATUS.WAITING_CONFERENCE)
        ).length;

        const releasedReports = reports.filter(
            report =>
                normalizeText(report.status) ===
                normalizeText(STATUS.RELEASED)
        ).length;

        const totalProcesses = processes.length;

        updateElementText(
            "#totalReports",
            formatNumber(totalReports)
        );

        updateElementText(
            "#waitingReports",
            formatNumber(waitingReports)
        );

        updateElementText(
            "#releasedReports",
            formatNumber(releasedReports)
        );

        updateElementText(
            "#totalProcesses",
            formatNumber(totalProcesses)
        );

        // Compatibilidade com possíveis IDs antigos
        updateElementText(
            "#statReports",
            formatNumber(totalReports)
        );

        updateElementText(
            "#statWaiting",
            formatNumber(waitingReports)
        );

        updateElementText(
            "#statReleased",
            formatNumber(releasedReports)
        );

        updateElementText(
            "#statProcesses",
            formatNumber(totalProcesses)
        );
    }

    function updateElementText(selector, value) {
        const element = $(selector);

        if (element) {
            element.textContent = value;
        }
    }

    // ============================================================
    // RELATÓRIOS RECENTES
    // ============================================================

    function renderRecentReports() {
        const container = $("#recentReports");

        if (!container) return;

        if (!reports.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">◫</div>
                    <strong>Nenhum relatório encontrado</strong>
                    <span>Os relatórios importados aparecerão aqui.</span>
                </div>
            `;

            return;
        }

        const recent = reports.slice(0, 5);

        container.innerHTML = recent
            .map(report => {
                const reportProcesses = processes.filter(
                    process => process.report_id === report.id
                );

                return `
                    <button
                        class="recent-report"
                        type="button"
                        data-report-id="${escapeHtml(report.id)}"
                    >

                        <div class="recent-report-icon">
                            <span>▤</span>
                        </div>

                        <div class="recent-report-main">

                            <div class="recent-report-title">
                                ${safeValue(
                                    report.report_number ||
                                    `Relatório ${report.id?.slice(0, 8) || ""}`
                                )}
                            </div>

                            <div class="recent-report-meta">
                                <span>
                                    ${formatDate(report.report_date)}
                                </span>

                                <span class="meta-separator">•</span>

                                <span>
                                    ${formatNumber(reportProcesses.length)}
                                    processo${reportProcesses.length === 1 ? "" : "s"}
                                </span>
                            </div>

                        </div>

                        <div class="recent-report-status">
                            ${statusBadge(report.status)}
                        </div>

                    </button>
                `;
            })
            .join("");

        $$(".recent-report", container).forEach(button => {
            button.addEventListener("click", () => {
                openReportModal(button.dataset.reportId);
            });
        });
    }

    // ============================================================
    // TABELA DE RELATÓRIOS
    // ============================================================

    function renderReportsTable() {
        const table = $("#reportsTable");

        if (!table) return;

        const tbody =
            table.querySelector("tbody") || createTableBody(table);

        if (!reports.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="table-empty">
                            Nenhum relatório encontrado.
                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = reports
            .map(report => {
                const processCount = processes.filter(
                    process => process.report_id === report.id
                ).length;

                return `
                    <tr
                        class="table-row-clickable"
                        data-report-id="${escapeHtml(report.id)}"
                    >

                        <td>
                            <div class="cell-primary">
                                ${safeValue(
                                    report.report_number ||
                                    "—"
                                )}
                            </div>
                        </td>

                        <td>
                            <span class="date-cell">
                                ${formatDate(report.report_date)}
                            </span>
                        </td>

                        <td>
                            <span class="date-cell">
                                ${formatDateTime(report.imported_at)}
                            </span>
                        </td>

                        <td>
                            <span class="number-badge">
                                ${formatNumber(processCount)}
                            </span>
                        </td>

                        <td>
                            ${
                                report.password
                                    ? `
                                    <span class="password-value">
                                        ${escapeHtml(report.password)}
                                    </span>
                                    `
                                    : `
                                    <span class="muted-value">
                                        —
                                    </span>
                                    `
                            }
                        </td>

                        <td>
                            ${statusBadge(report.status)}
                        </td>

                        <td>
                            ${formatDateTime(
                                report.password_generated_at
                            )}
                        </td>

                        <td>
                            ${formatDateTime(
                                report.password_released_at
                            )}
                        </td>

                        <td class="table-action-cell">
                            <button
                                class="table-view-btn"
                                type="button"
                                data-report-id="${escapeHtml(report.id)}"
                            >
                                Ver detalhes
                                <span>→</span>
                            </button>
                        </td>

                    </tr>
                `;
            })
            .join("");

        $$(".table-row-clickable", tbody).forEach(row => {
            row.addEventListener("click", event => {
                if (
                    event.target.closest(
                        ".table-view-btn"
                    )
                ) {
                    return;
                }

                openReportModal(
                    row.dataset.reportId
                );
            });
        });

        $$(".table-view-btn", tbody).forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();

                openReportModal(
                    button.dataset.reportId
                );
            });
        });
    }

    function createTableBody(table) {
        const tbody = document.createElement("tbody");

        table.appendChild(tbody);

        return tbody;
    }

    // ============================================================
    // TABELA DE PROCESSOS
    // ============================================================

    function renderProcessesTable(list = processes) {
        const table = $("#processTable");

        if (!table) return;

        const tbody =
            table.querySelector("tbody") ||
            createTableBody(table);

        if (!list.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="table-empty">
                            Nenhum processo encontrado.
                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = list
            .map(process => {
                const report = reports.find(
                    item => item.id === process.report_id
                );

                return `
                    <tr>

                        <td>
                            <span class="date-cell">
                                ${formatDate(process.data)}
                            </span>
                        </td>

                        <td>
                            <strong class="table-code">
                                ${safeValue(process.cte)}
                            </strong>
                        </td>

                        <td>
                            ${safeValue(process.nf)}
                        </td>

                        <td>
                            <div class="client-cell">
                                ${truncate(process.cliente, 45)}
                            </div>
                        </td>

                        <td>
                            <span class="volume-badge">
                                ${safeValue(process.volume)}
                            </span>
                        </td>

                        <td>
                            <span class="table-code">
                                ${safeValue(process.acr)}
                            </span>
                        </td>

                        <td>
                            <span class="report-reference">
                                ${
                                    report
                                        ? safeValue(
                                              report.report_number ||
                                              formatDate(
                                                  report.report_date
                                              )
                                          )
                                        : "—"
                                }
                            </span>
                        </td>

                    </tr>
                `;
            })
            .join("");
    }

    // ============================================================
    // ECOLAB
    // ============================================================

    function renderEcolabTable() {
        const table = $("#ecolabTable");

        if (!table) return;

        const tbody =
            table.querySelector("tbody") ||
            createTableBody(table);

        if (!processes.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="table-empty">
                            Nenhum processo disponível.
                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = processes
            .map(process => {
                const report = reports.find(
                    item => item.id === process.report_id
                );

                return `
                    <tr>

                        <td>
                            ${formatDate(process.data)}
                        </td>

                        <td>
                            <strong>
                                ${safeValue(process.cte)}
                            </strong>
                        </td>

                        <td>
                            ${safeValue(process.nf)}
                        </td>

                        <td>
                            <div class="client-cell">
                                ${truncate(process.cliente, 45)}
                            </div>
                        </td>

                        <td>
                            ${safeValue(process.volume)}
                        </td>

                        <td>
                            ${safeValue(process.acr)}
                        </td>

                        <td>
                            ${
                                report
                                    ? statusBadge(report.status)
                                    : `<span class="muted-value">—</span>`
                            }
                        </td>

                    </tr>
                `;
            })
            .join("");
    }

    // ============================================================
    // BUSCA
    // ============================================================

    function setupSearches() {
        const processSearch = $("#processSearch");
        const processStatusFilter = $("#processStatusFilter");
        const processDateFilter = $("#processDateFilter");

        if (processSearch) {
            processSearch.oninput = applyProcessFilters;
        }

        if (processStatusFilter) {
            processStatusFilter.onchange =
                applyProcessFilters;
        }

        if (processDateFilter) {
            processDateFilter.onchange =
                applyProcessFilters;
        }

        const quickSearch = $("#quickSearch");

        if (quickSearch) {
            quickSearch.oninput = handleQuickSearch;
        }
    }

    function applyProcessFilters() {
        const search = normalizeText(
            $("#processSearch")?.value
        );

        const status = normalizeText(
            $("#processStatusFilter")?.value
        );

        const date = $("#processDateFilter")?.value;

        let filtered = [...processes];

        if (search) {
            filtered = filtered.filter(process => {
                const values = [
                    process.cte,
                    process.nf,
                    process.cliente,
                    process.volume,
                    process.acr
                ];

                return values.some(value =>
                    normalizeText(value).includes(search)
                );
            });
        }

        if (date) {
            filtered = filtered.filter(process => {
                if (!process.data) return false;

                return String(process.data).substring(0, 10) === date;
            });
        }

        if (status) {
            filtered = filtered.filter(process => {
                const report = reports.find(
                    item => item.id === process.report_id
                );

                return (
                    normalizeText(report?.status) ===
                    status
                );
            });
        }

        renderProcessesTable(filtered);
    }

    function handleQuickSearch() {
        const input = $("#quickSearch");

        const results = $("#quickSearchResults");

        if (!input || !results) return;

        const search = normalizeText(input.value);

        if (!search) {
            results.innerHTML = "";
            results.classList.remove("has-results");
            return;
        }

        const matchedProcesses = processes
            .filter(process => {
                return [
                    process.cte,
                    process.nf,
                    process.cliente,
                    process.acr
                ].some(value =>
                    normalizeText(value).includes(search)
                );
            })
            .slice(0, 8);

        const matchedReports = reports
            .filter(report => {
                return [
                    report.report_number,
                    report.status,
                    report.password
                ].some(value =>
                    normalizeText(value).includes(search)
                );
            })
            .slice(0, 5);

        if (
            !matchedProcesses.length &&
            !matchedReports.length
        ) {
            results.innerHTML = `
                <div class="quick-empty">
                    Nenhum resultado encontrado.
                </div>
            `;

            results.classList.add("has-results");

            return;
        }

        results.innerHTML = `
            ${matchedReports
                .map(
                    report => `
                        <button
                            type="button"
                            class="quick-result-item"
                            data-report-id="${escapeHtml(
                                report.id
                            )}"
                        >
                            <span class="quick-result-icon">▤</span>

                            <span>
                                <strong>
                                    ${
                                        safeValue(
                                            report.report_number ||
                                            "Relatório"
                                        )
                                    }
                                </strong>

                                <small>
                                    ${formatDate(
                                        report.report_date
                                    )}
                                </small>
                            </span>
                        </button>
                    `
                )
                .join("")}

            ${matchedProcesses
                .map(
                    process => `
                        <button
                            type="button"
                            class="quick-result-item process-result"
                        >
                            <span class="quick-result-icon">#</span>

                            <span>
                                <strong>
                                    ${safeValue(process.cte)}
                                </strong>

                                <small>
                                    ${truncate(
                                        process.cliente,
                                        50
                                    )}
                                </small>
                            </span>
                        </button>
                    `
                )
                .join("")}
        `;

        results.classList.add("has-results");

        $$(".quick-result-item", results).forEach(item => {
            const reportId =
                item.dataset.reportId;

            if (reportId) {
                item.addEventListener(
                    "click",
                    () => {
                        openReportModal(reportId);
                    }
                );
            }
        });
    }

    // ============================================================
    // MODAL
    // ============================================================

    function openReportModal(reportId) {
        const report = reports.find(
            item => item.id === reportId
        );

        if (!report) {
            showToast(
                "Relatório não encontrado.",
                "error"
            );

            return;
        }

        currentReport = report;

        const modal = $("#reportModal");

        const title = $("#modalReportTitle");

        const content = $("#modalReportContent");

        if (!modal || !content) return;

        if (title) {
            title.textContent =
                report.report_number ||
                `Relatório ${formatDate(
                    report.report_date
                )}`;
        }

        const reportProcesses = processes.filter(
            process => process.report_id === report.id
        );

        content.innerHTML = `
            <div class="report-detail-grid">

                <div class="detail-item">
                    <span>Relatório</span>
                    <strong>
                        ${safeValue(
                            report.report_number
                        )}
                    </strong>
                </div>

                <div class="detail-item">
                    <span>Data do relatório</span>
                    <strong>
                        ${formatDate(
                            report.report_date
                        )}
                    </strong>
                </div>

                <div class="detail-item">
                    <span>Importado em</span>
                    <strong>
                        ${formatDateTime(
                            report.imported_at
                        )}
                    </strong>
                </div>

                <div class="detail-item">
                    <span>Status</span>
                    <strong>
                        ${statusBadge(report.status)}
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
                                : "Ainda não gerada"
                        }
                    </strong>
                </div>

                <div class="detail-item">
                    <span>Senha gerada</span>
                    <strong>
                        ${formatDateTime(
                            report.password_generated_at
                        )}
                    </strong>
                </div>

                <div class="detail-item">
                    <span>Liberação</span>
                    <strong>
                        ${formatDateTime(
                            report.password_released_at
                        )}
                    </strong>
                </div>

                <div class="detail-item">
                    <span>Total de processos</span>
                    <strong>
                        ${formatNumber(
                            reportProcesses.length
                        )}
                    </strong>
                </div>

            </div>

            <div class="modal-section">

                <div class="modal-section-header">
                    <div>
                        <span class="panel-kicker">
                            Processos
                        </span>

                        <h3>
                            Processos deste relatório
                        </h3>
                    </div>

                    <span class="number-badge">
                        ${formatNumber(
                            reportProcesses.length
                        )}
                    </span>
                </div>

                ${
                    reportProcesses.length
                        ? `
                            <div class="modal-table-wrapper">

                                <table class="data-table modal-data-table">

                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>CT-e</th>
                                            <th>NF</th>
                                            <th>Cliente</th>
                                            <th>Volume</th>
                                            <th>ACR</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        ${reportProcesses
                                            .map(
                                                process => `
                                                    <tr>
                                                        <td>
                                                            ${formatDate(
                                                                process.data
                                                            )}
                                                        </td>

                                                        <td>
                                                            <strong>
                                                                ${safeValue(
                                                                    process.cte
                                                                )}
                                                            </strong>
                                                        </td>

                                                        <td>
                                                            ${safeValue(
                                                                process.nf
                                                            )}
                                                        </td>

                                                        <td>
                                                            ${truncate(
                                                                process.cliente,
                                                                45
                                                            )}
                                                        </td>

                                                        <td>
                                                            ${safeValue(
                                                                process.volume
                                                            )}
                                                        </td>

                                                        <td>
                                                            ${safeValue(
                                                                process.acr
                                                            )}
                                                        </td>
                                                    </tr>
                                                `
                                            )
                                            .join("")}
                                    </tbody>

                                </table>

                            </div>
                        `
                        : `
                            <div class="empty-state compact">
                                Nenhum processo vinculado a este relatório.
                            </div>
                        `
                }

            </div>
        `;

        modal.hidden = false;

        document.body.classList.add(
            "modal-open"
        );

        requestAnimationFrame(() => {
            modal.classList.add("show");
        });
    }

    function closeReportModal() {
        const modal = $("#reportModal");

        if (!modal) return;

        modal.classList.remove("show");

        setTimeout(() => {
            modal.hidden = true;
        }, 180);

        document.body.classList.remove(
            "modal-open"
        );

        currentReport = null;
    }

    window.openReportModal = openReportModal;
    window.closeReportModal = closeReportModal;

    // ============================================================
    // NAVEGAÇÃO
    // ============================================================

    function navigateTo(viewName) {
        const sections = $$(".view-section");

        sections.forEach(section => {
            section.classList.toggle(
                "active",
                section.id === `view-${viewName}`
            );
        });

        $$(".nav-item").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.view === viewName
            );
        });

        const titles = {
            dashboard: "Dashboard",
            processos: "Processos",
            relatorios: "Relatórios",
            ecolab: "ECOLAB",
            importar: "Importar relatório"
        };

        const pageTitle = $("#pageTitle");

        if (pageTitle) {
            pageTitle.textContent =
                titles[viewName] || "ALFA";
        }

        const sidebar = $("#sidebar");

        if (sidebar) {
            sidebar.classList.remove("mobile-open");
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    window.navigateTo = navigateTo;

    function setupNavigation() {
        $$(".nav-item").forEach(item => {
            item.addEventListener("click", event => {
                event.preventDefault();

                const view = item.dataset.view;

                if (view) {
                    navigateTo(view);
                }
            });
        });

        const toggle = $("#sidebarToggle");

        const sidebar = $("#sidebar");

        if (toggle && sidebar) {
            toggle.addEventListener("click", () => {
                sidebar.classList.toggle(
                    "mobile-open"
                );
            });
        }
    }

    // ============================================================
    // EVENTOS
    // ============================================================

    function setupEvents() {
        const modal = $("#reportModal");

        const closeButton = $("#modalClose");

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                closeReportModal
            );
        }

        if (modal) {
            modal.addEventListener(
                "click",
                event => {
                    if (
                        event.target === modal
                    ) {
                        closeReportModal();
                    }
                }
            );
        }

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key === "Escape"
                ) {
                    closeReportModal();
                }
            }
        );

        const refreshBtn = $("#refreshBtn");

        if (refreshBtn) {
            refreshBtn.addEventListener(
                "click",
                async () => {
                    refreshBtn.classList.add(
                        "loading"
                    );

                    await loadAllData();

                    setTimeout(() => {
                        refreshBtn.classList.remove(
                            "loading"
                        );
                    }, 300);
                }
            );
        }

        setupNavigation();
    }

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================

   document.addEventListener("DOMContentLoaded", () => {
    setupEvents();

    /*
     * IMPORTANTE:
     * No painel ADMIN, os dados só devem ser carregados
     * depois que o admin estiver autenticado.
     *
     * O admin.js chama window.loadAllData()
     * depois do login.
     */
    const isAdminPage =
        document.body?.dataset?.page === "admin";

    if (!isAdminPage) {
        loadAllData();
    }
});
})();