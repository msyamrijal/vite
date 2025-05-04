// netlify/functions/getSchedules.js
const { google } = require('googleapis');

// Fungsi handler Netlify Function
exports.handler = async (event, context) => {
    try {
        // Ambil kredensial, ID Spreadsheet, dan Range dari environment variables
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
        const spreadsheetId = process.env.SPREADSHEET_ID;
        // Sesuaikan 'Database!A:F' jika nama sheet atau range kolom Anda berbeda
        // Range ini harus mencakup semua kolom yang dibutuhkan (Institusi, Mata_Pelajaran, Tanggal, Peserta)
        const range = process.env.SHEET_RANGE || 'Database!A:F';

        // Validasi environment variables
        if (!credentials || !spreadsheetId) {
            throw new Error("Missing Google credentials or Spreadsheet ID environment variables.");
        }

        // Siapkan otentikasi
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Panggil API untuk mendapatkan data
        console.log(`Workspaceing data from Spreadsheet ID: ${spreadsheetId}, Range: ${range}`); // Log untuk debugging
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const rows = response.data.values;

        if (!rows || rows.length < 2) { // Butuh setidaknya 1 baris header + 1 baris data
            console.log("No data found or only header row present."); // Log untuk debugging
            return {
                statusCode: 200,
                body: JSON.stringify([]),
                headers: { 'Content-Type': 'application/json' },
            };
        }

        // --- Transformasi Data berdasarkan Header CSV ---
        const headers = rows[0].map(header => header.trim()); // Baris pertama sebagai header
        console.log("Detected Headers:", headers); // Log untuk debugging

        // Cari index kolom yang dibutuhkan (lebih robust daripada hardcode index)
        const institusiIndex = headers.indexOf('Institusi');
        const mataPelajaranIndex = headers.indexOf('Mata_Pelajaran');
        const tanggalIndex = headers.indexOf('Tanggal');
        const pesertaIndex = headers.indexOf('Peserta');

        // Periksa apakah semua header yang dibutuhkan ada
        if (institusiIndex === -1 || mataPelajaranIndex === -1 || tanggalIndex === -1 || pesertaIndex === -1) {
             console.error("Missing required headers in the sheet. Found:", headers);
             throw new Error("One or more required headers (Institusi, Mata_Pelajaran, Tanggal, Peserta) not found in the sheet.");
        }

        const data = rows.slice(1) // Mulai dari baris kedua (setelah header)
            .map((row, rowIndex) => {
                // Ambil data peserta mentah
                const pesertaRaw = row[pesertaIndex] || ''; // Default string kosong jika kosong

                // Proses kolom 'Peserta': Hapus newline, split by comma, trim, filter empty
                const pesertaArray = pesertaRaw
                    .replace(/(\r\n|\n|\r)/gm, " ") // Ganti newline dengan spasi (opsional)
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p); // Hapus string kosong setelah split/trim

                // Buat object schedule
                const schedule = {
                    // Ambil data berdasarkan index header yang ditemukan
                    Institusi: row[institusiIndex] ? row[institusiIndex].trim() : '',
                    Mata_Pelajaran: row[mataPelajaranIndex] ? row[mataPelajaranIndex].trim() : '',
                    Tanggal: row[tanggalIndex] ? row[tanggalIndex].trim() : '', // Biarkan sebagai string, frontend akan format
                    Peserta: pesertaArray,
                    // ID dan Password (dan header lain) diabaikan
                };

                 // Optional: Validasi dasar (misal: pastikan tanggal tidak kosong)
                 if (!schedule.Tanggal || !schedule.Institusi || !schedule.Mata_Pelajaran) {
                    console.warn(`Skipping row ${rowIndex + 2} due to missing essential data:`, schedule);
                    return null; // Tandai untuk dihapus nanti jika data penting kosong
                 }


                return schedule;
            })
            .filter(schedule => schedule !== null); // Hapus baris yang ditandai null karena data tidak valid

        // --- Akhir Transformasi Data ---
        console.log(`Successfully processed ${data.length} schedule items.`); // Log untuk debugging

        // Kirim data JSON sebagai response
        return {
            statusCode: 200,
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Izinkan akses dari mana saja
            },
        };

    } catch (error) {
        // Log error detail di Netlify Function Logs
        console.error('Error in getSchedules function:', error);
        // Kirim response error generik ke client
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch schedule data', details: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};