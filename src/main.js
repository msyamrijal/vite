// Import CSS from the same directory
import './styles.css';

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
const API_BASE_URL = '/api'; // Assumes Netlify redirect is set up

const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;
const CREATE_SCHEDULE_URL = `${API_BASE_URL}/createSchedule`;
const UPDATE_SCHEDULE_URL = `${API_BASE_URL}/updateSchedule`;
const DELETE_SCHEDULE_URL = `${API_BASE_URL}/deleteSchedule`;

// Main DOM Elements
const elements = {
    searchInput: document.getElementById('searchInput'),
    institutionFilter: document.getElementById('institutionFilter'),
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    modal: document.getElementById('genericModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalOverlay: document.querySelector('.modal-overlay'),
    themeToggleBtn: document.getElementById('themeToggle')
};

// Admin Feature DOM Elements
const adminElements = {
    adminSection: document.getElementById('adminSection'),
    netlifyIdentityWidgetContainer: document.getElementById('netlifyIdentityWidget'),
    scheduleForm: document.getElementById('scheduleForm'),
    formTitle: document.getElementById('formTitle'),
    scheduleIdInput: document.getElementById('scheduleId'),
    formInstitusiInput: document.getElementById('formInstitusi'),
    formMataPelajaranInput: document.getElementById('formMataPelajaran'),
    formTanggalInput: document.getElementById('formTanggal'),
    formPesertaInput: document.getElementById('formPeserta'),
    scheduleSubmitButton: document.getElementById('scheduleSubmitBtn'),
    cancelEditButton: document.getElementById('cancelEditBtn'),
    formStatus: document.getElementById('formStatus'),
};

// Global Variables
let allSchedules = [];
let currentUser = null;
let isEditMode = false;

// ======================
// THEME MANAGEMENT
// ======================
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
};

const updateThemeIcon = (theme) => {
    const themeIcon = elements.themeToggleBtn?.querySelector('.theme-icon');
    // Add logic here to update the theme icon based on the theme (e.g., toggle classes)
    if (themeIcon) {
        // Example: themeIcon.classList.toggle('dark-mode-icon', theme === 'dark');
    }
};

// ======================
// DATA MANAGEMENT (Fetch)
// ======================
const fetchData = async () => {
    showLoading();
    hideEmptyState();
    try {
        const response = await fetch(GET_SCHEDULES_URL);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) { /* Ignore */ }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
             throw new Error("Invalid data format received from server.");
        }
        const today = new Date(); today.setUTCHours(0, 0, 0, 0); // Use UTC for comparison
        allSchedules = data
            .filter(item => item && item.tanggal) // Ensure item and date exist
            .map(item => ({
                ...item,
                peserta: Array.isArray(item.peserta) ? item.peserta : [], // Ensure peserta is always an array
                TanggalDate: new Date(item.tanggal + 'T00:00:00Z') // Assume date is UTC
             }))
            .filter(item => item.TanggalDate && item.TanggalDate >= today) // Filter invalid dates and past schedules
            .sort((a, b) => a.TanggalDate - b.TanggalDate); // Sort by date
        initFilters();
        filterSchedules(); // Render the fetched and processed data
    } catch (error) {
        console.error('Fetch Error:', error);
        showError(`Gagal memuat data jadwal: ${error.message}`);
        allSchedules = [];
        renderSchedules([]); // Render empty state on error
    } finally {
        hideLoading();
    }
};

