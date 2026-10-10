import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import type { AuthorGroupMemberDTO } from "../api/groupsApi";
import { normalizeMemberRole } from "../lib/groupPermissions";

type GroupMembersTableProps = {
  members: AuthorGroupMemberDTO[];
};

const GroupMembersTable = ({ members }: GroupMembersTableProps) => {
  const { t } = useTranslate();
  return (
    <div className="overflow-x-auto">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead>{t("studio.common.name")}</Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.groups.components.members.email")}
            </Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.groups.components.members.role")}
            </Pecha.TableHead>
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {members.map((member) => (
            <Pecha.TableRow key={member.author_id}>
              <Pecha.TableCell>
                {member.firstname} {member.lastname}
              </Pecha.TableCell>
              <Pecha.TableCell className="text-muted-foreground">
                {member.email}
              </Pecha.TableCell>
              <Pecha.TableCell>
                {t(
                  `studio.groups.components.role.${normalizeMemberRole(member.role).toLowerCase()}`,
                )}
              </Pecha.TableCell>
            </Pecha.TableRow>
          ))}
        </Pecha.TableBody>
      </Pecha.Table>
    </div>
  );
};

export default GroupMembersTable;
