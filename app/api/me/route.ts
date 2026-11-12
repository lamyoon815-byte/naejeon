import { apiOk, handleApiError } from "@/lib/api-response";
import { getViewer } from "@/lib/auth";

export async function GET() {
  try {
    const { user, isAdmin } = await getViewer();
    return apiOk({ signedIn: Boolean(user), isAdmin });
  } catch (error) { return handleApiError(error); }
}
