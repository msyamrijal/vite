// Impor Supabase client library
import { createClient } from '@supabase/supabase-js';

// Ambil Supabase URL dan Anon Key dari Netlify Environment Variables
// Pastikan Anda sudah set variabel ini di Netlify UI!
// Variabel ini akan berisi URL dan ANON KEY yang Anda berikan.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Lakukan pengecekan awal saat fungsi di-load (best practice)
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("FATAL: Supabase URL or Anon Key environment variable is missing.");
    // Fungsi tidak akan bisa berjalan tanpa ini.
}

// Inisialisasi Supabase Client di luar handler agar bisa reuse koneksi
// Kita gunakan Anon Key karena ini endpoint publik untuk membaca data.
// Keamanan data diatur oleh RLS di Supabase.
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fungsi handler utama Netlify Function
exports.handler = async (event, context) => {

    // Validasi ulang di dalam handler jika diperlukan
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase URL or Anon Key missing inside handler.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error.' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }

    try {
        console.log("Attempting to fetch schedules from Supabase..."); // Log untuk debugging

        // *** PERHATIKAN: Ganti 'schedules' jika nama tabel Anda berbeda ***
        const tableName = 'schedules';

        // Query data dari Supabase
        let { data: schedules, error } = await supabase
            .from(tableName)
            // *** PERHATIKAN: Pastikan nama kolom ini sesuai dengan tabel Anda ***
            // Pilih kolom yang dibutuhkan oleh frontend Anda
            .select('id, institusi, mata_pelajaran, tanggal, peserta')
            // Urutkan berdasarkan tanggal, dari yang paling awal
            .order('tanggal', { ascending: true });

        // Tangani jika ada error dari Supabase
        if (error) {
            console.error(`Supabase fetch error from table '${tableName}':`, error);
            // Jangan kirim detail error Supabase ke client
            return {
                statusCode: 500, // Atau kode status error Supabase jika tersedia (error.code)
                body: JSON.stringify({ error: 'Failed to retrieve schedule data from database.' }),
                headers: { 'Content-Type': 'application/json' },
            };
        }

        console.log(`Successfully fetched ${schedules ? schedules.length : 0} schedules from table '${tableName}'.`); // Log jumlah data

        // Kembalikan data (atau array kosong jika tidak ada) dengan sukses
        return {
            statusCode: 200,
            body: JSON.stringify(schedules || []), // Pastikan selalu array
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Izinkan akses dari domain manapun
            },
        };

    } catch (error) {
        // Tangani error tak terduga lainnya (misalnya, error di luar try-catch Supabase)
        console.error('Unexpected error in getSchedules function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An unexpected server error occurred.', details: error.message }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
};