// Import CSS (Vite way)
import './styles.css';

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
const API_BASE_URL = '/api'; // Asumsi menggunakan redirect Netlify

const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;
const CREATE_SCHEDULE_URL = `${API_BASE_URL}/createSchedule`;
const UPDATE_SCHEDULE_URL = `${API_BASE_URL}/updateSchedule`;
const DELETE_SCHEDULE_URL = `${API_BASE_URL}/deleteSchedule`;

// Elemen DOM Utama
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

// Elemen DOM untuk Fitur Admin
const adminElements = {
    adminSection: document.getElementById('adminSection'),
    netlifyIdentityWidgetContainer: document.getElementById('netlifyIdentityWidget'),
    scheduleForm: document.getElementById('scheduleForm'), // ID form yang baru
    formTitle: document.getElementById('formTitle'),
    scheduleIdInput: document.getElementById('scheduleId'), // Input hidden ID
    formInstitusiInput: document.getElementById('formInstitusi'),
    formMataPelajaranInput: document.getElementById('formMataPelajaran'),
    formTanggalInput: document.getElementById('formTanggal'),
    formPesertaInput: document.getElementById('formPeserta'),
    scheduleSubmitButton: document.getElementById('scheduleSubmitBtn'),
    cancelEditButton: document.getElementById('cancelEditBtn'),
    formStatus: document.getElementById('formStatus'),
};

// Variabel Global
let allSchedules = [];
let currentUser = null;
let isEditMode = false; // Flag mode form

// ======================
// MANAJEMEN TEMA
// ======================
const initTheme = () => { /* ... kode sama ... */
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
};
const toggleTheme = () => { /* ... kode sama ... */
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
};
const updateThemeIcon = (theme) => { /* ... kode sama ... */
    const themeIcon = elements.themeToggleBtn?.querySelector('.theme-icon');
    // Implementasi ikon tema
};

