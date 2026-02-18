import { useEffect } from "react";
import { useLocation } from "wouter";

// StaticPipeline is deprecated — redirect to Browse Creatives
export default function StaticPipeline() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/"); }, [setLocation]);
  return null;
}
