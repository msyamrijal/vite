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
};

// ======================
// State
// ======================
let allSchedules = []; // Holds all fetched and processed schedule data
let isLoading = false;

// ======================
// Utility Functions
// ======================
const formatDate = (dateString) => {
    if (!dateString) return 'Tanggal tidak valid';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Tanggal tidak valid';
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
    elements.loadingIndicator.style.display = loading ? 'block' : 'none';
};

// ======================
// Data Fetching
// ======================
const fetchSchedules = async () => {
    setLoading(true);
    elements.noResultsMessage.style.display = 'none'; // Hide no results message initially
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
                return item.tanggal && item.institusi && item.mata_pelajaran && item.peserta && Array.isArray(item.peserta) && !isNaN(new Date(item.tanggal).getTime());
            })
            .map(item => ({ ...item, TanggalDate: new Date(item.tanggal) })) // Pre-convert date for sorting/filtering
            .filter(item => item.TanggalDate >= today) // Filter out past dates using the pre-converted date
            .sort((a, b) => a.TanggalDate - b.TanggalDate); // Sort by date ascending

        initFilters(); // Initialize filters only after data is loaded
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
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-entity="mata_pelajaran" data-value="${item.mata_pelajaran}">${item.mata_pelajaran}</h3>
            <span class="date-display clickable" data-entity="tanggal" data-value="${item.tanggal}">${formatDate(item.tanggal)}</span>
        </div>
        <div class="institute clickable" data-entity="institusi" data-value="${item.institusi}">${item.institusi}</div>
        <div class="participants">
            ${Array.isArray(item.peserta) ? item.peserta.map(peserta => `
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
                ${Array.isArray(item.peserta) ? item.peserta.map(p => `<span class="participant-tag">${p}</span>`).join('') : ''}
            </div>
        </div>
    `).join('');
};

const openModal = () => elements.modal.style.display = 'flex';
const closeModal = () => elements.modal.style.display = 'none';

const handleEntityClick = (event) => {
    const target = event.target.closest('.clickable');
    if (!target) return;

    const entityType = target.dataset.entity; // Should be lowercase now (e.g., 'mata_pelajaran', 'tanggal', 'institusi', 'peserta')
    const value = target.dataset.value;
    const filterProperty = entityType; // Direct mapping now works

    if (!entityType || !value) return;

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
// Event Listeners
// ======================
const addEventListeners = () => {
    elements.searchInput.addEventListener('input', filterAndSearchSchedules);
    elements.institutionFilter.addEventListener('change', filterAndSearchSchedules);
    elements.closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === elements.modal) {
            closeModal();
        }
    });
    // Add event listener to the container for delegation
    elements.scheduleContainer.addEventListener('click', handleEntityClick);
};

// ======================
// Initialization
// ======================
const initApp = () => {
    addEventListeners();
    fetchSchedules(); // Fetch data on initial load
};

// Start the application
initApp();
