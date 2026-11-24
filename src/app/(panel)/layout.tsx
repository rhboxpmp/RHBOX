import { requireUser } from "@/lib/auth";
import { loadWorkspaceSnapshot } from "@/lib/workspace";
import { RhboxInstantShell } from "@/components/rhbox-instant-shell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const initialData = await loadWorkspaceSnapshot(user);

  return (
    <>
      <RhboxInstantShell initialData={initialData} />
      {children}
    </>
  );
}
