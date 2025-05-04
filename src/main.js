// Import CSS
import './styles.css'; // Asumsi styles.css ada di src

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
console.log("Script main.js mulai dieksekusi."); // Log Awal

const API_BASE_URL = '/api';
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;
const CREATE_SCHEDULE_URL = `${API_BASE_URL}/createSchedule`;
const UPDATE_SCHEDULE_URL = `${API_BASE_URL}/updateSchedule`;
const DELETE_SCHEDULE_URL = `${API_BASE_URL}/deleteSchedule`;

console.log("Mencari elemen DOM...");
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
console.log("Elemen DOM utama:", elements); // Log elemen yang ditemukan

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
console.log("Elemen DOM admin:", adminElements); // Log elemen admin

// Cek elemen penting
if (!elements.scheduleGrid) console.error("ERROR: Elemen scheduleGrid tidak ditemukan!");
if (!elements.loading) console.error("ERROR: Elemen loading tidak ditemukan!");
if (!elements.emptyState) console.error("ERROR: Elemen emptyState tidak ditemukan!");


// Variabel Global
let allSchedules = [];
let currentUser = null;
let isEditMode = false;

// ======================
// MANAJEMEN TEMA
// ======================
const initTheme = () => {
    console.log("Initializing theme...");
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    console.log("Theme initialized to:", savedTheme);
};

const toggleTheme = () => {
    console.log("Toggling theme...");
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    console.log("Theme toggled to:", newTheme);
};

const updateThemeIcon = (theme) => {
    const themeIcon = elements.themeToggleBtn?.querySelector('.theme-icon');
    // Implementasi ikon tema
};

