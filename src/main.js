import './style.css';

// ======================
// DOM Elements
// ======================
const elements = {
    scheduleContainer: document.getElementById('schedule-container'),
    searchInput: document.getElementById('search-input'),
    institutionFilter: document.getElementById('institution-filter'),
    loadingIndicator: document.getElementById('loading-indicator'),
    modal: document.getElementById('details-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    closeModalBtn: document.querySelector('.close-button'),
    noResultsMessage: document.getElementById('no-results'),
    // Elemen Form Tambah Jadwal
    addScheduleForm: document.getElementById('add-schedule-form'),
    newInstitusiInput: document.getElementById('new-institusi'),
    newMataPelajaranInput: document.getElementById('new-mata_pelajaran'),
    newTanggalInput: document.getElementById('new-tanggal'),
    newPesertaInput: document.getElementById('new-peserta'),
    addScheduleFeedback: document.getElementById('add-schedule-feedback'),
    addScheduleSection: document.getElementById('add-schedule-section'), // Section form
    loginPrompt: document.getElementById('login-prompt'), // Pesan untuk login
    submitScheduleBtn: document.getElementById('submit-schedule-btn'),
    themeToggle: document.getElementById('themeToggle'), // Tombol ganti tema
};

// ======================
// State
// ======================
let allSchedules = []; // Holds all fetched and processed schedule data
let isLoading = false;
let currentUser = null; // Menyimpan info user yang login

// ======================
// Utility Functions
// ======================
const formatDate = (dateString) => {
    if (!dateString) return 'Tanggal tidak valid';
    try {
        // Coba parsing dengan asumsi YYYY-MM-DD atau format ISO
        const date = new Date(dateString + 'T00:00:00'); // Tambah T00:00:00 untuk hindari masalah timezone saat parsing
        if (isNaN(date.getTime())) {
             // Jika gagal, coba parsing langsung (mungkin sudah ISO lengkap)
             const directDate = new Date(dateString);
             if (isNaN(directDate.getTime())) {
                 throw new Error('Invalid date format');
             }
             return directDate.toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        }
        return date.toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return 'Tanggal tidak valid';
    }
};

const setLoading = (loading) => {
    isLoading = loading;
    elements.loadingIndicator.style.display = loading ? 'flex' : 'none'; // Use flex for centering
};

// ======================
// Theme Handling
// ======================
const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme); // Simpan preferensi tema
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
};

const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'light'; // Default ke light
    applyTheme(savedTheme);
};


// ======================
// Data Fetching
// ======================
const fetchSchedules = async () => {
    setLoading(true);
    elements.noResultsMessage.style.display = 'none'; // Hide no results message initially
    elements.scheduleContainer.innerHTML = ''; // Clear previous results during load
    try {
        // Use relative path for API call, Netlify rewrite handles it
        const response = await fetch('/api/getSchedules');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set time to beginning of the day for comparison

        // Process and filter data immediately after fetching
        allSchedules = data
            .filter(item => {
                // Basic validation: Ensure essential fields exist and date is valid
                // Use lowercase property names and check if peserta is an array
                const itemDate = new Date(item.tanggal + 'T00:00:00'); // Parse date consistently
                return item.tanggal && item.institusi && item.mata_pelajaran && item.peserta && Array.isArray(item.peserta) && !isNaN(itemDate.getTime());
            })
            .map(item => ({ ...item, TanggalDate: new Date(item.tanggal + 'T00:00:00') })) // Pre-convert date for sorting/filtering
            .filter(item => item.TanggalDate >= today) // Filter out past dates using the pre-converted date
            .sort((a, b) => a.TanggalDate - b.TanggalDate); // Sort by date ascending

        initFilters(); // Initialize filters only after data is loaded
        updateAuthUI(); // Update UI based on auth state after data load (in case user is already logged in)
        displaySchedules(); // Display initial data

    } catch (error) {
        console.error("Gagal mengambil jadwal:", error);
        elements.scheduleContainer.innerHTML = '<p class="error-message">Tidak dapat memuat jadwal. Silakan coba lagi nanti.</p>';
        elements.noResultsMessage.style.display = 'none'; // Ensure no results isn't shown on fetch error
    } finally {
        setLoading(false);
    }
};

