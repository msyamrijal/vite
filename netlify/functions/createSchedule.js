// Lokasi file: netlify/functions/createSchedule.js

// Impor Supabase client library
import { createClient } from '@supabase/supabase-js';

// Ambil Supabase URL dan Kunci API dari Netlify Environment Variables
// Pastikan Anda sudah set variabel ini di Netlify UI!
const supabaseUrl = process.env.SUPABASE_URL;
// !! PENTING: Untuk operasi tulis (Create, Update, Delete) dari backend (Netlify Function),
// !! kita seringkali menggunakan SERVICE_ROLE_KEY agar fungsi ini punya hak akses penuh
// !! ke database SETELAH kita memverifikasi pengguna di awal fungsi.
// !! Ini menyederhanakan RLS di Supabase TAPI memindahkan beban keamanan
// !! sepenuhnya ke pemeriksaan autentikasi/autorisasi di awal fungsi ini.
// !! Pastikan Anda sudah menyimpan SUPABASE_SERVICE_ROLE_KEY di Netlify env vars.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Jika Anda lebih memilih menggunakan ANON KEY dan RLS yang ketat di Supabase:
// const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Lakukan pengecekan awal saat fungsi di-load
if (!supabaseUrl || !supabaseServiceKey) { // Ganti ke supabaseAnonKey jika pakai anon
    console.error("FATAL: Supabase URL or Service Role Key environment variable is missing.");
}

// Fungsi handler utama Netlify Function
exports.handler = async (event, context) => {

    // 1. Validasi Konfigurasi Server & Metode HTTP
    // -----------------------------------------------------
    if (!supabaseUrl || !supabaseServiceKey) { // Ganti ke supabaseAnonKey jika pakai anon
        console.error("Supabase URL or Service Role Key missing inside handler.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
    // Pastikan ini adalah request POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405, // Method Not Allowed
            body: JSON.stringify({ error: 'Method Not Allowed: Only POST requests are accepted.' }),
            headers: { 'Allow': 'POST', 'Content-Type': 'application/json' },
        };
    }

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity)
    // -----------------------------------------------------
    // Ini adalah langkah keamanan KRUSIAL karena kita akan menggunakan Service Role Key
    const { identity, user } = context.clientContext;
    if (!user) {
        console.warn("Unauthorized access attempt: No user context found.");
        return {
            statusCode: 401, // Unauthorized
            body: JSON.stringify({ error: 'Unauthorized: You must be logged in to create a schedule.' })
        };
    }
    // (Opsional) Cek jika pengguna memiliki role 'admin'
    // const roles = user.app_metadata.roles || [];
    // if (!roles.includes('admin')) {
    //     console.warn(`Forbidden access attempt by user: ${user.email}`);
    //     return {
    //         statusCode: 403, // Forbidden
    //         body: JSON.stringify({ error: 'Forbidden: Admin role required to create schedules.' })
    //     };
    // }
    console.log(`Authorized action by user: ${user.email}`); // Log siapa yang melakukan aksi

    // 3. Parse dan Validasi Data Input dari Body Request
    // -----------------------------------------------------
    let newData;
    try {
        if (!event.body) throw new Error("Request body is empty.");
        newData = JSON.parse(event.body);

        // Validasi dasar: pastikan field yang dibutuhkan ada dan tipe data sesuai
        if (!newData || typeof newData !== 'object') throw new Error("Invalid data format.");
        if (!newData.institusi || typeof newData.institusi !== 'string' || newData.institusi.trim() === '') throw new Error("Missing or invalid 'institusi'.");
        if (!newData.mata_pelajaran || typeof newData.mata_pelajaran !== 'string' || newData.mata_pelajaran.trim() === '') throw new Error("Missing or invalid 'mata_pelajaran'.");
        if (!newData.tanggal || typeof newData.tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(newData.tanggal)) throw new Error("Missing or invalid 'tanggal' (must be YYYY-MM-DD string).");
        if (!newData.peserta || !Array.isArray(newData.peserta)) throw new Error("Missing or invalid 'peserta' (must be an array of strings).");
        // Anda bisa menambahkan validasi lebih detail jika perlu

        console.log("Received valid data for new schedule:", newData); // Log data yang diterima

    } catch (error) {
        console.error("Error parsing or validating request body:", error.message);
        return {
            statusCode: 400, // Bad Request
            body: JSON.stringify({ error: `Bad Request: ${error.message}` })
        };
    }

    // 4. Inisialisasi Supabase Client (Menggunakan Service Role Key)
    // -----------------------------------------------------
    // Inisialisasi di dalam handler SETELAH user diautentikasi
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Insert Data ke Tabel Supabase
    // -----------------------------------------------------
    try {
        // *** PERHATIKAN: Ganti 'schedules' jika nama tabel Anda berbeda ***
        const tableName = 'schedules';

        console.log(`Attempting to insert into table '${tableName}'...`); // Log

        // Insert data baru ke tabel
        const { data, error } = await supabase
            .from(tableName)
            .insert([
                {
                    // Mapping data dari request body ke kolom tabel
                    institusi: newData.institusi.trim(),
                    mata_pelajaran: newData.mata_pelajaran.trim(),
                    tanggal: newData.tanggal, // Asumsi sudah format YYYY-MM-DD
                    peserta: newData.peserta.map(p => typeof p === 'string' ? p.trim() : '').filter(p => p), // Pastikan array of strings & trim
                },
            ])
            .select() // Kembalikan data yang baru saja di-insert (termasuk ID & created_at)
            .single(); // Asumsi hanya insert satu baris, ambil objectnya langsung

        // Tangani jika ada error dari Supabase saat insert
        if (error) {
            console.error(`Supabase insert error into table '${tableName}':`, error);
            // Mungkin ada detail error yang lebih spesifik dari Supabase
            throw new Error(`Database error: ${error.message}`);
        }

        console.log(`Successfully inserted schedule with ID: ${data ? data.id : 'N/A'}`); // Log sukses

        // Kembalikan data yang baru dibuat dengan status 201 Created
        return {
            statusCode: 201,
            body: JSON.stringify(data || {}), // Kembalikan data baru atau objek kosong
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        // Tangani error saat proses insert atau error tak terduga lainnya
        console.error('Error during Supabase insert operation:', error);
        return {
            statusCode: 500, // Internal Server Error
            body: JSON.stringify({ error: 'Failed to create schedule in database.', details: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};