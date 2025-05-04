// Import CSS (Vite way)
import './styles.css';

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
// Base URL untuk Netlify Functions
const API_BASE_URL = '/api'; // Asumsi menggunakan redirect Netlify /api/* -> /.netlify/functions/*

// URL Endpoint Functions
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;
const CREATE_SCHEDULE_URL = `${API_BASE_URL}/createSchedule`;
const UPDATE_SCHEDULE_URL = `${API_BASE_URL}/updateSchedule`; // Definisikan URL Update
const DELETE_SCHEDULE_URL = `${API_BASE_URL}/deleteSchedule`; // Definisikan URL Delete

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
    adminSection: document.getElementById('adminSection'), // Container utama admin
    netlifyIdentityWidgetContainer: document.getElementById('netlifyIdentityWidget'), // Tempat widget login
    addScheduleForm: document.getElementById('addScheduleForm'), // Form tambah
    addInstitusiInput: document.getElementById('addInstitusi'),
    addMataPelajaranInput: document.getElementById('addMataPelajaran'),
    addTanggalInput: document.getElementById('addTanggal'),
    addPesertaInput: document.getElementById('addPeserta'),
    addFormSubmitButton: document.getElementById('addScheduleSubmitBtn'), // Tombol submit form
    addFormStatus: document.getElementById('addFormStatus'), // Paragraf status form
};

// Variabel Global
let allSchedules = []; // Cache untuk semua data jadwal
let currentUser = null; // Menyimpan informasi pengguna yang sedang login

// ======================
// MANAJEMEN TEMA
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
    // Implementasi ikon tema (sesuaikan dengan CSS Anda jika perlu)
    // Contoh: const themeIcon = elements.themeToggleBtn?.querySelector('.theme-icon');
    // if (themeIcon) { themeIcon.className = `theme-icon fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`; }
};

// ======================
// MANAJEMEN DATA (Fetch dari Supabase via Netlify Function)
// ======================
const fetchData = async () => {
    showLoading();
    hideEmptyState();
    try {
        console.log(`Fetching data from ${GET_SCHEDULES_URL}`);
        const response = await fetch(GET_SCHEDULES_URL);

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) { /* Abaikan jika response bukan JSON */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Data received:", data);

        // Proses data: tambahkan TanggalDate dan filter jadwal lampau
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set ke awal hari ini

        allSchedules = data
            .filter(item => item && item.tanggal) // Filter item null atau tanpa tanggal
            .map(item => ({
                ...item,
                // Konversi tanggal YYYY-MM-DD ke objek Date UTC
                TanggalDate: new Date(item.tanggal + 'T00:00:00Z')
            }))
            .filter(item => item.TanggalDate >= today) // Hanya tampilkan jadwal hari ini atau mendatang
            .sort((a, b) => a.TanggalDate - b.TanggalDate); // Urutkan berdasarkan tanggal

        initFilters(); // Inisialisasi filter dropdown
        filterSchedules(); // Render data awal yang sudah difilter & disortir

    } catch (error) {
        console.error('Fetch Error:', error);
        showError(`Gagal memuat data jadwal: ${error.message}`);
        allSchedules = []; // Kosongkan data jika error
        renderSchedules([]); // Render tampilan kosong
    } finally {
        hideLoading();
    }
};

