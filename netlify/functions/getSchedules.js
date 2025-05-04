// Lokasi file: netlify/functions/getSchedules.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Gunakan Anon Key

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("FATAL: Supabase URL or Anon Key environment variable is missing.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.handler = async (event, context) => {

    if (!supabaseUrl || !supabaseAnonKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }

    try {
        console.log("[getSchedules] Attempting to fetch schedules from Supabase...");
        const tableName = 'schedules'; // Pastikan nama tabel benar

        let { data: schedules, error } = await supabase
            .from(tableName)
            .select('id, institusi, mata_pelajaran, tanggal, peserta') // Pastikan 'peserta' ada
            .order('tanggal', { ascending: true });

        if (error) {
            console.error(`[getSchedules] Supabase fetch error from table '${tableName}':`, error);
            return { statusCode: 500, body: JSON.stringify({ error: 'Failed to retrieve schedule data.' }) };
        }

        console.log(`[getSchedules] Successfully fetched ${schedules ? schedules.length : 0} schedules.`);
        if (schedules && schedules.length > 0) {
            console.log("[getSchedules] Sample data:", JSON.stringify(schedules[0]));
        }

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
