
// Lokasi file: netlify/functions/deleteSchedule.js

import { createClient } from '@supabase/supabase-js';

// Ambil Konfigurasi Supabase dari Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Gunakan Service Role Key

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("FATAL: Supabase URL or Service Role Key environment variable is missing.");
}

exports.handler = async (event, context) => {

    // 1. Validasi Konfigurasi Server & Metode HTTP
    // -----------------------------------------------------
    if (!supabaseUrl || !supabaseServiceKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }
    if (event.httpMethod !== 'DELETE') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed: Only DELETE requests are accepted.' }), headers: { 'Allow': 'DELETE' } };
    }

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity)
    // -----------------------------------------------------
    const { identity, user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to delete a schedule.' }) };
    }
    // (Opsional) Cek role admin jika perlu
    // const roles = user.app_metadata.roles || [];
    // if (!roles.includes('admin')) {
    //     return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin role required.' }) };
    // }
    console.log(`Authorized delete attempt by user: ${user.email}`);

    // 3. Ambil ID dari Query Parameter
    // -----------------------------------------------------
    const scheduleId = event.queryStringParameters?.id; // Ambil 'id' dari ?id=...
    let scheduleIdNum;

    if (!scheduleId) {
        return { statusCode: 400, body: JSON.stringify({ error: "Bad Request: Missing 'id' query parameter." }) };
    }
    try {
        scheduleIdNum = parseInt(scheduleId, 10); // Konversi ke angka
        if (isNaN(scheduleIdNum)) {
            throw new Error("Invalid ID format.");
        }
    } catch (error) {
         return { statusCode: 400, body: JSON.stringify({ error: "Bad Request: Invalid 'id' query parameter. Must be a number." }) };
    }

    console.log(`Received request to delete schedule ID: ${scheduleIdNum}`);

    // 4. Inisialisasi Supabase Client (Menggunakan Service Role Key)
    // -----------------------------------------------------
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Hapus Data dari Tabel Supabase
    // -----------------------------------------------------
    try {
        // *** PERHATIKAN: Ganti 'schedules' jika nama tabel Anda berbeda ***
        const tableName = 'schedules';

        console.log(`Attempting to delete from table '${tableName}' for ID: ${scheduleIdNum}...`);

        // Hapus data dari Supabase berdasarkan ID
        const { error, count } = await supabase
            .from(tableName)
            .delete()
            .eq('id', scheduleIdNum); // Kondisi WHERE id = scheduleIdNum

        // Tangani jika ada error dari Supabase saat delete
        if (error) {
            console.error(`Supabase delete error for table '${tableName}', ID ${scheduleIdNum}:`, error);
             // Cek jika error karena data tidak ditemukan
            if (error.code === 'PGRST116' || count === 0) { // PostgREST error atau count 0
                 console.warn(`No schedule found with ID ${scheduleIdNum} to delete.`);
                 // Bisa dianggap sukses (idempotent) atau 404
                 // return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleIdNum} not found.` }) };
            } else {
                 throw new Error(`Database error: ${error.message}`);
            }
        }

        // Jika count adalah 0 dan tidak ada error lain, berarti ID tidak ditemukan
        if (count === 0 && !error) {
             console.warn(`No schedule found with ID ${scheduleIdNum} to delete (count was 0).`);
             // Kembalikan 204 No Content atau 404 Not Found
             // 204 lebih umum untuk DELETE yang berhasil tapi tidak ada yang dihapus
        } else {
            console.log(`Successfully deleted schedule with ID: ${scheduleIdNum} (Count: ${count})`);
        }


        // Kembalikan status 204 No Content (standar untuk DELETE sukses)
        return {
            statusCode: 204,
            // Tidak perlu body untuk 204
        };

    } catch (error) {
        console.error(`Error during Supabase delete operation for ID ${scheduleIdNum}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete schedule from database.', details: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};
