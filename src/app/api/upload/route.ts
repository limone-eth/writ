import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAuthed } from "@/lib/auth";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGE_MB } from "@/lib/images";

export const dynamic = "force-dynamic";

/**
 * Hands the editor a short-lived token so the browser can upload an image
 * straight to Vercel Blob. The file itself never reaches this route; only
 * the token request does, which is the one carrying the session cookie —
 * so this is where the upload is allowed or refused.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return new Response("Expected JSON", { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await isAuthed())) throw new Error("Not signed in.");
        // The token is scoped to one path: a leaked one cannot write
        // anywhere else in the store.
        if (!/^posts\/\d+\/[^/]+$/.test(pathname)) throw new Error("Bad image path.");
        return {
          allowedContentTypes: [...IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    console.error("[upload]", e);
    // One reader, one writer: the reason can go back as it is.
    const message = !process.env.BLOB_READ_WRITE_TOKEN
      ? "Image storage is not configured on this server."
      : e instanceof Error && e.message
        ? e.message
        : `Upload refused. Images must be under ${MAX_IMAGE_MB} MB.`;
    return Response.json({ error: message }, { status: 400 });
  }
}
