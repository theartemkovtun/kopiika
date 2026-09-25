import { initAnalytics } from "@/lib/analytics";

// Runs before hydration (Next's instrumentation-client convention), so the
// analytics session is open before the first page view is logged.
initAnalytics();
