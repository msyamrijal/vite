// Import CSS dari direktori yang sama
import './styles.css';

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
const API_BASE_URL = '/api'; // Asumsi menggunakan redirect Netlify
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;

// Elemen DOM Utama
const elements = {
    searchInput: document.getElementById('searchInput'),
    institutionFilter: document.getElementById('institutionFilter'),
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    // Hapus elemen modal
    themeToggleBtn: document.getElementById('themeToggle')
};

// Variabel Global
let allSchedules = [];

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
    const themeIcon = elements.themeToggleBtn?.querySelector('.theme-icon');
    // Implementasi ikon tema
};

// ======================
// MANAJEMEN DATA (Fetch)
// ======================
const fetchData = async () => {
    showLoading();
    hideEmptyState();
    try {
        console.log(`Fetching data from ${GET_SCHEDULES_URL}`); // Tetap log ini untuk debug
        const response = await fetch(GET_SCHEDULES_URL);
        console.log(`Fetch response status: ${response.status}`); // Log status

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error("Error response data:", errorData); // Log error response
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) { /* Abaikan jika bukan JSON */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("Raw data received:", data); // Log data mentah

        if (!Array.isArray(data)) {
             console.error("Data received is not an array!");
             throw new Error("Format data tidak valid.");
        }

        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        allSchedules = data
            .filter(item => item && item.tanggal)
            .map(item => ({
                ...item,
                // Pastikan peserta adalah array
                peserta: Array.isArray(item.peserta) ? item.peserta : [],
                TanggalDate: item.tanggal ? new Date(item.tanggal + 'T00:00:00Z') : null
             }))
            .filter(item => item.TanggalDate && !isNaN(item.TanggalDate.getTime()) && item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        console.log("Processed schedules:", allSchedules); // Log data yang diproses

        initFilters();
        filterSchedules(); // Render data
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
const initFilters = () => {
    if (!elements.institutionFilter) return;
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
// RENDERING JADWAL
// ======================
const renderSchedules = (data) => {
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

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    card.className = 'schedule-card';

    // Logika render peserta yang fokus pada tampilan
    let pesertaHtml = '<span class="participant-tag na-tag">N/A</span>'; // Default
    if (Array.isArray(item.peserta) && item.peserta.length > 0) {
        pesertaHtml = item.peserta.map(peserta => {
            // Pastikan peserta adalah string sebelum dirender
            const pesertaText = typeof peserta === 'string' ? peserta.trim() : 'Data tidak valid';
             // Hanya render jika pesertaText tidak kosong setelah trim
            return pesertaText ? `<span class="participant-tag">${pesertaText}</span>` : '';
        }).filter(tag => tag).join(''); // Filter tag kosong dan gabungkan

        // Jika setelah filter hasilnya kosong (misal semua peserta string kosong), tampilkan N/A
        if (!pesertaHtml) {
             pesertaHtml = '<span class="participant-tag na-tag">N/A</span>';
        }
    }

    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title">${item.mata_pelajaran || 'N/A'}</h3>
            <span class="date-display">${formatDate(item.tanggal)}</span>
        </div>
        <div class="institute">${item.institusi || 'N/A'}</div>
        <div class="participants">
            ${pesertaHtml} {/* Gunakan HTML yang sudah diproses */}
        </div>
        `;
    return card;
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

const showLoading = () => { if(elements.loading) elements.loading.style.display = 'flex'; if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; hideEmptyState(); };
const hideLoading = () => { if(elements.loading) elements.loading.style.display = 'none'; if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'grid'; };
const showEmptyState = (message = "Tidak ada jadwal yang ditemukan.") => { if(elements.emptyState) { elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-ghost empty-icon"></i><h3>Oops! Kosong</h3><p>${message}</p>`; } if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; };
const hideEmptyState = () => { if(elements.emptyState) elements.emptyState.style.display = 'none'; };
const showError = (message = 'Terjadi kesalahan.') => { hideLoading(); if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; if(elements.emptyState) { elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-exclamation-triangle empty-icon error-icon"></i><h3>Terjadi Kesalahan</h3><p>${message}</p>`; } };
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

// ======================
// EVENT LISTENERS
// ======================
// Listener dinamis dihapus karena tidak ada elemen clickable di kartu lagi

// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState) { console.error("Initialization failed: Essential elements missing."); return; }

    initTheme();
    fetchData(); // Langsung fetch data

    // Listener statis
    elements.themeToggleBtn?.addEventListener('click', toggleTheme);
    // Listener filter sudah dipasang di initFilters
});
