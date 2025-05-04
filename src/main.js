// Tidak perlu import CSS jika tidak ada file CSS

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
const API_BASE_URL = '/api'; // Asumsi redirect Netlify
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;

const elements = {
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState')
};

// Variabel Global
let allSchedules = [];

// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => {
    if (!dateString) return 'Tanggal tidak valid';
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Asumsi UTC
        if (isNaN(date.getTime())) return 'Tanggal tidak valid';
        const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
        return date.toLocaleDateString('id-ID', options);
    } catch (e) {
        return 'Format tanggal salah';
    }
};

const showLoading = () => {
    if (elements.loading) elements.loading.style.display = 'block';
    if (elements.scheduleGrid) elements.scheduleGrid.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.errorState) elements.errorState.style.display = 'none';
};

const hideLoading = () => {
    if (elements.loading) elements.loading.style.display = 'none';
    if (elements.scheduleGrid) elements.scheduleGrid.style.display = 'block';
};

const showEmptyState = () => {
    hideLoading();
    if (elements.emptyState) elements.emptyState.style.display = 'block';
    if (elements.scheduleGrid) elements.scheduleGrid.innerHTML = '';
};

const showError = (message) => {
    hideLoading();
    if (elements.errorState) {
        elements.errorState.textContent = `Error: ${message}`;
        elements.errorState.style.display = 'block';
    }
    if (elements.scheduleGrid) elements.scheduleGrid.innerHTML = '';
};


// ======================
// MANAJEMEN DATA (Fetch)
// ======================
const fetchData = async () => {
    showLoading();
    try {
        const response = await fetch(GET_SCHEDULES_URL);
        if (!response.ok) {
            let errorMsg = `Gagal mengambil data (Status: ${response.status})`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) { /* Abaikan */ }
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
                peserta: Array.isArray(item.peserta) ? item.peserta : [], // Pastikan array
                TanggalDate: item.tanggal ? new Date(item.tanggal + 'T00:00:00Z') : null
             }))
            .filter(item => item.TanggalDate && !isNaN(item.TanggalDate.getTime()) && item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        renderSchedules(allSchedules);

    } catch (error) {
        console.error('Fetch Error:', error);
        showError(error.message);
        allSchedules = [];
        renderSchedules([]);
    } finally {
        hideLoading();
    }
};

// ======================
// RENDERING JADWAL
// ======================
const renderSchedules = (data) => {
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = '';

    if (data.length === 0) {
        showEmptyState();
        return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        const scheduleElement = document.createElement('div');
        scheduleElement.className = 'schedule-item'; // Class untuk border (dari HTML)

        const titleElement = document.createElement('h2');
        titleElement.textContent = item.mata_pelajaran || 'Mata Pelajaran Tidak Ada';

        const institusiElement = document.createElement('p');
        institusiElement.innerHTML = `<strong>Institusi:</strong> ${item.institusi || '-'}`; // Tampilkan '-' jika kosong

        const tanggalElement = document.createElement('p');
        tanggalElement.innerHTML = `<strong>Tanggal:</strong> ${formatDate(item.tanggal)}`;

        const pesertaContainer = document.createElement('div');
        pesertaContainer.innerHTML = '<strong>Peserta:</strong>';

        // Hanya tambahkan list jika peserta adalah array dan punya isi
        if (Array.isArray(item.peserta) && item.peserta.length > 0) {
            const pesertaList = document.createElement('ul');
            let validPesertaCount = 0; // Hitung nama peserta yang valid
            item.peserta.forEach(nama => {
                const namaTrimmed = typeof nama === 'string' ? nama.trim() : '';
                if (namaTrimmed) { // Hanya tambahkan jika nama tidak kosong
                    const li = document.createElement('li');
                    li.textContent = namaTrimmed;
                    pesertaList.appendChild(li);
                    validPesertaCount++;
                }
            });
            // Hanya tampilkan <ul> jika ada setidaknya satu nama valid
            if (validPesertaCount > 0) {
                pesertaContainer.appendChild(pesertaList);
            } else {
                // Jika semua nama kosong/invalid, tampilkan tanda strip
                 pesertaContainer.innerHTML += ' -';
            }
        } else {
            // Jika peserta bukan array atau array kosong, tampilkan tanda strip
            pesertaContainer.innerHTML += ' -';
        }

        scheduleElement.appendChild(titleElement);
        scheduleElement.appendChild(institusiElement);
        scheduleElement.appendChild(tanggalElement);
        scheduleElement.appendChild(pesertaContainer);

        fragment.appendChild(scheduleElement);
    });

    elements.scheduleGrid.appendChild(fragment);
};

// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState || !elements.errorState) {
        console.error("Initialization failed: Essential elements missing.");
        document.body.innerHTML = "<p style='color:red; padding: 20px;'>Error: Elemen dasar tidak ditemukan.</p>";
        return;
    }
    fetchData(); // Langsung ambil data
});
