import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "./useToast";

export function useAppError() {
  const { toast } = useToast();

  return (error: unknown, fallback: string) => {
    toast({
      title: "Error",
      description: getGraphQLErrorMessage(error, fallback),
      variant: "destructive",
    });
  };
}