// ======================
// MANAJEMEN DATA (Fetch)
// ======================
const fetchData = async () => { /* ... kode sama seperti sebelumnya ... */
    showLoading();
    hideEmptyState();
    try {
        console.log(`Fetching data from ${GET_SCHEDULES_URL}`);
        const response = await fetch(GET_SCHEDULES_URL);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) { /* Abaikan */ }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        console.log("Data received:", data);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        allSchedules = data
            .map(item => ({ ...item, TanggalDate: new Date(item.tanggal + 'T00:00:00Z') }))
            .filter(item => item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);
        initFilters();
        filterSchedules(); // Render setelah data siap
    } catch (error) {
        console.error('Fetch Error:', error);
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
const initFilters = () => { /* ... kode sama seperti sebelumnya ... */
    if (!elements.institutionFilter) return;
    const institutions = [...new Set(allSchedules.map(item => item.institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;
    const currentFilterValue = filterSelect.value;
    filterSelect.length = 1;
    institutions.forEach(inst => { /* ... tambah option ... */
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
     });
    if (institutions.includes(currentFilterValue)) { filterSelect.value = currentFilterValue; }
    if (!filterSelect.dataset.listenerAttached) { /* ... tambah listener ... */
        elements.searchInput?.addEventListener('input', debounce(filterSchedules, 300));
        filterSelect.addEventListener('change', filterSchedules);
        filterSelect.dataset.listenerAttached = 'true';
     }
};
const filterSchedules = () => { /* ... kode sama seperti sebelumnya ... */
    const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
    const selectedInstitution = elements.institutionFilter?.value || 'all';
    const filtered = allSchedules.filter(item => { /* ... logika filter ... */
        const pesertaText = Array.isArray(item.peserta) ? item.peserta.join(' ') : '';
        const searchableText = [item.institusi, item.mata_pelajaran, pesertaText].join(' ').toLowerCase();
        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        const matchesInstitution = selectedInstitution === 'all' || item.institusi === selectedInstitution;
        return matchesSearch && matchesInstitution;
     });
    renderSchedules(filtered);
};

// ======================
// RENDERING JADWAL
// ======================
const renderSchedules = (data) => { /* ... kode sama, pastikan tombol punya data-id="${item.id}" ... */
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = '';
    if (data.length === 0) {
        if (!elements.loading || elements.loading.style.display === 'none') {
             showEmptyState("Tidak ada jadwal yang cocok dengan filter Anda.");
        }
        return;
    }
    hideEmptyState();
    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        const card = createScheduleCard(item);
        fragment.appendChild(card);
    });
    elements.scheduleGrid.appendChild(fragment);
};

const createScheduleCard = (item) => { /* ... kode sama, pastikan tombol punya data-id="${item.id}" ... */
    const card = document.createElement('article');
    card.className = 'schedule-card';
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-entity="Mata_Pelajaran" title="Lihat semua jadwal ${item.mata_pelajaran}">${item.mata_pelajaran}</h3>
            <span class="date-display clickable" data-entity="Tanggal" title="Lihat semua jadwal pada ${formatDate(item.tanggal)}">${formatDate(item.tanggal)}</span>
        </div>
        <div class="institute clickable" data-entity="Institusi" title="Lihat semua jadwal dari ${item.institusi}">${item.institusi}</div>
        <div class="participants">
            ${Array.isArray(item.peserta) ? item.peserta.map(peserta => `
                <span class="participant-tag clickable" data-entity="Peserta" title="Lihat semua jadwal ${peserta}">${peserta}</span>
            `).join('') : '<span class="participant-tag">N/A</span>'}
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
const showGenericModal = (title, data) => { /* ... kode sama ... */ };
const hideModal = () => { /* ... kode sama ... */ };
const generateModalContent = (data) => { /* ... kode sama ... */ };

// ======================
// EVENT HANDLER KLIK ENTITAS
// ======================
const handleEntityClick = (element) => { /* ... kode sama seperti sebelumnya ... */ };

// ======================
// FUNGSI ADMIN: KELOLA FORM (Tambah/Edit)
// ======================
const setupEditForm = (scheduleId) => { /* ... kode sama seperti sebelumnya ... */
    const schedule = allSchedules.find(s => s.id === parseInt(scheduleId, 10));
    if (!schedule || !adminElements.scheduleForm) { /* ... error handling ... */ return; }
    console.log("Setting up form for editing ID:", scheduleId);
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
    adminElements.scheduleForm.scrollIntoView({ behavior: 'smooth' });
    adminElements.formInstitusiInput.focus();
};

const resetToAddMode = () => { /* ... kode sama seperti sebelumnya ... */
    console.log("Resetting form to Add mode");
    isEditMode = false;
    adminElements.scheduleForm?.reset();
    if(adminElements.scheduleIdInput) adminElements.scheduleIdInput.value = '';
    if(adminElements.formTitle) adminElements.formTitle.textContent = "Tambah Jadwal Baru";
    if(adminElements.scheduleSubmitButton) adminElements.scheduleSubmitButton.textContent = "Tambah Jadwal";
    if(adminElements.cancelEditButton) adminElements.cancelEditButton.style.display = 'none';
    adminElements.adminSection?.classList.remove('editing');
    showFormStatus("", false);
};

const handleCancelEdit = () => { /* ... kode sama, panggil resetToAddMode ... */
    resetToAddMode();
};

const handleScheduleFormSubmit = async (event) => { /* ... kode sama seperti sebelumnya ... */
    event.preventDefault();
    console.log(`Form submitted in ${isEditMode ? 'Edit' : 'Add'} mode`);
    const submitButton = adminElements.scheduleSubmitButton;
    if (!submitButton || submitButton.disabled) return;
    const user = netlifyIdentity.currentUser();
    if (!user) { /* ... error handling ... */ return; }
    const token = user.token?.access_token;
    if (!token) { /* ... error handling ... */ return; }

    // Ambil & Validasi Data Form
    const scheduleId = adminElements.scheduleIdInput.value;
    const institusi = adminElements.formInstitusiInput.value.trim();
    const mata_pelajaran = adminElements.formMataPelajaranInput.value.trim();
    const tanggal = adminElements.formTanggalInput.value;
    const pesertaInput = adminElements.formPesertaInput.value.trim();
    if (!institusi || !mata_pelajaran || !tanggal || !pesertaInput) { /* ... error handling ... */ return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) { /* ... error handling ... */ return; }
    const inputDate = new Date(tanggal + 'T00:00:00Z');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (inputDate < today && !isEditMode) { /* ... error handling ... */ return; }
    const peserta = pesertaInput.split(',').map(p => p.trim()).filter(p => p);
    if (peserta.length === 0) { /* ... error handling ... */ return; }

    // Siapkan Data dan URL API
    const scheduleData = { institusi, mata_pelajaran, tanggal, peserta };
    let apiUrl, method, requestBody;
    if (isEditMode) {
        apiUrl = UPDATE_SCHEDULE_URL; method = 'PUT';
        requestBody = JSON.stringify({ id: parseInt(scheduleId, 10), data: scheduleData }); // Kirim ID dan data
        console.log(`Preparing to UPDATE schedule ID: ${scheduleId} with data:`, scheduleData);
    } else {
        apiUrl = CREATE_SCHEDULE_URL; method = 'POST';
        requestBody = JSON.stringify(scheduleData); // Kirim data langsung
        console.log("Preparing to CREATE new schedule with data:", scheduleData);
    }

    // Kirim ke API
    setFormSubmitting(true);
    try {
        const response = await fetch(apiUrl, {
            method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: requestBody
        });
        const responseData = await response.json();
        if (!response.ok) { /* ... error handling ... */ throw new Error(errorMsg); }
        console.log(`Schedule ${isEditMode ? 'updated' : 'created'} successfully:`, responseData);
        showFormStatus(`Jadwal berhasil ${isEditMode ? 'diupdate' : 'ditambahkan'}!`, false);
        resetToAddMode();
        await fetchData(); // Refresh data
        setTimeout(() => showFormStatus("", false), 4000);
    } catch (error) { /* ... error handling ... */ }
    finally { setFormSubmitting(false); }
};

// Helper disable/enable form
const setFormSubmitting = (isSubmitting) => { /* ... kode sama ... */
    if (adminElements.scheduleSubmitButton) { /* ... disable/enable button ... */
        adminElements.scheduleSubmitButton.disabled = isSubmitting;
        adminElements.scheduleSubmitButton.textContent = isSubmitting ? 'Memproses...' : (isEditMode ? 'Update Jadwal' : 'Tambah Jadwal');
     }
    if (adminElements.cancelEditButton) { adminElements.cancelEditButton.disabled = isSubmitting; }
    showFormStatus(isSubmitting ? `Memproses permintaan ${isEditMode ? 'update' : 'tambah'}...` : "", false);
};

// Helper status form
const showFormStatus = (message, isError) => { /* ... kode sama ... */
    if (adminElements.formStatus) { /* ... tampilkan pesan ... */
        adminElements.formStatus.textContent = message;
        adminElements.formStatus.className = `form-status ${isError ? 'error' : 'success'}`;
        adminElements.formStatus.style.display = message ? 'block' : 'none';
     }
};

// ======================
// FUNGSI ADMIN: HAPUS JADWAL
// ======================
const handleDeleteClick = async (scheduleIdStr) => {
    const scheduleId = parseInt(scheduleIdStr, 10); // Konversi ID ke angka
    if (isNaN(scheduleId)) {
        console.error("Invalid schedule ID for delete:", scheduleIdStr);
        showError("Gagal menghapus: ID jadwal tidak valid.");
        return;
    }
    console.log(`Delete button clicked for ID: ${scheduleId}`);

    // 1. Konfirmasi Pengguna
    const scheduleToDelete = allSchedules.find(s => s.id === scheduleId);
    if (!scheduleToDelete) {
        showError("Gagal menghapus: Jadwal tidak ditemukan lagi.");
        return;
    }
    const confirmationMessage = `Anda yakin ingin menghapus jadwal berikut?\n\nInstitusi: ${scheduleToDelete.institusi}\nMata Kuliah: ${scheduleToDelete.mata_pelajaran}\nTanggal: ${formatDate(scheduleToDelete.tanggal)}`;
    if (!confirm(confirmationMessage)) {
        console.log("Delete cancelled by user.");
        return;
    }

    // 2. Dapatkan Token JWT
    const user = netlifyIdentity.currentUser();
    if (!user) { /* ... error handling ... */ return; }
    const token = user.token?.access_token;
    if (!token) { /* ... error handling ... */ return; }

    // 3. Kirim Request ke API DELETE
    // Cari tombol delete yang sesuai untuk menampilkan loading (opsional)
    const deleteButton = document.querySelector(`.btn-delete[data-id="${scheduleId}"]`);
    const originalButtonText = deleteButton ? deleteButton.textContent : 'Hapus';
    if(deleteButton) {
        deleteButton.disabled = true;
        deleteButton.textContent = 'Menghapus...';
    }
    // Tampilkan status global juga bisa
    // showFormStatus(`Menghapus jadwal ID ${scheduleId}...`, false);

    try {
        const response = await fetch(`${DELETE_SCHEDULE_URL}?id=${scheduleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 204) { // Sukses (No Content)
            console.log(`Schedule ID ${scheduleId} deleted successfully.`);
            // Tampilkan pesan sukses sementara
            showFormStatus("Jadwal berhasil dihapus!", false);
            setTimeout(() => showFormStatus("", false), 4000);
            // Hapus item dari array lokal dan render ulang (lebih cepat dari fetch ulang)
            allSchedules = allSchedules.filter(s => s.id !== scheduleId);
            filterSchedules(); // Render ulang grid
            // Atau fetch ulang jika lebih mudah: await fetchData();

        } else if (response.status === 404) {
             console.warn(`Schedule ID ${scheduleId} not found on server.`);
             showError(`Gagal menghapus: Jadwal dengan ID ${scheduleId} tidak ditemukan.`);
             // Mungkin perlu fetch ulang jika data tidak sinkron
             await fetchData();
        } else {
            // Handle error lain
            let errorMsg = `Gagal menghapus: Status ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch(e) { /* Abaikan */ }
            throw new Error(errorMsg);
        }

    } catch (error) {
        console.error(`Error deleting schedule ID ${scheduleId}:`, error);
        showError(`Error menghapus jadwal: ${error.message}`);
        showFormStatus("", false); // Hapus pesan loading/status di form
    } finally {
         // Kembalikan state tombol delete
         if(deleteButton) {
            deleteButton.disabled = false;
            deleteButton.textContent = originalButtonText;
        }
    }
};

// ======================
// AUTENTIKASI (Netlify Identity)
// ======================
const setupAdminFeatures = (user) => { /* ... kode sama seperti sebelumnya ... */
    currentUser = user;
    const isAdminSectionVisible = !!user;
    console.log(isAdminSectionVisible ? `User logged in: ${user.email}` : "User logged out");
    if (adminElements.adminSection) { adminElements.adminSection.style.display = isAdminSectionVisible ? 'block' : 'none'; }
    else { console.warn("Admin section element not found."); }
    // Reset form ke mode tambah saat login/logout
    resetToAddMode();
    // Render ulang jadwal (untuk tombol admin)
    filterSchedules();
};
const initNetlifyIdentity = () => { /* ... kode sama seperti sebelumnya ... */
     if (adminElements.netlifyIdentityWidgetContainer) {
        if (window.netlifyIdentity) {
            window.netlifyIdentity.init({ container: '#netlifyIdentityWidget' });
            window.netlifyIdentity.on('login', (user) => { /* ... setupAdminFeatures(user) ... */
                 console.log('Netlify Identity: Login event');
                 window.netlifyIdentity.close();
                 setupAdminFeatures(user);
             });
            window.netlifyIdentity.on('logout', () => { /* ... setupAdminFeatures(null) ... */
                 console.log('Netlify Identity: Logout event');
                 setupAdminFeatures(null);
             });
            window.netlifyIdentity.on('error', (err) => { /* ... error handling ... */ });
            setupAdminFeatures(window.netlifyIdentity.currentUser());
        } else { /* ... error handling ... */ }
    } else { console.warn("Netlify Identity widget container (#netlifyIdentityWidget) not found."); }
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => { /* ... kode sama ... */ };
const showLoading = () => { /* ... kode sama ... */ };
const hideLoading = () => { /* ... kode sama ... */ };
const showEmptyState = (message = "Tidak ada jadwal yang ditemukan.") => { /* ... kode sama ... */ };
const hideEmptyState = () => { /* ... kode sama ... */ };
const showError = (message = 'Terjadi kesalahan.') => { /* ... kode sama ... */ };
function debounce(func, wait) { /* ... kode sama ... */ }

// ======================
// EVENT LISTENERS DINAMIS (Delegation)
// ======================
const attachDynamicListeners = () => {
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Klik pada entitas di kartu jadwal
        if (target.classList.contains('clickable') && target.dataset.entity) {
            handleEntityClick(target);
        }

        // Klik tombol close modal atau overlay
        if (target === elements.modalOverlay || target.closest('.close-modal')) {
             hideModal();
        }

        // Klik tombol Edit
        if (target.classList.contains('btn-edit')) {
            const scheduleId = target.dataset.id;
            // Panggil setupEditForm dengan ID yang dikonversi ke angka
            setupEditForm(parseInt(scheduleId, 10));
        }

        // Klik tombol Delete
        if (target.classList.contains('btn-delete')) {
            const scheduleId = target.dataset.id;
            // Panggil handleDeleteClick dengan ID (string tidak masalah, akan dikonversi di fungsi)
            handleDeleteClick(scheduleId);
        }
    });
};


// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing application...");
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState) { /* ... error handling ... */ return; }

    initTheme();
    initNetlifyIdentity();
    fetchData();
    attachDynamicListeners();

    // Listener statis
    elements.themeToggleBtn?.addEventListener('click', toggleTheme);

    // Listener untuk form tambah/edit
    if (adminElements.scheduleForm) {
        adminElements.scheduleForm.addEventListener('submit', handleScheduleFormSubmit);
        console.log("Schedule form listener attached.");
    } else { console.warn("Schedule form element not found."); }

    // Listener untuk tombol Batal Edit
    if (adminElements.cancelEditButton) {
         adminElements.cancelEditButton.addEventListener('click', handleCancelEdit);
         console.log("Cancel edit button listener attached.");
    } else { console.warn("Cancel edit button not found."); }

    // Listener Escape untuk modal
     window.addEventListener('keydown', (e) => { /* ... kode sama ... */ });

    console.log("Application initialization complete.");
});
