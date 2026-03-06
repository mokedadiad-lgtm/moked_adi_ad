"use client";

import type { CategoryOption, ProofreaderTypeOption, TeamProfileRow } from "@/app/admin/actions";
import { seedDefaultCategories } from "@/app/admin/actions";
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddTeamMemberModal } from "./add-team-member-modal";
import { TeamMemberEditModal } from "./team-member-edit-modal";

const GENDER_LABEL: Record<string, string> = { M: "זכר", F: "נקבה" };

interface TeamTableProps {
  profiles: TeamProfileRow[];
  categories: CategoryOption[];
  proofreaderTypes: ProofreaderTypeOption[];
}

export function TeamTable({ profiles, categories, proofreaderTypes }: TeamTableProps) {
  const router = useRouter();
  const [editProfile, setEditProfile] = useState<TeamProfileRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const openEdit = (p: TeamProfileRow) => {
    setEditProfile(p);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditProfile(null);
  };

  const handleSeedCategories = async () => {
    setSeeding(true);
    const result = await seedDefaultCategories();
    setSeeding(false);
    if (result.ok && result.count > 0) router.refresh();
  };

  return (
    <>
      {categories.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-start">
          <p className="text-sm text-amber-800">
            אין קטגוריות במערכת. לחץ כדי לטעון קטגוריות ברירת מחדל (הלכה, ייעוץ, משפחה, כללי).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={handleSeedCategories}
            disabled={seeding}
          >
            {seeding ? "טוען…" : "טען קטגוריות ברירת מחדל"}
          </Button>
        </div>
      )}
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
                <TableHead className="w-[80px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-start text-secondary">
                    אין אנשי צוות במערכת
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-primary-muted/50"
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
        categories={categories}
        proofreaderTypes={proofreaderTypes}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditProfile(null);
        }}
        onSuccess={() => {
          closeModal();
          router.refresh();
        }}
      />
      <AddTeamMemberModal
        categories={categories}
        proofreaderTypes={proofreaderTypes}
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
