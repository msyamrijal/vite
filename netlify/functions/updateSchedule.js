// Lokasi file: netlify/functions/updateSchedule.js

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
    if (event.httpMethod !== 'PUT') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed: Only PUT requests are accepted.' }), headers: { 'Allow': 'PUT' } };
    }

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity + Role)
    // -----------------------------------------------------
    const { identity, user } = context.clientContext;
    if (!user) {
        console.warn("Unauthorized access attempt: No user context found.");
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to update a schedule.' }) };
    }

    // --- CEK ROLE ADMIN ---
    const roles = user.app_metadata?.roles || [];
    if (!roles.includes('admin')) {
        console.warn(`Forbidden access attempt by user: ${user.email} (Missing 'admin' role)`);
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin role required for this action.' }) };
    }
    // --- AKHIR CEK ROLE ---

    console.log(`Authorized update attempt by admin user: ${user.email}`);

    // 3. Parse dan Validasi Data Input dari Body Request
    // -----------------------------------------------------
    let updatedData;
    let scheduleId;
    try {
        if (!event.body) throw new Error("Request body is empty.");
        const requestBody = JSON.parse(event.body);

        // Ambil ID dari body
        scheduleId = requestBody.id;
        if (!scheduleId || typeof scheduleId !== 'number') {
             throw new Error("Missing or invalid 'id' in request body.");
        }

        // Ambil data yang akan diupdate
        updatedData = requestBody.data;
        if (!updatedData || typeof updatedData !== 'object') throw new Error("Missing or invalid 'data' object in request body.");

        // Validasi field yang diupdate
        if (!updatedData.institusi || typeof updatedData.institusi !== 'string' || updatedData.institusi.trim() === '') throw new Error("Missing or invalid 'institusi'.");
        if (!updatedData.mata_pelajaran || typeof updatedData.mata_pelajaran !== 'string' || updatedData.mata_pelajaran.trim() === '') throw new Error("Missing or invalid 'mata_pelajaran'.");
        if (!updatedData.tanggal || typeof updatedData.tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updatedData.tanggal)) throw new Error("Missing or invalid 'tanggal' (must be YYYY-MM-DD string).");
        if (!updatedData.peserta || !Array.isArray(updatedData.peserta)) throw new Error("Missing or invalid 'peserta' (must be an array of strings).");

        console.log(`Received valid data for updating schedule ID ${scheduleId}:`, updatedData);

    } catch (error) {
        console.error("Error parsing or validating request body for update:", error.message);
        return { statusCode: 400, body: JSON.stringify({ error: `Bad Request: ${error.message}` }) };
    }

    // 4. Inisialisasi Supabase Client (Menggunakan Service Role Key)
    // -----------------------------------------------------
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Update Data di Tabel Supabase
    // -----------------------------------------------------
    try {
        // *** Ganti 'schedules' jika nama tabel berbeda ***
        const tableName = 'schedules';
        console.log(`Attempting to update table '${tableName}' for ID: ${scheduleId}...`);

        const { data, error } = await supabase
            .from(tableName)
            .update({
                institusi: updatedData.institusi.trim(),
                mata_pelajaran: updatedData.mata_pelajaran.trim(),
                tanggal: updatedData.tanggal,
                peserta: updatedData.peserta.map(p => typeof p === 'string' ? p.trim() : '').filter(p => p),
            })
            .eq('id', scheduleId)
            .select()
            .single();

        if (error) {
            console.error(`Supabase update error for table '${tableName}', ID ${scheduleId}:`, error);
            if (error.code === 'PGRST116') { // Cek jika ID tidak ditemukan
                 return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleId} not found.` }) };
            }
            throw new Error(`Database error: ${error.message}`);
        }
        if (!data) { // Cek juga jika data null (seharusnya tidak terjadi jika error PGRST116 tidak muncul)
             console.warn(`No schedule found with ID ${scheduleId} to update (data was null).`);
             return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleId} not found.` }) };
        }

        console.log(`Successfully updated schedule with ID: ${scheduleId}`);

        return {
            statusCode: 200, // OK
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        };

    } catch (error) {
        console.error(`Error during Supabase update operation for ID ${scheduleId}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update schedule in database.', details: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};
