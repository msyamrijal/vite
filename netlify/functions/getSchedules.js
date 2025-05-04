// Lokasi file: netlify/functions/getSchedules.js

import { createClient } from '@supabase/supabase-js';

// Ambil Supabase URL dan Anon Key dari Netlify Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Gunakan Anon Key

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("FATAL: Supabase URL or Anon Key environment variable is missing.");
}

// Inisialisasi Supabase Client di luar handler
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fungsi handler utama Netlify Function
exports.handler = async (event, context) => {

    if (!supabaseUrl || !supabaseAnonKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }

    try {
        const tableName = 'schedules'; // Pastikan nama tabel benar

        // Ambil data dari Supabase
        let { data: schedules, error } = await supabase
            .from(tableName)
            .select('id, institusi, mata_pelajaran, tanggal, peserta') // Pilih kolom yang dibutuhkan
            .order('tanggal', { ascending: true });

        if (error) {
            console.error(`[getSchedules] Supabase fetch error from table '${tableName}':`, error);
            return { statusCode: 500, body: JSON.stringify({ error: 'Failed to retrieve schedule data.' }) };
        }

        // Kembalikan data
        return {
            statusCode: 200,
            body: JSON.stringify(schedules || []),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
             },
        };

    } catch (error) {
        console.error('[getSchedules] Unexpected error:', error);
        return {
             statusCode: 500,
             body: JSON.stringify({ error: 'An unexpected server error occurred.' })
        };
    }
};
