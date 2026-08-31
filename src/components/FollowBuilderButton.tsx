import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthSession } from "@/lib/auth";
import { followBuilder, myFollowsQuery, unfollowBuilder } from "@/lib/follows";

/**
 * Follow / unfollow a builder by their Bitcoin address. Requires a real
 * signed-in account; anonymous visitors are told to sign in.
 */
export function FollowBuilderButton({
  address,
  followers,
  className,
}: {
  address: string;
  followers?: number | undefined;
  className?: string | undefined;
}) {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();
  const follows = useQuery({ ...myFollowsQuery(), enabled: Boolean(user) });
  const following = follows.data?.includes(address) ?? false;

  const mutation = useMutation({
    mutationFn: async () => {
      if (following) await unfollowBuilder(address);
      else await followBuilder(address);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-builder-follows"] });
      void queryClient.invalidateQueries({ queryKey: ["builder-follower-counts"] });
      toast.success(following ? "UNFOLLOWED BUILDER" : "FOLLOWING BUILDER");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message.toUpperCase() : "FOLLOW FAILED");
    },
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user) {
          toast.error("SIGN IN TO FOLLOW BUILDERS");
          return;
        }
        mutation.mutate();
      }}
      className={`label rounded border px-2 py-1 transition-colors disabled:opacity-50 ${
        following
          ? "border-primary text-primary hover:bg-primary/10"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      } ${className ?? ""}`}
    >
      {following ? "FOLLOWING" : "FOLLOW"}
      {typeof followers === "number" ? ` · ${followers}` : ""}
    </button>
  );
}
