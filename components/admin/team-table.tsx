"use client";

import type { ProofreaderTypeOption, TeamProfileRow, TopicOption } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { afterModalClose } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddTeamMemberModal } from "./add-team-member-modal";
import { TeamMemberEditModal } from "./team-member-edit-modal";

const GENDER_LABEL: Record<string, string> = { M: "זכר", F: "נקבה" };

interface TeamTableProps {
  profiles: TeamProfileRow[];
  proofreaderTypes: ProofreaderTypeOption[];
  topics: TopicOption[];
}

export function TeamTable({ profiles, proofreaderTypes, topics }: TeamTableProps) {
  const router = useRouter();
  const [editProfile, setEditProfile] = useState<TeamProfileRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const openEdit = (p: TeamProfileRow) => {
    setEditProfile(p);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => setEditProfile(null), 0);
  };

  return (
    <>
      <div className="flex justify-start">
        <Button onClick={() => setAddModalOpen(true)}>הוסף איש צוות</Button>
      </div>
      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>שם מלא</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>מגדר</TableHead>
                <TableHead>תפקידים</TableHead>
                <TableHead>נושאים משויכים</TableHead>
                <TableHead className="w-[80px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow className="border-0 !bg-transparent odd:!bg-transparent even:!bg-transparent hover:!bg-transparent">
                  <TableCell colSpan={6} className="py-8 text-center text-secondary">
                    אין אנשי צוות במערכת
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:!bg-primary-muted/50"
                    onClick={() => openEdit(p)}
                  >
                    <TableCell className="font-medium text-primary">
                      {p.full_name_he || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-secondary">
                      {p.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-secondary">
                      {GENDER_LABEL[p.gender] ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.is_respondent && (
                          <Badge className="rounded-md border-0 bg-blue-100 text-blue-800">
                            משיב
                          </Badge>
                        )}
                        {p.is_proofreader && (
                          <Badge className="rounded-md border-0 bg-violet-100 text-violet-800">
                            מגיה
                          </Badge>
                        )}
                        {p.is_linguistic_editor && (
                          <Badge className="rounded-md border-0 bg-emerald-100 text-emerald-800">
                            עורך לשוני
                          </Badge>
                        )}
                        {p.is_technical_lead && (
                          <Badge className="rounded-md border-0 bg-amber-100 text-amber-800">
                            אחראי טכני
                          </Badge>
                        )}
                        {!p.is_respondent && !p.is_proofreader && !p.is_linguistic_editor && !p.is_technical_lead && (
                          <span className="text-sm text-secondary">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-secondary">
                      {p.is_respondent && (p.topic_ids?.length ?? 0) > 0
                        ? (p.topic_ids ?? [])
                            .map((tid) => topics.find((t) => t.id === tid)?.name_he)
                            .filter(Boolean)
                            .join(", ") || "—"
                        : p.is_respondent
                          ? "—"
                          : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded-lg p-1.5 text-secondary hover:bg-primary/10 hover:text-primary"
                        aria-label="עריכת איש צוות"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TeamMemberEditModal
        profile={editProfile}
        proofreaderTypes={proofreaderTypes}
        topics={topics}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) afterModalClose(() => setEditProfile(null));
        }}
        onSuccess={() => {
          closeModal();
          router.refresh();
        }}
      />
      <AddTeamMemberModal
        proofreaderTypes={proofreaderTypes}
        topics={topics}
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
