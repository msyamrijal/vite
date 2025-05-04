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

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity + Role)
    // -----------------------------------------------------
    const { identity, user } = context.clientContext;
    if (!user) {
        console.warn("Unauthorized access attempt: No user context found.");
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to delete a schedule.' }) };
    }

    // --- CEK ROLE ADMIN ---
    const roles = user.app_metadata?.roles || [];
    if (!roles.includes('admin')) {
        console.warn(`Forbidden access attempt by user: ${user.email} (Missing 'admin' role)`);
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin role required for this action.' }) };
    }
    // --- AKHIR CEK ROLE ---

    console.log(`Authorized delete attempt by admin user: ${user.email}`);

    // 3. Ambil ID dari Query Parameter
    // -----------------------------------------------------
    const scheduleId = event.queryStringParameters?.id;
    let scheduleIdNum;

    if (!scheduleId) {
        return { statusCode: 400, body: JSON.stringify({ error: "Bad Request: Missing 'id' query parameter." }) };
    }
    try {
        scheduleIdNum = parseInt(scheduleId, 10);
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
        // *** Ganti 'schedules' jika nama tabel berbeda ***
        const tableName = 'schedules';
        console.log(`Attempting to delete from table '${tableName}' for ID: ${scheduleIdNum}...`);

        const { error, count } = await supabase
            .from(tableName)
            .delete()
            .eq('id', scheduleIdNum);

        if (error) {
            console.error(`Supabase delete error for table '${tableName}', ID ${scheduleIdNum}:`, error);
            // Tidak perlu cek PGRST116 secara eksplisit jika count juga dicek
            throw new Error(`Database error: ${error.message}`);
        }

        // Jika count 0, berarti ID tidak ditemukan (meskipun tidak ada error DB)
        if (count === 0) {
             console.warn(`No schedule found with ID ${scheduleIdNum} to delete (count was 0).`);
             // Kembalikan 404 Not Found agar frontend tahu
             return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleIdNum} not found.` }) };
        }

        console.log(`Successfully deleted schedule with ID: ${scheduleIdNum} (Count: ${count})`);

        // Kembalikan status 204 No Content (sukses)
        return {
            statusCode: 204,
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
