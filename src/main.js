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
    modal: document.getElementById('genericModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalOverlay: document.querySelector('.modal-overlay'),
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
        const response = await fetch(GET_SCHEDULES_URL);
        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) { /* Abaikan */ }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
             throw new Error("Format data tidak valid.");
        }
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        allSchedules = data
            .filter(item => item && item.tanggal)
            .map(item => ({
                ...item,
                peserta: Array.isArray(item.peserta) ? item.peserta : [],
                TanggalDate: new Date(item.tanggal + 'T00:00:00Z')
             }))
            .filter(item => item.TanggalDate && !isNaN(item.TanggalDate.getTime()) && item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);
        initFilters();
        filterSchedules();
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
// EVENT HANDLER KLIK ENTITAS
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
        const clickedDate = new Date(value + 'T00:00:00Z');
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

    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const futureFilteredData = filteredData.filter(item => item.TanggalDate >= today);
    showGenericModal(modalTitlePrefix, futureFilteredData);
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
// EVENT LISTENERS DINAMIS (Delegation)
// ======================
const attachDynamicListeners = () => {
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        // Klik pada entitas di kartu jadwal
        if (target.classList.contains('clickable') && target.dataset.entity) { handleEntityClick(target); }
        // Klik tombol close modal atau overlay
        if (target === elements.modalOverlay || target.closest('.close-modal')) { hideModal(); }
        // Listener untuk edit/delete dihapus
    });
};

// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState) { console.error("Initialization failed: Essential elements missing."); return; }

    initTheme();
    // initNetlifyIdentity dihapus
    fetchData(); // Langsung fetch data
    attachDynamicListeners();

    // Listener statis
    elements.themeToggleBtn?.addEventListener('click', toggleTheme);
    // Listener untuk form admin dihapus

    // Listener Escape untuk modal
     window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && elements.modal?.style.display === 'block') { hideModal(); } });
});
