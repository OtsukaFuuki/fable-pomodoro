// Service Worker 登録。layout からマウントする（Phase 4）
"use client";
import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
