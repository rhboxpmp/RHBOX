import { requireUser } from "@/lib/auth";
import { loadWorkspaceSnapshot } from "@/lib/workspace";
import { RhboxInstantShell } from "@/components/rhbox-instant-shell";

export async function PanelEntry() {
  const user = await requireUser();
  const initialData = await loadWorkspaceSnapshot(user);
  return <RhboxInstantShell initialData={initialData} />;
}
