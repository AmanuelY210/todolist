/* TaskFlow - Modern To-Do List App */

// ======================== STATE ========================
const state = {
    user: null,
    tasks: [],
    categories: [],
    settings: { dark_mode: 0, notifications: 1, language: 'en' },
    currentPage: 'dashboard',
    calendarDate: new Date(),
    calendarView: 'month',
    chart: null,
    searchQuery: ''
};

// ======================== UTILITY ========================
const $ = id => document.getElementById(id);
const qs = (sel, ctx) => (ctx || document).querySelector(sel);
const qsa = (sel, ctx) => (ctx || document).querySelectorAll(sel);
const api = async (endpoint, method = 'GET', body = null) => {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        if (!res.ok && data.error) throw new Error(data.error);
        return data;
    } catch (e) {
        if (e.message !== 'Failed to fetch') showToast(e.message, 'error');
        else showToast('Network error - check if server is running', 'error');
        throw e;
    }
};
const apiForm = async (endpoint, formData) => {
    try {
        const res = await fetch(endpoint, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok && data.error) throw new Error(data.error);
        return data;
    } catch (e) {
        showToast(e.message, 'error'); throw e;
    }
};

// ======================== TOAST ========================
function showToast(message, type = 'info') {
    const container = $('toastContainer');
    const icons = { success: 'bi-check-circle-fill text-success', error: 'bi-x-circle-fill text-danger', warning: 'bi-exclamation-triangle-fill text-warning', info: 'bi-info-circle-fill text-primary' };
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `<i class="bi ${icons[type] || icons.info} fs-5"></i><span class="small">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; toast.style.transition = 'all 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ======================== NAVIGATION ========================
function navigate(page) {
    state.currentPage = page;
    qsa('.page').forEach(p => p.classList.remove('active'));
    const el = $(`page-${page}`);
    if (el) el.classList.add('active');
    qsa('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
    const link = qs(`.sidebar-nav .nav-link[data-page="${page}"]`);
    if (link) link.classList.add('active');
    if (page === 'dashboard') renderDashboard();
    else if (page === 'tasks') renderKanban();
    else if (page === 'categories') renderCategories();
    else if (page === 'calendar') renderCalendar();
    else if (page === 'profile') loadProfile();
    else if (page === 'settings') loadSettings();
    if (window.innerWidth < 992) toggleSidebar(false);
}

function toggleSidebar(show) {
    const sidebar = $('sidebar');
    const overlay = qs('.sidebar-overlay');
    const shouldShow = show !== undefined ? show : !sidebar.classList.contains('show');
    sidebar.classList.toggle('show', shouldShow);
    overlay.classList.toggle('show', shouldShow);
}

// ======================== AUTH ========================
let isRegisterMode = false;

$('authToggle').addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    $('registerFields').style.display = isRegisterMode ? 'block' : 'none';
    $('loginFields').style.display = isRegisterMode ? 'none' : 'block';
    $('authTitle').textContent = isRegisterMode ? 'Create Account' : 'Welcome Back';
    $('authSubtitle').textContent = isRegisterMode ? 'Sign up to get started with TaskFlow' : 'Sign in to continue to TaskFlow';
    $('authSubmitBtn').textContent = isRegisterMode ? 'Create Account' : 'Sign In';
    $('authToggleText').textContent = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
    $('authToggle').textContent = isRegisterMode ? 'Sign In' : 'Sign Up';
    $('authError').classList.add('d-none');
});

$('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('authError');
    errEl.classList.add('d-none');
    if (isRegisterMode) {
        const full_name = $('regFullName').value.trim();
        const username = $('regUsername').value.trim();
        const email = $('regEmail').value.trim();
        const password = $('regPassword').value;
        const confirm_password = $('regConfirm').value;
        if (!full_name || !username || !email || !password) { showError('Please fill all fields'); return; }
        if (password !== confirm_password) { showError('Passwords do not match'); return; }
        if (password.length < 6) { showError('Password must be at least 6 characters'); return; }
        try {
            const res = await api('api/auth.php?action=register', 'POST', { full_name, username, email, password, confirm_password });
            if (res.success) { showToast('Registration successful! Please sign in.', 'success'); isRegisterMode = false; $('authToggle').click(); }
        } catch (e) { showError(e.message); }
    } else {
        const login = $('loginUsername').value.trim();
        const password = $('loginPassword').value;
        const remember = $('rememberMe').checked;
        if (!login || !password) { showError('Please fill all fields'); return; }
        try {
            const res = await api('api/auth.php?action=login', 'POST', { login, password, remember });
            if (res.success) { state.user = res.user; showToast('Login successful!', 'success'); showApp(); }
        } catch (e) { showError(e.message); }
    }
    function showError(msg) { errEl.textContent = msg; errEl.classList.remove('d-none'); }
});

$('regPassword').addEventListener('input', function() {
    const bar = qs('.strength-bar');
    const val = this.value;
    if (val.length === 0) { bar.style.width = '0'; bar.className = 'strength-bar'; return; }
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    bar.className = 'strength-bar';
    if (score <= 2) bar.classList.add('weak');
    else if (score <= 3) bar.classList.add('medium');
    else bar.classList.add('strong');
});

async function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    await api('api/auth.php?action=logout', 'POST');
    state.user = null;
    $('authPage').style.display = 'flex';
    $('appShell').style.display = 'none';
}

async function checkSession() {
    try {
        const res = await api('api/auth.php?action=check');
        if (res.logged_in) { state.user = res.user; showApp(); }
    } catch (e) { /* not logged in */ }
}

function showApp() {
    $('authPage').style.display = 'none';
    $('appShell').style.display = 'flex';
    loadInitialData();
}

// ======================== INITIAL DATA ========================
async function loadInitialData() {
    try {
        const [catRes, settingsRes] = await Promise.all([
            api('api/categories.php?action=list'),
            api('api/profile.php?action=get_settings')
        ]);
        state.categories = catRes.categories || [];
        state.settings = settingsRes.settings || state.settings;
        applyTheme();
        if (state.settings.notifications) $('notifSwitch').checked = true;
        $('langSelect').value = state.settings.language || 'en';
        navigate('dashboard');
        updateNavProfile();
    } catch (e) { /* handle */ }
}

function updateNavProfile() {
    if (state.user) {
        $('navProfilePic').src = `uploads/${state.user.profile_pic}`;
        $('navProfilePic').onerror = function() { this.src = 'assets/img/default.png'; };
        $('dashboardUserName').textContent = state.user.full_name.split(' ')[0];
    }
}

// ======================== DASHBOARD ========================
async function renderDashboard() {
    try {
        const res = await api('api/dashboard.php');
        const s = res.stats;
        const stats = [
            { label: 'Total Tasks', value: s.total_tasks, icon: 'bi-list-task', color: '#6366f1', bg: 'rgba(99,102,241,0.15)', progress: 100 },
            { label: 'Completed', value: s.completed_tasks, icon: 'bi-check-circle', color: '#10b981', bg: 'rgba(16,185,129,0.15)', progress: s.total_tasks > 0 ? (s.completed_tasks / s.total_tasks * 100) : 0 },
            { label: 'Pending', value: s.pending_tasks, icon: 'bi-clock', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', progress: s.total_tasks > 0 ? (s.pending_tasks / s.total_tasks * 100) : 0 },
            { label: 'In Progress', value: s.in_progress_tasks, icon: 'bi-arrow-repeat', color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)', progress: s.total_tasks > 0 ? (s.in_progress_tasks / s.total_tasks * 100) : 0 },
            { label: 'Overdue', value: s.overdue_tasks, icon: 'bi-exclamation-triangle', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', progress: s.total_tasks > 0 ? (s.overdue_tasks / s.total_tasks * 100) : 0 }
        ];
        $('statsContainer').innerHTML = stats.map(st => `
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-icon" style="background:${st.bg};color:${st.color}"><i class="bi ${st.icon}"></i></div>
                </div>
                <div class="stat-card-value" data-target="${st.value}">0</div>
                <div class="stat-card-label">${st.label}</div>
                <div class="stat-card-progress"><div class="progress-fill" style="width:${st.progress}%;background:${st.color}"></div></div>
            </div>
        `).join('');
        animateCounters();
        $('progressPercent').textContent = s.progress + '%';
        $('progressBar').style.width = s.progress + '%';
        renderUpcomingTasks(s.upcoming_tasks || []);
        renderChart(s.chart_data || []);
    } catch (e) { /* handled */ }
}

function animateCounters() {
    qsa('.stat-card-value').forEach(el => {
        const target = parseInt(el.dataset.target);
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 40));
        const interval = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(interval); }
            el.textContent = current;
        }, 30);
    });
}

function renderUpcomingTasks(tasks) {
    if (!tasks.length) { $('upcomingTasksList').innerHTML = '<p class="text-muted small text-center py-4">No upcoming tasks</p>'; return; }
    $('upcomingTasksList').innerHTML = tasks.map(t => `
        <div class="d-flex align-items-center justify-content-between py-2 border-bottom border-light">
            <div><span class="d-block small fw-semibold">${escHtml(t.title)}</span><span class="text-muted" style="font-size:11px">Due: ${t.due_date}</span></div>
            <span class="badge bg-${t.priority} rounded-pill" style="font-size:10px">${t.priority}</span>
        </div>
    `).join('');
}

function renderChart(chartData) {
    const canvas = $('dashboardChart');
    if (state.chart) { state.chart.destroy(); }
    const months = chartData.map(d => d.month);
    const counts = chartData.map(d => parseInt(d.count));
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    state.chart = new Chart(canvas, {
        type: 'line',
        data: { labels: months.length ? months : ['No Data'], datasets: [{ label: 'Tasks', data: counts.length ? counts : [0], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#6366f1' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }, y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } } } }
    });
}

// ======================== TASKS / KANBAN ========================
async function loadTasks() {
    const params = new URLSearchParams({ action: 'list' });
    const search = $('globalSearch').value.trim();
    const cat = $('filterCategory').value;
    const pri = $('filterPriority').value;
    const stat = $('filterStatus').value;
    const date = $('filterDate').value;
    const sort = $('sortTasks').value;
    if (search) params.set('search', search);
    if (cat) params.set('category', cat);
    if (pri) params.set('priority', pri);
    if (stat) params.set('status', stat);
    if (date) params.set('due_date', date);
    if (sort) params.set('sort', sort);
    const res = await api(`api/tasks.php?${params}`);
    state.tasks = res.tasks || [];
    return state.tasks;
}

async function renderKanban() {
    await loadTasks();
    const columns = [
        { status: 'pending', title: 'Pending', icon: 'bi-clock', color: '#f59e0b' },
        { status: 'in_progress', title: 'In Progress', icon: 'bi-arrow-repeat', color: '#0ea5e9' },
        { status: 'completed', title: 'Completed', icon: 'bi-check-circle', color: '#10b981' }
    ];
    $('kanbanBoard').innerHTML = columns.map(col => {
        const tasks = state.tasks.filter(t => t.status === col.status);
        return `
            <div class="kanban-column" data-status="${col.status}">
                <div class="kanban-column-header">
                    <h6><i class="bi ${col.icon}" style="color:${col.color}"></i>${col.title}</h6>
                    <span class="task-count">${tasks.length}</span>
                </div>
                <div class="kanban-column-body" data-status="${col.status}" ondrop="drop(event)" ondragover="allowDrop(event)">
                    ${tasks.map(t => renderTaskCard(t)).join('')}
                </div>
            </div>
        `;
    }).join('');
    populateCategoryFilter();
}

function renderTaskCard(task) {
    const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'completed';
    return `
        <div class="task-card" draggable="true" ondragstart="dragStart(event, ${task.id})" data-id="${task.id}">
            <div class="task-card-actions">
                <button onclick="viewTask(${task.id})" title="View"><i class="bi bi-eye"></i></button>
                <button onclick="editTask(${task.id})" title="Edit"><i class="bi bi-pencil"></i></button>
                <button onclick="deleteTask(${task.id})" title="Delete"><i class="bi bi-trash"></i></button>
            </div>
            <div class="task-card-title">${escHtml(task.title)}</div>
            ${task.description ? `<div class="task-card-desc">${escHtml(task.description)}</div>` : ''}
            <div class="task-card-meta">
                ${task.category_name ? `<span class="badge" style="background:${task.category_color || '#6c757d'}">${escHtml(task.category_name)}</span>` : ''}
                <span class="badge bg-${task.priority}">${task.priority}</span>
                ${isOverdue ? '<span class="badge bg-danger">Overdue</span>' : ''}
            </div>
            <div class="task-card-footer">
                ${task.due_date ? `<span><i class="bi bi-calendar me-1"></i>${task.due_date}</span>` : '<span></span>'}
                <span><i class="bi bi-plus-circle me-1" onclick="quickDuplicate(${task.id})" style="cursor:pointer" title="Duplicate"></i></span>
            </div>
        </div>
    `;
}

// ======================== DRAG & DROP ========================
let draggedId = null;
function dragStart(e, id) { draggedId = id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => e.target.classList.add('dragging'), 0); }
function allowDrop(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); }
document.addEventListener('dragend', () => { qsa('.dragging').forEach(el => el.classList.remove('dragging')); qsa('.drag-over').forEach(el => el.classList.remove('drag-over')); });
async function drop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!draggedId) return;
    const newStatus = e.currentTarget.dataset.status;
    const task = state.tasks.find(t => t.id == draggedId);
    if (!task || task.status === newStatus) return;
    try {
        await api('api/tasks.php?action=reorder', 'POST', { id: draggedId, status: newStatus });
        showToast('Task moved!', 'success');
        renderKanban();
    } catch (e) { /* handled */ }
    draggedId = null;
}

// ======================== TASK CRUD ========================
function openTaskModal(taskData) {
    const modal = new bootstrap.Modal($('taskModal'));
    $('taskModalTitle').textContent = taskData ? 'Edit Task' : 'New Task';
    $('taskId').value = taskData ? taskData.id : '';
    $('taskTitle').value = taskData ? taskData.title : '';
    $('taskDescription').value = taskData ? taskData.description : '';
    $('taskPriority').value = taskData ? taskData.priority : 'medium';
    $('taskStatus').value = taskData ? taskData.status : 'pending';
    $('taskDueDate').value = taskData ? taskData.due_date : '';
    $('taskNotes').value = taskData ? taskData.notes : '';
    const sel = $('taskCategory');
    sel.innerHTML = '<option value="">Select category</option>' + state.categories.map(c => `<option value="${c.id}" ${taskData && taskData.category_id == c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
    modal.show();
}

function editTask(id) {
    const task = state.tasks.find(t => t.id == id);
    if (task) openTaskModal(task);
}

async function saveTask() {
    const data = {
        id: $('taskId').value || undefined,
        title: $('taskTitle').value.trim(),
        description: $('taskDescription').value.trim(),
        category_id: $('taskCategory').value,
        priority: $('taskPriority').value,
        status: $('taskStatus').value,
        due_date: $('taskDueDate').value,
        notes: $('taskNotes').value.trim()
    };
    if (!data.title) { showToast('Title is required', 'error'); return; }
    const isEdit = !!data.id;
    try {
        const res = await api(`api/tasks.php?action=${isEdit ? 'update' : 'create'}`, 'POST', data);
        showToast(isEdit ? 'Task updated!' : 'Task created!', 'success');
        bootstrap.Modal.getInstance($('taskModal')).hide();
        if (state.currentPage === 'tasks') renderKanban();
        else if (state.currentPage === 'dashboard') renderDashboard();
    } catch (e) { /* handled */ }
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    try {
        await api('api/tasks.php?action=delete', 'POST', { id });
        showToast('Task deleted', 'warning');
        if (state.currentPage === 'tasks') renderKanban();
        else if (state.currentPage === 'dashboard') renderDashboard();
    } catch (e) { /* handled */ }
}

async function quickDuplicate(id) {
    try {
        await api('api/tasks.php?action=duplicate', 'POST', { id });
        showToast('Task duplicated!', 'success');
        renderKanban();
    } catch (e) { /* handled */ }
}

async function viewTask(id) {
    try {
        const res = await api(`api/tasks.php?action=get&id=${id}`);
        const t = res.task;
        $('viewTaskTitle').textContent = t.title;
        $('viewTaskBody').innerHTML = `
            <div class="mb-3">
                <span class="badge bg-${t.priority} me-1">${t.priority}</span>
                <span class="badge bg-${t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'info' : 'warning'}">${t.status.replace('_', ' ')}</span>
                ${t.category_name ? `<span class="badge" style="background:${t.category_color}">${escHtml(t.category_name)}</span>` : ''}
            </div>
            ${t.description ? `<p class="small">${escHtml(t.description)}</p>` : ''}
            <div class="row small text-muted">
                <div class="col-6">${t.due_date ? `<i class="bi bi-calendar me-1"></i>Due: ${t.due_date}` : ''}</div>
                <div class="col-6 text-end"><i class="bi bi-clock me-1"></i>Created: ${t.created_at}</div>
            </div>
            ${t.notes ? `<hr><p class="small mb-0"><strong>Notes:</strong> ${escHtml(t.notes)}</p>` : ''}
            ${t.due_date && t.due_date < new Date().toISOString().split('T')[0] && t.status !== 'completed' ? '<div class="alert alert-danger mt-3 py-2 small">This task is overdue!</div>' : ''}
            <div class="mt-3 d-flex gap-2">
                ${t.status !== 'completed' ? `<button class="btn btn-sm btn-success" onclick="quickComplete(${t.id})"><i class="bi bi-check-lg"></i> Mark Complete</button>` : `<button class="btn btn-sm btn-warning" onclick="quickReopen(${t.id})"><i class="bi bi-arrow-counterclockwise"></i> Reopen</button>`}
                <button class="btn btn-sm btn-outline-primary" onclick="bootstrap.Modal.getInstance($('viewTaskModal')).hide();editTask(${t.id})"><i class="bi bi-pencil"></i> Edit</button>
            </div>
        `;
        new bootstrap.Modal($('viewTaskModal')).show();
    } catch (e) { /* handled */ }
}

async function quickComplete(id) {
    try {
        await api('api/tasks.php?action=update', 'POST', { id, title: state.tasks.find(t => t.id == id).title, status: 'completed', priority: state.tasks.find(t => t.id == id).priority });
        showToast('Task completed!', 'success');
        bootstrap.Modal.getInstance($('viewTaskModal'))?.hide();
        if (state.currentPage === 'tasks') renderKanban();
        else if (state.currentPage === 'dashboard') renderDashboard();
    } catch (e) { /* handled */ }
}

async function quickReopen(id) {
    try {
        const t = state.tasks.find(t => t.id == id);
        await api('api/tasks.php?action=update', 'POST', { id, title: t.title, status: 'pending', priority: t.priority });
        showToast('Task reopened', 'info');
        bootstrap.Modal.getInstance($('viewTaskModal'))?.hide();
        if (state.currentPage === 'tasks') renderKanban();
        else if (state.currentPage === 'dashboard') renderDashboard();
    } catch (e) { /* handled */ }
}

// ======================== SEARCH & FILTER ========================
function handleSearch(value) {
    if (state.currentPage !== 'tasks') navigate('tasks');
    else filterTasks();
}
function filterTasks() {
    if (state.currentPage === 'tasks') renderKanban();
}

function populateCategoryFilter() {
    const sel = $('filterCategory');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Categories</option>' + state.categories.map(c => `<option value="${c.id}" ${current == c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
}

// ======================== CATEGORIES ========================
function openCategoryModal(cat) {
    const modal = new bootstrap.Modal($('categoryModal'));
    $('categoryModalTitle').textContent = cat ? 'Edit Category' : 'New Category';
    $('categoryId').value = cat ? cat.id : '';
    $('categoryName').value = cat ? cat.name : '';
    $('categoryColor').value = cat ? cat.color : '#6366f1';
    modal.show();
}

async function saveCategory() {
    const data = {
        id: $('categoryId').value || undefined,
        name: $('categoryName').value.trim(),
        color: $('categoryColor').value
    };
    if (!data.name) { showToast('Name is required', 'error'); return; }
    const isEdit = !!data.id;
    try {
        await api(`api/categories.php?action=${isEdit ? 'update' : 'create'}`, 'POST', data);
        showToast(isEdit ? 'Category updated!' : 'Category created!', 'success');
        bootstrap.Modal.getInstance($('categoryModal')).hide();
        const res = await api('api/categories.php?action=list');
        state.categories = res.categories || [];
        renderCategories();
    } catch (e) { /* handled */ }
}

async function renderCategories() {
    const res = await api('api/categories.php?action=list');
    state.categories = res.categories || [];
    $('categoriesList').innerHTML = state.categories.map(c => `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="category-card">
                <div>
                    <span class="category-color" style="background:${c.color}"></span>
                    <span class="category-name">${escHtml(c.name)}</span>
                </div>
                <div class="category-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick='openCategoryModal(${JSON.stringify(c).replace(/'/g,"&#39;")})'><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${c.id})"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

async function deleteCategory(id) {
    if (!confirm('Delete this category? Tasks will become uncategorized.')) return;
    try {
        await api('api/categories.php?action=delete', 'POST', { id });
        showToast('Category deleted', 'warning');
        const res = await api('api/categories.php?action=list');
        state.categories = res.categories || [];
        renderCategories();
    } catch (e) { /* handled */ }
}

// ======================== CALENDAR ========================
function changeMonth(delta) {
    if (state.calendarView === 'week') {
        state.calendarDate.setDate(state.calendarDate.getDate() + delta * 7);
    } else {
        state.calendarDate.setMonth(state.calendarDate.getMonth() + delta);
    }
    renderCalendar();
}

function renderCalendar() {
    const view = state.calendarView || 'month';
    const date = state.calendarDate;
    const today = new Date().toISOString().split('T')[0];
    const taskMap = {};
    state.tasks.forEach(t => { if (t.due_date) { if (!taskMap[t.due_date]) taskMap[t.due_date] = []; taskMap[t.due_date].push(t); } });

    if (view === 'week') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        $('calendarTitle').textContent = `${startOfWeek.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${endOfWeek.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;

        let cells = '';
        for (let d = 0; d < 7; d++) {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + d);
            const dateStr = day.toISOString().split('T')[0];
            const isToday = dateStr === today;
            const tasks = taskMap[dateStr] || [];
            const colors = tasks.map(t => t.status === 'completed' ? '#10b981' : t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#6366f1');
            cells += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="viewDayTasks('${dateStr}')" style="aspect-ratio:auto;min-height:80px;justify-content:flex-start;padding:8px;align-items:flex-start">
                <span class="fw-bold mb-1">${day.getDate()}</span>
                ${tasks.slice(0,3).map(t => `<span style="font-size:9px;background:${t.status === 'completed' ? '#10b981' : t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#6366f1'};color:#fff;border-radius:4px;padding:1px 6px;margin:1px 0;width:100%;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</span>`).join('')}
                ${tasks.length > 3 ? `<span class="text-muted" style="font-size:9px">+${tasks.length-3} more</span>` : ''}
            </div>`;
        }
        $('calendarGrid').innerHTML = `<div class="calendar-header">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div>${d}</div>`).join('')}</div><div class="calendar-grid">${cells}</div>`;
    } else {
        const year = date.getFullYear();
        const month = date.getMonth();
        $('calendarTitle').textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();

        let cells = '';
        for (let i = 0; i < firstDay; i++) {
            const day = daysInPrev - firstDay + i + 1;
            cells += `<div class="calendar-day other-month"><span>${day}</span></div>`;
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = dateStr === today;
            const tasks = taskMap[dateStr] || [];
            const colors = tasks.map(t => t.status === 'completed' ? '#10b981' : t.priority === 'high' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#6366f1');
            cells += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="viewDayTasks('${dateStr}')">
                <span>${d}</span>
                ${colors.map(c => `<span class="day-dot" style="background:${c}"></span>`).join('')}
            </div>`;
        }
        const remaining = 42 - (firstDay + daysInMonth);
        for (let i = 1; i <= remaining; i++) {
            cells += `<div class="calendar-day other-month"><span>${i}</span></div>`;
        }
        $('calendarGrid').innerHTML = `<div class="calendar-header">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div>${d}</div>`).join('')}</div><div class="calendar-grid">${cells}</div>`;
    }
}

function viewDayTasks(dateStr) {
    const tasks = state.tasks.filter(t => t.due_date === dateStr);
    if (!tasks.length) { showToast('No tasks for this date', 'info'); return; }
    $('viewTaskTitle').textContent = `Tasks for ${dateStr}`;
    $('viewTaskBody').innerHTML = tasks.map(t => `
        <div class="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2">
            <div>
                <span class="fw-semibold small">${escHtml(t.title)}</span>
                <div class="small text-muted">
                    <span class="badge bg-${t.priority} me-1">${t.priority}</span>
                    <span class="badge bg-${t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'info' : 'warning'}">${t.status.replace('_',' ')}</span>
                </div>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="bootstrap.Modal.getInstance($('viewTaskModal')).hide();viewTask(${t.id})"><i class="bi bi-eye"></i></button>
        </div>
    `).join('');
    new bootstrap.Modal($('viewTaskModal')).show();
}

// ======================== PROFILE ========================
async function loadProfile() {
    try {
        const res = await api('api/profile.php?action=get');
        const u = res.user;
        $('profileName').textContent = u.full_name;
        $('profileUsername').textContent = '@' + u.username;
        $('profilePic').src = `uploads/${u.profile_pic}`;
        $('profilePic').onerror = function() { this.src = 'assets/img/default.png'; };
        $('editFullName').value = u.full_name;
        $('editEmail').value = u.email;
    } catch (e) { /* handled */ }
}

$('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await api('api/profile.php?action=update', 'POST', { full_name: $('editFullName').value.trim(), email: $('editEmail').value.trim() });
        showToast('Profile updated!', 'success');
        loadProfile();
        updateNavProfile();
    } catch (e) { /* handled */ }
});

$('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = $('currentPwd').value;
    const newPwd = $('newPwd').value;
    const confirm = $('confirmNewPwd').value;
    if (newPwd !== confirm) { showToast('Passwords do not match', 'error'); return; }
    if (newPwd.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    try {
        await api('api/profile.php?action=password', 'POST', { current_password: current, new_password: newPwd, confirm_password: confirm });
        showToast('Password changed!', 'success');
        $('currentPwd').value = ''; $('newPwd').value = ''; $('confirmNewPwd').value = '';
    } catch (e) { /* handled */ }
});

async function uploadProfilePic(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('profile_pic', file);
    try {
        const res = await apiForm('api/profile.php?action=upload', fd);
        showToast('Profile picture updated!', 'success');
        state.user.profile_pic = res.filename;
        loadProfile();
        updateNavProfile();
    } catch (e) { /* handled */ }
}

// ======================== SETTINGS ========================
async function loadSettings() {
    try {
        const res = await api('api/profile.php?action=get_settings');
        state.settings = res.settings || state.settings;
        $('darkModeSwitch').checked = !!state.settings.dark_mode;
        $('notifSwitch').checked = !!state.settings.notifications;
        $('langSelect').value = state.settings.language || 'en';
    } catch (e) { /* handled */ }
}

async function saveSettings() {
    state.settings.dark_mode = $('darkModeSwitch').checked ? 1 : 0;
    state.settings.notifications = $('notifSwitch').checked ? 1 : 0;
    state.settings.language = $('langSelect').value;
    try {
        await api('api/profile.php?action=settings', 'POST', state.settings);
        applyTheme();
        showToast('Settings saved!', 'success');
    } catch (e) { /* handled */ }
}

// ======================== DARK MODE ========================
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-bs-theme') === 'dark';
    html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
    $('themeIcon').className = isDark ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
    $('darkModeSwitch').checked = !isDark;
    state.settings.dark_mode = !isDark ? 1 : 0;
    api('api/profile.php?action=settings', 'POST', { dark_mode: state.settings.dark_mode, notifications: state.settings.notifications, language: state.settings.language }).catch(() => {});
    if (state.chart) renderDashboard();
}

function applyTheme() {
    const html = document.documentElement;
    const isDark = !!state.settings.dark_mode;
    html.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    $('themeIcon').className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
}

// ======================== KEYBOARD SHORTCUTS ========================
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); $('globalSearch')?.focus(); }
    if (e.key === 'n' && state.currentPage === 'tasks') { openTaskModal(); }
    if (e.key === 'Escape') { qs('.modal.show') && bootstrap.Modal.getInstance(qs('.modal.show'))?.hide(); }
});

// ======================== HTML ESCAPE ========================
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
