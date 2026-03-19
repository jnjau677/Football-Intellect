import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type MatchWithTeams, type Prediction } from "@shared/schema";

// GET /api/matches
export function useMatches() {
  return useQuery({
    queryKey: [api.matches.list.path],
    queryFn: async () => {
      const res = await fetch(api.matches.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      return api.matches.list.responses[200].parse(data) as MatchWithTeams[];
    },
    // Poll every 10 seconds for live scores
    refetchInterval: 10000,
  });
}

// GET /api/matches/:id
export function useMatch(id: number) {
  return useQuery({
    queryKey: [api.matches.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.matches.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch match details");
      const data = await res.json();
      return api.matches.get.responses[200].parse(data) as MatchWithTeams;
    },
    refetchInterval: 10000,
  });
}

// POST /api/matches/:id/predict
export function usePredictMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.matches.predict.path, { id });
      const res = await fetch(url, {
        method: api.matches.predict.method,
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 404) throw new Error("Match not found");
        const error = await res.json();
        throw new Error(error.message || "Prediction failed");
      }
      
      return api.matches.predict.responses[200].parse(await res.json()) as Prediction;
    },
    onSuccess: (data, variables) => {
      // Invalidate the specific match query to show the new prediction
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, variables] });
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
    },
  });
}