// ======================
// MANAJEMEN DATA (Fetch)
// ======================
const fetchData = async () => {
    console.log("fetchData: Memulai pengambilan data...");
    showLoading();
    hideEmptyState();
    try {
        console.log(`fetchData: Fetching from ${GET_SCHEDULES_URL}`);
        const response = await fetch(GET_SCHEDULES_URL);
        console.log(`fetchData: Response status: ${response.status}`);

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            let errorBody = null;
            try {
                errorBody = await response.text(); // Coba baca sebagai teks dulu
                console.error("fetchData: Error response body:", errorBody);
                const errorData = JSON.parse(errorBody); // Coba parse JSON
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
                 console.warn("fetchData: Could not parse error response as JSON. Body was:", errorBody);
                 // Gunakan status teks jika ada
                 if (response.statusText) errorMsg += ` (${response.statusText})`;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("fetchData: Raw data received from API:", data); // Log data mentah

        if (!Array.isArray(data)) {
             console.error("fetchData: Data received is not an array!", data);
             throw new Error("Format data tidak valid dari server.");
        }


        const today = new Date(); today.setHours(0, 0, 0, 0);
        allSchedules = data
            .filter(item => item && item.tanggal) // Filter item tidak valid di awal
            .map((item, index) => {
                // Logika mapping dengan lebih banyak logging
                const newItem = {
                    ...item,
                    peserta: Array.isArray(item.peserta) ? item.peserta : [],
                    TanggalDate: null // Inisialisasi
                };
                try {
                    // Coba parse tanggal, handle jika invalid
                    const dateObj = new Date(item.tanggal + 'T00:00:00Z');
                    if (!isNaN(dateObj.getTime())) {
                        newItem.TanggalDate = dateObj;
                    } else {
                        console.warn(`fetchData: Invalid date format for item at index ${index}:`, item.tanggal);
                    }
                } catch (dateError) {
                     console.warn(`fetchData: Error parsing date for item at index ${index}:`, item.tanggal, dateError);
                }
                return newItem;
             })
            .filter(item => item.TanggalDate && item.TanggalDate >= today) // Filter tanggal invalid & lampau
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        console.log("fetchData: Processed schedules count:", allSchedules.length);
        if (allSchedules.length > 0) {
            console.log("fetchData: Sample processed item:", allSchedules[0]);
        }

        initFilters();
        filterSchedules(); // Render data
        console.log("fetchData: Data fetching and processing complete.");

    } catch (error) {
        console.error('fetchData: Error during fetch or processing:', error);
        showError(`Gagal memuat data jadwal: ${error.message}`);
        allSchedules = [];
        renderSchedules([]);
    } finally {
        hideLoading();
    }
};


// ======================
// SISTEM FILTER
// ======================
const initFilters = () => {
    console.log("Initializing filters...");
    if (!elements.institutionFilter) {
        console.warn("Filter dropdown element not found.");
        return;
    }
    // ... (sisa kode initFilters sama)
    const institutions = [...new Set(allSchedules.map(item => item.institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;
    const currentFilterValue = filterSelect.value;
    filterSelect.length = 1;
    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
     });
    if (institutions.includes(currentFilterValue)) { filterSelect.value = currentFilterValue; }
    if (!filterSelect.dataset.listenerAttached) {
        elements.searchInput?.addEventListener('input', debounce(filterSchedules, 300));
        filterSelect.addEventListener('change', filterSchedules);
        filterSelect.dataset.listenerAttached = 'true';
        console.log("Filter listeners attached.");
     }
     console.log("Filters initialized.");
};

const filterSchedules = () => {
    console.log("Filtering schedules...");
    const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
    const selectedInstitution = elements.institutionFilter?.value || 'all';
    console.log(`Filtering with term: "${searchTerm}", institution: "${selectedInstitution}"`);

    const filtered = allSchedules.filter(item => {
        const pesertaText = Array.isArray(item.peserta) ? item.peserta.join(' ') : '';
        const searchableText = [item.institusi, item.mata_pelajaran, pesertaText].join(' ').toLowerCase();
        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        const matchesInstitution = selectedInstitution === 'all' || item.institusi === selectedInstitution;
        return matchesSearch && matchesInstitution;
     });

    console.log(`Found ${filtered.length} schedules after filtering.`);
    renderSchedules(filtered);
};

// ======================
// RENDERING JADWAL
// ======================
const renderSchedules = (data) => {
    console.log(`Rendering ${data.length} schedules...`);
    if (!elements.scheduleGrid) {
        console.error("Cannot render: scheduleGrid element not found.");
        return;
    }
    elements.scheduleGrid.innerHTML = '';
    if (data.length === 0) {
        // Hanya tampilkan empty state jika tidak sedang loading
        if (!elements.loading || elements.loading.style.display === 'none') {
             console.log("No schedules to render, showing empty state.");
             showEmptyState("Tidak ada jadwal yang cocok dengan filter Anda.");
        } else {
             console.log("No schedules to render, but still loading.");
        }
        return;
    }
    hideEmptyState();
    const fragment = document.createDocumentFragment();
    data.forEach((item, index) => {
        // console.log(`Rendering card ${index + 1} for item ID: ${item.id}`);
        const card = createScheduleCard(item);
        fragment.appendChild(card);
    });
    elements.scheduleGrid.appendChild(fragment);
    console.log("Rendering complete.");
};

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    card.className = 'schedule-card';
    let pesertaHtml = '<span class="participant-tag na-tag">N/A</span>';
    if (Array.isArray(item.peserta) && item.peserta.length > 0) {
        pesertaHtml = item.peserta.map(peserta => {
            const pesertaText = typeof peserta === 'string' ? peserta : 'Invalid Data';
            return `<span class="participant-tag clickable" data-entity="Peserta" title="Lihat semua jadwal ${pesertaText}">${pesertaText}</span>`;
        }).join('');
    }
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
    console.log(`Showing modal with title: "${title}"`);
    if (!elements.modal) return;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = generateModalContent(data);
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};
const hideModal = () => {
    console.log("Hiding modal.");
    if (!elements.modal) return;
    elements.modal.style.display = 'none';
    document.body.style.overflow = '';
};
const generateModalContent = (data) => { /* ... kode sama ... */
    if (!data || data.length === 0) { return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>'; }
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
// EVENT HANDLER KLIK ENTITAS
// ======================
const handleEntityClick = (element) => {
    console.log("Entity clicked:", element.dataset.entity, element.textContent);
    // ... (sisa kode handleEntityClick sama)
    const entityType = element.dataset.entity;
    const value = element.textContent.trim();
    let filterProperty = entityType;
    let modalTitlePrefix = '';
    if (entityType === 'Mata_Pelajaran') filterProperty = 'mata_pelajaran';
    if (entityType === 'Institusi') filterProperty = 'institusi';
    let filteredData;
    if (entityType === 'Peserta') { /* ... filter peserta ... */ }
    else if (entityType === 'Tanggal') { /* ... filter tanggal ... */ }
    else { /* ... filter lain ... */ }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const futureFilteredData = filteredData.filter(item => item.TanggalDate >= today);
    showGenericModal(modalTitlePrefix, futureFilteredData);
};

// ======================
// FUNGSI ADMIN: KELOLA FORM (Tambah/Edit)
// ======================
const setupEditForm = (scheduleId) => {
    console.log(`Setting up form for editing ID: ${scheduleId}`);
    // ... (sisa kode setupEditForm sama)
    const schedule = allSchedules.find(s => s.id === scheduleId);
    if (!schedule || !adminElements.scheduleForm) { /* ... error handling ... */ return; }
    isEditMode = true;
    adminElements.scheduleIdInput.value = schedule.id;
    adminElements.formTitle.textContent = "Edit Jadwal";
    adminElements.formInstitusiInput.value = schedule.institusi;
    adminElements.formMataPelajaranInput.value = schedule.mata_pelajaran;
    adminElements.formTanggalInput.value = schedule.tanggal;
    adminElements.formPesertaInput.value = Array.isArray(schedule.peserta) ? schedule.peserta.join(', ') : '';
    adminElements.scheduleSubmitButton.textContent = "Update Jadwal";
    adminElements.cancelEditButton.style.display = 'inline-block';
    adminElements.adminSection?.classList.add('editing');
    adminElements.scheduleForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    adminElements.formInstitusiInput.focus();
};

const resetToAddMode = () => {
    console.log("Resetting form to Add mode");
    // ... (sisa kode resetToAddMode sama)
    isEditMode = false;
    adminElements.scheduleForm?.reset();
    if(adminElements.scheduleIdInput) adminElements.scheduleIdInput.value = '';
    if(adminElements.formTitle) adminElements.formTitle.textContent = "Tambah Jadwal Baru";
    if(adminElements.scheduleSubmitButton) adminElements.scheduleSubmitButton.textContent = "Tambah Jadwal";
    if(adminElements.cancelEditButton) adminElements.cancelEditButton.style.display = 'none';
    adminElements.adminSection?.classList.remove('editing');
    showFormStatus("", false);
};

const handleCancelEdit = () => {
    console.log("Cancel edit clicked.");
    resetToAddMode();
};

const handleScheduleFormSubmit = async (event) => {
    event.preventDefault();
    console.log(`Form submitted in ${isEditMode ? 'Edit' : 'Add'} mode`);
    // ... (sisa kode handleScheduleFormSubmit sama)
    const submitButton = adminElements.scheduleSubmitButton;
    if (!submitButton || submitButton.disabled) return;
    const user = netlifyIdentity.currentUser();
    if (!user) { showFormStatus("Error: Anda harus login.", true); return; }
    const token = user.token?.access_token;
    if (!token) { showFormStatus("Error: Gagal mendapatkan token autentikasi.", true); return; }
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
    const scheduleData = { institusi, mata_pelajaran, tanggal, peserta };
    let apiUrl, method, requestBody;
    if (isEditMode) {
        const idNum = parseInt(scheduleId, 10);
        if(isNaN(idNum)) { showFormStatus("Error: ID Jadwal tidak valid untuk update.", true); return; }
        apiUrl = UPDATE_SCHEDULE_URL; method = 'PUT';
        requestBody = JSON.stringify({ id: idNum, data: scheduleData });
        console.log(`Submitting UPDATE for ID: ${idNum}`);
    } else {
        apiUrl = CREATE_SCHEDULE_URL; method = 'POST';
        requestBody = JSON.stringify(scheduleData);
        console.log("Submitting CREATE");
    }
    setFormSubmitting(true);
    try {
        const response = await fetch(apiUrl, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: requestBody });
        const responseData = await response.json();
        if (!response.ok) { const errorMsg = responseData.error || responseData.message || `Gagal ${isEditMode ? 'update' : 'simpan'}: Status ${response.status}`; throw new Error(errorMsg); }
        console.log(`Submit successful for ${isEditMode ? 'update' : 'create'}.`);
        showFormStatus(`Jadwal berhasil ${isEditMode ? 'diupdate' : 'ditambahkan'}!`, false);
        resetToAddMode();
        await fetchData();
        setTimeout(() => showFormStatus("", false), 4000);
    } catch (error) { console.error(`Error submitting form:`, error); showFormStatus(`Error: ${error.message}`, true); }
    finally { setFormSubmitting(false); }
};

const setFormSubmitting = (isSubmitting) => { /* ... kode sama ... */
    if (adminElements.scheduleSubmitButton) { adminElements.scheduleSubmitButton.disabled = isSubmitting; adminElements.scheduleSubmitButton.textContent = isSubmitting ? 'Memproses...' : (isEditMode ? 'Update Jadwal' : 'Tambah Jadwal'); }
    if (adminElements.cancelEditButton) { adminElements.cancelEditButton.disabled = isSubmitting; }
    showFormStatus(isSubmitting ? `Memproses permintaan ${isEditMode ? 'update' : 'tambah'}...` : "", false);
};

const showFormStatus = (message, isError) => { /* ... kode sama ... */
    if (adminElements.formStatus) { adminElements.formStatus.textContent = message; adminElements.formStatus.className = `form-status ${isError ? 'error' : 'success'}`; adminElements.formStatus.style.display = message ? 'block' : 'none'; }
};

// ======================
// FUNGSI ADMIN: HAPUS JADWAL
// ======================
const handleDeleteClick = async (scheduleIdStr) => {
    const scheduleId = parseInt(scheduleIdStr, 10);
    if (isNaN(scheduleId)) { showError("Gagal menghapus: ID jadwal tidak valid."); return; }
    console.log(`Delete button clicked for ID: ${scheduleId}`);

    const scheduleToDelete = allSchedules.find(s => s.id === scheduleId);
    if (!scheduleToDelete) { showError("Gagal menghapus: Jadwal tidak ditemukan lagi."); return; }
    const confirmationMessage = `Anda yakin ingin menghapus jadwal berikut?\n\nInstitusi: ${scheduleToDelete.institusi}\nMata Kuliah: ${scheduleToDelete.mata_pelajaran}\nTanggal: ${formatDate(scheduleToDelete.tanggal)}`;
    if (!confirm(confirmationMessage)) { console.log("Delete cancelled."); return; }

    const user = netlifyIdentity.currentUser();
    if (!user) { showError("Error: Anda harus login untuk menghapus jadwal."); return; }
    const token = user.token?.access_token;
    if (!token) { showError("Error: Gagal mendapatkan token autentikasi."); return; }

    const deleteButton = document.querySelector(`.btn-delete[data-id="${scheduleId}"]`);
    const originalButtonText = deleteButton ? deleteButton.textContent : 'Hapus';
    if(deleteButton) { deleteButton.disabled = true; deleteButton.textContent = 'Menghapus...'; }
    showFormStatus(`Menghapus jadwal ID ${scheduleId}...`, false); // Tampilkan status

    try {
        console.log(`Sending DELETE request for ID: ${scheduleId}`);
        const response = await fetch(`${DELETE_SCHEDULE_URL}?id=${scheduleId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`DELETE response status: ${response.status}`);

        if (response.status === 204) {
            console.log(`Schedule ID ${scheduleId} deleted successfully.`);
            showFormStatus("Jadwal berhasil dihapus!", false);
            setTimeout(() => showFormStatus("", false), 4000);
            allSchedules = allSchedules.filter(s => s.id !== scheduleId);
            filterSchedules(); // Update UI
        } else if (response.status === 404) {
             console.warn(`Schedule ID ${scheduleId} not found on server.`);
             showError(`Gagal menghapus: Jadwal dengan ID ${scheduleId} tidak ditemukan.`);
             await fetchData(); // Sync ulang
        } else {
            let errorMsg = `Gagal menghapus: Status ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch(e) { /* Ignore */ }
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error(`Error deleting schedule ID ${scheduleId}:`, error);
        showError(`Error menghapus jadwal: ${error.message}`);
        showFormStatus("", false); // Hapus status loading
    } finally {
         if(deleteButton) { deleteButton.disabled = false; deleteButton.textContent = originalButtonText; }
    }
};

// ======================
// AUTENTIKASI (Netlify Identity)
// ======================
const setupAdminFeatures = (user) => {
    console.log("setupAdminFeatures called with user:", user ? user.email : 'null');
    currentUser = user;
    const isAdminSectionVisible = !!user;
    if (adminElements.adminSection) { adminElements.adminSection.style.display = isAdminSectionVisible ? 'block' : 'none'; }
    else { console.warn("Admin section element not found."); }
    resetToAddMode();
    filterSchedules();
};
const initNetlifyIdentity = () => {
    console.log("Initializing Netlify Identity...");
     if (adminElements.netlifyIdentityWidgetContainer) {
        if (window.netlifyIdentity) {
            window.netlifyIdentity.init({ container: '#netlifyIdentityWidget' });
            window.netlifyIdentity.on('init', user => { console.log('Netlify Identity: Init event', user ? user.email : 'no user'); setupAdminFeatures(user); }); // Handle init state
            window.netlifyIdentity.on('login', (user) => { console.log('Netlify Identity: Login event'); window.netlifyIdentity.close(); setupAdminFeatures(user); });
            window.netlifyIdentity.on('logout', () => { console.log('Netlify Identity: Logout event'); setupAdminFeatures(null); });
            window.netlifyIdentity.on('error', (err) => { console.error('Netlify Identity Error:', err); showError(`Autentikasi error: ${err.message || 'Unknown'}`); });
            // Tidak perlu panggil setupAdminFeatures lagi di sini karena event 'init' sudah menangani
        } else { console.error("Netlify Identity script not loaded."); showError("Gagal memuat komponen autentikasi."); }
    } else { console.warn("Netlify Identity widget container (#netlifyIdentityWidget) not found."); }
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => {
    if (!dateString) return 'Tanggal tidak valid';
    const date = (dateString instanceof Date) ? dateString : new Date(dateString + 'T00:00:00Z');
    if (isNaN(date.getTime())) return 'Tanggal tidak valid';
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('id-ID', options);
};
const showLoading = () => { console.log("Showing loading indicator."); if(elements.loading) elements.loading.style.display = 'flex'; if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; hideEmptyState(); };
const hideLoading = () => { console.log("Hiding loading indicator."); if(elements.loading) elements.loading.style.display = 'none'; if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'grid'; };
const showEmptyState = (message = "Tidak ada jadwal yang ditemukan.") => { console.log("Showing empty state:", message); if(elements.emptyState) { elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-ghost empty-icon"></i><h3>Oops! Kosong</h3><p>${message}</p>`; } if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; };
const hideEmptyState = () => { console.log("Hiding empty state."); if(elements.emptyState) elements.emptyState.style.display = 'none'; };
const showError = (message = 'Terjadi kesalahan.') => { console.error("Showing error message:", message); hideLoading(); if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; if(elements.emptyState) { elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-exclamation-triangle empty-icon error-icon"></i><h3>Terjadi Kesalahan</h3><p>${message}</p>`; } };
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

// ======================
// EVENT LISTENERS DINAMIS (Delegation)
// ======================
const attachDynamicListeners = () => {
    console.log("Attaching dynamic listeners to body...");
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        // Klik entitas kartu
        if (target.classList.contains('clickable') && target.dataset.entity) { handleEntityClick(target); }
        // Klik close modal
        if (target === elements.modalOverlay || target.closest('.close-modal')) { hideModal(); }
        // Klik tombol Edit
        if (target.classList.contains('btn-edit')) { const scheduleId = target.dataset.id; setupEditForm(parseInt(scheduleId, 10)); }
        // Klik tombol Delete
        if (target.classList.contains('btn-delete')) { const scheduleId = target.dataset.id; handleDeleteClick(scheduleId); }
    });
    console.log("Dynamic listeners attached.");
};

// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing application...");
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState) { console.error("Initialization failed: Essential elements missing."); document.body.innerHTML = "<p style='color:red; padding: 20px;'>Error: Elemen dasar tidak ditemukan.</p>"; return; }

    initTheme();
    initNetlifyIdentity(); // Setup login (akan memanggil setupAdminFeatures via event 'init')
    fetchData(); // Ambil data awal
    attachDynamicListeners(); // Pasang listener utama

    // Listener statis
    elements.themeToggleBtn?.addEventListener('click', toggleTheme);
    adminElements.scheduleForm?.addEventListener('submit', handleScheduleFormSubmit);
    adminElements.cancelEditButton?.addEventListener('click', handleCancelEdit);

    // Listener Escape untuk modal
     window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && elements.modal?.style.display === 'block') { hideModal(); } });

    console.log("Application initialization complete.");
});
