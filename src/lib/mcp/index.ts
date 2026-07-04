import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBookingsTool from "./tools/list-bookings";
import listClientsTool from "./tools/list-clients";
import whoamiTool from "./tools/whoami";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "concept-cleaning-mcp",
  title: "Concept Cleaning Services",
  version: "0.1.0",
  instructions:
    "Tools for the Concept Cleaning Services management system. Use `whoami` to verify connectivity, `list_bookings` to fetch recent bookings, and `list_clients` to search the CRM directory. All tools respect role-based access (Agent, Admin, Super Admin).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listBookingsTool, listClientsTool],
});
