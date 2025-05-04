// Lokasi file: netlify/functions/updateSchedule.js
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
    if (event.httpMethod !== 'PUT') {
        return {
            statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed: Only PUT requests are accepted.' }),
            headers: { 'Allow': 'PUT', 'Content-Type': 'application/json' }
        };
    }

    // 2. Cek Autentikasi & Autorisasi Pengguna (Netlify Identity)
    // -----------------------------------------------------
    const { identity, user } = context.clientContext;
    if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to update a schedule.' }) };
        return {
            statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: You must be logged in to update a schedule.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    // (Opsional) Cek role admin jika perlu
    // const roles = user.app_metadata.roles || [];
    // if (!roles.includes('admin')) {
    //     return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin role required.' }) };
    // }
    console.log(`Authorized update attempt by user: ${user.email}`);

    // 3. Parse dan Validasi Data Input dari Body Request
    // -----------------------------------------------------
    let updatedData;
    let scheduleId;
    try {
        if (!event.body) throw new Error("Request body is empty.");
        const requestBody = JSON.parse(event.body);

        // Ambil ID dari body request
        scheduleId = requestBody.id;
        if (!scheduleId || (typeof scheduleId !== 'number' && typeof scheduleId !== 'string')) { // ID bisa string atau number
             throw new Error("Missing or invalid 'id' in request body.");
        }

        // Ambil data yang akan diupdate
        updatedData = requestBody.data; // Asumsi frontend mengirim { id: ..., data: { ... } }
        if (!updatedData || typeof updatedData !== 'object') throw new Error("Missing or invalid 'data' object in request body.");

        // Validasi field yang diupdate (mirip create, tapi opsional tergantung field)
        if (!updatedData.institusi || typeof updatedData.institusi !== 'string' || updatedData.institusi.trim() === '') throw new Error("Missing or invalid 'institusi'.");
        if (!updatedData.mata_pelajaran || typeof updatedData.mata_pelajaran !== 'string' || updatedData.mata_pelajaran.trim() === '') throw new Error("Missing or invalid 'mata_pelajaran'.");
        if (!updatedData.tanggal || typeof updatedData.tanggal !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updatedData.tanggal)) throw new Error("Missing or invalid 'tanggal' (must be YYYY-MM-DD string).");
        if (!updatedData.peserta || !Array.isArray(updatedData.peserta) || updatedData.peserta.length === 0) throw new Error("Missing, invalid, or empty 'peserta' (must be a non-empty array of strings).");

        console.log(`Received valid data for updating schedule ID ${scheduleId}:`, updatedData);

    } catch (error) {
        console.error("Error parsing or validating request body for update:", error.message);
        return { statusCode: 400, body: JSON.stringify({ error: `Bad Request: ${error.message}` }), headers: { 'Content-Type': 'application/json' } };
    }

    // 4. Inisialisasi Supabase Client (Menggunakan Service Role Key)
    // -----------------------------------------------------
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Update Data di Tabel Supabase
    // -----------------------------------------------------
    try {
        // *** PERHATIKAN: Ganti 'schedules' jika nama tabel Anda berbeda ***
        const tableName = 'schedules';

        console.log(`Attempting to update table '${tableName}' for ID: ${scheduleId}...`);

        // Update data di Supabase berdasarkan ID
        const { data, error } = await supabase
            .from(tableName)
            .update({
                // Data yang akan diupdate
                institusi: updatedData.institusi.trim(),
                mata_pelajaran: updatedData.mata_pelajaran.trim(),
                tanggal: updatedData.tanggal,
                peserta: updatedData.peserta.map(p => String(p).trim()).filter(p => p),
                // Kolom 'id' dan 'created_at' biasanya tidak diupdate
            })
            .eq('id', scheduleId) // Kondisi WHERE id = scheduleId
            .select() // Kembalikan data yang baru diupdate
            .single(); // Asumsi hanya update satu baris

        // Tangani jika ada error dari Supabase saat update
        if (error) {
            console.error(`Supabase update error for table '${tableName}', ID ${scheduleId}:`, error);
            // Cek jika error karena data tidak ditemukan (misal, ID salah)
            if (error.code === 'PGRST116') { // Kode error PostgREST untuk 0 rows affected
                 return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleId} not found.` }), headers: { 'Content-Type': 'application/json' } };
            }
            throw new Error(`Database error: ${error.message}`);
        }

        // Cek jika data benar-benar terupdate (data tidak null)
        if (!data) {
             console.warn(`No schedule found with ID ${scheduleId} to update (or no changes made).`);
             return { statusCode: 404, body: JSON.stringify({ error: `Schedule with ID ${scheduleId} not found or no changes detected.` }), headers: { 'Content-Type': 'application/json' } };
        }


        console.log(`Successfully updated schedule with ID: ${scheduleId}`);

        // Kembalikan data yang baru diupdate dengan status 200 OK
        return {
            statusCode: 200,
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
