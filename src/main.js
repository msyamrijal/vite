// Import CSS (Vite way)
import './styles.css';

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
// Base URL untuk Netlify Functions
const API_BASE_URL = '/api'; // Asumsi menggunakan redirect Netlify /api/* -> /.netlify/functions/*
// const API_BASE_URL = '/.netlify/functions'; // Gunakan ini jika TIDAK pakai redirect

// URL Endpoint Functions
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;
const CREATE_SCHEDULE_URL = `${API_BASE_URL}/createSchedule`;
// Definisikan URL untuk Update & Delete nanti
// const UPDATE_SCHEDULE_URL = `${API_BASE_URL}/updateSchedule`;
// const DELETE_SCHEDULE_URL = `${API_BASE_URL}/deleteSchedule`;

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
// MANAJEMEN TEMA (Tidak berubah)
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
    // Implementasi ikon tema (sesuaikan dengan CSS Anda)
    const themeIcon = elements.themeToggleBtn?.querySelector('.theme-icon');
    // Anda mungkin mengubah kelas atau style di sini berdasarkan tema
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
            .map(item => ({
                ...item,
                // Konversi tanggal YYYY-MM-DD ke objek Date
                TanggalDate: new Date(item.tanggal + 'T00:00:00Z') // Tambah Z untuk UTC atau sesuaikan timezone jika perlu
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

    const institutions = [...new Set(allSchedules.map(item => item.institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;

    // Simpan value terpilih saat ini (jika ada)
    const currentFilterValue = filterSelect.value;

    filterSelect.length = 1; // Hapus opsi lama (kecuali "Semua Institusi")

    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
    });

    // Set kembali value yang terpilih sebelumnya (jika masih ada di list baru)
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
            item.institusi,
            item.mata_pelajaran,
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
        // Jika tidak ada hasil filter (bukan saat loading awal)
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
    // Gunakan nama field dari Supabase
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
    // Tambahkan event listener untuk tombol edit/delete di attachDynamicListeners
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
                <h4 class="course-title">${item.mata_pelajaran}</h4>
            </div>
             <div class="modal-meta">
                <span class="institute">${item.institusi}</span>
                <span class="date-display">${formatDate(item.tanggal)}</span>
            </div>
            <div class="participants">
                ${Array.isArray(item.peserta) ? item.peserta.map(p => `<span class="participant-tag">${p}</span>`).join('') : 'N/A'}
            </div>
        </div>
    `).join('');
};

// ======================
// EVENT HANDLER KLIK ENTITAS
// ======================
const handleEntityClick = (element) => {
    const entityType = element.dataset.entity;
    const value = element.textContent.trim(); // Ambil teks konten
    let filterProperty = entityType;
    let modalTitlePrefix = '';

    // Mapping nama properti jika perlu
    if (entityType === 'Mata_Pelajaran') filterProperty = 'mata_pelajaran';
    if (entityType === 'Institusi') filterProperty = 'institusi';

    let filteredData;
    if (entityType === 'Peserta') {
        filteredData = allSchedules.filter(item => Array.isArray(item.peserta) && item.peserta.includes(value));
        modalTitlePrefix = `Jadwal untuk ${value}`;
    } else if (entityType === 'Tanggal') {
        // Filter berdasarkan objek Date untuk akurasi
        const clickedDate = new Date(value + 'T00:00:00Z'); // Asumsi value adalah YYYY-MM-DD
         if (!isNaN(clickedDate.getTime())) {
             filteredData = allSchedules.filter(item =>
                 item.TanggalDate.getFullYear() === clickedDate.getFullYear() &&
                 item.TanggalDate.getMonth() === clickedDate.getMonth() &&
                 item.TanggalDate.getDate() === clickedDate.getDate()
             );
         } else {
            filteredData = []; // Tanggal tidak valid
         }
         modalTitlePrefix = `Jadwal pada ${formatDate(value)}`; // Tampilkan tanggal diformat
    } else { // Mata_Pelajaran or Institusi
        filteredData = allSchedules.filter(item => item[filterProperty] === value);
        modalTitlePrefix = `Jadwal ${value}`;
    }

    // Filter lagi jadwal lampau (sudah dilakukan di fetchData, tapi bisa juga di sini)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureFilteredData = filteredData.filter(item => item.TanggalDate >= today);


    showGenericModal(modalTitlePrefix, futureFilteredData);
};

// ======================
// FUNGSI ADMIN: TAMBAH JADWAL
// ======================
const handleAddScheduleSubmit = async (event) => {
    event.preventDefault(); // Cegah reload halaman bawaan form
    console.log("Add schedule form submitted");

    // Pastikan tombol submit ada dan dalam keadaan tidak disable
    const submitButton = adminElements.addFormSubmitButton;
    if (!submitButton || submitButton.disabled) return;

    // 1. Dapatkan Token JWT Pengguna
    const user = netlifyIdentity.currentUser();
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
    const tanggal = adminElements.addTanggalInput?.value; // Format YYYY-MM-DD
    const pesertaInput = adminElements.addPesertaInput?.value.trim();

    if (!institusi || !mata_pelajaran || !tanggal || !pesertaInput) {
        showAddFormStatus("Error: Semua field wajib diisi.", true);
        return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
         showAddFormStatus("Error: Format tanggal tidak valid (YYYY-MM-DD).", true);
        return;
    }
    // Validasi tanggal tidak boleh di masa lalu
    const inputDate = new Date(tanggal + 'T00:00:00Z');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inputDate < today) {
        showAddFormStatus("Error: Tanggal tidak boleh di masa lalu.", true);
        return;
    }


    // Proses input peserta menjadi array string yang bersih
    const peserta = pesertaInput.split(',')
                           .map(p => p.trim())
                           .filter(p => p); // Hapus string kosong

    if (peserta.length === 0) {
        showAddFormStatus("Error: Field peserta tidak boleh kosong (setelah diproses).", true);
        return;
    }

    // 3. Buat Objek Data untuk dikirim ke API
    const newScheduleData = {
        institusi,
        mata_pelajaran,
        tanggal,
        peserta
    };

    // 4. Kirim ke API Backend (Netlify Function)
    setFormSubmitting(true); // Disable tombol & tampilkan loading
    try {
        console.log("Sending data to API:", newScheduleData);
        const response = await fetch(CREATE_SCHEDULE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Sertakan token JWT
            },
            body: JSON.stringify(newScheduleData)
        });

        const responseData = await response.json(); // Coba baca response body

        if (!response.ok) {
            // Gunakan pesan error dari backend jika ada
            const errorMsg = responseData.error || responseData.message || `Gagal menyimpan: Status ${response.status}`;
            throw new Error(errorMsg);
        }

        console.log("Schedule created successfully:", responseData);

        // 5. Handle Sukses
        showAddFormStatus("Jadwal berhasil ditambahkan!", false);
        adminElements.addScheduleForm?.reset(); // Kosongkan form
        await fetchData(); // Ambil ulang data terbaru untuk refresh tampilan

        // Sembunyikan pesan sukses setelah beberapa detik
        setTimeout(() => showAddFormStatus("", false), 4000);

    } catch (error) {
        console.error("Error creating schedule:", error);
        // 6. Handle Error
        showAddFormStatus(`Error: ${error.message}`, true);
    } finally {
        setFormSubmitting(false); // Enable tombol lagi
    }
};

// Helper untuk disable/enable form saat submit
const setFormSubmitting = (isSubmitting) => {
    if (adminElements.addFormSubmitButton) {
        adminElements.addFormSubmitButton.disabled = isSubmitting;
        adminElements.addFormSubmitButton.textContent = isSubmitting ? 'Menyimpan...' : 'Tambah Jadwal';
    }
    showAddFormStatus(isSubmitting ? "Menyimpan jadwal..." : "", false);
};


// Helper untuk menampilkan status form tambah
const showAddFormStatus = (message, isError) => {
    if (adminElements.addFormStatus) {
        adminElements.addFormStatus.textContent = message;
        adminElements.addFormStatus.className = `form-status ${isError ? 'error' : 'success'}`; // Ganti kelas untuk styling
        adminElements.addFormStatus.style.display = message ? 'block' : 'none';
    }
};


// ======================
// AUTENTIKASI (Netlify Identity)
// ======================
const setupAdminFeatures = (user) => {
    currentUser = user; // Simpan info user global
    const isAdminSectionVisible = !!user; // Tampilkan jika user login

    console.log(isAdminSectionVisible ? `User logged in: ${user.email}` : "User logged out");

    if (adminElements.adminSection) {
        adminElements.adminSection.style.display = isAdminSectionVisible ? 'block' : 'none';
    } else {
         console.warn("Admin section element not found.");
    }

    // Render ulang jadwal untuk menampilkan/menyembunyikan tombol admin di kartu
    // Ini penting karena filterSchedules() memanggil renderSchedules()
    filterSchedules();
};

const initNetlifyIdentity = () => {
    // Pastikan elemen container widget ada
     if (adminElements.netlifyIdentityWidgetContainer) {
        // Inisialisasi Netlify Identity Widget
        // Pastikan script widget sudah di-load di HTML
        if (window.netlifyIdentity) {
            window.netlifyIdentity.init({
                container: '#netlifyIdentityWidget', // Target container
                // locale: 'id' // Opsional: Coba set bahasa jika didukung
            });

            // Dengarkan event login, logout, dan error
            window.netlifyIdentity.on('login', (user) => {
                console.log('Netlify Identity: Login event');
                window.netlifyIdentity.close(); // Tutup modal widget
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

            // Cek status login saat halaman pertama kali dimuat
            setupAdminFeatures(window.netlifyIdentity.currentUser());

        } else {
             console.error("Netlify Identity script not loaded yet or failed to load.");
             showError("Gagal memuat komponen autentikasi.");
        }

    } else {
        console.warn("Netlify Identity widget container (#netlifyIdentityWidget) not found. Admin features disabled.");
    }
};


// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => {
    // Handle jika input null atau undefined
    if (!dateString) return 'Tanggal tidak valid';

    const date = (dateString instanceof Date) ? dateString : new Date(dateString + 'T00:00:00Z'); // Gunakan UTC

    if (isNaN(date.getTime())) {
        return 'Tanggal tidak valid';
    }

    // Format tanggal ke Bahasa Indonesia (Senin, 4 Mei 2025)
    const options = {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' // Tentukan timezone agar konsisten
    };
    return date.toLocaleDateString('id-ID', options);
};

const showLoading = () => {
    if(elements.loading) elements.loading.style.display = 'flex';
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none';
    hideEmptyState(); // Sembunyikan pesan kosong saat loading
};

const hideLoading = () => {
     if(elements.loading) elements.loading.style.display = 'none';
     if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'grid'; // Tampilkan grid lagi
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
     if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; // Sembunyikan grid
};

const hideEmptyState = () => {
    if(elements.emptyState) elements.emptyState.style.display = 'none';
};

const showError = (message = 'Terjadi kesalahan.') => {
    hideLoading(); // Pastikan loading hilang
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none';
    if(elements.emptyState) {
        elements.emptyState.style.display = 'flex';
        // Tampilkan pesan error di area empty state
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

        // Klik pada entitas di kartu jadwal (delegasi dari body)
        if (target.classList.contains('clickable') && target.dataset.entity) {
            handleEntityClick(target);
        }

        // Klik tombol close modal atau overlay
        if (target === elements.modalOverlay || target.closest('.close-modal')) {
             hideModal();
        }

        // Klik tombol Edit (Tambahkan logika handleEditClick nanti)
        if (target.classList.contains('btn-edit')) {
            const scheduleId = target.dataset.id;
            console.log(`Edit button clicked for ID: ${scheduleId}`);
            // handleEditClick(scheduleId); // Panggil fungsi edit
        }

        // Klik tombol Delete (Tambahkan logika handleDeleteClick nanti)
        if (target.classList.contains('btn-delete')) {
            const scheduleId = target.dataset.id;
            console.log(`Delete button clicked for ID: ${scheduleId}`);
            // handleDeleteClick(scheduleId); // Panggil fungsi delete
        }
    });
};


// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing application...");

    // Pastikan elemen dasar ada sebelum melanjutkan
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState) {
        console.error("Initialization failed: Essential elements not found in the DOM.");
        document.body.innerHTML = "<p style='color:red; padding: 20px;'>Error Kritis: Elemen dasar aplikasi tidak ditemukan. Periksa struktur HTML Anda.</p>";
        return; // Hentikan eksekusi jika elemen dasar hilang
    }

    initTheme(); // Set tema
    initNetlifyIdentity(); // Siapkan autentikasi
    fetchData(); // Ambil data awal
    attachDynamicListeners(); // Pasang listener utama

    // Listener statis (misal: toggle tema)
    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Listener untuk form tambah (jika formnya ada)
    if (adminElements.addScheduleForm) {
        adminElements.addScheduleForm.addEventListener('submit', handleAddScheduleSubmit);
        console.log("Add schedule form listener attached.");
    } else {
        console.warn("Add schedule form element not found. 'Tambah Jadwal' feature disabled.");
    }

    // Listener untuk tombol Escape menutup modal
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal && elements.modal.style.display === 'block') {
            hideModal();
        }
    });

    console.log("Application initialization complete.");
});
