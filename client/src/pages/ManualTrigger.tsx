import { useEffect } from "react";
import { useLocation } from "wouter";

// ManualTrigger is deprecated — redirect to Browse Creatives
export default function ManualTrigger() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/"); }, [setLocation]);
  return null;
}
