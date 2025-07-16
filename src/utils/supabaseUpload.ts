import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadAudioToSupabase(buffer: Buffer, filename: string): Promise<string> {
    // Save to 'workflowdocuments' bucket, inside 'audio/' folder
    const path = `audio/${filename}`;
    const { error } = await supabase.storage
        .from('workflowdocuments')
        .upload(path, buffer, { contentType: 'audio/wav', upsert: true });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from('workflowdocuments').getPublicUrl(path);
    if (!publicData || !publicData.publicUrl) throw new Error('Failed to get public URL');
    return publicData.publicUrl;
} 