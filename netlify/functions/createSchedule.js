// Lokasi file: netlify/functions/createSchedule.js

import { createClient } from '@supabase/supabase-js';

// Ambil Konfigurasi Supabase dari Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Gunakan Service Role Key

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("FATAL: Supabase URL or Service Role Key environment variable is missing.");
}

// Fungsi handler utama Netlify Function
exports.handler = async (event, context) => {

    // 1. Validasi Konfigurasi Server & Metode HTTP
    // -----------------------------------------------------
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Supabase URL or Service Role Key missing inside handler.");
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed: Only POST requests are accepted.' }), headers: { 'Allow': 'POST' } };
    }

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity + Role)
    // -----------------------------------------------------
    const { identity, user } = context.clientContext;
    if (!user) {
        console.warn("Unauthorized access attempt: No user context found.");
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to create a schedule.' }) };
    }

    // --- CEK ROLE ADMIN ---
    const roles = user.app_metadata?.roles || []; // Ambil roles, default array kosong
    if (!roles.includes('admin')) {
        // Jika tidak ada role 'admin', tolak akses
        console.warn(`Forbidden access attempt by user: ${user.email} (Missing 'admin' role)`);
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin role required for this action.' }) };
    }
    // --- AKHIR CEK ROLE ---

    console.log(`Authorized action by admin user: ${user.email}`); // Lolos cek user & role

    // 3. Parse dan Validasi Data Input dari Body Request
    // -----------------------------------------------------
    let newData;
    try {
        if (!event.body) throw new Error("Request body is empty.");
        newData = JSON.parse(event.body);

        // Validasi dasar
        if (!newData || typeof newData !== 'object') throw new Error("Invalid data format.");
        if (!newData.institusi || typeof newData.institusi !== 'string' || newData.institusi.trim() === '') throw new Error("Missing or invalid 'institusi'.");
        if (!newData.mata_pelajaran || typeof newData.mata_pelajaran !== 'string' || newData.mata_pelajaran.trim() === '') throw new Error("Missing or invalid 'mata_pelajaran'.");
        if (!newData.tanggal || typeof newData.tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(newData.tanggal)) throw new Error("Missing or invalid 'tanggal' (must be YYYY-MM-DD string).");
        if (!newData.peserta || !Array.isArray(newData.peserta)) throw new Error("Missing or invalid 'peserta' (must be an array of strings).");

        console.log("Received valid data for new schedule:", newData);

    } catch (error) {
        console.error("Error parsing or validating request body:", error.message);
        return { statusCode: 400, body: JSON.stringify({ error: `Bad Request: ${error.message}` }) };
    }

    // 4. Inisialisasi Supabase Client (Menggunakan Service Role Key)
    // -----------------------------------------------------
    // Inisialisasi SETELAH user diautentikasi & diotorisasi
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Insert Data ke Tabel Supabase
    // -----------------------------------------------------
    try {
        // *** Ganti 'schedules' jika nama tabel berbeda ***
        const tableName = 'schedules';
        console.log(`Attempting to insert into table '${tableName}'...`);

        const { data, error } = await supabase
            .from(tableName)
            .insert([
                {
                    institusi: newData.institusi.trim(),
                    mata_pelajaran: newData.mata_pelajaran.trim(),
                    tanggal: newData.tanggal,
                    peserta: newData.peserta.map(p => typeof p === 'string' ? p.trim() : '').filter(p => p),
                },
            ])
            .select()
            .single();

        if (error) {
            console.error(`Supabase insert error into table '${tableName}':`, error);
            throw new Error(`Database error: ${error.message}`);
        }

        console.log(`Successfully inserted schedule with ID: ${data ? data.id : 'N/A'}`);

        return {
            statusCode: 201, // Created
            body: JSON.stringify(data || {}),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error('Error during Supabase insert operation:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create schedule in database.', details: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};
