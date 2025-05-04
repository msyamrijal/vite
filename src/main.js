// src/main.js (Versi dengan logging, JANGAN UBAH DULU)
import './styles.css';

console.log("Script main.js mulai dieksekusi.");

const API_BASE_URL = '/api';
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;
// ... URL lain ...

console.log("Mencari elemen DOM...");
const elements = { /* ... selektor ... */ };
console.log("Elemen DOM utama:", elements);
const adminElements = { /* ... selektor ... */ };
console.log("Elemen DOM admin:", adminElements);
// ... Cek elemen penting ...

let allSchedules = [];
let currentUser = null;
let isEditMode = false;

const initTheme = () => { /* ... kode sama ... */ };
const toggleTheme = () => { /* ... kode sama ... */ };
const updateThemeIcon = (theme) => { /* ... kode sama ... */ };

const fetchData = async () => {
    console.log("fetchData: Memulai pengambilan data...");
    showLoading();
    hideEmptyState();
    try {
        console.log(`fetchData: Fetching from ${GET_SCHEDULES_URL}`);
        const response = await fetch(GET_SCHEDULES_URL);
        console.log(`fetchData: Response status: ${response.status}`); // <-- LIHAT INI DI KONSOL BROWSER

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            let errorBody = null;
            try {
                errorBody = await response.text();
                console.error("fetchData: Error response body:", errorBody); // <-- LIHAT INI JIKA STATUS TIDAK OK
                const errorData = JSON.parse(errorBody);
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
                 console.warn("fetchData: Could not parse error response as JSON. Body was:", errorBody);
                 if (response.statusText) errorMsg += ` (${response.statusText})`;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("fetchData: Raw data received from API:", data); // <-- LIHAT INI DI KONSOL BROWSER

        if (!Array.isArray(data)) {
             console.error("fetchData: Data received is not an array!", data);
             throw new Error("Format data tidak valid dari server.");
        }

        const today = new Date(); today.setHours(0, 0, 0, 0);
        allSchedules = data
            .filter(item => item && item.tanggal)
            .map((item, index) => {
                const newItem = {
                    ...item,
                    peserta: Array.isArray(item.peserta) ? item.peserta : [], // Pastikan array
                    TanggalDate: null
                };
                try {
                    const dateObj = new Date(item.tanggal + 'T00:00:00Z');
                    if (!isNaN(dateObj.getTime())) { newItem.TanggalDate = dateObj; }
                    else { console.warn(`fetchData: Invalid date format for item at index ${index}:`, item.tanggal); }
                } catch (dateError) { console.warn(`fetchData: Error parsing date for item at index ${index}:`, item.tanggal, dateError); }
                return newItem;
             })
            .filter(item => item.TanggalDate && item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        console.log("fetchData: Processed schedules count:", allSchedules.length); // <-- LIHAT INI
        if (allSchedules.length > 0) {
            console.log("fetchData: Sample processed item:", allSchedules[0]); // <-- LIHAT STRUKTUR PESERTA DI SINI
            console.log("fetchData: Type of peserta in sample processed item:", typeof allSchedules[0]?.peserta, "Is Array?", Array.isArray(allSchedules[0]?.peserta)); // <-- CEK TIPE PESERTA
        }

        initFilters();
        filterSchedules();
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

const initFilters = () => { /* ... kode sama ... */ };
const filterSchedules = () => { /* ... kode sama ... */ };

const renderSchedules = (data) => {
    console.log(`Rendering ${data.length} schedules...`); // <-- LIHAT INI
    // ... (sisa kode renderSchedules sama) ...
    if (!elements.scheduleGrid) { console.error("Cannot render: scheduleGrid element not found."); return; }
    elements.scheduleGrid.innerHTML = '';
    if (data.length === 0) { if (!elements.loading || elements.loading.style.display === 'none') { console.log("No schedules to render, showing empty state."); showEmptyState("Tidak ada jadwal yang cocok dengan filter Anda."); } else { console.log("No schedules to render, but still loading."); } return; }
    hideEmptyState();
    const fragment = document.createDocumentFragment();
    data.forEach((item, index) => { const card = createScheduleCard(item); fragment.appendChild(card); });
    elements.scheduleGrid.appendChild(fragment);
    console.log("Rendering complete.");
};

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    card.className = 'schedule-card';
    // *** Log data peserta SEBELUM render ***
    console.log(`Rendering card ID ${item.id}, Peserta data:`, item.peserta, `Is Array? ${Array.isArray(item.peserta)}`);

    let pesertaHtml = '<span class="participant-tag na-tag">N/A</span>';
    if (Array.isArray(item.peserta) && item.peserta.length > 0) {
        pesertaHtml = item.peserta.map(peserta => {
            const pesertaText = typeof peserta === 'string' ? peserta : 'Invalid Data';
            return `<span class="participant-tag clickable" data-entity="Peserta" title="Lihat semua jadwal ${pesertaText}">${pesertaText}</span>`;
        }).join('');
    } else {
        // Log mengapa N/A ditampilkan
        console.log(`Rendering N/A for peserta ID ${item.id}. Array.isArray: ${Array.isArray(item.peserta)}, Length: ${item.peserta?.length}`);
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

const showGenericModal = (title, data) => { /* ... kode sama ... */ };
const hideModal = () => { /* ... kode sama ... */ };
const generateModalContent = (data) => { /* ... kode sama ... */ };
const handleEntityClick = (element) => { /* ... kode sama ... */ };
const setupEditForm = (scheduleId) => { /* ... kode sama ... */ };
const resetToAddMode = () => { /* ... kode sama ... */ };
const handleCancelEdit = () => { /* ... kode sama ... */ };
const handleScheduleFormSubmit = async (event) => { /* ... kode sama ... */ };
const setFormSubmitting = (isSubmitting) => { /* ... kode sama ... */ };
const showFormStatus = (message, isError) => { /* ... kode sama ... */ };
const handleDeleteClick = async (scheduleIdStr) => { /* ... kode sama ... */ };
const setupAdminFeatures = (user) => { /* ... kode sama ... */ };
const initNetlifyIdentity = () => { /* ... kode sama ... */ };
const formatDate = (dateString) => { /* ... kode sama ... */ };
const showLoading = () => { /* ... kode sama ... */ };
const hideLoading = () => { /* ... kode sama ... */ };
const showEmptyState = (message = "Tidak ada jadwal yang ditemukan.") => { /* ... kode sama ... */ };
const hideEmptyState = () => { /* ... kode sama ... */ };
const showError = (message = 'Terjadi kesalahan.') => { /* ... kode sama ... */ };
function debounce(func, wait) { /* ... kode sama ... */ }
const attachDynamicListeners = () => { /* ... kode sama ... */ };

document.addEventListener('DOMContentLoaded', () => { /* ... kode sama ... */ });

