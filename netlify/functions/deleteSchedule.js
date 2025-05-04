// Lokasi file: netlify/functions/deleteSchedule.js

import { createClient } from '@supabase/supabase-js';

// Ambil Konfigurasi Supabase dari Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
// Gunakan Service Role Key untuk bypass RLS setelah user diautentikasi
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) { // Cek saat build/deploy
    console.error("FATAL: Supabase URL or Service Role Key environment variable is missing.");
}

exports.handler = async (event, context) => {

    // 1. Validasi Konfigurasi Server & Metode HTTP
    // -----------------------------------------------------
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Supabase URL or Service Role Key missing inside handler.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    if (event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed: Only DELETE requests are accepted.' }),
            headers: { 'Allow': 'DELETE', 'Content-Type': 'application/json' }
        };
    }

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity)
    // -----------------------------------------------------
    const { identity, user } = context.clientContext;
    if (!user) {
        return {
            statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to delete a schedule.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    // (Opsional) Cek role admin jika perlu
    // const roles = user.app_metadata.roles || [];
    // if (!roles.includes('admin')) {
    //     return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin role required.' }) };
    // }
    console.log(`Authorized delete attempt by user: ${user.email}`);

    // 3. Ekstrak ID Jadwal dari Path URL
    // -----------------------------------------------------
    // Asumsi URL adalah /api/deleteSchedule/{id}
    const pathParts = event.path.split('/');
    const scheduleId = pathParts[pathParts.length - 1];

    if (!scheduleId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Missing schedule ID in URL path.' }), headers: { 'Content-Type': 'application/json' } };
    }
    console.log(`Attempting to delete schedule with ID: ${scheduleId}`);

    // 4. Inisialisasi Supabase Client (Menggunakan Service Role Key)
    // -----------------------------------------------------
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Hapus Data dari Tabel Supabase
    // -----------------------------------------------------
    try {
        // *** PERHATIKAN: Ganti 'schedules' jika nama tabel Anda berbeda ***
        const tableName = 'schedules';

        const { error, count } = await supabase
            .from(tableName)
            .delete()
            .eq('id', scheduleId); // Kondisi WHERE id = scheduleId

        if (error) {
            console.error(`Supabase delete error for table '${tableName}', ID ${scheduleId}:`, error);
            throw new Error(`Database error: ${error.message}`);
        }

        // Cek apakah ada baris yang terhapus
        if (count === 0) {
            console.warn(`No schedule found with ID ${scheduleId} to delete.`);
            return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleId} not found.` }), headers: { 'Content-Type': 'application/json' } };
        }

        console.log(`Successfully deleted schedule with ID: ${scheduleId}`);
        // Kembalikan status 204 No Content (standar untuk DELETE sukses)
        return { statusCode: 204 };

    } catch (error) {
        console.error(`Error during Supabase delete operation for ID ${scheduleId}:`, error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to delete schedule from database.', details: error.message }), headers: { 'Content-Type': 'application/json' } };
    }
};