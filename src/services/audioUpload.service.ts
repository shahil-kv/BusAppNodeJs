import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function uploadAudioToSupabase(
    localPath: string,
    questionHash: string,
): Promise<string> {
    const fileName = `audio/question_${questionHash}.mp3`;
    const fileBuffer = fs.readFileSync(localPath);

    const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(fileName, fileBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
        });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const {
        data: { publicUrl },
    } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(fileName);
    return publicUrl;
}
