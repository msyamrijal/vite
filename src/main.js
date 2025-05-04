// Tidak perlu import CSS

// ======================
// KONFIGURASI & SELEKTOR DOM
// ======================
const API_BASE_URL = '/api'; // Asumsi redirect Netlify
const GET_SCHEDULES_URL = `${API_BASE_URL}/getSchedules`;

const elements = {
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState') // Elemen untuk pesan error
};

// Variabel Global
let allSchedules = [];

// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => {
    // Fungsi format tanggal sederhana (bisa disesuaikan)
    if (!dateString) return 'Tanggal tidak valid';
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Asumsi tanggal YYYY-MM-DD dari Supabase adalah UTC
        if (isNaN(date.getTime())) return 'Tanggal tidak valid';
        // Format sederhana: DD MMMM YYYY (misal: 05 Mei 2025)
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
    if (elements.scheduleGrid) elements.scheduleGrid.style.display = 'block'; // Tampilkan grid setelah loading
};

const showEmptyState = () => {
    hideLoading(); // Pastikan loading hilang
    if (elements.emptyState) elements.emptyState.style.display = 'block';
    if (elements.scheduleGrid) elements.scheduleGrid.innerHTML = ''; // Kosongkan grid
};

const showError = (message) => {
    hideLoading(); // Pastikan loading hilang
    if (elements.errorState) {
        elements.errorState.textContent = `Error: ${message}`;
        elements.errorState.style.display = 'block';
    }
    if (elements.scheduleGrid) elements.scheduleGrid.innerHTML = ''; // Kosongkan grid
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
            } catch (e) { /* Abaikan jika bukan JSON */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
             throw new Error("Format data tidak valid.");
        }

        // Filter hanya jadwal mendatang (opsional, bisa dilakukan di backend)
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        allSchedules = data
            .filter(item => item && item.tanggal)
            .map(item => ({
                ...item,
                peserta: Array.isArray(item.peserta) ? item.peserta : [], // Pastikan array
                TanggalDate: item.tanggal ? new Date(item.tanggal + 'T00:00:00Z') : null
             }))
            .filter(item => item.TanggalDate && !isNaN(item.TanggalDate.getTime()) && item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate); // Urutkan

        renderSchedules(allSchedules); // Render data

    } catch (error) {
        console.error('Fetch Error:', error);
        showError(error.message); // Tampilkan pesan error ke pengguna
        allSchedules = [];
        renderSchedules([]); // Kosongkan tampilan
    } finally {
        hideLoading();
    }
};

// ======================
// RENDERING JADWAL
// ======================
const renderSchedules = (data) => {
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = ''; // Kosongkan grid

    if (data.length === 0) {
        showEmptyState(); // Tampilkan pesan kosong jika tidak ada data
        return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        const scheduleElement = document.createElement('div');
        scheduleElement.className = 'schedule-item'; // Class untuk border

        // Buat elemen HTML untuk setiap detail
        const titleElement = document.createElement('h2');
        titleElement.textContent = item.mata_pelajaran || 'Mata Pelajaran Tidak Ada';

        const institusiElement = document.createElement('p');
        institusiElement.innerHTML = `<strong>Institusi:</strong> ${item.institusi || 'N/A'}`;

        const tanggalElement = document.createElement('p');
        tanggalElement.innerHTML = `<strong>Tanggal:</strong> ${formatDate(item.tanggal)}`;

        const pesertaContainer = document.createElement('div');
        pesertaContainer.innerHTML = '<strong>Peserta:</strong>';

        const pesertaList = document.createElement('ul');
        if (Array.isArray(item.peserta) && item.peserta.length > 0) {
            item.peserta.forEach(nama => {
                const li = document.createElement('li');
                li.textContent = typeof nama === 'string' ? nama.trim() : 'Data Peserta Salah';
                if (li.textContent) { // Hanya tambahkan jika nama tidak kosong
                    pesertaList.appendChild(li);
                }
            });
            // Jika setelah filter tidak ada nama valid, tampilkan N/A
            if (pesertaList.childElementCount === 0) {
                 pesertaContainer.innerHTML += ' N/A';
            } else {
                 pesertaContainer.appendChild(pesertaList);
            }
        } else {
            // Tampilkan N/A jika peserta bukan array atau array kosong
            pesertaContainer.innerHTML += ' N/A';
        }

        // Masukkan semua elemen ke dalam div utama jadwal
        scheduleElement.appendChild(titleElement);
        scheduleElement.appendChild(institusiElement);
        scheduleElement.appendChild(tanggalElement);
        scheduleElement.appendChild(pesertaContainer);

        fragment.appendChild(scheduleElement);
    });

    elements.scheduleGrid.appendChild(fragment); // Tampilkan semua jadwal
};

// ======================
// INISIALISASI UTAMA APLIKASI
// ======================
document.addEventListener('DOMContentLoaded', () => {
    // Pastikan elemen dasar ada
    if (!elements.scheduleGrid || !elements.loading || !elements.emptyState || !elements.errorState) {
        console.error("Initialization failed: Essential elements missing.");
        document.body.innerHTML = "<p style='color:red; padding: 20px;'>Error: Elemen dasar tidak ditemukan.</p>";
        return;
    }
    fetchData(); // Langsung ambil data saat halaman siap
});
