import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { Pecha } from "@/components/ui/shadimport";
import { fetchTraditionOptions } from "@/components/routes/traditions/api/traditionsApi";
import type { GroupCoreFormData } from "@/schema/GroupSchema";
import type { GroupTraditionDTO } from "../api/groupsApi";
import { NO_TRADITION, traditionPickerOptions } from "../lib/groupTradition";

type GroupTraditionFieldProps = {
  form: UseFormReturn<GroupCoreFormData>;
  /** The group's saved tradition, so it still shows if the list lacks it. */
  currentTradition?: GroupTraditionDTO | null;
};

const GroupTraditionField = ({
  form,
  currentTradition,
}: GroupTraditionFieldProps) => {
  // Under "cms-traditions" so the Traditions page's invalidation refreshes it.
  const { data: options = [], isError } = useQuery({
    queryKey: ["cms-traditions", "options"],
    queryFn: () => fetchTraditionOptions("en"),
    staleTime: 5 * 60 * 1000,
  });
  const choices = traditionPickerOptions(options, currentTradition);

  return (
    <Pecha.FormField
      control={form.control}
      name="tradition_code"
      render={({ field }) => (
        <Pecha.FormItem>
          <Pecha.FormLabel className="text-sm font-bold">
            Tradition
          </Pecha.FormLabel>
          <Pecha.Select
            value={field.value || NO_TRADITION}
            onValueChange={(value) =>
              field.onChange(value === NO_TRADITION ? "" : value)
            }
          >
            <Pecha.FormControl>
              <Pecha.SelectTrigger className="h-12 w-full bg-white dark:bg-[#262626]">
                <Pecha.SelectValue placeholder="Select a tradition" />
              </Pecha.SelectTrigger>
            </Pecha.FormControl>
            <Pecha.SelectContent>
              <Pecha.SelectItem value={NO_TRADITION}>
                No tradition
              </Pecha.SelectItem>
              {choices.map((option) => (
                <Pecha.SelectItem key={option.code} value={option.code}>
                  {option.name}
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
          <p className="text-xs text-muted-foreground">
            {isError
              ? "Couldn't load the traditions list. Try again later."
              : "The Buddhist tradition this group practises in."}
          </p>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

export default GroupTraditionField;