// ======================
// FILTER SYSTEM
// ======================
const initFilters = () => {
    if (!elements.institutionFilter) return;
    const institutions = [...new Set(allSchedules.map(item => item.institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;
    const currentFilterValue = filterSelect.value;
    filterSelect.length = 1; // Clear existing options except the first one
    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
     });
    // Restore previous selection if still valid
    if (institutions.includes(currentFilterValue)) { filterSelect.value = currentFilterValue; }
    // Attach listeners only once
    if (!filterSelect.dataset.listenerAttached) {
        elements.searchInput?.addEventListener('input', debounce(filterSchedules, 300));
        filterSelect.addEventListener('change', filterSchedules);
        filterSelect.dataset.listenerAttached = 'true';
     }
};

const filterSchedules = () => {
    const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
    const selectedInstitution = elements.institutionFilter?.value || 'all';
    const filtered = allSchedules.filter(item => {
        const pesertaText = Array.isArray(item.peserta) ? item.peserta.join(' ') : '';
        const searchableText = [item.institusi, item.mata_pelajaran, pesertaText].join(' ').toLowerCase();
        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        const matchesInstitution = selectedInstitution === 'all' || item.institusi === selectedInstitution;
        return matchesSearch && matchesInstitution;
     });
    renderSchedules(filtered);
};

// ======================
// RENDERING SCHEDULES
// ======================
const renderSchedules = (data) => {
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = ''; // Clear the grid first
    if (data.length === 0) {
        // Show empty state only if not currently loading
        if (!elements.loading || elements.loading.style.display === 'none') {
             showEmptyState("Tidak ada jadwal yang cocok dengan filter Anda.");
        }
        return;
    }
    hideEmptyState(); // Hide empty state if there's data
    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        const card = createScheduleCard(item);
        fragment.appendChild(card);
    });
    elements.scheduleGrid.appendChild(fragment);
};

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    card.className = 'schedule-card';
    // Ensure peserta is handled correctly
    let pesertaHtml = '<span class="participant-tag na-tag">N/A</span>';
    if (Array.isArray(item.peserta) && item.peserta.length > 0) {
        pesertaHtml = item.peserta.map(peserta => {
            const pesertaText = typeof peserta === 'string' ? peserta : 'Invalid Data';
            return `<span class="participant-tag clickable" data-entity="Peserta" title="Lihat semua jadwal ${pesertaText}">${pesertaText}</span>`;
        }).join('');
    }
    // Render card content
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-entity="Mata_Pelajaran" title="Lihat semua jadwal ${item.mata_pelajaran}">${item.mata_pelajaran || 'N/A'}</h3>
            <span class="date-display clickable" data-entity="Tanggal" title="Lihat semua jadwal pada ${formatDate(item.tanggal)}">${formatDate(item.tanggal)}</span>
        </div>
        <div class="institute clickable" data-entity="Institusi" title="Lihat semua jadwal dari ${item.institusi}">${item.institusi || 'N/A'}</div>
        <div class="participants">
            ${pesertaHtml}
        </div>
        ${currentUser ? `
            <div class="admin-actions">
                <button class="btn-edit" data-id="${item.id}" title="Edit Jadwal Ini">Edit</button>
                <button class="btn-delete" data-id="${item.id}" title="Hapus Jadwal Ini">Hapus</button>
            </div>
        ` : ''}
    `;
    return card;
};

// ======================
// MODAL DETAIL
// ======================
const showGenericModal = (title, data) => {
    if (!elements.modal) return;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = generateModalContent(data);
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

const hideModal = () => {
    if (!elements.modal) return;
    elements.modal.style.display = 'none';
    document.body.style.overflow = '';
};

const generateModalContent = (data) => {
    if (!data || data.length === 0) {
        return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
    }
    return data.map(item => {
        let pesertaHtmlModal = '<span class="participant-tag na-tag">N/A</span>';
        if (Array.isArray(item.peserta) && item.peserta.length > 0) {
             pesertaHtmlModal = item.peserta.map(p => `<span class="participant-tag">${typeof p === 'string' ? p : 'Invalid'}</span>`).join('');
        }
        return `
            <div class="modal-item">
                <div class="card-header"><h4 class="course-title">${item.mata_pelajaran || 'N/A'}</h4></div>
                 <div class="modal-meta">
                    <span class="institute">${item.institusi || 'N/A'}</span>
                    <span class="date-display">${formatDate(item.tanggal)}</span>
                </div>
                <div class="participants">${pesertaHtmlModal}</div>
            </div>
        `;
        }).join('');
};

// ======================
// EVENT HANDLER - ENTITY CLICK
// ======================
const handleEntityClick = (element) => {
    const entityType = element.dataset.entity;
    const value = element.textContent.trim();
    let filterProperty = entityType;
    let modalTitlePrefix = '';
    if (entityType === 'Mata_Pelajaran') filterProperty = 'mata_pelajaran';
    if (entityType === 'Institusi') filterProperty = 'institusi';

    let filteredData;
    if (entityType === 'Peserta') {
        filteredData = allSchedules.filter(item => Array.isArray(item.peserta) && item.peserta.includes(value));
        modalTitlePrefix = `Jadwal untuk ${value}`;
    } else if (entityType === 'Tanggal') {
        const clickedDate = new Date(value + 'T00:00:00Z'); // Compare UTC dates
         if (!isNaN(clickedDate.getTime())) {
             filteredData = allSchedules.filter(item =>
                 item.TanggalDate.getUTCFullYear() === clickedDate.getUTCFullYear() &&
                 item.TanggalDate.getUTCMonth() === clickedDate.getUTCMonth() &&
                 item.TanggalDate.getUTCDate() === clickedDate.getUTCDate()
             );
         } else { filteredData = []; }
         modalTitlePrefix = `Jadwal pada ${formatDate(value)}`;
    } else {
        filteredData = allSchedules.filter(item => item[filterProperty] === value);
        modalTitlePrefix = `Jadwal ${value}`;
    }

    const today = new Date(); today.setUTCHours(0, 0, 0, 0); // Compare UTC
    const futureFilteredData = filteredData.filter(item => item.TanggalDate >= today);
    showGenericModal(modalTitlePrefix, futureFilteredData);
};

// ======================
// ADMIN FUNCTIONS - FORM MANAGEMENT
// ======================
const setupEditForm = (scheduleId) => {
    const schedule = allSchedules.find(s => s.id === scheduleId);
    if (!schedule || !adminElements.scheduleForm) {
        console.error(`Schedule with ID ${scheduleId} not found for editing or form element missing.`);
        showFormStatus("Error: Jadwal tidak ditemukan untuk diedit.", true);
        return;
    }
    isEditMode = true;
    adminElements.scheduleIdInput.value = schedule.id;
    adminElements.formTitle.textContent = "Edit Jadwal";
    adminElements.formInstitusiInput.value = schedule.institusi;
    adminElements.formMataPelajaranInput.value = schedule.mata_pelajaran;
    adminElements.formTanggalInput.value = schedule.tanggal; // YYYY-MM-DD format
    adminElements.formPesertaInput.value = Array.isArray(schedule.peserta) ? schedule.peserta.join(', ') : '';
    adminElements.scheduleSubmitButton.textContent = "Update Jadwal";
    adminElements.cancelEditButton.style.display = 'inline-block';
    adminElements.adminSection?.classList.add('editing');
    adminElements.scheduleForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    adminElements.formInstitusiInput.focus();
};

const resetToAddMode = () => {
    isEditMode = false;
    adminElements.scheduleForm?.reset();
    if(adminElements.scheduleIdInput) adminElements.scheduleIdInput.value = '';
    if(adminElements.formTitle) adminElements.formTitle.textContent = "Tambah Jadwal Baru";
    if(adminElements.scheduleSubmitButton) adminElements.scheduleSubmitButton.textContent = "Tambah Jadwal";
    if(adminElements.cancelEditButton) adminElements.cancelEditButton.style.display = 'none';
    adminElements.adminSection?.classList.remove('editing');
    showFormStatus("", false); // Clear status message
};

const handleCancelEdit = () => {
    resetToAddMode();
};

const handleScheduleFormSubmit = async (event) => {
    event.preventDefault();
    const submitButton = adminElements.scheduleSubmitButton;
    if (!submitButton || submitButton.disabled) return;

    const user = netlifyIdentity.currentUser();
    if (!user) { showFormStatus("Error: Anda harus login.", true); return; }
    const token = user.token?.access_token;
    if (!token) { showFormStatus("Error: Gagal mendapatkan token autentikasi.", true); return; }

    // Get and validate form data
    const scheduleId = adminElements.scheduleIdInput.value;
    const institusi = adminElements.formInstitusiInput.value.trim();
    const mata_pelajaran = adminElements.formMataPelajaranInput.value.trim();
    const tanggal = adminElements.formTanggalInput.value;
    const pesertaInput = adminElements.formPesertaInput.value.trim();

    if (!institusi || !mata_pelajaran || !tanggal || !pesertaInput) { showFormStatus("Error: Semua field wajib diisi.", true); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) { showFormStatus("Error: Format tanggal tidak valid (YYYY-MM-DD).", true); return; }
    const inputDate = new Date(tanggal + 'T00:00:00Z');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    if (inputDate < today && !isEditMode) { showFormStatus("Error: Tanggal tidak boleh di masa lalu.", true); return; }
    const peserta = pesertaInput.split(',').map(p => p.trim()).filter(p => p);
    if (peserta.length === 0) { showFormStatus("Error: Field peserta tidak boleh kosong.", true); return; }

    // Prepare API call
    const scheduleData = { institusi, mata_pelajaran, tanggal, peserta };
    let apiUrl, method, requestBody;
    if (isEditMode) {
        const idNum = parseInt(scheduleId, 10);
        if(isNaN(idNum)) { showFormStatus("Error: ID Jadwal tidak valid untuk update.", true); return; }
        apiUrl = UPDATE_SCHEDULE_URL; method = 'PUT';
        requestBody = JSON.stringify({ id: idNum, data: scheduleData });
    } else {
        apiUrl = CREATE_SCHEDULE_URL; method = 'POST';
        requestBody = JSON.stringify(scheduleData);
    }

    setFormSubmitting(true); // Disable form
    try {
        const response = await fetch(apiUrl, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: requestBody
        });
        const responseData = await response.json(); // Try to parse JSON regardless of status
        if (!response.ok) {
            const errorMsg = responseData.error || responseData.message || `Gagal ${isEditMode ? 'update' : 'simpan'}: Status ${response.status}`;
            throw new Error(errorMsg);
        }
        showFormStatus(`Jadwal berhasil ${isEditMode ? 'diupdate' : 'ditambahkan'}!`, false);
        resetToAddMode(); // Reset form to add mode
        await fetchData(); // Refresh schedule list
        setTimeout(() => showFormStatus("", false), 4000); // Clear success message
    } catch (error) {
        console.error(`Error ${isEditMode ? 'updating' : 'creating'} schedule:`, error);
        showFormStatus(`Error: ${error.message}`, true);
    } finally {
        setFormSubmitting(false); // Re-enable form
    }
};

// Helper to manage form submission state
const setFormSubmitting = (isSubmitting) => {
    if (adminElements.scheduleSubmitButton) {
        adminElements.scheduleSubmitButton.disabled = isSubmitting;
        adminElements.scheduleSubmitButton.textContent = isSubmitting ? 'Memproses...' : (isEditMode ? 'Update Jadwal' : 'Tambah Jadwal');
     }
    if (adminElements.cancelEditButton) { adminElements.cancelEditButton.disabled = isSubmitting; }
    // Show a generic processing message or clear it
    showFormStatus(isSubmitting ? `Memproses permintaan ${isEditMode ? 'update' : 'tambah'}...` : "", false);
};

// Helper to display form status messages
const showFormStatus = (message, isError) => {
    if (adminElements.formStatus) {
        adminElements.formStatus.textContent = message;
        adminElements.formStatus.className = `form-status ${isError ? 'error' : 'success'}`;
        adminElements.formStatus.style.display = message ? 'block' : 'none';
     }
};

// ======================
// ADMIN FUNCTIONS - DELETE SCHEDULE
// ======================
const handleDeleteClick = async (scheduleIdStr) => {
    const scheduleId = parseInt(scheduleIdStr, 10);
    if (isNaN(scheduleId)) { showError("Gagal menghapus: ID jadwal tidak valid."); return; }

    const scheduleToDelete = allSchedules.find(s => s.id === scheduleId);
    if (!scheduleToDelete) { showError("Gagal menghapus: Jadwal tidak ditemukan lagi."); return; }
    const confirmationMessage = `Anda yakin ingin menghapus jadwal berikut?\n\nInstitusi: ${scheduleToDelete.institusi}\nMata Kuliah: ${scheduleToDelete.mata_pelajaran}\nTanggal: ${formatDate(scheduleToDelete.tanggal)}`;
    if (!confirm(confirmationMessage)) { return; } // Cancel if user clicks "Cancel"

    const user = netlifyIdentity.currentUser();
    if (!user) { showError("Error: Anda harus login untuk menghapus jadwal."); return; }
    const token = user.token?.access_token;
    if (!token) { showError("Error: Gagal mendapatkan token autentikasi."); return; }

    // Disable button temporarily
    const deleteButton = document.querySelector(`.btn-delete[data-id="${scheduleId}"]`);
    const originalButtonText = deleteButton ? deleteButton.textContent : 'Hapus';
    if(deleteButton) { deleteButton.disabled = true; deleteButton.textContent = 'Menghapus...'; }
    showFormStatus(`Menghapus jadwal ID ${scheduleId}...`, false); // Show status

    try {
        const response = await fetch(`${DELETE_SCHEDULE_URL}?id=${scheduleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 204) { // Success (No Content)
            showFormStatus("Jadwal berhasil dihapus!", false);
            setTimeout(() => showFormStatus("", false), 4000);
            // Update UI locally for faster feedback
            allSchedules = allSchedules.filter(s => s.id !== scheduleId);
            filterSchedules(); // Re-render the grid
        } else if (response.status === 404) {
             showError(`Gagal menghapus: Jadwal dengan ID ${scheduleId} tidak ditemukan.`);
             await fetchData(); // Resync data if not found
        } else {
            // Handle other errors
            let errorMsg = `Gagal menghapus: Status ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch(e) { /* Ignore if not JSON */ }
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error(`Error deleting schedule ID ${scheduleId}:`, error);
        showError(`Error menghapus jadwal: ${error.message}`);
        showFormStatus("", false); // Clear loading status
    } finally {
         // Re-enable button
         if(deleteButton) { deleteButton.disabled = false; deleteButton.textContent = originalButtonText; }
    }
};

// ======================
// AUTHENTICATION (Netlify Identity)
// ======================
const setupAdminFeatures = (user) => {
    currentUser = user;
    const isAdminSectionVisible = !!user;
    if (adminElements.adminSection) { adminElements.adminSection.style.display = isAdminSectionVisible ? 'block' : 'none'; }
    else { console.warn("Admin section element not found."); }
    resetToAddMode(); // Reset form on login/logout
    filterSchedules(); // Re-render schedules to show/hide admin buttons
};

const initNetlifyIdentity = () => {
     if (adminElements.netlifyIdentityWidgetContainer) {
        if (window.netlifyIdentity) {
            window.netlifyIdentity.init({ container: '#netlifyIdentityWidget' });
            window.netlifyIdentity.on('init', user => setupAdminFeatures(user)); // Handle initial state
            window.netlifyIdentity.on('login', (user) => { window.netlifyIdentity.close(); setupAdminFeatures(user); });
            window.netlifyIdentity.on('logout', () => setupAdminFeatures(null));
            window.netlifyIdentity.on('error', (err) => { console.error('Identity Error:', err); showError(`Autentikasi error: ${err.message || 'Unknown'}`); });
        } else { console.error("Netlify Identity script not loaded."); showError("Gagal memuat komponen autentikasi."); }
    } else { console.warn("Netlify Identity widget container (#netlifyIdentityWidget) not found."); }
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => {
    if (!dateString) return 'Tanggal tidak valid';
    // Ensure dateString is treated as UTC date part
    const date = (dateString instanceof Date) ? dateString : new Date(dateString + 'T00:00:00Z');
    if (isNaN(date.getTime())) return 'Tanggal tidak valid';
    // Format options for Indonesian locale, specifying UTC to avoid local timezone shifts
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('id-ID', options);
};

const showLoading = () => { if(elements.loading) elements.loading.style.display = 'flex'; if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; hideEmptyState(); };
const hideLoading = () => { if(elements.loading) elements.loading.style.display = 'none'; if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'grid'; };
const showEmptyState = (message = "Tidak ada jadwal yang ditemukan.") => { if(elements.emptyState) { elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-ghost empty-icon"></i><h3>Oops! Kosong</h3><p>${message}</p>`; } if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; };
const hideEmptyState = () => { if(elements.emptyState) elements.emptyState.style.display = 'none'; };
const showError = (message = 'Terjadi kesalahan.') => { hideLoading(); if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; if(elements.emptyState) { elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-exclamation-triangle empty-icon error-icon"></i><h3>Terjadi Kesalahan</h3><p>${message}</p>`; } };
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

// ======================
// EVENT LISTENERS (Dynamic via Delegation)
// ======================
const attachDynamicListeners = () => {
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        // Click on clickable entities in schedule cards
        if (target.classList.contains('clickable') && target.dataset.entity) { handleEntityClick(target); }
        // Click on modal close button or overlay
        if (target === elements.modalOverlay || target.closest('.close-modal')) { hideModal(); }
        // Click on Edit button
        if (target.classList.contains('btn-edit')) { const scheduleId = target.dataset.id; setupEditForm(parseInt(scheduleId, 10)); }
        // Click on Delete button
        if (target.classList.contains('btn-delete')) { const scheduleId = target.dataset.id; handleDeleteClick(scheduleId); }
    });
};

// ======================
// APP INITIALIZATION
// ======================
document.addEventListener('DOMContentLoaded', () => {
    // Ensure essential elements exist before proceeding
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState) {
        console.error("Initialization failed: Essential elements missing.");
        document.body.innerHTML = "<p style='color:red; padding: 20px;'>Error Kritis: Elemen dasar aplikasi tidak ditemukan. Periksa struktur HTML Anda.</p>";
        return;
    }

    initTheme(); // Initialize theme
    initNetlifyIdentity(); // Initialize authentication
    fetchData(); // Fetch initial data
    attachDynamicListeners(); // Attach main event listeners

    // Attach static listeners
    elements.themeToggleBtn?.addEventListener('click', toggleTheme);
    adminElements.scheduleForm?.addEventListener('submit', handleScheduleFormSubmit);
    adminElements.cancelEditButton?.addEventListener('click', handleCancelEdit);

    // Listener for Escape key to close modal
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal?.style.display === 'block') {
            hideModal();
        }
     });
});
