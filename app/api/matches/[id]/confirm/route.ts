import { apiOk, handleApiError } from "@/lib/api-response";
import { confirmAssignment } from "@/lib/services/confirm-assignment";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmAssignmentSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = confirmAssignmentSchema.parse(await request.json());
    const admin = createAdminClient();
    return apiOk(await confirmAssignment(admin, admin, id, input.assignments, input.publish));
  } catch (error) { return handleApiError(error); }
}

