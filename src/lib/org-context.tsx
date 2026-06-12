"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Org, OrgMember } from "@/lib/database.types";
import { VERTICALS, type VerticalConfig } from "@/lib/verticals";

interface OrgContextType {
  currentOrg: Org | null;
  orgs: Org[];
  membership: OrgMember | null;
  verticalConfig: VerticalConfig | null;
  switchOrg: (orgId: string) => void;
  loading: boolean;
}

const OrgContext = createContext<OrgContextType>({
  currentOrg: null,
  orgs: [],
  membership: null,
  verticalConfig: null,
  switchOrg: () => {},
  loading: true,
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Org | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [membership, setMembership] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrgs() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Get all orgs the user belongs to
      const { data: memberships } = await supabase
        .from("org_members")
        .select("org_id, role")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const orgIds = memberships.map((m) => m.org_id);
      const { data: orgsData } = await supabase
        .from("orgs")
        .select("*")
        .in("id", orgIds);

      if (orgsData && orgsData.length > 0) {
        setOrgs(orgsData);

        // Try to restore last selected org from localStorage
        const savedOrgId = localStorage.getItem("serviceflow_current_org");
        const savedOrg = orgsData.find((o) => o.id === savedOrgId);
        const activeOrg = savedOrg || orgsData[0];

        setCurrentOrg(activeOrg);

        const activeMembership = memberships.find(
          (m) => m.org_id === activeOrg.id
        );
        setMembership(activeMembership as OrgMember | null);
      }

      setLoading(false);
    }

    loadOrgs();
  }, []);

  function switchOrg(orgId: string) {
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem("serviceflow_current_org", orgId);
    }
  }

  const verticalConfig = currentOrg
    ? VERTICALS[currentOrg.vertical]
    : null;

  return (
    <OrgContext.Provider
      value={{
        currentOrg,
        orgs,
        membership,
        verticalConfig,
        switchOrg,
        loading,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
}
