import { apiOk, handleApiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { confirmAssignment } from "@/lib/services/confirm-assignment";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { confirmAssignmentSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = confirmAssignmentSchema.parse(await request.json());
    return apiOk(await confirmAssignment(createAdminClient(), await createClient(), id, input.assignments, input.publish));
  } catch (error) { return handleApiError(error); }
}