// ======================
// SISTEM FILTER
// ======================
const initFilters = () => {
    if (!elements.institutionFilter) return; // Pastikan elemen ada

    // Ambil institusi unik dari data yang sudah difilter (jadwal mendatang)
    const institutions = [...new Set(allSchedules.map(item => item.institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;

    const currentFilterValue = filterSelect.value;
    filterSelect.length = 1; // Hapus opsi lama

    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
    });

    if (institutions.includes(currentFilterValue)) {
        filterSelect.value = currentFilterValue;
    }

    // Pasang event listener hanya sekali
    if (!filterSelect.dataset.listenerAttached) {
        elements.searchInput?.addEventListener('input', debounce(filterSchedules, 300));
        filterSelect.addEventListener('change', filterSchedules);
        filterSelect.dataset.listenerAttached = 'true';
    }
};

const filterSchedules = () => {
    // Fungsi ini dipanggil saat search/filter berubah atau data di-refresh
    const searchTerm = elements.searchInput?.value.toLowerCase().trim() || '';
    const selectedInstitution = elements.institutionFilter?.value || 'all';

    const filtered = allSchedules.filter(item => {
        const pesertaText = Array.isArray(item.peserta) ? item.peserta.join(' ') : '';
        const searchableText = [
            item.institusi || '',
            item.mata_pelajaran || '',
            pesertaText
        ].join(' ').toLowerCase();

        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        const matchesInstitution = selectedInstitution === 'all' || item.institusi === selectedInstitution;

        return matchesSearch && matchesInstitution;
    });

    renderSchedules(filtered); // Render hasil filter
};

// ======================
// RENDERING JADWAL
// ======================
const renderSchedules = (data) => {
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = ''; // Kosongkan grid

    if (data.length === 0) {
        if (!elements.loading || elements.loading.style.display === 'none') {
             showEmptyState("Tidak ada jadwal yang cocok dengan filter Anda.");
        }
        return;
    }

    hideEmptyState(); // Sembunyikan pesan kosong jika ada data

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
    // Gunakan nama field dari Supabase (lowercase)
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-entity="mata_pelajaran" data-value="${item.mata_pelajaran}" title="Lihat semua jadwal ${item.mata_pelajaran}">${item.mata_pelajaran || 'N/A'}</h3>
            <span class="date-display clickable" data-entity="tanggal" data-value="${item.tanggal}" title="Lihat semua jadwal pada ${formatDate(item.tanggal)}">${formatDate(item.tanggal)}</span>
        </div>
        <div class="institute clickable" data-entity="institusi" data-value="${item.institusi}" title="Lihat semua jadwal dari ${item.institusi}">${item.institusi || 'N/A'}</div>
        <div class="participants">
            ${Array.isArray(item.peserta) && item.peserta.length > 0 ? item.peserta.map(peserta => `
                <span class="participant-tag clickable" data-entity="peserta" data-value="${peserta}" title="Lihat semua jadwal ${peserta}">${peserta}</span>
            `).join('') : '<span class="participant-tag">N/A</span>'}
        </div>
        ${currentUser ? `
            <div class="admin-actions">
                <button class="btn-edit" data-id="${item.id}" title="Edit Jadwal Ini"><i class="fas fa-pencil-alt"></i> Edit</button>
                <button class="btn-delete" data-id="${item.id}" title="Hapus Jadwal Ini"><i class="fas fa-trash-alt"></i> Hapus</button>
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
    elements.modal.style.display = 'flex'; // Use flex for centering
    document.body.style.overflow = 'hidden'; // Cegah scroll background
};

const hideModal = () => {
    if (!elements.modal) return;
    elements.modal.style.display = 'none';
    document.body.style.overflow = ''; // Kembalikan scroll background
};

const generateModalContent = (data) => {
    if (!data || data.length === 0) {
        return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
    }
    // Tampilkan detail jadwal di modal
    return data.map(item => `
        <div class="modal-item">
            <div class="card-header">
                <h4 class="course-title">${item.mata_pelajaran || 'N/A'}</h4>
            </div>
             <div class="modal-meta">
                <span class="institute">${item.institusi || 'N/A'}</span>
                <span class="date-display">${formatDate(item.tanggal)}</span>
            </div>
            <div class="participants">
                ${Array.isArray(item.peserta) && item.peserta.length > 0 ? item.peserta.map(p => `<span class="participant-tag">${p}</span>`).join('') : 'N/A'}
            </div>
        </div>
    `).join('');
};

// ======================
// EVENT HANDLER KLIK ENTITAS
// ======================
const handleEntityClick = (element) => {
    const entityType = element.dataset.entity; // mata_pelajaran, institusi, tanggal, peserta
    const value = element.dataset.value; // Ambil dari data-value

    if (!entityType || value === undefined || value === null) {
        console.warn("Entity click ignored: Missing entity type or value", element.dataset);
        return;
    }

    let filteredData;
    let modalTitlePrefix = '';

    if (entityType === 'peserta') {
        filteredData = allSchedules.filter(item => Array.isArray(item.peserta) && item.peserta.includes(value));
        modalTitlePrefix = `Jadwal untuk ${value}`;
    } else if (entityType === 'tanggal') {
        // Filter berdasarkan string tanggal YYYY-MM-DD dari data-value
        filteredData = allSchedules.filter(item => item.tanggal === value);
        modalTitlePrefix = `Jadwal pada ${formatDate(value)}`;
    } else { // mata_pelajaran or institusi
        filteredData = allSchedules.filter(item => item[entityType] === value);
        modalTitlePrefix = `Jadwal ${value}`;
    }

    // Urutkan hasil modal berdasarkan tanggal
    filteredData.sort((a, b) => a.TanggalDate - b.TanggalDate);

    showGenericModal(modalTitlePrefix, filteredData);
};

// ======================
// FUNGSI ADMIN: TAMBAH JADWAL
// ======================
const handleAddScheduleSubmit = async (event) => {
    event.preventDefault();
    console.log("Add schedule form submitted");

    const submitButton = adminElements.addFormSubmitButton;
    if (!submitButton || submitButton.disabled) return;

    // 1. Dapatkan Token JWT Pengguna
    const user = window.netlifyIdentity.currentUser();
    if (!user) {
        showAddFormStatus("Error: Anda harus login untuk menambah jadwal.", true);
        return;
    }
    const token = user.token?.access_token;
    if (!token) {
        showAddFormStatus("Error: Gagal mendapatkan token autentikasi.", true);
        return;
    }

    // 2. Ambil dan Validasi Data dari Form
    const institusi = adminElements.addInstitusiInput?.value.trim();
    const mata_pelajaran = adminElements.addMataPelajaranInput?.value.trim();
    const tanggal = adminElements.addTanggalInput?.value;
    const pesertaInput = adminElements.addPesertaInput?.value.trim();

    if (!institusi || !mata_pelajaran || !tanggal || !pesertaInput) {
        showAddFormStatus("Error: Semua field wajib diisi.", true);
        return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
         showAddFormStatus("Error: Format tanggal tidak valid (YYYY-MM-DD).", true);
        return;
    }
    const inputDate = new Date(tanggal + 'T00:00:00Z');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inputDate < today) {
        showAddFormStatus("Error: Tanggal tidak boleh di masa lalu.", true);
        return;
    }

    const peserta = pesertaInput.split(',').map(p => p.trim()).filter(p => p);
    if (peserta.length === 0) {
        showAddFormStatus("Error: Field peserta tidak boleh kosong.", true);
        return;
    }

    // 3. Buat Objek Data
    const newScheduleData = { institusi, mata_pelajaran, tanggal, peserta };

    // 4. Kirim ke API
    setFormSubmitting(true);
    try {
        console.log("Sending data to API:", newScheduleData);
        const response = await fetch(CREATE_SCHEDULE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newScheduleData)
        });

        const responseData = await response.json();
        if (!response.ok) {
            const errorMsg = responseData.error || responseData.message || `Gagal menyimpan: Status ${response.status}`;
            throw new Error(errorMsg);
        }

        console.log("Schedule created successfully:", responseData);

        // 5. Handle Sukses
        showAddFormStatus("Jadwal berhasil ditambahkan!", false);
        adminElements.addScheduleForm?.reset();
        await fetchData(); // Refresh data

        setTimeout(() => showAddFormStatus("", false), 4000);

    } catch (error) {
        console.error("Error creating schedule:", error);
        showAddFormStatus(`Error: ${error.message}`, true);
    } finally {
        setFormSubmitting(false);
    }
};

// Helper untuk disable/enable form saat submit
const setFormSubmitting = (isSubmitting) => {
    if (adminElements.addFormSubmitButton) {
        adminElements.addFormSubmitButton.disabled = isSubmitting;
        adminElements.addFormSubmitButton.innerHTML = isSubmitting
            ? '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'
            : 'Tambah Jadwal';
    }
    showAddFormStatus(isSubmitting ? "Menyimpan jadwal..." : "", false, isSubmitting ? 'info' : '');
};

// Helper untuk menampilkan status form tambah
const showAddFormStatus = (message, isError, type = '') => {
    if (adminElements.addFormStatus) {
        adminElements.addFormStatus.textContent = message;
        let statusClass = 'form-status';
        if (isError) statusClass += ' error';
        else if (type === 'info') statusClass += ' info';
        else if (message) statusClass += ' success'; // Default to success if not error/info and has message
        adminElements.addFormStatus.className = statusClass;
        adminElements.addFormStatus.style.display = message ? 'block' : 'none';
    }
};


// ======================
// FUNGSI ADMIN: EDIT & DELETE (Placeholder)
// ======================
const handleEditClick = (scheduleId) => {
    // 1. Cari data jadwal berdasarkan ID
    const scheduleToEdit = allSchedules.find(s => s.id === parseInt(scheduleId));
    if (!scheduleToEdit) {
        showError("Jadwal untuk diedit tidak ditemukan.");
        return;
    }
    console.log("Editing schedule:", scheduleToEdit);
    // 2. Tampilkan modal edit (perlu dibuat HTML & CSS nya)
    //    atau isi form tambah dengan data yang ada (mode edit)
    //    Contoh: isi form tambah
    if (adminElements.addScheduleForm) {
         adminElements.addInstitusiInput.value = scheduleToEdit.institusi;
         adminElements.addMataPelajaranInput.value = scheduleToEdit.mata_pelajaran;
         adminElements.addTanggalInput.value = scheduleToEdit.tanggal; // YYYY-MM-DD
         adminElements.addPesertaInput.value = Array.isArray(scheduleToEdit.peserta) ? scheduleToEdit.peserta.join(', ') : '';
         // Tambahkan ID ke form (misal, hidden input atau data attribute) untuk proses update
         adminElements.addScheduleForm.dataset.editingId = scheduleId;
         adminElements.addFormSubmitButton.textContent = 'Update Jadwal';
         // Scroll ke form?
         adminElements.addScheduleForm.scrollIntoView({ behavior: 'smooth' });
         showAddFormStatus("Mode Edit: Ubah data lalu klik Update.", false, 'info');
    } else {
        showError("Form untuk mengedit tidak ditemukan.");
    }
    // 3. Ubah logika handleAddScheduleSubmit untuk cek mode edit
    //    Jika mode edit, kirim request PUT ke UPDATE_SCHEDULE_URL
};

const handleDeleteClick = async (scheduleId) => {
    // 1. Konfirmasi pengguna
    if (!confirm(`Apakah Anda yakin ingin menghapus jadwal dengan ID ${scheduleId}?`)) {
        return;
    }

    // 2. Dapatkan Token JWT
    const user = window.netlifyIdentity.currentUser();
    if (!user?.token?.access_token) {
        showError("Autentikasi gagal. Silakan login ulang.");
        return;
    }
    const token = user.token.access_token;

    // 3. Kirim request DELETE ke API
    console.log(`Attempting to delete schedule ID: ${scheduleId}`);
    // Tampilkan indikator loading sementara (opsional)
    const deleteButton = document.querySelector(`.btn-delete[data-id="${scheduleId}"]`);
    const originalButtonText = deleteButton ? deleteButton.innerHTML : '';
    if(deleteButton) deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    if(deleteButton) deleteButton.disabled = true;

    try {
        const response = await fetch(`${DELETE_SCHEDULE_URL}/${scheduleId}`, { // Asumsi ID di URL
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Tidak perlu JSON parse jika backend hanya return status 204
        if (response.status === 204) { // No Content - Success
             console.log(`Schedule ID ${scheduleId} deleted successfully.`);
             await fetchData(); // Refresh data
             // Beri feedback singkat (opsional)
        } else {
            // Coba baca error jika ada
            let errorMsg = `Gagal menghapus: Status ${response.status}`;
             try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
             } catch(e) {/* ignore */}
            throw new Error(errorMsg);
        }

    } catch (error) {
        console.error(`Error deleting schedule ID ${scheduleId}:`, error);
        showError(`Gagal menghapus jadwal: ${error.message}`);
    } finally {
         // Kembalikan state tombol
         if(deleteButton) deleteButton.innerHTML = originalButtonText;
         if(deleteButton) deleteButton.disabled = false;
    }
};


// ======================
// AUTENTIKASI (Netlify Identity)
// ======================
const setupAdminFeatures = (user) => {
    currentUser = user; // Simpan info user global
    const isAdminSectionVisible = !!user;

    console.log(isAdminSectionVisible ? `User logged in: ${user.email}` : "User logged out");

    if (adminElements.adminSection) {
        adminElements.adminSection.style.display = isAdminSectionVisible ? 'block' : 'none';
        // Reset form jika user logout atau login (untuk hapus state edit)
        if (adminElements.addScheduleForm) {
            adminElements.addScheduleForm.reset();
            delete adminElements.addScheduleForm.dataset.editingId;
            adminElements.addFormSubmitButton.textContent = 'Tambah Jadwal';
            showAddFormStatus("", false); // Clear status
        }
    } else {
         console.warn("Admin section element not found.");
    }

    // Render ulang jadwal untuk menampilkan/menyembunyikan tombol admin
    filterSchedules();
};

const initNetlifyIdentity = () => {
     if (adminElements.netlifyIdentityWidgetContainer) {
        if (window.netlifyIdentity) {
            window.netlifyIdentity.init({
                container: '#netlifyIdentityWidget',
                // APIUrl: `${window.location.origin}/.netlify/identity` // Opsional jika custom domain
            });

            window.netlifyIdentity.on('login', (user) => {
                console.log('Netlify Identity: Login event');
                window.netlifyIdentity.close();
                setupAdminFeatures(user);
            });

            window.netlifyIdentity.on('logout', () => {
                console.log('Netlify Identity: Logout event');
                setupAdminFeatures(null);
            });

            window.netlifyIdentity.on('error', (err) => {
                console.error('Netlify Identity Error:', err);
                showError(`Masalah autentikasi: ${err.message || 'Error tidak diketahui'}`);
            });

            // Cek status login saat load
            setupAdminFeatures(window.netlifyIdentity.currentUser());

        } else {
             console.error("Netlify Identity script not loaded.");
             showError("Gagal memuat komponen autentikasi.");
             if(adminElements.adminSection) adminElements.adminSection.style.display = 'none'; // Sembunyikan admin section
        }
    } else {
        console.warn("Netlify Identity widget container (#netlifyIdentityWidget) not found. Admin features disabled.");
        if(adminElements.adminSection) adminElements.adminSection.style.display = 'none'; // Sembunyikan admin section
    }
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

const showLoading = () => {
    if(elements.loading) elements.loading.style.display = 'flex';
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none';
    hideEmptyState();
};

const hideLoading = () => {
     if(elements.loading) elements.loading.style.display = 'none';
     if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'grid';
};

const showEmptyState = (message = "Tidak ada jadwal yang ditemukan.") => {
    if(elements.emptyState) {
        elements.emptyState.style.display = 'flex';
        elements.emptyState.innerHTML = `
            <i class="fas fa-ghost empty-icon"></i>
            <h3>Oops! Kosong</h3>
            <p>${message}</p>
        `;
    }
     if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none';
};

const hideEmptyState = () => {
    if(elements.emptyState) elements.emptyState.style.display = 'none';
};

const showError = (message = 'Terjadi kesalahan.') => {
    hideLoading();
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none';
    if(elements.emptyState) {
        elements.emptyState.style.display = 'flex';
        elements.emptyState.innerHTML = `
            <i class="fas fa-exclamation-triangle empty-icon error-icon"></i>
            <h3>Terjadi Kesalahan</h3>
            <p>${message}</p>
        `;
    }
};

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ======================
// EVENT LISTENERS DINAMIS (Delegation)
// ======================
const attachDynamicListeners = () => {
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const clickableEntity = target.closest('.clickable[data-entity]');
        const editButton = target.closest('.btn-edit[data-id]');
        const deleteButton = target.closest('.btn-delete[data-id]');

        // Klik pada entitas di kartu jadwal
        if (clickableEntity) {
            handleEntityClick(clickableEntity);
        }

        // Klik tombol close modal atau overlay
        else if (target === elements.modalOverlay || target.closest('.close-modal')) {
             hideModal();
        }

        // Klik tombol Edit
        else if (editButton) {
            const scheduleId = editButton.dataset.id;
            handleEditClick(scheduleId); // Panggil fungsi edit
        }

        // Klik tombol Delete
        else if (deleteButton) {
            const scheduleId = deleteButton.dataset.id;
            handleDeleteClick(scheduleId); // Panggil fungsi delete
        }
    });
};


// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing application...");

    // Validasi elemen penting
    const essentialElementsExist = elements.scheduleGrid && elements.loading && elements.emptyState && adminElements.adminSection;
    if (!essentialElementsExist) {
        console.error("Initialization failed: Essential elements not found in the DOM.");
        document.body.innerHTML = "<p style='color:red; padding: 20px;'>Error Kritis: Elemen dasar aplikasi tidak ditemukan. Periksa struktur HTML Anda.</p>";
        return;
    }

    initTheme();
    initNetlifyIdentity(); // Autentikasi disiapkan sebelum fetch data
    fetchData();
    attachDynamicListeners();

    // Listener statis
    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    if (adminElements.addScheduleForm) {
        adminElements.addScheduleForm.addEventListener('submit', handleAddScheduleSubmit);
        console.log("Add schedule form listener attached.");
    } else {
        console.warn("Add schedule form element not found. 'Tambah/Update Jadwal' feature disabled.");
    }

     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal && elements.modal.style.display === 'flex') {
            hideModal();
        }
    });

    console.log("Application initialization complete.");
});
