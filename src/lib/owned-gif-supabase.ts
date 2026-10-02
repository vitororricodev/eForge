import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { GIF_BUCKET } from "./owned-gif-manifest";
import type { GifImportAdapter, GifInventory } from "./owned-gif-import";
export function ownedGifAdapter(client: SupabaseClient<Database>): GifImportAdapter {
  return {
    inspect: async (entries) => {
      const { data, error } = await client.rpc("inspect_owned_gif_assets", { p_entries: entries });
      if (error) throw new Error(error.message);
      return data as unknown as GifInventory[];
    },
    upload: async (path, bytes) => {
      const { error } = await client.storage
        .from(GIF_BUCKET)
        .upload(path, bytes, { contentType: "image/gif", cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
    },
    save: async (entry, url) => {
      const { data, error } = await client.rpc("import_owned_gif", {
        p_entry: entry as unknown as Json,
        p_gif_url: url,
      });
      if (error) throw new Error(error.message);
      return data as { id: string; status: string; deleted: boolean };
    },
    publicUrl: (path) => client.storage.from(GIF_BUCKET).getPublicUrl(path).data.publicUrl,
  };
}