// ======================
// Filtering and Searching
// ======================
const initFilters = () => {
    // Use a Set for unique institutions and sort them alphabetically
    // Use lowercase property name 'institusi'
    const institutions = [...new Set(allSchedules.map(item => item.institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;

    // Clear existing options (except the default "Semua Institusi")
    const currentValue = filterSelect.value; // Save current selection
    while (filterSelect.options.length > 1) {
        filterSelect.remove(1);
    }

    // Populate filter dropdown
    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (institutions.includes(currentValue)) {
        filterSelect.value = currentValue;
    }
};

const filterAndSearchSchedules = () => {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    const selectedInstitution = elements.institutionFilter.value;

    const filtered = allSchedules.filter(item => {
        // Combine relevant fields into a single string for searching
        // Use lowercase property names and ensure peserta is an array
        const searchableText = [
            item.institusi,
            item.mata_pelajaran,
            Array.isArray(item.peserta) ? item.peserta.join(' ') : '' // Ensure peserta is an array
            // Optionally add formatted date if needed for search
        ].join(' ').toLowerCase();

        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        // Use lowercase property name 'institusi' for filtering
        const matchesInstitution = selectedInstitution === 'all' || item.institusi === selectedInstitution;

        return matchesSearch && matchesInstitution;
    });

    displaySchedules(filtered);
};

// ======================
// UI Rendering
// ======================
const displaySchedules = (schedulesToDisplay = allSchedules) => {
    elements.scheduleContainer.innerHTML = ''; // Clear previous results

    if (schedulesToDisplay.length === 0 && !isLoading) {
        elements.noResultsMessage.style.display = 'block'; // Show no results message
    } else {
        elements.noResultsMessage.style.display = 'none'; // Hide no results message
        schedulesToDisplay.forEach(item => {
            const card = createScheduleCard(item);
            elements.scheduleContainer.appendChild(card);
        });
    }
};

const createScheduleCard = (item) => {
    const card = document.createElement('div');
    card.className = 'schedule-card';
    // Use lowercase property names here and in data-entity attributes
    // Ensure data-value for date is the original string for accurate filtering in modal
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-entity="mata_pelajaran" data-value="${item.mata_pelajaran}">${item.mata_pelajaran}</h3>
            <span class="date-display clickable" data-entity="tanggal" data-value="${item.tanggal}">${formatDate(item.tanggal)}</span>
        </div>
        <div class="institute clickable" data-entity="institusi" data-value="${item.institusi}">${item.institusi}</div>
        <div class="participants">
            ${Array.isArray(item.peserta) && item.peserta.length > 0 ? item.peserta.map(peserta => `
                <span class="participant-tag clickable" data-entity="peserta" data-value="${peserta}">${peserta}</span>
            `).join('') : '<span class="no-participants">Peserta tidak tersedia</span>'}
        </div>
    `;
    return card;
};

// ======================
// Modal Logic
// ======================
const createModalContent = (data, titlePrefix) => {
    elements.modalTitle.textContent = `${titlePrefix} (${data.length} Jadwal)`;
    if (data.length === 0) {
        elements.modalBody.innerHTML = '<p>Tidak ada jadwal yang cocok ditemukan.</p>';
        return;
    }
    // Use lowercase property names
    elements.modalBody.innerHTML = data.map(item => `
        <div class="modal-item">
            <div class="card-header">
                <h4 class="course-title">${item.mata_pelajaran}</h4>
            </div>
             <div class="modal-meta">
                <span class="institute">${item.institusi}</span>
                <span class="date-display">${formatDate(item.tanggal)}</span>
            </div>
            <div class="participants">
                ${Array.isArray(item.peserta) && item.peserta.length > 0 ? item.peserta.map(p => `<span class="participant-tag">${p}</span>`).join('') : '<span class="no-participants">Peserta tidak tersedia</span>'}
            </div>
        </div>
    `).join('');
};

const openModal = () => elements.modal.style.display = 'flex';
const closeModal = () => elements.modal.style.display = 'none';

const handleEntityClick = (event) => {
    const target = event.target.closest('.clickable');
    if (!target) return;

    const entityType = target.dataset.entity; // Should be lowercase (e.g., 'mata_pelajaran', 'tanggal', 'institusi', 'peserta')
    const value = target.dataset.value; // The original value (e.g., date string 'YYYY-MM-DD')
    const filterProperty = entityType; // Direct mapping now works

    if (!entityType || value === undefined || value === null) return;

    let filteredData;
    let modalTitlePrefix = '';

    // Prepare data based on clicked entity (using lowercase entityType)
    if (entityType === 'peserta') {
        filteredData = allSchedules.filter(item => Array.isArray(item.peserta) && item.peserta.includes(value));
        modalTitlePrefix = `Jadwal untuk ${value}`;
    } else if (entityType === 'tanggal') {
         // Filter by the original date string to find matches
         filteredData = allSchedules.filter(item => item.tanggal === value);
         modalTitlePrefix = `Jadwal pada ${formatDate(value)}`; // Format the title nicely
    } else { // mata_pelajaran or institusi
        filteredData = allSchedules.filter(item => item[filterProperty] === value);
        modalTitlePrefix = `Jadwal ${value}`;
    }

    // Sort modal results by date as well
    filteredData.sort((a, b) => a.TanggalDate - b.TanggalDate);

    createModalContent(filteredData, modalTitlePrefix);
    openModal();
};

// ======================
// Authentication Logic (Netlify Identity)
// ======================
const updateAuthUI = () => {
    currentUser = netlifyIdentity.currentUser(); // Get current user status

    if (currentUser) {
        // User logged in
        elements.loginPrompt.style.display = 'none';
        elements.addScheduleForm.style.display = 'block'; // Tampilkan form
        // console.log("User logged in:", currentUser.email);
    } else {
        // User logged out
        elements.loginPrompt.style.display = 'block'; // Tampilkan pesan login
        elements.addScheduleForm.style.display = 'none'; // Sembunyikan form
        // console.log("User logged out");
    }
};

// ======================
// Create Schedule Logic
// ======================
const handleCreateScheduleSubmit = async (event) => {
    event.preventDefault(); // Mencegah submit form standar

    elements.addScheduleFeedback.textContent = ''; // Bersihkan pesan feedback sebelumnya
    elements.submitScheduleBtn.disabled = true; // Nonaktifkan tombol selama proses
    elements.addScheduleFeedback.textContent = 'Menyimpan jadwal...';
    elements.addScheduleFeedback.className = 'feedback-message info'; // Gaya pesan info
    elements.addScheduleFeedback.style.display = 'block'; // Make sure feedback is visible

    // --- Autentikasi Check ---
    if (!currentUser) {
        elements.addScheduleFeedback.textContent = 'Anda harus login untuk menambahkan jadwal.';
        elements.addScheduleFeedback.className = 'feedback-message error';
        elements.submitScheduleBtn.disabled = false;
        return;
    }

    // Ambil data dari form
    const institusi = elements.newInstitusiInput.value.trim();
    const mata_pelajaran = elements.newMataPelajaranInput.value.trim();
    const tanggal = elements.newTanggalInput.value; // Format YYYY-MM-DD dari input type="date"
    const pesertaText = elements.newPesertaInput.value.trim();

    // Validasi sederhana di frontend (opsional, karena validasi utama di backend)
    if (!institusi || !mata_pelajaran || !tanggal || !pesertaText) {
        elements.addScheduleFeedback.textContent = 'Semua field wajib diisi.';
        elements.addScheduleFeedback.className = 'feedback-message error';
        elements.submitScheduleBtn.disabled = false;
        return;
    }

    // Ubah string peserta menjadi array, trim setiap nama
    const peserta = pesertaText.split(',').map(p => p.trim()).filter(p => p); // Filter elemen kosong

    if (peserta.length === 0) {
         elements.addScheduleFeedback.textContent = 'Masukkan setidaknya satu nama peserta yang valid.';
         elements.addScheduleFeedback.className = 'feedback-message error';
         elements.submitScheduleBtn.disabled = false;
         return;
    }

    const newScheduleData = {
        institusi,
        mata_pelajaran,
        tanggal,
        peserta,
    };

    try {
        const response = await fetch('/api/createSchedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Sertakan token JWT dari user yang login
                'Authorization': `Bearer ${currentUser?.token?.access_token}`
            },
            body: JSON.stringify(newScheduleData),
        });

        const responseData = await response.json(); // Coba baca response JSON selalu

        if (!response.ok) {
            // Gunakan pesan error dari backend jika ada, jika tidak gunakan status text
            throw new Error(responseData.error || responseData.message || `Gagal menyimpan: ${response.statusText}`);
        }

        // Sukses!
        elements.addScheduleFeedback.textContent = 'Jadwal berhasil ditambahkan!';
        elements.addScheduleFeedback.className = 'feedback-message success';
        elements.addScheduleForm.reset(); // Kosongkan form
        await fetchSchedules(); // Ambil ulang data jadwal untuk menampilkan yang baru

        // Sembunyikan pesan sukses setelah beberapa detik
        setTimeout(() => {
            elements.addScheduleFeedback.style.display = 'none';
        }, 3000);


    } catch (error) {
        console.error("Error creating schedule:", error);
        elements.addScheduleFeedback.textContent = `Error: ${error.message}`;
        elements.addScheduleFeedback.className = 'feedback-message error';
    } finally {
        elements.submitScheduleBtn.disabled = false; // Aktifkan kembali tombol
    }
};

// ======================
// Event Listeners
// ======================
const addEventListeners = () => {
    elements.searchInput.addEventListener('input', filterAndSearchSchedules);
    elements.institutionFilter.addEventListener('change', filterAndSearchSchedules);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (event) => { // Close modal on overlay click
        if (event.target === elements.modal) {
            closeModal();
        }
    });
    // Add event listener to the container for delegation
    elements.scheduleContainer.addEventListener('click', handleEntityClick);

    // Add event listener for the new schedule form
    elements.addScheduleForm.addEventListener('submit', handleCreateScheduleSubmit);

    // Add Netlify Identity event listeners
    netlifyIdentity.on('init', user => updateAuthUI());
    netlifyIdentity.on('login', user => {
        updateAuthUI();
        fetchSchedules(); // Refresh data on login in case new data is relevant
    });
    netlifyIdentity.on('logout', () => {
        updateAuthUI();
        fetchSchedules(); // Refresh data on logout
    });

    // Theme toggle listener
    elements.themeToggle.addEventListener('click', toggleTheme);
};

// ======================
// Initialization
// ======================
const initApp = () => {
    loadTheme(); // Muat tema saat aplikasi dimulai
    addEventListeners();
    netlifyIdentity.init(); // Inisialisasi Netlify Identity
    fetchSchedules(); // Fetch data on initial load
};

// Start the application
initApp();
