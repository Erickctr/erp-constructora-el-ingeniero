"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { DataProvider } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}

